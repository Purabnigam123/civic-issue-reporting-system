"""
Super Admin Router: system-wide municipal analytics, complaint management,
suspicious review queue, user moderation, audit logs, and zonal metrics.
"""

from fastapi import APIRouter, Depends, HTTPException, Query, Body, status
from typing import Optional, List, Dict, Any
from datetime import datetime, timedelta, timezone
from bson import ObjectId

from ..database.mongodb import get_database
from ..models.user import UserRole, format_user_response, hash_password
from ..models.complaint import ComplaintStatus, format_complaint_dict
from ..models.district import DELHI_DISTRICTS
from ..dependencies.auth import require_super_admin
from ..services.status_service import transition_complaint_status
from ..services.audit_service import log_audit_event, get_audit_logs
from ..services.overdue_service import check_and_escalate_overdue_complaints
from ..services.district_analytics_service import get_all_districts_performance
from ..services.insights_service import get_command_center_insights
from ..services.prediction_service import get_predictive_hotspots
from ..services.assignment_service import auto_assign_worker_to_complaint

router = APIRouter(prefix="/api/admin", tags=["Super Admin"])


# ── 1. City-Wide Metrics & Analytics ──────────────────────────────
@router.get("/metrics")
async def get_admin_metrics(current_user: dict = Depends(require_super_admin)):
    db = get_database()
    now = datetime.now(timezone.utc)
    seven_days_ago = now - timedelta(days=7)

    # Status counts
    pipeline = [
        {"$group": {"_id": "$status", "count": {"$sum": 1}}}
    ]
    status_results = await db.complaints.aggregate(pipeline).to_list(None)
    status_counts = {item["_id"]: item["count"] for item in status_results if item.get("_id")}

    total_complaints = sum(status_counts.values())
    resolved_count = status_counts.get(ComplaintStatus.RESOLVED.value, 0) + status_counts.get(ComplaintStatus.VERIFIED.value, 0)
    in_progress_count = status_counts.get(ComplaintStatus.IN_PROGRESS.value, 0) + status_counts.get(ComplaintStatus.ASSIGNED.value, 0)
    submitted_count = status_counts.get(ComplaintStatus.SUBMITTED.value, 0) + status_counts.get(ComplaintStatus.UNDER_REVIEW.value, 0)
    escalated_count = status_counts.get(ComplaintStatus.ESCALATED.value, 0)

    suspicious_count = await db.complaints.count_documents({"isSuspicious": True, "status": {"$ne": ComplaintStatus.REJECTED.value}})
    total_users = await db.users.count_documents({})
    total_workers = await db.users.count_documents({"role": UserRole.WORKER.value})

    # District breakdown
    district_pipeline = [
        {"$group": {"_id": "$district_id", "total": {"$sum": 1}, "resolved": {"$sum": {"$cond": [{"$in": ["$status", ["RESOLVED", "VERIFIED"]]}, 1, 0]}}}}
    ]
    district_results = await db.complaints.aggregate(district_pipeline).to_list(None)
    district_stats = {}
    for d in DELHI_DISTRICTS:
        district_stats[d["id"]] = {"name": d["name"], "total": 0, "resolved": 0}
    for item in district_results:
        did = item.get("_id")
        if did and did in district_stats:
            district_stats[did]["total"] = item["total"]
            district_stats[did]["resolved"] = item["resolved"]

    # Category breakdown
    category_pipeline = [
        {"$group": {"_id": "$category", "count": {"$sum": 1}}},
        {"$sort": {"count": -1}}
    ]
    cat_results = await db.complaints.aggregate(category_pipeline).to_list(None)
    category_counts = [{ "category": item["_id"], "count": item["count"] } for item in cat_results if item.get("_id")]

    # 7-day trend
    trend_pipeline = [
        {"$match": {"createdAt": {"$gte": seven_days_ago}}},
        {"$group": {
            "_id": {"$dateToString": {"format": "%Y-%m-%d", "date": "$createdAt"}},
            "created": {"$sum": 1},
        }},
        {"$sort": {"_id": 1}}
    ]
    trend_results = await db.complaints.aggregate(trend_pipeline).to_list(None)

    # Resolution SLA compliance
    sla_breached_count = await db.complaints.count_documents({"slaStatus": "BREACHED"})
    sla_compliance_rate = round(((total_complaints - sla_breached_count) / max(total_complaints, 1)) * 100, 1)

    return {
        "success": True,
        "metrics": {
            "total_complaints": total_complaints,
            "resolved_count": resolved_count,
            "in_progress_count": in_progress_count,
            "submitted_count": submitted_count,
            "escalated_count": escalated_count,
            "suspicious_count": suspicious_count,
            "total_users": total_users,
            "total_workers": total_workers,
            "sla_compliance_rate": sla_compliance_rate,
            "status_counts": status_counts,
            "district_stats": district_stats,
            "category_counts": category_counts,
            "recent_trend": trend_results,
        }
    }


