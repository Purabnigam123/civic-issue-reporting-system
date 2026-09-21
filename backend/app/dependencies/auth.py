from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from jose import jwt, JWTError
from bson import ObjectId
from typing import List, Optional, Callable

from ..config.env import env
from ..config.db import get_db

security = HTTPBearer(auto_error=False)


async def get_current_user_optional(credentials: HTTPAuthorizationCredentials | None = Depends(security)):
    if not credentials:
        return None

    token = credentials.credentials
    try:
        payload = jwt.decode(token, env.JWT_SECRET, algorithms=["HS256"])
        user_id = payload.get("id")
        if not user_id:
            return None
    except JWTError:
        return None

    db = get_db()
    user = await db.users.find_one({"_id": ObjectId(user_id)})
    if not user:
        return None

    user["_id"] = str(user["_id"])
    return user


async def get_current_user(credentials: HTTPAuthorizationCredentials | None = Depends(security)):
    user = await get_current_user_optional(credentials)
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authentication required."
        )
    return user


def require_role(*allowed_roles: str) -> Callable:
    """
    Factory that returns a FastAPI dependency enforcing role-based access.
    Usage:
        @router.get("/admin/dashboard", dependencies=[Depends(require_role("SUPER_ADMIN"))])
    Or as a parameter:
        user: dict = Depends(require_role("SUPER_ADMIN", "ZONAL_ADMIN"))
    """
    async def role_checker(user: dict = Depends(get_current_user)) -> dict:
        user_role = user.get("role", "CITIZEN")
        # Handle both enum objects and raw strings
        if hasattr(user_role, "value"):
            user_role = user_role.value
        user_role = str(user_role).upper()

        allowed = [str(r).upper() for r in allowed_roles]
        if user_role not in allowed:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Access denied. Required role(s): {', '.join(allowed)}. Your role: {user_role}."
            )

        # Additional check: banned/restricted users
        if user.get("status") == "banned":
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Your account has been suspended. Contact administration."
            )

        return user
    return role_checker


# ── Convenience dependencies ──────────────────────────────────────────

require_super_admin = require_role("SUPER_ADMIN")
require_zonal_admin = require_role("ZONAL_ADMIN")
require_worker = require_role("WORKER")
require_admin_or_zonal = require_role("SUPER_ADMIN", "ZONAL_ADMIN")
require_any_staff = require_role("SUPER_ADMIN", "ZONAL_ADMIN", "WORKER")


async def get_zonal_admin_with_district(user: dict = Depends(require_zonal_admin)) -> dict:
    """
    Returns the zonal admin user with verified district_id.
    Raises 403 if the admin has no district assigned.
    """
    district_id = user.get("district_id")
    if not district_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Zonal admin account has no district assigned. Contact Super Admin."
        )
    return user
