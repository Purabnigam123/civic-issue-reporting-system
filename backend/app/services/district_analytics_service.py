"""
District Analytics Service: aggregate complaint performance data per district.
Resolution time, SLA compliance, citizen satisfaction, and worker availability.
"""

from datetime import datetime, timedelta, timezone
from typing import Dict, Any, List
from bson import ObjectId

from ..database.mongodb import get_database
from ..models.complaint import ComplaintStatus
from ..models.user import UserRole
from ..models.district import DELHI_DISTRICTS


async def get_district_performance(district_id: str) -> Dict[str, Any]:
    """Compute performance metrics for a single district."""
    db = get_database()
    now = datetime.now(timezone.utc)

    base_filter = {"district_id": district_id}

    total = await db.complaints.count_documents(base_filter)
    resolved = await db.complaints.count_documents({
        **base_filter,
        "status": {"$in": [ComplaintStatus.RESOLVED.value, ComplaintStatus.VERIFIED.value]},
    })
    pending = await db.complaints.count_documents({
        **base_filter,
        "status": {"$in": [ComplaintStatus.SUBMITTED.value, ComplaintStatus.UNDER_REVIEW.value]},
    })
    in_progress = await db.complaints.count_documents({
        **base_filter,
        "status": {"$in": [ComplaintStatus.ASSIGNED.value, ComplaintStatus.IN_PROGRESS.value]},
    })
    escalated = await db.complaints.count_documents({
        **base_filter, "status": ComplaintStatus.ESCALATED.value,
    })

    # Resolution rate
    resolution_rate = round((resolved / max(total, 1)) * 100, 1)

    # SLA compliance
    sla_on_time = await db.complaints.count_documents({
        **base_filter, "slaStatus": "RESOLVED_ON_TIME",
    })
    sla_breached = await db.complaints.count_documents({
        **base_filter, "slaStatus": {"$in": ["BREACHED", "RESOLVED_LATE"]},
    })
    sla_compliance = round((sla_on_time / max(sla_on_time + sla_breached, 1)) * 100, 1)

    # Average resolution time
    avg_resolution_hours = None
    try:
        pipeline = [
            {"$match": {
                **base_filter,
                "status": {"$in": [ComplaintStatus.RESOLVED.value, ComplaintStatus.VERIFIED.value]},
                "createdAt": {"$exists": True},
                "resolvedAt": {"$exists": True},
            }},
            {"$project": {
                "resolution_ms": {"$subtract": ["$resolvedAt", "$createdAt"]}
            }},
            {"$group": {"_id": None, "avg_ms": {"$avg": "$resolution_ms"}}},
        ]
        results = await db.complaints.aggregate(pipeline).to_list(1)
        if results and results[0].get("avg_ms"):
            avg_resolution_hours = round(results[0]["avg_ms"] / 3600000.0, 1)
    except Exception:
        pass

    # Worker availability
    total_workers = await db.users.count_documents({
        "role": UserRole.WORKER.value, "district_id": district_id,
    })
    available_workers = await db.users.count_documents({
        "role": UserRole.WORKER.value, "district_id": district_id,
        "status": {"$ne": "BANNED"},
        "availability_status": {"$in": ["AVAILABLE", None]},
    })

    # Citizen satisfaction (average rating)
    rating_pipeline = [
        {"$match": {**base_filter, "citizen_rating": {"$exists": True, "$gt": 0}}},
        {"$group": {"_id": None, "avg": {"$avg": "$citizen_rating"}, "count": {"$sum": 1}}},
    ]
    rating_results = await db.complaints.aggregate(rating_pipeline).to_list(1)
    avg_rating = round(rating_results[0]["avg"], 1) if rating_results else None
    total_ratings = rating_results[0]["count"] if rating_results else 0

    # Top categories
    cat_pipeline = [
        {"$match": base_filter},
        {"$group": {"_id": "$category", "count": {"$sum": 1}}},
        {"$sort": {"count": -1}},
        {"$limit": 5},
    ]
    cat_results = await db.complaints.aggregate(cat_pipeline).to_list(None)
    top_categories = [{"category": c["_id"], "count": c["count"]} for c in cat_results if c.get("_id")]

    return {
        "district_id": district_id,
        "total_complaints": total,
        "resolved": resolved,
        "pending": pending,
        "in_progress": in_progress,
        "escalated": escalated,
        "resolution_rate": resolution_rate,
        "sla_compliance": sla_compliance,
        "sla_on_time": sla_on_time,
        "sla_breached": sla_breached,
        "avg_resolution_hours": avg_resolution_hours,
        "total_workers": total_workers,
        "available_workers": available_workers,
        "avg_citizen_rating": avg_rating,
        "total_citizen_ratings": total_ratings,
        "top_categories": top_categories,
    }


async def get_all_districts_performance() -> List[Dict[str, Any]]:
    """Get performance comparison across all Delhi districts."""
    results = []
    for district in DELHI_DISTRICTS:
        perf = await get_district_performance(district["id"])
        perf["district_name"] = district["name"]
        results.append(perf)

    # Sort by resolution rate descending
    results.sort(key=lambda x: x["resolution_rate"], reverse=True)
    return results
