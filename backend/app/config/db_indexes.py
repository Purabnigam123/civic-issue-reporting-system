"""
MongoDB Index Definitions: creates geospatial, compound, and single-field indexes
on startup to support all upgrade features (nearby queries, filtering, SLA tracking).

Also handles the GeoJSON `location` field migration for existing complaints
that only have lat/lng as separate float fields.
"""

from datetime import datetime, timezone
from typing import Dict, Any

from ..database.mongodb import get_database


async def create_indexes():
    """Create all required MongoDB indexes. Safe to call multiple times."""
    db = get_database()

    # ── Complaints collection indexes ─────────────────────────────
    try:
        # GeoJSON 2dsphere index for nearby/map queries
        await db.complaints.create_index([("location", "2dsphere")], background=True, sparse=True)
    except Exception as e:
        print(f"[Index] 2dsphere index creation note: {e}")

    try:
        # Compound indexes for common filter patterns
        await db.complaints.create_index(
            [("category", 1), ("status", 1), ("district_id", 1)],
            background=True,
        )
        await db.complaints.create_index(
            [("assignedWorkerId", 1), ("status", 1)],
            background=True,
        )
        await db.complaints.create_index(
            [("district_id", 1), ("status", 1)],
            background=True,
        )
        await db.complaints.create_index(
            [("status", 1), ("slaDeadline", 1)],
            background=True,
        )
        await db.complaints.create_index(
            [("citizenId", 1), ("createdAt", -1)],
            background=True,
        )
        await db.complaints.create_index(
            [("createdAt", -1)],
            background=True,
        )
        await db.complaints.create_index(
            [("complaintId", 1)],
            unique=True,
            background=True,
        )
        await db.complaints.create_index(
            [("slaStatus", 1)],
            background=True,
        )
        await db.complaints.create_index(
            [("priority", 1), ("status", 1)],
            background=True,
        )
    except Exception as e:
        print(f"[Index] Complaint index creation note: {e}")

    # ── Users collection indexes ──────────────────────────────────
    try:
        await db.users.create_index(
            [("email", 1)],
            unique=True,
            background=True,
        )
        await db.users.create_index(
            [("role", 1), ("district_id", 1)],
            background=True,
        )
        await db.users.create_index(
            [("role", 1), ("district_id", 1), ("availability_status", 1)],
            background=True,
        )
    except Exception as e:
        print(f"[Index] User index creation note: {e}")

    # ── Notifications collection indexes ──────────────────────────
    try:
        await db.notifications.create_index(
            [("userId", 1), ("createdAt", -1)],
            background=True,
        )
    except Exception as e:
        print(f"[Index] Notification index note: {e}")

    # ── Audit logs collection indexes ─────────────────────────────
    try:
        await db.audit_logs.create_index(
            [("created_at", -1)],
            background=True,
        )
        await db.audit_logs.create_index(
            [("action", 1), ("created_at", -1)],
            background=True,
        )
    except Exception as e:
        print(f"[Index] Audit log index note: {e}")

    # ── ComplaintConfirmations collection indexes ─────────────────
    try:
        # Unique: one confirmation per user per complaint
        await db.complaint_confirmations.create_index(
            [("complaint_id", 1), ("user_id", 1)],
            unique=True,
            background=True,
            name="unique_user_complaint_confirmation",
        )
        # Fast lookup of most-recent confirmation for a complaint
        await db.complaint_confirmations.create_index(
            [("complaint_id", 1), ("confirmed_at", -1)],
            background=True,
        )
    except Exception as e:
        print(f"[Index] ComplaintConfirmations index note: {e}")

    print("[Index] All MongoDB indexes created/verified successfully")


async def migrate_geojson_locations():
    """
    Backfill the GeoJSON `location` field for complaints that have lat/lng
    but no location field. This enables $nearSphere queries.
    """
    db = get_database()

    # Find complaints with lat/lng but no location field
    query = {
        "latitude": {"$exists": True, "$ne": None},
        "longitude": {"$exists": True, "$ne": None},
        "location": {"$exists": False},
    }

    cursor = db.complaints.find(query, {"_id": 1, "latitude": 1, "longitude": 1})
    migrated = 0

    async for doc in cursor:
        try:
            lat = float(doc.get("latitude"))
            lng = float(doc.get("longitude"))
            if -90 <= lat <= 90 and -180 <= lng <= 180:
                await db.complaints.update_one(
                    {"_id": doc["_id"]},
                    {"$set": {
                        "location": {
                            "type": "Point",
                            "coordinates": [lng, lat],  # GeoJSON is [lng, lat]
                        }
                    }},
                )
                migrated += 1
        except (TypeError, ValueError):
            continue

    if migrated > 0:
        print(f"[Migration] Backfilled GeoJSON location for {migrated} complaints")
    else:
        print("[Migration] No complaints needed GeoJSON backfill")

    return migrated
