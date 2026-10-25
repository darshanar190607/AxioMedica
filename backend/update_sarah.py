import asyncio
from sqlalchemy import select
from app.db.session import AsyncSessionLocal
from app.models.user import User, Patient

async def update_sarah():
    async with AsyncSessionLocal() as session:
        stmt = select(User).where(User.email == 'sarah.johnson@email.com')
        res = await session.execute(stmt)
        user = res.scalar_one_or_none()
        if user:
            stmt_p = select(Patient).where(Patient.user_id == user.id)
            res_p = await session.execute(stmt_p)
            patient = res_p.scalar_one_or_none()
            if patient:
                patient.injured_ankle = 'Left'
                patient.injury_type = 'Grade 2 ATFL Sprain'
                patient.recovery_stage = 2
                patient.current_week = 3
                patient.total_weeks = 6
                patient.recovery_percent = 72
                patient.phone = '+1 (555) 234-7890'
                await session.commit()
                print("Sarah Johnson patient profile successfully updated with ankle recovery metrics!")
            else:
                print("Patient record not found.")

asyncio.run(update_sarah())
