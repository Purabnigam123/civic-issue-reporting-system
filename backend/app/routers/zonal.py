"""
Zonal Admin Router: district-scoped complaint management, field worker CRUD,
task assignment, SLA tracking, and zone performance analytics.
"""

from fastapi import APIRouter, Depends, HTTPException, Query, Body, status
from typing import Optional, List, Dict, Any
from datetime import datetime, timezone
from bson import ObjectId

from ..database.mongodb import get_database
from ..models.user import UserRole, format_user_response, hash_password
from ..models.complaint import ComplaintStatus, format_complaint_dict
from ..models.district import DISTRICT_BY_ID
from ..dependencies.auth import require_zonal_admin
from ..services.status_service import transition_complaint_status
from ..services.audit_service import log_audit_event
from ..services.assignment_service import get_assignment_recommendations, auto_assign_worker_to_complaint
from ..services.overdue_service import check_and_escalate_overdue_complaints
from ..services.worker_analytics_service import get_worker_analytics, get_district_workers_analytics

router = APIRouter(prefix="/api/zonal", tags=["Zonal Admin"])


# ── 1. Zone Metrics ────────────────────────────────────────────────
@router.get("/metrics")
async def get_zonal_metrics(current_user: dict = Depends(require_zonal_admin)):
    db = get_database()
    district_id = (current_user.get("district_id") or "central_delhi").lower()
    district_meta = DISTRICT_BY_ID.get(district_id, {})

    # Status counts for this zone (excluding unapproved suspicious complaints)
    pipeline = [
        {"$match": {"district_id": district_id, "isSuspicious": {"$ne": True}}},
        {"$group": {"_id": "$status", "count": {"$sum": 1}}}
    ]
    status_results = await db.complaints.aggregate(pipeline).to_list(None)
    status_counts = {item["_id"]: item["count"] for item in status_results if item.get("_id")}

    total_complaints = sum(status_counts.values())
    pending_assignment = status_counts.get(ComplaintStatus.SUBMITTED.value, 0)
    in_progress = status_counts.get(ComplaintStatus.IN_PROGRESS.value, 0)
    assigned = status_counts.get(ComplaintStatus.ASSIGNED.value, 0)
    pending_verification = status_counts.get(ComplaintStatus.RESOLUTION_SUBMITTED.value, 0)
    resolved = status_counts.get(ComplaintStatus.RESOLVED.value, 0) + status_counts.get(ComplaintStatus.VERIFIED.value, 0)
    escalated = status_counts.get(ComplaintStatus.ESCALATED.value, 0)

    # Worker count in this district
    workers_count = await db.users.count_documents({
        "role": UserRole.WORKER.value,
        "district_id": district_id,
    })

    # Category breakdown for this district (excluding unapproved suspicious complaints)
    cat_pipeline = [
        {"$match": {"district_id": district_id, "isSuspicious": {"$ne": True}}},
        {"$group": {"_id": "$category", "count": {"$sum": 1}}},
        {"$sort": {"count": -1}}
    ]
    cat_results = await db.complaints.aggregate(cat_pipeline).to_list(None)
    category_counts = [{ "category": item["_id"], "count": item["count"] } for item in cat_results if item.get("_id")]

    return {
        "success": True,
        "district_id": district_id,
        "district_name": district_meta.get("name", district_id),
        "metrics": {
            "total_complaints": total_complaints,
            "pending_assignment": pending_assignment,
            "in_progress": in_progress,
            "assigned": assigned,
            "pending_verification": pending_verification,
            "resolved": resolved,
            "escalated": escalated,
            "active_workers": workers_count,
            "status_counts": status_counts,
            "category_counts": category_counts,
        }
    }


