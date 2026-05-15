import { useState, useMemo, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import api from '../../lib/api'
import { Link } from 'react-router-dom'
import { useMealPlans } from '../../hooks/useMealPlans'
import type { MealPlanDetail, MealPlanDetailEntry } from '../../types'

const days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']
const slots = ['Breakfast', 'Lunch', 'Dinner', 'Snack']

interface FlaggedMarker {
  marker: string
  value: number
  unit: string
  ref_range: string
  direction: string
  guidance?: string
}

type AnalysisResult = { flagged: FlaggedMarker[]; message: string | null }
type GenStep = 0 | 1 | 2
const stepLabels = ['Analyzing blood tests...', 'Generating recipes...', 'Building your meal plan...']

export default function AIMealPlanner() {
  const queryClient = useQueryClient()
  const { generateAIMealPlanMutation, planDetailQuery } = useMealPlans()
  const [genPlanId, setGenPlanId] = useState<number | null>(null)
  const [genStep, setGenStep] = useState<GenStep>(0)
  const [checkedItems, setCheckedItems] = useState<Set<string>>(new Set())

  // Step 1: Auto-analyze blood tests
  const { data: analysis, isLoading: analyzing } = useQuery<AnalysisResult>({
    queryKey: ['suggestions'],
    queryFn: async () => {
      const { data } = await api.get('/suggestions/')
      return data
    },
  })

  // Track generation progress
  useEffect(() => {
    if (generateAIMealPlanMutation.isPending) {
      setGenStep(0)
      const t1 = setTimeout(() => setGenStep(1), 5000)
      const t2 = setTimeout(() => setGenStep(2), 20000)
      return () => { clearTimeout(t1); clearTimeout(t2) }
    }
  }, [generateAIMealPlanMutation.isPending])

  // Capture plan_id on success
  useEffect(() => {
    if (generateAIMealPlanMutation.isSuccess && generateAIMealPlanMutation.data?.plan_id) {
      setGenPlanId(generateAIMealPlanMutation.data.plan_id)
    }
  }, [generateAIMealPlanMutation.isSuccess, generateAIMealPlanMutation.data])

  // Fetch plan detail when we have a plan_id
  const planDetail = genPlanId
    ? planDetailQuery(genPlanId).data
    : null

  // Compute shopping list from plan detail entries
  const shoppingList = useMemo(() => {
    if (!planDetail) return []
    const map = new Map<string, { items: Set<string>; qty: number; unit: string }>()
    for (const entry of planDetail.entries) {
      for (const ing of entry.ingredients) {
        const key = ing.category || 'Other'
        const existing = map.get(key)
        if (!existing) {
          map.set(key, { items: new Set([ing.name]), qty: ing.quantity * entry.serving_count, unit: ing.unit })
        } else {
          existing.items.add(ing.name)
          existing.qty += ing.quantity * entry.serving_count
        }
      }
    }
    return Array.from(map.entries()).map(([cat, info]) => ({
      category: cat,
      ...info,
    }))
  }, [planDetail])

  const toggleCheck = (item: string) => {
    setCheckedItems(prev => {
      const next = new Set(prev)
      if (next.has(item)) next.delete(item)
      else next.add(item)
      return next
    })
  }

  // Weekly nutrition summary
  const weekSummary = useMemo(() => {
    if (!planDetail) return null
    const dayMap: Record<number, MealPlanDetailEntry[]> = {}
    for (const entry of planDetail.entries) {
      if (!dayMap[entry.day_of_week]) dayMap[entry.day_of_week] = []
      dayMap[entry.day_of_week].push(entry)
    }
    let totalCal = 0, totalProtein = 0, totalCarbs = 0, totalFat = 0, totalFiber = 0, daysWithData = 0
    for (const day of Object.values(dayMap)) {
      let cal = 0, prot = 0, carb = 0, fat = 0, fib = 0
      for (const e of day) {
        if (e.nutrition) {
          cal += e.nutrition.calories * e.serving_count
          prot += e.nutrition.protein_g * e.serving_count
          carb += e.nutrition.carbs_g * e.serving_count
          fat += e.nutrition.fat_g * e.serving_count
          fib += e.nutrition.fiber_g * e.serving_count
        }
      }
      totalCal += cal; totalProtein += prot; totalCarbs += carb; totalFat += fat; totalFiber += fib
      daysWithData++
    }
    if (daysWithData === 0) return null
    return {
      avgCal: Math.round(totalCal / daysWithData),
      avgProtein: Math.round(totalProtein / daysWithData),
      avgCarbs: Math.round(totalCarbs / daysWithData),
      avgFat: Math.round(totalFat / daysWithData),
      avgFiber: Math.round(totalFiber / daysWithData),
    }
  }, [planDetail])

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-bold text-[var(--text-primary)]">AI Meal Planner</h1>

      {/* Blood test analysis section */}
      <AnalysisPanel data={analysis} isLoading={analyzing} />

      {/* Generate button */}
      {!genPlanId && (
        <div className="bg-[var(--bg-surface)] rounded-xl shadow-sm border p-6 text-center space-y-4">
          <p className="text-sm text-[var(--text-secondary)]">
            Based on your blood test results, the AI will generate a personalized weekly meal plan with recipes and shopping list.
          </p>
          <button
            onClick={() => { setGenPlanId(null); generateAIMealPlanMutation.mutate() }}
            disabled={generateAIMealPlanMutation.isPending}
            className="bg-emerald-600 text-white px-8 py-3 rounded-xl text-base font-semibold hover:bg-emerald-700 disabled:opacity-50 transition-colors"
          >
            {generateAIMealPlanMutation.isPending ? stepLabels[genStep] : 'Generate AI Meal Plan'}
          </button>
          {generateAIMealPlanMutation.isPending && (
            <div className="w-full bg-[var(--bg-hover)] rounded-full h-2 overflow-hidden">
              <div
                className="bg-emerald-500 h-full rounded-full transition-all duration-1000"
                style={{ width: `${(genStep + 1) * 33.3}%` }}
              />
            </div>
          )}
          {generateAIMealPlanMutation.isError && (
            <div className="space-y-2">
              <p className="text-sm text-red-600 font-medium">Generation failed</p>
              <pre className="text-xs text-red-500 bg-red-50 dark:bg-red-900/10 p-3 rounded-lg whitespace-pre-wrap">
                {JSON.stringify(
                  (generateAIMealPlanMutation.error as any)?.response?.data ?? null,
                  null, 2
                ) || 'Unknown error — check backend is running and AI is configured.'}
              </pre>
            </div>
          )}
        </div>
      )}

      {/* Generated plan display */}
      {genPlanId && !planDetail && (
        <div className="flex items-center gap-3 bg-[var(--bg-surface)] rounded-xl shadow-sm border p-6">
          <div className="w-5 h-5 border-2 border-primary-500 border-t-transparent rounded-full animate-spin" />
          <p className="text-[var(--text-muted)] text-sm">Loading meal plan details...</p>
        </div>
      )}

      {genPlanId && planDetail && (
        <>
          {/* Plan header */}
          <div className="bg-[var(--bg-surface)] rounded-xl shadow-sm border p-5 flex items-center justify-between">
            <div>
              <h2 className="font-semibold text-lg text-[var(--text-primary)]">{planDetail.title}</h2>
              <p className="text-xs text-[var(--text-muted)]">Starts: {new Date(planDetail.week_start).toLocaleDateString()}</p>
            </div>
            <div className="flex gap-3">
              <Link to="/meals/plans" className="text-sm text-primary-600 hover:text-primary-700">
                View all plans
              </Link>
              <button
                onClick={() => window.open(`/meals/print/${genPlanId}`, '_blank')}
                className="text-sm text-blue-600 hover:text-blue-700 font-medium"
              >
                Print
              </button>
              <button
                onClick={() => { setGenPlanId(null); setCheckedItems(new Set()) }}
                className="text-sm text-emerald-600 hover:text-emerald-700 font-medium"
              >
                Generate new plan
              </button>
            </div>
          </div>

          {/* Weekly nutrition summary */}
          {weekSummary && (
            <div className="bg-[var(--bg-surface)] rounded-xl shadow-sm border p-5">
              <h3 className="text-sm font-semibold text-[var(--text-secondary)] uppercase tracking-wide mb-3">Avg Daily Nutrition</h3>
              <div className="grid grid-cols-5 gap-4 text-center">
                <div><p className="text-lg font-bold text-[var(--text-primary)]">{weekSummary.avgCal}</p><p className="text-xs text-[var(--text-muted)]">Calories</p></div>
                <div><p className="text-lg font-bold text-[var(--text-primary)]">{weekSummary.avgProtein}g</p><p className="text-xs text-[var(--text-muted)]">Protein</p></div>
                <div><p className="text-lg font-bold text-[var(--text-primary)]">{weekSummary.avgCarbs}g</p><p className="text-xs text-[var(--text-muted)]">Carbs</p></div>
                <div><p className="text-lg font-bold text-[var(--text-primary)]">{weekSummary.avgFat}g</p><p className="text-xs text-[var(--text-muted)]">Fat</p></div>
                <div><p className="text-lg font-bold text-[var(--text-primary)]">{weekSummary.avgFiber}g</p><p className="text-xs text-[var(--text-muted)]">Fiber</p></div>
              </div>
            </div>
          )}

          {/* Weekly grid */}
          <WeeklyGrid entries={planDetail.entries} />

          {/* Shopping list */}
          <ShoppingSection items={shoppingList} checkedItems={checkedItems} onToggle={toggleCheck} />
        </>
      )}
    </div>
  )
}

