from typing import Dict, Tuple, Optional
from datetime import datetime, timedelta, timezone
from ..models.complaint import ComplaintCategory, ComplaintPriority, SLAStatus, ComplaintStatus

# Map categories to responsible departments
CATEGORY_TO_DEPARTMENT: Dict[ComplaintCategory, str] = {
    ComplaintCategory.POTHOLE: "Roads Department",
    ComplaintCategory.BROKEN_STREETLIGHT: "Electrical Department",
    ComplaintCategory.GARBAGE: "Sanitation Department",
    ComplaintCategory.DRAINAGE: "Drainage Department",
    ComplaintCategory.WATER_ISSUE: "Water Supply Department",
    ComplaintCategory.PUBLIC_PROPERTY: "Public Works Department",
    ComplaintCategory.ROAD_DAMAGE: "Roads Department",
    ComplaintCategory.OTHER: "General Administration",
}

# Map categories to default priority
CATEGORY_TO_PRIORITY: Dict[ComplaintCategory, ComplaintPriority] = {
    ComplaintCategory.POTHOLE: ComplaintPriority.MEDIUM,
    ComplaintCategory.BROKEN_STREETLIGHT: ComplaintPriority.MEDIUM,
    ComplaintCategory.GARBAGE: ComplaintPriority.LOW,
    ComplaintCategory.DRAINAGE: ComplaintPriority.HIGH,
    ComplaintCategory.WATER_ISSUE: ComplaintPriority.HIGH,
    ComplaintCategory.PUBLIC_PROPERTY: ComplaintPriority.MEDIUM,
    ComplaintCategory.ROAD_DAMAGE: ComplaintPriority.MEDIUM,
    ComplaintCategory.OTHER: ComplaintPriority.LOW,
}

# SLA resolution targets in hours by category severity
CATEGORY_TO_SLA_HOURS: Dict[ComplaintCategory, int] = {
    ComplaintCategory.WATER_ISSUE: 6,       # 6 hours (Urgent water leak)
    ComplaintCategory.DRAINAGE: 12,        # 12 hours (Sewage/drain block)
    ComplaintCategory.BROKEN_STREETLIGHT: 24, # 24 hours (Safety)
    ComplaintCategory.GARBAGE: 24,         # 24 hours (Sanitation)
    ComplaintCategory.POTHOLE: 48,         # 48 hours (Road safety)
    ComplaintCategory.ROAD_DAMAGE: 72,     # 72 hours
    ComplaintCategory.PUBLIC_PROPERTY: 72, # 72 hours
    ComplaintCategory.OTHER: 96,           # 96 hours
}

# Category display info
CATEGORY_INFO: Dict[ComplaintCategory, Dict[str, str]] = {
    ComplaintCategory.POTHOLE: {
        "name": "Pothole",
        "description": "Road damage and potholes",
    },
    ComplaintCategory.BROKEN_STREETLIGHT: {
        "name": "Broken Streetlight",
        "description": "Streetlights that are damaged or not working",
    },
    ComplaintCategory.GARBAGE: {
        "name": "Garbage / Waste",
        "description": "Overflowing or uncollected waste",
    },
    ComplaintCategory.DRAINAGE: {
        "name": "Drainage",
        "description": "Blocked or damaged drainage",
    },
    ComplaintCategory.WATER_ISSUE: {
        "name": "Water Issue",
        "description": "Water leakage or public water problems",
    },
    ComplaintCategory.PUBLIC_PROPERTY: {
        "name": "Damaged Public Property",
        "description": "Damaged public infrastructure",
    },
    ComplaintCategory.ROAD_DAMAGE: {
        "name": "Road Damage",
        "description": "Road surface damage other than potholes",
    },
    ComplaintCategory.OTHER: {
        "name": "Other",
        "description": "Other civic issues",
    },
}


def get_department(category: ComplaintCategory) -> str:
    """Get assigned department name for given category."""
    return CATEGORY_TO_DEPARTMENT.get(category, "General Administration")


