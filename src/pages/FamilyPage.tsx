import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/store/authStore'
import { Users, Plus, X, Activity, AlertTriangle, ChevronRight, Heart, User, TrendingUp, TrendingDown } from 'lucide-react'
import ReportUpload from '@/components/ReportUpload'
import toast from 'react-hot-toast'

interface FamilyMember {
  id: string; user_id: string; name: string; relation: string
  age: number; gender: string; avatar_color: string; created_at: string
}
interface MemberRecord { test_name: string; value: number; unit: string; reference_min?: number | null; reference_max?: number | null; recorded_at: string }
interface MemberAlert { test_name: string; value: number; unit: string; status: 'critical'|'warning'; message: string }

const RELATIONS = ['Father','Mother','Spouse','Son','Daughter','Brother','Sister','Grandfather','Grandmother','Other']
const AVATAR_COLORS = ['#0f6e56','#3b82f6','#8b5cf6','#f59e0b','#ef4444','#ec4899','#10b981','#f97316']

export default function FamilyPage() {
  const { user } = useAuthStore()
  const [members, setMembers] = useState<FamilyMember[]>([])
  const [selected, setSelected] = useState<FamilyMember | null>(null)
  const [memberRecords, setMemberRecords] = useState<MemberRecord[]>([])
  const [memberAlerts, setMemberAlerts] = useState<MemberAlert[]>([])
  const [showAdd, setShowAdd] = useState(false)
  const [loading, setLoading] = useState(true)
  const [loadingRecords, setLoadingRecords] = useState(false)
  const [form, setForm] = useState({ name:'', relation:'Father', age:'', gender:'Male' })
  const [activeTab, setActiveTab] = useState<'overview'|'upload'|'history'>('overview')

  useEffect(() => { if (user) loadMembers() }, [user])

  async function loadMembers() {
    if (!user) return
    setLoading(true)
    const { data } = await supabase.from('family_members').select('*').eq('user_id', user.id).order('created_at')
    setMembers((data || []) as FamilyMember[])
    setLoading(false)
  }

  async function loadMemberData(member: FamilyMember) {
    setSelected(member)
    setLoadingRecords(true)
    setActiveTab('overview')

    const { data } = await supabase.from('health_records').select('*')
      .eq('user_id', user!.id)
      .eq('family_member_id', member.id)
      .order('recorded_at', { ascending: false })
      .limit(50)

    const records = (data || []) as MemberRecord[]
    setMemberRecords(records)

    // Generate alerts for this member
    const alerts: MemberAlert[] = []
    const THRESHOLDS: Record<string, { min?: number; max?: number; critMax?: number }> = {
      'fasting glucose':  { min:70, max:99,  critMax:126 },
      'hba1c':            { min:4,  max:5.6, critMax:6.5 },
      'ldl cholesterol':  { max:130,critMax:160 },
      'total cholesterol':{ max:200,critMax:240 },
      'systolic bp':      { max:120,critMax:140 },
      'hemoglobin':       { min:12, critMax:17.5 },
      'vitamin d':        { min:30 },
      'tsh':              { min:0.4,max:4.0 },
    }

    // Latest unique values
    const seen = new Map<string, MemberRecord>()
    for (const r of records) {
      if (!seen.has(r.test_name.toLowerCase())) seen.set(r.test_name.toLowerCase(), r)
    }

    for (const [key, thresh] of Object.entries(THRESHOLDS)) {
      const rec = Array.from(seen.values()).find(r => r.test_name.toLowerCase().includes(key))
      if (!rec) continue
      if (thresh.critMax && rec.value >= thresh.critMax) {
        alerts.push({ test_name: rec.test_name, value: rec.value, unit: rec.unit, status: 'critical',
          message: `${rec.test_name} is critically high at ${rec.value} ${rec.unit}` })
      } else if ((thresh.max && rec.value > thresh.max) || (thresh.min && rec.value < thresh.min)) {
        alerts.push({ test_name: rec.test_name, value: rec.value, unit: rec.unit, status: 'warning',
          message: `${rec.test_name} is out of normal range (${rec.value} ${rec.unit})` })
      }
    }
    setMemberAlerts(alerts)
    setLoadingRecords(false)
  }

  async function addMember() {
    if (!user || !form.name || !form.age) { toast.error('Name and age are required'); return }
    const color = AVATAR_COLORS[members.length % AVATAR_COLORS.length]
    const { data, error } = await supabase.from('family_members').insert({
      user_id: user.id, name: form.name, relation: form.relation,
      age: parseInt(form.age), gender: form.gender, avatar_color: color,
    }).select().single()
    if (error) { toast.error('Failed to add member'); return }
    setMembers(prev => [...prev, data as FamilyMember])
    setForm({ name:'', relation:'Father', age:'', gender:'Male' })
    setShowAdd(false)
    toast.success(`${form.name} added to family health OS`)
  }

  async function removeMember(id: string, name: string) {
    if (!confirm(`Remove ${name} from family?`)) return
    await supabase.from('family_members').delete().eq('id', id)
    setMembers(prev => prev.filter(m => m.id !== id))
    if (selected?.id === id) setSelected(null)
    toast.success('Member removed')
  }

  // Get latest value for a metric
  const getLatest = (testName: string) => {
    return memberRecords.find(r => r.test_name.toLowerCase().includes(testName.toLowerCase()))
  }

  const keyMetrics = ['Fasting Glucose','HbA1c','Hemoglobin','LDL Cholesterol','TSH','Vitamin D','Systolic BP','Creatinine']

  return (
    <div className="p-6 max-w-5xl space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Users size={20} className="text-teal-600" />
          <div>
            <h1 className="text-xl font-bold text-gray-900">Family Health</h1>
            <p className="text-xs text-gray-400">Caregiver mode — manage your entire family's health</p>
          </div>
        </div>
        <button onClick={() => setShowAdd(s => !s)} className="btn-primary text-xs py-2 flex items-center gap-1.5">
          <Plus size={13} /> Add member
        </button>
      </div>

      {/* Add member form */}
      {showAdd && (
        <div className="card border-teal-200" style={{ background:'linear-gradient(135deg,#f0fdf8,#ecfdf5)' }}>
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-bold text-gray-800">Add family member</h3>
            <button onClick={() => setShowAdd(false)}><X size={15} className="text-gray-400"/></button>
          </div>
          <div className="grid grid-cols-4 gap-3 mb-3">
            <div className="col-span-2">
              <label className="text-xs text-gray-500 mb-1 block">Full name *</label>
              <input className="input text-sm" placeholder="e.g. Ramesh Reddy" value={form.name}
                onChange={e => setForm(f => ({...f, name: e.target.value}))} />
            </div>
            <div>
              <label className="text-xs text-gray-500 mb-1 block">Relation</label>
              <select className="input text-sm" value={form.relation}
                onChange={e => setForm(f => ({...f, relation: e.target.value}))}>
                {RELATIONS.map(r => <option key={r}>{r}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs text-gray-500 mb-1 block">Age *</label>
              <input type="number" className="input text-sm" placeholder="65" value={form.age}
                onChange={e => setForm(f => ({...f, age: e.target.value}))} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3 mb-3">
            <div>
              <label className="text-xs text-gray-500 mb-1 block">Gender</label>
              <select className="input text-sm" value={form.gender}
                onChange={e => setForm(f => ({...f, gender: e.target.value}))}>
                <option>Male</option><option>Female</option><option>Other</option>
              </select>
            </div>
          </div>
          <button onClick={addMember} className="btn-primary text-xs py-2">Add to family</button>
        </div>
      )}

      <div className="grid grid-cols-4 gap-5">
        {/* Member list */}
        <div className="col-span-1 space-y-2">
          <p className="text-xs font-bold text-gray-500 uppercase tracking-wide">Family members</p>
          {loading ? (
            <div className="space-y-2">{[1,2,3].map(i => <div key={i} className="h-16 bg-gray-100 rounded-xl animate-pulse"/>)}</div>
          ) : members.length === 0 ? (
            <div className="card border-dashed border-2 text-center py-8">
              <User size={24} className="text-gray-200 mx-auto mb-2"/>
              <p className="text-xs text-gray-400">No family members</p>
            </div>
          ) : (
            members.map(m => {
              const alerts = memberAlerts.filter(() => selected?.id === m.id)
              return (
                <div key={m.id}
                  onClick={() => loadMemberData(m)}
                  className={`card cursor-pointer transition-all hover:shadow-md ${selected?.id===m.id ? 'ring-1 ring-teal-400 border-teal-200' : ''}`}>
                  <div className="flex items-center gap-2.5">
                    <div className="w-10 h-10 rounded-full flex items-center justify-center text-white text-sm font-bold shrink-0"
                      style={{ background: m.avatar_color }}>
                      {m.name.slice(0,2).toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-gray-900 truncate">{m.name}</p>
                      <p className="text-xs text-gray-400">{m.relation} · {m.age}y</p>
                    </div>
                    <button onClick={e => { e.stopPropagation(); removeMember(m.id, m.name)}}
                      className="text-gray-300 hover:text-red-400 transition-colors">
                      <X size={13}/>
                    </button>
                  </div>
                </div>
              )
            })
          )}
        </div>

        {/* Member detail */}
        <div className="col-span-3">
          {!selected ? (
            <div className="card border-dashed border-2 flex flex-col items-center justify-center py-16">
              <Heart size={36} className="text-gray-200 mb-3"/>
              <p className="text-sm text-gray-400 font-medium">Select a family member</p>
              <p className="text-xs text-gray-300 mt-1">View their health dashboard, upload reports, and get alerts</p>
            </div>
          ) : (
            <div className="space-y-4">
              {/* Member header */}
              <div className="card flex items-center gap-4"
                style={{ background: `linear-gradient(135deg, ${selected.avatar_color}15, ${selected.avatar_color}05)`,
                         borderColor: `${selected.avatar_color}30` }}>
                <div className="w-14 h-14 rounded-full flex items-center justify-center text-white text-xl font-bold"
                  style={{ background: selected.avatar_color }}>
                  {selected.name.slice(0,2).toUpperCase()}
                </div>
                <div className="flex-1">
                  <h2 className="text-base font-bold text-gray-900">{selected.name}</h2>
                  <p className="text-sm text-gray-500">{selected.relation} · {selected.age} years · {selected.gender}</p>
                  <p className="text-xs text-gray-400 mt-0.5">{memberRecords.length} health records</p>
                </div>
                {memberAlerts.length > 0 && (
                  <div className={`flex items-center gap-1.5 px-3 py-2 rounded-xl ${memberAlerts.some(a=>a.status==='critical') ? 'bg-red-50 border border-red-200' : 'bg-amber-50 border border-amber-200'}`}>
                    <AlertTriangle size={15} className={memberAlerts.some(a=>a.status==='critical') ? 'text-red-500' : 'text-amber-500'} />
                    <div>
                      <p className="text-xs font-bold text-gray-700">{memberAlerts.length} alert{memberAlerts.length>1?'s':''}</p>
                      <p className="text-[10px] text-gray-500">Needs attention</p>
                    </div>
                  </div>
                )}
              </div>

              {/* Alerts */}
              {memberAlerts.length > 0 && (
                <div className="space-y-2">
                  {memberAlerts.map((a, i) => (
                    <div key={i} className={`flex items-start gap-3 p-3 rounded-xl border text-xs ${
                      a.status==='critical' ? 'bg-red-50 border-red-200' : 'bg-amber-50 border-amber-200'
                    }`}>
                      <AlertTriangle size={14} className={a.status==='critical' ? 'text-red-500 mt-0.5' : 'text-amber-500 mt-0.5'} />
                      <div>
                        <p className={`font-bold ${a.status==='critical' ? 'text-red-700' : 'text-amber-700'}`}>{a.message}</p>
                        <p className="text-gray-500 mt-0.5">
                          {a.status==='critical' ? 'Consult a doctor immediately' : 'Monitor and consult doctor soon'}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Tabs */}
              <div className="flex gap-1 bg-gray-100 rounded-xl p-1">
                {(['overview','upload','history'] as const).map(t => (
                  <button key={t} onClick={() => setActiveTab(t)}
                    className={`flex-1 text-xs py-2 rounded-lg capitalize font-medium transition-all ${activeTab===t ? 'bg-white shadow-sm text-gray-900' : 'text-gray-500'}`}>
                    {t === 'overview' ? '📊 Overview' : t === 'upload' ? '📋 Upload Report' : '📅 History'}
                  </button>
                ))}
              </div>

              {/* Overview tab */}
              {activeTab === 'overview' && (
                <div>
                  {loadingRecords ? (
                    <div className="grid grid-cols-3 gap-3">{[1,2,3,4,5,6].map(i => <div key={i} className="h-20 bg-gray-100 rounded-xl animate-pulse"/>)}</div>
                  ) : memberRecords.length === 0 ? (
                    <div className="card border-dashed border-2 text-center py-10">
                      <Activity size={28} className="text-gray-200 mx-auto mb-2"/>
                      <p className="text-sm text-gray-400">No health records for {selected.name}</p>
                      <p className="text-xs text-gray-300 mt-1 mb-4">Upload their lab reports to start monitoring</p>
                      <button onClick={() => setActiveTab('upload')} className="btn-primary text-xs py-2">Upload report</button>
                    </div>
                  ) : (
                    <div className="grid grid-cols-3 gap-3">
                      {keyMetrics.map(metric => {
                        const rec = getLatest(metric)
                        if (!rec) return null
                        const isHigh = rec.reference_max != null && rec.value > rec.reference_max
                        const isLow  = rec.reference_min != null && rec.value < rec.reference_min
                        const status = isHigh || isLow ? (
                          (rec.reference_max && rec.value > rec.reference_max * 1.2) ||
                          (rec.reference_min && rec.value < rec.reference_min * 0.8) ? 'critical' : 'warning'
                        ) : 'good'
                        return (
                          <div key={metric} className={`rounded-xl border p-3 ${
                            status==='critical' ? 'bg-red-50 border-red-200' :
                            status==='warning' ? 'bg-amber-50 border-amber-200' :
                            'bg-emerald-50 border-emerald-100'
                          }`}>
                            <p className="text-[10px] text-gray-500 truncate">{rec.test_name}</p>
                            <div className="flex items-baseline gap-1">
                              <span className={`text-xl font-black ${
                                status==='critical' ? 'text-red-600' :
                                status==='warning' ? 'text-amber-700' : 'text-emerald-700'
                              }`}>{rec.value}</span>
                              <span className="text-[10px] text-gray-400">{rec.unit}</span>
                            </div>
                            <p className={`text-[9px] font-semibold mt-0.5 ${
                              status==='critical' ? 'text-red-500' :
                              status==='warning' ? 'text-amber-600' : 'text-emerald-600'
                            }`}>
                              {status==='critical' ? '⛔ Critical' : status==='warning' ? '⚠ Watch' : '✓ Normal'}
                            </p>
                          </div>
                        )
                      })}
                    </div>
                  )}
                </div>
              )}

              {/* Upload tab */}
              {activeTab === 'upload' && (
                <div className="card">
                  <h3 className="text-sm font-bold text-gray-800 mb-3">Upload report for {selected.name}</h3>
                  <ReportUpload familyMemberId={selected.id} onUploadComplete={() => { loadMemberData(selected); setActiveTab('overview') }} />
                </div>
              )}

              {/* History tab */}
              {activeTab === 'history' && (
                <div className="card">
                  <h3 className="text-sm font-bold text-gray-800 mb-3">All records for {selected.name}</h3>
                  {memberRecords.length === 0 ? (
                    <p className="text-sm text-gray-400 text-center py-6">No records yet</p>
                  ) : (
                    <div className="space-y-2 max-h-80 overflow-y-auto">
                      {memberRecords.map((r, i) => {
                        const isAbnormal = (r.reference_max != null && r.value > r.reference_max) || (r.reference_min != null && r.value < r.reference_min)
                        return (
                          <div key={i} className={`flex items-center justify-between text-xs p-2.5 rounded-lg ${isAbnormal ? 'bg-red-50' : 'bg-gray-50'}`}>
                            <div>
                              <p className={`font-medium ${isAbnormal ? 'text-red-700' : 'text-gray-800'}`}>{r.test_name}</p>
                              <p className="text-gray-400">{new Date(r.recorded_at).toLocaleDateString('en-IN')}</p>
                            </div>
                            <div className="text-right">
                              <p className={`font-bold ${isAbnormal ? 'text-red-600' : 'text-gray-900'}`}>{r.value} {r.unit}</p>
                              {r.reference_max && <p className="text-[10px] text-gray-400">ref: {r.reference_min}–{r.reference_max}</p>}
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
