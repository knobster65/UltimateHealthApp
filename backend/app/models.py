from datetime import datetime, date, time
from sqlalchemy import (
    String, Float, Text, Boolean, Integer, DateTime, Date, ForeignKey, func
)
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.database import Base


class User(Base):
    __tablename__ = "users"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    username: Mapped[str] = mapped_column(String(50), unique=True, index=True)
    password_hash: Mapped[str] = mapped_column(String(256))
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())


class BloodTest(Base):
    __tablename__ = "blood_tests"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    date_tested: Mapped[date] = mapped_column(Date, index=True)
    lab_name: Mapped[str | None] = mapped_column(String(100), nullable=True)
    pdf_path: Mapped[str | None] = mapped_column(String(500), nullable=True)
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())

    markers: Mapped[list["BloodMarker"]] = relationship(back_populates="test", cascade="all, delete-orphan")


class BloodMarker(Base):
    __tablename__ = "blood_markers"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    test_id: Mapped[int] = mapped_column(ForeignKey("blood_tests.id", ondelete="CASCADE"))
    category: Mapped[str] = mapped_column(String(50))
    marker_name: Mapped[str] = mapped_column(String(100), index=True)
    value: Mapped[float] = mapped_column(Float)
    unit: Mapped[str] = mapped_column(String(30))
    low_ref: Mapped[float | None] = mapped_column(Float, nullable=True)
    high_ref: Mapped[float | None] = mapped_column(Float, nullable=True)
    is_flagged: Mapped[bool] = mapped_column(Boolean, default=False)

    test: Mapped["BloodTest"] = relationship(back_populates="markers")


class Recipe(Base):
    __tablename__ = "recipes"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    name: Mapped[str] = mapped_column(String(200), index=True)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    prep_time_min: Mapped[int | None] = mapped_column(Integer, nullable=True)
    cook_time_min: Mapped[int | None] = mapped_column(Integer, nullable=True)
    servings: Mapped[int] = mapped_column(Integer, default=1)
    category: Mapped[str | None] = mapped_column(String(50), nullable=True)
    glycemic_rating: Mapped[str | None] = mapped_column(String(20), nullable=True)
    instructions: Mapped[str] = mapped_column(Text)
    image_path: Mapped[str | None] = mapped_column(String(500), nullable=True)
    tags: Mapped[str | None] = mapped_column(String(500), nullable=True)

    ingredients: Mapped[list["RecipeIngredient"]] = relationship(back_populates="recipe", cascade="all, delete-orphan")
    nutrition: Mapped["RecipeNutrition | None"] = relationship(back_populates="recipe", uselist=False, cascade="all, delete-orphan")


class RecipeIngredient(Base):
    __tablename__ = "recipe_ingredients"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    recipe_id: Mapped[int] = mapped_column(ForeignKey("recipes.id", ondelete="CASCADE"))
    name: Mapped[str] = mapped_column(String(200))
    quantity: Mapped[float] = mapped_column(Float)
    unit: Mapped[str] = mapped_column(String(30))
    category: Mapped[str | None] = mapped_column(String(50), nullable=True)

    recipe: Mapped["Recipe"] = relationship(back_populates="ingredients")


class RecipeNutrition(Base):
    __tablename__ = "recipe_nutrition"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    recipe_id: Mapped[int] = mapped_column(ForeignKey("recipes.id", ondelete="CASCADE"), unique=True)
    calories: Mapped[float] = mapped_column(Float)
    protein_g: Mapped[float] = mapped_column(Float, default=0)
    carbs_g: Mapped[float] = mapped_column(Float, default=0)
    fat_g: Mapped[float] = mapped_column(Float, default=0)
    fiber_g: Mapped[float] = mapped_column(Float, default=0)
    sugar_g: Mapped[float] = mapped_column(Float, default=0)

    recipe: Mapped["Recipe"] = relationship(back_populates="nutrition")


class MealPlan(Base):
    __tablename__ = "meal_plans"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    week_start: Mapped[date] = mapped_column(Date, index=True)
    title: Mapped[str] = mapped_column(String(200))
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())

    entries: Mapped[list["MealPlanEntry"]] = relationship(back_populates="plan", cascade="all, delete-orphan")


class MealPlanEntry(Base):
    __tablename__ = "meal_plan_entries"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    plan_id: Mapped[int] = mapped_column(ForeignKey("meal_plans.id", ondelete="CASCADE"))
    recipe_id: Mapped[int] = mapped_column(ForeignKey("recipes.id"))
    day_of_week: Mapped[int] = mapped_column(Integer)
    meal_slot: Mapped[str] = mapped_column(String(20))
    serving_count: Mapped[float] = mapped_column(Float, default=1.0)

    plan: Mapped["MealPlan"] = relationship(back_populates="entries")
    recipe: Mapped["Recipe"] = relationship()


class GlucoseReading(Base):
    __tablename__ = "glucose_readings"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    date_time: Mapped[datetime] = mapped_column(DateTime, index=True)
    value_mgdl: Mapped[float] = mapped_column(Float)
    trend: Mapped[str | None] = mapped_column(String(20), nullable=True)
    type: Mapped[str] = mapped_column(String(20), default="sgv")
    source_entry_id: Mapped[str | None] = mapped_column(String(100), unique=True, nullable=True)
    sync_source: Mapped[str] = mapped_column(String(50), default="nightscout")


class GlucoseSyncLog(Base):
    __tablename__ = "glucose_sync_log"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    synced_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())
    start_time: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    end_time: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    entries_fetched: Mapped[int] = mapped_column(Integer, default=0)
    entries_stored: Mapped[int] = mapped_column(Integer, default=0)


class ExerciseEntry(Base):
    __tablename__ = "exercise_entries"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    workout_type: Mapped[str] = mapped_column(String(100), index=True)
    start_time: Mapped[datetime] = mapped_column(DateTime, index=True)
    end_time: Mapped[datetime] = mapped_column(DateTime)
    duration_min: Mapped[float] = mapped_column(Float)
    distance_km: Mapped[float | None] = mapped_column(Float, nullable=True)
    calories_burned: Mapped[float] = mapped_column(Float)
    avg_heart_rate: Mapped[int | None] = mapped_column(Integer, nullable=True)
    max_heart_rate: Mapped[int | None] = mapped_column(Integer, nullable=True)
    import_source: Mapped[str] = mapped_column(String(100), default="apple_health")
    import_batch_id: Mapped[str | None] = mapped_column(String(50), nullable=True)


class MedicationEntry(Base):
    __tablename__ = "medication_entries"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    medication_name: Mapped[str] = mapped_column(String(100))
    dosage: Mapped[Optional[str]] = mapped_column(String(50), nullable=True)
    frequency: Mapped[Optional[str]] = mapped_column(String(50), nullable=True)
    start_date: Mapped[date] = mapped_column(Date)
    end_date: Mapped[Optional[date]] = mapped_column(Date, nullable=True)  # NULL means currently taking
    notes: Mapped[Optional[str]] = mapped_column(Text, nullable=True)


class MedicationInteraction(Base):
    __tablename__ = "medication_interactions"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    medication_name: Mapped[str] = mapped_column(String(100))
    blood_marker: Mapped[Optional[str]] = mapped_column(String(50), nullable=True)
    interaction_type: Mapped[str] = mapped_column(String(20))  # "warning" or "info"
    description: Mapped[str] = mapped_column(Text)
    date_found: Mapped[date] = mapped_column(Date, default=date.today)
