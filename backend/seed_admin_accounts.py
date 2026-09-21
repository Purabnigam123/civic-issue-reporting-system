"""
Seed Super Admin + 11 Zonal Admins + Sample Field Workers for each zone.
Run:  python seed_admin_accounts.py
"""

import asyncio
from motor.motor_asyncio import AsyncIOMotorClient
from app.models.user import hash_password, UserRole
from app.models.district import DELHI_DISTRICTS
from datetime import datetime, timezone

MONGODB_URI = "mongodb://localhost:27017/civic-issue-reporting"

SUPER_ADMIN = {
    "name": "Super Admin",
    "email": "superadmin@civicpulse.in",
    "phone": "9999000000",
    "password": "admin@123",
    "role": UserRole.SUPER_ADMIN.value,
}

ZONAL_ADMINS = [
    {
        "district_id": d["id"],
        "district": d["name"],
        "name": f"{d['name']} Admin",
        "email": f"{d['id'].replace('_', '')}@civicpulse.in",
        "phone": f"98{str(i).zfill(8)}",
        "password": "zonal@123",
        "role": UserRole.ZONAL_ADMIN.value,
    }
    for i, d in enumerate(DELHI_DISTRICTS, start=1)
]

SAMPLE_WORKERS = [
    {
        "name": f"Worker {d['name']}",
        "email": f"worker.{d['id'].replace('_', '')}@civicpulse.in",
        "phone": f"97{str(i).zfill(8)}",
        "password": "worker@123",
        "role": UserRole.WORKER.value,
        "district_id": d["id"],
        "worker_id": f"WKR-{d['id'][:3].upper()}-001",
        "skills": ["Pothole Repair", "Road Maintenance", "Drainage"],
    }
    for i, d in enumerate(DELHI_DISTRICTS, start=1)
]


async def seed():
    client = AsyncIOMotorClient(MONGODB_URI)
    db = client.get_default_database(default="civic-issue-reporting")

    now = datetime.now(timezone.utc)
    created = 0
    skipped = 0

    # --- Super Admin ---
    existing = await db.users.find_one({"email": SUPER_ADMIN["email"]})
    if existing:
        skipped += 1
    else:
        doc = {
            **SUPER_ADMIN,
            "password": hash_password(SUPER_ADMIN["password"]),
            "status": "ACTIVE",
            "created_at": now,
            "updated_at": now,
        }
        await db.users.insert_one(doc)
        created += 1

    # --- Zonal Admins ---
    for za in ZONAL_ADMINS:
        existing = await db.users.find_one({"email": za["email"]})
        if existing:
            skipped += 1
            continue

        doc = {
            **za,
            "password": hash_password(za["password"]),
            "status": "ACTIVE",
            "created_at": now,
            "updated_at": now,
        }
        await db.users.insert_one(doc)
        created += 1

    # --- Field Workers ---
    for w in SAMPLE_WORKERS:
        existing = await db.users.find_one({"email": w["email"]})
        if existing:
            skipped += 1
            continue

        doc = {
            **w,
            "password": hash_password(w["password"]),
            "status": "ACTIVE",
            "created_at": now,
            "updated_at": now,
        }
        await db.users.insert_one(doc)
        created += 1

    print(f"Seed complete. Created: {created}, Skipped: {skipped}")
    client.close()


if __name__ == "__main__":
    asyncio.run(seed())