function AnalysisPanel({ data, isLoading }: { data: AnalysisResult | undefined; isLoading: boolean }) {
  if (isLoading) {
    return (
      <div className="flex items-center gap-3 bg-[var(--bg-surface)] rounded-xl shadow-sm border p-6">
        <div className="w-5 h-5 border-2 border-primary-500 border-t-transparent rounded-full animate-spin" />
        <p className="text-[var(--text-muted)] text-sm">Analyzing your blood tests...</p>
      </div>
    )
  }

  if (!data) return null

  if (data.message && (!data.flagged || data.flagged.length === 0)) {
    return (
      <div className="bg-[var(--bg-surface)] rounded-xl shadow-sm border p-6 text-center">
        <p className="text-[var(--text-secondary)]">{data.message}</p>
      </div>
    )
  }

  if (!data.flagged || data.flagged.length === 0) {
    return (
      <div className="bg-green-50 dark:bg-green-900/20 rounded-xl border border-green-200 dark:border-green-800 p-6">
        <p className="text-green-700 dark:text-green-400 font-medium">All markers within normal range. Great job!</p>
      </div>
    )
  }

  return (
    <div className="bg-[var(--bg-surface)] rounded-xl shadow-sm border p-6 space-y-3">
      <h2 className="text-base font-semibold text-[var(--text-primary)]">Blood Test Analysis</h2>
      {data.flagged.map((m) => (
        <div key={m.marker} className="flex items-start gap-3 p-3 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 rounded-lg">
          <div className={`mt-0.5 w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold shrink-0 ${
            m.direction === 'High' ? 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400' : 'bg-blue-100 text-blue-700'
          }`}>
            {m.direction === 'High' ? '↑' : '↓'}
          </div>
          <div className="flex-1">
            <p className="font-medium text-sm text-[var(--text-primary)]">{m.marker}</p>
            <p className="text-xs text-[var(--text-secondary)]">
              {m.value} {m.unit} <span className="text-[var(--text-muted)]">(ref: {m.ref_range})</span>
            </p>
            {'guidance' in m && m.guidance && (
              <p className="text-xs text-amber-800 dark:text-amber-400 mt-1">{m.guidance}</p>
            )}
          </div>
        </div>
      ))}
    </div>
  )
}

