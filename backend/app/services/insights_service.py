"""
AI Civic Command Center — Intelligence Service.

Generates actionable intelligence from actual database data:
- Critical complaints requiring immediate attention
- SLA warnings (at-risk and breached)
- Worker overload detection
- Zone anomalies (spike detection)
- System-wide KPIs

All insights are derived from real MongoDB queries. No fabricated data.
"""

from datetime import datetime, timedelta, timezone
from typing import Dict, Any, List
from bson import ObjectId

from ..database.mongodb import get_database
from ..models.complaint import ComplaintStatus, SLAStatus
from ..models.user import UserRole
from ..models.district import DELHI_DISTRICTS


async def get_command_center_insights() -> Dict[str, Any]:
    """
    Generate a comprehensive intelligence snapshot for the admin command center.
    """
    db = get_database()
    now = datetime.now(timezone.utc)
    last_24h = now - timedelta(hours=24)
    last_7d = now - timedelta(days=7)

    insights: List[Dict[str, Any]] = []
    alerts: List[Dict[str, Any]] = []

    # ── 1. Critical / Escalated complaints ────────────────────────
    critical_count = await db.complaints.count_documents({
        "priority": "CRITICAL",
        "status": {"$nin": [
            ComplaintStatus.RESOLVED.value,
            ComplaintStatus.VERIFIED.value,
            ComplaintStatus.REJECTED.value,
            ComplaintStatus.CLOSED.value,
        ]},
    })
    escalated_count = await db.complaints.count_documents({
        "status": ComplaintStatus.ESCALATED.value,
    })

    if critical_count > 0:
        alerts.append({
            "type": "CRITICAL_COMPLAINTS",
            "severity": "high",
            "title": f"{critical_count} Critical Complaint{'s' if critical_count != 1 else ''} Pending",
            "message": f"There {'are' if critical_count != 1 else 'is'} {critical_count} critical-priority complaint{'s' if critical_count != 1 else ''} requiring immediate attention.",
            "count": critical_count,
            "action": "Review critical complaints immediately",
        })

    if escalated_count > 0:
        alerts.append({
            "type": "ESCALATED_COMPLAINTS",
            "severity": "high",
            "title": f"{escalated_count} Escalated Complaint{'s' if escalated_count != 1 else ''}",
            "message": f"{escalated_count} complaint{'s have' if escalated_count != 1 else ' has'} been escalated due to SLA breaches or manual escalation.",
            "count": escalated_count,
            "action": "Assign or resolve escalated complaints",
        })

    # ── 2. SLA warnings ──────────────────────────────────────────
    sla_at_risk = await db.complaints.count_documents({
        "slaStatus": SLAStatus.AT_RISK.value,
        "status": {"$nin": [
            ComplaintStatus.RESOLVED.value,
            ComplaintStatus.VERIFIED.value,
            ComplaintStatus.REJECTED.value,
        ]},
    })
    sla_breached = await db.complaints.count_documents({
        "slaStatus": SLAStatus.BREACHED.value,
        "status": {"$nin": [
            ComplaintStatus.RESOLVED.value,
            ComplaintStatus.VERIFIED.value,
            ComplaintStatus.REJECTED.value,
        ]},
    })

    if sla_at_risk > 0:
        alerts.append({
            "type": "SLA_AT_RISK",
            "severity": "medium",
            "title": f"{sla_at_risk} Complaint{'s' if sla_at_risk != 1 else ''} At SLA Risk",
            "message": f"{sla_at_risk} complaint{'s are' if sla_at_risk != 1 else ' is'} approaching SLA deadline.",
            "count": sla_at_risk,
            "action": "Prioritize at-risk complaints for immediate action",
        })

    if sla_breached > 0:
        alerts.append({
            "type": "SLA_BREACHED",
            "severity": "high",
            "title": f"{sla_breached} SLA Breach{'es' if sla_breached != 1 else ''}",
            "message": f"{sla_breached} complaint{'s have' if sla_breached != 1 else ' has'} exceeded resolution deadline.",
            "count": sla_breached,
            "action": "Escalate or reassign breached complaints",
        })

    # ── 3. Worker overload detection ──────────────────────────────
    overloaded_workers = []
    workers = await db.users.find({
        "role": UserRole.WORKER.value,
        "status": {"$ne": "BANNED"},
    }).to_list(None)

    total_available = 0
    total_off_duty = 0

    for w in workers:
        w_id = w.get("_id")
        max_active = int(w.get("max_active_complaints", 5))
        active = await db.complaints.count_documents({
            "assignedWorkerId": w_id,
            "status": {"$in": [ComplaintStatus.ASSIGNED.value, ComplaintStatus.IN_PROGRESS.value]},
        })

        availability = w.get("availability_status", "AVAILABLE")
        if availability in ("AVAILABLE", None):
            total_available += 1
        else:
            total_off_duty += 1

        if active >= max_active:
            overloaded_workers.append({
                "worker_id": str(w_id),
                "name": w.get("name", "Worker"),
                "worker_tag": w.get("worker_id", ""),
                "district_id": w.get("district_id"),
                "active_tasks": active,
                "max_tasks": max_active,
            })

    if overloaded_workers:
        alerts.append({
            "type": "WORKER_OVERLOAD",
            "severity": "medium",
            "title": f"{len(overloaded_workers)} Overloaded Worker{'s' if len(overloaded_workers) != 1 else ''}",
            "message": f"{len(overloaded_workers)} worker{'s are' if len(overloaded_workers) != 1 else ' is'} at maximum task capacity.",
            "count": len(overloaded_workers),
            "workers": overloaded_workers[:5],
            "action": "Consider redistributing workload or activating additional workers",
        })

    # ── 4. District anomaly detection (24h spike) ────────────────
    district_anomalies = []
    for district in DELHI_DISTRICTS:
        d_id = district["id"]
        last_24h_count = await db.complaints.count_documents({
            "district_id": d_id,
            "createdAt": {"$gte": last_24h},
        })
        prev_24h_count = await db.complaints.count_documents({
            "district_id": d_id,
            "createdAt": {"$gte": last_24h - timedelta(hours=24), "$lt": last_24h},
        })

        if prev_24h_count > 0 and last_24h_count > prev_24h_count * 2 and last_24h_count >= 3:
            district_anomalies.append({
                "district_id": d_id,
                "district_name": district["name"],
                "current_24h": last_24h_count,
                "previous_24h": prev_24h_count,
                "spike_percentage": round(((last_24h_count - prev_24h_count) / prev_24h_count) * 100, 1),
            })

    if district_anomalies:
        alerts.append({
            "type": "DISTRICT_SPIKE",
            "severity": "medium",
            "title": f"Complaint Spike in {len(district_anomalies)} District{'s' if len(district_anomalies) != 1 else ''}",
            "message": f"Unusual increase in complaints detected in {', '.join(d['district_name'] for d in district_anomalies[:3])}.",
            "districts": district_anomalies,
            "action": "Investigate root cause and allocate additional resources",
        })

    # ── 5. Unassigned complaints backlog ─────────────────────────
    unassigned = await db.complaints.count_documents({
        "status": ComplaintStatus.SUBMITTED.value,
    })
    if unassigned > 5:
        alerts.append({
            "type": "UNASSIGNED_BACKLOG",
            "severity": "medium" if unassigned < 20 else "high",
            "title": f"{unassigned} Unassigned Complaints",
            "message": f"{unassigned} complaint{'s are' if unassigned != 1 else ' is'} awaiting assignment to field workers.",
            "count": unassigned,
            "action": "Review and assign pending complaints to available workers",
        })

    # ── 6. System KPIs ───────────────────────────────────────────
    total_complaints = await db.complaints.count_documents({})
    total_resolved = await db.complaints.count_documents({
        "status": {"$in": [ComplaintStatus.RESOLVED.value, ComplaintStatus.VERIFIED.value]},
    })
    new_today = await db.complaints.count_documents({
        "createdAt": {"$gte": now.replace(hour=0, minute=0, second=0, microsecond=0)},
    })
    resolved_today = await db.complaints.count_documents({
        "resolvedAt": {"$gte": now.replace(hour=0, minute=0, second=0, microsecond=0)},
    })
    total_users = await db.users.count_documents({})
    suspicious_pending = await db.complaints.count_documents({
        "isSuspicious": True,
        "status": {"$ne": ComplaintStatus.REJECTED.value},
    })

    kpis = {
        "total_complaints": total_complaints,
        "total_resolved": total_resolved,
        "resolution_rate": round((total_resolved / max(total_complaints, 1)) * 100, 1),
        "new_today": new_today,
        "resolved_today": resolved_today,
        "total_users": total_users,
        "total_workers": len(workers),
        "available_workers": total_available,
        "off_duty_workers": total_off_duty,
        "overloaded_workers": len(overloaded_workers),
        "unassigned_complaints": unassigned,
        "critical_pending": critical_count,
        "escalated_pending": escalated_count,
        "sla_at_risk": sla_at_risk,
        "sla_breached": sla_breached,
        "suspicious_pending": suspicious_pending,
    }

    # Sort alerts by severity
    severity_order = {"high": 0, "medium": 1, "low": 2}
    alerts.sort(key=lambda a: severity_order.get(a.get("severity", "low"), 2))

    return {
        "alerts": alerts,
        "kpis": kpis,
        "generated_at": now.isoformat(),
        "total_alerts": len(alerts),
    }
