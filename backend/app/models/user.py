import bcrypt
from enum import Enum


class UserRole(str, Enum):
    CITIZEN = "CITIZEN"
    WORKER = "WORKER"
    ZONAL_ADMIN = "ZONAL_ADMIN"
    SUPER_ADMIN = "SUPER_ADMIN"


# Mapping of role to the frontend dashboard path
ROLE_DASHBOARD = {
    UserRole.CITIZEN: "/dashboard",
    UserRole.WORKER: "/worker",
    UserRole.ZONAL_ADMIN: "/zonal",
    UserRole.SUPER_ADMIN: "/admin",
}


def hash_password(password: str) -> str:
    salt = bcrypt.gensalt()
    return bcrypt.hashpw(password.encode("utf-8"), salt).decode("utf-8")

def verify_password(plain_password: str, hashed_password: str) -> bool:
    try:
        return bcrypt.checkpw(plain_password.encode("utf-8"), hashed_password.encode("utf-8"))
    except Exception:
        return False


def format_user_response(user: dict) -> dict:
    """Format a MongoDB user document for API responses (strips password)."""
    return {
        "id": str(user.get("_id", "")),
        "name": user.get("name", ""),
        "email": user.get("email", ""),
        "phone": user.get("phone", ""),
        "role": user.get("role", UserRole.CITIZEN.value),
        "district_id": user.get("district_id"),
        "district": user.get("district"),
        "worker_id": user.get("worker_id"),
        "department": user.get("department"),
        "status": user.get("status", "active"),
        "suspicious_count": user.get("suspicious_count", 0),
    }
