import { useState, useEffect } from 'react'
import { useAuthStore } from '@/store/authStore'
import { supabase } from '@/lib/supabase'
import { Users, Plus, Shield, Heart, AlertTriangle, ChevronRight, UserPlus, Bell, Activity, Check, X } from 'lucide-react'
import toast from 'react-hot-toast'

interface FamilyMember {
  id: string
  name: string
  relation: string
  age: number | null
  avatar_color: string
  health_score: number | null
  last_active: string | null
  alerts: number
  is_elderly: boolean
  emergency_profile: { blood_group?: string; allergies?: string[]; conditions?: string[] } | null
}

const RELATIONS = ['Spouse', 'Father', 'Mother', 'Son', 'Daughter', 'Sibling', 'Grandparent', 'Other']
const COLORS = ['#0f6e56', '#8b5cf6', '#3b82f6', '#f59e0b', '#ef4444', '#06b6d4']

export default function FamilyDashboard() {
  const { user } = useAuthStore()
  const [members, setMembers] = useState<FamilyMember[]>([])
  const [loading, setLoading] = useState(true)
  const [showAdd, setShowAdd] = useState(false)
  const [selectedMember, setSelectedMember] = useState<FamilyMember | null>(null)
  const [form, setForm] = useState({ name: '', relation: 'Father', age: '', is_elderly: false, email: '' })
  const [saving, setSaving] = useState(false)

  useEffect(() => { if (user) load() }, [user])

  async function load() {
    if (!user) return
    setLoading(true)
    const { data } = await supabase.from('family_members')
      .select('*').eq('owner_id', user.id).order('created_at', { ascending: false })
    setMembers((data || []).map((m: Record<string,unknown>, i: number) => ({
      id: m.id as string, name: m.name as string, relation: m.relation as string,
      age: m.age as number | null, avatar_color: COLORS[i % COLORS.length],
      health_score: (m.health_score as number) || null,
      last_active: m.updated_at as string | null,
      alerts: 0, is_elderly: (m.is_elderly as boolean) || false,
      emergency_profile: m.emergency_profile as FamilyMember['emergency_profile'],
    })))
    setLoading(false)
  }

  async function addMember() {
    if (!user || !form.name.trim()) { toast.error('Enter a name'); return }
    setSaving(true)
    try {
      await supabase.from('family_members').insert({
        owner_id: user.id, name: form.name.trim(), relation: form.relation,
        age: form.age ? parseInt(form.age) : null, is_elderly: form.is_elderly,
        linked_email: form.email || null,
      })
      toast.success(`${form.name} added to your family!`)
      setForm({ name: '', relation: 'Father', age: '', is_elderly: false, email: '' })
      setShowAdd(false); load()
    } catch { toast.error('Failed to add member — check family_members table exists') }
    finally { setSaving(false) }
  }

  async function removeMember(id: string, name: string) {
    if (!confirm(`Remove ${name} from your family?`)) return
    await supabase.from('family_members').delete().eq('id', id)
    toast.success('Removed')
    load()
  }

  const elderlyMembers = members.filter(m => m.is_elderly)

  return (
    <div className="p-4 pb-8 max-w-2xl mx-auto space-y-4">
      {/* Header */}
      <div className="card !p-5" style={{ background: 'linear-gradient(135deg,#0f2a1e,#1a3a2a)', borderColor: '#166534' }}>
        <div className="flex items-start gap-3">
          <div className="w-12 h-12 rounded-xl flex items-center justify-center shrink-0" style={{ background: 'rgba(34,197,94,0.15)' }}>
            <Users size={24} className="text-green-400" />
          </div>
          <div>
            <div className="flex items-center gap-2 mb-1">
              <h1 className="text-lg font-bold text-white">Family Health</h1>
              <span className="text-[10px] bg-green-900 text-green-300 border border-green-700 px-2 py-0.5 rounded-full font-bold">Care Coordination</span>
            </div>
            <p className="text-sm text-green-300">Track health for your whole family — kids, parents, elderly relatives — in one place.</p>
          </div>
        </div>
        <div className="mt-4 grid grid-cols-3 gap-2">
          {[['Members', members.length], ['Elderly care', elderlyMembers.length], ['Active alerts', members.reduce((a,m)=>a+m.alerts,0)]].map(([l,v])=>(
            <div key={String(l)} className="bg-white/10 rounded-lg p-2 text-center">
              <div className="text-lg font-black text-white">{v}</div>
              <div className="text-[9px] text-green-300">{l}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Elderly care alert banner */}
      {elderlyMembers.length > 0 && (
        <div className="card !p-4 bg-amber-50 border-amber-100">
          <p className="text-xs font-bold text-amber-700 mb-2 flex items-center gap-1.5"><Bell size={12}/>Elderly care monitoring active</p>
          <p className="text-xs text-amber-600">Get notified of missed check-ins, abnormal vitals, or medication gaps for {elderlyMembers.map(m=>m.name).join(', ')}.</p>
        </div>
      )}

      {/* Add member button */}
      <button onClick={() => setShowAdd(true)}
        className="w-full py-3 rounded-xl border-2 border-dashed border-gray-200 text-gray-500 text-sm font-semibold flex items-center justify-center gap-2 hover:border-teal-300 hover:text-teal-600 transition-colors">
        <UserPlus size={16} /> Add family member
      </button>

      {/* Add member form */}
      {showAdd && (
        <div className="card !p-5 space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-sm font-bold text-gray-800">Add family member</p>
            <button onClick={() => setShowAdd(false)}><X size={16} className="text-gray-400" /></button>
          </div>
          <input className="input text-sm" placeholder="Full name" value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))} />
          <div className="grid grid-cols-2 gap-2">
            <select className="input text-sm" value={form.relation} onChange={e => setForm(p => ({ ...p, relation: e.target.value }))}>
              {RELATIONS.map(r => <option key={r} value={r}>{r}</option>)}
            </select>
            <input type="number" className="input text-sm" placeholder="Age" value={form.age} onChange={e => setForm(p => ({ ...p, age: e.target.value }))} />
          </div>
          <input type="email" className="input text-sm" placeholder="Their email (optional — for shared access)" value={form.email} onChange={e => setForm(p => ({ ...p, email: e.target.value }))} />
          <label className="flex items-center gap-2 text-sm text-gray-600">
            <input type="checkbox" checked={form.is_elderly} onChange={e => setForm(p => ({ ...p, is_elderly: e.target.checked }))} className="w-4 h-4 accent-emerald-600" />
            Enable elderly care monitoring (missed check-in alerts)
          </label>
          <button onClick={addMember} disabled={saving} className="btn-primary w-full py-2.5 flex items-center justify-center gap-2">
            <Check size={14} />{saving ? 'Adding...' : 'Add member'}
          </button>
        </div>
      )}

      {/* Family members list */}
      {loading ? (
        <div className="space-y-2">{[1,2].map(i => <div key={i} className="card h-20 animate-pulse bg-gray-50" />)}</div>
      ) : members.length === 0 ? (
        <div className="card border-dashed border-2 text-center py-12">
          <Users size={32} className="text-gray-200 mx-auto mb-3" />
          <p className="text-sm font-semibold text-gray-600 mb-1">No family members added yet</p>
          <p className="text-xs text-gray-400">Add family to track their health and get caregiver alerts</p>
        </div>
      ) : (
        <div className="space-y-3">
          {members.map(m => (
            <div key={m.id} className="card !p-4">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-full flex items-center justify-center text-white text-base font-bold shrink-0" style={{ background: m.avatar_color }}>
                  {m.name[0]}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="text-sm font-bold text-gray-900">{m.name}</p>
                    {m.is_elderly && <span className="text-[9px] bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded font-bold">👴 Elderly care</span>}
                  </div>
                  <p className="text-xs text-gray-400">{m.relation}{m.age ? ` · ${m.age} yrs` : ''}</p>
                  {m.health_score && (
                    <div className="flex items-center gap-1 mt-1">
                      <div className="w-16 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                        <div className="h-full bg-emerald-500 rounded-full" style={{ width: `${m.health_score}%` }} />
                      </div>
                      <span className="text-[10px] text-gray-400">{m.health_score}/100</span>
                    </div>
                  )}
                </div>
                <button onClick={() => removeMember(m.id, m.name)} className="text-gray-300 hover:text-red-400 shrink-0">
                  <X size={14} />
                </button>
              </div>
              <div className="flex gap-2 mt-3">
                <button className="flex-1 text-xs py-2 rounded-lg bg-gray-50 text-gray-600 font-semibold flex items-center justify-center gap-1">
                  <Shield size={11} /> Emergency card
                </button>
                <button className="flex-1 text-xs py-2 rounded-lg bg-gray-50 text-gray-600 font-semibold flex items-center justify-center gap-1">
                  <Activity size={11} /> View health data
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Info card */}
      <div className="card !p-4 bg-blue-50 border-blue-100">
        <p className="text-xs font-bold text-blue-700 mb-1">💡 About family tracking</p>
        <p className="text-xs text-blue-600 leading-relaxed">
          Family members with a VitalOS account and shared email can grant you access to their full health data.
          Members without an account get a basic profile you manage on their behalf.
        </p>
      </div>
    </div>
  )
}
