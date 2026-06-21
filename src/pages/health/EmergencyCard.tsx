import { useState, useEffect, useRef } from 'react'
import { useAuthStore } from '@/store/authStore'
import { supabase } from '@/lib/supabase'
import { Shield, QrCode, Phone, Heart, AlertTriangle, Download, Share2, Edit3, Check, X, Plus } from 'lucide-react'
import toast from 'react-hot-toast'

interface EmergencyProfile {
  blood_group: string
  allergies: string[]
  conditions: string[]
  medications: string[]
  emergency_contact_name: string
  emergency_contact_phone: string
  emergency_contact_relation: string
  organ_donor: boolean
  insurance_id: string
  insurance_provider: string
  doctor_name: string
  doctor_phone: string
  notes: string
}

const BLOOD_GROUPS = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-', 'Unknown']

const DEFAULT: EmergencyProfile = {
  blood_group: '', allergies: [], conditions: [], medications: [],
  emergency_contact_name: '', emergency_contact_phone: '', emergency_contact_relation: '',
  organ_donor: false, insurance_id: '', insurance_provider: '',
  doctor_name: '', doctor_phone: '', notes: ''
}

export default function EmergencyCard() {
  const { user } = useAuthStore()
  const [profile, setProfile] = useState<EmergencyProfile>(DEFAULT)
  const [editing, setEditing] = useState(false)
  const [saving, setSaving] = useState(false)
  const [loaded, setLoaded] = useState(false)
  const [newAllergy, setNewAllergy] = useState('')
  const [newCondition, setNewCondition] = useState('')
  const [newMed, setNewMed] = useState('')
  const cardRef = useRef<HTMLDivElement>(null)

  const cardUrl = `${window.location.origin}/emergency/${user?.id}`

  useEffect(() => { if (user) load() }, [user])

  async function load() {
    if (!user) return
    const { data } = await supabase.from('profiles').select('emergency_profile').eq('id', user.id).single()
    if (data?.emergency_profile) setProfile(data.emergency_profile as EmergencyProfile)
    setLoaded(true)
  }

  async function save() {
    if (!user) return
    setSaving(true)
    try {
      await supabase.from('profiles').update({ emergency_profile: profile }).eq('id', user.id)
      toast.success('Emergency card saved!')
      setEditing(false)
    } catch { toast.error('Save failed') }
    finally { setSaving(false) }
  }

  function addItem(field: 'allergies'|'conditions'|'medications', value: string, setter: (v:string)=>void) {
    if (!value.trim()) return
    setProfile(p => ({ ...p, [field]: [...p[field], value.trim()] }))
    setter('')
  }

  function removeItem(field: 'allergies'|'conditions'|'medications', idx: number) {
    setProfile(p => ({ ...p, [field]: p[field].filter((_:string, i:number) => i !== idx) }))
  }

  function share() {
    if (navigator.share) {
      navigator.share({ title: `${user?.full_name} — Emergency Health Card`, text: 'My emergency health card', url: cardUrl })
    } else {
      navigator.clipboard?.writeText(cardUrl)
      toast.success('Emergency card link copied!')
    }
  }

  const hasData = profile.blood_group || profile.allergies.length > 0 || profile.conditions.length > 0

  return (
    <div className="p-4 pb-8 max-w-2xl mx-auto space-y-4">
      {/* Header */}
      <div className="card !p-5" style={{ background: 'linear-gradient(135deg,#450a0a,#7f1d1d)', borderColor: '#991b1b' }}>
        <div className="flex items-start gap-3">
          <div className="w-12 h-12 rounded-xl flex items-center justify-center shrink-0" style={{ background: 'rgba(239,68,68,0.2)' }}>
            <Shield size={24} className="text-red-400" />
          </div>
          <div>
            <div className="flex items-center gap-2 mb-1">
              <h1 className="text-lg font-bold text-white">Emergency Health Card</h1>
              <span className="text-[10px] bg-red-900 text-red-300 border border-red-700 px-2 py-0.5 rounded-full font-bold">Life-saving</span>
            </div>
            <p className="text-sm text-red-200">Share QR code with anyone — doctors get instant access to your critical health info in emergencies.</p>
          </div>
        </div>
      </div>

      {/* Emergency Card Preview */}
      {loaded && (
        <div ref={cardRef} className="card !p-5 border-2 border-red-200"
          style={{ background: 'linear-gradient(135deg,#fff5f5,#fff)' }}>
          {/* Card header */}
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: 'linear-gradient(135deg,#dc2626,#ef4444)' }}>
                <Heart size={14} className="text-white" fill="white" />
              </div>
              <div>
                <p className="text-sm font-black text-gray-900">{user?.full_name || 'Patient'}</p>
                <p className="text-[10px] text-gray-400">VitalOS Emergency Card</p>
              </div>
            </div>
            {profile.blood_group && (
              <div className="text-center">
                <div className="text-2xl font-black text-red-600">{profile.blood_group}</div>
                <div className="text-[9px] text-gray-400 font-bold uppercase">Blood Group</div>
              </div>
            )}
          </div>

          <div className="grid grid-cols-1 gap-3">
            {/* Critical info */}
            {profile.allergies.length > 0 && (
              <div className="bg-red-50 rounded-xl p-3 border border-red-100">
                <p className="text-[10px] font-black text-red-600 mb-1.5 flex items-center gap-1"><AlertTriangle size={10}/>ALLERGIES</p>
                <div className="flex flex-wrap gap-1">
                  {profile.allergies.map((a, i) => <span key={i} className="text-xs bg-red-100 text-red-700 px-2 py-0.5 rounded-full font-semibold">{a}</span>)}
                </div>
              </div>
            )}
            {profile.conditions.length > 0 && (
              <div className="bg-amber-50 rounded-xl p-3 border border-amber-100">
                <p className="text-[10px] font-black text-amber-600 mb-1.5">⚠️ CONDITIONS</p>
                <div className="flex flex-wrap gap-1">
                  {profile.conditions.map((c, i) => <span key={i} className="text-xs bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full font-semibold">{c}</span>)}
                </div>
              </div>
            )}
            {profile.medications.length > 0 && (
              <div className="bg-blue-50 rounded-xl p-3 border border-blue-100">
                <p className="text-[10px] font-black text-blue-600 mb-1.5">💊 MEDICATIONS</p>
                <div className="flex flex-wrap gap-1">
                  {profile.medications.map((m, i) => <span key={i} className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full font-semibold">{m}</span>)}
                </div>
              </div>
            )}

            {/* Contact info */}
            {profile.emergency_contact_phone && (
              <div className="bg-green-50 rounded-xl p-3 border border-green-100">
                <p className="text-[10px] font-black text-green-600 mb-1.5">📞 EMERGENCY CONTACT</p>
                <p className="text-sm font-bold text-gray-900">{profile.emergency_contact_name}</p>
                <p className="text-sm text-green-700 font-mono">{profile.emergency_contact_phone}</p>
                {profile.emergency_contact_relation && <p className="text-xs text-gray-400">{profile.emergency_contact_relation}</p>}
              </div>
            )}

            {(profile.doctor_name || profile.insurance_provider) && (
              <div className="grid grid-cols-2 gap-2">
                {profile.doctor_name && (
                  <div className="bg-purple-50 rounded-xl p-3 border border-purple-100">
                    <p className="text-[10px] font-black text-purple-600 mb-1">👨‍⚕️ DOCTOR</p>
                    <p className="text-xs font-bold text-gray-900">{profile.doctor_name}</p>
                    {profile.doctor_phone && <p className="text-xs text-purple-700 font-mono">{profile.doctor_phone}</p>}
                  </div>
                )}
                {profile.insurance_provider && (
                  <div className="bg-cyan-50 rounded-xl p-3 border border-cyan-100">
                    <p className="text-[10px] font-black text-cyan-600 mb-1">🛡️ INSURANCE</p>
                    <p className="text-xs font-bold text-gray-900">{profile.insurance_provider}</p>
                    {profile.insurance_id && <p className="text-xs text-gray-500">{profile.insurance_id}</p>}
                  </div>
                )}
              </div>
            )}

            {profile.organ_donor && (
              <div className="bg-emerald-50 rounded-xl p-2.5 border border-emerald-100 text-center">
                <p className="text-xs font-black text-emerald-600">💚 REGISTERED ORGAN DONOR</p>
              </div>
            )}

            {profile.notes && (
              <div className="bg-gray-50 rounded-xl p-3 border border-gray-100">
                <p className="text-[10px] font-black text-gray-500 mb-1">📝 NOTES</p>
                <p className="text-xs text-gray-600">{profile.notes}</p>
              </div>
            )}
          </div>

          {/* QR placeholder + actions */}
          <div className="mt-4 pt-4 border-t border-gray-100 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-12 h-12 bg-gray-100 rounded-lg flex items-center justify-center">
                <QrCode size={24} className="text-gray-400" />
              </div>
              <div>
                <p className="text-[10px] font-bold text-gray-600">Scan for full card</p>
                <p className="text-[9px] text-gray-400 font-mono truncate max-w-32">{cardUrl.replace('https://', '')}</p>
              </div>
            </div>
            <div className="flex gap-2">
              <button onClick={share} className="flex items-center gap-1 text-xs text-teal-600 border border-teal-200 bg-teal-50 px-2.5 py-1.5 rounded-lg">
                <Share2 size={11} /> Share
              </button>
              <button onClick={() => setEditing(true)} className="flex items-center gap-1 text-xs text-gray-600 border border-gray-200 bg-gray-50 px-2.5 py-1.5 rounded-lg">
                <Edit3 size={11} /> Edit
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit form */}
      {editing && (
        <div className="card !p-5 space-y-4">
          <div className="flex items-center justify-between">
            <p className="text-sm font-bold text-gray-800">Edit emergency profile</p>
            <button onClick={() => setEditing(false)}><X size={15} className="text-gray-400" /></button>
          </div>

          {/* Blood group */}
          <div>
            <label className="text-xs font-semibold text-gray-600 mb-2 block">Blood Group</label>
            <div className="flex flex-wrap gap-1.5">
              {BLOOD_GROUPS.map(bg => (
                <button key={bg} onClick={() => setProfile(p => ({ ...p, blood_group: bg }))}
                  className={`text-sm px-3 py-1.5 rounded-lg border font-bold transition-colors ${profile.blood_group === bg ? 'bg-red-600 text-white border-red-600' : 'border-gray-200 text-gray-500'}`}>{bg}</button>
              ))}
            </div>
          </div>

          {/* Allergies */}
          <div>
            <label className="text-xs font-semibold text-gray-600 mb-2 block">Allergies</label>
            <div className="flex gap-2 mb-2">
              <input className="input text-sm flex-1" placeholder="e.g. Penicillin, Peanuts" value={newAllergy} onChange={e => setNewAllergy(e.target.value)} onKeyDown={e => e.key==='Enter'&&addItem('allergies',newAllergy,setNewAllergy)} />
              <button onClick={() => addItem('allergies', newAllergy, setNewAllergy)} className="btn-primary text-xs px-3"><Plus size={13}/></button>
            </div>
            <div className="flex flex-wrap gap-1.5">{profile.allergies.map((a,i) => <span key={i} className="flex items-center gap-1 text-xs bg-red-100 text-red-700 px-2 py-1 rounded-full">{a}<button onClick={()=>removeItem('allergies',i)}><X size={10}/></button></span>)}</div>
          </div>

          {/* Conditions */}
          <div>
            <label className="text-xs font-semibold text-gray-600 mb-2 block">Medical Conditions</label>
            <div className="flex gap-2 mb-2">
              <input className="input text-sm flex-1" placeholder="e.g. Diabetes Type 2, Hypertension" value={newCondition} onChange={e => setNewCondition(e.target.value)} onKeyDown={e => e.key==='Enter'&&addItem('conditions',newCondition,setNewCondition)} />
              <button onClick={() => addItem('conditions', newCondition, setNewCondition)} className="btn-primary text-xs px-3"><Plus size={13}/></button>
            </div>
            <div className="flex flex-wrap gap-1.5">{profile.conditions.map((c,i) => <span key={i} className="flex items-center gap-1 text-xs bg-amber-100 text-amber-700 px-2 py-1 rounded-full">{c}<button onClick={()=>removeItem('conditions',i)}><X size={10}/></button></span>)}</div>
          </div>

          {/* Medications */}
          <div>
            <label className="text-xs font-semibold text-gray-600 mb-2 block">Current Medications</label>
            <div className="flex gap-2 mb-2">
              <input className="input text-sm flex-1" placeholder="e.g. Metformin 500mg, Aspirin 75mg" value={newMed} onChange={e => setNewMed(e.target.value)} onKeyDown={e => e.key==='Enter'&&addItem('medications',newMed,setNewMed)} />
              <button onClick={() => addItem('medications', newMed, setNewMed)} className="btn-primary text-xs px-3"><Plus size={13}/></button>
            </div>
            <div className="flex flex-wrap gap-1.5">{profile.medications.map((m,i) => <span key={i} className="flex items-center gap-1 text-xs bg-blue-100 text-blue-700 px-2 py-1 rounded-full">{m}<button onClick={()=>removeItem('medications',i)}><X size={10}/></button></span>)}</div>
          </div>

          {/* Emergency contact */}
          <div>
            <label className="text-xs font-semibold text-gray-600 mb-2 block">Emergency Contact</label>
            <div className="grid grid-cols-2 gap-2">
              <input className="input text-sm" placeholder="Contact name" value={profile.emergency_contact_name} onChange={e => setProfile(p => ({ ...p, emergency_contact_name: e.target.value }))} />
              <input className="input text-sm" placeholder="Relation (Wife/Son...)" value={profile.emergency_contact_relation} onChange={e => setProfile(p => ({ ...p, emergency_contact_relation: e.target.value }))} />
              <input className="input text-sm col-span-2" placeholder="+91 XXXXX XXXXX" value={profile.emergency_contact_phone} onChange={e => setProfile(p => ({ ...p, emergency_contact_phone: e.target.value }))} />
            </div>
          </div>

          {/* Doctor */}
          <div>
            <label className="text-xs font-semibold text-gray-600 mb-2 block">Primary Doctor</label>
            <div className="grid grid-cols-2 gap-2">
              <input className="input text-sm" placeholder="Dr. Name" value={profile.doctor_name} onChange={e => setProfile(p => ({ ...p, doctor_name: e.target.value }))} />
              <input className="input text-sm" placeholder="Phone" value={profile.doctor_phone} onChange={e => setProfile(p => ({ ...p, doctor_phone: e.target.value }))} />
            </div>
          </div>

          {/* Insurance */}
          <div>
            <label className="text-xs font-semibold text-gray-600 mb-2 block">Insurance</label>
            <div className="grid grid-cols-2 gap-2">
              <input className="input text-sm" placeholder="Provider name" value={profile.insurance_provider} onChange={e => setProfile(p => ({ ...p, insurance_provider: e.target.value }))} />
              <input className="input text-sm" placeholder="Policy / ID number" value={profile.insurance_id} onChange={e => setProfile(p => ({ ...p, insurance_id: e.target.value }))} />
            </div>
          </div>

          <div>
            <label className="text-xs font-semibold text-gray-600 mb-2 block">Additional notes</label>
            <textarea className="input text-sm h-16 resize-none" placeholder="Any other info for emergency responders..." value={profile.notes} onChange={e => setProfile(p => ({ ...p, notes: e.target.value }))} />
          </div>

          <div className="flex items-center gap-2">
            <input type="checkbox" id="organ" checked={profile.organ_donor} onChange={e => setProfile(p => ({ ...p, organ_donor: e.target.checked }))} className="w-4 h-4 accent-emerald-600" />
            <label htmlFor="organ" className="text-sm text-gray-700">I am a registered organ donor</label>
          </div>

          <button onClick={save} disabled={saving} className="btn-primary w-full py-3 flex items-center justify-center gap-2">
            <Check size={15} />{saving ? 'Saving...' : 'Save emergency card'}
          </button>
        </div>
      )}

      {!editing && !hasData && loaded && (
        <div className="card border-dashed border-2 text-center py-10">
          <Shield size={32} className="text-gray-200 mx-auto mb-3" />
          <p className="text-sm font-semibold text-gray-600 mb-1">Set up your emergency card</p>
          <p className="text-xs text-gray-400 mb-4">Add blood group, allergies, and emergency contacts. Could save your life.</p>
          <button onClick={() => setEditing(true)} className="btn-primary text-xs py-2">Set up now</button>
        </div>
      )}
    </div>
  )
}
