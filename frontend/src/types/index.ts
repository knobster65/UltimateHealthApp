export interface UserInfo {
  id: number
  username: string
}

export interface MarkerCreate {
  category: string
  marker_name: string
  value: number
  unit: string
  low_ref?: number | null
  high_ref?: number | null
}

export interface BloodTest {
  id: number
  date_tested: string
  lab_name?: string | null
  pdf_path?: string | null
  notes?: string | null
  created_at: string
  markers: BloodMarker[]
}

export interface BloodMarker {
  id: number
  test_id: number
  category: string
  marker_name: string
  value: number
  unit: string
  low_ref?: number | null
  high_ref?: number | null
  is_flagged: boolean
}

export interface IngredientCreate {
  name: string
  quantity: number
  unit: string
  category?: string | null
}

export interface NutritionCreate {
  calories: number
  protein_g?: number
  carbs_g?: number
  fat_g?: number
  fiber_g?: number
  sugar_g?: number
}

export interface Recipe {
  id: number
  name: string
  description?: string | null
  prep_time_min?: number | null
  cook_time_min?: number | null
  servings: number
  category?: string | null
  glycemic_rating?: string | null
  instructions: string
  image_path?: string | null
  tags?: string | null
  ingredients: Ingredient[]
  nutrition?: Nutrition | null
}

export interface Ingredient {
  id: number
  recipe_id: number
  name: string
  quantity: number
  unit: string
  category?: string | null
}

export interface Nutrition {
  id: number
  recipe_id: number
  calories: number
  protein_g: number
  carbs_g: number
  fat_g: number
  fiber_g: number
  sugar_g: number
}

export interface MealPlanEntryCreate {
  recipe_id: number
  day_of_week: number
  meal_slot: string
  serving_count?: number
}

export interface MealPlan {
  id: number
  week_start: string
  title: string
  created_at: string
  entries: MealPlanEntry[]
}

export interface MealPlanEntry {
  id: number
  plan_id: number
  recipe_id: number
  day_of_week: number
  meal_slot: string
  serving_count: number
  recipe?: Recipe | null
}

export interface GlucoseReading {
  id: number
  date_time: string
  value_mgdl: number
  trend?: string | null
  type: string
  sync_source: string
}

export interface GlucoseStats {
  avg_glucose: number
  time_in_range_pct: number
  below_range_pct: number
  above_range_pct: number
  very_high_pct: number
  mgd?: number | null
  gmi?: number | null
}

export interface ExerciseEntry {
  id: number
  workout_type: string
  start_time: string
  end_time: string
  duration_min: number
  distance_km?: number | null
  calories_burned: number
  avg_heart_rate?: number | null
  max_heart_rate?: number | null
  import_source: string
}

export interface ShoppingListItem {
  category?: string | null
  name: string
  total_quantity: number
  unit: string
}
