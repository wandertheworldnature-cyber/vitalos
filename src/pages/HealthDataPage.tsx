import { useState, useEffect } from 'react'
import { Plus, Activity, X } from 'lucide-react'
import { useAuthStore } from '@/store/authStore'
import { getHealthRecords, addHealthRecord } from '@/services/healthService'
import type { HealthRecord } from '@/types'
import toast from 'react-hot-toast'
import ReportUpload from '@/components/ReportUpload'

const QUICK_TESTS = [
  { name: 'Fasting Glucose', unit: 'mg/dL', refMin: 70, refMax: 100 },
  { name: 'Blood Pressure (Systolic)', unit: 'mmHg', refMin: 90, refMax: 120 },
  { name: 'Blood Pressure (Diastolic)', unit: 'mmHg', refMin: 60, refMax: 80 },
  { name: 'Heart Rate', unit: 'bpm', refMin: 60, refMax: 100 },
  { name: 'Weight', unit: 'kg', refMin: undefined, refMax: undefined },
  { name: 'Sleep Hours', unit: 'hrs', refMin: 7, refMax: 9 },
  { name: 'Steps', unit: 'steps', refMin: 8000, refMax: undefined },
  { name: 'Hemoglobin', unit: 'g/dL', refMin: 12, refMax: 17 },
]

