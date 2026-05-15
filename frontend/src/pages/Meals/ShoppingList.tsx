import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { useMealPlans } from '../../hooks/useMealPlans'

export default function ShoppingList() {
  const { plans, shoppingListQuery, latestPlanQuery } = useMealPlans()
  const [selectedPlanId, setSelectedPlanId] = useState<number | ''>('')

  // Auto-select latest plan when it loads.
  useEffect(() => {
    if (!selectedPlanId && latestPlanQuery.data?.plan) {
      setSelectedPlanId(latestPlanQuery.data.plan.id)
    }
  }, [latestPlanQuery.data])

  const { data: items, refetch } = shoppingListQuery(Number(selectedPlanId))

  const grouped = items ? (() => {
    const map = new Map<string, typeof items>()
    for (const item of items) {
      const key = item.category || 'Other'
      if (!map.has(key)) map.set(key, [])
      map.get(key)!.push(item)
    }
    return Array.from(map.entries())
  })() : []

  const exportCSV = () => {
    if (!items) return
    let csv = 'Category,Item,Quantity,Unit\n'
    for (const item of items) {
      csv += `${item.category || ''},"${item.name}",${item.total_quantity},${item.unit}\n`
    }
    const blob = new Blob([csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url; a.download = 'shopping-list.csv'; a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-bold text-[var(--text-primary)]">Shopping List</h1>

      <button onClick={() => { latestPlanQuery.refetch(); refetch() }}
        className="text-xs text-primary-600 hover:text-primary-700 mb-2">
        Refresh
      </button>

      <div className="bg-[var(--bg-surface)] rounded-xl shadow-sm border p-6 space-y-4">
        <div>
          <label className="block text-sm font-medium text-[var(--text-secondary)] mb-1">Select Meal Plan</label>
          <select value={selectedPlanId} onChange={(e) => setSelectedPlanId(Number(e.target.value))}
            className="px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 text-sm bg-[var(--bg-surface)] text-[var(--text-primary)]"
            defaultValue="">
            <option value="" disabled>Choose a plan...</option>
            {plans?.map((p) => <option key={p.id} value={p.id}>{p.title} (Starts {new Date(p.week_start).toLocaleDateString()})</option>)}
          </select>
        </div>

        {!selectedPlanId && <p className="text-[var(--text-muted)] text-sm">Select a meal plan to generate shopping list.</p>}

        {selectedPlanId && !items && (
          <p className="text-[var(--text-muted)] text-sm">Generating...</p>
        )}

        {selectedPlanId && items && items.length === 0 && (
          <p className="text-[var(--text-muted)] text-sm">No ingredients found for this plan.</p>
        )}

        {selectedPlanId && items && items.length > 0 && (
          <>
            <div className="flex justify-end gap-4">
              <Link to={`/meals/print/${selectedPlanId}`}
                target="_blank"
                className="text-sm text-blue-600 hover:text-blue-700 font-medium">Print</Link>
              <button onClick={exportCSV}
                className="text-sm text-primary-600 hover:text-primary-700 font-medium">Export CSV</button>
            </div>

            {grouped.map(([category, catItems]) => (
              <div key={category} className="mb-4">
                <h3 className="text-sm font-semibold text-[var(--text-secondary)] uppercase tracking-wide border-b pb-1 mb-2">{category}</h3>
                <ul className="divide-y divide-[var(--border-default)]">
                  {catItems.map((item, i) => (
                    <li key={i} className="py-2 flex items-center justify-between text-sm">
                      <span className="text-[var(--text-primary)]">{item.name}</span>
                      <span className="text-[var(--text-muted)] shrink-0 ml-3">{item.total_quantity} {item.unit}</span>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </>
        )}
      </div>
    </div>
  )
}
