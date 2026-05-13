import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useBloodTests } from '../../hooks/useBloodTests'
import type { MarkerCreate } from '../../types'

const markerCategories = [
  { label: 'Lipids', value: 'lipids', defaults: ['Total Cholesterol', 'LDL Cholesterol', 'HDL Cholesterol', 'Triglycerides'] },
  { label: 'Glucose', value: 'glucose', defaults: ['Fasting Glucose', 'HbA1c'] },
  { label: 'CBC', value: 'cbc', defaults: ['WBC', 'RBC', 'Hemoglobin', 'Hematocrit', 'Platelets'] },
  { label: 'Liver', value: 'liver', defaults: ['ALT', 'AST', 'ALP', 'Total Bilirubin'] },
  { label: 'Kidney', value: 'kidney', defaults: ['Creatinine', 'eGFR', 'BUN'] },
  { label: 'Thyroid', value: 'thyroid', defaults: ['TSH', 'Free T4', 'Free T3'] },
  { label: 'Other', value: 'other', defaults: [] },
]

export default function BloodTestsUpload() {
  const navigate = useNavigate()
  const { createMutation, uploadPdfMutation } = useBloodTests()
  const [dateTested, setDateTested] = useState(new Date().toISOString().split('T')[0])
  const [labName, setLabName] = useState('')
  const [notes, setNotes] = useState('')
  const [pdfFile, setPdfFile] = useState<File | null>(null)
  const [uploadingPdf, setUploadingPdf] = useState(false)
  const [pdfPath, setPdfPath] = useState<string | null>(null)

  const emptyMarker: MarkerCreate = { category: 'lipids', marker_name: '', value: 0, unit: '' }
  const [markers, setMarkers] = useState<MarkerCreate[]>([emptyMarker])

  const updateMarker = (index: number, field: keyof MarkerCreate, value: string | number) => {
    setMarkers((prev) => prev.map((m, i) => i === index ? { ...m, [field]: value } : m))
  }

  const addMarker = () => setMarkers((prev) => [...prev, { ...emptyMarker }])

  const handlePdfUpload = async () => {
    if (!pdfFile) return
    setUploadingPdf(true)
    try {
      const result = await uploadPdfMutation.mutateAsync(pdfFile)
      setPdfPath(result.pdf_path)
    } finally {
      setUploadingPdf(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      await createMutation.mutateAsync({
        date_tested: dateTested,
        lab_name: labName || undefined,
        notes: notes || undefined,
        markers: markers.filter((m) => m.marker_name.trim()),
      })
      navigate('/blood-tests')
    } catch {
      // Error handled by React Query
    }
  }

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-bold text-gray-900">Upload Blood Test</h1>

      <form onSubmit={handleSubmit} className="bg-white rounded-xl shadow-sm border p-6 space-y-6">
        {/* Test info */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Date Tested</label>
            <input type="date" required value={dateTested} onChange={(e) => setDateTested(e.target.value)}
              className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Lab Name</label>
            <input type="text" value={labName} onChange={(e) => setLabName(e.target.value)} placeholder="Quest Diagnostics, etc."
              className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500" />
          </div>
        </div>

        {/* PDF upload */}
        <div className="border rounded-lg p-4 space-y-3">
          <label className="block text-sm font-medium text-gray-700">PDF Report (optional)</label>
          <div className="flex items-center gap-3">
            <input type="file" accept=".pdf" onChange={(e) => setPdfFile(e.target.files?.[0] || null)}
              className="flex-1 text-sm" />
            {pdfFile && !pdfPath && (
              <button type="button" onClick={handlePdfUpload} disabled={uploadingPdf}
                className="px-3 py-2 bg-gray-100 text-gray-700 rounded-lg text-sm hover:bg-gray-200 disabled:opacity-50">
                {uploadingPdf ? 'Uploading...' : 'Upload'}
              </button>
            )}
            {pdfPath && <span className="text-sm text-green-600">PDF uploaded</span>}
          </div>
        </div>

        {/* Markers */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <label className="block text-sm font-medium text-gray-700">Marker Values</label>
            <button type="button" onClick={addMarker}
              className="text-sm text-primary-600 hover:text-primary-700 font-medium">+ Add Marker</button>
          </div>

          {markers.map((marker, index) => (
            <div key={index} className="grid grid-cols-12 gap-2 items-start">
              <select value={marker.category} onChange={(e) => updateMarker(index, 'category', e.target.value)}
                className="col-span-2 px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                title="Category">
                {markerCategories.map((cat) => (
                  <option key={cat.value} value={cat.value}>{cat.label}</option>
                ))}
              </select>
              <input type="text" required placeholder="e.g. HbA1c" value={marker.marker_name}
                onChange={(e) => updateMarker(index, 'marker_name', e.target.value)}
                className="col-span-3 px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500" />
              <input type="number" step="any" placeholder="Value" value={marker.value}
                onChange={(e) => updateMarker(index, 'value', parseFloat(e.target.value) || 0)}
                className="col-span-2 px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500" />
              <input type="text" placeholder="Unit" value={marker.unit}
                onChange={(e) => updateMarker(index, 'unit', e.target.value)}
                className="col-span-1 px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500" />
              <input type="number" step="any" placeholder="Low ref" value={marker.low_ref || ''}
                onChange={(e) => updateMarker(index, 'low_ref', parseFloat(e.target.value))}
                className="col-span-1 px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500" />
              <input type="number" step="any" placeholder="High ref" value={marker.high_ref || ''}
                onChange={(e) => updateMarker(index, 'high_ref', parseFloat(e.target.value))}
                className="col-span-1 px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500" />
              <button type="button" onClick={() => setMarkers((prev) => prev.filter((_, i) => i !== index))}
                className="col-span-1 px-2 py-2 text-red-500 hover:text-red-700 text-sm">
                {markers.length > 1 ? 'Remove' : ''}
              </button>
            </div>
          ))}
        </div>

        {/* Notes */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
          <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={3}
            className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500" />
        </div>

        <button type="submit" disabled={createMutation.isPending}
          className="bg-primary-600 text-white px-6 py-2 rounded-lg font-medium hover:bg-primary-700 disabled:opacity-50">
          {createMutation.isPending ? 'Saving...' : 'Save Test'}
        </button>
      </form>
    </div>
  )
}
