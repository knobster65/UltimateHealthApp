import { useParams, Link } from 'react-router-dom'
import { useMealPlans } from '../../hooks/useMealPlans'
import type { MealPlanDetailEntry } from '../../types'

const days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']

export default function PrintView() {
  const { planId } = useParams<{ planId: string }>()
  const id = planId ? Number(planId) : null
  const { data, isLoading } = useMealPlans().planDetailQuery(id!)

  if (isLoading || !data) return <PrintLoading />

  const shoppingItems = computeShoppingList(data.entries)

  // Group entries by day then slot.
  const dayMap: Record<number, MealPlanDetailEntry[]> = {}
  for (const entry of data.entries) {
    if (!dayMap[entry.day_of_week]) dayMap[entry.day_of_week] = []
    dayMap[entry.day_of_week].push(entry)
  }

  return (
    <div className="max-w-4xl mx-auto">
      {/* No-print controls */}
      <div className="no-print flex items-center justify-between mb-6">
        <Link to="/meals/planner" className="text-primary-600 hover:text-primary-700 text-sm">
          ← Back to Planner
        </Link>
        <button onClick={() => window.print()} className="bg-emerald-600 text-white px-6 py-2 rounded-xl font-semibold hover:bg-emerald-700 transition-colors">
          Print
        </button>
      </div>

      <style>{printStyles}</style>

      {/* Plan title */}
      <div className="text-center mb-8 print-only-header">
        <h1 className="text-2xl font-bold text-[var(--text-primary)]">{data.title}</h1>
        <p className="text-sm text-[var(--text-muted)] mt-1">Week of {new Date(data.week_start).toLocaleDateString()}</p>
      </div>

      {/* Weekly summary table */}
      <WeeklySummary dayMap={dayMap} />

      {/* Individual recipes */}
      {data.entries.map((entry, i) => (
        <RecipePage key={`${entry.id}-${i}`} entry={entry} dayName={days[entry.day_of_week]} />
      ))}

      {/* Shopping list */}
      <ShoppingPrintSection items={shoppingItems} />
    </div>
  )
}

function PrintLoading() {
  return (
    <div className="flex items-center gap-3 p-12">
      <div className="w-5 h-5 border-2 border-primary-500 border-t-transparent rounded-full animate-spin" />
      <p className="text-[var(--text-muted)]">Loading meal plan...</p>
    </div>
  )
}

