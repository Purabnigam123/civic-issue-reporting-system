"""
AI Worker Assignment Engine: recommends the optimal field worker for a complaint
based on district match, workload, availability, skill/category match, and
historical performance.

Worker Load Balancing: prevents overloaded workers from being assigned new tasks.
"""

from datetime import datetime, timezone
from typing import Dict, Any, List, Optional
from bson import ObjectId

from ..database.mongodb import get_database
from ..models.user import UserRole
from ..models.complaint import ComplaintStatus, ComplaintCategory


# ── Weight configuration ──────────────────────────────────────────────
DISTRICT_WEIGHT = 0.30       # Workers in the same district score higher
WORKLOAD_WEIGHT = 0.25       # Workers with fewer active tasks score higher
AVAILABILITY_WEIGHT = 0.20   # Available workers score higher
SKILL_WEIGHT = 0.15          # Workers with matching skills score higher
PERFORMANCE_WEIGHT = 0.10    # Workers with better resolution rates score higher

# Category → skill mapping
CATEGORY_TO_SKILLS: Dict[str, List[str]] = {
    ComplaintCategory.POTHOLE.value: ["Road Repair", "General Maintenance"],
    ComplaintCategory.BROKEN_STREETLIGHT.value: ["Electrical", "Streetlight Repair"],
    ComplaintCategory.GARBAGE.value: ["Sanitation", "Waste Management"],
    ComplaintCategory.DRAINAGE.value: ["Plumbing", "Drainage Repair"],
    ComplaintCategory.WATER_ISSUE.value: ["Plumbing", "Water Supply"],
    ComplaintCategory.PUBLIC_PROPERTY.value: ["General Maintenance", "Civil Works"],
    ComplaintCategory.ROAD_DAMAGE.value: ["Road Repair", "Civil Works"],
    ComplaintCategory.OTHER.value: ["General Maintenance"],
}


async def get_worker_assignment_recommendation(
    complaint_id: str,
    district_id: Optional[str] = None,
    category: Optional[str] = None,
) -> Dict[str, Any]:
    """
    Recommend the best worker for a complaint.

    Returns:
      - recommended_worker: the best candidate (or None)
      - candidates: list of scored worker candidates
      - factors: breakdown of scoring per worker
    """
    db = get_database()

    # Load the complaint if fields aren't provided
    if not district_id or not category:
        try:
            complaint = await db.complaints.find_one({"_id": ObjectId(complaint_id)})
            if complaint:
                district_id = district_id or complaint.get("district_id", "")
                category = category or complaint.get("category", "other")
        except Exception:
            pass

    if not district_id:
        return {"recommended_worker": None, "candidates": [], "message": "No district identified"}

    # Get workers in this district
    worker_query = {
        "role": UserRole.WORKER.value,
        "district_id": district_id,
        "status": {"$ne": "BANNED"},
    }
    workers = await db.users.find(worker_query).to_list(None)

    if not workers:
        return {
            "recommended_worker": None,
            "candidates": [],
            "message": f"No workers available in district {district_id}",
        }

    # Get required skills for this category
    required_skills = CATEGORY_TO_SKILLS.get(category or "other", ["General Maintenance"])

    candidates: List[Dict[str, Any]] = []

    for worker in workers:
        w_id = worker.get("_id")
        w_oid = ObjectId(w_id) if isinstance(w_id, str) and ObjectId.is_valid(w_id) else w_id

        # 1. District match score
        w_district = (worker.get("district_id") or "").lower()
        district_score = 1.0 if w_district == (district_id or "").lower() else 0.0

        # 2. Workload score (fewer active tasks = higher score)
        active_count = await db.complaints.count_documents({
            "assignedWorkerId": w_oid,
            "status": {"$in": [ComplaintStatus.ASSIGNED.value, ComplaintStatus.IN_PROGRESS.value]},
        })
        max_active = int(worker.get("max_active_complaints", 5))
        if active_count >= max_active:
            workload_score = 0.0  # Overloaded — blocked
        else:
            workload_score = max(0.0, 1.0 - (active_count / max_active))

        # 3. Availability score
        availability = worker.get("availability_status", "AVAILABLE")
        if availability == "AVAILABLE":
            availability_score = 1.0
        elif availability == "BUSY":
            availability_score = 0.3
        else:  # OFF_DUTY, ON_LEAVE, etc.
            availability_score = 0.0

        # 4. Skill match score
        worker_skills = set(s.lower() for s in (worker.get("skills") or []))
        matched_skills = sum(1 for s in required_skills if s.lower() in worker_skills)
        skill_score = matched_skills / max(len(required_skills), 1)

        # 5. Performance score (historical completion rate)
        total_assigned = await db.complaints.count_documents({"assignedWorkerId": w_oid})
        total_completed = await db.complaints.count_documents({
            "assignedWorkerId": w_oid,
            "status": {"$in": [ComplaintStatus.RESOLVED.value, ComplaintStatus.VERIFIED.value]},
        })
        if total_assigned > 0:
            performance_score = total_completed / total_assigned
        else:
            performance_score = 0.5  # New worker gets neutral score

        # Composite score
        composite = (
            district_score * DISTRICT_WEIGHT
            + workload_score * WORKLOAD_WEIGHT
            + availability_score * AVAILABILITY_WEIGHT
            + skill_score * SKILL_WEIGHT
            + performance_score * PERFORMANCE_WEIGHT
        )

        candidates.append({
            "worker_id": str(w_id),
            "name": worker.get("name", "Worker"),
            "worker_tag": worker.get("worker_id", ""),
            "email": worker.get("email", ""),
            "district_id": worker.get("district_id"),
            "availability_status": availability,
            "active_tasks": active_count,
            "max_active": max_active,
            "skills": worker.get("skills", []),
            "assignment_score": round(composite, 3),
            "factors": {
                "district_match": round(district_score, 3),
                "workload": round(workload_score, 3),
                "availability": round(availability_score, 3),
                "skill_match": round(skill_score, 3),
                "performance": round(performance_score, 3),
            },
            "is_overloaded": active_count >= max_active,
        })

    # Sort by score descending
    candidates.sort(key=lambda x: x["assignment_score"], reverse=True)

    # Filter out completely unavailable/overloaded workers for recommendation
    eligible = [c for c in candidates if not c["is_overloaded"] and c["factors"]["availability"] > 0]
    recommended = eligible[0] if eligible else None

    return {
        "recommended_worker": recommended,
        "candidates": candidates[:10],
        "eligible_count": len(eligible),
        "total_workers": len(candidates),
        "message": (
            f"Recommended: {recommended['name']} (score: {recommended['assignment_score']})"
            if recommended
            else "No eligible workers found — all workers are overloaded or unavailable"
        ),
    }


