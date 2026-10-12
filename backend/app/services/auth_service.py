"""
Authentication service layer.

All business logic for register / login / refresh / logout lives here.
The endpoints are kept thin and delegate to these functions.
"""
import logging
import uuid
from datetime import datetime, timedelta, timezone

from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.core.exceptions import BadRequestException, UnauthorizedException
from app.core.security import (
    create_access_token,
    create_refresh_token,
    decode_refresh_token,
    get_password_hash,
    hash_token,
    verify_password,
)
from app.models.user import Consent, ConsentType, Patient, RefreshToken, User, UserRole
from app.schemas.auth import RegisterRequest

logger = logging.getLogger("axiomedica.services.auth")

# Generic message – never reveal whether the account exists
_INVALID_CREDENTIALS = "Invalid email or password."


# ─────────────────────────────────────────────────────────────────────────────
# Register
# ─────────────────────────────────────────────────────────────────────────────

async def register_user(
    payload: RegisterRequest,
    db: AsyncSession,
) -> tuple[User, list[Consent]]:
    """
    Create a new user, a linked patient profile, and the required consent records
    (camera + data_processing) – all within a single atomic transaction.

    Returns:
        (user, consents) ORM objects (not yet committed; the caller / get_db
        dependency commits when the endpoint handler returns).

    Raises:
        BadRequestException(409) when the email is already registered.
    """
    # ── email uniqueness check ──────────────────────────────────────────────
    existing = await db.execute(select(User).where(User.email == payload.email))
    if existing.scalar_one_or_none() is not None:
        raise BadRequestException(
            "An account with this email address already exists.",
        )

    # ── create user ─────────────────────────────────────────────────────────
    new_user = User(
        id=uuid.uuid4(),
        email=payload.email,
        password_hash=get_password_hash(payload.password),
        role=UserRole.patient,
        is_active=True,
        full_name=payload.full_name,
    )
    db.add(new_user)
    await db.flush()  # populate new_user.id without committing

    # ── create patient profile ───────────────────────────────────────────────
    patient = Patient(
        id=uuid.uuid4(),
        user_id=new_user.id,
    )
    db.add(patient)

    # ── create mandatory consents ────────────────────────────────────────────
    consents: list[Consent] = []
    for consent_type in (ConsentType.camera, ConsentType.data_processing):
        c = Consent(
            id=uuid.uuid4(),
            user_id=new_user.id,
            consent_type=consent_type,
            granted=True,
        )
        db.add(c)
        consents.append(c)

    await db.flush()

    logger.info(
        "User registered",
        extra={"user_id": str(new_user.id), "email": new_user.email},
    )
    return new_user, consents


# ─────────────────────────────────────────────────────────────────────────────
# Login
# ─────────────────────────────────────────────────────────────────────────────

async def login_user(
    email: str,
    password: str,
    db: AsyncSession,
) -> tuple[str, str]:
    """
    Authenticate *email* / *password* and return (access_token, refresh_token).

    Always raises the same generic UnauthorizedException regardless of whether
    the email exists or the password is wrong, to prevent user enumeration.
    """
    result = await db.execute(select(User).where(User.email == email))
    user: User | None = result.scalar_one_or_none()

    # Perform the hash check even when the user doesn't exist (timing-safe)
    dummy_hash = "$argon2id$v=19$m=65536,t=2,p=2$dummysalt$dummyhash"
    if user is None:
        verify_password(password, dummy_hash)  # constant-time dummy
        raise UnauthorizedException(_INVALID_CREDENTIALS)

    if not verify_password(password, user.password_hash):
        raise UnauthorizedException(_INVALID_CREDENTIALS)

    if not user.is_active:
        raise UnauthorizedException(_INVALID_CREDENTIALS)

    return await _issue_token_pair(user, db)


# ─────────────────────────────────────────────────────────────────────────────
# Refresh  (rotation + reuse detection)
# ─────────────────────────────────────────────────────────────────────────────

async def refresh_tokens(
    raw_refresh_token: str,
    db: AsyncSession,
) -> tuple[str, str]:
    """
    Validate the supplied refresh token, rotate it, and return a new
    (access_token, refresh_token) pair.

    Reuse detection:
        If the token is found but already marked `revoked`, every refresh token
        for this user is immediately revoked (family invalidation), and an
        UnauthorizedException is raised.
    """
    credentials_exc = UnauthorizedException("Invalid or expired refresh token.")

    from jose import JWTError  # local import to avoid circular at module level

    try:
        payload = decode_refresh_token(raw_refresh_token)
        user_id = uuid.UUID(payload["sub"])
    except (JWTError, KeyError, ValueError):
        raise credentials_exc

    token_hash = hash_token(raw_refresh_token)

    result = await db.execute(
        select(RefreshToken).where(RefreshToken.token_hash == token_hash)
    )
    stored: RefreshToken | None = result.scalar_one_or_none()

    if stored is None:
        raise credentials_exc

    if stored.revoked:
        # Reuse detected – invalidate the entire token family
        logger.warning(
            "Refresh token reuse detected – revoking all tokens for user",
            extra={"user_id": str(user_id)},
        )
        await db.execute(
            update(RefreshToken)
            .where(RefreshToken.user_id == user_id)
            .values(revoked=True)
        )
        raise UnauthorizedException("Token reuse detected. Please log in again.")

    # Normalise expires_at: SQLite returns naive datetimes; ensure UTC-aware
    expires_at = stored.expires_at
    if expires_at.tzinfo is None:
        expires_at = expires_at.replace(tzinfo=timezone.utc)

    if expires_at < datetime.now(timezone.utc):
        raise credentials_exc


    # Mark the consumed token as revoked
    stored.revoked = True
    db.add(stored)

    # Load the user
    user_result = await db.execute(select(User).where(User.id == user_id))
    user: User | None = user_result.scalar_one_or_none()
    if user is None or not user.is_active:
        raise credentials_exc

    return await _issue_token_pair(user, db)


# ─────────────────────────────────────────────────────────────────────────────
# Logout
# ─────────────────────────────────────────────────────────────────────────────

async def logout_user(raw_refresh_token: str, db: AsyncSession) -> None:
    """
    Revoke the supplied refresh token.
    Silently succeeds even if the token is not found or already revoked,
    so that clients can always call logout safely.
    """
    from jose import JWTError

    try:
        decode_refresh_token(raw_refresh_token)  # validates signature + type
    except JWTError:
        return  # nothing to revoke

    token_hash = hash_token(raw_refresh_token)
    result = await db.execute(
        select(RefreshToken).where(RefreshToken.token_hash == token_hash)
    )
    stored: RefreshToken | None = result.scalar_one_or_none()
    if stored and not stored.revoked:
        stored.revoked = True
        db.add(stored)


# ─────────────────────────────────────────────────────────────────────────────
# Internal helper
# ─────────────────────────────────────────────────────────────────────────────

async def _issue_token_pair(user: User, db: AsyncSession) -> tuple[str, str]:
    """Mint a new access + refresh token pair and persist the refresh token hash."""
    access_token = create_access_token(subject=str(user.id), role=user.role.value)
    raw_refresh = create_refresh_token(subject=str(user.id))

    ttl = timedelta(days=settings.REFRESH_TTL_DAYS)
    rt = RefreshToken(
        id=uuid.uuid4(),
        user_id=user.id,
        token_hash=hash_token(raw_refresh),
        revoked=False,
        expires_at=datetime.now(timezone.utc) + ttl,
    )
    db.add(rt)
    await db.flush()

    return access_token, raw_refresh
