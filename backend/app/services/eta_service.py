"""
AI Resolution ETA Engine: computes dynamic resolution time estimates based on
category, priority, worker availability, historical resolution times, and
district workload.

Worker shortage detection increases ETA and lowers confidence when workers
are unavailable.
"""

from datetime import datetime, timedelta, timezone
from typing import Dict, Any, Optional
from bson import ObjectId

from ..database.mongodb import get_database
from ..models.complaint import ComplaintStatus, ComplaintPriority, ComplaintCategory
from ..models.user import UserRole


# Base ETA hours by category (fallback when no historical data)
BASE_ETA_HOURS: Dict[str, int] = {
    ComplaintCategory.WATER_ISSUE.value: 6,
    ComplaintCategory.DRAINAGE.value: 12,
    ComplaintCategory.BROKEN_STREETLIGHT.value: 24,
    ComplaintCategory.GARBAGE.value: 24,
    ComplaintCategory.POTHOLE.value: 48,
    ComplaintCategory.ROAD_DAMAGE.value: 72,
    ComplaintCategory.PUBLIC_PROPERTY.value: 72,
    ComplaintCategory.OTHER.value: 96,
}

# Priority adjustment multiplier
PRIORITY_MULTIPLIER: Dict[str, float] = {
    ComplaintPriority.CRITICAL.value: 0.5,
    ComplaintPriority.HIGH.value: 0.75,
    ComplaintPriority.MEDIUM.value: 1.0,
    ComplaintPriority.LOW.value: 1.25,
}


