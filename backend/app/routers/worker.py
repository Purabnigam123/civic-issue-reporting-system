"""
Worker Router: field worker mobile task queue, start work, resolve task with proof, and stats.
"""

from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form, Body, status
from typing import Optional, List, Dict, Any
from datetime import datetime, timezone
from bson import ObjectId

from ..database.mongodb import get_database
from ..models.user import format_user_response
from ..models.complaint import ComplaintStatus, format_complaint_dict
from ..dependencies.auth import require_worker
from ..middleware.upload import save_upload_file
from ..services.status_service import transition_complaint_status
from ..services.audit_service import log_audit_event
from ..services.worker_analytics_service import get_worker_analytics

router = APIRouter(prefix="/api/worker", tags=["Worker"])


# ── 1. Worker Stats ────────────────────────────────────────────────
@router.get("/stats")
async def get_worker_stats(
    current_user: dict = Depends(require_worker),
):
    db = get_database()
    worker_id = current_user.get("_id") or current_user.get("id")
    w_oid = ObjectId(worker_id) if ObjectId.is_valid(worker_id) else worker_id
    now = datetime.now(timezone.utc)
    start_of_today = datetime(now.year, now.month, now.day, tzinfo=timezone.utc)

    total_assigned = await db.complaints.count_documents({
        "assignedWorkerId": w_oid,
        "status": {"$in": [ComplaintStatus.ASSIGNED.value, ComplaintStatus.IN_PROGRESS.value]}
    })
    in_progress = await db.complaints.count_documents({
        "assignedWorkerId": w_oid,
        "status": ComplaintStatus.IN_PROGRESS.value
    })
    resolved_today = await db.complaints.count_documents({
        "assignedWorkerId": w_oid,
        "status": {"$in": [ComplaintStatus.RESOLUTION_SUBMITTED.value, ComplaintStatus.RESOLVED.value, ComplaintStatus.VERIFIED.value]},
        "$or": [
            {"resolvedAt": {"$gte": start_of_today}},
            {"resolutionSubmittedAt": {"$gte": start_of_today}},
            {"updatedAt": {"$gte": start_of_today}},
        ]
    })
    overdue_count = await db.complaints.count_documents({
        "assignedWorkerId": w_oid,
        "status": {"$in": [ComplaintStatus.ASSIGNED.value, ComplaintStatus.IN_PROGRESS.value]},
        "slaDeadline": {"$lt": now}
    })

    return {
        "success": True,
        "stats": {
            "total_assigned": total_assigned,
            "in_progress": in_progress,
            "resolved_today": resolved_today,
            "overdue_count": overdue_count,
        }
    }


# ── 2. Worker Tasks List ───────────────────────────────────────────
@router.get("/tasks")
async def get_worker_tasks(
    status_filter: Optional[str] = None,
    current_user: dict = Depends(require_worker),
):
    db = get_database()
    worker_id = current_user.get("_id") or current_user.get("id")

    query: Dict[str, Any] = {
        "assignedWorkerId": ObjectId(worker_id) if ObjectId.is_valid(worker_id) else worker_id,
    }

    if status_filter and status_filter.upper() != "ALL":
        query["status"] = status_filter.upper()

    cursor = db.complaints.find(query).sort("createdAt", -1)
    raw_tasks = await cursor.to_list(None)

    now = datetime.now(timezone.utc)
    tasks = []
    for t in raw_tasks:
        formatted = format_complaint_dict(t)
        # Compute SLA remaining hours
        sla_deadline = t.get("slaDeadline")
        if sla_deadline:
            if isinstance(sla_deadline, str):
                try:
                    sla_deadline = datetime.fromisoformat(sla_deadline)
                except Exception:
                    sla_deadline = None
            if sla_deadline:
                if sla_deadline.tzinfo is None:
                    sla_deadline = sla_deadline.replace(tzinfo=timezone.utc)
                remaining_secs = (sla_deadline - now).total_seconds()
                formatted["slaRemainingHours"] = round(remaining_secs / 3600.0, 1)
                formatted["isOverdue"] = remaining_secs < 0
            else:
                formatted["slaRemainingHours"] = None
                formatted["isOverdue"] = False
        else:
            formatted["slaRemainingHours"] = None
            formatted["isOverdue"] = False
        tasks.append(formatted)

    # Sort priority order: CRITICAL (0), HIGH (1), MEDIUM (2), LOW (3)
    prio_order = {"CRITICAL": 0, "HIGH": 1, "MEDIUM": 2, "LOW": 3}
    tasks.sort(key=lambda x: (
        0 if x.get("isOverdue") else 1,
        prio_order.get(str(x.get("priority", "MEDIUM")).upper(), 2),
        x.get("slaRemainingHours") if x.get("slaRemainingHours") is not None else 9999
    ))

    return {"success": True, "tasks": tasks}


# ── 3. Worker Task Detail ──────────────────────────────────────────
@router.get("/tasks/{task_id}")
async def get_worker_task_detail(
    task_id: str,
    current_user: dict = Depends(require_worker),
):
    db = get_database()
    worker_id = current_user.get("_id") or current_user.get("id")

    t_filter = {"_id": ObjectId(task_id)} if ObjectId.is_valid(task_id) else {"complaintId": task_id}
    task = await db.complaints.find_one(t_filter)

    if not task:
        raise HTTPException(status_code=404, detail="Task not found")

    if str(task.get("assignedWorkerId") or "") != str(worker_id):
        raise HTTPException(status_code=403, detail="This task is not assigned to you")

    return {"success": True, "task": format_complaint_dict(task)}