# ── 2. Zone Complaints List ─────────────────────────────────────────
@router.get("/complaints")
async def get_zonal_complaints(
    status: Optional[str] = None,
    priority: Optional[str] = None,
    category: Optional[str] = None,
    worker_id: Optional[str] = None,
    search: Optional[str] = None,
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100),
    current_user: dict = Depends(require_zonal_admin),
):
    db = get_database()
    district_id = (current_user.get("district_id") or "central_delhi").lower()

    # Run check for overdue complaints
    try:
        await check_and_escalate_overdue_complaints()
    except Exception:
        pass

    # Suspicious complaints must be approved by Super Admin before showing on district page
    query: Dict[str, Any] = {
        "district_id": district_id,
        "isSuspicious": {"$ne": True},
    }

    if status:
        query["status"] = status
    if priority:
        query["priority"] = priority
    if category:
        query["category"] = category
    if worker_id:
        query["assignedWorkerId"] = ObjectId(worker_id) if ObjectId.is_valid(worker_id) else worker_id
    if search:
        query["$and"] = [
            {"district_id": district_id},
            {"isSuspicious": {"$ne": True}},
            {"$or": [
                {"complaintId": {"$regex": search, "$options": "i"}},
                {"description": {"$regex": search, "$options": "i"}},
                {"address": {"$regex": search, "$options": "i"}},
            ]}
        ]

    skip = (page - 1) * limit
    total = await db.complaints.count_documents(query)
    cursor = db.complaints.find(query).sort("createdAt", -1).skip(skip).limit(limit)
    items = await cursor.to_list(None)

    now = datetime.now(timezone.utc)
    formatted_items = []
    for c in items:
        f = format_complaint_dict(c)
        sla_deadline = c.get("slaDeadline")
        if isinstance(sla_deadline, str):
            try:
                sla_deadline = datetime.fromisoformat(sla_deadline)
            except Exception:
                sla_deadline = None
        if sla_deadline:
            if sla_deadline.tzinfo is None:
                sla_deadline = sla_deadline.replace(tzinfo=timezone.utc)
            remaining_secs = (sla_deadline - now).total_seconds()
            f["slaRemainingHours"] = round(remaining_secs / 3600.0, 1)
            f["isOverdue"] = remaining_secs < 0
        else:
            f["slaRemainingHours"] = None
            f["isOverdue"] = False
        formatted_items.append(f)

    return {
        "success": True,
        "total": total,
        "page": page,
        "pages": (total + limit - 1) // limit,
        "complaints": formatted_items,
    }


# ── 3. Assign Complaint to Worker ───────────────────────────────────
@router.post("/complaints/{complaint_id}/assign")
async def assign_complaint_to_worker(
    complaint_id: str,
    payload: dict = Body(...),
    current_user: dict = Depends(require_zonal_admin),
):
    db = get_database()
    worker_id = payload.get("worker_id")
    comment = payload.get("comment", "Assigned to field worker")

    if not worker_id:
        raise HTTPException(status_code=400, detail="worker_id is required")

    # Fetch worker to verify existence and name
    w_filter = {"_id": ObjectId(worker_id)} if ObjectId.is_valid(worker_id) else {"_id": worker_id}
    worker = await db.users.find_one(w_filter)
    if not worker or worker.get("role") != UserRole.WORKER.value:
        raise HTTPException(status_code=404, detail="Field worker not found")

    worker_name = worker.get("name", "Field Worker")

    updated = await transition_complaint_status(
        complaint_id=complaint_id,
        new_status=ComplaintStatus.ASSIGNED,
        current_user=current_user,
        comment=f"Assigned to {worker_name}: {comment}",
        assigned_worker_id=str(worker.get("_id")),
        assigned_worker_name=worker_name,
    )

    await log_audit_event(
        action="ZONAL_ASSIGN_COMPLAINT",
        actor_id=str(current_user.get("_id") or current_user.get("id")),
        actor_role="ZONAL_ADMIN",
        actor_name=current_user.get("name", "Zonal Officer"),
        target_type="complaint",
        target_id=complaint_id,
        details={"assigned_to_worker": worker_name, "worker_id": str(worker.get("_id"))},
    )

    return {
        "success": True,
        "message": f"Complaint assigned to {worker_name}",
        "complaint": updated,
    }


# ── 4. Zonal Complaint Status Update ────────────────────────────────
@router.post("/complaints/{complaint_id}/status")
async def zonal_update_status(
    complaint_id: str,
    payload: dict = Body(...),
    current_user: dict = Depends(require_zonal_admin),
):
    new_status_str = payload.get("status")
    comment = payload.get("comment", "")
    worker_id = payload.get("worker_id")
    worker_name = payload.get("worker_name")

    if not new_status_str:
        raise HTTPException(status_code=400, detail="Missing status field")

    try:
        new_status = ComplaintStatus(new_status_str)
    except ValueError:
        raise HTTPException(status_code=400, detail=f"Invalid status: {new_status_str}")

    updated = await transition_complaint_status(
        complaint_id=complaint_id,
        new_status=new_status,
        current_user=current_user,
        comment=comment,
        assigned_worker_id=worker_id,
        assigned_worker_name=worker_name,
    )

    return {"success": True, "message": f"Status updated to {new_status_str}", "complaint": updated}


