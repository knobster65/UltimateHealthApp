from collections import defaultdict
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import select

from app.database import get_db
from app.models import User, MealPlan, MealPlanEntry, RecipeIngredient
from app.auth import get_current_user
from app.schemas import MealPlanCreate, MealPlanRead, ShoppingListItem

router = APIRouter()


@router.get("/", response_model=list[MealPlanRead])
def list_plans(db: Session = Depends(get_db), _user: User = Depends(get_current_user)):
    return db.execute(select(MealPlan).order_by(MealPlan.week_start.desc())).scalars().all()


@router.post("/", response_model=MealPlanRead)
def create_plan(req: MealPlanCreate, db: Session = Depends(get_db), _user: User = Depends(get_current_user)):
    plan = MealPlan(week_start=req.week_start, title=req.title)
    db.add(plan)
    db.flush()
    for entry in req.entries:
        db.add(MealPlanEntry(plan_id=plan.id, **entry.model_dump()))
    db.commit()
    db.refresh(plan)
    return plan


@router.get("/{plan_id}", response_model=MealPlanRead)
def get_plan(plan_id: int, db: Session = Depends(get_db), _user: User = Depends(get_current_user)):
    plan = db.execute(select(MealPlan).where(MealPlan.id == plan_id)).scalar_one_or_none()
    if not plan:
        raise HTTPException(status_code=404, detail="Not found")
    return plan


@router.delete("/{plan_id}")
def delete_plan(plan_id: int, db: Session = Depends(get_db), _user: User = Depends(get_current_user)):
    plan = db.execute(select(MealPlan).where(MealPlan.id == plan_id)).scalar_one_or_none()
    if not plan:
        raise HTTPException(status_code=404, detail="Not found")
    db.delete(plan)
    db.commit()
    return {"ok": True}


@router.get("/{plan_id}/shopping-list", response_model=list[ShoppingListItem])
def get_shopping_list(plan_id: int, db: Session = Depends(get_db), _user: User = Depends(get_current_user)):
    plan = db.execute(select(MealPlan).where(MealPlan.id == plan_id)).scalar_one_or_none()
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
