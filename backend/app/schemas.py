from datetime import datetime, date
from typing import Optional
from pydantic import BaseModel, Field


# ── Auth ──────────────────────────────────────────────
class LoginRequest(BaseModel):
    username: str
    password: str


class TokenResponse(BaseModel):
    token: str


class UserInfo(BaseModel):
    id: int
    username: str


# ── Blood Tests ───────────────────────────────────────
class MarkerCreate(BaseModel):
    category: str
    marker_name: str
    value: float
    unit: str
    low_ref: Optional[float] = None
    high_ref: Optional[float] = None


class MarkerRead(BaseModel):
    id: int
    test_id: int
    category: str
    marker_name: str
    value: float
    unit: str
    low_ref: Optional[float] = None
    high_ref: Optional[float] = None
    is_flagged: bool = False

    model_config = {"from_attributes": True}


class BloodTestCreate(BaseModel):
    date_tested: date
    lab_name: Optional[str] = None
    notes: Optional[str] = None
    markers: list[MarkerCreate] = []


class BloodTestRead(BaseModel):
    id: int
    date_tested: date
    lab_name: Optional[str] = None
    pdf_path: Optional[str] = None
    notes: Optional[str] = None
    created_at: datetime
    markers: list[MarkerRead] = []

    model_config = {"from_attributes": True}


class BloodTestUpdate(BaseModel):
    date_tested: Optional[date] = None
    lab_name: Optional[str] = None
    notes: Optional[str] = None
    markers: Optional[list[MarkerCreate]] = None


# ── Recipes ────────────────────────────────────────────
class IngredientCreate(BaseModel):
    name: str
    quantity: float
    unit: str
    category: Optional[str] = None


class IngredientRead(BaseModel):
    id: int
    recipe_id: int
    name: str
    quantity: float
    unit: str
    category: Optional[str] = None

    model_config = {"from_attributes": True}


class NutritionCreate(BaseModel):
    calories: float
    protein_g: float = 0
    carbs_g: float = 0
    fat_g: float = 0
    fiber_g: float = 0
    sugar_g: float = 0


class NutritionRead(NutritionCreate):
    id: int
    recipe_id: int

    model_config = {"from_attributes": True}


class RecipeCreate(BaseModel):
    name: str
    description: Optional[str] = None
    prep_time_min: Optional[int] = None
    cook_time_min: Optional[int] = None
    servings: int = 1
    category: Optional[str] = None
    glycemic_rating: Optional[str] = None
    instructions: str
    tags: Optional[str] = None
    ingredients: list[IngredientCreate] = []
    nutrition: Optional[NutritionCreate] = None


class RecipeRead(BaseModel):
    id: int
    name: str
    description: Optional[str] = None
    prep_time_min: Optional[int] = None
    cook_time_min: Optional[int] = None
    servings: int
    category: Optional[str] = None
    glycemic_rating: Optional[str] = None
    instructions: str
    image_path: Optional[str] = None
    tags: Optional[str] = None
    ingredients: list[IngredientRead] = []
    nutrition: Optional[NutritionRead] = None

    model_config = {"from_attributes": True}


# ── Meal Plans ────────────────────────────────────────
class MealPlanEntryCreate(BaseModel):
    recipe_id: int
    day_of_week: int = Field(ge=0, le=6)
    meal_slot: str
    serving_count: float = 1.0


class MealPlanEntryRead(BaseModel):
    id: int
    plan_id: int
    recipe_id: int
    day_of_week: int
    meal_slot: str
    serving_count: float
    recipe: Optional[RecipeRead] = None

    model_config = {"from_attributes": True}


class MealPlanCreate(BaseModel):
    week_start: date
    title: str
    entries: list[MealPlanEntryCreate] = []


class MealPlanRead(BaseModel):
    id: int
    week_start: date
    title: str
    created_at: datetime
    entries: list[MealPlanEntryRead] = []

    model_config = {"from_attributes": True}


class ShoppingListItem(BaseModel):
    category: Optional[str]
    name: str
    total_quantity: float
    unit: str


# ── Glucose ───────────────────────────────────────────
class GlucoseReadingRead(BaseModel):
    id: int
    date_time: datetime
    value_mgdl: float
    trend: Optional[str] = None
    type: str
    sync_source: str

    model_config = {"from_attributes": True}


class GlucoseStats(BaseModel):
    avg_glucose: float
    time_in_range_pct: float
    below_range_pct: float
    above_range_pct: float
    very_high_pct: float
    mgd: Optional[float] = None
    gmi: Optional[float] = None


class NightscoutConfig(BaseModel):
    nightscout_url: str
    api_token: str


# ── Exercise ──────────────────────────────────────────
class ExerciseEntryRead(BaseModel):
    id: int
    workout_type: str
    start_time: datetime
    end_time: datetime
    duration_min: float
    distance_km: Optional[float] = None
    calories_burned: float
    avg_heart_rate: Optional[int] = None
    max_heart_rate: Optional[int] = None
    import_source: str

    model_config = {"from_attributes": True}


class ExerciseSummary(BaseModel):
    total_workouts: int
    total_duration_min: float
    total_calories: float
    by_type: dict[str, dict]


# ── Dashboard ─────────────────────────────────────────
class LatestGlucose(BaseModel):
    value_mgdl: float
    date_time: datetime
    trend: Optional[str] = None


class BloodTestSummary(BaseModel):
    total_tests: int
    flagged_markers: int
    latest_test_date: Optional[date] = None


class DashboardStats(BaseModel):
    glucose_avg_7d: Optional[float] = None
    glucose_tir_pct: Optional[float] = None
    glucose_gmi: Optional[float] = None
    latest_glucose: Optional[LatestGlucose] = None

    blood_tests: Optional[BloodTestSummary] = None

    exercise_workouts_this_week: int = 0
    exercise_minutes_this_week: float = 0.0
    exercise_calories_this_week: float = 0.0

    recipe_count: int = 0
    meal_plan_count: int = 0
