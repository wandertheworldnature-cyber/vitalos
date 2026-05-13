import { useEffect, useState } from 'react'
import { useAuthStore } from '@/store/authStore'
import { supabase } from '@/lib/supabase'
import { User, Mail, Phone, Calendar, Activity, Edit2, Check, X, Camera, Shield, LogOut } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import toast from 'react-hot-toast'

interface Profile {
  full_name: string
  email: string
  phone: string
  date_of_birth: string
  gender: string
  weight: string
  height: string
  blood_group: string
  known_conditions: string
  plan: string
  created_at: string
}

const BLOOD_GROUPS = ['A+','A-','B+','B-','AB+','AB-','O+','O-']
const GENDERS = ['Male','Female','Other','Prefer not to say']

export default function ProfilePage() {
  const { user, signOut } = useAuthStore()
  const navigate = useNavigate()
  const [profile, setProfile] = useState<Profile | null>(null)
  const [editing, setEditing] = useState(false)
  const [form, setForm] = useState<Partial<Profile>>({})
  const [saving, setSaving] = useState(false)
  const [stats, setStats] = useState({ reports: 0, records: 0, appointments: 0, insights: 0 })

  useEffect(() => { if (user) { loadProfile(); loadStats() } }, [user])

  async function loadProfile() {
    if (!user) return
    const { data } = await supabase.from('profiles').select('*').eq('id', user.id).single()
    if (data) {
      setProfile(data as Profile)
      setForm(data as Profile)
    }
  }

  async function loadStats() {
    if (!user) return
    const [reports, records, appts, insights] = await Promise.all([
      supabase.from('health_reports').select('id', { count:'exact', head:true }).eq('user_id', user.id),
      supabase.from('health_records').select('id', { count:'exact', head:true }).eq('user_id', user.id),
      supabase.from('appointments').select('id', { count:'exact', head:true }).eq('user_id', user.id),
      supabase.from('ai_insights').select('id', { count:'exact', head:true }).eq('user_id', user.id),
    ])
    setStats({
      reports: reports.count || 0,
      records: records.count || 0,
      appointments: appts.count || 0,
      insights: insights.count || 0,
    })
  }

  async function saveProfile() {
    if (!user) return
    setSaving(true)
    try {
      const { error } = await supabase.from('profiles').update({
        full_name: form.full_name,
        phone: form.phone,
        date_of_birth: form.date_of_birth,
        gender: form.gender,
        weight: form.weight,
        height: form.height,
        blood_group: form.blood_group,
        known_conditions: form.known_conditions,
      }).eq('id', user.id)
      if (error) throw error
      setProfile(prev => prev ? { ...prev, ...form } : null)
      setEditing(false)
      toast.success('Profile updated!')
    } catch { toast.error('Update failed') }
    finally { setSaving(false) }
  }

  async function handleSignOut() {
    await signOut()
    navigate('/login')
    toast.success('Signed out')
  }

  const initials = profile?.full_name
    ? profile.full_name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()
    : user?.email?.slice(0, 2).toUpperCase() || 'U'

  const planColor: Record<string, string> = {
    basic:   'bg-gray-100 text-gray-700',
    pro:     'bg-blue-100 text-blue-700',
    premium: 'bg-amber-100 text-amber-700',
  }

  const accountAge = profile?.created_at
    ? Math.floor((Date.now() - new Date(profile.created_at).getTime()) / 86400000)
    : 0

  return (
    <div className="p-4 md:p-6 pb-8 max-w-2xl mx-auto space-y-5">
      {/* Header card */}
      <div className="card !p-6 text-center relative overflow-hidden"
        style={{ background: 'linear-gradient(135deg,#0f6e56,#1d9e75)' }}>
        <div className="absolute inset-0 opacity-10"
          style={{ backgroundImage: 'radial-gradient(circle at 20% 50%, white 1px, transparent 1px), radial-gradient(circle at 80% 20%, white 1px, transparent 1px)', backgroundSize: '30px 30px' }}/>

        {/* Avatar */}
        <div className="relative inline-block mb-3">
          <div className="w-20 h-20 rounded-full flex items-center justify-center text-2xl font-black text-white mx-auto border-4 border-white/30"
            style={{ background: 'rgba(255,255,255,0.2)' }}>
            {initials}
          </div>
          {editing && (
            <button className="absolute -bottom-1 -right-1 w-7 h-7 bg-white rounded-full flex items-center justify-center shadow-md">
              <Camera size={13} className="text-teal-600"/>
            </button>
          )}
        </div>

        <h1 className="text-xl font-black text-white mb-1">
          {profile?.full_name || user?.email?.split('@')[0] || 'User'}
        </h1>
        <p className="text-emerald-200 text-sm mb-3">{user?.email}</p>

        <div className="flex items-center justify-center gap-3">
          <span className={`text-xs px-3 py-1 rounded-full font-bold capitalize ${planColor[profile?.plan||'basic']}`}>
            {profile?.plan || 'basic'} plan
          </span>
          <span className="text-xs text-emerald-200">Member for {accountAge} days</span>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-4 gap-2.5">
        {[
          { label:'Reports',      val:stats.reports,      icon:'🔬', color:'text-purple-600' },
          { label:'Records',      val:stats.records,      icon:'📊', color:'text-blue-600'   },
          { label:'Appointments', val:stats.appointments, icon:'🩺', color:'text-teal-600'   },
          { label:'AI Insights',  val:stats.insights,     icon:'🧠', color:'text-amber-600'  },
        ].map(s => (
          <div key={s.label} className="card !p-3 text-center">
            <div className="text-xl mb-0.5">{s.icon}</div>
            <div className={`text-xl font-black ${s.color}`}>{s.val}</div>
            <div className="text-[10px] text-gray-400">{s.label}</div>
          </div>
        ))}
      </div>

      {/* Profile details */}
      <div className="card !p-5">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-bold text-gray-900">Personal information</h2>
          {!editing ? (
            <button onClick={() => setEditing(true)}
              className="flex items-center gap-1.5 text-xs text-teal-600 border border-teal-200 px-3 py-1.5 rounded-lg hover:bg-teal-50 font-medium">
              <Edit2 size={12}/> Edit
            </button>
          ) : (
            <div className="flex gap-2">
              <button onClick={saveProfile} disabled={saving}
                className="flex items-center gap-1.5 text-xs text-white px-3 py-1.5 rounded-lg font-medium"
                style={{ background: 'linear-gradient(135deg,#0f6e56,#1d9e75)' }}>
                <Check size={12}/>{saving ? 'Saving...' : 'Save'}
              </button>
              <button onClick={() => { setEditing(false); setForm(profile || {}) }}
                className="flex items-center gap-1.5 text-xs text-gray-500 border border-gray-200 px-3 py-1.5 rounded-lg">
                <X size={12}/> Cancel
              </button>
            </div>
          )}
        </div>

        <div className="grid grid-cols-2 gap-3">
          {/* Full name */}
          <div className="col-span-2">
            <label className="text-xs text-gray-500 mb-1 block flex items-center gap-1"><User size={11}/> Full name</label>
            {editing ? (
              <input className="input text-sm" value={form.full_name||''} onChange={e => setForm(p=>({...p,full_name:e.target.value}))} placeholder="Your full name"/>
            ) : (
              <p className="text-sm font-semibold text-gray-900 py-2">{profile?.full_name || '—'}</p>
            )}
          </div>

          {/* Email (read-only) */}
          <div className="col-span-2">
            <label className="text-xs text-gray-500 mb-1 block flex items-center gap-1"><Mail size={11}/> Email</label>
            <p className="text-sm text-gray-600 py-2 flex items-center gap-1.5">
              {user?.email} <span className="text-[10px] bg-green-100 text-green-700 px-1.5 py-0.5 rounded font-bold">Verified</span>
            </p>
          </div>

          {/* Phone */}
          <div>
            <label className="text-xs text-gray-500 mb-1 block flex items-center gap-1"><Phone size={11}/> Phone</label>
            {editing ? (
              <input className="input text-sm" value={form.phone||''} onChange={e => setForm(p=>({...p,phone:e.target.value}))} placeholder="+91 9876543210"/>
            ) : (
              <p className="text-sm text-gray-900 py-2">{profile?.phone || '—'}</p>
            )}
          </div>

          {/* DOB */}
          <div>
            <label className="text-xs text-gray-500 mb-1 block flex items-center gap-1"><Calendar size={11}/> Date of birth</label>
            {editing ? (
              <input type="date" className="input text-sm" value={form.date_of_birth||''} onChange={e => setForm(p=>({...p,date_of_birth:e.target.value}))}/>
            ) : (
              <p className="text-sm text-gray-900 py-2">{profile?.date_of_birth ? new Date(profile.date_of_birth).toLocaleDateString('en-IN',{day:'numeric',month:'long',year:'numeric'}) : '—'}</p>
            )}
          </div>

          {/* Gender */}
          <div>
            <label className="text-xs text-gray-500 mb-1 block">Gender</label>
            {editing ? (
              <select className="input text-sm" value={form.gender||''} onChange={e => setForm(p=>({...p,gender:e.target.value}))}>
                <option value="">Select...</option>
                {GENDERS.map(g => <option key={g}>{g}</option>)}
              </select>
            ) : (
              <p className="text-sm text-gray-900 py-2">{profile?.gender || '—'}</p>
            )}
          </div>

          {/* Blood group */}
          <div>
            <label className="text-xs text-gray-500 mb-1 block">Blood group</label>
            {editing ? (
              <select className="input text-sm" value={form.blood_group||''} onChange={e => setForm(p=>({...p,blood_group:e.target.value}))}>
                <option value="">Select...</option>
                {BLOOD_GROUPS.map(g => <option key={g}>{g}</option>)}
              </select>
            ) : (
              <p className="text-sm text-gray-900 py-2">{profile?.blood_group || '—'}</p>
            )}
          </div>

          {/* Weight */}
          <div>
            <label className="text-xs text-gray-500 mb-1 block">Weight (kg)</label>
            {editing ? (
              <input type="number" className="input text-sm" value={form.weight||''} onChange={e => setForm(p=>({...p,weight:e.target.value}))} placeholder="70"/>
            ) : (
              <p className="text-sm text-gray-900 py-2">{profile?.weight ? `${profile.weight} kg` : '—'}</p>
            )}
          </div>

          {/* Height */}
          <div>
            <label className="text-xs text-gray-500 mb-1 block">Height (cm)</label>
            {editing ? (
              <input type="number" className="input text-sm" value={form.height||''} onChange={e => setForm(p=>({...p,height:e.target.value}))} placeholder="170"/>
            ) : (
              <p className="text-sm text-gray-900 py-2">{profile?.height ? `${profile.height} cm` : '—'}</p>
            )}
          </div>

          {/* Known conditions */}
          <div className="col-span-2">
            <label className="text-xs text-gray-500 mb-1 block">Known conditions / medications</label>
            {editing ? (
              <textarea className="input text-sm h-16 resize-none" value={form.known_conditions||''}
                onChange={e => setForm(p=>({...p,known_conditions:e.target.value}))}
                placeholder="e.g. Hypertension, Thyroid, Metformin 500mg..."/>
            ) : (
              <p className="text-sm text-gray-900 py-2">{profile?.known_conditions || '—'}</p>
            )}
          </div>
        </div>
      </div>

      {/* Account actions */}
      <div className="card !p-4 space-y-2">
        <h2 className="text-sm font-bold text-gray-900 mb-3">Account</h2>
        <button onClick={() => navigate('/subscription')}
          className="w-full flex items-center gap-3 p-3 rounded-xl hover:bg-gray-50 transition-colors text-left">
          <div className="w-9 h-9 rounded-xl bg-amber-100 flex items-center justify-center shrink-0">
            <Activity size={16} className="text-amber-600"/>
          </div>
          <div className="flex-1">
            <p className="text-sm font-semibold text-gray-900">Upgrade plan</p>
            <p className="text-xs text-gray-400">Currently on {profile?.plan||'basic'} plan</p>
          </div>
          <span className="text-gray-300">›</span>
        </button>

        <button onClick={() => navigate('/admin')}
          className="w-full flex items-center gap-3 p-3 rounded-xl hover:bg-gray-50 transition-colors text-left">
          <div className="w-9 h-9 rounded-xl bg-gray-100 flex items-center justify-center shrink-0">
            <Shield size={16} className="text-gray-600"/>
          </div>
          <div className="flex-1">
            <p className="text-sm font-semibold text-gray-900">Admin panel</p>
            <p className="text-xs text-gray-400">Manage doctors, users, settings</p>
          </div>
          <span className="text-gray-300">›</span>
        </button>

        <button onClick={handleSignOut}
          className="w-full flex items-center gap-3 p-3 rounded-xl hover:bg-red-50 transition-colors text-left">
          <div className="w-9 h-9 rounded-xl bg-red-100 flex items-center justify-center shrink-0">
            <LogOut size={16} className="text-red-500"/>
          </div>
          <div className="flex-1">
            <p className="text-sm font-semibold text-red-600">Sign out</p>
            <p className="text-xs text-gray-400">You'll need to sign in again</p>
          </div>
        </button>
      </div>

      <p className="text-center text-[10px] text-gray-400">
        VitalOS · Your health data is encrypted and never shared · <span className="text-teal-600">Privacy policy</span>
      </p>
    </div>
  )
}
