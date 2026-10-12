"""
Helper script to wait until PostgreSQL is accessible before running migrations or starting tests.
"""
import asyncio
import sys
import time
from sqlalchemy import text
from sqlalchemy.ext.asyncio import create_async_engine
from app.core.config import settings


async def wait_for_db(max_retries: int = 30, delay: float = 1.0) -> bool:
    print(f"Connecting to database at {settings.DATABASE_URL.split('@')[-1]}...")
    engine = create_async_engine(settings.DATABASE_URL, pool_pre_ping=True)

    for attempt in range(1, max_retries + 1):
        try:
            async with engine.connect() as conn:
                await conn.execute(text("SELECT 1"))
            print(f"✅ Database connection established (attempt {attempt}).")
            await engine.dispose()
            return True
        except Exception as e:
            print(f"⏳ [Attempt {attempt}/{max_retries}] Waiting for database... ({str(e)})")
            await asyncio.sleep(delay)

    print("❌ Could not connect to database within the timeout period.")
    await engine.dispose()
    return False


if __name__ == "__main__":
    success = asyncio.run(wait_for_db())
    sys.exit(0 if success else 1)
