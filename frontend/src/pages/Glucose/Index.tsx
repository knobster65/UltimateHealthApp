import { useState, useMemo } from 'react'
import { useGlucose } from '../../hooks/useGlucose'
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ReferenceLine, ResponsiveContainer, Text } from 'recharts'

const presets = [
  { label: '24h', hours: 24 },
  { label: '3d', hours: 72 },
  { label: '7d', hours: 168 },
  { label: '14d', hours: 336 },
]

export default function GlucoseIndex() {
  const { readings, loadingReadings, statsQuery, syncStatus, syncMutation, config, configMutation } = useGlucose()
  const [rangeHours, setRangeHours] = useState(168)
  const [nsUrl, setNsUrl] = useState(config?.nightscout_url ?? '')
  const [nsToken, setNsToken] = useState('')

  const rangeEnd = useMemo(() => new Date(), [])
  const rangeStart = useMemo(
    () => new Date(Date.now() - rangeHours * 3600000),
    [rangeHours],
  )

  const { data: stats } = statsQuery(rangeStart.toISOString(), rangeEnd.toISOString())

  const filteredReadings = useMemo(() => {
    if (!readings) return []
    const cutoff = Date.now() - rangeHours * 3600000
    const startMs = rangeEnd.getTime()
    return readings
      .filter((r) => {
        const ts = new Date(r.date_time).getTime()
        return ts >= cutoff && ts <= startMs
      })
      .reverse()
  }, [readings, rangeHours, rangeEnd])

  const chartData = useMemo(
    () =>
      filteredReadings.map((r) => ({
        time: new Date(r.date_time).toLocaleString(),
        value: Math.round(r.value_mgdl * 10) / 10,
      })),
    [filteredReadings],
  )

  const isLoading = loadingReadings || !readings

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-[var(--text-primary)]">Glucose Tracking</h1>

      {isLoading ? (
        <div className="flex items-center gap-3 bg-[var(--bg-surface)] rounded-xl shadow-sm border p-6">
          <div className="w-5 h-5 border-2 border-primary-500 border-t-transparent rounded-full animate-spin" />
          <p className="text-[var(--text-muted)] text-sm">Loading glucose data...</p>
        </div>
      ) : (
        <>
      {/* Stats Cards */}
      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          <StatCard label="Avg Glucose" value={`${Math.round(stats.avg_glucose)}`} unit="mg/dL" />
          <StatCard label="In Range" value={`${stats.time_in_range_pct}%`} accent={stats.time_in_range_pct >= 70 ? 'green' : 'red'} unit="70-180" />
          <StatCard label="Below Range" value={`${stats.below_range_pct}%`} accent="yellow" unit="<70" />
          <StatCard label="Above Range" value={`${stats.above_range_pct}%`} accent="orange" unit=">180" />
          <StatCard label="Very High" value={`${stats.very_high_pct}%`} accent="red" unit=">250" />
        </div>
      )}

      {stats && (stats.mgd != null || stats.gmi != null) && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {stats.mgd != null && <StatCard label="MGD" value={Math.round(stats.mgd)} unit="mg/dL" />}
          {stats.gmi != null && <StatCard label="GMI (est. A1C)" value={`${stats.gmi}%`} />}
        </div>
      )}

      {/* Range selector */}
      <div className="flex gap-2">
        {presets.map((p) => (
          <button
            key={p.label}
            onClick={() => setRangeHours(p.hours)}
            className={`px-3 py-1 text-sm rounded-full border ${
              rangeHours === p.hours ? 'bg-primary-600 text-white border-primary-600' : 'bg-[var(--bg-surface)] text-[var(--text-secondary)] hover:bg-[var(--bg-hover)]'
            }`}
          >
            {p.label}
          </button>
        ))}
      </div>

      {/* Chart */}
      <div className="bg-[var(--bg-surface)] rounded-xl shadow-sm border p-6">
        <h2 className="text-lg font-semibold text-[var(--text-primary)] mb-4">Glucose Readings</h2>
        {chartData.length > 0 ? (
          <div className="h-80">
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
          <p className="text-[var(--text-muted)] text-sm">No readings in this range. Sync from Nightscout or extend the range.</p>
        )}
      </div>

      {/* Nightscout Sync */}
      <div className="bg-[var(--bg-surface)] rounded-xl shadow-sm border p-6 space-y-4">
        <h2 className="text-lg font-semibold text-[var(--text-primary)]">Nightscout Sync</h2>

        {!config?.configured ? (
          <div className="space-y-3 max-w-md">
            <input
              type="url"
              placeholder="https://your-nightscout.app"
              value={nsUrl}
              onChange={(e) => setNsUrl(e.target.value)}
              className="w-full px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 bg-[var(--bg-surface)] text-[var(--text-primary)]"
            />
            <input
              type="text"
              placeholder="API token"
              value={nsToken}
              onChange={(e) => setNsToken(e.target.value)}
              className="w-full px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 bg-[var(--bg-surface)] text-[var(--text-primary)]"
            />
            <button
              onClick={() => { if (nsUrl) configMutation.mutate({ nightscout_url: nsUrl, api_token: nsToken }) }}
              disabled={configMutation.isPending || !nsUrl}
              className="px-4 py-2 bg-primary-600 text-white text-sm rounded-lg hover:bg-primary-700 disabled:opacity-50"
            >
              {configMutation.isPending ? 'Saving...' : 'Save Config'}
            </button>
          </div>
        ) : (
          <p className="text-sm text-[var(--text-secondary)]">
            Connected to <code className="bg-[var(--bg-hover)] px-1 rounded">{config.nightscout_url}</code>
          </p>
        )}

        <div className="flex items-center gap-4">
          <button
            onClick={() => syncMutation.mutate()}
            disabled={syncMutation.isPending || !config?.configured}
            className="px-4 py-2 bg-primary-600 text-white text-sm rounded-lg hover:bg-primary-700 disabled:opacity-50"
          >
            {syncMutation.isPending ? 'Syncing...' : 'Sync Now'}
          </button>

          {syncStatus && (
            <span className="text-xs text-[var(--text-muted)]">
              Total readings: {syncStatus.total_readings}
              {syncStatus.last_sync ? ` · Last sync: ${new Date(syncStatus.last_sync).toLocaleString()}` : ' · Never synced'}
            </span>
          )}
        </div>

        {syncMutation.isSuccess && (
          <p className="text-sm text-green-600">
            Synced. Fetches: {syncMutation.data?.entries_fetched}, stored: {syncMutation.data?.entries_stored}
          </p>
        )}
      </div>
        </>
      )}
    </div>
  )
}

function StatCard({ label, value, unit, accent = 'indigo' }: { label: string; value: string | number; unit?: string; accent?: string }) {
  const colors: Record<string, string> = {
    indigo: 'bg-indigo-50 text-indigo-700 dark:bg-indigo-900/20 dark:text-indigo-400',
    green: 'bg-green-50 text-green-700 dark:bg-green-900/20 dark:text-green-400',
    yellow: 'bg-yellow-50 text-yellow-700 dark:bg-yellow-900/20 dark:text-yellow-400',
    orange: 'bg-orange-50 text-orange-700 dark:bg-orange-900/20 dark:text-orange-400',
    red: 'bg-red-50 text-red-700 dark:bg-red-900/20 dark:text-red-400',
  }
  return (
    <div className={`rounded-xl p-4 ${colors[accent] ?? colors.indigo}`}>
      <p className="text-xs font-medium uppercase tracking-wide opacity-70">{label}</p>
      <p className="text-2xl font-bold mt-1">{value}</p>
      {unit && <p className="text-xs opacity-60 mt-0.5">{unit}</p>}
    </div>
  )
}