# ── 2. City-Wide Complaints List with Rich Filters ────────────────
@router.get("/complaints")
async def get_all_complaints_admin(
    status: Optional[str] = None,
    priority: Optional[str] = None,
    district_id: Optional[str] = None,
    category: Optional[str] = None,
    is_suspicious: Optional[bool] = None,
    is_escalated: Optional[bool] = None,
    search: Optional[str] = None,
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100),
    current_user: dict = Depends(require_super_admin),
):
    db = get_database()
    query: Dict[str, Any] = {}

    if status:
        query["status"] = status
    if priority:
        query["priority"] = priority
    if district_id:
        query["district_id"] = district_id.lower()
    if category:
        query["category"] = category
    if is_suspicious is not None:
        query["isSuspicious"] = is_suspicious
    if is_escalated is not None:
        query["isEscalated"] = is_escalated
    if search:
        query["$or"] = [
            {"complaintId": {"$regex": search, "$options": "i"}},
            {"description": {"$regex": search, "$options": "i"}},
            {"address": {"$regex": search, "$options": "i"}},
            {"reporterName": {"$regex": search, "$options": "i"}},
        ]

    skip = (page - 1) * limit
    total = await db.complaints.count_documents(query)
    cursor = db.complaints.find(query).sort("createdAt", -1).skip(skip).limit(limit)
    raw_list = await cursor.to_list(None)

    complaints = [format_complaint_dict(c) for c in raw_list]
    return {
        "success": True,
        "total": total,
        "page": page,
        "limit": limit,
        "pages": (total + limit - 1) // limit,
        "complaints": complaints,
    }


# ── 3. Complaint Status Override / Transition ─────────────────────
@router.post("/complaints/{complaint_id}/status")
async def admin_update_complaint_status(
    complaint_id: str,
    payload: dict = Body(...),
    current_user: dict = Depends(require_super_admin),
):
    new_status_str = payload.get("status")
    comment = payload.get("comment", "Status updated by Super Admin")
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

    await log_audit_event(
        action="SUPER_ADMIN_STATUS_UPDATE",
        actor_id=str(current_user.get("_id") or current_user.get("id")),
        actor_role="SUPER_ADMIN",
        actor_name=current_user.get("name", "Super Admin"),
        target_type="complaint",
        target_id=complaint_id,
        details={"new_status": new_status_str, "comment": comment},
    )

    return {
        "success": True,
        "message": f"Status updated to {new_status_str}",
        "complaint": updated,
    }


# ── 4. Suspicious Complaints Review Queue ─────────────────────────
@router.get("/suspicious")
async def get_suspicious_complaints(
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100),
    current_user: dict = Depends(require_super_admin),
):
    db = get_database()
    query = {
        "isSuspicious": True,
        "status": {"$nin": [
            ComplaintStatus.REJECTED.value,
            ComplaintStatus.RESOLVED.value,
            ComplaintStatus.CLOSED.value,
            ComplaintStatus.SUBMITTED.value,
            ComplaintStatus.ASSIGNED.value,
            ComplaintStatus.IN_PROGRESS.value,
        ]}
    }
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


@router.post("/suspicious/{complaint_id}/verify")
async def mark_suspicious_as_genuine(
    complaint_id: str,
    current_user: dict = Depends(require_super_admin),
):
    """Mark a flagged complaint as verified/genuine and release it to the district page."""
    db = get_database()
    c_filter = {"_id": ObjectId(complaint_id)} if ObjectId.is_valid(complaint_id) else {"complaintId": complaint_id}

    complaint = await db.complaints.find_one(c_filter)
    if not complaint:
        raise HTTPException(status_code=404, detail="Complaint not found")

    now = datetime.now(timezone.utc)
    district_name = complaint.get("district_name") or complaint.get("district_id", "District").replace("_", " ").title()

    history_entry = {
        "from_status": complaint.get("status", "UNDER_REVIEW"),
        "to_status": ComplaintStatus.SUBMITTED.value,
        "changed_by": str(current_user.get("_id") or current_user.get("id")),
        "changed_by_role": "SUPER_ADMIN",
        "changed_by_name": current_user.get("name", "Super Admin"),
        "changed_at": now,
        "comment": f"Approved by Super Admin: Flagged report verified as genuine and dispatched to {district_name} portal.",
        "evidence": None,
    }

    result = await db.complaints.find_one_and_update(
        c_filter,
        {
            "$set": {
                "isSuspicious": False,
                "needsReview": False,
                "suspiciousScore": 0.0,
                "suspiciousVerifiedBy": current_user.get("name", "Super Admin"),
                "status": ComplaintStatus.SUBMITTED.value,
                "updatedAt": now,
            },
            "$push": {
                "status_history": history_entry
            }
        },
        return_document=True,
    )

    await log_audit_event(
        action="VERIFY_SUSPICIOUS_REPORT",
        actor_id=str(current_user.get("_id") or current_user.get("id")),
        actor_role="SUPER_ADMIN",
        actor_name=current_user.get("name", "Super Admin"),
        target_type="complaint",
        target_id=complaint_id,
        details={
            "result": "Marked as genuine",
            "district_id": complaint.get("district_id"),
            "district_name": district_name,
            "dispatched_to_district": True,
        },
    )

    # Auto-assign to field worker using AI
    auto_assigned_info = None
    try:
        auto_assign_res = await auto_assign_worker_to_complaint(str(result["_id"]))
        if auto_assign_res and auto_assign_res.get("complaint"):
            result = auto_assign_res["complaint"]
            auto_assigned_info = f" (Auto-assigned to {auto_assign_res.get('worker_name')})"
    except Exception as e:
        print(f"Auto-assign after verification error: {e}")

    return {
        "success": True,
        "message": f"Complaint #{result.get('complaintId')} approved as genuine and dispatched to {district_name} page{auto_assigned_info or ''}",
        "complaint": format_complaint_dict(result) if isinstance(result, dict) else result,
        "district_name": district_name,
    }


