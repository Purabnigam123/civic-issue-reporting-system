"""
Worker Analytics Service: computes individual and aggregate worker performance
metrics from actual complaint data.

All numbers are derived from MongoDB queries — no fabricated stats.
"""

from datetime import datetime, timedelta, timezone
from typing import Dict, Any, List, Optional
from bson import ObjectId

from ..database.mongodb import get_database
from ..models.complaint import ComplaintStatus
from ..models.user import UserRole


async def get_worker_performance(worker_id: str) -> Dict[str, Any]:
    """
    Compute comprehensive performance metrics for a single worker.

    Includes: assigned/completed/active counts, avg resolution time,
    on-time percentage, SLA violations, category breakdown, completion rate.
    """
    db = get_database()
    w_oid = ObjectId(worker_id) if ObjectId.is_valid(worker_id) else worker_id
    now = datetime.now(timezone.utc)

    # Core counts
    total_assigned = await db.complaints.count_documents({"assignedWorkerId": w_oid})
    active_tasks = await db.complaints.count_documents({
        "assignedWorkerId": w_oid,
        "status": {"$in": [ComplaintStatus.ASSIGNED.value, ComplaintStatus.IN_PROGRESS.value]},
    })
    completed = await db.complaints.count_documents({
        "assignedWorkerId": w_oid,
        "status": {"$in": [ComplaintStatus.RESOLVED.value, ComplaintStatus.VERIFIED.value]},
    })
    in_progress = await db.complaints.count_documents({
        "assignedWorkerId": w_oid,
        "status": ComplaintStatus.IN_PROGRESS.value,
    })

    # Today's stats
    start_of_today = datetime(now.year, now.month, now.day, tzinfo=timezone.utc)
    resolved_today = await db.complaints.count_documents({
        "assignedWorkerId": w_oid,
        "status": {"$in": [ComplaintStatus.RESOLVED.value, ComplaintStatus.VERIFIED.value]},
        "resolvedAt": {"$gte": start_of_today},
    })

    # This week's stats
    start_of_week = (now - timedelta(days=now.weekday())).replace(
        hour=0, minute=0, second=0, microsecond=0
    )
    resolved_this_week = await db.complaints.count_documents({
        "assignedWorkerId": w_oid,
        "status": {"$in": [ComplaintStatus.RESOLVED.value, ComplaintStatus.VERIFIED.value]},
        "resolvedAt": {"$gte": start_of_week},
    })

    # Average resolution time (hours)
    avg_resolution_hours = None
    try:
        pipeline = [
            {"$match": {
                "assignedWorkerId": w_oid,
                "status": {"$in": [ComplaintStatus.RESOLVED.value, ComplaintStatus.VERIFIED.value]},
                "assignedAt": {"$exists": True},
                "resolvedAt": {"$exists": True},
            }},
            {"$project": {
                "resolution_ms": {"$subtract": ["$resolvedAt", "$assignedAt"]}
            }},
            {"$group": {
                "_id": None,
                "avg_ms": {"$avg": "$resolution_ms"},
                "median_values": {"$push": "$resolution_ms"},
            }},
        ]
        results = await db.complaints.aggregate(pipeline).to_list(1)
        if results:
            avg_ms = results[0].get("avg_ms", 0)
            avg_resolution_hours = round(avg_ms / 3600000.0, 1) if avg_ms else None
    except Exception:
        pass

    # SLA compliance
    sla_on_time = await db.complaints.count_documents({
        "assignedWorkerId": w_oid,
        "status": {"$in": [ComplaintStatus.RESOLVED.value, ComplaintStatus.VERIFIED.value]},
        "slaStatus": "RESOLVED_ON_TIME",
    })
    sla_late = await db.complaints.count_documents({
        "assignedWorkerId": w_oid,
        "slaStatus": {"$in": ["BREACHED", "RESOLVED_LATE"]},
    })

    sla_compliance_rate = round(
        (sla_on_time / max(sla_on_time + sla_late, 1)) * 100, 1
    )

    # Overdue tasks
    overdue_count = await db.complaints.count_documents({
        "assignedWorkerId": w_oid,
        "status": {"$in": [ComplaintStatus.ASSIGNED.value, ComplaintStatus.IN_PROGRESS.value]},
        "slaDeadline": {"$lt": now},
    })

    # Category breakdown
    cat_pipeline = [
        {"$match": {"assignedWorkerId": w_oid}},
        {"$group": {"_id": "$category", "count": {"$sum": 1}}},
        {"$sort": {"count": -1}},
    ]
    cat_results = await db.complaints.aggregate(cat_pipeline).to_list(None)
    category_breakdown = [
        {"category": item["_id"] or "other", "count": item["count"]}
        for item in cat_results
    ]

    # Citizen rating average
    rating_pipeline = [
        {"$match": {
            "assignedWorkerId": w_oid,
            "citizen_rating": {"$exists": True, "$gt": 0},
        }},
        {"$group": {
            "_id": None,
            "avg_rating": {"$avg": "$citizen_rating"},
            "total_ratings": {"$sum": 1},
        }},
    ]
    rating_results = await db.complaints.aggregate(rating_pipeline).to_list(1)
    avg_rating = None
    total_ratings = 0
    if rating_results:
        avg_rating = round(rating_results[0].get("avg_rating", 0), 1)
        total_ratings = rating_results[0].get("total_ratings", 0)

    # Completion rate
    completion_rate = round((completed / max(total_assigned, 1)) * 100, 1)

    # 7-day trend
    trend_data = []
    for i in range(6, -1, -1):
        day_start = (now - timedelta(days=i)).replace(hour=0, minute=0, second=0, microsecond=0)
        day_end = day_start + timedelta(days=1)
        day_resolved = await db.complaints.count_documents({
            "assignedWorkerId": w_oid,
            "resolvedAt": {"$gte": day_start, "$lt": day_end},
        })
        day_assigned = await db.complaints.count_documents({
            "assignedWorkerId": w_oid,
            "assignedAt": {"$gte": day_start, "$lt": day_end},
        })
        trend_data.append({
            "date": day_start.strftime("%b %d"),
            "resolved": day_resolved,
            "assigned": day_assigned,
        })

    return {
        "total_assigned": total_assigned,
        "active_tasks": active_tasks,
        "completed": completed,
        "in_progress": in_progress,
        "resolved_today": resolved_today,
        "resolved_this_week": resolved_this_week,
        "completion_rate": completion_rate,
        "avg_resolution_hours": avg_resolution_hours,
        "sla_compliance_rate": sla_compliance_rate,
        "sla_on_time": sla_on_time,
        "sla_late": sla_late,
        "overdue_count": overdue_count,
        "category_breakdown": category_breakdown,
        "avg_citizen_rating": avg_rating,
        "total_citizen_ratings": total_ratings,
        "trend": trend_data,
    }


async def get_district_workers_analytics(district_id: str) -> List[Dict[str, Any]]:
    """Get performance analytics for all workers in a district."""
    db = get_database()

    workers = await db.users.find({
        "role": UserRole.WORKER.value,
        "district_id": district_id,
    }).to_list(None)

    results = []
    for worker in workers:
        w_id = str(worker.get("_id"))
        perf = await get_worker_performance(w_id)
        results.append({
            "worker_id": w_id,
            "name": worker.get("name", "Worker"),
            "worker_tag": worker.get("worker_id", ""),
            "email": worker.get("email", ""),
            "status": worker.get("status", "ACTIVE"),
            "availability_status": worker.get("availability_status", "AVAILABLE"),
            "skills": worker.get("skills", []),
            **perf,
        })

    # Sort by completion rate descending
    results.sort(key=lambda x: x["completion_rate"], reverse=True)
    return results


# Alias for compatibility
get_worker_analytics = get_worker_performance

