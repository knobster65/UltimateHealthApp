import { useMemo } from 'react'
import { Link } from 'react-router-dom'
import { useDashboard } from '../hooks/useDashboard'
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ReferenceLine, ResponsiveContainer, Text } from 'recharts'

export default function Dashboard() {
  const { data: stats, isLoading: loadingStats } = useDashboard() as any

  const chartData = useMemo(() => {
    if (!stats?.glucoseHistory) return []
    const readings = stats.glucoseHistory.sort((a: any, b: any) =>
      new Date(a.date_time).getTime() - new Date(b.date_time).getTime()
    )
    const twoDaysAgo = Date.now() - 2 * 3600_000 * 24
    return readings.filter((r: any) => new Date(r.date_time).getTime() >= twoDaysAgo)
      .map((r: any) => ({
        time: new Date(r.date_time).toLocaleString(),
        value: Math.round(r.value_mgdl * 10) / 10,
      }))
  }, [stats?.glucoseHistory])

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-[var(--text-primary)]">Dashboard</h1>

      {loadingStats ? (
        <div className="flex items-center gap-3 bg-[var(--bg-surface)] rounded-xl shadow-sm border border-[var(--border-default)] p-6">
          <div className="w-5 h-5 border-2 border-primary-500 border-t-transparent rounded-full animate-spin" />
          <p className="text-[var(--text-muted)] text-sm">Loading your health summary...</p>
        </div>
      ) : (
        <>
          {/* Glucose Overview Cards */}
          <section>
            <h2 className="text-sm font-semibold uppercase tracking-wide text-[var(--text-muted)] mb-3">Glucose</h2>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <LiveGlucoseCard latest={stats?.latest_glucose} loading={loadingStats} />
              <StatCard label="7-Day Avg" value={stats?.glucose_avg_7d ?? '—'} unit="mg/dL" color="indigo" />
              <StatCard
                label="Time in Range"
                value={stats?.glucose_tir_pct != null ? `${Math.round(stats.glucose_tir_pct)}%` : '—'}
                unit="70-180 mg/dL"
                color={stats?.glucose_tir_pct && stats.glucose_tir_pct >= 70 ? 'green' : 'red'}
              />
              <StatCard label="GMI (A1C)" value={stats?.glucose_gmi != null ? `${stats.glucose_gmi}%` : '—'} color="indigo" />
            </div>
          </section>

          {/* Other Stats Row */}
          <section>
            <h2 className="text-sm font-semibold uppercase tracking-wide text-[var(--text-muted)] mb-3">This Week</h2>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <StatCard label="Workouts" value={stats?.exercise_workouts_this_week ?? 0} color="indigo" />
              <StatCard label="Exercise" value={stats?.exercise_minutes_this_week ? `${Math.round(stats.exercise_minutes_this_week)} min` : '0 min'} color="green" />
              <StatCard label="Calories Burned" value={stats?.exercise_calories_this_week ? Math.round(stats.exercise_calories_this_week) : 0} color="orange" />
              <StatCard label="Blood Tests" value={stats?.blood_tests?.total_tests ?? 0} color="indigo" />
            </div>
          </section>

          {/* Flagged Markers Warning */}
          {stats?.blood_tests && stats.blood_tests.flagged_markers > 0 && (
            <Link to="/meals/suggestions" className="block bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-700 rounded-xl p-4 hover:bg-amber-100 dark:hover:bg-amber-900/30 transition-colors">
              <div className="flex items-center gap-3">
                <span className="text-lg">⚠️</span>
                <p className="text-sm text-amber-800 dark:text-amber-300">
                  <strong>{stats.blood_tests.flagged_markers} flagged marker{stats.blood_tests.flagged_markers > 1 ? 's' : ''}</strong> in your blood tests.
                  View personalized meal suggestions →
                </p>
              </div>
            </Link>
          )}

          {/* Glucose Trend Chart */}
          <section className="bg-[var(--bg-surface)] rounded-xl shadow-sm border border-[var(--border-default)] p-6">
            <h2 className="text-lg font-semibold text-[var(--text-primary)] mb-4">Glucose Trend (48h)</h2>
            {chartData.length > 0 ? (
              <div className="h-72">
                <ResponsiveContainer>
                  <AreaChart data={chartData} margin={{ top: 5, right: 10, left: -20, bottom: 5 }}>
                    <defs>
                      <linearGradient id="glucoseGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#6366f1" stopOpacity={0.3} />
                        <stop offset="95%" stopColor="#6366f1" stopOpacity={0.02} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="time" tick={{ fontSize: 11 }} interval="preserveEnd" />
                    <YAxis domain={['auto', 'auto']} tick={{ fontSize: 11 }} />
                    <Tooltip formatter={(value: number) => [`${value} mg/dL`, 'Glucose']} />
                    <ReferenceLine y={70} stroke="#f59e0b" strokeDasharray="4 4" label={<Text fill="#f59e0b" fontSize={11} dy={-3}>70</Text>} />
                    <ReferenceLine y={180} stroke="#ef4444" strokeDasharray="4 4" label={<Text fill="#ef4444" fontSize={11} dy={-3}>180</Text>} />
                    <Area type="monotone" dataKey="value" stroke="#6366f1" strokeWidth={2} fill="url(#glucoseGrad)" dot={false} name="Glucose" />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <p className="text-[var(--text-muted)] text-sm">No glucose data yet. Configure Nightscout sync to get started.</p>
            )}
          </section>

          {/* Quick Actions */}
          <section>
            <h2 className="text-sm font-semibold uppercase tracking-wide text-[var(--text-muted)] mb-3">Quick Actions</h2>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <NavCard title="Blood Tests" link="/blood-tests/upload" description="Upload new test" />
              <NavCard title="Meal Plans" link="/meals/plans" description="View plans" />
              <NavCard title="Glucose Sync" link="/glucose" description="Manage sync" />
              <NavCard title="Exercise" link="/exercise" description="Import workouts" />
            </div>
          </section>
        </>
      )}
    </div>
  )
}

