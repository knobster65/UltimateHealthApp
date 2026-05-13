import { useParams, Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import api from '../../lib/api'
import type { BloodTest } from '../../types'

export default function BloodTestDetail() {
  const { id } = useParams()
  const testId = Number(id)

  const { data: test, isLoading } = useQuery<BloodTest>({
    queryKey: ['blood-test', testId],
    queryFn: async () => {
      const { data } = await api.get(`/blood-tests/${testId}`)
      return data
    },
  })

  if (isLoading) return <p className="text-gray-500">Loading...</p>
  if (!test) return <p className="text-gray-500">Test not found.</p>

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Link to="/blood-tests" className="text-primary-600 hover:underline text-sm">&larr; Back</Link>
        <h1 className="text-xl font-bold text-gray-900">Blood Test - {new Date(test.date_tested).toLocaleDateString()}</h1>
      </div>

      <div className="bg-white rounded-xl shadow-sm border p-6 space-y-4">
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div><span className="text-gray-500">Lab:</span> {test.lab_name || '-'}</div>
          <div><span className="text-gray-500">PDF:</span> {test.pdf_path ? (
            <a href={`/api/blood-tests/pdf/${test.pdf_path.split('/').pop()}`} target="_blank" rel="noreferrer" className="text-primary-600 hover:underline">View PDF</a>
          ) : '-'}</div>
        </div>

        {test.notes && (
          <div><span className="text-gray-500 text-sm">Notes:</span> <p className="mt-1 text-sm">{test.notes}</p></div>
        )}
      </div>

      <div className="bg-white rounded-xl shadow-sm border overflow-hidden">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Category</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Marker</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Value</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Ref Range</th>
              <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase">Status</th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {test.markers.map((m) => (
              <tr key={m.id}>
                <td className="px-6 py-4 text-sm capitalize">{m.category}</td>
                <td className="px-6 py-4 text-sm font-medium">{m.marker_name}</td>
                <td className="px-6 py-4 text-sm">{m.value} {m.unit}</td>
                <td className="px-6 py-4 text-sm text-gray-500">
                  {m.low_ref != null || m.high_ref != null ? `${m.low_ref ?? '-' } - ${m.high_ref ?? '-'}` : '-'}
                </td>
                <td className="px-6 py-4 text-sm text-center">
                  {m.is_flagged ? (
                    <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-red-100 text-red-800">Out of Range</span>
                  ) : (
                    <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800">Normal</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
