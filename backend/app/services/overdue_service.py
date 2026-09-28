"""
Overdue & SLA Service: detects overdue complaints, updates SLA statuses, and triggers auto-escalations.
"""

from datetime import datetime, timezone
from typing import Dict, Any, List
from bson import ObjectId

from ..database.mongodb import get_database
from ..models.complaint import ComplaintStatus, SLAStatus, format_complaint_dict
from .audit_service import log_audit_event


async def check_and_escalate_overdue_complaints() -> Dict[str, Any]:
    """
    Scans open complaints where slaDeadline < now and status not in [RESOLVED, VERIFIED, REJECTED, ESCALATED].
    Marks them as ESCALATED and slaStatus = BREACHED.
    """
    db = get_database()
    now = datetime.now(timezone.utc)

    open_statuses = [
        ComplaintStatus.SUBMITTED.value,
        ComplaintStatus.UNDER_REVIEW.value,
        ComplaintStatus.ASSIGNED.value,
        ComplaintStatus.IN_PROGRESS.value,
        ComplaintStatus.RESOLUTION_SUBMITTED.value,
        ComplaintStatus.REOPENED.value,
    ]

    # Find complaints where deadline has passed
    cursor = db.complaints.find({
        "status": {"$in": open_statuses},
        "slaDeadline": {"$lte": now},
        "isEscalated": {"$ne": True},
    })

    overdue_complaints = await cursor.to_list(None)
    escalated_count = 0

    for complaint in overdue_complaints:
        c_oid = complaint["_id"]
        old_status = complaint.get("status")

        history_entry = {
            "from_status": old_status,
            "to_status": ComplaintStatus.ESCALATED.value,
            "changed_by": None,
            "changed_by_role": "SYSTEM",
            "changed_by_name": "SLA Monitor Daemon",
            "changed_at": now,
            "comment": "Auto-escalated to Super Admin: SLA resolution deadline breached.",
            "evidence": None,
        }

        legacy_timeline = {
            "status": ComplaintStatus.ESCALATED.value,
            "timestamp": now,
            "note": "Auto-escalated: SLA resolution deadline exceeded",
        }

        await db.complaints.update_one(
            {"_id": c_oid},
            {
                "$set": {
                    "status": ComplaintStatus.ESCALATED.value,
                    "slaStatus": SLAStatus.BREACHED.value,
                    "isEscalated": True,
                    "escalatedAt": now,
                    "escalationReason": "SLA Breach: Target deadline passed without resolution",
                    "updatedAt": now,
                },
                "$push": {
                    "status_history": history_entry,
                    "timeline": legacy_timeline,
                },
            },
        )

        await log_audit_event(
            action="AUTO_ESCALATE_SLA_BREACH",
            actor_id=None,
            actor_role="SYSTEM",
            actor_name="SLA Monitor Daemon",
            target_type="complaint",
            target_id=str(c_oid),
            details={
                "complaintId": complaint.get("complaintId"),
                "previous_status": old_status,
                "district_id": complaint.get("district_id"),
            },
        )
        escalated_count += 1

    return {
        "checked_at": now.isoformat(),
        "escalated_count": escalated_count,
    }
