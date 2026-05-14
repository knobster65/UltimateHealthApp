import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import api from '../../lib/api'
import { Link } from 'react-router-dom'

interface FlaggedMarker {
  marker: string
  value: number
  unit: string
  ref_range: string
  direction: string
  guidance: string
}

interface Suggestion {
  recipe_id: number
  name: string
  category: string | null
  glycemic_rating: string | null
  score: number
}

type AnalysisResult = { flagged: FlaggedMarker[]; suggestions: Suggestion[]; message: string | null }

export default function MealSuggestions() {
  const queryClient = useQueryClient()

  const { data, isLoading } = useQuery<AnalysisResult>({
    queryKey: ['meal-suggestions'],
    queryFn: async () => {
      const { data } = await api.get('/suggestions/')
      return data as AnalysisResult
    },
  })

  const applyMutation = useMutation({
    mutationFn: async () => {
      const { data } = await api.post('/suggestions/apply')
      return data
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['meal-plans'] }),
  })

  if (isLoading) return <LoadingState />

  if (!data) return <p className="text-[var(--text-muted)]">Could not load analysis.</p>

  if (data.message && data.flagged.length === 0) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-bold text-[var(--text-primary)]">Meal Suggestions</h1>
        <div className="bg-[var(--bg-surface)] rounded-xl shadow-sm border p-8 text-center space-y-4">
          <p className="text-[var(--text-secondary)]">{data.message}</p>
          {data.message.includes('No blood test') && (
            <Link to="/blood-tests/upload" className="text-primary-600 hover:text-primary-700">Upload your first blood test →</Link>
          )}
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-[var(--text-primary)]">Meal Suggestions</h1>

      {/* Flagged markers */}
      {data.flagged.length > 0 && (
        <div className="bg-[var(--bg-surface)] rounded-xl shadow-sm border p-6 space-y-4">
          <h2 className="text-lg font-semibold text-[var(--text-primary)]">Blood Test Analysis</h2>
          <div className="space-y-3">
            {data.flagged.map((m) => (
              <div key={m.marker} className="flex items-start gap-4 p-4 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 rounded-lg">
                <div className={`mt-0.5 w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold shrink-0 ${
                  m.direction === 'High' ? 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400' : 'bg-blue-100 text-blue-700'
                }`}>
                  {m.direction === 'High' ? '↑' : '↓'}
                </div>
                <div className="flex-1">
                  <p className="font-medium text-[var(--text-primary)]">{m.marker}</p>
                  <p className="text-sm text-[var(--text-secondary)]">
                    {m.value} {m.unit} <span className="text-[var(--text-muted)]">(ref: {m.ref_range})</span>
                  </p>
                  <p className="text-sm text-amber-800 mt-1">{m.guidance}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Suggested recipes */}
      {data.suggestions.length > 0 && (
        <div className="bg-[var(--bg-surface)] rounded-xl shadow-sm border p-6 space-y-4">
          <h2 className="text-lg font-semibold text-[var(--text-primary)]">Recommended Recipes</h2>
          <p className="text-sm text-[var(--text-muted)]">Scored by how well they match your nutritional needs.</p>

          <div className="space-y-3">
            {data.suggestions.map((s, i) => (
              <div key={s.recipe_id} className="flex items-center gap-4 p-4 border rounded-lg hover:border-primary-300 transition-colors">
                <span className={`text-xl font-bold w-8 ${i === 0 ? 'text-yellow-500' : i === 1 ? 'text-[var(--text-muted)]' : i === 2 ? 'text-amber-600' : 'text-[var(--text-muted)]'}`}>
                  {i + 1}
                </span>
                <div className="flex-1">
                  <p className="font-medium text-[var(--text-primary)]">{s.name}</p>
                  <div className="flex gap-2 mt-1">
                    {s.category && (
                      <span className="text-xs bg-[var(--bg-hover)] text-[var(--text-secondary)] px-2 py-0.5 rounded-full">{s.category}</span>
                    )}
                    {s.glycemic_rating && (
                      <span className={`text-xs px-2 py-0.5 rounded-full ${
                        s.glycemic_rating === 'low' ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400' :
                        s.glycemic_rating === 'medium' ? 'bg-yellow-100 text-yellow-700' :
                        'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400'
                      }`}>
                        {s.glycemic_rating} glycemic
                      </span>
                    )}
                  </div>
                </div>
                <Link
                  to="/meals/recipes"
                  className="text-sm text-primary-600 hover:text-primary-700 whitespace-nowrap"
                >
                  View →
                </Link>
              </div>
            ))}
          </div>

          {/* Apply as meal plan button */}
          <button
            onClick={() => applyMutation.mutate()}
            disabled={applyMutation.isPending}
            className="w-full py-3 bg-primary-600 text-white rounded-lg font-medium hover:bg-primary-700 disabled:opacity-50"
          >
            {applyMutation.isPending ? 'Creating meal plan...' : 'Apply as This Week\'s Meal Plan'}
          </button>

          {applyMutation.isSuccess && (
            <Link
              to="/meals/plans"
              className="block text-center text-sm text-green-600 hover:text-green-700 mt-2"
            >
              Meal plan created! View your plans →
            </Link>
          )}
        </div>
      )}
    </div>
  )
}

function LoadingState() {
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-[var(--text-primary)]">Meal Suggestions</h1>
      <div className="flex items-center gap-3 bg-[var(--bg-surface)] rounded-xl shadow-sm border p-6">
        <div className="w-5 h-5 border-2 border-primary-500 border-t-transparent rounded-full animate-spin" />
        <p className="text-[var(--text-muted)] text-sm">Analyzing your blood tests...</p>
      </div>
    </div>
  )
}
