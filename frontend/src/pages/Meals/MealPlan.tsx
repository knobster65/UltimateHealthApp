import { useMealPlans } from '../../hooks/useMealPlans'
import { Link } from 'react-router-dom'

const days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']

export default function MealPlan() {
  const { plans, isLoading, deleteMutation } = useMealPlans()

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-[var(--text-primary)]">Saved Meal Plans</h1>
        <Link to="/meals/planner"
          className="bg-emerald-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-emerald-700">
          Generate New Plan
        </Link>
      </div>

      {isLoading ? <p className="text-[var(--text-muted)]">Loading...</p> : !plans || plans.length === 0 ? (
        <div className="bg-[var(--bg-surface)] rounded-xl shadow-sm p-8 border text-center space-y-4">
          <p className="text-[var(--text-muted)]">No meal plans yet.</p>
          <Link to="/meals/planner" className="text-primary-600 hover:underline text-sm font-medium">
            Generate your first AI meal plan
          </Link>
        </div>
      ) : (
        <div className="space-y-4">
          {plans.map((plan) => (
            <div key={plan.id} className="bg-[var(--bg-surface)] rounded-xl shadow-sm border p-5">
              <div className="flex items-center justify-between mb-3">
                <div>
                  <h3 className="font-semibold text-[var(--text-primary)]">{plan.title}</h3>
                  <p className="text-xs text-[var(--text-muted)]">Starts: {new Date(plan.week_start).toLocaleDateString()}</p>
                </div>
                <button onClick={() => deleteMutation.mutate(plan.id)}
                  className="text-[var(--text-muted)] hover:text-red-600 text-sm">Delete</button>
              </div>
              <div className="flex flex-wrap gap-2 text-xs">
                {plan.entries.map((e) => (
                  <span key={e.id} className="bg-[var(--bg-hover)] text-[var(--text-secondary)] px-2 py-1 rounded">
                    {days[e.day_of_week]?.slice(0, 3)} · {e.meal_slot}: Recipe #{e.recipe_id}
                  </span>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
