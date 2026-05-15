from collections import defaultdict
from datetime import date, datetime, timedelta
from app.models import BloodTest, BloodMarker, RecipeNutrition, Recipe


# Maps blood markers to dietary guidance. Each entry: (guidance_text, [(nutrient_field, weight), ...])
MARKER_RULES: dict[str, dict[str, tuple[str, list[tuple[str, float]]]]] = {
    "hemoglobin": {
        "low": ("Below range — consider iron-rich meals", [("protein", 1.0), ("calories", 0.3)]),
        "high": ("Above range — stay hydrated, moderate red meat", [("protein", -0.5)]),
    },
    "ferritin": {
        "low": ("Low iron stores — eat iron + vitamin C rich foods", [("protein", 1.0), ("calories", 0.5)]),
        "high": ("High iron stores — limit red meat and iron supplements", [("protein", -0.3)]),
    },
    "vitamin d": {
        "low": ("Low vitamin D — fatty fish, eggs, fortified foods", [("calories", 0.3), ("fat", 0.5)]),
        "high": ("High vitamin D — reduce supplements", []),
    },
    "cholesterol total": {
        "high": ("High cholesterol — low saturated fat, high fiber", [("fiber", 1.0), ("fat", -1.0), ("sugar", -0.5)]),
    },
    "ldl": {
        "high": ("High LDL — soluble fiber, plant sterols", [("fiber", 1.0), ("fat", -0.8)]),
    },
    "triglycerides": {
        "high": ("High triglycerides — cut sugar and refined carbs", [("carbs_g", -0.7), ("sugar", -1.0), ("fiber", 0.5)]),
    },
    "glucose fasting": {
        "high": ("High fasting glucose — low glycemic, high fiber", [("fiber", 1.0), ("carbs_g", -0.6), ("sugar", -0.8)]),
    },
    "a1c": {
        "high": ("Elevated A1C — emphasize low-glycemic recipes", [("fiber", 0.8), ("sugar", -1.0), ("carbs_g", -0.5)]),
    },
    "hs crp": {
        "high": ("Inflammation elevated — anti-inflammatory foods, omega-3", [("fiber", 0.5), ("fat", -0.3)]),
    },
    "uric acid": {
        "high": ("High uric acid — low purine, avoid organ meats", [("protein", -0.4), ("carbs_g", 0.3)]),
    },
    "b12": {
        "low": ("Low B12 — eggs, dairy, fortified cereals", [("protein", 0.5), ("calories", 0.3)]),
    },
}

GLYCEMIC_SCORE = {"low": 1.0, "medium": 0.2, "high": -0.8}


def analyze_and_suggest(db, user_id: int) -> dict:
    """Analyze latest blood test markers and return flagged issues with recipe suggestions."""
    from sqlalchemy import select

    latest = db.execute(
        select(BloodTest).where(BloodTest.user_id == user_id).order_by(BloodTest.date_tested.desc()).limit(1)
    ).scalar_one_or_none()

    if not latest or not latest.markers:
        return {"flagged": [], "suggestions": [], "message": "No blood test data available. Upload results first."}

    flagged = []
    nutrient_prefs: dict[str, float] = defaultdict(float)

    for marker in latest.markers:
        name_lower = marker.marker_name.lower()
        rule = MARKER_RULES.get(name_lower)
        if not rule:
            continue

        condition = None
        if marker.low_ref is not None and marker.value < marker.low_ref:
            condition = "low"
        elif marker.high_ref is not None and marker.value > marker.high_ref:
            condition = "high"

        if condition and condition in rule:
            guidance, prefs = rule[condition]
            direction = "Low" if condition == "low" else "High"
            flagged.append({
                "marker": marker.marker_name,
                "value": marker.value,
                "unit": marker.unit,
                "ref_range": f"{marker.low_ref}-{marker.high_ref}",
                "direction": direction,
                "guidance": guidance,
            })
            for field, weight in prefs:
                nutrient_prefs[field] += weight

    if not flagged:
        return {"flagged": [], "suggestions": [], "message": "All markers are within normal range. Great job!"}

    recipes = db.execute(
        select(Recipe).where(Recipe.user_id == user_id).join(RecipeNutrition)
    ).scalars().all()
    scored: list[dict] = []

    for recipe in recipes:
        nutrition = recipe.nutrition
        if not nutrition:
            continue

        score = 0.0
        if nutrient_prefs.get("protein"):
            norm = max(nutrition.protein_g, 1)
            score += (nutrition.protein_g / norm) * nutrient_prefs["protein"]
        if nutrient_prefs.get("calories"):
            norm = max(nutrition.calories, 10)
            score += (nutrition.calories / norm) * nutrient_prefs["calories"]
        if nutrient_prefs.get("carbs_g"):
            norm = max(nutrition.carbs_g, 1)
            score += (nutrition.carbs_g / norm) * nutrient_prefs["carbs_g"]
        if nutrient_prefs.get("fat"):
            norm = max(nutrition.fat_g, 1)
            score += (nutrition.fat_g / norm) * nutrient_prefs["fat"]
        if nutrient_prefs.get("fiber"):
            norm = max(nutrition.fiber_g, 1)
            score += (nutrition.fiber_g / norm) * nutrient_prefs["fiber"]
        if nutrient_prefs.get("sugar"):
            norm = max(nutrition.sugar_g, 1) if nutrition.sugar_g > 0 else 1
            score += (nutrition.sugar_g / norm) * nutrient_prefs["sugar"]

        gly_score = GLYCEMIC_SCORE.get(recipe.glycemic_rating or "", 0)
        wants_low_glycemic = nutrient_prefs.get("sugar", 0) < 0 or nutrient_prefs.get("carbs_g", 0) < 0
        if wants_low_glycemic:
            score += gly_score

        scored.append({
            "recipe_id": recipe.id,
            "name": recipe.name,
            "category": recipe.category,
            "glycemic_rating": recipe.glycemic_rating,
            "score": round(score, 2),
        })

    scored.sort(key=lambda r: r["score"], reverse=True)
    top = scored[:6] if len(scored) > 6 else scored

    return {"flagged": flagged, "suggestions": top, "message": None}


