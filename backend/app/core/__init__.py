"""
Core application package: configuration, logging, exceptions, security.
"""
from app.core.config import settings
from app.core.logging import setup_logging, JSONRequestLoggingMiddleware
from app.core.exceptions import (
    AppException,
    NotFoundException,
    UnauthorizedException,
    ForbiddenException,
    BadRequestException,
    DatabaseConnectionException,
    register_exception_handlers,
)

__all__ = [
    "settings",
    "setup_logging",
    "JSONRequestLoggingMiddleware",
    "AppException",
    "NotFoundException",
    "UnauthorizedException",
    "ForbiddenException",
    "BadRequestException",
    "DatabaseConnectionException",
    "register_exception_handlers",
]