function WeeklySummary({ dayMap }: { dayMap: Record<number, MealPlanDetailEntry[]> }) {
  const getEntry = (day: number, slot: string) =>
    dayMap[day]?.find(e => e.meal_slot.toLowerCase() === slot.toLowerCase())

  return (
    <div className="mb-12">
      <h2 className="text-lg font-bold text-[var(--text-primary)] mb-4">Weekly Overview</h2>
      <div className="overflow-x-auto">
        <table className="w-full text-sm border-collapse">
          <thead>
            <tr className="border-b-2 border-[var(--border-default)]">
              <th className="text-left py-2 px-2 text-[var(--text-muted)] uppercase text-xs font-semibold">Meal</th>
              {days.map(d => (
                <th key={d} className="text-center py-2 px-1 text-[var(--text-muted)] uppercase text-xs font-semibold">{d.slice(0, 3)}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {['Breakfast', 'Lunch', 'Dinner', 'Snack'].map(slot => (
              <tr key={slot} className="border-b border-[var(--border-default)]">
                <td className="py-2 px-2 font-medium text-[var(--text-secondary)]">{slot}</td>
                {days.map((_, di) => {
                  const entry = getEntry(di, slot)
                  return (
                    <td key={di} className="py-2 px-1 text-center">
                      {entry ? (
                        <div>
                          <div className="font-medium text-[var(--text-primary)] truncate">{entry.recipe_name}</div>
                          {entry.nutrition ? (
                            <div className="text-xs text-[var(--text-muted)]">
                              {Math.round(entry.nutrition.calories * entry.serving_count)} cal
                            </div>
                          ) : null}
                        </div>
                      ) : (
                        <span className="text-[var(--text-muted)]">—</span>
                      )}
                    </td>
                  )
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function RecipePage({ entry, dayName }: { entry: MealPlanDetailEntry; dayName: string }) {
  const instructions = entry.recipe_instructions || ''
  const steps = Array.isArray(instructions)
    ? instructions.map(String)
    : instructions.split('\n').filter(Boolean)

  return (
    <div className="mb-8 page-break-after border border-[var(--border-default)] rounded-xl p-6 bg-[var(--bg-surface)]">
      <div className="flex items-start justify-between mb-3">
        <div>
          <div className="flex gap-2 mb-1">
            <span className="text-xs font-semibold text-primary-600 uppercase">{dayName}</span>
            <span className="text-xs font-semibold text-[var(--text-muted)]">•</span>
            <span className="text-xs font-semibold text-[var(--text-secondary)]">{entry.meal_slot}</span>
          </div>
          <h3 className="text-lg font-bold text-[var(--text-primary)]">{entry.recipe_name}</h3>
        </div>
        {entry.recipe_glycemic_rating && (
          <span className={`text-xs px-2 py-1 rounded-full ${glycemicColor(entry.recipe_glycemic_rating)}`}>
            {entry.recipe_glycemic_rating}
          </span>
        )}
      </div>

      {entry.recipe_description && (
        <p className="text-sm text-[var(--text-secondary)] mb-4">{entry.recipe_description}</p>
      )}

      {(entry.prep_time_min || entry.cook_time_min) && (
        <div className="flex gap-4 mb-4 text-xs text-[var(--text-muted)]">
          {entry.prep_time_min && <span>Prep: {entry.prep_time_min} min</span>}
          {entry.cook_time_min && <span>Cook: {entry.cook_time_min} min</span>}
        </div>
      )}

      {/* Ingredients */}
      <div className="mb-4">
        <h4 className="text-xs font-semibold text-[var(--text-secondary)] uppercase tracking-wide mb-2">Ingredients</h4>
        <ul className="grid grid-cols-2 gap-1 text-sm text-[var(--text-primary)]">
          {entry.ingredients.map((ing, i) => (
            <li key={i} className="flex items-center gap-1">
              <span className="text-[var(--text-muted)]">•</span>
              <span>{ing.quantity} {ing.unit} {ing.name}</span>
            </li>
          ))}
        </ul>
      </div>

      {/* Instructions */}
      {steps.length > 0 && (
        <div className="mb-4">
          <h4 className="text-xs font-semibold text-[var(--text-secondary)] uppercase tracking-wide mb-2">Instructions</h4>
          <ol className="space-y-1 text-sm text-[var(--text-primary)]">
            {steps.map((step, i) => (
              <li key={i} className="flex gap-2">
                <span className="text-[var(--text-muted)] shrink-0 w-5 text-right">{i + 1}.</span>
                <span>{step}</span>
              </li>
            ))}
          </ol>
        </div>
      )}

      {/* Nutrition */}
      {entry.nutrition && (
        <div>
          <h4 className="text-xs font-semibold text-[var(--text-secondary)] uppercase tracking-wide mb-2">Nutrition (per serving × {entry.serving_count})</h4>
          <div className="grid grid-cols-3 gap-2 text-sm text-center">
            <div className="bg-[var(--bg-hover)] rounded-lg p-2">
              <div className="font-bold">{Math.round(entry.nutrition.calories * entry.serving_count)}</div>
              <div className="text-xs text-[var(--text-muted)]">Calories</div>
            </div>
            <div className="bg-[var(--bg-hover)] rounded-lg p-2">
              <div className="font-bold">{Math.round(entry.nutrition.protein_g * entry.serving_count)}g</div>
              <div className="text-xs text-[var(--text-muted)]">Protein</div>
            </div>
            <div className="bg-[var(--bg-hover)] rounded-lg p-2">
              <div className="font-bold">{Math.round(entry.nutrition.carbs_g * entry.serving_count)}g</div>
              <div className="text-xs text-[var(--text-muted)]">Carbs</div>
            </div>
            <div className="bg-[var(--bg-hover)] rounded-lg p-2">
              <div className="font-bold">{Math.round(entry.nutrition.fat_g * entry.serving_count)}g</div>
              <div className="text-xs text-[var(--text-muted)]">Fat</div>
            </div>
            <div className="bg-[var(--bg-hover)] rounded-lg p-2">
              <div className="font-bold">{Math.round(entry.nutrition.fiber_g * entry.serving_count)}g</div>
              <div className="text-xs text-[var(--text-muted)]">Fiber</div>
            </div>
            <div className="bg-[var(--bg-hover)] rounded-lg p-2">
              <div className="font-bold">{Math.round(entry.nutrition.sugar_g * entry.serving_count)}g</div>
              <div className="text-xs text-[var(--text-muted)]">Sugar</div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function ShoppingPrintSection({ items }: { items: Array<{ category: string; name: string; qty: number; unit: string }> }) {
  const grouped = groupByCategory(items)

  if (!grouped.length) return null

  return (
    <div className="mb-12 page-break-after">
      <h2 className="text-lg font-bold text-[var(--text-primary)] mb-4">Shopping List</h2>
      {grouped.map(group => (
        <div key={group.category} className="mb-4">
          <h3 className="text-xs font-semibold text-[var(--text-secondary)] uppercase tracking-wide border-b border-[var(--border-default)] pb-1 mb-2">
            {group.category}
          </h3>
          <ul className="grid grid-cols-2 gap-1 text-sm text-[var(--text-primary)]">
            {group.items.map((item, i) => (
              <li key={i} className="flex items-center gap-1">
                <span className="text-[var(--text-muted)]">☐</span>
                <span>{item.name} — {item.qty.toFixed(1)} {item.unit}</span>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  )
}

function computeShoppingList(entries: MealPlanDetailEntry[]) {
  const map = new Map<string, { qty: number; unit: string }>()
  for (const entry of entries) {
    for (const ing of entry.ingredients) {
      const key = `${ing.category || 'Other'}::${ing.name.toLowerCase()}`
      const existing = map.get(key)
      if (!existing) {
        map.set(key, { qty: ing.quantity * entry.serving_count, unit: ing.unit })
      } else {
        existing.qty += ing.quantity * entry.serving_count
      }
    }
  }
  return Array.from(map.entries()).map(([key, info]) => ({
    category: key.split('::')[0],
    name: key.split('::')[1],
    ...info,
  }))
}

function groupByCategory(items: Array<{ category: string; name: string; qty: number; unit: string }>) {
  const map = new Map<string, typeof items>()
  for (const item of items) {
    if (!map.has(item.category)) map.set(item.category, [])
    map.get(item.category)!.push(item)
  }
  return Array.from(map.entries()).map(([category, items]) => ({ category, items }))
}

function glycemicColor(rating: string) {
  if (rating === 'low') return 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400'
  if (rating === 'medium') return 'bg-yellow-100 text-yellow-700'
  return 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400'
}

const printStyles = `
@media print {
  .no-print { display: none !important; }
  .page-break-after { page-break-after: always; break-after: page; }
  body { background: white !important; color: black !important; }
  table, thead, tbody, tr, th, td { page-break-inside: avoid; }
  a { text-decoration: none; color: black; }
}
`
