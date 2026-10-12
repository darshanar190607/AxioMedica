"""
Authentication endpoints:

  POST /auth/register  – create account, patient profile, and consents
  POST /auth/login     – issue access + refresh tokens (rate-limited)
  POST /auth/refresh   – rotate refresh token
  POST /auth/logout    – revoke refresh token
"""
import logging

from fastapi import APIRouter, Depends, Request, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.exceptions import UnauthorizedException
from app.core.rate_limit import check_rate_limit
from app.db.session import get_db
from app.schemas.auth import (
    AccessTokenResponse,
    LoginRequest,
    LogoutRequest,
    MessageResponse,
    RefreshRequest,
    RegisterRequest,
    RegisterResponse,
    TokenResponse,
)
from app.services.auth_service import (
    login_user,
    logout_user,
    refresh_tokens,
    register_user,
)

logger = logging.getLogger("axiomedica.auth")

router = APIRouter(prefix="/auth", tags=["Authentication"])


@router.post(
    "/register",
    response_model=RegisterResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Register a new patient account",
)
async def register(
    payload: RegisterRequest,
    db: AsyncSession = Depends(get_db),
) -> RegisterResponse:
    """
    Create a new patient account.

    * Hashes password with Argon2id.
    * Creates a Patient profile row.
    * Inserts consent records for `camera` and `data_processing`.
    * Returns the public user object and the created consents.
    """
    user, consents = await register_user(payload, db)
    return RegisterResponse(user=user, consents=consents)  # type: ignore[arg-type]


@router.post(
    "/login",
    response_model=TokenResponse,
    status_code=status.HTTP_200_OK,
    summary="Login and obtain access + refresh tokens",
)
async def login(
    payload: LoginRequest,
    request: Request,
    db: AsyncSession = Depends(get_db),
) -> TokenResponse:
    """
    Authenticate with email and password.

    * Rate-limited to 10 attempts per IP per 60 s.
    * Returns a generic error regardless of whether the account exists.
    """
    # Rate-limit by client IP (fall back to email if IP unavailable)
    client_ip = request.client.host if request.client else payload.email
    if not check_rate_limit(client_ip):
        raise UnauthorizedException(
            "Too many login attempts. Please try again later."
        )

    access_token, refresh_token = await login_user(payload.email, payload.password, db)
    return TokenResponse(access_token=access_token, refresh_token=refresh_token)


@router.post(
    "/refresh",
    response_model=AccessTokenResponse,
    status_code=status.HTTP_200_OK,
    summary="Rotate refresh token and obtain a new token pair",
)
async def refresh(
    payload: RefreshRequest,
    db: AsyncSession = Depends(get_db),
) -> AccessTokenResponse:
    """
    Consume a valid refresh token and return a rotated token pair.

    * Old refresh token is immediately revoked.
    * If the refresh token has already been used (reuse detected), all tokens
      for the account are invalidated (family invalidation).
    """
    access_token, new_refresh = await refresh_tokens(payload.refresh_token, db)
    return AccessTokenResponse(access_token=access_token, refresh_token=new_refresh)


@router.post(
    "/logout",
    response_model=MessageResponse,
    status_code=status.HTTP_200_OK,
    summary="Revoke refresh token (logout)",
)
async def logout(
    payload: LogoutRequest,
    db: AsyncSession = Depends(get_db),
) -> MessageResponse:
    """
    Revoke the supplied refresh token, effectively logging the user out.
    Always returns 200 OK regardless of whether the token was found.
    """
    await logout_user(payload.refresh_token, db)
    return MessageResponse(message="Successfully logged out.")
