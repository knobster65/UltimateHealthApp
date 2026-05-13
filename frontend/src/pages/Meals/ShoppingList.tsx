import { useState } from 'react'
import { useMealPlans } from '../../hooks/useMealPlans'

export default function ShoppingList() {
  const { plans, shoppingListQuery } = useMealPlans()
  const [selectedPlanId, setSelectedPlanId] = useState<number | ''>('')
  const { data: items } = shoppingListQuery(Number(selectedPlanId))

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
      <h1 className="text-xl font-bold text-gray-900">Shopping List</h1>

      <div className="bg-white rounded-xl shadow-sm border p-6 space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Select Meal Plan</label>
          <select value={selectedPlanId} onChange={(e) => setSelectedPlanId(Number(e.target.value))}
            className="px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 text-sm"
            defaultValue="">
            <option value="" disabled>Choose a plan...</option>
            {plans?.map((p) => <option key={p.id} value={p.id}>{p.title} (Starts {new Date(p.week_start).toLocaleDateString()})</option>)}
          </select>
        </div>

        {!selectedPlanId && <p className="text-gray-400 text-sm">Select a meal plan to generate shopping list.</p>}

        {selectedPlanId && !items && (
          <p className="text-gray-500 text-sm">Generating...</p>
        )}

        {selectedPlanId && items && items.length === 0 && (
          <p className="text-gray-500 text-sm">No ingredients found for this plan.</p>
        )}

        {selectedPlanId && items && items.length > 0 && (
          <>
            <div className="flex justify-end">
              <button onClick={exportCSV}
                className="text-sm text-primary-600 hover:text-primary-700 font-medium">Export CSV</button>
            </div>

            {grouped.map(([category, catItems]) => (
              <div key={category} className="mb-4">
                <h3 className="text-sm font-semibold text-gray-700 uppercase tracking-wide border-b pb-1 mb-2">{category}</h3>
                <ul className="divide-y divide-gray-100">
                  {catItems.map((item, i) => (
                    <li key={i} className="py-2 flex items-center justify-between text-sm">
                      <span className="text-gray-900">{item.name}</span>
                      <span className="text-gray-500 shrink-0 ml-3">{item.total_quantity} {item.unit}</span>
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
