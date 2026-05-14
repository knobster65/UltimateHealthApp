import { useState } from 'react'
import api from '../../lib/api'

interface InteractionResult {
  medication_name: string
  blood_marker?: string
  interaction_type: 'warning' | 'info'
  description: string
}

export default function CheckInteractions() {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [result, setResult] = useState<{ interactions: InteractionResult[], count: number } | null>(null)

  const runCheck = async () => {
    setLoading(true)
    setError('')
    setResult(null)
    try {
      const res = await api.get('/medications/check-interactions')
      setResult(res.data)
    } catch (err: any) {
      const msg = err?.response?.data?.detail || 'Failed to run interaction check'
      setError(msg)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-xl font-bold text-[var(--text-primary)]">Check Medication Interactions</h1>
        <button
          onClick={runCheck}
          disabled={loading}
          className="bg-primary-600 text-white px-4 py-2 rounded-lg text-sm hover:bg-primary-700 disabled:opacity-50"
        >
          {loading ? 'Analyzing...' : 'Run AI Analysis'}
        </button>
      </div>

      <div className="bg-[var(--bg-surface)] p-6 rounded-xl border">
        <h2 className="font-medium text-[var(--text-primary)] mb-2">How this works</h2>
        <p className="text-sm text-[var(--text-secondary)] leading-relaxed">
          This feature uses AI to analyze your current medications against your recent blood test results.
          It looks for known pharmacological interactions like medications that may affect liver enzymes,
          kidney function markers, blood glucose levels, or nutrient absorption. Results are informational only -
          always discuss with your doctor before making any changes.
        </p>
      </div>

      {error && (
        <div className="bg-red-50 dark:bg-red-900/20 p-4 rounded-xl border border-red-200 dark:border-red-800">
          <p className="text-sm text-red-700 dark:text-red-400">{error}</p>
        </div>
      )}

      {result && result.interactions.length === 0 && (
        <div className="bg-green-50 dark:bg-green-900/20 p-4 rounded-xl border">
          <p className="text-sm text-green-700 dark:text-green-400">
            No significant medication-blood test interactions found. Keep up the good work!
          </p>
        </div>
      )}

      {result && result.interactions.length > 0 && (
        <div className="space-y-3">
          <h2 className="font-medium text-[var(--text-primary)]">
            Found {result.count} potential interaction{result.count !== 1 ? 's' : ''}
          </h2>
          <div className="grid gap-4 md:grid-cols-2">
            {result.interactions.map((interaction, idx) => (
              <div
                key={idx}
                className={`p-4 rounded-xl border ${
                  interaction.interaction_type === 'warning'
                    ? 'bg-yellow-50 dark:bg-yellow-900/10 border-yellow-200 dark:border-yellow-800'
                    : 'bg-blue-50 dark:bg-blue-900/10 border-blue-200 dark:border-blue-800'
                }`}
              >
                <div className="flex items-start gap-2">
                  <span className={`text-lg ${interaction.interaction_type === 'warning' ? 'text-yellow-600' : 'text-blue-600'}`}>
                    {interaction.interaction_type === 'warning' ? '⚠️' : 'ℹ️'}
                  </span>
                  <div className="space-y-1">
                    <h3 className="font-medium text-[var(--text-primary)]">{interaction.medication_name}</h3>
                    {interaction.blood_marker && (
                      <p className="text-xs text-[var(--text-secondary)]">Affects: {interaction.blood_marker}</p>
                    )}
                    <p className="text-sm text-[var(--text-secondary)] leading-relaxed">{interaction.description}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {!loading && !result && !error && (
        <div className="bg-[var(--bg-surface)] p-6 rounded-xl border text-center">
          <p className="text-[var(--text-secondary)]">Click the button above to run analysis.</p>
        </div>
      )}

      {loading && (
        <div className="bg-[var(--bg-surface)] p-6 rounded-xl border text-center space-y-3">
          <div className="animate-spin h-8 w-8 border-2 border-primary-600 border-t-transparent rounded-full mx-auto"></div>
          <p className="text-[var(--text-secondary)]">Analyzing medications against blood tests...</p>
        </div>
      )}
    </div>
  )
}
