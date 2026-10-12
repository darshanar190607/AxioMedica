"""
FastAPI dependency helpers:

  * get_current_user  – validates Bearer access token, returns User ORM object
  * require_patient   – asserts role == patient
  * require_clinician – asserts role == clinician
  * require_admin     – asserts role == admin

These are imported by endpoint modules that need authentication.
"""
import logging
import uuid

from fastapi import Depends, Header
from jose import JWTError
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.exceptions import ForbiddenException, UnauthorizedException
from app.core.security import decode_access_token
from app.db.session import get_db
from app.models.user import User, UserRole

logger = logging.getLogger("axiomedica.deps")


async def get_current_user(
    authorization: str = Header(..., alias="Authorization"),
    db: AsyncSession = Depends(get_db),
) -> User:
    """
    Extract and validate the Bearer JWT access token from the Authorization
    header, then load and return the corresponding User from the database.

    Raises:
        UnauthorizedException (401) – missing/invalid/expired token or user not found.
    """
    credentials_exc = UnauthorizedException("Could not validate credentials.")

    if not authorization.startswith("Bearer "):
        raise credentials_exc

    token = authorization.removeprefix("Bearer ").strip()

    try:
        payload = decode_access_token(token)
        user_id_str: str | None = payload.get("sub")
        if user_id_str is None:
            raise credentials_exc
        user_id = uuid.UUID(user_id_str)
    except (JWTError, ValueError):
        raise credentials_exc

    result = await db.execute(
        select(User)
        .where(User.id == user_id)
        .options(selectinload(User.patient))
    )
    user: User | None = result.scalar_one_or_none()

    if user is None or not user.is_active:
        raise credentials_exc

    return user


def require_role(*roles: UserRole):
    """
    Factory that returns a FastAPI dependency enforcing that the authenticated
    user has one of the specified roles.

    Usage::

        @router.get("/admin-only")
        async def admin_view(user = Depends(require_admin)):
            ...
    """
    async def _dependency(current_user: User = Depends(get_current_user)) -> User:
        if current_user.role not in roles:
            raise ForbiddenException(
                f"This endpoint requires one of the following roles: "
                f"{', '.join(r.value for r in roles)}."
            )
        return current_user

    return _dependency


# Convenience aliases used by endpoints
require_patient = require_role(UserRole.patient)
require_clinician = require_role(UserRole.clinician, UserRole.admin)
require_admin = require_role(UserRole.admin)
