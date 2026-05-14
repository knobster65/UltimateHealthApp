from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import User
from app.auth import get_current_user
from app.services.meal_suggester import analyze_and_suggest

router = APIRouter()


@router.get("/")
def get_suggestions(db: Session = Depends(get_db), _user: User = Depends(get_current_user)):
    return analyze_and_suggest(db)


@router.post("/apply")
def apply_suggestions(db: Session = Depends(get_db), _user: User = Depends(get_current_user)):
    """Create a meal plan from top suggested recipes."""
    from datetime import date, timedelta
    from sqlalchemy import select
    from app.models import Recipe, MealPlan, MealPlanEntry

    result = analyze_and_suggest(db)
    if result.get("message") or not result["suggestions"]:
        return result

    suggestion_ids = [s["recipe_id"] for s in result["suggestions"]]
    recipes = db.execute(
        select(Recipe).where(Recipe.id.in_(suggestion_ids))
    ).scalars().all()

    if not recipes:
        return {"message": "No recipes available to apply."}

    today = date.today()
    week_start = today - timedelta(days=today.weekday())

    plan = MealPlan(week_start=week_start, title="Suggested by Blood Test Analysis")
    db.add(plan)
    db.flush()

    slots = ["breakfast", "lunch", "dinner"]
    for day in range(7):
        for slot_idx, slot in enumerate(slots):
            recipe = recipes[(day + slot_idx) % len(recipes)]
            db.add(MealPlanEntry(
                plan_id=plan.id,
                recipe_id=recipe.id,
                day_of_week=day,
                meal_slot=slot,
                serving_count=1.0,
            ))

    db.commit()
    db.refresh(plan)

    return {"plan_id": plan.id, "plan_title": plan.title}
