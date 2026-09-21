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

router = APIRouter(prefix="/api/zonal", tags=["Zonal Admin"])


# ── 1. Zone Metrics ────────────────────────────────────────────────
@router.get("/metrics")
async def get_zonal_metrics(current_user: dict = Depends(require_zonal_admin)):
    db = get_database()
    district_id = (current_user.get("district_id") or "central_delhi").lower()
    district_meta = DISTRICT_BY_ID.get(district_id, {})

    # Status counts for this zone
    pipeline = [
        {"$match": {"district_id": district_id}},
        {"$group": {"_id": "$status", "count": {"$sum": 1}}}
    ]
    status_results = await db.complaints.aggregate(pipeline).to_list(None)
    status_counts = {item["_id"]: item["count"] for item in status_results if item.get("_id")}

    total_complaints = sum(status_counts.values())
    pending_assignment = status_counts.get(ComplaintStatus.SUBMITTED.value, 0)
    in_progress = status_counts.get(ComplaintStatus.IN_PROGRESS.value, 0)
    assigned = status_counts.get(ComplaintStatus.ASSIGNED.value, 0)
    resolved = status_counts.get(ComplaintStatus.RESOLVED.value, 0) + status_counts.get(ComplaintStatus.VERIFIED.value, 0)
    escalated = status_counts.get(ComplaintStatus.ESCALATED.value, 0)

    # Worker count in this district
    workers_count = await db.users.count_documents({
        "role": UserRole.WORKER.value,
        "district_id": district_id,
    })

    # Category breakdown for this district
    cat_pipeline = [
        {"$match": {"district_id": district_id}},
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

    query: Dict[str, Any] = {"district_id": district_id}

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

    return {
        "success": True,
        "total": total,
        "page": page,
        "pages": (total + limit - 1) // limit,
        "complaints": [format_complaint_dict(c) for c in items],
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

    return {"success": True, "message": "Worker account created successfully", "worker": format_user_response(new_worker)}


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
            "createdAt": {"$gte": day_start, "$lt": day_end}
        })
        resolved_count = await db.complaints.count_documents({
            "district_id": district_id,
            "resolvedAt": {"$gte": day_start, "$lt": day_end}
        })
        trend_data.append({
            "date": day_start.strftime("%b %d"),
            "complaints": count,
            "resolved": resolved_count,
        })

    # Category distribution
    cat_pipeline = [
        {"$match": {"district_id": district_id}},
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
