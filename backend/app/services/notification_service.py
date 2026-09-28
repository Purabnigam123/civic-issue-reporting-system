"""
Notification Service: creates and queries user notifications.
"""

from datetime import datetime, timezone
from typing import Dict, Any, List, Optional
from bson import ObjectId

from ..database.mongodb import get_database
from ..routers.websocket import manager


async def create_notification(
    user_id: str,
    title: str,
    message: str,
    type: str = "STATUS_UPDATE",
    complaint_id: Optional[str] = None,
    data: Optional[Dict[str, Any]] = None,
    broadcast_role: Optional[str] = None,
) -> Dict[str, Any]:
    db = get_database()
    now = datetime.now(timezone.utc)

    doc = {
        "userId": ObjectId(user_id) if ObjectId.is_valid(user_id) else user_id,
        "title": title,
        "message": message,
        "type": type,
        "complaintId": complaint_id,
        "data": data or {},
        "isRead": False,
        "createdAt": now,
    }

    result = await db.notifications.insert_one(doc)
    doc["_id"] = str(result.inserted_id)
    doc["id"] = doc["_id"]
    doc["userId"] = str(doc["userId"])
    doc["createdAt"] = now.isoformat()
    
    # Live broadcast
    payload = {
        "type": "NOTIFICATION",
        "event": "NEW_NOTIFICATION",
        "notification": doc
    }
    if broadcast_role:
        await manager.broadcast_to_role(payload, broadcast_role)
    else:
        await manager.send_personal_message(payload, user_id)
        
    return doc


async def get_user_notifications(user_id: str, limit: int = 30) -> List[Dict[str, Any]]:
    db = get_database()
    u_filter = ObjectId(user_id) if ObjectId.is_valid(user_id) else user_id

    cursor = db.notifications.find({"userId": u_filter}).sort("createdAt", -1).limit(limit)
    raw = await cursor.to_list(None)

    formatted = []
    for item in raw:
        f = dict(item)
        f["id"] = str(f["_id"])
        f["_id"] = str(f["_id"])
        f["userId"] = str(f["userId"])
        if isinstance(f.get("createdAt"), datetime):
            f["createdAt"] = f["createdAt"].isoformat()
        formatted.append(f)

    return formatted
