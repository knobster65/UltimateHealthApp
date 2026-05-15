from datetime import datetime, timedelta
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from sqlalchemy import select, func

from app.database import get_db
from app.models import (
    User, BloodTest, GlucoseReading, ExerciseEntry, Recipe, MealPlan,
)
from app.auth import get_current_user
from app.schemas import DashboardStats, LatestGlucose, BloodTestSummary

router = APIRouter()


@router.get("/stats", response_model=DashboardStats)
def get_dashboard_stats(
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    now = datetime.now()
    week_ago = now - timedelta(days=7)
    week_start_dt = now - timedelta(days=now.weekday())

    # --- Glucose (7d) ---
    glucose_avg_7d = None
    glucose_tir_pct = None
    glucose_gmi = None
    latest_glucose = None

    g_stmt = select(GlucoseReading).where(
        GlucoseReading.user_id == user.id,
        GlucoseReading.date_time >= week_ago,
        GlucoseReading.date_time <= now,
    ).order_by(GlucoseReading.date_time.asc())
    g_readings = db.execute(g_stmt).scalars().all()

    if g_readings:
        values = [r.value_mgdl for r in g_readings]
        total = len(values)
        avg = sum(values) / total
        glucose_avg_7d = round(avg, 1)
        glucose_tir_pct = round(sum(1 for v in values if 70 <= v <= 180) / total * 100, 1)
        glucose_gmi = round(3.31 + (0.02392 * avg), 1)

        latest = g_readings[-1]
        latest_glucose = LatestGlucose(
            value_mgdl=latest.value_mgdl,
            date_time=latest.date_time,
            trend=getattr(latest, "trend", None),
        )

    # --- Blood Tests ---
    bt_summary = None
    bt_count = db.execute(
        select(func.count(BloodTest.id)).where(BloodTest.user_id == user.id)
    ).scalar()
    if bt_count:
        latest_date = db.execute(
            select(BloodTest.date_tested).where(BloodTest.user_id == user.id).order_by(BloodTest.date_tested.desc()).limit(1)
        ).scalar_one_or_none()

        flagged = 0
        all_tests = db.execute(
            select(BloodTest).where(BloodTest.user_id == user.id)
        ).scalars().all()
        for bt in all_tests:
            if getattr(bt, "markers", None):
                for m in bt.markers:
                    if getattr(m, "is_flagged", False):
                        flagged += 1

        bt_summary = BloodTestSummary(
            total_tests=bt_count,
            flagged_markers=flagged,
            latest_test_date=latest_date,
        )

    # --- Exercise (this week) ---
    ex_stmt = select(ExerciseEntry).where(
        ExerciseEntry.user_id == user.id,
        ExerciseEntry.start_time >= week_start_dt,
        ExerciseEntry.start_time <= now,
    )
    ex_entries = db.execute(ex_stmt).scalars().all()
    ex_workouts = len(ex_entries)
    ex_minutes = sum(e.duration_min for e in ex_entries)
    ex_calories = sum(e.calories_burned for e in ex_entries)

    # --- Meals ---
    recipe_count = db.execute(
        select(func.count(Recipe.id)).where(Recipe.user_id == user.id)
    ).scalar() or 0
    meal_plan_count = db.execute(
        select(func.count(MealPlan.id)).where(MealPlan.user_id == user.id)
    ).scalar() or 0

    return DashboardStats(
        glucose_avg_7d=glucose_avg_7d,
        glucose_tir_pct=glucose_tir_pct,
        glucose_gmi=glucose_gmi,
        latest_glucose=latest_glucose,
        blood_tests=bt_summary if bt_count else None,
        exercise_workouts_this_week=ex_workouts,
        exercise_minutes_this_week=round(ex_minutes, 1),
        exercise_calories_this_week=round(ex_calories, 1),
        recipe_count=recipe_count,
        meal_plan_count=meal_plan_count,
    )
