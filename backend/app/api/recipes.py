from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import select

from app.database import get_db
from app.models import User, Recipe, RecipeIngredient, RecipeNutrition
from app.auth import get_current_user
from app.schemas import RecipeCreate, RecipeRead

router = APIRouter()


@router.get("/", response_model=list[RecipeRead])
def list_recipes(
    category: str | None = None,
    glycemic: str | None = None,
    search: str | None = None,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    stmt = select(Recipe).where(Recipe.user_id == user.id)
    if category:
        stmt = stmt.where(Recipe.category == category)
    if glycemic:
        stmt = stmt.where(Recipe.glycemic_rating == glycemic)
    if search:
        stmt = stmt.where(Recipe.name.ilike(f"%{search}%"))
    return db.execute(stmt.order_by(Recipe.id.desc())).scalars().all()


@router.post("/", response_model=RecipeRead)
def create_recipe(req: RecipeCreate, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    recipe = Recipe(user_id=user.id, **req.model_dump(exclude={"ingredients", "nutrition"}))
    db.add(recipe)
    db.flush()
    for ing in req.ingredients:
        db.add(RecipeIngredient(recipe_id=recipe.id, **ing.model_dump()))
    if req.nutrition:
        db.add(RecipeNutrition(recipe_id=recipe.id, **req.nutrition.model_dump()))
    db.commit()
    db.refresh(recipe)
    return recipe


@router.get("/{recipe_id}", response_model=RecipeRead)
def get_recipe(recipe_id: int, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    recipe = db.execute(
        select(Recipe).where(Recipe.id == recipe_id, Recipe.user_id == user.id)
    ).scalar_one_or_none()
    if not recipe:
        raise HTTPException(status_code=404, detail="Not found")
    return recipe


@router.delete("/{recipe_id}")
def delete_recipe(recipe_id: int, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    recipe = db.execute(
        select(Recipe).where(Recipe.id == recipe_id, Recipe.user_id == user.id)
    ).scalar_one_or_none()
    if not recipe:
        raise HTTPException(status_code=404, detail="Not found")
    db.delete(recipe)
    db.commit()
    return {"ok": True}