# ── 4. Start Work (ASSIGNED -> IN_PROGRESS) ────────────────────────
@router.post("/tasks/{task_id}/start")
async def start_task(
    task_id: str,
    payload: Optional[dict] = Body(None),
    current_user: dict = Depends(require_worker),
):
    comment = (payload or {}).get("comment", "Worker has arrived at location and commenced repairs")
    updated = await transition_complaint_status(
        complaint_id=task_id,
        new_status=ComplaintStatus.IN_PROGRESS,
        current_user=current_user,
        comment=comment,
    )
    return {"success": True, "message": "Work started", "task": updated}


# ── 5. Resolve Task with Proof (IN_PROGRESS -> RESOLVED) ───────────
@router.post("/tasks/{task_id}/resolve")
async def resolve_task_with_proof(
    task_id: str,
    notes: str = Form("Issue resolved successfully"),
    files: List[UploadFile] = File(None),
    current_user: dict = Depends(require_worker),
):
    db = get_database()
    proof_images = []
    proof_paths = []

    if files:
        for file in files:
            if file.filename:
                try:
                    filename, target_path = await save_upload_file(file, "image")
                    proof_images.append(filename)
                    proof_paths.append(target_path)
                except Exception as e:
                    pass

    # AI Before & After verification
    ai_verification = None
    t_filter = {"_id": ObjectId(task_id)} if ObjectId.is_valid(task_id) else {"complaintId": task_id}
    original_task = await db.complaints.find_one(t_filter)
    if original_task and proof_paths:
        from ..config.env import env
        from ..services.ai_service import verify_resolution
        before_filename = (original_task.get("images") or [None])[0]
        before_path = str(env.UPLOADS_DIR / before_filename) if before_filename else ""
        category = original_task.get("category", "pothole")
        try:
            ai_verification = await verify_resolution(before_path, proof_paths[0], category)
        except Exception as ai_err:
            print(f"AI verify resolution error: {ai_err}")

    evidence = {
        "notes": notes,
        "images": proof_images,
        "resolved_by_worker": current_user.get("name", "Field Worker"),
        "resolved_at": datetime.now(timezone.utc).isoformat(),
        "aiVerification": ai_verification,
    }

    updated = await transition_complaint_status(
        complaint_id=task_id,
        new_status=ComplaintStatus.RESOLUTION_SUBMITTED,
        current_user=current_user,
        comment=f"Resolution submitted with photo proof: {notes}. Awaiting district verification.",
        evidence=evidence,
    )

    return {
        "success": True,
        "message": "Task marked as RESOLUTION_SUBMITTED with photo proof. Sent to District Admin for verification.",
        "task": updated,
        "aiVerification": ai_verification,
    }


# ── 6. Worker Profile & Performance Metrics ────────────────────────
@router.get("/profile")
async def get_worker_profile(
    current_user: dict = Depends(require_worker),
):
    db = get_database()
    worker_id = current_user.get("_id") or current_user.get("id")

    w_oid = ObjectId(worker_id) if ObjectId.is_valid(worker_id) else worker_id
    total_assigned = await db.complaints.count_documents({"assignedWorkerId": w_oid})
    in_progress = await db.complaints.count_documents({"assignedWorkerId": w_oid, "status": ComplaintStatus.IN_PROGRESS.value})
    resolved = await db.complaints.count_documents({"assignedWorkerId": w_oid, "status": {"$in": [ComplaintStatus.RESOLVED.value, ComplaintStatus.VERIFIED.value]}})

    return {
        "success": True,
        "user": format_user_response(current_user),
        "stats": {
            "total_assigned": total_assigned,
            "in_progress": in_progress,
            "resolved": resolved,
        }
    }


# ── 7. Worker Availability (Feature 7) ──────────────────────────────
@router.post("/availability")
async def update_worker_availability(
    payload: dict = Body(...),
    current_user: dict = Depends(require_worker),
):
    """Update field worker real-time availability status (ON_DUTY, OFF_DUTY, ON_LEAVE)."""
    db = get_database()
    worker_id = current_user.get("_id") or current_user.get("id")
    w_oid = ObjectId(worker_id) if ObjectId.is_valid(worker_id) else worker_id
    
    new_status = payload.get("availability")
    if new_status not in ["ON_DUTY", "OFF_DUTY", "ON_LEAVE"]:
        raise HTTPException(status_code=400, detail="Invalid availability status. Must be ON_DUTY, OFF_DUTY, or ON_LEAVE.")
        
    result = await db.users.find_one_and_update(
        {"_id": w_oid},
        {"$set": {
            "availability": new_status,
            "last_active": datetime.now(timezone.utc)
        }},
        return_document=True
    )
    
    if not result:
        raise HTTPException(status_code=404, detail="Worker not found")
        
    return {
        "success": True, 
        "message": f"Availability updated to {new_status}",
        "user": format_user_response(result)
    }


# ── 8. Worker Analytics (Feature 13) ───────────────────────────────
@router.get("/analytics")
async def get_my_worker_analytics(
    current_user: dict = Depends(require_worker),
):
    """Get detailed performance metrics for the current worker."""
    worker_id = current_user.get("_id") or current_user.get("id")
    analytics = await get_worker_analytics(str(worker_id))
    return {"success": True, "data": analytics}