# Alias for compatibility
get_assignment_recommendations = get_worker_assignment_recommendation


async def auto_assign_worker_to_complaint(complaint_id: str) -> Optional[Dict[str, Any]]:
    """
    Automatically assigns the best worker to a complaint using the AI recommendation engine.
    Transitions status to ASSIGNED, updates assignedWorkerId, assignedWorkerName, and records history.
    """
    db = get_database()
    c_filter = {"_id": ObjectId(complaint_id)} if ObjectId.is_valid(complaint_id) else {"complaintId": complaint_id}
    complaint = await db.complaints.find_one(c_filter)
    if not complaint:
        return None

    # Only assign if not already actively being worked on or resolved
    current_status = complaint.get("status")
    if current_status not in [
        ComplaintStatus.SUBMITTED.value,
        ComplaintStatus.UNDER_REVIEW.value,
        ComplaintStatus.ESCALATED.value,
    ]:
        return None

    district_id = complaint.get("district_id", "")
    category = complaint.get("category", "other")

    recommendations = await get_worker_assignment_recommendation(
        complaint_id=str(complaint["_id"]),
        district_id=district_id,
        category=category,
    )

    recommended = recommendations.get("recommended_worker")
    if not recommended:
        return None

    worker_id = recommended["worker_id"]
    worker_name = recommended["name"]

    from .status_service import transition_complaint_status
    system_user = {
        "_id": "AI_AUTO_ASSIGNER",
        "id": "AI_AUTO_ASSIGNER",
        "name": "AI Auto-Assignment Engine",
        "role": UserRole.SUPER_ADMIN.value,
        "district_id": district_id,
    }

    try:
        updated = await transition_complaint_status(
            complaint_id=str(complaint["_id"]),
            new_status=ComplaintStatus.ASSIGNED,
            current_user=system_user,
            comment=f"Auto-assigned to {worker_name} by AI Engine (Score: {recommended.get('assignment_score', 'N/A')})",
            assigned_worker_id=worker_id,
            assigned_worker_name=worker_name,
        )
        return {
            "success": True,
            "worker_id": worker_id,
            "worker_name": worker_name,
            "score": recommended.get("assignment_score"),
            "complaint": updated,
        }
    except Exception as e:
        print(f"AI auto-assignment error: {e}")
        return None