# ── 4b. District Resolution Verification Section ────────────────────
@router.get("/verifications")
async def get_district_verifications(
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100),
    current_user: dict = Depends(require_zonal_admin),
):
    """
    Get all tasks completed by workers in this district awaiting District Officer verification.
    """
    db = get_database()
    district_id = (current_user.get("district_id") or "central_delhi").lower()

    query: Dict[str, Any] = {
        "district_id": district_id,
        "status": ComplaintStatus.RESOLUTION_SUBMITTED.value,
        "isSuspicious": {"$ne": True},
    }

    skip = (page - 1) * limit
    total = await db.complaints.count_documents(query)
    cursor = db.complaints.find(query).sort("resolutionSubmittedAt", -1).skip(skip).limit(limit)
    items = await cursor.to_list(None)

    return {
        "success": True,
        "total": total,
        "page": page,
        "pages": (total + limit - 1) // limit,
        "verifications": [format_complaint_dict(c) for c in items],
    }


@router.post("/complaints/{complaint_id}/verify-resolution")
async def verify_complaint_resolution(
    complaint_id: str,
    payload: dict = Body(...),
    current_user: dict = Depends(require_zonal_admin),
):
    """
    District Officer reviews the worker's resolution proof picture and notes:
    - If approved: transitions status to RESOLVED.
    - If rejected: transitions status back to IN_PROGRESS so the worker re-does the job.
    """
    approved = payload.get("approved", True)
    comment = payload.get("comment", "")

    if approved:
        new_status = ComplaintStatus.RESOLVED
        status_note = f"Work completion verified and approved by District Officer: {comment or 'Proof verified successfully'}"
    else:
        new_status = ComplaintStatus.IN_PROGRESS
        status_note = f"Work completion rejected by District Officer. Rework required: {comment or 'Resolution proof insufficient'}"

    updated = await transition_complaint_status(
        complaint_id=complaint_id,
        new_status=new_status,
        current_user=current_user,
        comment=status_note,
    )

    await log_audit_event(
        action="DISTRICT_VERIFY_RESOLUTION" if approved else "DISTRICT_REJECT_RESOLUTION",
        actor_id=str(current_user.get("_id") or current_user.get("id")),
        actor_role="ZONAL_ADMIN",
        actor_name=current_user.get("name", "District Officer"),
        target_type="complaint",
        target_id=complaint_id,
        details={"approved": approved, "comment": comment},
    )

    return {
        "success": True,
        "message": f"Resolution {'approved and marked RESOLVED' if approved else 'rejected — worker notified to rework'}",
        "complaint": updated,
    }


# ── 4c. Set / Adjust Target Resolution Date ─────────────────────────
@router.patch("/complaints/{complaint_id}/target-date")
async def update_complaint_target_date(
    complaint_id: str,
    payload: dict = Body(...),
    current_user: dict = Depends(require_zonal_admin),
):
    """
    District Admin adjusts or sets the resolution target date (slaDeadline).
    Accepts ISO string 'target_date' or int 'additional_hours'.
    """
    db = get_database()
    target_date_str = payload.get("target_date")
    additional_hours = payload.get("additional_hours")
    reason = payload.get("reason", "Target resolution date updated by District Admin")
    now = datetime.now(timezone.utc)

    new_deadline = None
    if target_date_str:
        try:
            new_deadline = datetime.fromisoformat(target_date_str.replace("Z", "+00:00"))
        except Exception:
            raise HTTPException(status_code=400, detail="Invalid target_date format. Use ISO format.")
    elif additional_hours:
        new_deadline = now + timedelta(hours=int(additional_hours))
    else:
        raise HTTPException(status_code=400, detail="Either target_date or additional_hours is required")

    if new_deadline.tzinfo is None:
        new_deadline = new_deadline.replace(tzinfo=timezone.utc)

    c_filter = {"_id": ObjectId(complaint_id)} if ObjectId.is_valid(complaint_id) else {"complaintId": complaint_id}
    complaint = await db.complaints.find_one(c_filter)
    if not complaint:
        raise HTTPException(status_code=404, detail="Complaint not found")

    timeline_entry = {
        "status": complaint.get("status", "IN_PROGRESS"),
        "timestamp": now,
        "note": f"Resolution target date set to {new_deadline.strftime('%Y-%m-%d %H:%M UTC')}. Reason: {reason}",
    }

    result = await db.complaints.find_one_and_update(
        {"_id": complaint["_id"]},
        {
            "$set": {
                "slaDeadline": new_deadline,
                "targetResolutionDate": new_deadline,
                "slaStatus": "ON_TRACK" if new_deadline > now else "BREACHED",
                "isEscalated": False if new_deadline > now else complaint.get("isEscalated", False),
                "updatedAt": now,
            },
            "$push": {
                "timeline": timeline_entry,
            }
        },
        return_document=True,
    )

    return {
        "success": True,
        "message": f"Target resolution date set to {new_deadline.strftime('%b %d, %Y %I:%M %p')}",
        "complaint": format_complaint_dict(result),
    }