export default function HealthDataPage() {
  const { user } = useAuthStore()
  const [records, setRecords] = useState<HealthRecord[]>([])
  const [showForm, setShowForm] = useState(false)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState({
    test_name: '', value: '', unit: '', source: 'manual', recorded_at: new Date().toISOString().split('T')[0]
  })

  useEffect(() => {
    if (!user) return
    loadRecords()
  }, [user])

  async function loadRecords() {
    if (!user) return
    try {
      const data = await getHealthRecords(user.id, undefined, 50)
      setRecords(data)
    } catch {}
    finally { setLoading(false) }
  }

  function selectQuickTest(test: typeof QUICK_TESTS[0]) {
    setForm(f => ({ ...f, test_name: test.name, unit: test.unit }))
    setShowForm(true)
  }

  async function handleSave() {
    if (!user || !form.test_name || !form.value) return
    setSaving(true)
    try {
      const quick = QUICK_TESTS.find(t => t.name === form.test_name)
      await addHealthRecord({
        user_id: user.id,
        record_type: 'manual',
        test_name: form.test_name,
        value: parseFloat(form.value),
        unit: form.unit,
        reference_min: quick?.refMin,
        reference_max: quick?.refMax,
        source: form.source,
        recorded_at: new Date(form.recorded_at).toISOString(),
      })
      toast.success('Reading saved!')
      setShowForm(false)
      setForm({ test_name: '', value: '', unit: '', source: 'manual', recorded_at: new Date().toISOString().split('T')[0] })
      loadRecords()
    } catch {
      toast.error('Failed to save')
    } finally {
      setSaving(false)
    }
  }

  const grouped = records.reduce((acc, r) => {
    if (!acc[r.test_name]) acc[r.test_name] = []
    acc[r.test_name].push(r)
    return acc
  }, {} as Record<string, HealthRecord[]>)

  function getStatus(r: HealthRecord) {
    if (!r.reference_min && !r.reference_max) return 'normal'
    if (r.reference_max && r.value > r.reference_max * 1.1) return 'critical'
    if (r.reference_max && r.value > r.reference_max) return 'warning'
    if (r.reference_min && r.value < r.reference_min * 0.9) return 'critical'
    return 'good'
  }

  const statusBadge = { critical: 'badge-red', warning: 'badge-amber', good: 'badge-green', normal: 'bg-gray-100 text-gray-500 text-xs px-2 py-1 rounded-md font-medium' }

  return (
    <div className="p-6 max-w-5xl space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Activity size={20} className="text-teal-500" />
          <h1 className="text-xl font-medium text-gray-900">Health data</h1>
        </div>
        <button onClick={() => setShowForm(true)} className="btn-primary flex items-center gap-2">
          <Plus size={14} /> Add reading
        </button>
      </div>

      <div className="grid grid-cols-2 gap-6">
        {/* Manual entry */}
        <div className="space-y-4">
          <h2 className="text-sm font-medium text-gray-700">Quick entry</h2>
          <div className="grid grid-cols-2 gap-2">
            {QUICK_TESTS.map(t => (
              <button
                key={t.name}
                onClick={() => selectQuickTest(t)}
                className="card text-left hover:border-teal-300 transition-colors"
              >
                <p className="text-xs font-medium text-gray-800">{t.name}</p>
                <p className="text-[10px] text-gray-400 mt-0.5">{t.unit}</p>
              </button>
            ))}
          </div>

          {showForm && (
            <div className="card border-teal-200">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-medium text-gray-900">Add reading</h3>
                <button onClick={() => setShowForm(false)}>
                  <X size={15} className="text-gray-400" />
                </button>
              </div>
              <div className="space-y-3">
                <div>
                  <label className="text-xs text-gray-500 mb-1 block">Test / metric</label>
                  <input
                    className="input"
                    value={form.test_name}
                    onChange={e => setForm(f => ({ ...f, test_name: e.target.value }))}
                    placeholder="e.g. Fasting Glucose"
                    list="test-list"
                  />
                  <datalist id="test-list">
                    {QUICK_TESTS.map(t => <option key={t.name} value={t.name} />)}
                  </datalist>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs text-gray-500 mb-1 block">Value</label>
                    <input type="number" className="input" value={form.value} onChange={e => setForm(f => ({ ...f, value: e.target.value }))} placeholder="98" />
                  </div>
                  <div>
                    <label className="text-xs text-gray-500 mb-1 block">Unit</label>
                    <input className="input" value={form.unit} onChange={e => setForm(f => ({ ...f, unit: e.target.value }))} placeholder="mg/dL" />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs text-gray-500 mb-1 block">Date</label>
                    <input type="date" className="input" value={form.recorded_at} onChange={e => setForm(f => ({ ...f, recorded_at: e.target.value }))} />
                  </div>
                  <div>
                    <label className="text-xs text-gray-500 mb-1 block">Source</label>
                    <select className="input" value={form.source} onChange={e => setForm(f => ({ ...f, source: e.target.value }))}>
                      <option value="manual">Manual entry</option>
                      <option value="thyrocare">Thyrocare</option>
                      <option value="srl">SRL Labs</option>
                      <option value="apollo">Apollo Diagnostics</option>
                      <option value="wearable">Wearable device</option>
                    </select>
                  </div>
                </div>
                <button onClick={handleSave} disabled={saving} className="btn-primary w-full">
                  {saving ? 'Saving...' : 'Save reading'}
                </button>
              </div>
            </div>
          )}

          <div>
            <h2 className="text-sm font-medium text-gray-700 mb-3">Upload lab report</h2>
            <ReportUpload onUploadComplete={loadRecords} />
          </div>
        </div>

        {/* Records table */}
        <div>
          <h2 className="text-sm font-medium text-gray-700 mb-3">
            All records ({records.length})
          </h2>
          {loading ? (
            <div className="text-sm text-gray-400 text-center py-8">Loading...</div>
          ) : records.length === 0 ? (
            <div className="card text-center py-12">
              <p className="text-gray-400 text-sm">No records yet</p>
              <p className="text-gray-300 text-xs mt-1">Add a reading or upload a lab report</p>
            </div>
          ) : (
            <div className="space-y-3">
              {Object.entries(grouped).map(([name, recs]) => {
                const latest = recs[recs.length - 1]
                const st = getStatus(latest)
                return (
                  <div key={name} className="card">
                    <div className="flex items-center justify-between mb-2">
                      <h4 className="text-sm font-medium text-gray-900">{name}</h4>
                      <span className={statusBadge[st]}>{st}</span>
                    </div>
                    <div className="flex items-baseline gap-1 mb-1">
                      <span className="text-xl font-medium text-gray-900">{latest.value}</span>
                      <span className="text-xs text-gray-400">{latest.unit}</span>
                    </div>
                    {latest.reference_min != null && latest.reference_max != null && (
                      <p className="text-[10px] text-gray-400">
                        Ref: {latest.reference_min}–{latest.reference_max} {latest.unit}
                      </p>
                    )}
                    <div className="flex items-center justify-between mt-2">
                      <p className="text-[10px] text-gray-400">
                        {new Date(latest.recorded_at).toLocaleDateString('en-IN')} · {latest.source}
                      </p>
                      <p className="text-[10px] text-gray-400">{recs.length} reading{recs.length > 1 ? 's' : ''}</p>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
