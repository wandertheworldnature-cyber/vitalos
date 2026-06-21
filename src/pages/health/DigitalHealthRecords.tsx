import { useState, useEffect } from 'react'
import { useAuthStore } from '@/store/authStore'
import { supabase } from '@/lib/supabase'
import { FolderOpen, Plus, Upload, QrCode, Shield, FileText, Syringe, Pill, Scan, Building, X, Check, Download } from 'lucide-react'
import toast from 'react-hot-toast'

interface HealthRecord {
  id: string
  category: 'vaccination' | 'prescription' | 'scan' | 'hospital_visit' | 'insurance' | 'allergy' | 'condition'
  title: string
  description: string
  date: string
  doctor: string
  hospital: string
  file_url: string | null
  tags: string[]
  created_at: string
}

const CATEGORIES = [
  { key: 'vaccination',    label: 'Vaccinations',     icon: Syringe,  color: '#10b981', bg: 'bg-emerald-50', border: 'border-emerald-100' },
  { key: 'prescription',   label: 'Prescriptions',    icon: Pill,     color: '#8b5cf6', bg: 'bg-purple-50',  border: 'border-purple-100'  },
  { key: 'scan',           label: 'Scans & Imaging',  icon: Scan,     color: '#3b82f6', bg: 'bg-blue-50',    border: 'border-blue-100'    },
  { key: 'hospital_visit', label: 'Hospital Visits',  icon: Building, color: '#f59e0b', bg: 'bg-amber-50',   border: 'border-amber-100'   },
  { key: 'insurance',      label: 'Insurance Docs',   icon: Shield,   color: '#06b6d4', bg: 'bg-cyan-50',    border: 'border-cyan-100'    },
  { key: 'allergy',        label: 'Allergies',        icon: X,        color: '#ef4444', bg: 'bg-red-50',     border: 'border-red-100'     },
  { key: 'condition',      label: 'Conditions',       icon: FileText, color: '#f97316', bg: 'bg-orange-50',  border: 'border-orange-100'  },
]

const EMPTY_FORM = { category: 'vaccination' as HealthRecord['category'], title: '', description: '', date: new Date().toISOString().split('T')[0], doctor: '', hospital: '', tags: '' }

