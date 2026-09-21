"""
Notification Router: fetch and mark notifications as read.
"""

from fastapi import APIRouter, Depends, HTTPException
from bson import ObjectId
from datetime import datetime, timezone

from ..database.mongodb import get_database
from ..dependencies.auth import get_current_user
from ..services.notification_service import get_user_notifications

router = APIRouter(prefix="/api/notifications", tags=["Notifications"])


@router.get("")
@router.get("/")
async def list_notifications(user: dict = Depends(get_current_user)):
    user_id = str(user.get("_id") or user.get("id"))
    notifications = await get_user_notifications(user_id)
    unread_count = sum(1 for n in notifications if not n.get("isRead"))
    return {
        "success": True,
        "unread_count": unread_count,
        "notifications": notifications,
    }


@router.put("/{notif_id}/read")
async def mark_read(notif_id: str, user: dict = Depends(get_current_user)):
    db = get_database()
    n_filter = {"_id": ObjectId(notif_id)} if ObjectId.is_valid(notif_id) else {"_id": notif_id}
    await db.notifications.update_one(n_filter, {"$set": {"isRead": True}})
    return {"success": True, "message": "Notification marked as read"}


@router.put("/read-all")
async def mark_all_read(user: dict = Depends(get_current_user)):
    db = get_database()
    user_id = user.get("_id") or user.get("id")
    u_filter = ObjectId(user_id) if ObjectId.is_valid(user_id) else user_id
    await db.notifications.update_many({"userId": u_filter}, {"$set": {"isRead": True}})
    return {"success": True, "message": "All notifications marked as read"}
