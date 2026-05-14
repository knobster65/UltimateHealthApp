import { useRef, useCallback, useMemo, useState } from 'react'
import { useExercise } from '../../hooks/useExercise'

export default function ExerciseIndex() {
  const fileRef = useRef<HTMLInputElement>(null)
  const { exercises, loadingExercises, importMutation, weeklySummaryQuery, deleteMutation } = useExercise()
  const [typeFilter, setTypeFilter] = useState('')

  const now = new Date()
  const weekStart = useMemo(() => {
    const d = new Date(now)
    d.setDate(d.getDate() - d.getDay())
    return d.toISOString().slice(0, 10)
  }, [])

  const { data: summary } = weeklySummaryQuery(weekStart)

  const handleImport = useCallback(() => fileRef.current?.click(), [])

  const filtered = useMemo(() => {
    if (!exercises) return []
    if (!typeFilter) return exercises
    return exercises.filter((e) => e.workout_type.toLowerCase().includes(typeFilter.toLowerCase()))
  }, [exercises, typeFilter])

  const uniqueTypes = useMemo(() => {
    const set = new Set<string>()
    exercises?.forEach((e) => set.add(e.workout_type))
    return Array.from(set)
  }, [exercises])

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-[var(--text-primary)]">Exercise</h1>
        <div className="flex gap-2">
          <input
            type="file"
            ref={fileRef}
            accept=".csv"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0]
              if (file) importMutation.mutate(file)
              e.target.value = ''
            }}
          />
          <button
            onClick={handleImport}
            disabled={importMutation.isPending}
            className="px-4 py-2 bg-primary-600 text-white text-sm rounded-lg hover:bg-primary-700 disabled:opacity-50"
          >
            {importMutation.isPending ? 'Importing...' : 'Import Apple Health CSV'}
          </button>
        </div>
      </div>

      {importMutation.isSuccess && (
        <p className="text-sm text-green-600 bg-green-50 px-4 py-2 rounded-lg">
          Imported {importMutation.data?.imported} workouts (batch {importMutation.data?.batch_id})
        </p>
      )}

      {importMutation.isError && (
        <p className="text-sm text-red-600 bg-red-50 px-4 py-2 rounded-lg">
          Import failed. Make sure the file is a tab-delimited CSV exported from Apple Health.
        </p>
      )}

      {/* Weekly Summary */}
      {summary && summary.total_workouts > 0 && (
        <div className="bg-[var(--bg-surface)] rounded-xl shadow-sm border p-6 space-y-4">
          <h2 className="text-lg font-semibold text-[var(--text-primary)]">This Week</h2>
          <div className="grid grid-cols-3 gap-4">
            <SummaryStat label="Workouts" value={summary.total_workouts} />
            <SummaryStat label="Duration" value={`${Math.round(summary.total_duration_min)} min`} />
            <SummaryStat label="Calories" value={Math.round(summary.total_calories)} />
          </div>
          {Object.keys(summary.by_type).length > 0 && (
            <table className="min-w-full divide-y divide-[var(--border-default)] mt-2">
              <thead>
                <tr>
                  <th className="text-left text-xs font-medium text-[var(--text-muted)] uppercase px-2 py-1">Type</th>
                  <th className="text-left text-xs font-medium text-[var(--text-muted)] uppercase px-2 py-1">#</th>
                  <th className="text-left text-xs font-medium text-[var(--text-muted)] uppercase px-2 py-1">Duration</th>
                  <th className="text-left text-xs font-medium text-[var(--text-muted)] uppercase px-2 py-1">Calories</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--border-default)]">
                {Object.entries(summary.by_type).map(([type, data]) => (
                  <tr key={type}>
                    <td className="text-sm px-2 py-1.5">{type}</td>
                    <td className="text-sm px-2 py-1.5">{(data as any).count}</td>
                    <td className="text-sm px-2 py-1.5">{Math.round((data as any).duration_min)} min</td>
                    <td className="text-sm px-2 py-1.5">{Math.round((data as any).calories)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {/* Workout Log */}
      {loadingExercises ? (
        <p className="text-[var(--text-muted)] text-sm">Loading workouts...</p>
      ) : !filtered.length ? (
        <p className="text-[var(--text-muted)] text-sm">No workouts yet. Import your Apple Health export to get started.</p>
      ) : (
        <div className="bg-[var(--bg-surface)] rounded-xl shadow-sm border overflow-hidden">
          <div className="px-6 py-4 border-b flex items-center gap-4">
            <h2 className="text-lg font-semibold text-[var(--text-primary)]">Workout Log</h2>
            {uniqueTypes.length > 1 && (
              <select
                value={typeFilter}
                onChange={(e) => setTypeFilter(e.target.value)}
                className="text-sm border rounded-lg px-2 py-1 focus:outline-none focus:ring-2 focus:ring-primary-500 bg-[var(--bg-surface)] text-[var(--text-primary)]"
              >
                <option value="">All Types</option>
                {uniqueTypes.map((t) => (
                  <option key={t} value={t}>{t}</option>
                ))}
              </select>
            )}
          </div>
          <table className="min-w-full divide-y divide-[var(--border-default)]">
            <thead className="bg-[var(--bg-hover)]">
              <tr>
                <th className="text-left text-xs font-medium text-[var(--text-muted)] uppercase px-4 py-2">Date</th>
                <th className="text-left text-xs font-medium text-[var(--text-muted)] uppercase px-4 py-2">Type</th>
                <th className="text-left text-xs font-medium text-[var(--text-muted)] uppercase px-4 py-2">Duration</th>
                <th className="text-left text-xs font-medium text-[var(--text-muted)] uppercase px-4 py-2">Calories</th>
                <th className="text-left text-xs font-medium text-[var(--text-muted)] uppercase px-4 py-2 hidden md:table-cell">Distance</th>
                <th className="text-left text-xs font-medium text-[var(--text-muted)] uppercase px-4 py-2 hidden md:table-cell">Avg HR</th>
                <th className="px-4 py-2" />
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--border-default)]">
              {filtered.map((entry) => (
                <tr key={entry.id} className="hover:bg-[var(--bg-hover)]">
                  <td className="text-sm px-4 py-2 whitespace-nowrap">{new Date(entry.start_time).toLocaleString()}</td>
                  <td className="text-sm px-4 py-2 font-medium">{entry.workout_type}</td>
                  <td className="text-sm px-4 py-2">{Math.round(entry.duration_min)} min</td>
                  <td className="text-sm px-4 py-2">{Math.round(entry.calories_burned)}</td>
                  <td className="text-sm px-4 py-2 hidden md:table-cell">{entry.distance_km ? `${entry.distance_km.toFixed(1)} km` : '—'}</td>
                  <td className="text-sm px-4 py-2 hidden md:table-cell">{entry.avg_heart_rate ?? '—'}</td>
                  <td className="px-4 py-2 text-right">
                    <button
                      onClick={() => deleteMutation.mutate(entry.id)}
                      disabled={deleteMutation.isPending}
                      className="text-xs text-red-500 hover:text-red-700 disabled:opacity-50"
                    >
                      Remove
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

function SummaryStat({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="bg-indigo-50 dark:bg-indigo-900/20 rounded-lg p-3 text-center">
      <p className="text-xs font-medium text-indigo-600 dark:text-indigo-400 uppercase tracking-wide">{label}</p>
      <p className="text-xl font-bold text-indigo-800 dark:text-indigo-400 mt-0.5">{value}</p>
    </div>
  )
}
