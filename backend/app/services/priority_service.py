"""
AI Priority Engine: computes a data-driven priority score (0–100) for each
complaint based on category severity, nearby complaint density, AI confidence,
upvote momentum, and complaint age.

All factors are derived from actual database values — no fabricated insights.
"""

from datetime import datetime, timedelta, timezone
from typing import Dict, Any, List, Optional, Tuple
from bson import ObjectId

from ..database.mongodb import get_database
from ..models.complaint import ComplaintPriority, ComplaintCategory


# ── Weight configuration ──────────────────────────────────────────────
CATEGORY_SEVERITY_WEIGHT = 30   # Max points from category inherent severity
AI_CONFIDENCE_WEIGHT = 20       # Max points from AI detection confidence
NEARBY_DENSITY_WEIGHT = 20      # Max points from nearby complaint density
UPVOTE_WEIGHT = 15              # Max points from citizen upvotes
AGE_WEIGHT = 15                 # Max points from complaint age (older = higher)

# Category base severity scores (0.0–1.0)
CATEGORY_SEVERITY: Dict[str, float] = {
    ComplaintCategory.WATER_ISSUE.value: 0.95,
    ComplaintCategory.DRAINAGE.value: 0.90,
    ComplaintCategory.POTHOLE.value: 0.70,
    ComplaintCategory.BROKEN_STREETLIGHT.value: 0.65,
    ComplaintCategory.ROAD_DAMAGE.value: 0.60,
    ComplaintCategory.GARBAGE.value: 0.50,
    ComplaintCategory.PUBLIC_PROPERTY.value: 0.45,
    ComplaintCategory.OTHER.value: 0.30,
}

# Score thresholds for priority levels
PRIORITY_THRESHOLDS = [
    (80, ComplaintPriority.CRITICAL),
    (60, ComplaintPriority.HIGH),
    (35, ComplaintPriority.MEDIUM),
    (0,  ComplaintPriority.LOW),
]


def _score_to_priority(score: float) -> ComplaintPriority:
    """Convert a numeric score to a ComplaintPriority enum value."""
    for threshold, priority in PRIORITY_THRESHOLDS:
        if score >= threshold:
            return priority
    return ComplaintPriority.LOW


async def calculate_priority_score(
    category: str,
    latitude: float,
    longitude: float,
    ai_confidence: float = 0.0,
    upvotes: int = 0,
    created_at: Optional[datetime] = None,
    nearby_radius_meters: float = 500.0,
) -> Dict[str, Any]:
    """
    Calculate a composite priority score (0–100) for a complaint.

    Returns a dict with:
      - priority_score: float (0–100)
      - priority_level: str (CRITICAL/HIGH/MEDIUM/LOW)
      - priority_factors: dict of individual factor contributions
    """
    db = get_database()
    now = datetime.now(timezone.utc)
    if created_at is None:
        created_at = now

    factors: Dict[str, Any] = {}

    # 1. Category severity factor
    cat_severity = CATEGORY_SEVERITY.get(category, 0.30)
    cat_score = cat_severity * CATEGORY_SEVERITY_WEIGHT
    factors["category_severity"] = {
        "score": round(cat_score, 1),
        "max": CATEGORY_SEVERITY_WEIGHT,
        "raw_severity": cat_severity,
    }

    # 2. AI confidence factor
    ai_score = min(ai_confidence, 1.0) * AI_CONFIDENCE_WEIGHT
    factors["ai_confidence"] = {
        "score": round(ai_score, 1),
        "max": AI_CONFIDENCE_WEIGHT,
        "raw_confidence": round(ai_confidence, 2),
    }

    # 3. Nearby density factor — count complaints of same category within radius
    nearby_count = 0
    try:
        # Use location field if 2dsphere index exists, else fall back
        nearby_query = {
            "category": category,
            "status": {"$nin": ["REJECTED", "CLOSED", "VERIFIED"]},
            "location": {
                "$nearSphere": {
                    "$geometry": {"type": "Point", "coordinates": [longitude, latitude]},
                    "$maxDistance": nearby_radius_meters,
                }
            },
        }
        nearby_count = await db.complaints.count_documents(nearby_query)
    except Exception:
        # Fallback: no geospatial index yet, count same-category open complaints
        nearby_count = await db.complaints.count_documents({
            "category": category,
            "status": {"$nin": ["REJECTED", "CLOSED", "VERIFIED"]},
        })
        nearby_count = min(nearby_count, 10)  # Cap the fallback

    density_ratio = min(nearby_count / 10.0, 1.0)  # Normalize: 10+ = max score
    density_score = density_ratio * NEARBY_DENSITY_WEIGHT
    factors["nearby_density"] = {
        "score": round(density_score, 1),
        "max": NEARBY_DENSITY_WEIGHT,
        "nearby_count": nearby_count,
    }

    # 4. Upvote momentum factor
    upvote_ratio = min(upvotes / 25.0, 1.0)  # 25+ upvotes = max
    upvote_score = upvote_ratio * UPVOTE_WEIGHT
    factors["upvote_momentum"] = {
        "score": round(upvote_score, 1),
        "max": UPVOTE_WEIGHT,
        "upvotes": upvotes,
    }

    # 5. Age factor — older unresolved complaints get higher priority
    age_hours = max((now - created_at).total_seconds() / 3600.0, 0)
    age_ratio = min(age_hours / 72.0, 1.0)  # 72h+ = max
    age_score = age_ratio * AGE_WEIGHT
    factors["complaint_age"] = {
        "score": round(age_score, 1),
        "max": AGE_WEIGHT,
        "age_hours": round(age_hours, 1),
    }

    # Composite score
    total_score = round(cat_score + ai_score + density_score + upvote_score + age_score, 1)
    total_score = min(total_score, 100.0)
    priority_level = _score_to_priority(total_score)

    return {
        "priority_score": total_score,
        "priority_level": priority_level.value,
        "priority_factors": factors,
        "priority_calculated_at": now.isoformat(),
    }


async def recalculate_complaint_priority(complaint_id: str) -> Optional[Dict[str, Any]]:
    """Recalculate and update priority for an existing complaint."""
    db = get_database()
    try:
        complaint = await db.complaints.find_one({"_id": ObjectId(complaint_id)})
    except Exception:
        return None

    if not complaint:
        return None

    result = await calculate_priority_score(
        category=complaint.get("category", "other"),
        latitude=float(complaint.get("latitude", 0)),
        longitude=float(complaint.get("longitude", 0)),
        ai_confidence=float(complaint.get("aiConfidence", 0)),
        upvotes=int(complaint.get("upvotes", 0)),
        created_at=complaint.get("createdAt"),
    )

    now = datetime.now(timezone.utc)
    await db.complaints.update_one(
        {"_id": ObjectId(complaint_id)},
        {"$set": {
            "priority_score": result["priority_score"],
            "priority": result["priority_level"],
            "priority_factors": result["priority_factors"],
            "priority_calculated_at": now,
            "updatedAt": now,
        }},
    )

    return result
