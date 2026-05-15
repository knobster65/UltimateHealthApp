import logging
from collections import defaultdict
from datetime import date, timedelta
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import User, Recipe, RecipeIngredient, RecipeNutrition, MealPlan, MealPlanEntry
from app.auth import get_current_user
from app.services.meal_suggester import analyze_and_suggest, generate_meal_plan_from_bloodwork

logger = logging.getLogger(__name__)

router = APIRouter()


def _to_str(value) -> str:
    """Convert value to string, joining lists if needed."""
    if isinstance(value, list):
        return "\n".join(str(v) for v in value)
    return str(value) if value else ""


# Fallback: map ingredient name keywords to grocery categories.
CATEGORY_KEYWORDS: list[tuple[list[str], str]] = [
    (["milk", "yogurt", "cheese", "butter", "cream", "egg", "dairy"], "dairy"),
    (["chicken", "beef", "pork", "salmon", "fish", "tuna", "shrimp", "turkey", "steak", "meat", "protein"], "proteins"),
    (["rice", "pasta", "bread", "oat", "quinoa", "couscous", "noodle", "grain", "tortilla"], "grains"),
    (["frozen", "ice cream", "frost"], "frozen"),
    (["oil", "vinegar", "sauce", "salt", "pepper", "spice", "herb", "ginger", "garlic", "cumin", "paprika", "turmeric", "cinnamon", "vanilla"], "spices-herbs"),
    (["juice", "water", "tea", "coffee", "soda", "beverage", "drink"], "beverages"),
    (["apple", "banana", "berry", "orange", "lemon", "avocado", "tomato", "lettuce", "spinach", "kale", "broccoli", "carrot", "onion", "garlic", "mushroom", "pepper", "cucumber", "zucchini", "potato", "sweet potato", "corn", "bean", "green", "salad", "fruit", "vegetable", "produce", "nut", "seed", "walnut", "almond"], "produce"),
]


def _guess_category(name: str) -> str:
    """Guess grocery category from ingredient name using keyword matching."""
    lower = name.lower()
    for keywords, category in CATEGORY_KEYWORDS:
        if any(kw in lower for kw in keywords):
            return category
    return "pantry"


@router.get("/")
def get_suggestions(db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    return analyze_and_suggest(db, user.id)


@router.post("/apply")
def apply_suggestions(db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    """Create a meal plan from top suggested recipes."""
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
    try:
        result = await generate_meal_plan_from_bloodwork(db, user.id)
    except ValueError as e:
        raise HTTPException(status_code=422, detail=str(e))
    except Exception as e:
        import traceback
        logger.error(traceback.format_exc())
        detail = str(e) if str(e) else repr(e)
        raise HTTPException(status_code=502, detail=f"AI service error: {detail}")

    if isinstance(result, dict) and "error" in result:
        raise HTTPException(status_code=422, detail=f"{result['error']} — raw: {result.get('raw', '')}")

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
            instructions=_to_str(meal.get("instructions", "")),
        )
        db.add(recipe)
        db.flush()

        ingredients = meal.get("ingredients", [])
        for ing in ingredients:
            ing_name = ing.get("name", "")
            db.add(RecipeIngredient(
                recipe_id=recipe.id,
                name=ing_name,
                quantity=ing.get("quantity", 1.0) or 1.0,
                unit=ing.get("unit", ""),
                category=ing.get("category") or _guess_category(ing_name),
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
            "day_of_week": day_map.get(str(meal.get("day", "")).lower(), 0),
            "meal_slot": str(meal.get("slot", "lunch")).lower(),
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
