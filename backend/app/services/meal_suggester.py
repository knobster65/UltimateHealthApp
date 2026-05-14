from collections import defaultdict
from app.models import BloodTest, RecipeNutrition, Recipe


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


def analyze_and_suggest(db) -> dict:
    """Analyze latest blood test markers and return flagged issues with recipe suggestions."""
    from sqlalchemy import select

    latest = db.execute(
        select(BloodTest).order_by(BloodTest.date_tested.desc()).limit(1)
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

    recipes = db.execute(select(Recipe).join(RecipeNutrition)).scalars().all()
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
