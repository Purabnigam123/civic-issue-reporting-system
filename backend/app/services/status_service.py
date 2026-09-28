"""
Status Service: handles transitions, state machine validation, status history logging.
"""

from datetime import datetime, timezone
from typing import Optional, Dict, Any, List
from bson import ObjectId
from fastapi import HTTPException, status

from ..database.mongodb import get_database
from ..models.complaint import (
    ComplaintStatus,
    VALID_TRANSITIONS,
    format_complaint_dict,
)
from ..models.user import UserRole


async def transition_complaint_status(
    complaint_id: str,
    new_status: ComplaintStatus,
    current_user: Dict[str, Any],
    comment: Optional[str] = None,
    evidence: Optional[Dict[str, Any]] = None,
    assigned_worker_id: Optional[str] = None,
    assigned_worker_name: Optional[str] = None,
) -> Dict[str, Any]:
    """
    Validate and execute a status transition on a complaint.
    Records history in `status_history` and updates relevant timestamps.
    """
    db = get_database()
    try:
        c_oid = ObjectId(complaint_id)
    except Exception:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid complaint ID",
        )

    complaint = await db.complaints.find_one({"_id": c_oid})
    if not complaint:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Complaint not found",
        )

    old_status = complaint.get("status", ComplaintStatus.SUBMITTED)
    user_role = current_user.get("role", UserRole.CITIZEN)
    user_id = current_user.get("id") or str(current_user.get("_id"))
    user_name = current_user.get("name", "User")
    user_district = current_user.get("district_id")
    complaint_district = complaint.get("district_id")

    # 1. State machine transition check
    allowed_next = VALID_TRANSITIONS.get(old_status, [])
    # If reassigning to another worker while already ASSIGNED:
    is_reassignment = (
        old_status == ComplaintStatus.ASSIGNED
        and new_status == ComplaintStatus.ASSIGNED
        and assigned_worker_id is not None
    )

    if new_status not in allowed_next and not is_reassignment:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid transition from {old_status} to {new_status}. Allowed: {allowed_next}",
        )

    # 2. Role authorization checks
    if user_role == UserRole.WORKER:
        # Worker can only modify complaints assigned to them
        assigned_to = str(complaint.get("assignedWorkerId") or "")
        if assigned_to != user_id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="You can only update complaints assigned to you",
            )
        # Worker can do: ASSIGNED -> IN_PROGRESS, IN_PROGRESS -> RESOLUTION_SUBMITTED, or IN_PROGRESS -> RESOLVED
        if (old_status, new_status) not in [
            (ComplaintStatus.ASSIGNED, ComplaintStatus.IN_PROGRESS),
            (ComplaintStatus.IN_PROGRESS, ComplaintStatus.RESOLUTION_SUBMITTED),
            (ComplaintStatus.IN_PROGRESS, ComplaintStatus.RESOLVED),
        ]:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Workers cannot transition from {old_status} to {new_status}",
            )

    elif user_role == UserRole.ZONAL_ADMIN:
        # Zonal admin can only touch complaints in their assigned district
        if user_district and complaint_district and user_district.lower() != complaint_district.lower():
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"This complaint belongs to {complaint_district}, outside your district ({user_district})",
            )
        # Cannot assign without a worker id
        if new_status == ComplaintStatus.ASSIGNED and not assigned_worker_id:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Worker ID is required when setting status to ASSIGNED",
            )

    elif user_role == UserRole.CITIZEN:
        # Citizens can only confirm resolution (VERIFIED) or reopen (REOPENED) on their own complaint
        owner_id = str(complaint.get("citizenId") or "")
        if owner_id != user_id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="You can only verify or reopen your own complaints",
            )
        if old_status != ComplaintStatus.RESOLVED or new_status not in [
            ComplaintStatus.VERIFIED,
            ComplaintStatus.REOPENED,
        ]:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Citizens can only transition from RESOLVED to VERIFIED or REOPENED",
            )

    elif user_role == UserRole.SUPER_ADMIN:
        # Super admin can perform any valid transition
        pass

    # 3. Prepare update fields
    now = datetime.now(timezone.utc)
    history_entry = {
        "from_status": old_status,
        "to_status": new_status,
        "changed_by": ObjectId(user_id) if ObjectId.is_valid(user_id) else user_id,
        "changed_by_role": user_role,
        "changed_by_name": user_name,
        "changed_at": now,
        "comment": comment or f"Status changed to {new_status}",
        "evidence": evidence,
    }

    update_doc: Dict[str, Any] = {
        "status": new_status,
        "updatedAt": now,
    }

    if new_status == ComplaintStatus.ASSIGNED:
        update_doc["assignedAt"] = now
        if assigned_worker_id:
            update_doc["assignedWorkerId"] = ObjectId(assigned_worker_id) if ObjectId.is_valid(assigned_worker_id) else assigned_worker_id
        if assigned_worker_name:
            update_doc["assignedWorkerName"] = assigned_worker_name

    elif new_status == ComplaintStatus.IN_PROGRESS:
        update_doc["startedAt"] = now

    elif new_status == ComplaintStatus.RESOLUTION_SUBMITTED:
        update_doc["resolutionSubmittedAt"] = now
        if evidence:
            update_doc["resolutionEvidence"] = evidence

    elif new_status == ComplaintStatus.RESOLVED:
        update_doc["resolvedAt"] = now
        if evidence:
            update_doc["resolutionEvidence"] = evidence
        if user_role in (UserRole.ZONAL_ADMIN, UserRole.SUPER_ADMIN):
            update_doc["districtVerifiedAt"] = now
            update_doc["districtVerifiedBy"] = user_name

    elif new_status == ComplaintStatus.VERIFIED:
        update_doc["verifiedAt"] = now

    elif new_status == ComplaintStatus.CLOSED:
        update_doc["closedAt"] = now

    elif new_status == ComplaintStatus.ESCALATED:
        update_doc["escalatedAt"] = now
        update_doc["isEscalated"] = True
        update_doc["escalationReason"] = comment or "SLA Breached / Manual Escalation"

    # Push to status_history and legacy timeline for seamless backwards compatibility
    legacy_timeline_entry = {
        "status": new_status,
        "timestamp": now,
        "note": comment or f"Status updated to {new_status} by {user_name} ({user_role})",
    }

    result = await db.complaints.find_one_and_update(
        {"_id": c_oid},
        {
            "$set": update_doc,
            "$push": {
                "status_history": history_entry,
                "timeline": legacy_timeline_entry,
            },
        },
        return_document=True,
    )

    formatted_result = format_complaint_dict(result)

    # 4. Trigger citizen notification and WebSocket live broadcast
    try:
        from .notification_service import create_notification
        from ..routers.websocket import manager

        citizen_id = complaint.get("citizenId")
        if citizen_id:
            notif_msg = f"Your complaint #{complaint.get('complaintId', '')} is now {new_status}."
            if comment:
                notif_msg += f" Note: {comment}"
            await create_notification(
                user_id=str(citizen_id),
                title=f"Complaint #{complaint.get('complaintId', '')} Updated",
                message=notif_msg,
                type="STATUS_UPDATE",
                complaint_id=str(c_oid),
            )
            await manager.send_personal_message(
                {
                    "type": "NOTIFICATION",
                    "title": f"Complaint #{complaint.get('complaintId', '')} Updated",
                    "message": notif_msg,
                },
                str(citizen_id),
            )

        # Broadcast event across global websocket clients
        await manager.broadcast({
            "type": "COMPLAINT_STATUS_CHANGED",
            "complaintId": complaint.get("complaintId"),
            "status": new_status,
            "district_id": complaint.get("district_id"),
        })
    except Exception as e:
        # Non-blocking notification failure
        pass

    # 5. Trigger ETA recalculation when complaint is assigned or reassigned
    if new_status in (ComplaintStatus.ASSIGNED, ComplaintStatus.IN_PROGRESS):
        try:
            from .eta_service import update_complaint_eta
            await update_complaint_eta(str(c_oid))
        except Exception:
            pass  # Non-blocking

    return formatted_result
