import { useState, useMemo } from 'react'
import { useMealPlans } from '../../hooks/useMealPlans'
import { useRecipes } from '../../hooks/useRecipes'

const days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']
const slots = ['Breakfast', 'Lunch', 'Dinner', 'Snack']

function getMonday(d: Date): string {
  const date = new Date(d)
  const day = date.getDay()
  const diff = date.getDate() - day + (day === 0 ? -6 : 1)
  return new Date(date.setDate(diff)).toISOString().split('T')[0]
}

export default function MealPlan() {
  const { plans, isLoading, createMutation, deleteMutation } = useMealPlans()
  const { recipes } = useRecipes()
  const [showForm, setShowForm] = useState(false)
  const [weekStart, setWeekStart] = useState(getMonday(new Date()))
  const [title, setTitle] = useState('')
  // entries: Map<dayIndex * 10 + slotIndex, recipe_id>
  const [assignments, setAssignments] = useState<Record<number, number>>({})

  const weekEndDisplay = useMemo(() => {
    const start = new Date(weekStart)
    const end = new Date(start)
    end.setDate(end.getDate() + 6)
    return `${start.toLocaleDateString()} - ${end.toLocaleDateString()}`
  }, [weekStart])

  const setSlot = (day: number, slotIndex: number, recipeId: number) => {
    setAssignments((p) => ({ ...p, [day * 10 + slotIndex]: recipeId }))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      const entries = Object.entries(assignments).map(([key, recipe_id]) => {
        const num = Number(key)
        return {
          recipe_id,
          day_of_week: Math.floor(num / 10),
          meal_slot: slots[num % 10]?.toLowerCase() || 'lunch',
          serving_count: 1,
        }
      })
      await createMutation.mutateAsync({ week_start: weekStart, title: title || `Week of ${weekEndDisplay}`, entries })
      setAssignments({})
      setTitle('')
      setShowForm(false)
    } catch { /* handled by React Query */ }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-gray-900">Meal Plans</h1>
        <button onClick={() => setShowForm(!showForm)}
          className="bg-primary-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-primary-700">
          {showForm ? 'Cancel' : '+ New Plan'}
        </button>
      </div>

      {showForm && (
        <form onSubmit={handleSubmit} className="bg-white rounded-xl shadow-sm border p-6 space-y-5">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Week Start</label>
              <input type="date" required value={weekStart} onChange={(e) => setWeekStart(e.target.value)}
                className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 text-sm" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Title</label>
              <input type="text" value={title} onChange={(e) => setTitle(e.target.value)} placeholder={`Week of ${weekEndDisplay}`}
                className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 text-sm" />
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200 text-sm">
              <thead>
                <tr>
                  <th className="px-2 py-2 text-left text-xs font-medium text-gray-500 uppercase w-24">Meal</th>
                  {days.map((d) => <th key={d} className="px-2 py-2 text-center text-xs font-medium text-gray-500 uppercase">{d.slice(0, 3)}</th>)}
                </tr>
              </thead>
              <tbody>
                {slots.map((slot, si) => (
                  <tr key={slot} className="divide-x">
                    <td className="px-2 py-2 font-medium text-gray-700">{slot}</td>
                    {days.map((_, di) => {
                      const selected = assignments[di * 10 + si]
                      return (
                        <td key={di} className="px-1 py-2">
                          <select value={selected || ''} onChange={(e) => setSlot(di, si, Number(e.target.value))}
                            className="w-full px-1 py-1 border rounded text-xs focus:outline-none focus:ring-1 focus:ring-primary-500"
                            defaultValue="">
                            <option value="">-</option>
                            {(recipes || []).map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
                          </select>
                        </td>
                      )
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <button type="submit" disabled={createMutation.isPending || Object.keys(assignments).length === 0}
            className="bg-primary-600 text-white px-6 py-2 rounded-lg font-medium hover:bg-primary-700 text-sm disabled:opacity-50">
            {createMutation.isPending ? 'Saving...' : 'Save Plan'}
          </button>
        </form>
      )}

      {!showForm && (
        <>
          {isLoading ? <p className="text-gray-500">Loading...</p> : !plans || plans.length === 0 ? (
            <div className="bg-white rounded-xl shadow-sm p-8 border text-center">
              <p className="text-gray-500 mb-4">No meal plans yet.</p>
              <button onClick={() => setShowForm(true)} className="text-primary-600 hover:underline text-sm font-medium">Create your first plan</button>
            </div>
          ) : (
            <div className="space-y-4">
              {plans.map((plan) => (
                <div key={plan.id} className="bg-white rounded-xl shadow-sm border p-5">
                  <div className="flex items-center justify-between mb-3">
                    <div>
                      <h3 className="font-semibold text-gray-900">{plan.title}</h3>
                      <p className="text-xs text-gray-500">Starts: {new Date(plan.week_start).toLocaleDateString()}</p>
                    </div>
                    <button onClick={() => deleteMutation.mutate(plan.id)}
                      className="text-gray-400 hover:text-red-600 text-sm">Delete</button>
                  </div>
                  <div className="flex gap-2 text-xs">
                    {plan.entries.map((e) => (
                      <span key={e.id} className="bg-gray-100 text-gray-700 px-2 py-1 rounded">
                        {days[e.day_of_week]?.slice(0, 3)} · {e.meal_slot}: Recipe #{e.recipe_id}
                      </span>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  )
}
