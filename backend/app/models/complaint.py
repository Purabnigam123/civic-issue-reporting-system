from enum import Enum
from typing import Optional, List, Dict, Any
from datetime import datetime, timezone
from bson import ObjectId


class ComplaintStatus(str, Enum):
    SUBMITTED = "SUBMITTED"
    UNDER_REVIEW = "UNDER_REVIEW"
    ASSIGNED = "ASSIGNED"
    IN_PROGRESS = "IN_PROGRESS"
    RESOLUTION_SUBMITTED = "RESOLUTION_SUBMITTED"
    RESOLVED = "RESOLVED"
    VERIFIED = "VERIFIED"
    REJECTED = "REJECTED"
    ESCALATED = "ESCALATED"
    REOPENED = "REOPENED"
    CLOSED = "CLOSED"


class ComplaintCategory(str, Enum):
    POTHOLE = "pothole"
    BROKEN_STREETLIGHT = "broken_streetlight"
    GARBAGE = "garbage"
    DRAINAGE = "drainage"
    WATER_ISSUE = "water_issue"
    PUBLIC_PROPERTY = "public_property"
    ROAD_DAMAGE = "road_damage"
    OTHER = "other"


class ComplaintPriority(str, Enum):
    LOW = "LOW"
    MEDIUM = "MEDIUM"
    HIGH = "HIGH"
    CRITICAL = "CRITICAL"


class SLAStatus(str, Enum):
    ON_TRACK = "ON_TRACK"
    AT_RISK = "AT_RISK"
    BREACHED = "BREACHED"
    RESOLVED_ON_TIME = "RESOLVED_ON_TIME"
    RESOLVED_LATE = "RESOLVED_LATE"


SLA_HOURS_BY_PRIORITY = {
    ComplaintPriority.CRITICAL: 12,
    ComplaintPriority.HIGH: 24,
    ComplaintPriority.MEDIUM: 48,
    ComplaintPriority.LOW: 72,
}


VALID_TRANSITIONS: Dict[ComplaintStatus, List[ComplaintStatus]] = {
    ComplaintStatus.SUBMITTED: [
        ComplaintStatus.ASSIGNED,
        ComplaintStatus.REJECTED,
        ComplaintStatus.ESCALATED,
        ComplaintStatus.UNDER_REVIEW,
    ],
    ComplaintStatus.UNDER_REVIEW: [
        ComplaintStatus.ASSIGNED,
        ComplaintStatus.REJECTED,
        ComplaintStatus.ESCALATED,
    ],
    ComplaintStatus.ASSIGNED: [
        ComplaintStatus.IN_PROGRESS,
        ComplaintStatus.ASSIGNED,  # Reassignment to another worker
        ComplaintStatus.ESCALATED,
        ComplaintStatus.REJECTED,
    ],
    ComplaintStatus.IN_PROGRESS: [
        ComplaintStatus.RESOLUTION_SUBMITTED,
        ComplaintStatus.RESOLVED,
        ComplaintStatus.ESCALATED,
    ],
    ComplaintStatus.RESOLUTION_SUBMITTED: [
        ComplaintStatus.RESOLVED,
        ComplaintStatus.IN_PROGRESS,
        ComplaintStatus.REJECTED,
        ComplaintStatus.ESCALATED,
    ],
    ComplaintStatus.RESOLVED: [
        ComplaintStatus.VERIFIED,
        ComplaintStatus.REOPENED,
    ],
    ComplaintStatus.REOPENED: [
        ComplaintStatus.ASSIGNED,
        ComplaintStatus.ESCALATED,
    ],
    ComplaintStatus.ESCALATED: [
        ComplaintStatus.ASSIGNED,
        ComplaintStatus.IN_PROGRESS,
        ComplaintStatus.REJECTED,
        ComplaintStatus.RESOLVED,
    ],
    ComplaintStatus.VERIFIED: [
        ComplaintStatus.CLOSED,  # Post-verification administrative closure
    ],
    ComplaintStatus.CLOSED: [],  # Terminal state
    ComplaintStatus.REJECTED: [
        ComplaintStatus.SUBMITTED,  # Super Admin can reopen / unreject
    ],
}


