from fastapi import APIRouter, Depends, HTTPException, status
from datetime import datetime, timedelta, timezone

from ..schemas.auth import UserCreate, UserLogin
from ..models.user import hash_password, verify_password, UserRole, format_user_response
from ..dependencies.auth import get_current_user
from ..config.env import env
from ..config.db import get_db
from jose import jwt

router = APIRouter(prefix="/api/auth", tags=["Auth"])

def create_access_token(data: dict):
    payload = dict(data)
    payload["exp"] = datetime.now(timezone.utc) + timedelta(minutes=env.JWT_EXPIRES_MINUTES)
    return jwt.encode(payload, env.JWT_SECRET, algorithm="HS256")

@router.post("/register", status_code=status.HTTP_201_CREATED)
async def register(user: UserCreate):
    db = get_db()
    
    # Check if user already exists (case-insensitive)
    existing_user = await db.users.find_one({"email": user.email.lower()})
    if existing_user:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT, 
            detail="An account with this email already exists. Please sign in instead."
        )
    
    try:
        hashed_pwd = hash_password(user.password)
        user_dict = {
            "name": user.name.strip(),
            "email": user.email.lower().strip(),
            "phone": user.phone.strip(),
            "password": hashed_pwd,
            "role": UserRole.CITIZEN.value,
            "status": "active",
            "suspicious_count": 0,
            "createdAt": datetime.now(timezone.utc),
            "updatedAt": datetime.now(timezone.utc)
        }
        
        result = await db.users.insert_one(user_dict)
        user_dict["_id"] = str(result.inserted_id)
        
        token = create_access_token({"id": user_dict["_id"]})
        user_data = format_user_response(user_dict)

        return {
            "success": True,
            "message": "Registration successful. Welcome to CivicPulse!",
            "token": token,
            "user": user_data,
            "data": {
                "user": user_data,
                "token": token
            }
        }
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Registration failed. Please try again."
        )

@router.post("/login")
async def login(user_login: UserLogin):
    db = get_db()
    
    # Find user by email (case-insensitive)
    user = await db.users.find_one({"email": user_login.email.lower()})
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED, 
            detail="Invalid email or password."
        )
    
    # Verify password
    if not verify_password(user_login.password, user["password"]):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED, 
            detail="Invalid email or password."
        )

    # Check if account is banned
    if user.get("status") == "banned":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Your account has been suspended. Contact administration for assistance."
        )
    
    # Create JWT token
    user["_id"] = str(user["_id"])
    token = create_access_token({"id": user["_id"]})
    user_data = format_user_response(user)

    return {
        "success": True,
        "message": "Login successful",
        "token": token,
        "user": user_data,
        "data": {
            "user": user_data,
            "token": token
        }
    }

@router.get("/me")
async def get_me(current_user: dict = Depends(get_current_user)):
    user_data = format_user_response(current_user)
    return {
        "success": True,
        "user": user_data,
        "data": {
            "user": user_data
        }
    }
