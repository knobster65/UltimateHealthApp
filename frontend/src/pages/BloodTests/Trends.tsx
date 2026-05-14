import { useState, useMemo } from 'react'
import { useBloodTests } from '../../hooks/useBloodTests'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ReferenceLine, ResponsiveContainer, Legend } from 'recharts'

export default function BloodTestsTrends() {
  const { tests, trendsQuery } = useBloodTests()
  const [selectedMarker, setSelectedMarker] = useState('')

  // Extract unique marker names from all tests
  const allMarkers = useMemo(() => {
    if (!tests) return []
    const markers = new Map<string, string>()
    for (const test of tests) {
      for (const m of test.markers) {
        if (!markers.has(m.marker_name)) {
          markers.set(m.marker_name, m.unit)
        }
      }
    }
    return Array.from(markers.entries()).map(([name, unit]) => ({ name, unit }))
  }, [tests])

  const { data: trendData } = trendsQuery(selectedMarker)

  // Find the unit for selected marker
  const selectedUnit = allMarkers.find((m) => m.name === selectedMarker)?.unit || ''

  interface ChartDataPoint {
    date: string
    value: number
    lowRef: number | null
    highRef: number | null
  }

  const chartData = useMemo<ChartDataPoint[]>(() => {
    return (trendData || []).map((item: Record<string, unknown>) => ({
      date: new Date(String(item.date_tested)).toLocaleDateString(),
      value: Number(item.value),
      lowRef: item.low_ref != null ? Number(item.low_ref) : null,
      highRef: item.high_ref != null ? Number(item.high_ref) : null,
    }))
  }, [trendData])

  const lowRefLine = chartData.find((d) => d.lowRef != null)?.lowRef
  const highRefLine = chartData.find((d) => d.highRef != null)?.highRef

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-bold text-[var(--text-primary)]">Blood Test Trends</h1>

      <div className="bg-[var(--bg-surface)] rounded-xl shadow-sm border p-6 space-y-4">
        <div>
          <label className="block text-sm font-medium text-[var(--text-secondary)] mb-1">Select Marker to Track</label>
          <select value={selectedMarker} onChange={(e) => setSelectedMarker(e.target.value)}
            className="px-3 py-2 border rounded-lg bg-[var(--bg-surface)] text-[var(--text-primary)] focus:outline-none focus:ring-2 focus:ring-primary-500"
            defaultValue="">
            <option value="" disabled>Choose a marker...</option>
            {allMarkers.map((m) => (
              <option key={m.name} value={m.name}>{m.name} ({m.unit})</option>
            ))}
          </select>
        </div>

        {chartData.length > 0 ? (
          <div className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData} margin={{ top: 10, right: 30, left: 20, bottom: 30 }}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="date" tick={{ fontSize: 12 }} />
                <YAxis tick={{ fontSize: 12 }} />
                <Tooltip formatter={(value: number) => [`${value} ${selectedUnit}`, selectedMarker]} />
                <Legend />
                {lowRefLine && <ReferenceLine y={lowRefLine} stroke="orange" strokeDasharray="3 3" label="Low" />}
                {highRefLine && <ReferenceLine y={highRefLine} stroke="red" strokeDasharray="3 3" label="High" />}
                <Line type="monotone" dataKey="value" stroke="#2563eb" strokeWidth={2} dot={{ r: 5 }} name={selectedMarker} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        ) : selectedMarker ? (
          <p className="text-[var(--text-muted)] text-sm">No trend data available for this marker.</p>
        ) : (
          <p className="text-[var(--text-muted)] text-sm">Select a marker above to view trends.</p>
        )}
      </div>

      {chartData.length > 0 && (
        <div className="bg-[var(--bg-surface)] rounded-xl shadow-sm border p-6">
          <h3 className="font-medium text-[var(--text-primary)] mb-3">{selectedMarker} History</h3>
          <table className="min-w-full divide-y divide-[var(--border-default)]">
            <thead>
              <tr>
                <th className="text-left text-xs font-medium text-[var(--text-muted)] uppercase px-3 py-2">Date</th>
                <th className="text-left text-xs font-medium text-[var(--text-muted)] uppercase px-3 py-2">Value</th>
                <th className="text-left text-xs font-medium text-[var(--text-muted)] uppercase px-3 py-2">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--border-default)]">
              {chartData.map((row, i) => {
                const flagged = (row.lowRef != null && row.value < row.lowRef) || (row.highRef != null && row.value > row.highRef)
                return (
                  <tr key={i}>
                    <td className="text-sm px-3 py-2">{row.date}</td>
                    <td className="text-sm px-3 py-2">{row.value} {selectedUnit}</td>
                    <td className="px-3 py-2">
                      {flagged ? (
                        <span className="text-xs font-medium text-red-600 bg-red-50 px-2 py-0.5 rounded-full">Out of Range</span>
                      ) : (
                        <span className="text-xs font-medium text-green-600 bg-green-50 px-2 py-0.5 rounded-full">Normal</span>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