@router.post("/suspicious/{complaint_id}/dismiss")
async def dismiss_suspicious_complaint(
    complaint_id: str,
    payload: Optional[dict] = Body(None),
    current_user: dict = Depends(require_super_admin),
):
    """Dismiss a fake / spam complaint."""
    db = get_database()
    c_filter = {"_id": ObjectId(complaint_id)} if ObjectId.is_valid(complaint_id) else {"complaintId": complaint_id}
    complaint = await db.complaints.find_one(c_filter)
    if not complaint:
        raise HTTPException(status_code=404, detail="Complaint not found")

    reason = (payload or {}).get("reason", "Spam / Fraudulent evidence detected")
    now = datetime.now(timezone.utc)

    # Clear suspicious flag and mark as rejected
    await db.complaints.update_one(
        c_filter,
        {
            "$set": {
                "isSuspicious": False,
                "suspiciousDismissed": True,
                "needsReview": False,
                "dismissedReason": reason,
                "dismissedAt": now,
                "updatedAt": now,
            }
        }
    )

    updated = await transition_complaint_status(
        complaint_id=str(complaint["_id"]),
        new_status=ComplaintStatus.REJECTED,
        current_user=current_user,
        comment=f"Dismissed by Admin: {reason}",
    )
    return {"success": True, "message": "Complaint dismissed and rejected", "complaint": updated}


# ── 5. User Management & Moderation ───────────────────────────────
@router.get("/users")
async def list_users(
    role: Optional[str] = None,
    status: Optional[str] = None,
    search: Optional[str] = None,
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100),
    current_user: dict = Depends(require_super_admin),
):
    db = get_database()
    query = {}
    if role:
        query["role"] = role
    if status:
        query["status"] = status
    if search:
        query["$or"] = [
            {"name": {"$regex": search, "$options": "i"}},
            {"email": {"$regex": search, "$options": "i"}},
            {"phone": {"$regex": search, "$options": "i"}},
            {"worker_id": {"$regex": search, "$options": "i"}},
        ]

    skip = (page - 1) * limit
    total = await db.users.count_documents(query)
    cursor = db.users.find(query).sort("created_at", -1).skip(skip).limit(limit)
    users = await cursor.to_list(None)

    return {
        "success": True,
        "total": total,
        "page": page,
        "pages": (total + limit - 1) // limit,
        "users": [format_user_response(u) for u in users],
    }


@router.post("/users/{user_id}/ban")
async def ban_user(
    user_id: str,
    payload: Optional[dict] = Body(None),
    current_user: dict = Depends(require_super_admin),
):
    db = get_database()
    reason = (payload or {}).get("reason", "Violation of civic platform terms")
    u_filter = {"_id": ObjectId(user_id)} if ObjectId.is_valid(user_id) else {"_id": user_id}

    result = await db.users.find_one_and_update(
        u_filter,
        {"$set": {"status": "BANNED", "ban_reason": reason, "banned_at": datetime.now(timezone.utc)}},
        return_document=True,
    )
    if not result:
        raise HTTPException(status_code=404, detail="User not found")

    await log_audit_event(
        action="BAN_USER",
        actor_id=str(current_user.get("_id") or current_user.get("id")),
        actor_role="SUPER_ADMIN",
        actor_name=current_user.get("name", "Super Admin"),
        target_type="user",
        target_id=user_id,
        details={"reason": reason, "user_email": result.get("email")},
    )

    return {"success": True, "message": "User account banned", "user": format_user_response(result)}


