from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Query
from sqlalchemy.orm import Session
from sqlalchemy import select, func

from app.database import get_db
from app.models import User, ExerciseEntry
from app.auth import get_current_user
from app.schemas import ExerciseEntryRead, ExerciseSummary
from app.services.exercise_parser import parse_apple_health_csv
import uuid

router = APIRouter()


@router.get("/", response_model=list[ExerciseEntryRead])
def list_exercises(
    start: datetime | None = Query(None),
    end: datetime | None = Query(None),
    type: str | None = Query(None),
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    stmt = select(ExerciseEntry).where(ExerciseEntry.user_id == user.id)
    if start:
        stmt = stmt.where(ExerciseEntry.start_time >= start)
    if end:
        stmt = stmt.where(ExerciseEntry.end_time <= end)
    if type:
        stmt = stmt.where(ExerciseEntry.workout_type.ilike(f"%{type}%"))
    return db.execute(stmt.order_by(ExerciseEntry.start_time.desc())).scalars().all()


@router.post("/import")
def import_exercise(file: UploadFile = File(...), db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    content = file.file.read()
    batch_id = str(uuid.uuid4())[:8]
    entries_created = parse_apple_health_csv(content, db, batch_id, user.id)

    if file.filename and not file.filename.endswith(".csv"):
        raise HTTPException(status_code=400, detail="Only CSV files from Apple Health are supported")

    return {"imported": entries_created, "batch_id": batch_id}


@router.get("/summary", response_model=ExerciseSummary)
def get_summary(
    week_start: str = Query(..., description="ISO date, e.g. 2026-05-05"),
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    from datetime import timedelta
    ws = datetime.strptime(week_start, "%Y-%m-%d")
    we = ws + timedelta(days=7)

    stmt = select(ExerciseEntry).where(
        ExerciseEntry.user_id == user.id,
        ExerciseEntry.start_time >= ws,
        ExerciseEntry.start_time < we,
    )
    entries = db.execute(stmt).scalars().all()

    by_type = {}
    for e in entries:
        if e.workout_type not in by_type:
            by_type[e.workout_type] = {"count": 0, "duration_min": 0.0, "calories": 0.0}
        by_type[e.workout_type]["count"] += 1
        by_type[e.workout_type]["duration_min"] += e.duration_min
        by_type[e.workout_type]["calories"] += e.calories_burned

    return ExerciseSummary(
        total_workouts=len(entries),
        total_duration_min=sum(e.duration_min for e in entries),
        total_calories=sum(e.calories_burned for e in entries),
        by_type=by_type,
    )


@router.delete("/{entry_id}")
def delete_entry(entry_id: int, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    entry = db.execute(
        select(ExerciseEntry).where(ExerciseEntry.id == entry_id, ExerciseEntry.user_id == user.id)
    ).scalar_one_or_none()
    if not entry:
        raise HTTPException(status_code=404, detail="Not found")
    db.delete(entry)
    db.commit()
    return {"ok": True}
