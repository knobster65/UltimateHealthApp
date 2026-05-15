from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import User
from app.auth import get_current_user
from app.services.meal_suggester import analyze_and_suggest, generate_meal_plan_from_bloodwork

router = APIRouter()


@router.get("/")
def get_suggestions(db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    return analyze_and_suggest(db, user.id)


@router.post("/apply")
def apply_suggestions(db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    """Create a meal plan from top suggested recipes."""
    from datetime import date, timedelta
    from sqlalchemy import select
    from app.models import Recipe, MealPlan, MealPlanEntry

    result = analyze_and_suggest(db, user.id)
    if result.get("message") or not result["suggestions"]:
        return result

    suggestion_ids = [s["recipe_id"] for s in result["suggestions"]]
    recipes = db.execute(
        select(Recipe).where(Recipe.user_id == user.id, Recipe.id.in_(suggestion_ids))
    ).scalars().all()

    if not recipes:
        return {"message": "No recipes available to apply."}

    today = date.today()
    week_start = today - timedelta(days=today.weekday())

    plan = MealPlan(user_id=user.id, week_start=week_start, title="Suggested by Blood Test Analysis")
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


@router.post("/generate")
async def generate_ai_meal_plan(db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    """Use AI to analyze blood tests and generate a full week's meal plan with new recipes."""
    from datetime import date, timedelta
    from app.models import Recipe, RecipeIngredient, RecipeNutrition, MealPlan, MealPlanEntry

    result = await generate_meal_plan_from_bloodwork(db, user.id)

    if isinstance(result, dict) and "error" in result:
        raise HTTPException(status_code=422, detail=result["error"])

    if not result:
        raise HTTPException(status_code=422, detail="AI returned no meal suggestions")

    # Create recipes from AI output
    day_map = {"monday": 0, "tuesday": 1, "wednesday": 2, "thursday": 3, "friday": 4, "saturday": 5, "sunday": 6}
    created_recipes = []

    for meal in result:
        recipe = Recipe(
            user_id=user.id,
            name=meal.get("name", "Unnamed"),
            description=meal.get("description", ""),
            prep_time_min=meal.get("prep_time_min", 10),
            cook_time_min=meal.get("cook_time_min", 15),
            servings=meal.get("servings", 1) or 1,
            category=meal.get("category", "general"),
            glycemic_rating=meal.get("glycemic_rating", "medium") or "medium",
            instructions=meal.get("instructions", ""),
        )
        db.add(recipe)
        db.flush()

        ingredients = meal.get("ingredients", [])
        for ing in ingredients:
            db.add(RecipeIngredient(
                recipe_id=recipe.id,
                name=ing.get("name", ""),
                quantity=ing.get("quantity", 1.0) or 1.0,
                unit=ing.get("unit", ""),
            ))

        nutrition = meal.get("nutrition", {})
        if nutrition:
            db.add(RecipeNutrition(
                recipe_id=recipe.id,
                calories=nutrition.get("calories", 300) or 300,
                protein_g=nutrition.get("protein_g", 0) or 0,
                carbs_g=nutrition.get("carbs_g", 0) or 0,
                fat_g=nutrition.get("fat_g", 0) or 0,
                fiber_g=nutrition.get("fiber_g", 0) or 0,
                sugar_g=nutrition.get("sugar_g", 0) or 0,
            ))

        created_recipes.append({
            "recipe_id": recipe.id,
            "day_of_week": day_map.get(meal.get("day", "").lower(), 0),
            "meal_slot": meal.get("slot", "lunch").lower(),
        })

    today = date.today()
    week_start = today - timedelta(days=today.weekday())
    plan = MealPlan(user_id=user.id, week_start=week_start, title="AI-Generated from Blood Tests")
    db.add(plan)
    db.flush()

    for entry in created_recipes:
        db.add(MealPlanEntry(
            plan_id=plan.id,
            recipe_id=entry["recipe_id"],
            day_of_week=entry["day_of_week"],
            meal_slot=entry["meal_slot"],
            serving_count=1.0,
        ))

    db.commit()
    db.refresh(plan)

    return {"plan_id": plan.id, "plan_title": plan.title, "recipes_created": len(created_recipes)}
