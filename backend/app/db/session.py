"""
Database session management using SQLAlchemy 2.x async engine and sessionmaker.
Configured with connection pooling and dependency injection for FastAPI endpoints.
"""
import logging
import time
from typing import AsyncGenerator, Tuple, Optional
from sqlalchemy import text
from sqlalchemy.ext.asyncio import (
    AsyncEngine,
    AsyncSession,
    async_sessionmaker,
    create_async_engine,
)
from app.core.config import settings

logger = logging.getLogger("axiomedica.db")

# 1. SQLAlchemy 2.x Async Engine with robust Connection Pooling
engine: AsyncEngine = create_async_engine(
    settings.DATABASE_URL,
    echo=settings.DEBUG,
    pool_size=settings.DB_POOL_SIZE,
    max_overflow=settings.DB_MAX_OVERFLOW,
    pool_timeout=settings.DB_POOL_TIMEOUT,
    pool_recycle=settings.DB_POOL_RECYCLE,
    pool_pre_ping=True,  # Proactively test connections before checkout
)

# 2. Async Session Factory
AsyncSessionLocal = async_sessionmaker(
    bind=engine,
    class_=AsyncSession,
    autocommit=False,
    autoflush=False,
    expire_on_commit=False,
)


async def get_db() -> AsyncGenerator[AsyncSession, None]:
    """
    FastAPI dependency that yields an asynchronous database session.
    Ensures transaction rollback on error and proper session cleanup.
    """
    async with AsyncSessionLocal() as session:
        try:
            yield session
            await session.commit()
        except Exception:
            await session.rollback()
            raise
        finally:
            await session.close()


async def check_db_connection() -> Tuple[bool, Optional[str], float]:
    """
    Executes a lightweight `SELECT 1` query to verify active database connectivity.
    Returns:
        (is_connected, error_message_if_any, latency_in_milliseconds)
    """
    start_time = time.perf_counter()
    try:
        async with engine.connect() as conn:
            await conn.execute(text("SELECT 1"))
        latency_ms = round((time.perf_counter() - start_time) * 1000, 2)
        return True, None, latency_ms
    except Exception as exc:
        latency_ms = round((time.perf_counter() - start_time) * 1000, 2)
        logger.error(f"Database health check failed: {str(exc)}", exc_info=True)
        return False, str(exc), latency_ms