@router.post("/users/{user_id}/unban")
async def unban_user(
    user_id: str,
    current_user: dict = Depends(require_super_admin),
):
    db = get_database()
    u_filter = {"_id": ObjectId(user_id)} if ObjectId.is_valid(user_id) else {"_id": user_id}

    result = await db.users.find_one_and_update(
        u_filter,
        {"$set": {"status": "ACTIVE"}, "$unset": {"ban_reason": "", "banned_at": ""}},
        return_document=True,
    )
    if not result:
        raise HTTPException(status_code=404, detail="User not found")

    return {"success": True, "message": "User account unbanned", "user": format_user_response(result)}


# ── 6. Audit Logs & System Escalation Scanner ─────────────────────
@router.get("/audit-logs")
async def get_system_audit_logs(
    limit: int = Query(50, ge=1, le=200),
    skip: int = Query(0, ge=0),
    action: Optional[str] = None,
    current_user: dict = Depends(require_super_admin),
):
    logs = await get_audit_logs(limit=limit, skip=skip, action=action)
    return {"success": True, "logs": logs}


@router.post("/escalate/scan")
async def trigger_sla_escalation_scan(
    current_user: dict = Depends(require_super_admin),
):
    """Manually invoke SLA overdue detection and auto-escalation daemon."""
    result = await check_and_escalate_overdue_complaints()
    return {"success": True, "result": result}


# ── 6b. Escalated Complaints Management & Super Admin Action Queue ─
@router.get("/escalated")
async def get_escalated_complaints(
    district_id: Optional[str] = None,
    category: Optional[str] = None,
    priority: Optional[str] = None,
    page: int = Query(1, ge=1),
    limit: int = Query(50, ge=1, le=100),
    current_user: dict = Depends(require_super_admin),
):
    """Retrieve all escalated civic issues requiring Super Admin action."""
    db = get_database()
    try:
        await check_and_escalate_overdue_complaints()
    except Exception:
        pass

    query: Dict[str, Any] = {
        "$or": [
            {"status": ComplaintStatus.ESCALATED.value},
            {"isEscalated": True},
        ]
    }
    if district_id:
        query["district_id"] = district_id.lower()
    if category:
        query["category"] = category
    if priority:
        query["priority"] = priority

    now = datetime.now(timezone.utc)
    total = await db.complaints.count_documents(query)
    skip = (page - 1) * limit
    cursor = db.complaints.find(query).sort("slaDeadline", 1).skip(skip).limit(limit)
    items = await cursor.to_list(None)

    formatted_items = []
    for item in items:
        f = format_complaint_dict(item)
        sla_deadline = item.get("slaDeadline")
        if isinstance(sla_deadline, str):
            try:
                sla_deadline = datetime.fromisoformat(sla_deadline)
            except Exception:
                sla_deadline = None
        if sla_deadline:
            if sla_deadline.tzinfo is None:
                sla_deadline = sla_deadline.replace(tzinfo=timezone.utc)
            overdue_secs = (now - sla_deadline).total_seconds()
            f["overdueHours"] = max(0, round(overdue_secs / 3600.0, 1))
        else:
            f["overdueHours"] = 0
        formatted_items.append(f)

    return {
        "success": True,
        "total": total,
        "page": page,
        "pages": (total + limit - 1) // limit,
        "complaints": formatted_items,
    }