function StatCard({ label, value, unit, color = 'indigo' }: { label: string; value: string | number; unit?: string; color?: string }) {
  const colors: Record<string, string> = {
    indigo: 'bg-indigo-50 text-indigo-700 dark:bg-indigo-900/20 dark:text-indigo-400',
    green: 'bg-green-50 text-green-700 dark:bg-green-900/20 dark:text-green-400',
    yellow: 'bg-yellow-50 text-yellow-700 dark:bg-yellow-900/20 dark:text-yellow-400',
    orange: 'bg-orange-50 text-orange-700 dark:bg-orange-900/20 dark:text-orange-400',
    red: 'bg-red-50 text-red-700 dark:bg-red-900/20 dark:text-red-400',
  }
  return (
    <div className={`rounded-xl p-4 ${colors[color] ?? colors.indigo}`}>
      <p className="text-xs font-medium uppercase tracking-wide opacity-70">{label}</p>
      <p className="text-2xl font-bold mt-1">{value}</p>
      {unit && <p className="text-xs opacity-60 mt-0.5">{unit}</p>}
    </div>
  )
}

function LiveGlucoseCard({ latest, loading }: { latest?: any; loading: boolean }) {
  const trendArrow = (trend?: string) => {
    if (!trend) return ''
    const arrows: Record<string, string> = {
      SingleUp: '↑', DoubleUp: '↑↑', Up: '↑',
      Flat: '→', FortyFiveUp: '↗',
      FortyFiveDown: '↘', SingleDown: '↓', DoubleDown: '↓↓', Down: '↓',
    }
    return arrows[trend] || ''
  }

  if (loading || !latest) {
    return (
      <div className="rounded-xl p-4 bg-indigo-50 dark:bg-indigo-900/20 text-indigo-700 dark:text-indigo-400">
        <p className="text-xs font-medium uppercase tracking-wide opacity-70">Current</p>
        <p className="text-2xl font-bold mt-1">—</p>
        <p className="text-xs opacity-60 mt-0.5">No reading</p>
      </div>
    )
  }

  const v = latest.value_mgdl
  const cardColor = v < 70 ? 'bg-red-50 text-red-700 dark:bg-red-900/20 dark:text-red-400'
    : v > 180 ? 'bg-orange-50 text-orange-700 dark:bg-orange-900/20 dark:text-orange-400'
    : 'bg-green-50 text-green-700 dark:bg-green-900/20 dark:text-green-400'

  return (
    <div className={`rounded-xl p-4 ${cardColor}`}>
      <p className="text-xs font-medium uppercase tracking-wide opacity-70">Current</p>
      <div className="flex items-baseline gap-1">
        <p className="text-2xl font-bold mt-1">{Math.round(v)}</p>
        {trendArrow(latest.trend) && <span className="text-lg">{trendArrow(latest.trend)}</span>}
      </div>
      <p className="text-xs opacity-60 mt-0.5">
        {new Date(latest.date_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
      </p>
    </div>
  )
}

function NavCard({ title, link, description }: { title: string; link: string; description: string }) {
  return (
    <Link to={link} className="bg-[var(--bg-surface)] rounded-xl shadow-sm p-5 border border-[var(--border-default)] hover:border-primary-300 transition-colors">
      <h3 className="font-semibold text-[var(--text-primary)]">{title}</h3>
      <p className="text-sm text-[var(--text-muted)] mt-1">{description}</p>
    </Link>
  )
}