export default function DigitalHealthRecords() {
  const { user } = useAuthStore()
  const [records, setRecords] = useState<HealthRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [showAdd, setShowAdd] = useState(false)
  const [filter, setFilter] = useState<string>('all')
  const [search, setSearch] = useState('')
  const [form, setForm] = useState(EMPTY_FORM)
  const [saving, setSaving] = useState(false)

  useEffect(() => { if (user) load() }, [user])

  async function load() {
    if (!user) return
    setLoading(true)
    const { data } = await supabase.from('health_records')
      .select('*').eq('user_id', user.id).eq('record_type', 'health_record')
      .order('recorded_at', { ascending: false })
    setRecords((data || []).map((r: Record<string,unknown>) => ({
      id: r.id as string,
      category: ((r.metadata as Record<string,unknown>)?.category as HealthRecord['category']) || 'condition',
      title: r.test_name as string,
      description: ((r.metadata as Record<string,unknown>)?.description as string) || '',
      date: (r.recorded_at as string).split('T')[0],
      doctor: ((r.metadata as Record<string,unknown>)?.doctor as string) || '',
      hospital: ((r.metadata as Record<string,unknown>)?.hospital as string) || '',
      file_url: ((r.metadata as Record<string,unknown>)?.file_url as string) || null,
      tags: ((r.metadata as Record<string,unknown>)?.tags as string[]) || [],
      created_at: r.recorded_at as string,
    })))
    setLoading(false)
  }

  async function save() {
    if (!user || !form.title) { toast.error('Title is required'); return }
    setSaving(true)
    try {
      await supabase.from('health_records').insert({
        user_id: user.id, record_type: 'health_record',
        test_name: form.title, value: 0, unit: '', source: 'manual',
        recorded_at: new Date(form.date).toISOString(),
        metadata: { category: form.category, description: form.description, doctor: form.doctor, hospital: form.hospital, tags: form.tags.split(',').map((t: string) => t.trim()).filter(Boolean) }
      })
      toast.success('Record saved!')
      setShowAdd(false); setForm(EMPTY_FORM); load()
    } finally { setSaving(false) }
  }

  async function deleteRecord(id: string) {
    if (!confirm('Delete this record?')) return
    await supabase.from('health_records').delete().eq('id', id)
    setRecords(prev => prev.filter(r => r.id !== id))
    toast.success('Deleted')
  }

  const filtered = records.filter(r => {
    const matchCat = filter === 'all' || r.category === filter
    const matchSearch = !search || r.title.toLowerCase().includes(search.toLowerCase()) || r.description.toLowerCase().includes(search.toLowerCase()) || r.hospital.toLowerCase().includes(search.toLowerCase())
    return matchCat && matchSearch
  })

  const byYear = filtered.reduce((acc, r) => {
    const yr = r.date.split('-')[0]
    if (!acc[yr]) acc[yr] = []
    acc[yr].push(r)
    return acc
  }, {} as Record<string, HealthRecord[]>)

  const counts = CATEGORIES.reduce((acc, c) => { acc[c.key] = records.filter(r => r.category === c.key).length; return acc }, {} as Record<string, number>)

  return (
    <div className="p-4 pb-8 max-w-2xl mx-auto space-y-4">
      {/* Header */}
      <div className="card !p-5" style={{ background: 'linear-gradient(135deg,#0f172a,#1e293b)', borderColor: '#334155' }}>
        <div className="flex items-start gap-3">
          <div className="w-12 h-12 rounded-xl flex items-center justify-center shrink-0" style={{ background: 'rgba(99,102,241,0.2)' }}>
            <FolderOpen size={24} className="text-indigo-400" />
          </div>
          <div>
            <div className="flex items-center gap-2 mb-1">
              <h1 className="text-lg font-bold text-white">Digital Health Records</h1>
              <span className="text-[10px] bg-indigo-900 text-indigo-300 border border-indigo-700 px-2 py-0.5 rounded-full font-bold">Google Drive for Health</span>
            </div>
            <p className="text-sm text-slate-300">Your complete medical history — vaccinations, prescriptions, scans, hospital visits, insurance, all in one place.</p>
          </div>
        </div>
        <div className="mt-4 grid grid-cols-4 gap-2">
          {[['Total records', records.length, '#6366f1'], ['Vaccinations', counts['vaccination']||0, '#10b981'], ['Prescriptions', counts['prescription']||0, '#8b5cf6'], ['Hospital visits', counts['hospital_visit']||0, '#f59e0b']].map(([l,v,c]) => (
            <div key={String(l)} className="rounded-lg p-2 text-center" style={{ background: `${c}20`, border: `1px solid ${c}30` }}>
              <div className="text-lg font-black" style={{ color: String(c) }}>{v}</div>
              <div className="text-[9px] text-gray-400 leading-tight">{String(l)}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Category filters */}
      <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
        <button onClick={() => setFilter('all')} className={`text-xs px-3 py-1.5 rounded-lg border whitespace-nowrap font-semibold flex-shrink-0 ${filter === 'all' ? 'bg-gray-900 text-white border-gray-900' : 'border-gray-200 text-gray-500'}`}>
          All ({records.length})
        </button>
        {CATEGORIES.map(c => counts[c.key] > 0 && (
          <button key={c.key} onClick={() => setFilter(c.key)}
            className={`text-xs px-3 py-1.5 rounded-lg border whitespace-nowrap font-semibold flex-shrink-0 transition-colors ${filter === c.key ? 'text-white border-transparent' : 'border-gray-200 text-gray-500'}`}
            style={filter === c.key ? { background: c.color } : {}}>
            {c.label} ({counts[c.key]})
          </button>
        ))}
      </div>

      {/* Search + Add */}
      <div className="flex gap-2">
        <input className="input text-sm flex-1" placeholder="Search records..." value={search} onChange={e => setSearch(e.target.value)} />
        <button onClick={() => setShowAdd(true)} className="btn-primary text-xs px-4 py-2 flex items-center gap-1.5 shrink-0">
          <Plus size={14} /> Add record
        </button>
      </div>

      {/* Add form */}
      {showAdd && (
        <div className="card !p-4 border-indigo-200" style={{ background: 'linear-gradient(135deg,#f5f3ff,#ede9fe)' }}>
          <div className="flex items-center justify-between mb-3">
            <p className="text-sm font-bold text-gray-800">Add health record</p>
            <button onClick={() => { setShowAdd(false); setForm(EMPTY_FORM) }}><X size={15} className="text-gray-400" /></button>
          </div>
          <div className="space-y-3">
            <div>
              <label className="text-xs text-gray-500 mb-1 block">Category</label>
              <div className="flex flex-wrap gap-1.5">
                {CATEGORIES.map(c => (
                  <button key={c.key} onClick={() => setForm(p => ({ ...p, category: c.key as HealthRecord['category'] }))}
                    className={`text-[11px] px-2.5 py-1 rounded-lg border font-semibold transition-colors ${form.category === c.key ? 'text-white border-transparent' : 'border-gray-200 text-gray-500'}`}
                    style={form.category === c.key ? { background: CATEGORIES.find(x => x.key === c.key)?.color } : {}}>
                    {c.label}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label className="text-xs text-gray-500 mb-1 block">Title *</label>
              <input className="input text-sm" placeholder="e.g. COVID-19 Booster dose" value={form.title} onChange={e => setForm(p => ({ ...p, title: e.target.value }))} />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-xs text-gray-500 mb-1 block">Date</label>
                <input type="date" className="input text-sm" value={form.date} onChange={e => setForm(p => ({ ...p, date: e.target.value }))} />
              </div>
              <div>
                <label className="text-xs text-gray-500 mb-1 block">Doctor</label>
                <input className="input text-sm" placeholder="Dr. Name" value={form.doctor} onChange={e => setForm(p => ({ ...p, doctor: e.target.value }))} />
              </div>
            </div>
            <div>
              <label className="text-xs text-gray-500 mb-1 block">Hospital / Clinic</label>
              <input className="input text-sm" placeholder="Apollo, AIIMS, Govt Hospital..." value={form.hospital} onChange={e => setForm(p => ({ ...p, hospital: e.target.value }))} />
            </div>
            <div>
              <label className="text-xs text-gray-500 mb-1 block">Description / Notes</label>
              <textarea className="input text-sm h-16 resize-none" placeholder="Details, dosage, findings, outcome..." value={form.description} onChange={e => setForm(p => ({ ...p, description: e.target.value }))} />
            </div>
            <div>
              <label className="text-xs text-gray-500 mb-1 block">Tags (comma separated)</label>
              <input className="input text-sm" placeholder="diabetes, cardiac, chronic..." value={form.tags} onChange={e => setForm(p => ({ ...p, tags: e.target.value }))} />
            </div>
            <button onClick={save} disabled={saving} className="btn-primary w-full text-sm py-2.5 flex items-center justify-center gap-2">
              <Check size={14} />{saving ? 'Saving...' : 'Save record'}
            </button>
          </div>
        </div>
      )}

      {/* Timeline by year */}
      {loading ? (
        <div className="space-y-2">{[1,2,3].map(i => <div key={i} className="card h-16 animate-pulse bg-gray-50" />)}</div>
      ) : Object.keys(byYear).length === 0 ? (
        <div className="card border-dashed border-2 text-center py-12">
          <FolderOpen size={32} className="text-gray-200 mx-auto mb-3" />
          <p className="text-sm font-semibold text-gray-600 mb-1">No health records yet</p>
          <p className="text-xs text-gray-400 mb-4">Add vaccinations, prescriptions, hospital visits, scans</p>
          <button onClick={() => setShowAdd(true)} className="btn-primary text-xs py-2">Add first record</button>
        </div>
      ) : (
        Object.entries(byYear).sort((a, b) => parseInt(b[0]) - parseInt(a[0])).map(([year, recs]) => (
          <div key={year}>
            <div className="flex items-center gap-2 mb-2">
              <span className="text-xs font-black text-gray-400">{year}</span>
              <div className="flex-1 h-px bg-gray-100" />
              <span className="text-[10px] text-gray-400">{recs.length} records</span>
            </div>
            <div className="space-y-2">
              {recs.map(r => {
                const cat = CATEGORIES.find(c => c.key === r.category) || CATEGORIES[0]
                const Icon = cat.icon
                return (
                  <div key={r.id} className={`card !p-3.5 border ${cat.bg} ${cat.border}`}>
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-start gap-2.5 flex-1 min-w-0">
                        <Icon size={15} className="mt-0.5 shrink-0" style={{ color: cat.color }} />
                        <div className="min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <p className="text-sm font-bold text-gray-900">{r.title}</p>
                            <span className="text-[9px] px-1.5 py-0.5 rounded font-bold text-white shrink-0" style={{ background: cat.color }}>{cat.label}</span>
                          </div>
                          <p className="text-xs text-gray-400 mt-0.5">{new Date(r.date + 'T00:00:00').toLocaleDateString('en-IN', { day:'numeric', month:'long', year:'numeric' })}</p>
                          {r.doctor && <p className="text-xs text-gray-500 mt-0.5">👨‍⚕️ {r.doctor}</p>}
                          {r.hospital && <p className="text-xs text-gray-500">🏥 {r.hospital}</p>}
                          {r.description && <p className="text-xs text-gray-600 mt-1 leading-relaxed">{r.description}</p>}
                          {r.tags.length > 0 && (
                            <div className="flex gap-1 mt-1.5 flex-wrap">
                              {r.tags.map(t => <span key={t} className="text-[9px] bg-white/80 text-gray-500 px-1.5 py-0.5 rounded border border-gray-100">#{t}</span>)}
                            </div>
                          )}
                        </div>
                      </div>
                      <button onClick={() => deleteRecord(r.id)} className="text-gray-300 hover:text-red-400 shrink-0"><X size={14} /></button>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        ))
      )}
    </div>
  )
}