function WeeklyGrid({ entries }: { entries: MealPlanDetailEntry[] }) {
  const [expandedCell, setExpandedCell] = useState<string | null>(null)

  const getEntry = (dayIdx: number, slot: string) =>
    entries.find(e => e.day_of_week === dayIdx && e.meal_slot.toLowerCase() === slot.toLowerCase())

  return (
    <div className="bg-[var(--bg-surface)] rounded-xl shadow-sm border overflow-hidden">
      <h3 className="text-base font-semibold text-[var(--text-primary)] p-5 pb-3">Weekly Meal Plan</h3>
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-[var(--border-default)] text-sm">
          <thead>
            <tr className="bg-[var(--bg-hover)]">
              <th className="px-3 py-2 text-left text-xs font-medium text-[var(--text-muted)] uppercase w-20">Meal</th>
              {days.map((d) => <th key={d} className="px-2 py-2 text-center text-xs font-medium text-[var(--text-muted)] uppercase">{d.slice(0, 3)}</th>)}
            </tr>
          </thead>
          <tbody>
            {slots.map((slot, si) => (
              <tr key={slot} className="divide-x divide-[var(--border-default)]">
                <td className="px-3 py-2 font-medium text-[var(--text-secondary)] text-xs">{slot}</td>
                {days.map((_, di) => {
                  const entry = getEntry(di, slot)
                  const cellKey = `${di}-${slot}`
                  return (
                    <td key={di} className="px-1 py-2">
                      {entry ? (
                        <div>
                          <button
                            onClick={() => setExpandedCell(expandedCell === cellKey ? null : cellKey)}
                            className="text-left w-full"
                          >
                            <p className="font-medium text-xs text-[var(--text-primary)] truncate">{entry.recipe_name}</p>
                            <div className="flex gap-1 mt-1">
                              {entry.recipe_category && (
                                <span className="text-xs bg-[var(--bg-hover)] text-[var(--text-secondary)] px-1.5 py-0.5 rounded-full">{entry.recipe_category}</span>
                              )}
                              {entry.recipe_glycemic_rating && (
                                <span className={`text-xs px-1.5 py-0.5 rounded-full ${glycemicColor(entry.recipe_glycemic_rating)}`}>
                                  {entry.recipe_glycemic_rating}
                                </span>
                              )}
                            </div>
                          </button>
                          {expandedCell === cellKey && entry.nutrition && (
                            <div className="mt-2 text-xs text-[var(--text-muted)] space-y-0.5 bg-[var(--bg-hover)] rounded-lg p-2">
                              <p><strong>{Math.round(entry.nutrition.calories * entry.serving_count)}</strong> cal</p>
                              <p>P: {Math.round(entry.nutrition.protein_g * entry.serving_count)}g · C: {Math.round(entry.nutrition.carbs_g * entry.serving_count)}g · F: {Math.round(entry.nutrition.fat_g * entry.serving_count)}g</p>
                              <p>Fiber: {Math.round(entry.nutrition.fiber_g * entry.serving_count)}g · Sugar: {Math.round(entry.nutrition.sugar_g * entry.serving_count)}g</p>
                            </div>
                          )}
                        </div>
                      ) : (
                        <span className="text-[var(--text-muted)] text-xs">—</span>
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

function glycemicColor(rating: string) {
  if (rating === 'low') return 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400'
  if (rating === 'medium') return 'bg-yellow-100 text-yellow-700'
  return 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400'
}

function ShoppingSection({
  items, checkedItems, onToggle,
}: {
  items: Array<{ category: string; items: Set<string>; qty: number; unit: string }>
  checkedItems: Set<string>
  onToggle: (item: string) => void
}) {
  if (!items.length) return null

  return (
    <div className="bg-[var(--bg-surface)] rounded-xl shadow-sm border p-6 space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-base font-semibold text-[var(--text-primary)]">Shopping List</h3>
        <Link to="/meals/shopping" className="text-xs text-primary-600 hover:text-primary-700">
          Full shopping list page
        </Link>
      </div>
      {items.map((group) => (
        <div key={group.category}>
          <h4 className="text-xs font-semibold text-[var(--text-secondary)] uppercase tracking-wide border-b border-[var(--border-default)] pb-1 mb-2">
            {group.category}
          </h4>
          <ul className="space-y-1">
            {Array.from(group.items).map((name) => (
              <li key={name} className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={checkedItems.has(name)}
                  onChange={() => onToggle(name)}
                  className="rounded border-[var(--border-default)]"
                />
                <span className={checkedItems.has(name) ? 'line-through text-[var(--text-muted)]' : 'text-[var(--text-primary)]'}>
                  {name}
                </span>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  )
}
