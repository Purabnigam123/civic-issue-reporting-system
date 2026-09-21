"""
Audit Log Service: records municipal system events and admin actions.
"""

from datetime import datetime, timezone
from typing import Optional, Dict, Any, List
from bson import ObjectId

from ..database.mongodb import get_database


async def log_audit_event(
    action: str,
    actor_id: Optional[str],
    actor_role: str,
    actor_name: str,
    target_type: str,  # "complaint", "user", "worker", "district", "system"
    target_id: Optional[str] = None,
    details: Optional[Dict[str, Any]] = None,
    ip_address: Optional[str] = None,
) -> Dict[str, Any]:
    """Record an audit log entry in MongoDB `audit_logs` collection."""
    db = get_database()
    now = datetime.now(timezone.utc)

    log_entry = {
        "action": action,
        "actor_id": ObjectId(actor_id) if actor_id and ObjectId.is_valid(actor_id) else actor_id,
        "actor_role": actor_role,
        "actor_name": actor_name,
        "target_type": target_type,
        "target_id": target_id,
        "details": details or {},
        "ip_address": ip_address,
        "created_at": now,
    }

    result = await db.audit_logs.insert_one(log_entry)
    log_entry["_id"] = str(result.inserted_id)
    log_entry["id"] = log_entry["_id"]
    if isinstance(log_entry.get("actor_id"), ObjectId):
        log_entry["actor_id"] = str(log_entry["actor_id"])
    log_entry["created_at"] = now.isoformat()
    return log_entry


async def get_audit_logs(
    limit: int = 50,
    skip: int = 0,
    action: Optional[str] = None,
    target_type: Optional[str] = None,
) -> List[Dict[str, Any]]:
    """Retrieve recent audit logs with pagination."""
    db = get_database()
    query = {}
    if action:
        query["action"] = action
    if target_type:
        query["target_type"] = target_type

    cursor = db.audit_logs.find(query).sort("created_at", -1).skip(skip).limit(limit)
    raw_logs = await cursor.to_list(None)

    formatted = []
    for log in raw_logs:
        f = dict(log)
        f["id"] = str(f["_id"])
        f["_id"] = str(f["_id"])
        if isinstance(f.get("actor_id"), ObjectId):
            f["actor_id"] = str(f["actor_id"])
        if isinstance(f.get("created_at"), datetime):
            f["created_at"] = f["created_at"].isoformat()
        formatted.append(f)

    return formatted