async def generate_meal_plan_from_bloodwork(db, user_id: int):
    """Use AI to analyze blood markers and generate a full week's tailored meal plan with new recipes."""
    from app.services.pdf_parser import call_ai_api

    six_months_ago = (datetime.now() - timedelta(days=180)).date()
    recent_tests = db.query(BloodTest).filter(
        BloodTest.user_id == user_id,
        BloodTest.date_tested >= six_months_ago
    ).order_by(BloodTest.date_tested.desc()).all()

    if not recent_tests:
        return {"error": "No blood test data available. Upload results first."}

    all_markers = []
    flagged_markers = []
    for test in recent_tests:
        for marker in test.markers:
            info = {
                "name": marker.marker_name,
                "value": marker.value,
                "unit": marker.unit,
                "low_ref": marker.low_ref,
                "high_ref": marker.high_ref,
                "flagged": marker.is_flagged,
            }
            all_markers.append(info)
            if marker.is_flagged:
                direction = ""
                if marker.low_ref is not None and marker.value < marker.low_ref:
                    direction = "(LOW)"
                elif marker.high_ref is not None and marker.value > marker.high_ref:
                    direction = "(HIGH)"
                flagged_markers.append(f"- {marker.marker_name}: {marker.value} {marker.unit} {direction}")

    flagged_text = "\n".join(flagged_markers) if flagged_markers else "None — all markers normal"
    marker_list = "\n".join([f"  {m['name']}: {m['value']} {m['unit']}" for m in all_markers[:20]])

    messages = [
        {
            "role": "system",
            "content": """You are a nutritionist and meal planner for a patient with diabetes and metabolic concerns.
Generate a full week (Monday-Sunday) meal plan with Breakfast, Lunch, Dinner, and Snack for each day.

For each meal slot, return ONE recipe entry. Return ONLY valid JSON with this exact structure:
{
  "meals": [
    {
      "day": "Monday",
      "slot": "Breakfast",
      "name": "Recipe name",
      "description": "Brief one-line description",
      "prep_time_min": 10,
      "cook_time_min": 15,
      "servings": 1,
      "category": "breakfast",
      "glycemic_rating": "low",
      "instructions": "Step by step cooking instructions in one paragraph.",
      "ingredients": [
        {"name": "Ingredient", "quantity": 1.0, "unit": "cup"},
      ],
      "nutrition": {
        "calories": 350,
        "protein_g": 20,
        "carbs_g": 40,
        "fat_g": 12,
        "fiber_g": 8,
        "sugar_g": 6
      }
    }
  ]
}

Dietary rules:
- Focus on low-glycemic, high-fiber foods
- Lean proteins, omega-3 rich sources (salmon, walnuts, flaxseed)
- Plenty of vegetables, especially leafy greens
- Minimal added sugar and refined carbs
- Healthy fats (olive oil, avocado, nuts)
- Portion-controlled meals around 400-600 calories per main meal, 150-250 for snacks
- Each recipe should be different — no repeats across the week
- Make it practical with ingredients from a regular grocery store
- day values must be: Monday, Tuesday, Wednesday, Thursday, Friday, Saturday, Sunday
- slot values must be: Breakfast, Lunch, Dinner, Snack"""
        },
        {
            "role": "user",
            "content": f"My recent blood test results:\n\nFlagged/out-of-range markers:\n{flagged_text}\n\nAll markers:\n{marker_list}\n\nPlease generate a complete week meal plan tailored to my health needs."
        }
    ]

    raw_text = await call_ai_api(messages)

    import json
    import re
    try:
        result = json.loads(raw_text)
    except json.JSONDecodeError:
        match = re.search(r'\{.*\}', raw_text, re.DOTALL)
        if match:
            result = json.loads(match.group(0))
        else:
            return {"error": "Could not parse AI meal plan response", "raw": raw_text[:300]}

    return result.get("meals", [])