# ── 4d. AI Auto-Assignment Endpoints ────────────────────────────────
@router.post("/complaints/{complaint_id}/auto-assign")
async def trigger_ai_auto_assignment(
    complaint_id: str,
    current_user: dict = Depends(require_zonal_admin),
):
    """Auto-assign a specific complaint using the AI Worker Assignment Engine."""
    result = await auto_assign_worker_to_complaint(complaint_id)
    if not result:
        raise HTTPException(
            status_code=400,
            detail="Could not auto-assign: No eligible workers available or complaint is not in unassigned state.",
        )
    return {
        "success": True,
        "message": f"AI successfully auto-assigned to {result['worker_name']} (Score: {result.get('score', 'N/A')})",
        "worker_name": result["worker_name"],
        "complaint": result["complaint"],
    }


@router.post("/complaints/auto-assign-all")
async def trigger_ai_auto_assign_all(
    current_user: dict = Depends(require_zonal_admin),
):
    """Auto-assign ALL unassigned (SUBMITTED) complaints in this district using AI."""
    db = get_database()
    district_id = (current_user.get("district_id") or "central_delhi").lower()

    unassigned_cursor = db.complaints.find({
        "district_id": district_id,
        "status": ComplaintStatus.SUBMITTED.value,
        "isSuspicious": {"$ne": True},
    })
    unassigned = await unassigned_cursor.to_list(None)

    assigned_count = 0
    assigned_details = []

    for c in unassigned:
        cid = str(c["_id"])
        res = await auto_assign_worker_to_complaint(cid)
        if res:
            assigned_count += 1
            assigned_details.append({
                "complaintId": c.get("complaintId"),
                "worker_name": res["worker_name"],
            })

    return {
        "success": True,
        "total_unassigned": len(unassigned),
        "assigned_count": assigned_count,
        "assigned": assigned_details,
        "message": f"AI Auto-assigned {assigned_count} of {len(unassigned)} pending issues to available field workers.",
    }


# ── 5. Field Worker Management for this Zone ────────────────────────
@router.get("/workers")
async def list_zonal_workers(
    current_user: dict = Depends(require_zonal_admin),
):
    db = get_database()
    district_id = (current_user.get("district_id") or "central_delhi").lower()

    workers = await db.users.find({
        "role": UserRole.WORKER.value,
        "district_id": district_id,
    }).sort("created_at", -1).to_list(None)

    # Attach active task counts to each worker
    formatted = []
    for w in workers:
        w_id = w.get("_id")
        active_tasks = await db.complaints.count_documents({
            "assignedWorkerId": w_id,
            "status": {"$in": [ComplaintStatus.ASSIGNED.value, ComplaintStatus.IN_PROGRESS.value]},
        })
        completed_tasks = await db.complaints.count_documents({
            "assignedWorkerId": w_id,
            "status": {"$in": [ComplaintStatus.RESOLVED.value, ComplaintStatus.VERIFIED.value]},
        })

        fw = format_user_response(w)
        fw["active_tasks"] = active_tasks
        fw["completed_tasks"] = completed_tasks
        formatted.append(fw)

    return {"success": True, "workers": formatted}


