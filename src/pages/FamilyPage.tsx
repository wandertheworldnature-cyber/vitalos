import { useEffect, useState } from 'react'
import { Users, Plus, AlertTriangle, CheckCircle, X } from 'lucide-react'
import { useAuthStore } from '@/store/authStore'
import { getFamilyMembers, addFamilyMember } from '@/services/healthService'
import type { FamilyMember } from '@/types'
import toast from 'react-hot-toast'

const AVATAR_COLORS = ['#9FE1CB', '#B5D4F4', '#FAC775', '#F4C0D1', '#C0DD97', '#CED0F6']

const DEMO_STATUS = [
  { alert: 'BP elevated last 3 readings', severity: 'warning' as const },
  { alert: 'All vitals normal', severity: 'good' as const },
  { alert: 'Thyroid stable — retest due in 2 months', severity: 'info' as const },
]

export default function FamilyPage() {
  const { user } = useAuthStore()
  const [members, setMembers] = useState<FamilyMember[]>([])
  const [loading, setLoading] = useState(true)
  const [showAdd, setShowAdd] = useState(false)
  const [form, setForm] = useState({ name: '', relation: '', age: '', gender: '' })
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!user) return
    getFamilyMembers(user.id)
      .then(setMembers)
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [user])

  async function handleAdd() {
    if (!user || !form.name || !form.relation) return
    setSaving(true)
    try {
      const color = AVATAR_COLORS[members.length % AVATAR_COLORS.length]
      const member = await addFamilyMember({
        user_id: user.id,
        name: form.name,
        relation: form.relation,
        age: parseInt(form.age) || 0,
        gender: form.gender || 'other',
        avatar_color: color,
      })
      setMembers(prev => [...prev, member])
      setForm({ name: '', relation: '', age: '', gender: '' })
      setShowAdd(false)
      toast.success(`${form.name} added to family health OS`)
    } catch {
      toast.error('Failed to add family member')
    } finally {
      setSaving(false)
    }
  }

  const StatusIcon = ({ severity }: { severity: 'warning' | 'good' | 'info' }) => {
    if (severity === 'warning') return <AlertTriangle size={13} className="text-amber-500 shrink-0" />
    if (severity === 'good') return <CheckCircle size={13} className="text-teal-500 shrink-0" />
    return <CheckCircle size={13} className="text-blue-400 shrink-0" />
  }

  return (
    <div className="p-6 max-w-4xl space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Users size={20} className="text-teal-500" />
          <h1 className="text-xl font-medium text-gray-900">Family health OS</h1>
        </div>
        <button onClick={() => setShowAdd(true)} className="btn-primary flex items-center gap-2">
          <Plus size={14} /> Add member
        </button>
      </div>

      <div className="bg-teal-50 border border-teal-100 rounded-xl p-4">
        <p className="text-sm font-medium text-teal-800 mb-1">Early warning system for your whole family</p>
        <p className="text-xs text-teal-600">
          Upload lab reports for any family member. VitalOS AI monitors trends and alerts you when action is needed — before a health crisis develops.
        </p>
      </div>

      {/* Member cards */}
      <div className="grid grid-cols-2 gap-4">
        {/* Self card */}
        <div className="card">
          <div className="flex items-start gap-3">
            <div
              className="w-12 h-12 rounded-full flex items-center justify-center text-sm font-medium shrink-0"
              style={{ background: '#9FE1CB', color: '#085041' }}
            >
              {user?.full_name?.split(' ').map(n => n[0]).join('').slice(0, 2) || 'ME'}
            </div>
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-medium text-gray-900">{user?.full_name || 'You'}</h3>
                <span className="text-[10px] bg-teal-100 text-teal-700 px-1.5 py-0.5 rounded">Primary</span>
              </div>
              <p className="text-xs text-gray-400">Account holder</p>
            </div>
          </div>

          <div className="mt-3 space-y-2">
            <div className="flex items-center gap-2">
              <AlertTriangle size={13} className="text-amber-500 shrink-0" />
              <p className="text-xs text-gray-600">Fasting glucose trending up — action needed</p>
            </div>
            <div className="flex items-center gap-2">
              <AlertTriangle size={13} className="text-red-500 shrink-0" />
              <p className="text-xs text-gray-600">Vitamin D severely deficient</p>
            </div>
          </div>

          <div className="mt-3 grid grid-cols-3 gap-2 pt-3 border-t border-gray-100">
            <div className="text-center">
              <p className="text-lg font-medium text-gray-900">72</p>
              <p className="text-[10px] text-gray-400">Health score</p>
            </div>
            <div className="text-center">
              <p className="text-lg font-medium text-gray-900">6</p>
              <p className="text-[10px] text-gray-400">Tests tracked</p>
            </div>
            <div className="text-center">
              <p className="text-lg font-medium text-gray-900">3</p>
              <p className="text-[10px] text-gray-400">Alerts</p>
            </div>
          </div>
        </div>

        {/* Family members */}
        {members.map((m, idx) => {
          const status = DEMO_STATUS[idx % DEMO_STATUS.length]
          return (
            <div key={m.id} className="card">
              <div className="flex items-start gap-3">
                <div
                  className="w-12 h-12 rounded-full flex items-center justify-center text-sm font-medium shrink-0"
                  style={{ background: m.avatar_color, color: '#085041' }}
                >
                  {m.name.split(' ').map((n: string) => n[0]).join('').slice(0, 2).toUpperCase()}
                </div>
                <div>
                  <h3 className="text-sm font-medium text-gray-900">{m.name}</h3>
                  <p className="text-xs text-gray-400 capitalize">{m.relation} · {m.age} yrs</p>
                </div>
              </div>

              <div className="mt-3 flex items-start gap-2">
                <StatusIcon severity={status.severity} />
                <p className="text-xs text-gray-600">{status.alert}</p>
              </div>

              <div className="mt-3 pt-3 border-t border-gray-100 flex gap-2">
                <button className="btn-secondary text-xs py-1.5 flex-1">
                  Upload report
                </button>
                <button className="btn-secondary text-xs py-1.5 flex-1">
                  View trends
                </button>
              </div>
            </div>
          )
        })}

        {/* Add member placeholder */}
        <button
          onClick={() => setShowAdd(true)}
          className="card border-dashed border-gray-200 flex flex-col items-center justify-center gap-2 text-gray-300 hover:border-gray-300 hover:text-gray-400 transition-colors min-h-[160px]"
        >
          <Plus size={24} />
          <span className="text-sm">Add family member</span>
        </button>
      </div>

      {/* Add modal */}
      {showAdd && (
        <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl p-6 w-full max-w-md shadow-xl">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-base font-medium text-gray-900">Add family member</h2>
              <button onClick={() => setShowAdd(false)}>
                <X size={18} className="text-gray-400 hover:text-gray-600" />
              </button>
            </div>

            <div className="space-y-3">
              <div>
                <label className="text-xs text-gray-500 mb-1 block">Name</label>
                <input className="input" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="Father, Mother, Spouse..." />
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="text-xs text-gray-500 mb-1 block">Relation</label>
                  <select className="input" value={form.relation} onChange={e => setForm(f => ({ ...f, relation: e.target.value }))}>
                    <option value="">Select</option>
                    {['Father', 'Mother', 'Spouse', 'Child', 'Sibling', 'Grandparent', 'Other'].map(r => (
                      <option key={r} value={r.toLowerCase()}>{r}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-xs text-gray-500 mb-1 block">Age</label>
                  <input type="number" className="input" value={form.age} onChange={e => setForm(f => ({ ...f, age: e.target.value }))} placeholder="62" />
                </div>
                <div>
                  <label className="text-xs text-gray-500 mb-1 block">Gender</label>
                  <select className="input" value={form.gender} onChange={e => setForm(f => ({ ...f, gender: e.target.value }))}>
                    <option value="">Select</option>
                    <option value="male">Male</option>
                    <option value="female">Female</option>
                    <option value="other">Other</option>
                  </select>
                </div>
              </div>
            </div>

            <div className="flex gap-3 mt-5">
              <button onClick={handleAdd} disabled={saving || !form.name || !form.relation} className="btn-primary flex-1">
                {saving ? 'Adding...' : 'Add member'}
              </button>
              <button onClick={() => setShowAdd(false)} className="btn-secondary">Cancel</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
