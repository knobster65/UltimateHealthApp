from fastapi import APIRouter
from app.api import login, blood_tests, recipes, meal_plans, glucose, exercise, suggestions, dashboard, medications

router = APIRouter(prefix="/api")
router.include_router(login.router, prefix="/auth", tags=["Auth"])
router.include_router(dashboard.router, prefix="/dashboard", tags=["Dashboard"])
router.include_router(blood_tests.router, prefix="/blood-tests", tags=["Blood Tests"])
router.include_router(recipes.router, prefix="/recipes", tags=["Recipes"])
router.include_router(meal_plans.router, prefix="/meal-plans", tags=["Meal Plans"])
router.include_router(glucose.router, prefix="/glucose", tags=["Glucose"])
router.include_router(exercise.router, prefix="/exercise", tags=["Exercise"])
router.include_router(suggestions.router, prefix="/suggestions", tags=["Suggestions"])
router.include_router(medications.router, prefix="/medications", tags=["Medications"])