def get_priority(category: ComplaintCategory) -> ComplaintPriority:
    """Get default priority for given category."""
    return CATEGORY_TO_PRIORITY.get(category, ComplaintPriority.MEDIUM)


def calculate_sla(category: ComplaintCategory, created_at: Optional[datetime] = None) -> Tuple[int, datetime]:
    """
    Calculate SLA hours and deadline timestamp based on category severity.
    """
    if created_at is None:
        created_at = datetime.now(timezone.utc)
    elif created_at.tzinfo is None:
        created_at = created_at.replace(tzinfo=timezone.utc)

    hours = CATEGORY_TO_SLA_HOURS.get(category, 48)
    deadline = created_at + timedelta(hours=hours)
    return hours, deadline


def get_sla_status(complaint: dict, now: Optional[datetime] = None) -> str:
    """
    Dynamically compute current SLA status:
    - If resolved: RESOLVED_ON_TIME or RESOLVED_LATE
    - If open: ON_TRACK, AT_RISK (< 25% remaining), or BREACHED (deadline exceeded)
    """
    if now is None:
        now = datetime.now(timezone.utc)
    elif now.tzinfo is None:
        now = now.replace(tzinfo=timezone.utc)

    status = complaint.get("status")
    deadline = complaint.get("slaDeadline")
    resolved_at = complaint.get("resolvedAt")
    created_at = complaint.get("createdAt")

    if isinstance(deadline, str):
        try:
            deadline = datetime.fromisoformat(deadline)
        except Exception:
            deadline = None

    if deadline and deadline.tzinfo is None:
        deadline = deadline.replace(tzinfo=timezone.utc)

    if isinstance(resolved_at, str):
        try:
            resolved_at = datetime.fromisoformat(resolved_at)
        except Exception:
            resolved_at = None

    if resolved_at and resolved_at.tzinfo is None:
        resolved_at = resolved_at.replace(tzinfo=timezone.utc)

    if isinstance(created_at, str):
        try:
            created_at = datetime.fromisoformat(created_at)
        except Exception:
            created_at = None

    if created_at and created_at.tzinfo is None:
        created_at = created_at.replace(tzinfo=timezone.utc)

    # If already resolved
    if status == ComplaintStatus.RESOLVED.value:
        if deadline and resolved_at:
            return SLAStatus.RESOLVED_ON_TIME.value if resolved_at <= deadline else SLAStatus.RESOLVED_LATE.value
        return SLAStatus.RESOLVED_ON_TIME.value

    # If open and no deadline
    if not deadline or not created_at:
        return SLAStatus.ON_TRACK.value

    # Check if breached
    if now > deadline:
        return SLAStatus.BREACHED.value

    # Check if at risk (< 25% time remaining)
    total_duration = (deadline - created_at).total_seconds()
    remaining = (deadline - now).total_seconds()
    if total_duration > 0 and (remaining / total_duration) <= 0.25:
        return SLAStatus.AT_RISK.value

    return SLAStatus.ON_TRACK.value


def get_priority_with_ai(category: ComplaintCategory, ai_confidence: Optional[float] = None, upvotes: int = 0) -> ComplaintPriority:
    """
    Compute dynamic priority taking into account default category priority, AI confidence/severity, and citizen upvotes.
    """
    base_priority = CATEGORY_TO_PRIORITY.get(category, ComplaintPriority.MEDIUM)
    
    priority_order = [ComplaintPriority.LOW, ComplaintPriority.MEDIUM, ComplaintPriority.HIGH, ComplaintPriority.CRITICAL]
    current_index = priority_order.index(base_priority) if base_priority in priority_order else 1
    
    # Upgrade if AI confidence is high
    if ai_confidence is not None and ai_confidence >= 0.85:
        current_index = max(current_index, 2)  # At least HIGH
    
    # Upgrade if upvotes are substantial
    if upvotes >= 25:
        current_index = 3  # CRITICAL
    elif upvotes >= 10:
        current_index = max(current_index, 2)  # HIGH
    elif upvotes >= 5:
        current_index = max(current_index, 1)  # At least MEDIUM
        
    return priority_order[current_index]

