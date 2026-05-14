import { Link } from 'react-router-dom'
import { useBloodTests } from '../../hooks/useBloodTests'

export default function BloodTestsIndex() {
  const { tests, isLoading, deleteMutation } = useBloodTests()

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-[var(--text-primary)]">Blood Tests</h1>
        <Link to="/blood-tests/upload" className="bg-primary-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-primary-700">
          + Upload Test
        </Link>
      </div>

      {isLoading ? (
        <p className="text-[var(--text-muted)]">Loading...</p>
      ) : !tests || tests.length === 0 ? (
        <div className="bg-[var(--bg-surface)] rounded-xl shadow-sm p-8 border text-center">
          <p className="text-[var(--text-muted)] mb-4">No blood tests uploaded yet.</p>
          <Link to="/blood-tests/upload" className="text-primary-600 hover:underline text-sm font-medium">Upload your first test</Link>
        </div>
      ) : (
        <div className="bg-[var(--bg-surface)] rounded-xl shadow-sm border overflow-hidden">
          <table className="min-w-full divide-y divide-[var(--border-default)]">
            <thead className="bg-[var(--bg-hover)]">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-[var(--text-muted)] uppercase">Date</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-[var(--text-muted)] uppercase">Lab</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-[var(--text-muted)] uppercase">Markers</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-[var(--text-muted)] uppercase">PDF</th>
                <th className="px-6 py-3 text-right text-xs font-medium text-[var(--text-muted)] uppercase">Actions</th>
              </tr>
            </thead>
            <tbody className="bg-[var(--bg-surface)] divide-y divide-[var(--border-default)]">
              {tests.map((test) => (
                <tr key={test.id} className="hover:bg-[var(--bg-hover)]">
                  <td className="px-6 py-4 text-sm">{new Date(test.date_tested).toLocaleDateString()}</td>
                  <td className="px-6 py-4 text-sm text-[var(--text-secondary)]">{test.lab_name || '-'}</td>
                  <td className="px-6 py-4 text-sm">
                    <div className="flex flex-wrap gap-1">
                      {test.markers.slice(0, 4).map((m) => (
                        <span key={m.id} className={`inline-flex items-center px-2 py-0.5 rounded text-xs ${m.is_flagged ? 'bg-red-100 text-red-800' : 'bg-[var(--bg-hover)] text-[var(--text-secondary)]'}`}>
                          {m.marker_name}: {m.value} {m.unit}
                        </span>
                      ))}
                      {test.markers.length > 4 && (
                        <span className="text-xs text-[var(--text-muted)]">+{test.markers.length - 4} more</span>
                      )}
                    </div>
                  </td>
                  <td className="px-6 py-4 text-sm">
                    {test.pdf_path ? (
                      <a href={`/api/blood-tests/pdf/${test.pdf_path.split('/').pop()}`} target="_blank" rel="noreferrer" className="text-primary-600 hover:underline">View</a>
                    ) : '-'}
                  </td>
                  <td className="px-6 py-4 text-sm text-right">
                    <Link to={`/blood-tests/${test.id}`} className="text-primary-600 hover:underline mr-3">Detail</Link>
                    <button onClick={() => { if (confirm('Delete this test and all its markers?')) deleteMutation.mutate(test.id) }} className="text-red-500 hover:text-red-700">Delete</button>
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
