"""
Smart Duplicate Detection Service: identifies potential duplicate complaints
based on geographic proximity, category match, time proximity, and text similarity.

Uses token-based Jaccard similarity for description comparison — lightweight
and effective for civic complaint text without external NLP dependencies.
"""

from datetime import datetime, timedelta, timezone
from typing import Dict, Any, List, Optional, Tuple
from math import radians, sin, cos, sqrt, atan2
from bson import ObjectId

from ..database.mongodb import get_database
from ..models.complaint import ComplaintStatus, format_complaint_dict


# ── Configuration ─────────────────────────────────────────────────
DUPLICATE_RADIUS_METERS = 200.0          # Geographic proximity threshold
DUPLICATE_TIME_WINDOW_HOURS = 72         # Look-back window
DUPLICATE_SCORE_THRESHOLD = 0.55         # Minimum score to flag as potential duplicate
GEO_WEIGHT = 0.35                        # Geographic proximity weight
CATEGORY_WEIGHT = 0.30                   # Category match weight
TEXT_WEIGHT = 0.20                        # Text similarity weight
TIME_WEIGHT = 0.15                       # Time proximity weight


def _haversine_meters(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    """Calculate distance between two GPS points in meters."""
    radius = 6371000.0
    phi1, phi2 = radians(lat1), radians(lat2)
    dphi = radians(lat2 - lat1)
    dlambda = radians(lon2 - lon1)
    a = sin(dphi / 2) ** 2 + cos(phi1) * cos(phi2) * sin(dlambda / 2) ** 2
    return 2 * radius * atan2(sqrt(a), sqrt(1 - a))


def _tokenize(text: str) -> set:
    """Simple whitespace + lowercase tokenization."""
    return set(text.lower().split()) if text else set()


def _jaccard_similarity(text_a: str, text_b: str) -> float:
    """Compute Jaccard similarity between two text strings."""
    tokens_a = _tokenize(text_a)
    tokens_b = _tokenize(text_b)
    if not tokens_a or not tokens_b:
        return 0.0
    intersection = tokens_a & tokens_b
    union = tokens_a | tokens_b
    return len(intersection) / len(union)


async def find_duplicates(
    category: str,
    latitude: float,
    longitude: float,
    description: str = "",
    radius_meters: float = DUPLICATE_RADIUS_METERS,
    time_window_hours: int = DUPLICATE_TIME_WINDOW_HOURS,
    exclude_complaint_id: Optional[str] = None,
    limit: int = 10,
) -> Dict[str, Any]:
    """
    Find potential duplicate complaints near a given location with the same category.

    Returns:
      - is_duplicate: bool — whether any match exceeds the threshold
      - duplicates: list of scored matches
      - best_match: the highest-scored potential duplicate (or None)
    """
    db = get_database()
    now = datetime.now(timezone.utc)
    cutoff = now - timedelta(hours=time_window_hours)

    # Build query for nearby same-category complaints
    query: Dict[str, Any] = {
        "category": category,
        "status": {"$nin": [
            ComplaintStatus.REJECTED.value,
            ComplaintStatus.CLOSED.value,
        ]},
        "createdAt": {"$gte": cutoff},
        "latitude": {"$exists": True, "$ne": None},
        "longitude": {"$exists": True, "$ne": None},
    }
    if exclude_complaint_id:
        query["complaintId"] = {"$ne": exclude_complaint_id}

    # Try geospatial query first
    candidates = []
    try:
        geo_query = dict(query)
        geo_query.pop("latitude", None)
        geo_query.pop("longitude", None)
        geo_query["location"] = {
            "$nearSphere": {
                "$geometry": {"type": "Point", "coordinates": [longitude, latitude]},
                "$maxDistance": radius_meters,
            }
        }
        cursor = db.complaints.find(geo_query).limit(limit * 2)
        candidates = await cursor.to_list(None)
    except Exception:
        # Fallback: brute-force scan
        cursor = db.complaints.find(query).sort("createdAt", -1).limit(200)
        raw_candidates = await cursor.to_list(None)
        for c in raw_candidates:
            try:
                c_lat = float(c.get("latitude"))
                c_lng = float(c.get("longitude"))
                dist = _haversine_meters(latitude, longitude, c_lat, c_lng)
                if dist <= radius_meters:
                    c["_computed_distance"] = dist
                    candidates.append(c)
            except (TypeError, ValueError):
                continue
        candidates.sort(key=lambda x: x.get("_computed_distance", 9999))
        candidates = candidates[:limit * 2]

    # Score each candidate
    scored_duplicates: List[Dict[str, Any]] = []

    for candidate in candidates:
        try:
            c_lat = float(candidate.get("latitude"))
            c_lng = float(candidate.get("longitude"))
        except (TypeError, ValueError):
            continue

        # 1. Geographic score: closer = higher
        distance = candidate.get("_computed_distance") or _haversine_meters(
            latitude, longitude, c_lat, c_lng
        )
        geo_score = max(0.0, 1.0 - (distance / radius_meters))

        # 2. Category score: exact match = 1.0
        cat_score = 1.0 if candidate.get("category") == category else 0.0

        # 3. Text similarity score
        text_score = _jaccard_similarity(description, candidate.get("description", ""))

        # 4. Time proximity score: more recent = higher
        c_created = candidate.get("createdAt")
        if isinstance(c_created, datetime):
            if c_created.tzinfo is None:
                c_created = c_created.replace(tzinfo=timezone.utc)
            age_hours = (now - c_created).total_seconds() / 3600.0
            time_score = max(0.0, 1.0 - (age_hours / time_window_hours))
        else:
            time_score = 0.5

        # Composite score
        composite = (
            geo_score * GEO_WEIGHT
            + cat_score * CATEGORY_WEIGHT
            + text_score * TEXT_WEIGHT
            + time_score * TIME_WEIGHT
        )

        if composite >= DUPLICATE_SCORE_THRESHOLD * 0.5:  # Include even low matches for info
            scored_duplicates.append({
                "complaint": format_complaint_dict(candidate),
                "duplicate_score": round(composite, 3),
                "distance_meters": round(distance, 1),
                "factors": {
                    "geographic": round(geo_score, 3),
                    "category_match": round(cat_score, 3),
                    "text_similarity": round(text_score, 3),
                    "time_proximity": round(time_score, 3),
                },
            })

    # Sort by score descending
    scored_duplicates.sort(key=lambda x: x["duplicate_score"], reverse=True)
    scored_duplicates = scored_duplicates[:limit]

    # Determine if flagged as duplicate
    is_duplicate = any(d["duplicate_score"] >= DUPLICATE_SCORE_THRESHOLD for d in scored_duplicates)
    best_match = scored_duplicates[0] if scored_duplicates else None

    reasons = []
    if is_duplicate and best_match:
        factors = best_match["factors"]
        if factors["geographic"] > 0.7:
            reasons.append(f"Very close to existing complaint ({best_match['distance_meters']}m)")
        if factors["text_similarity"] > 0.4:
            reasons.append("Description is similar to existing complaint")
        if factors["time_proximity"] > 0.5:
            reasons.append("Recently reported issue nearby")

    return {
        "is_duplicate": is_duplicate,
        "duplicate_score": best_match["duplicate_score"] if best_match else 0.0,
        "duplicates": scored_duplicates,
        "best_match": best_match,
        "reasons": reasons,
        "total_candidates": len(scored_duplicates),
    }
