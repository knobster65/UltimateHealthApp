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


def _compute_daily_targets(markers: list[dict]) -> str:
    """Build a targets instruction block from flagged marker values."""
    lines: list[str] = []
    for m in markers:
        if not m.get("flagged"):
            continue
        name = m["name"].lower()
        val = m["value"]
        high_ref = m.get("high_ref") or 100
        low_ref = m.get("low_ref") or 0

        if "glucose" in name and val > high_ref:
            lines.append("- Fasting glucose is high: keep each meal under 45g carbs, daily sugar under 25g, prioritize fiber.")
        elif "a1c" in name and val > high_ref:
            lines.append("- A1C elevated: all meals must be low-glycemic. Max 30g sugar/day, emphasize whole grains and legumes.")
        if "triglycerides" in name and val > high_ref:
            lines.append("- Triglycerides high: total daily calories under 1800, minimize carbs and alcohol sources, add omega-3.")
        if "cholesterol" in name and val > high_ref:
            lines.append("- Total cholesterol high: saturated fat under 15g/day, add soluble fiber (oats, beans) to every main meal.")
        if "ldl" in name and val > high_ref:
            lines.append("- LDL high: include oatmeal, beans, almonds. Avoid fried foods and full-fat dairy.")
        if "vitamin d" in name and val < low_ref:
            lines.append("- Vitamin D low: include fatty fish 2-3x/week, eggs, fortified milk, mushrooms.")
        if "hemoglobin" in name and val < low_ref:
            lines.append("- Hemoglobin low: add iron-rich foods (spinach, red meat, lentils) paired with vitamin C sources.")
        if "ferritin" in name and val < low_ref:
            lines.append("- Ferritin low: prioritize iron + vitamin C combinations. Avoid tea/coffee with meals.")
        if "b12" in name and val < low_ref:
            lines.append("- B12 low: include eggs, dairy, fortified cereals, lean meats daily.")
        if "hs crp" in name and val > high_ref:
            lines.append("- Inflammation elevated: add turmeric, ginger, omega-3 rich fish. Avoid processed foods.")
        if "uric acid" in name and val > high_ref:
            lines.append("- Uric acid high: avoid organ meats and shellfish. Limit red meat, add cherries and citrus.")

    if not lines:
        return "\n\nDaily nutrition targets: All markers normal — follow standard diabetic-friendly guidelines."
    return "\n\nDaily nutrition targets based on your blood work:\n" + "\n".join(lines)


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

    # Compute daily nutrition targets from flagged markers.
    daily_targets = _compute_daily_targets(all_markers)

    messages = [
        {
            "role": "system",
            "content": """You are a nutritionist for a diabetic patient. Generate 7 days × 4 meals (Breakfast, Lunch, Dinner, Snack) = 28 meals total.

Return ONLY valid JSON: {"meals": [...]}. Each meal:
- day, slot, name, description, prep_time_min, cook_time_min, servings, category, glycemic_rating
- instructions: Full step-by-step cooking directions (at least 4-5 steps per recipe)
- ingredients: [{"name", "quantity", "unit", "category"}] — categories: produce, proteins, dairy, grains, pantry, frozen, spices-herbs, beverages
- nutrition: {"calories", "protein_g", "carbs_g", "fat_g", "fiber_g", "sugar_g"}

Rules: low-glycemic, high-fiber, lean protein. Main meals 400-600 cal, snacks 150-250 cal. No repeats.""" + daily_targets
        },
        {
            "role": "user",
            "content": f"Blood tests — flagged:\n{flagged_text}\n\nAll markers:\n{marker_list}\n\nGenerate full meal plan with detailed instructions."
        }
    ]

    raw_text = await call_ai_api(messages)

    import json
    import re
    from json_repair import repair_json

    # Strip markdown code fences if present.
    cleaned = re.sub(r'^```(?:json)?\s*\n?', '', raw_text, flags=re.MULTILINE)
    cleaned = re.sub(r'\n?```\s*$', '', cleaned, flags=re.MULTILINE)

    try:
        result = json.loads(cleaned)
    except json.JSONDecodeError:
        repaired = repair_json(cleaned)
        if isinstance(repaired, dict):
            result = repaired
        else:
            return {"error": f"Could not parse AI response as JSON. Response length: {len(raw_text)} chars.", "raw": raw_text[:1000]}

    return result.get("meals", [])
