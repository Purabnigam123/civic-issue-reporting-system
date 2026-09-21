import re
from pydantic import BaseModel, Field, field_validator
from typing import Optional
from ..models.user import UserRole

EMAIL_REGEX = re.compile(r"^[\w\.\+\-]+@[a-zA-Z0-9\.\-]+$")

class UserCreate(BaseModel):
    name: str = Field(..., min_length=2, max_length=100)
    email: str = Field(..., min_length=3, max_length=150)
    phone: str = Field(..., min_length=10)
    password: str = Field(..., min_length=6)

    @field_validator("email")
    @classmethod
    def validate_email(cls, v: str) -> str:
        v = v.strip().lower()
        if not EMAIL_REGEX.match(v):
            raise ValueError("Invalid email format")
        return v

class UserLogin(BaseModel):
    email: str = Field(..., min_length=3)
    password: str = Field(..., min_length=1)

    @field_validator("email")
    @classmethod
    def validate_email(cls, v: str) -> str:
        return v.strip().lower()

class UserResponse(BaseModel):
    id: str
    name: str
    email: str
    phone: str
    role: UserRole

class TokenResponse(BaseModel):
    user: UserResponse
    token: str

