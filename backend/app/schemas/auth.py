"""
Pydantic v2 schemas for authentication and patient profile endpoints.

Rules enforced here:
  * password_hash is NEVER included in any response model.
  * Passwords are validated for minimum strength at the schema level.
  * All IDs are UUIDs serialised as strings.
"""
import uuid
from datetime import datetime
from typing import Optional

from pydantic import BaseModel, ConfigDict, EmailStr, Field, field_validator


# ─────────────────────────────────────────────────────────────────────────────
# Common
# ─────────────────────────────────────────────────────────────────────────────

class MessageResponse(BaseModel):
    """Generic success / informational message envelope."""
    message: str


# ─────────────────────────────────────────────────────────────────────────────
# Auth – request payloads
# ─────────────────────────────────────────────────────────────────────────────

class RegisterRequest(BaseModel):
    email: EmailStr
    password: str = Field(..., min_length=8, max_length=128)
    full_name: Optional[str] = Field(None, max_length=255)

    @field_validator("password")
    @classmethod
    def password_strength(cls, v: str) -> str:
        has_digit = any(c.isdigit() for c in v)
        has_upper = any(c.isupper() for c in v)
        if not has_digit or not has_upper:
            raise ValueError(
                "Password must contain at least one uppercase letter and one digit."
            )
        return v


class LoginRequest(BaseModel):
    email: EmailStr
    password: str = Field(..., min_length=1, max_length=128)


class RefreshRequest(BaseModel):
    refresh_token: str


class LogoutRequest(BaseModel):
    refresh_token: str


# ─────────────────────────────────────────────────────────────────────────────
# Auth – response payloads
# ─────────────────────────────────────────────────────────────────────────────

class TokenResponse(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"


class AccessTokenResponse(BaseModel):
    """Returned by /auth/refresh – provides a new access token (and optionally a new refresh token)."""
    access_token: str
    refresh_token: str
    token_type: str = "bearer"


# ─────────────────────────────────────────────────────────────────────────────
# User / Patient – response (password_hash deliberately omitted everywhere)
# ─────────────────────────────────────────────────────────────────────────────

class UserPublic(BaseModel):
    """
    Safe, outward-facing representation of a User.
    password_hash is intentionally absent.
    """
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    email: str
    role: str
    is_active: bool
    full_name: Optional[str]
    created_at: datetime
    updated_at: datetime


class ConsentOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    consent_type: str
    granted: bool
    created_at: datetime


class RegisterResponse(BaseModel):
    user: UserPublic
    consents: list[ConsentOut]


class PatientProfile(BaseModel):
    """Full patient profile returned by GET /patients/me."""
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    user_id: uuid.UUID
    date_of_birth: Optional[datetime]
    phone: Optional[str]
    bio: Optional[str]
    created_at: datetime
    updated_at: datetime
    user: UserPublic


class PatientMeResponse(BaseModel):
    """Response for GET /patients/me."""
    patient: PatientProfile


# ─────────────────────────────────────────────────────────────────────────────
# Patient – update payload
# ─────────────────────────────────────────────────────────────────────────────

class PatchPatientRequest(BaseModel):
    """PATCH /patients/me – all fields optional."""
    full_name: Optional[str] = Field(None, max_length=255)
    phone: Optional[str] = Field(None, max_length=32)
    bio: Optional[str] = Field(None, max_length=2000)
    date_of_birth: Optional[datetime] = None
