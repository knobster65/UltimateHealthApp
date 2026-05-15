from datetime import date

import pytest

from app.models import (
    BloodTest, BloodMarker, MedicationEntry, Recipe, RecipeIngredient, RecipeNutrition,
    MealPlan, MealPlanEntry,
)
from app.auth import hash_password, verify_password


class TestAuth:
    def test_password_hash_and_verify(self):
        h = hash_password("mysecret")
        assert verify_password("mysecret", h)
        assert not verify_password("wrongpassword", h)

    def test_different_hashes_different(self):
        h1 = hash_password("pass")
        h2 = hash_password("pass")
        assert h1 != h2


class TestBloodTestModels:
    def test_create_blood_test_with_markers(self, db_session):
        test = BloodTest(user_id=1, date_tested=date(2025, 8, 1), lab_name="Quest")
        db_session.add(test)
        db_session.flush()

        marker = BloodMarker(
            test_id=test.id,
            category="glucose",
            marker_name="HbA1c",
            value=6.2,
            unit="%",
            low_ref=4.0,
            high_ref=5.7,
            is_flagged=True,
        )
        db_session.add(marker)
        db_session.commit()

        assert test.markers[0].marker_name == "HbA1c"
        assert len(test.markers) == 1


class TestMedicationModels:
    def test_create_active_medication(self, db_session):
        med = MedicationEntry(
            user_id=1,
            medication_name="Metformin",
            dosage="500mg",
            frequency="Twice daily",
            start_date=date(2025, 1, 1),
        )
        db_session.add(med)
        db_session.commit()
        assert med.end_date is None

    def test_create_ended_medication(self, db_session):
        med = MedicationEntry(
            user_id=1,
            medication_name="Antibiotic",
            start_date=date(2025, 1, 1),
            end_date=date(2025, 1, 14),
        )
        db_session.add(med)
        db_session.commit()
        assert med.end_date == date(2025, 1, 14)


class TestRecipeModels:
    def test_create_recipe_with_ingredients_and_nutrition(self, db_session):
        recipe = Recipe(user_id=1, name="Salad", instructions="Toss ingredients together.", servings=2)
        db_session.add(recipe)
        db_session.flush()

        db_session.add(RecipeIngredient(recipe_id=recipe.id, name="Lettuce", quantity=1.0, unit="head"))
        db_session.add(RecipeNutrition(
            recipe_id=recipe.id,
            calories=200,
            protein_g=5,
            carbs_g=15,
            fat_g=10,
            fiber_g=4,
            sugar_g=3,
        ))
        db_session.commit()

        assert len(recipe.ingredients) == 1
        assert recipe.nutrition.calories == 200


class TestMealPlanModels:
    def test_create_meal_plan_with_entries(self, db_session):
        plan = MealPlan(user_id=1, week_start=date(2025, 8, 4), title="Week Plan")
        db_session.add(plan)
        db_session.flush()

        entry = MealPlanEntry(
            plan_id=plan.id,
            recipe_id=1,
            day_of_week=1,
            meal_slot="lunch",
            serving_count=1.0,
        )
        db_session.add(entry)
        db_session.commit()

        assert len(plan.entries) == 1