@router.post("/workers")
async def create_zonal_worker(
    payload: dict = Body(...),
    current_user: dict = Depends(require_zonal_admin),
):
    db = get_database()
    district_id = (current_user.get("district_id") or "central_delhi").lower()

    name = payload.get("name")
    email = payload.get("email")
    phone = payload.get("phone")
    password = payload.get("password", "Worker@123")
    skills = payload.get("skills", ["General Maintenance"])

    if not name or not email or not phone:
        raise HTTPException(status_code=400, detail="Name, email, and phone are required")

    # Check if email exists
    existing = await db.users.find_one({"email": email.lower()})
    if existing:
        raise HTTPException(status_code=400, detail="User with this email already exists")

    # Generate custom worker ID like WKR-DL-001
    count = await db.users.count_documents({"role": UserRole.WORKER.value}) + 1
    worker_tag = f"WKR-{district_id[:3].upper()}-{count:03d}"

    now = datetime.now(timezone.utc)
    new_worker = {
        "name": name,
        "email": email.lower(),
        "phone": phone,
        "password": hash_password(password),
        "role": UserRole.WORKER.value,
        "district_id": district_id,
        "worker_id": worker_tag,
        "skills": skills,
        "status": "ACTIVE",
        "created_at": now,
        "updated_at": now,
    }

    result = await db.users.insert_one(new_worker)
    new_worker["_id"] = result.inserted_id

    await log_audit_event(
        action="CREATE_WORKER",
        actor_id=str(current_user.get("_id") or current_user.get("id")),
        actor_role="ZONAL_ADMIN",
        actor_name=current_user.get("name", "Zonal Officer"),
        target_type="worker",
        target_id=str(result.inserted_id),
        details={"worker_id": worker_tag, "district_id": district_id, "name": name},
    )

    return {
        "success": True, 
        "message": "Worker account created successfully", 
        "worker": format_user_response(new_worker),
        "temporary_password": password
    }


# ── 6. Worker Status Toggle & Soft Delete ─────────────────────────
@router.patch("/workers/{worker_id}/status")
async def update_worker_status(
    worker_id: str,
    payload: dict = Body(...),
    current_user: dict = Depends(require_zonal_admin),
):
    db = get_database()
    new_status = payload.get("status", "ACTIVE").upper()
    if new_status not in ["ACTIVE", "INACTIVE"]:
        raise HTTPException(status_code=400, detail="Status must be ACTIVE or INACTIVE")

    w_filter = {"_id": ObjectId(worker_id)} if ObjectId.is_valid(worker_id) else {"worker_id": worker_id}
    result = await db.users.update_one(
        w_filter,
        {"$set": {"status": new_status, "updated_at": datetime.now(timezone.utc)}}
    )
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Worker not found")

    return {"success": True, "message": f"Worker status updated to {new_status}"}


@router.delete("/workers/{worker_id}")
async def delete_worker(
    worker_id: str,
    current_user: dict = Depends(require_zonal_admin),
):
    db = get_database()
    w_filter = {"_id": ObjectId(worker_id)} if ObjectId.is_valid(worker_id) else {"worker_id": worker_id}
    result = await db.users.update_one(
        w_filter,
        {"$set": {"status": "INACTIVE", "updated_at": datetime.now(timezone.utc)}}
    )
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Worker not found")

    return {"success": True, "message": "Worker deactivated successfully"}