@router.post("/escalated/{complaint_id}/action")
async def take_action_on_escalated_complaint(
    complaint_id: str,
    payload: dict = Body(...),
    current_user: dict = Depends(require_super_admin),
):
    """
    Super Admin actions on escalated complaints:
    - action: 'REASSIGN' (worker_id, comment) -> sets ASSIGNED, resets isEscalated
    - action: 'FORCE_RESOLVE' (comment) -> sets RESOLVED
    - action: 'EXTEND_DEADLINE' (additional_hours, comment) -> extends slaDeadline, resets isEscalated, sets IN_PROGRESS
    - action: 'DISMISS' / 'REJECT' (comment) -> sets REJECTED
    """
    db = get_database()
    action = (payload.get("action") or "").upper()
    comment = payload.get("comment", "")
    now = datetime.now(timezone.utc)

    c_filter = {"_id": ObjectId(complaint_id)} if ObjectId.is_valid(complaint_id) else {"complaintId": complaint_id}
    complaint = await db.complaints.find_one(c_filter)
    if not complaint:
        raise HTTPException(status_code=404, detail="Complaint not found")

    c_id_str = str(complaint["_id"])

    if action == "REASSIGN":
        worker_id = payload.get("worker_id")
        if not worker_id:
            raise HTTPException(status_code=400, detail="worker_id is required for REASSIGN action")
        w_filter = {"_id": ObjectId(worker_id)} if ObjectId.is_valid(worker_id) else {"_id": worker_id}
        worker = await db.users.find_one(w_filter)
        if not worker:
            raise HTTPException(status_code=404, detail="Worker not found")
        worker_name = worker.get("name", "Field Worker")

        new_deadline = now + timedelta(hours=24)
        await db.complaints.update_one(
            {"_id": complaint["_id"]},
            {
                "$set": {
                    "isEscalated": False,
                    "slaDeadline": new_deadline,
                    "slaStatus": "ON_TRACK",
                }
            }
        )
        updated = await transition_complaint_status(
            complaint_id=c_id_str,
            new_status=ComplaintStatus.ASSIGNED,
            current_user=current_user,
            comment=f"Super Admin reallocated to {worker_name}: {comment}",
            assigned_worker_id=str(worker["_id"]),
            assigned_worker_name=worker_name,
        )
        msg = f"Escalated complaint reassigned to {worker_name} with 24h extended SLA"

    elif action == "FORCE_RESOLVE":
        await db.complaints.update_one(
            {"_id": complaint["_id"]},
            {"$set": {"isEscalated": False}}
        )
        updated = await transition_complaint_status(
            complaint_id=c_id_str,
            new_status=ComplaintStatus.RESOLVED,
            current_user=current_user,
            comment=f"Direct administrative resolution by Super Admin: {comment}",
            evidence={"resolved_by_superadmin": current_user.get("name", "Super Admin"), "notes": comment}
        )
        msg = "Complaint marked as RESOLVED by Super Admin"

    elif action == "EXTEND_DEADLINE":
        additional_hours = int(payload.get("additional_hours", 24))
        new_deadline = now + timedelta(hours=additional_hours)
        await db.complaints.update_one(
            {"_id": complaint["_id"]},
            {
                "$set": {
                    "isEscalated": False,
                    "slaDeadline": new_deadline,
                    "slaStatus": "ON_TRACK",
                    "updatedAt": now,
                },
                "$push": {
                    "timeline": {
                        "status": "DEADLINE_EXTENDED",
                        "timestamp": now,
                        "note": f"Super Admin extended SLA deadline by {additional_hours}h. Reason: {comment}",
                    }
                }
            }
        )
        target_status = ComplaintStatus.IN_PROGRESS if complaint.get("assignedWorkerId") else ComplaintStatus.ASSIGNED
        updated = await transition_complaint_status(
            complaint_id=c_id_str,
            new_status=target_status,
            current_user=current_user,
            comment=f"SLA deadline extended by {additional_hours}h. Resumed execution.",
        )
        msg = f"Deadline extended by {additional_hours}h and escalation status cleared"

    elif action in ["DISMISS", "REJECT"]:
        await db.complaints.update_one(
            {"_id": complaint["_id"]},
            {"$set": {"isEscalated": False}}
        )
        updated = await transition_complaint_status(
            complaint_id=c_id_str,
            new_status=ComplaintStatus.REJECTED,
            current_user=current_user,
            comment=f"Rejected by Super Admin: {comment}",
        )
        msg = "Complaint dismissed/rejected by Super Admin"
    else:
        raise HTTPException(status_code=400, detail=f"Invalid action: {action}. Supported: REASSIGN, FORCE_RESOLVE, EXTEND_DEADLINE, DISMISS")

    await log_audit_event(
        action=f"SUPERADMIN_ESCALATION_{action}",
        actor_id=str(current_user.get("_id") or current_user.get("id")),
        actor_role="SUPER_ADMIN",
        actor_name=current_user.get("name", "Super Admin"),
        target_type="complaint",
        target_id=c_id_str,
        details={"action": action, "comment": comment, "complaintId": complaint.get("complaintId")},
    )

    return {"success": True, "message": msg, "complaint": updated}