async def calculate_eta(
    category: str,
    priority: str = "MEDIUM",
    district_id: Optional[str] = None,
    assigned_worker_id: Optional[str] = None,
    created_at: Optional[datetime] = None,
) -> Dict[str, Any]:
    """
    Calculate estimated resolution time for a complaint.

    Returns:
      - estimated_duration_hours: float
      - estimated_resolution_at: ISO datetime string
      - eta_confidence: float (0.0–1.0) — lower when insufficient data
      - eta_factors: breakdown of contributing factors
      - worker_shortage: bool — if no workers are available
    """
    db = get_database()
    now = datetime.now(timezone.utc)
    if created_at is None:
        created_at = now

    factors: Dict[str, Any] = {}

    # 1. Base ETA from category
    base_hours = BASE_ETA_HOURS.get(category, 48)
    factors["base_category_hours"] = base_hours

    # 2. Priority adjustment
    priority_mult = PRIORITY_MULTIPLIER.get(priority, 1.0)
    adjusted_hours = base_hours * priority_mult
    factors["priority_multiplier"] = priority_mult

    # 3. Historical average for this category (from resolved complaints)
    historical_avg = None
    confidence = 0.5  # Default medium confidence
    try:
        pipeline = [
            {"$match": {
                "category": category,
                "status": {"$in": [ComplaintStatus.RESOLVED.value, ComplaintStatus.VERIFIED.value]},
                "createdAt": {"$exists": True},
                "resolvedAt": {"$exists": True},
            }},
            {"$project": {
                "resolution_hours": {
                    "$divide": [
                        {"$subtract": ["$resolvedAt", "$createdAt"]},
                        3600000,  # milliseconds to hours
                    ]
                }
            }},
            {"$group": {
                "_id": None,
                "avg_hours": {"$avg": "$resolution_hours"},
                "count": {"$sum": 1},
            }},
        ]
        results = await db.complaints.aggregate(pipeline).to_list(1)
        if results and results[0].get("count", 0) >= 3:
            historical_avg = results[0]["avg_hours"]
            sample_size = results[0]["count"]
            # Higher confidence with more data points
            confidence = min(0.5 + (sample_size / 50.0) * 0.5, 0.95)
            # Blend historical with base estimate (weight historical more with more data)
            blend_weight = min(sample_size / 20.0, 0.8)
            adjusted_hours = (historical_avg * blend_weight) + (adjusted_hours * (1 - blend_weight))
            factors["historical_avg_hours"] = round(historical_avg, 1)
            factors["historical_sample_size"] = sample_size
            factors["historical_blend_weight"] = round(blend_weight, 2)
    except Exception:
        pass

    # 4. District backlog factor
    worker_shortage = False
    if district_id:
        try:
            open_count = await db.complaints.count_documents({
                "district_id": district_id,
                "status": {"$in": [
                    ComplaintStatus.SUBMITTED.value,
                    ComplaintStatus.ASSIGNED.value,
                    ComplaintStatus.IN_PROGRESS.value,
                ]},
            })
            available_workers = await db.users.count_documents({
                "role": UserRole.WORKER.value,
                "district_id": district_id,
                "status": {"$ne": "BANNED"},
                "availability_status": {"$in": ["AVAILABLE", None]},
            })

            factors["district_backlog"] = open_count
            factors["available_workers"] = available_workers

            if available_workers == 0:
                worker_shortage = True
                adjusted_hours *= 2.0  # Double ETA
                confidence *= 0.3      # Low confidence
                factors["worker_shortage_penalty"] = 2.0
            elif available_workers > 0:
                backlog_per_worker = open_count / available_workers
                if backlog_per_worker > 5:
                    backlog_penalty = min(backlog_per_worker / 10.0, 2.0)
                    adjusted_hours *= (1 + backlog_penalty * 0.3)
                    confidence *= max(0.5, 1.0 - backlog_penalty * 0.1)
                    factors["backlog_per_worker"] = round(backlog_per_worker, 1)
                    factors["backlog_penalty"] = round(backlog_penalty, 2)
        except Exception:
            pass

    # 5. Worker-specific adjustment
    if assigned_worker_id:
        try:
            w_oid = ObjectId(assigned_worker_id) if ObjectId.is_valid(assigned_worker_id) else assigned_worker_id
            worker_active = await db.complaints.count_documents({
                "assignedWorkerId": w_oid,
                "status": {"$in": [ComplaintStatus.ASSIGNED.value, ComplaintStatus.IN_PROGRESS.value]},
            })
            # Each additional task adds delay
            if worker_active > 3:
                worker_penalty = (worker_active - 3) * 0.15
                adjusted_hours *= (1 + worker_penalty)
                factors["worker_active_tasks"] = worker_active
                factors["worker_workload_penalty"] = round(worker_penalty, 2)
        except Exception:
            pass

    # Final ETA
    adjusted_hours = max(adjusted_hours, 1.0)  # Minimum 1 hour
    estimated_resolution = created_at + timedelta(hours=adjusted_hours)

    return {
        "estimated_duration_hours": round(adjusted_hours, 1),
        "estimated_resolution_at": estimated_resolution.isoformat(),
        "eta_confidence": round(min(max(confidence, 0.1), 0.95), 2),
        "eta_factors": factors,
        "worker_shortage": worker_shortage,
        "eta_updated_at": now.isoformat(),
    }


async def update_complaint_eta(complaint_id: str) -> Optional[Dict[str, Any]]:
    """Recalculate and persist ETA for an existing complaint."""
    db = get_database()
    try:
        complaint = await db.complaints.find_one({"_id": ObjectId(complaint_id)})
    except Exception:
        return None

    if not complaint:
        return None

    assigned_worker = complaint.get("assignedWorkerId")
    eta = await calculate_eta(
        category=complaint.get("category", "other"),
        priority=complaint.get("priority", "MEDIUM"),
        district_id=complaint.get("district_id"),
        assigned_worker_id=str(assigned_worker) if assigned_worker else None,
        created_at=complaint.get("createdAt"),
    )

    now = datetime.now(timezone.utc)
    estimated_at = now + timedelta(hours=eta["estimated_duration_hours"])

    await db.complaints.update_one(
        {"_id": ObjectId(complaint_id)},
        {"$set": {
            "estimated_duration_hours": eta["estimated_duration_hours"],
            "estimated_resolution_at": estimated_at,
            "eta_confidence": eta["eta_confidence"],
            "eta_factors": eta["eta_factors"],
            "worker_shortage": eta["worker_shortage"],
            "eta_updated_at": now,
            "updatedAt": now,
        }},
    )

    return eta
