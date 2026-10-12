"""
Exercise catalog endpoints:
  GET /exercises      - List all exercises in catalog
  GET /exercises/{id} - Get single exercise with pose_config
"""
from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.exceptions import NotFoundException
from app.db.session import get_db
from app.models.session import Exercise
from app.schemas.exercise_plan import ExerciseResponse

router = APIRouter(prefix="/exercises", tags=["Exercises"])


@router.get(
    "",
    response_model=list[ExerciseResponse],
    summary="List all exercises in catalog",
)
async def list_exercises(
    db: AsyncSession = Depends(get_db),
) -> list[ExerciseResponse]:
    stmt = select(Exercise).order_by(Exercise.id)
    result = await db.execute(stmt)
    exercises = result.scalars().all()
    return [ExerciseResponse.model_validate(ex) for ex in exercises]


@router.get(
    "/{exercise_id}",
    response_model=ExerciseResponse,
    summary="Get exercise by ID",
)
async def get_exercise(
    exercise_id: int,
    db: AsyncSession = Depends(get_db),
) -> ExerciseResponse:
    exercise = await db.get(Exercise, exercise_id)
    if exercise is None:
        raise NotFoundException(f"Exercise with ID {exercise_id} not found.")
    return ExerciseResponse.model_validate(exercise)