# ── 6c. Advanced Multi-Metric Analytics ─────────────────────────────
@router.get("/analytics/advanced")
async def get_advanced_admin_analytics(current_user: dict = Depends(require_super_admin)):
    """Provides deep analytics, multi-district escalation distributions, department efficiency metrics, and SLA breach ratios."""
    db = get_database()
    now = datetime.now(timezone.utc)

    # 1. District Escalation Distribution
    district_pipeline = [
        {"$match": {"isSuspicious": {"$ne": True}}},
        {
            "$group": {
                "_id": "$district_id",
                "total": {"$sum": 1},
                "escalated": {
                    "$sum": {"$cond": [{"$or": [{"$eq": ["$status", "ESCALATED"]}, {"$eq": ["$isEscalated", True]}]}, 1, 0]}
                },
                "resolved": {
                    "$sum": {"$cond": [{"$in": ["$status", ["RESOLVED", "VERIFIED"]]}, 1, 0]}
                },
                "in_progress": {
                    "$sum": {"$cond": [{"$in": ["$status", ["ASSIGNED", "IN_PROGRESS", "RESOLUTION_SUBMITTED"]]}, 1, 0]}
                },
            }
        },
        {"$sort": {"escalated": -1}}
    ]
    dist_results = await db.complaints.aggregate(district_pipeline).to_list(None)
    district_data = []
    for d in dist_results:
        did = d["_id"] or "other"
        name = did.replace("_", " ").title()
        tot = d["total"]
        esc = d["escalated"]
        res = d["resolved"]
        inp = d["in_progress"]
        district_data.append({
            "district_id": did,
            "district_name": name,
            "total": tot,
            "escalated": esc,
            "resolved": res,
            "in_progress": inp,
            "escalation_rate": round((esc / max(tot, 1)) * 100, 1),
            "resolution_rate": round((res / max(tot, 1)) * 100, 1),
        })

    # 2. Departmental Performance & Resolution Efficiency
    dept_pipeline = [
        {"$match": {"isSuspicious": {"$ne": True}}},
        {
            "$group": {
                "_id": "$department",
                "total": {"$sum": 1},
                "resolved": {"$sum": {"$cond": [{"$in": ["$status", ["RESOLVED", "VERIFIED"]]}, 1, 0]}},
                "escalated": {"$sum": {"$cond": [{"$or": [{"$eq": ["$status", "ESCALATED"]}, {"$eq": ["$isEscalated", True]}]}, 1, 0]}},
            }
        },
        {"$sort": {"total": -1}}
    ]
    dept_results = await db.complaints.aggregate(dept_pipeline).to_list(None)
    dept_data = []
    for dept in dept_results:
        dept_name = dept["_id"] or "General Administration"
        tot = dept["total"]
        res = dept["resolved"]
        esc = dept["escalated"]
        dept_data.append({
            "department": dept_name,
            "total": tot,
            "resolved": res,
            "escalated": esc,
            "efficiency": round((res / max(tot, 1)) * 100, 1),
            "escalation_rate": round((esc / max(tot, 1)) * 100, 1),
        })

    # 3. SLA Status Breakdown (On Track, At Risk, Breached)
    sla_on_track = await db.complaints.count_documents({
        "status": {"$in": ["SUBMITTED", "ASSIGNED", "IN_PROGRESS"]},
        "slaDeadline": {"$gt": now + timedelta(hours=6)},
        "isEscalated": {"$ne": True},
    })
    sla_at_risk = await db.complaints.count_documents({
        "status": {"$in": ["SUBMITTED", "ASSIGNED", "IN_PROGRESS"]},
        "slaDeadline": {"$lte": now + timedelta(hours=6), "$gt": now},
        "isEscalated": {"$ne": True},
    })
    sla_breached = await db.complaints.count_documents({
        "$or": [
            {"status": "ESCALATED"},
            {"isEscalated": True},
            {"slaDeadline": {"$lte": now}, "status": {"$nin": ["RESOLVED", "VERIFIED", "REJECTED", "CLOSED"]}}
        ]
    })
    sla_distribution = {
        "on_track": sla_on_track,
        "at_risk": sla_at_risk,
        "breached": sla_breached,
        "total_active": sla_on_track + sla_at_risk + sla_breached,
    }

    # 4. Category-wise Escalation Rate
    cat_pipeline = [
        {"$match": {"isSuspicious": {"$ne": True}}},
        {
            "$group": {
                "_id": "$category",
                "total": {"$sum": 1},
                "escalated": {"$sum": {"$cond": [{"$or": [{"$eq": ["$status", "ESCALATED"]}, {"$eq": ["$isEscalated", True]}]}, 1, 0]}},
                "resolved": {"$sum": {"$cond": [{"$in": ["$status", ["RESOLVED", "VERIFIED"]]}, 1, 0]}},
            }
        },
        {"$sort": {"total": -1}}
    ]
    cat_results = await db.complaints.aggregate(cat_pipeline).to_list(None)
    cat_data = [
        {
            "category": c["_id"] or "other",
            "total": c["total"],
            "escalated": c["escalated"],
            "resolved": c["resolved"],
            "escalation_rate": round((c["escalated"] / max(c["total"], 1)) * 100, 1),
        }
        for c in cat_results
    ]

    return {
        "success": True,
        "data": {
            "districts": district_data,
            "departments": dept_data,
            "sla_distribution": sla_distribution,
            "categories": cat_data,
        }
    }