# ── 7. Zonal Analytics ─────────────────────────────────────────────
@router.get("/analytics")
async def get_zonal_analytics(
    current_user: dict = Depends(require_zonal_admin),
):
    db = get_database()
    district_id = (current_user.get("district_id") or "central_delhi").lower()
    from datetime import timedelta
    now = datetime.now(timezone.utc)

    # 7-day trend
    trend_data = []
    for i in range(6, -1, -1):
        day_start = (now - timedelta(days=i)).replace(hour=0, minute=0, second=0, microsecond=0)
        day_end = day_start + timedelta(days=1)
        count = await db.complaints.count_documents({
            "district_id": district_id,
            "isSuspicious": {"$ne": True},
            "createdAt": {"$gte": day_start, "$lt": day_end}
        })
        resolved_count = await db.complaints.count_documents({
            "district_id": district_id,
            "isSuspicious": {"$ne": True},
            "resolvedAt": {"$gte": day_start, "$lt": day_end}
        })
        trend_data.append({
            "date": day_start.strftime("%b %d"),
            "complaints": count,
            "resolved": resolved_count,
        })

    # Category distribution
    cat_pipeline = [
        {"$match": {"district_id": district_id, "isSuspicious": {"$ne": True}}},
        {"$group": {"_id": "$category", "count": {"$sum": 1}}},
        {"$sort": {"count": -1}}
    ]
    cat_res = await db.complaints.aggregate(cat_pipeline).to_list(None)
    categories = [{"name": item["_id"] or "other", "count": item["count"]} for item in cat_res]

    # Worker performance
    workers = await db.users.find({
        "role": UserRole.WORKER.value,
        "district_id": district_id,
    }).to_list(None)

    worker_perf = []
    for w in workers:
        w_id = w.get("_id")
        assigned = await db.complaints.count_documents({
            "assignedWorkerId": w_id,
        })
        completed = await db.complaints.count_documents({
            "assignedWorkerId": w_id,
            "status": {"$in": [ComplaintStatus.RESOLVED.value, ComplaintStatus.VERIFIED.value]},
        })
        active = await db.complaints.count_documents({
            "assignedWorkerId": w_id,
            "status": {"$in": [ComplaintStatus.ASSIGNED.value, ComplaintStatus.IN_PROGRESS.value]},
        })
        worker_perf.append({
            "id": str(w_id),
            "name": w.get("name", "Worker"),
            "email": w.get("email"),
            "worker_id": w.get("worker_id", f"WKR-{str(w_id)[:6]}"),
            "status": w.get("status", "ACTIVE"),
            "assigned": assigned,
            "completed": completed,
            "active": active,
            "rate": round((completed / assigned * 100) if assigned > 0 else 100, 1),
        })

    # Sort worker performance by completed desc
    worker_perf.sort(key=lambda x: x["completed"], reverse=True)

    return {
        "success": True,
        "analytics": {
            "trend": trend_data,
            "categories": categories,
            "workers": worker_perf,
        }
    }


# ── 8. AI Assignment Recommendations (Feature 10) ─────────────────
@router.get("/ai-assignment/{complaint_id}")
async def get_ai_assignment_recommendations(
    complaint_id: str,
    current_user: dict = Depends(require_zonal_admin),
):
    db = get_database()
    c_filter = {"_id": ObjectId(complaint_id)} if ObjectId.is_valid(complaint_id) else {"complaintId": complaint_id}
    complaint = await db.complaints.find_one(c_filter)
    if not complaint:
        raise HTTPException(status_code=404, detail="Complaint not found")
        
    # Only allow zonal admin to get recommendations for their own district
    district_id = (current_user.get("district_id") or "central_delhi").lower()
    if complaint.get("district_id") != district_id:
        raise HTTPException(status_code=403, detail="Not authorized to manage complaints for this district")
        
    recommendations = await get_assignment_recommendations(
        complaint_id=str(complaint["_id"]),
        district_id=district_id
    )
    
    return {"success": True, "data": recommendations}


# ── 9. Worker Analytics (Feature 13) ───────────────────────────────
@router.get("/workers/analytics")
async def get_zonal_workers_analytics(
    current_user: dict = Depends(require_zonal_admin),
):
    district_id = (current_user.get("district_id") or "central_delhi").lower()
    analytics = await get_district_workers_analytics(district_id)
    return {"success": True, "data": analytics}


@router.get("/workers/{worker_id}/analytics")
async def get_single_worker_analytics(
    worker_id: str,
    current_user: dict = Depends(require_zonal_admin),
):
    db = get_database()
    w_filter = {"_id": ObjectId(worker_id)} if ObjectId.is_valid(worker_id) else {"_id": worker_id}
    worker = await db.users.find_one(w_filter)
    if not worker:
        raise HTTPException(status_code=404, detail="Worker not found")
        
    district_id = (current_user.get("district_id") or "central_delhi").lower()
    if worker.get("district_id") != district_id:
        raise HTTPException(status_code=403, detail="Not authorized to view analytics for this worker")
        
    analytics = await get_worker_analytics(str(worker["_id"]))
    return {"success": True, "data": analytics}
