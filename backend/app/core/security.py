"""
Security utilities: Argon2 password hashing and JWT token creation / validation.
"""
import hashlib
import uuid
from datetime import datetime, timedelta, timezone
from typing import Any

from argon2 import PasswordHasher
from argon2.exceptions import VerifyMismatchError, VerificationError, InvalidHashError
from jose import JWTError, jwt

from app.core.config import settings

# ---------------------------------------------------------------------------
# Argon2 hasher — sensible OWASP-recommended defaults
# ---------------------------------------------------------------------------
_ph = PasswordHasher(
    time_cost=2,       # iterations
    memory_cost=65536, # 64 MiB
    parallelism=2,
    hash_len=32,
    salt_len=16,
)


def get_password_hash(plain: str) -> str:
    """Return an Argon2id hash of *plain*."""
    return _ph.hash(plain)


def verify_password(plain: str, hashed: str) -> bool:
    """
    Return True when *plain* matches *hashed*.
    Returns False on any mismatch – never raises.
    """
    try:
        return _ph.verify(hashed, plain)
    except (VerifyMismatchError, VerificationError, InvalidHashError):
        return False


def needs_rehash(hashed: str) -> bool:  # pragma: no cover
    """Return True when the stored hash needs to be re-computed (parameter drift)."""
    return _ph.check_needs_rehash(hashed)


# ---------------------------------------------------------------------------
# JWT helpers
# ---------------------------------------------------------------------------
_ACCESS_TYPE = "access"
_REFRESH_TYPE = "refresh"


def _now_utc() -> datetime:
    return datetime.now(timezone.utc)


def create_access_token(
    subject: str,
    role: str,
    extra: dict[str, Any] | None = None,
    expires_delta: timedelta | None = None,
) -> str:
    """
    Create a signed JWT access token.

    :param subject:       user UUID as string
    :param role:          user role string
    :param extra:         optional additional claims
    :param expires_delta: override the configured ACCESS_TTL_MIN
    """
    now = _now_utc()
    ttl = expires_delta or timedelta(minutes=settings.ACCESS_TTL_MIN)
    payload: dict[str, Any] = {
        "sub": subject,
        "role": role,
        "type": _ACCESS_TYPE,
        "iat": now,
        "exp": now + ttl,
        "jti": str(uuid.uuid4()),
    }
    if extra:
        payload.update(extra)
    return jwt.encode(payload, settings.JWT_SECRET, algorithm=settings.JWT_ALGORITHM)


def create_refresh_token(
    subject: str,
    expires_delta: timedelta | None = None,
) -> str:
    """
    Create a signed JWT refresh token.

    The *jti* claim is a random UUID; its SHA-256 hex digest is stored in the
    refresh_tokens table to detect reuse.
    """
    now = _now_utc()
    ttl = expires_delta or timedelta(days=settings.REFRESH_TTL_DAYS)
    payload: dict[str, Any] = {
        "sub": subject,
        "type": _REFRESH_TYPE,
        "iat": now,
        "exp": now + ttl,
        "jti": str(uuid.uuid4()),
    }
    return jwt.encode(payload, settings.JWT_SECRET, algorithm=settings.JWT_ALGORITHM)


def decode_access_token(token: str) -> dict[str, Any]:
    """
    Decode and validate a JWT access token.
    Raises jose.JWTError on any failure (expired, wrong type, bad signature…).
    """
    payload = jwt.decode(token, settings.JWT_SECRET, algorithms=[settings.JWT_ALGORITHM])
    if payload.get("type") != _ACCESS_TYPE:
        raise JWTError("Not an access token")
    return payload


def decode_refresh_token(token: str) -> dict[str, Any]:
    """
    Decode and validate a JWT refresh token.
    Raises jose.JWTError on any failure.
    """
    payload = jwt.decode(token, settings.JWT_SECRET, algorithms=[settings.JWT_ALGORITHM])
    if payload.get("type") != _REFRESH_TYPE:
        raise JWTError("Not a refresh token")
    return payload


def hash_token(raw_token: str) -> str:
    """Return the SHA-256 hex digest of *raw_token* for safe storage."""
    return hashlib.sha256(raw_token.encode()).hexdigest()