# ── 7. Heatmap & Geo-spatial Telemetry ───────────────────────────
@router.get("/heatmap")
async def get_admin_heatmap_data(
    category: Optional[str] = None,
    status: Optional[str] = None,
    priority: Optional[str] = None,
    district_id: Optional[str] = None,
    current_user: dict = Depends(require_super_admin),
):
    """Retrieve geo-located complaints formatted for heatmaps and cluster visualization."""
    db = get_database()
    query: Dict[str, Any] = {
        "latitude": {"$exists": True, "$ne": None},
        "longitude": {"$exists": True, "$ne": None},
        "status": {"$ne": ComplaintStatus.REJECTED.value},
    }

    if category:
        query["category"] = category
    if status:
        query["status"] = status
    if priority:
        query["priority"] = priority
    if district_id:
        query["district_id"] = district_id.lower()

    cursor = db.complaints.find(query, {
        "_id": 1,
        "complaintId": 1,
        "latitude": 1,
        "longitude": 1,
        "category": 1,
        "priority": 1,
        "status": 1,
        "address": 1,
        "district_id": 1,
        "district_name": 1,
        "upvotes": 1,
        "createdAt": 1,
        "slaStatus": 1,
        "isEscalated": 1,
    }).sort("createdAt", -1).limit(1000)

    raw_list = await cursor.to_list(None)
    points = []

    priority_weights = {
        "CRITICAL": 1.0,
        "HIGH": 0.8,
        "MEDIUM": 0.5,
        "LOW": 0.3,
    }

    for doc in raw_list:
        try:
            lat = float(doc.get("latitude"))
            lng = float(doc.get("longitude"))
        except (TypeError, ValueError):
            continue

        if not (-90 <= lat <= 90 and -180 <= lng <= 180) or (lat == 0 and lng == 0):
            continue

        p_val = doc.get("priority", "MEDIUM")
        base_weight = priority_weights.get(p_val, 0.5)
        upvotes = int(doc.get("upvotes") or 0)
        weight = min(round(base_weight + (upvotes * 0.05), 2), 1.5)

        points.append({
            "id": str(doc["_id"]),
            "complaintId": doc.get("complaintId", str(doc["_id"])[:6]),
            "lat": lat,
            "lng": lng,
            "category": doc.get("category", "other"),
            "priority": p_val,
            "status": doc.get("status", "SUBMITTED"),
            "address": doc.get("address", "Delhi NCT"),
            "district_id": doc.get("district_id"),
            "district_name": doc.get("district_name"),
            "upvotes": upvotes,
            "weight": weight,
            "slaStatus": doc.get("slaStatus", "ON_TRACK"),
            "isEscalated": doc.get("isEscalated", False),
            "createdAt": doc.get("createdAt").isoformat() if isinstance(doc.get("createdAt"), datetime) else doc.get("createdAt"),
        })

    return {
        "success": True,
        "total_points": len(points),
        "points": points,
    }


# ── 8. Advanced City-Wide Analytics ───────────────────────────────
@router.get("/analytics")
async def get_super_admin_analytics(
    current_user: dict = Depends(require_super_admin),
):
    db = get_database()
    now = datetime.now(timezone.utc)

    # 7-day city trend
    trend_data = []
    for i in range(6, -1, -1):
        day_start = (now - timedelta(days=i)).replace(hour=0, minute=0, second=0, microsecond=0)
        day_end = day_start + timedelta(days=1)
        count = await db.complaints.count_documents({
            "createdAt": {"$gte": day_start, "$lt": day_end}
        })
        resolved_count = await db.complaints.count_documents({
            "resolvedAt": {"$gte": day_start, "$lt": day_end}
        })
        trend_data.append({
            "date": day_start.strftime("%b %d"),
            "complaints": count,
            "resolved": resolved_count,
        })

    # Category breakdown
    cat_pipeline = [
        {"$group": {"_id": "$category", "count": {"$sum": 1}}},
        {"$sort": {"count": -1}}
    ]
    cat_res = await db.complaints.aggregate(cat_pipeline).to_list(None)
    categories = [{"name": item["_id"] or "other", "count": item["count"]} for item in cat_res]

    # Top workers citywide leaderboard
    workers = await db.users.find({"role": UserRole.WORKER.value}).to_list(None)
    worker_perf = []
    for w in workers:
        w_id = w.get("_id")
        assigned = await db.complaints.count_documents({"assignedWorkerId": w_id})
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
            "district_id": w.get("district_id", "central_delhi"),
            "worker_id": w.get("worker_id", f"WKR-{str(w_id)[:6]}"),
            "assigned": assigned,
            "completed": completed,
            "active": active,
            "rate": round((completed / assigned * 100) if assigned > 0 else 100, 1),
            "status": w.get("status", "ACTIVE"),
        })

    worker_perf.sort(key=lambda x: x["completed"], reverse=True)

    # District resolution stats
    dist_pipeline = [
        {"$group": {
            "_id": "$district_id",
            "total": {"$sum": 1},
            "resolved": {"$sum": {"$cond": [{"$in": ["$status", ["RESOLVED", "VERIFIED"]]}, 1, 0]}}
        }}
    ]
    dist_res = await db.complaints.aggregate(dist_pipeline).to_list(None)
    dist_stats = []
    for d in DELHI_DISTRICTS:
        item = next((x for x in dist_res if x.get("_id") == d["id"]), None)
        total = item["total"] if item else 0
        res = item["resolved"] if item else 0
        rate = round((res / total * 100) if total > 0 else 100, 1)
        dist_stats.append({
            "id": d["id"],
            "name": d["name"],
            "total": total,
            "resolved": res,
            "rate": rate,
        })

    return {
        "success": True,
        "analytics": {
            "trend": trend_data,
            "categories": categories,
            "workers": worker_perf[:10],
            "districts": dist_stats,
        }
    }


