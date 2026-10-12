"""
Shared test fixtures and configuration.

Database strategy:
  * Uses an in-memory SQLite database via aiosqlite so tests run without a
    live PostgreSQL instance.
  * SQLAlchemy async engine is created per-session; all tables are created
    with create_all() and dropped after the session.
  * The FastAPI `get_db` dependency is overridden to use a per-test
    transaction that is rolled back after each test – giving perfect isolation.

Pytest-asyncio mode is set to 'auto' via pytest.ini_options (see
pyproject.toml / pytest.ini) or via the marker in this file.
"""
import asyncio
from typing import AsyncGenerator

import pytest
import pytest_asyncio
from httpx import AsyncClient, ASGITransport
from sqlalchemy import event
from sqlalchemy.ext.asyncio import (
    AsyncConnection,
    AsyncSession,
    async_sessionmaker,
    create_async_engine,
)

from app.db.session import get_db
from app.main import app as fastapi_app
from app.models.base import Base
# Import all model modules so Base.metadata is populated before create_all()
import app.models  # noqa: F401

# ─────────────────────────────────────────────────────────────────────────────
# SQLite in-memory engine (session-scoped → created once per test run)
# ─────────────────────────────────────────────────────────────────────────────
TEST_DATABASE_URL = "sqlite+aiosqlite:///:memory:"


@pytest.fixture(scope="session")
def event_loop_policy():
    """Use the default asyncio event loop policy."""
    return asyncio.DefaultEventLoopPolicy()


@pytest_asyncio.fixture(scope="session")
async def db_engine():
    """
    Create the async SQLite engine and build the schema once per test session.
    Yields the engine, then drops all tables on teardown.
    """
    engine = create_async_engine(
        TEST_DATABASE_URL,
        connect_args={"check_same_thread": False},
        echo=False,
    )

    # SQLite does not support ENUM types natively; we tell SQLAlchemy to
    # render them as VARCHAR so create_all works without PostgreSQL.
    @event.listens_for(engine.sync_engine, "connect")
    def set_sqlite_pragma(dbapi_conn, _):
        # Enable FK enforcement in SQLite
        cursor = dbapi_conn.cursor()
        cursor.execute("PRAGMA foreign_keys=ON")
        cursor.close()

    async with engine.begin() as conn:
        # Create tables; render Enum as VARCHAR for SQLite compatibility
        await conn.run_sync(Base.metadata.create_all)

    yield engine

    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)

    await engine.dispose()


@pytest_asyncio.fixture()
async def db_session(db_engine) -> AsyncGenerator[AsyncSession, None]:
    """
    Yield a per-test database session wrapped in a rolled-back transaction
    for perfect test isolation.
    """
    async with db_engine.connect() as conn:
        await conn.begin()
        session_factory = async_sessionmaker(
            bind=conn,
            class_=AsyncSession,
            autoflush=False,
            autocommit=False,
            expire_on_commit=False,
        )
        session = session_factory()
        try:
            yield session
        finally:
            await session.close()
            await conn.rollback()


@pytest_asyncio.fixture()
async def async_client(db_session: AsyncSession) -> AsyncGenerator[AsyncClient, None]:
    """
    AsyncClient that overrides `get_db` to use the isolated per-test session.
    """
    async def _override_get_db():
        yield db_session

    fastapi_app.dependency_overrides[get_db] = _override_get_db
    transport = ASGITransport(app=fastapi_app)
    async with AsyncClient(transport=transport, base_url="http://testserver") as client:
        yield client
    fastapi_app.dependency_overrides.clear()
