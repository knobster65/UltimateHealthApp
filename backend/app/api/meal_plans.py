from collections import defaultdict
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import select

from app.database import get_db
from app.models import User, MealPlan, MealPlanEntry, RecipeIngredient, Recipe, RecipeNutrition
from app.auth import get_current_user
from app.schemas import MealPlanCreate, MealPlanRead, ShoppingListItem

router = APIRouter()


@router.get("/", response_model=list[MealPlanRead])
def list_plans(db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    return db.execute(
        select(MealPlan).where(MealPlan.user_id == user.id).order_by(MealPlan.week_start.desc())
    ).scalars().all()


@router.get("/latest")
def get_latest_plan(db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    """Return the most recent meal plan with its shopping list."""
    plan = db.execute(
        select(MealPlan).where(MealPlan.user_id == user.id)
        .order_by(MealPlan.week_start.desc())
        .limit(1)
    ).scalar_one_or_none()
    if not plan:
        return {"plan": None, "shopping_list": []}

    entries = db.execute(
        select(MealPlanEntry).where(MealPlanEntry.plan_id == plan.id)
    ).scalars().all()

    aggregation = defaultdict(lambda: {"total_quantity": 0.0, "unit": ""})
    for entry in entries:
        ingredients = db.execute(
            select(RecipeIngredient).where(RecipeIngredient.recipe_id == entry.recipe_id)
        ).scalars().all()
        for ing in ingredients:
            key = (ing.category or "Other", ing.name.lower())
            agg = aggregation[key]
            agg["total_quantity"] += ing.quantity * entry.serving_count
            agg["unit"] = ing.unit

    shopping_list = [
        ShoppingListItem(
            category=k[0],
            name=k[1].title(),
            total_quantity=round(v["total_quantity"], 2),
            unit=v["unit"],
        )
        for k, v in aggregation.items()
    ]

    return {
        "plan": {"id": plan.id, "title": plan.title, "week_start": plan.week_start.isoformat()},
        "shopping_list": shopping_list,
    }


@router.post("/", response_model=MealPlanRead)
def create_plan(req: MealPlanCreate, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    plan = MealPlan(user_id=user.id, week_start=req.week_start, title=req.title)
    db.add(plan)
    db.flush()
    for entry in req.entries:
        db.add(MealPlanEntry(plan_id=plan.id, **entry.model_dump()))
    db.commit()
    db.refresh(plan)
    return plan


@router.get("/{plan_id}/view")
def get_plan_detail(plan_id: int, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    """Return full plan detail with recipe names, ingredients, and nutrition per entry."""
    plan = db.execute(
        select(MealPlan).where(MealPlan.id == plan_id, MealPlan.user_id == user.id)
    ).scalar_one_or_none()
    if not plan:
        raise HTTPException(status_code=404, detail="Not found")

    entries = db.execute(
        select(MealPlanEntry).where(MealPlanEntry.plan_id == plan_id)
    ).scalars().all()

    result_entries = []
    daily_calories: dict[int, float] = defaultdict(float)

    for entry in entries:
        recipe = db.get(Recipe, entry.recipe_id)
        if not recipe or recipe.user_id != user.id:
            continue
        result_entries.append({
            "id": entry.id,
            "day_of_week": entry.day_of_week,
            "meal_slot": entry.meal_slot,
            "serving_count": entry.serving_count,
            "recipe_name": recipe.name,
            "recipe_description": recipe.description,
            "recipe_category": recipe.category,
            "recipe_glycemic_rating": recipe.glycemic_rating,
            "recipe_instructions": recipe.instructions,
            "prep_time_min": recipe.prep_time_min,
            "cook_time_min": recipe.cook_time_min,
            "ingredients": [
                {"name": i.name, "quantity": i.quantity, "unit": i.unit, "category": i.category}
                for i in recipe.ingredients
            ],
            "nutrition": (
                {
                    "calories": recipe.nutrition.calories,
                    "protein_g": recipe.nutrition.protein_g,
                    "carbs_g": recipe.nutrition.carbs_g,
                    "fat_g": recipe.nutrition.fat_g,
                    "fiber_g": recipe.nutrition.fiber_g,
                    "sugar_g": recipe.nutrition.sugar_g,
                }
                if recipe.nutrition else None
            ),
        })
        if recipe.nutrition:
            daily_calories[entry.day_of_week] += recipe.nutrition.calories * entry.serving_count

    return {
        "plan_id": plan.id,
        "title": plan.title,
        "week_start": plan.week_start.isoformat(),
        "entries": result_entries,
        "daily_calories": {str(k): round(v) for k, v in daily_calories.items()},
    }


@router.get("/{plan_id}", response_model=MealPlanRead)
def get_plan(plan_id: int, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    plan = db.execute(
        select(MealPlan).where(MealPlan.id == plan_id, MealPlan.user_id == user.id)
    ).scalar_one_or_none()
    if not plan:
        raise HTTPException(status_code=404, detail="Not found")
    return plan


@router.delete("/{plan_id}")
def delete_plan(plan_id: int, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    plan = db.execute(
        select(MealPlan).where(MealPlan.id == plan_id, MealPlan.user_id == user.id)
    ).scalar_one_or_none()
    if not plan:
        raise HTTPException(status_code=404, detail="Not found")
    db.delete(plan)
    db.commit()
    return {"ok": True}


@router.get("/{plan_id}/shopping-list", response_model=list[ShoppingListItem])
def get_shopping_list(plan_id: int, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    plan = db.execute(
        select(MealPlan).where(MealPlan.id == plan_id, MealPlan.user_id == user.id)
    ).scalar_one_or_none()
    if not plan:
        raise HTTPException(status_code=404, detail="Not found")

    entries = db.execute(
        select(MealPlanEntry).where(MealPlanEntry.plan_id == plan_id)
    ).scalars().all()

    aggregation = defaultdict(lambda: {"total_quantity": 0.0, "unit": ""})
    for entry in entries:
        ingredients = db.execute(
            select(RecipeIngredient).where(RecipeIngredient.recipe_id == entry.recipe_id)
        ).scalars().all()
        for ing in ingredients:
            key = (ing.category, ing.name.lower())
            agg = aggregation[key]
            agg["total_quantity"] += ing.quantity * entry.serving_count
            agg["unit"] = ing.unit

    return [
        ShoppingListItem(
            category=k[0],
            name=k[1].title(),
            total_quantity=round(v["total_quantity"], 2),
            unit=v["unit"],
        )
        for k, v in aggregation.items()
    ]