# ── 9. Create Zonal Admin Account ─────────────────────────────────
@router.post("/users/create-zonal-admin")
async def create_zonal_admin_account(
    payload: dict = Body(...),
    current_user: dict = Depends(require_super_admin),
):
    db = get_database()
    name = payload.get("name")
    email = payload.get("email")
    phone = payload.get("phone")
    password = payload.get("password", "Admin@123")
    district_id = (payload.get("district_id") or "central_delhi").lower()

    if not name or not email:
        raise HTTPException(status_code=400, detail="Name and email are required")

    existing = await db.users.find_one({"email": email.lower()})
    if existing:
        raise HTTPException(status_code=400, detail="A user with this email already exists")

    from ..models.district import DISTRICT_BY_ID
    district_meta = DISTRICT_BY_ID.get(district_id, {})
    district_name = district_meta.get("name", "Central Delhi")

    now = datetime.now(timezone.utc)
    new_admin = {
        "name": name,
        "email": email.lower(),
        "phone": phone or "",
        "password": hash_password(password),
        "role": UserRole.ZONAL_ADMIN.value,
        "district_id": district_id,
        "district_name": district_name,
        "status": "ACTIVE",
        "created_at": now,
        "updated_at": now,
    }

    result = await db.users.insert_one(new_admin)
    new_admin["_id"] = result.inserted_id

    await log_audit_event(
        action="CREATE_ZONAL_ADMIN",
        actor_id=str(current_user.get("_id") or current_user.get("id")),
        actor_role="SUPER_ADMIN",
        actor_name=current_user.get("name", "Super Admin"),
        target_type="user",
        target_id=str(result.inserted_id),
        details={"name": name, "email": email, "district_id": district_id},
    )

    return {
        "success": True,
        "message": f"Zonal Admin account created for {district_name}",
        "user": format_user_response(new_admin),
    }


# ── 10. AI Insights & Predictions (Features 19 & 20) ──────────────
@router.get("/ai-insights")
async def get_ai_insights(current_user: dict = Depends(require_super_admin)):
    """Get actionable intelligence from the AI Command Center."""
    insights = await get_command_center_insights()
    return {"success": True, "data": insights}


@router.get("/predictions")
async def get_predictions(
    days: int = Query(30, ge=7, le=90),
    current_user: dict = Depends(require_super_admin)
):
    """Get predictive hotspots based on historical data."""
    predictions = await get_predictive_hotspots(days_lookback=days)
    return {"success": True, "data": predictions}


@router.get("/district-analytics")
async def get_district_analytics(current_user: dict = Depends(require_super_admin)):
    """Get detailed performance comparison across all districts."""
    analytics = await get_all_districts_performance()
    return {"success": True, "data": analytics}


# ── 11. Worker Security Management (Feature 8) ────────────────────
@router.post("/workers/{worker_id}/regenerate-password")
async def regenerate_worker_password(
    worker_id: str,
    current_user: dict = Depends(require_super_admin),
):
    """Regenerate a secure temporary password for a worker."""
    db = get_database()
    import secrets
    import string
    
    # Generate 12 char secure password
    alphabet = string.ascii_letters + string.digits + "!@#$%^&*"
    new_password = ''.join(secrets.choice(alphabet) for i in range(12))
    
    w_filter = {"_id": ObjectId(worker_id)} if ObjectId.is_valid(worker_id) else {"_id": worker_id}
    
    result = await db.users.find_one_and_update(
        {**w_filter, "role": UserRole.WORKER.value},
        {"$set": {
            "password": hash_password(new_password),
            "temporary_password_required": True,
            "updated_at": datetime.now(timezone.utc)
        }},
        return_document=True
    )
    
    if not result:
        raise HTTPException(status_code=404, detail="Worker not found")
        
    await log_audit_event(
        action="REGENERATE_WORKER_PASSWORD",
        actor_id=str(current_user.get("_id") or current_user.get("id")),
        actor_role="SUPER_ADMIN",
        actor_name=current_user.get("name", "Super Admin"),
        target_type="user",
        target_id=worker_id,
        details={"result": "Temporary password issued"}
    )

    return {
        "success": True, 
        "message": "Temporary password regenerated successfully",
        "temporary_password": new_password,
        "worker": format_user_response(result)
    }