def format_complaint_dict(doc: Dict[str, Any]) -> Dict[str, Any]:
    """Format MongoDB complaint document for API JSON responses."""
    if not doc:
        return {}

    formatted = dict(doc)
    doc_id = str(formatted.get("_id"))
    formatted["id"] = doc_id
    formatted["_id"] = doc_id

    if "citizenId" in formatted and formatted["citizenId"] is not None:
        formatted["citizenId"] = str(formatted["citizenId"])

    if "assignedWorkerId" in formatted and formatted["assignedWorkerId"] is not None:
        formatted["assignedWorkerId"] = str(formatted["assignedWorkerId"])

    if "masterIncidentId" in formatted and formatted["masterIncidentId"] is not None:
        formatted["masterIncidentId"] = str(formatted["masterIncidentId"])

    if "createdAt" in formatted and isinstance(formatted["createdAt"], datetime):
        formatted["createdAt"] = formatted["createdAt"].isoformat()

    if "updatedAt" in formatted and isinstance(formatted["updatedAt"], datetime):
        formatted["updatedAt"] = formatted["updatedAt"].isoformat()

    if "slaDeadline" in formatted and isinstance(formatted["slaDeadline"], datetime):
        formatted["slaDeadline"] = formatted["slaDeadline"].isoformat()

    if "targetResolutionDate" in formatted and isinstance(formatted["targetResolutionDate"], datetime):
        formatted["targetResolutionDate"] = formatted["targetResolutionDate"].isoformat()

    if "resolutionSubmittedAt" in formatted and isinstance(formatted["resolutionSubmittedAt"], datetime):
        formatted["resolutionSubmittedAt"] = formatted["resolutionSubmittedAt"].isoformat()

    if "assignedAt" in formatted and isinstance(formatted["assignedAt"], datetime):
        formatted["assignedAt"] = formatted["assignedAt"].isoformat()

    if "startedAt" in formatted and isinstance(formatted["startedAt"], datetime):
        formatted["startedAt"] = formatted["startedAt"].isoformat()

    if "resolvedAt" in formatted and isinstance(formatted["resolvedAt"], datetime):
        formatted["resolvedAt"] = formatted["resolvedAt"].isoformat()

    if "verifiedAt" in formatted and isinstance(formatted["verifiedAt"], datetime):
        formatted["verifiedAt"] = formatted["verifiedAt"].isoformat()

    if "escalatedAt" in formatted and isinstance(formatted["escalatedAt"], datetime):
        formatted["escalatedAt"] = formatted["escalatedAt"].isoformat()

    if "closedAt" in formatted and isinstance(formatted["closedAt"], datetime):
        formatted["closedAt"] = formatted["closedAt"].isoformat()

    if "eta_updated_at" in formatted and isinstance(formatted["eta_updated_at"], datetime):
        formatted["eta_updated_at"] = formatted["eta_updated_at"].isoformat()

    if "estimated_resolution_at" in formatted and isinstance(formatted["estimated_resolution_at"], datetime):
        formatted["estimated_resolution_at"] = formatted["estimated_resolution_at"].isoformat()

    if "priority_calculated_at" in formatted and isinstance(formatted["priority_calculated_at"], datetime):
        formatted["priority_calculated_at"] = formatted["priority_calculated_at"].isoformat()

    if "rated_at" in formatted and isinstance(formatted["rated_at"], datetime):
        formatted["rated_at"] = formatted["rated_at"].isoformat()

    # Format dates in status_history
    if "status_history" in formatted and isinstance(formatted["status_history"], list):
        for entry in formatted["status_history"]:
            if "changed_at" in entry and isinstance(entry["changed_at"], datetime):
                entry["changed_at"] = entry["changed_at"].isoformat()
            if "changed_by" in entry and isinstance(entry["changed_by"], ObjectId):
                entry["changed_by"] = str(entry["changed_by"])

    # Format dates in legacy timeline
    if "timeline" in formatted and isinstance(formatted["timeline"], list):
        for entry in formatted["timeline"]:
            if "timestamp" in entry and isinstance(entry["timestamp"], datetime):
                entry["timestamp"] = entry["timestamp"].isoformat()

    # Format dates in relatedReports
    if "relatedReports" in formatted and isinstance(formatted["relatedReports"], list):
        for report in formatted["relatedReports"]:
            if "createdAt" in report and isinstance(report["createdAt"], datetime):
                report["createdAt"] = report["createdAt"].isoformat()

    return formatted
