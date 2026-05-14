import { useState } from 'react'
import api from '../../lib/api'
import type { MedicationEntry, MedicationCreate } from '../../types'

export default function Medications() {
  const [medications, setMedications] = useState<MedicationEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [formError, setFormError] = useState('')

  // Form fields
  const emptyMed: MedicationCreate = {
    medication_name: '',
    dosage: '',
    frequency: '',
    start_date: new Date().toISOString().split('T')[0],
    end_date: null,
    notes: ''
  }
  const [form, setForm] = useState<MedicationCreate>(emptyMed)

  const loadMedications = async () => {
    try {
      const res = await api.get('/medications/')
      setMedications(res.data)
    } catch (err) {
      console.error('Failed to load medications:', err)
    } finally {
      setLoading(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setFormError('')
    try {
      await api.post('/medications/', form)
      setShowForm(false)
      setForm(emptyMed)
      loadMedications()
    } catch (err) {
      setFormError('Failed to save medication')
    }
  }

  const handleDelete = async (id: number) => {
    if (!confirm('Remove this medication?')) return
    try {
      await api.delete(`/medications/${id}`)
      loadMedications()
    } catch (err) {
      console.error('Failed to delete:', err)
    }
  }

  const handleEndMedication = async (id: number) => {
    try {
      await api.put(`/medications/${id}`, { end_date: new Date().toISOString().split('T')[0] })
      loadMedications()
    } catch (err) {
      console.error('Failed to update:', err)
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-xl font-bold text-[var(--text-primary)]">My Medications</h1>
        <button
          onClick={() => setShowForm(!showForm)}
          className="bg-primary-600 text-white px-4 py-2 rounded-lg text-sm hover:bg-primary-700"
        >
          {showForm ? 'Cancel' : '+ Add Medication'}
        </button>
      </div>

      {/* Form */}
      {showForm && (
        <form onSubmit={handleSubmit} className="bg-[var(--bg-surface)] p-6 rounded-xl shadow-sm border space-y-4">
          {formError && <p className="text-sm text-red-600">{formError}</p>}

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-[var(--text-secondary)] mb-1">Medication Name *</label>
              <input
                type="text"
                required
                value={form.medication_name}
                onChange={(e) => setForm({...form, medication_name: e.target.value})}
                placeholder="Metformin, Lisinopril, etc."
                className="w-full px-3 py-2 border rounded-lg bg-[var(--bg-surface)] text-[var(--text-primary)]"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-[var(--text-secondary)] mb-1">Dosage</label>
              <input
                type="text"
                value={form.dosage || ''}
                onChange={(e) => setForm({...form, dosage: e.target.value})}
                placeholder="500mg, 10mg, etc."
                className="w-full px-3 py-2 border rounded-lg bg-[var(--bg-surface)] text-[var(--text-primary)]"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-[var(--text-secondary)] mb-1">Frequency</label>
              <input
                type="text"
                value={form.frequency || ''}
                onChange={(e) => setForm({...form, frequency: e.target.value})}
                placeholder="Twice daily, as needed, etc."
                className="w-full px-3 py-2 border rounded-lg bg-[var(--bg-surface)] text-[var(--text-primary)]"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-[var(--text-secondary)] mb-1">Start Date</label>
              <input
                type="date"
                required
                value={form.start_date}
                onChange={(e) => setForm({...form, start_date: e.target.value})}
                className="w-full px-3 py-2 border rounded-lg bg-[var(--bg-surface)] text-[var(--text-primary)]"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-[var(--text-secondary)] mb-1">End Date (optional)</label>
              <input
                type="date"
                value={form.end_date || ''}
                onChange={(e) => setForm({...form, end_date: e.target.value || null})}
                className="w-full px-3 py-2 border rounded-lg bg-[var(--bg-surface)] text-[var(--text-primary)]"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-[var(--text-secondary)] mb-1">Notes</label>
              <input
                type="text"
                value={form.notes || ''}
                onChange={(e) => setForm({...form, notes: e.target.value})}
                placeholder="Prescription number, etc."
                className="w-full px-3 py-2 border rounded-lg bg-[var(--bg-surface)] text-[var(--text-primary)]"
              />
            </div>
          </div>

          <button type="submit" className="bg-primary-600 text-white px-6 py-2 rounded-lg font-medium hover:bg-primary-700">
            Save Medication
          </button>
        </form>
      )}

      {/* List */}
      {loading ? (
        <p className="text-sm text-[var(--text-secondary)]">Loading...</p>
      ) : medications.length === 0 ? (
        <div className="bg-[var(--bg-surface)] p-6 rounded-xl border text-center">
          <p className="text-[var(--text-secondary)]">No medications added yet. Click the button above to start.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {medications.map((med) => (
            <div key={med.id} className={`bg-[var(--bg-surface)] p-4 rounded-xl border ${!med.end_date ? 'border-l-4 border-l-primary-500' : ''}`}>
              <div className="flex justify-between items-start">
                <div>
                  <h3 className="font-medium text-[var(--text-primary)]">{med.medication_name}</h3>
                  {med.dosage && (
                    <p className="text-sm text-[var(--text-secondary)]">
                      {med.dosage}{med.frequency ? ` • ${med.frequency}` : ''}
                    </p>
                  )}
                  <p className="text-xs text-[var(--text-muted)] mt-1">
                    Started: {new Date(med.start_date).toLocaleDateString()}
                    {!med.end_date ? ' (currently taking)' : ` • Ended: ${new Date(med.end_date).toLocaleDateString()}`}
                  </p>
                  {med.notes && <p className="text-sm text-[var(--text-secondary)] mt-1">Note: {med.notes}</p>}
                </div>
                {!med.end_date && (
                  <button
                    onClick={() => handleEndMedication(med.id)}
                    className="text-sm text-orange-600 hover:text-orange-700 px-2 py-1"
                  >
                    End
                  </button>
                )}
                <button
                  onClick={() => handleDelete(med.id)}
                  className="text-sm text-red-500 hover:text-red-700 px-2 py-1"
                >
                  Remove
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
