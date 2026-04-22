import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { Plus, Edit2, Trash2, X, Check, Calendar, Lock, Unlock, ChevronDown, ChevronUp } from 'lucide-react'
import toast from 'react-hot-toast'

interface Doctor {
  id: string; name: string; specialty: string; qualifications: string
  experience_years: number; rating: number; consultation_fee: number
  hospital: string; languages: string[]; bio: string; is_active: boolean
  doctor_email?: string; doctor_phone?: string
  notify_by_email?: boolean; notify_by_whatsapp?: boolean
}

interface Slot {
  id: string; slot_date: string; slot_time: string
  is_available: boolean; is_booked: boolean; locked_reason?: string
}

const EMPTY: Omit<Doctor,'id'> = {
  name:'', specialty:'', qualifications:'', experience_years:5, rating:4.5,
  consultation_fee:699, hospital:'', languages:['English','Hindi'], bio:'',
  is_active:true, doctor_email:'', doctor_phone:'', notify_by_email:true, notify_by_whatsapp:false,
}

const PRESET_TIMES = ['08:00','08:30','09:00','09:30','10:00','10:30','11:00','11:30',
  '12:00','14:00','14:30','15:00','15:30','16:00','16:30','17:00','17:30','18:00']

const SPECIALTIES = [
  'Preventive Medicine','General Physician','Internal Medicine',
  'Cardiologist','Interventional Cardiologist',
  'Endocrinologist','Diabetologist',
  'Neurologist','Neurosurgeon',
  'Orthopedic Surgeon','Spine Specialist',
  'Dermatologist','Cosmetologist',
  'Gynecologist & Obstetrician','Fertility Specialist',
  'Pediatrician','Neonatologist',
  'Psychiatrist','Psychologist',
  'Ophthalmologist','ENT Specialist',
  'Gastroenterologist','Hepatologist',
  'Pulmonologist','Chest Physician',
  'Nephrologist','Urologist',
  'Oncologist','Surgical Oncologist',
  'Rheumatologist','Immunologist',
  'Hematologist','Nutritionist & Dietitian',
  'Physiotherapist','Sports Medicine',
  'Dentist','Oral Surgeon',
  'Plastic Surgeon','Emergency Medicine',
  'Ayurvedic Physician','Homeopathic Physician',
  'Other (specify below)',
]

export default function AdminDoctors() {
  const [doctors, setDoctors] = useState<Doctor[]>([])
  const [showForm, setShowForm] = useState(false)
  const [editing, setEditing] = useState<Doctor | null>(null)
  const [form, setForm] = useState<Omit<Doctor,'id'>>(EMPTY)
  const [customSpecialty, setCustomSpecialty] = useState('')
  const [langInput, setLangInput] = useState('')
  const [saving, setSaving] = useState(false)
  const [slotsFor, setSlotsFor] = useState<Doctor | null>(null)
  const [slots, setSlots] = useState<Slot[]>([])
  const [slotsLoading, setSlotsLoading] = useState(false)
  const [bulkDate, setBulkDate] = useState('')
  const [bulkTimes, setBulkTimes] = useState<string[]>([])
  const [lockReason, setLockReason] = useState('')

  useEffect(() => { loadDoctors() }, [])

  async function loadDoctors() {
    const { data } = await supabase.from('doctors').select('*').order('name')
    setDoctors((data || []) as Doctor[])
  }

  async function loadSlots(doctor: Doctor) {
    setSlotsFor(doctor)
    setSlotsLoading(true)
    const today = new Date().toISOString().split('T')[0]
    const futureDate = new Date()
    futureDate.setDate(futureDate.getDate() + 30)
    const endDate = futureDate.toISOString().split('T')[0]

    const { data } = await supabase.from('doctor_slots').select('*')
      .eq('doctor_id', doctor.id)
      .gte('slot_date', today)
      .lte('slot_date', endDate)
      .order('slot_date').order('slot_time')
    setSlots((data || []) as Slot[])
    setSlotsLoading(false)
  }

  async function generateSlots() {
    if (!slotsFor || !bulkDate || bulkTimes.length === 0) {
      toast.error('Select a date and at least one time slot')
      return
    }
    const toInsert = bulkTimes.map(t => ({
      doctor_id: slotsFor.id,
      slot_date: bulkDate,
      slot_time: t,
      is_available: true,
      is_booked: false,
    }))
    const { error } = await supabase.from('doctor_slots').upsert(toInsert, { onConflict: 'doctor_id,slot_date,slot_time' })
    if (error) toast.error('Failed to add slots: ' + error.message)
    else { toast.success(`${bulkTimes.length} slots added for ${bulkDate}`); loadSlots(slotsFor) }
  }

  async function generateWeekSlots() {
    if (!slotsFor || bulkTimes.length === 0) { toast.error('Select time slots first'); return }
    const today = new Date()
    const toInsert: { doctor_id: string; slot_date: string; slot_time: string; is_available: boolean; is_booked: boolean }[] = []
    for (let d = 0; d < 30; d++) {
      const date = new Date(today)
      date.setDate(today.getDate() + d)
      if (date.getDay() === 0) continue // skip Sundays
      const dateStr = date.toISOString().split('T')[0]
      bulkTimes.forEach(t => toInsert.push({
        doctor_id: slotsFor.id, slot_date: dateStr, slot_time: t, is_available: true, is_booked: false,
      }))
    }
    const { error } = await supabase.from('doctor_slots').upsert(toInsert, { onConflict: 'doctor_id,slot_date,slot_time' })
    if (error) toast.error('Failed: ' + error.message)
    else { toast.success(`Generated ${toInsert.length} slots for next 30 days!`); loadSlots(slotsFor) }
  }

  async function toggleSlot(slot: Slot) {
    const { error } = await supabase.from('doctor_slots').update({
      is_available: !slot.is_available,
      locked_reason: !slot.is_available ? null : lockReason || 'Admin locked',
    }).eq('id', slot.id)
    if (error) toast.error('Update failed')
    else loadSlots(slotsFor!)
  }

  async function deleteSlot(id: string) {
    await supabase.from('doctor_slots').delete().eq('id', id)
    loadSlots(slotsFor!)
  }

  async function clearPastSlots() {
    if (!slotsFor) return
    const today = new Date().toISOString().split('T')[0]
    await supabase.from('doctor_slots').delete().eq('doctor_id', slotsFor.id).lt('slot_date', today)
    toast.success('Past slots cleared')
    loadSlots(slotsFor)
  }

  function openAdd() { setForm(EMPTY); setEditing(null); setCustomSpecialty(''); setLangInput(''); setShowForm(true) }
  function openEdit(d: Doctor) { setForm({ ...d }); setEditing(d); setCustomSpecialty(SPECIALTIES.includes(d.specialty) ? '' : d.specialty); setShowForm(true) }

  async function handleSave() {
    const specialty = form.specialty === 'Other (specify below)' ? customSpecialty : form.specialty
    if (!form.name || !specialty) { toast.error('Name and specialty required'); return }
    setSaving(true)
    try {
      const payload = { ...form, specialty }
      if (editing) {
        const { error } = await supabase.from('doctors').update(payload).eq('id', editing.id)
        if (error) throw error
        toast.success('Doctor updated')
      } else {
        const { error } = await supabase.from('doctors').insert(payload)
        if (error) throw error
        toast.success('Doctor added — now add their available slots')
      }
      setShowForm(false)
      loadDoctors()
    } catch (e: unknown) {
      toast.error('Save failed: ' + (e instanceof Error ? e.message : String(e)))
    } finally { setSaving(false) }
  }

  async function handleDelete(id: string, name: string) {
    if (!confirm(`Delete ${name}? This also removes all their slots.`)) return
    await supabase.from('doctors').delete().eq('id', id)
    toast.success('Doctor removed')
    loadDoctors()
  }

  const slotsByDate = slots.reduce((acc, s) => {
    if (!acc[s.slot_date]) acc[s.slot_date] = []
    acc[s.slot_date].push(s)
    return acc
  }, {} as Record<string, Slot[]>)

  return (
    <div className="p-6 space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-white">Doctors</h1>
          <p className="text-sm text-gray-400">{doctors.length} registered</p>
        </div>
        <button onClick={openAdd} className="flex items-center gap-2 bg-teal-600 hover:bg-teal-700 text-white text-sm px-4 py-2 rounded-lg">
          <Plus size={14} /> Add doctor
        </button>
      </div>

      <div className="space-y-3">
        {doctors.map(d => (
          <div key={d.id}>
            <div className="bg-gray-900 border border-gray-800 rounded-xl p-4 flex items-start justify-between">
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-full bg-teal-800 flex items-center justify-center text-teal-300 text-sm font-bold shrink-0">
                  {d.name.split(' ').slice(-1)[0].slice(0, 2).toUpperCase()}
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-medium text-white">{d.name}</p>
                    <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${d.is_active ? 'bg-green-900 text-green-400' : 'bg-gray-800 text-gray-500'}`}>
                      {d.is_active ? 'Active' : 'Hidden'}
                    </span>
                  </div>
                  <p className="text-xs text-gray-400">{d.specialty} · {d.hospital}</p>
                  <p className="text-xs text-gray-500">{d.qualifications} · {d.experience_years}yr · ⭐{d.rating} · ₹{d.consultation_fee}</p>
                  {d.doctor_email && <p className="text-[10px] text-gray-600 mt-0.5">📧 {d.doctor_email} (private)</p>}
                  {d.doctor_phone && <p className="text-[10px] text-gray-600">📱 {d.doctor_phone} (private)</p>}
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button onClick={() => slotsFor?.id === d.id ? setSlotsFor(null) : loadSlots(d)}
                  className="flex items-center gap-1 text-xs text-amber-400 border border-amber-800 rounded px-2 py-1 hover:bg-amber-900/30">
                  <Calendar size={12} /> Slots
                  {slotsFor?.id === d.id ? <ChevronUp size={11} /> : <ChevronDown size={11} />}
                </button>
                <button onClick={() => openEdit(d)} className="p-1.5 text-gray-400 hover:text-blue-400 border border-gray-700 rounded"><Edit2 size={13} /></button>
                <button onClick={() => handleDelete(d.id, d.name)} className="p-1.5 text-gray-400 hover:text-red-400 border border-gray-700 rounded"><Trash2 size={13} /></button>
              </div>
            </div>

            {/* Slot management panel */}
            {slotsFor?.id === d.id && (
              <div className="bg-gray-900/50 border border-gray-800 border-t-0 rounded-b-xl p-4 space-y-4">
                {/* Generate slots */}
                <div className="bg-gray-800 rounded-xl p-4">
                  <h3 className="text-xs font-semibold text-white mb-3">Add available slots</h3>
                  <div className="space-y-3">
                    <div>
                      <label className="text-[10px] text-gray-400 mb-1 block">Select times (click to toggle)</label>
                      <div className="flex flex-wrap gap-1.5">
                        {PRESET_TIMES.map(t => (
                          <button key={t} onClick={() => setBulkTimes(prev =>
                            prev.includes(t) ? prev.filter(x => x !== t) : [...prev, t]
                          )}
                            className={`text-[10px] px-2 py-1 rounded border transition-colors ${
                              bulkTimes.includes(t) ? 'bg-teal-600 text-white border-teal-600' : 'border-gray-600 text-gray-400 hover:border-teal-500'
                            }`}>
                            {t}
                          </button>
                        ))}
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <div className="flex-1">
                        <label className="text-[10px] text-gray-400 mb-1 block">For specific date</label>
                        <input type="date" className="w-full bg-gray-700 border border-gray-600 text-white text-xs rounded px-2 py-1.5"
                          value={bulkDate} onChange={e => setBulkDate(e.target.value)}
                          min={new Date().toISOString().split('T')[0]} />
                      </div>
                      <button onClick={generateSlots} className="self-end bg-teal-600 hover:bg-teal-700 text-white text-xs px-3 py-1.5 rounded">
                        Add date
                      </button>
                      <button onClick={generateWeekSlots} className="self-end bg-blue-700 hover:bg-blue-800 text-white text-xs px-3 py-1.5 rounded">
                        Add 30 days
                      </button>
                    </div>
                    <div className="flex gap-2 items-center">
                      <input className="flex-1 bg-gray-700 border border-gray-600 text-white text-xs rounded px-2 py-1.5"
                        placeholder="Lock reason (optional)" value={lockReason} onChange={e => setLockReason(e.target.value)} />
                      <button onClick={clearPastSlots} className="text-xs text-red-400 border border-red-800 px-2 py-1.5 rounded hover:bg-red-900/30">
                        Clear past
                      </button>
                    </div>
                  </div>
                </div>

                {/* Existing slots */}
                {slotsLoading ? (
                  <p className="text-xs text-gray-400">Loading slots...</p>
                ) : Object.keys(slotsByDate).length === 0 ? (
                  <p className="text-xs text-gray-500 text-center py-4">No slots yet — add slots above</p>
                ) : (
                  <div className="space-y-3 max-h-80 overflow-y-auto">
                    {Object.entries(slotsByDate).map(([date, daySlots]) => (
                      <div key={date}>
                        <p className="text-[10px] font-semibold text-gray-400 mb-1.5">
                          {new Date(date + 'T00:00:00').toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'short' })}
                          <span className="ml-2 text-gray-600">({daySlots.filter(s => s.is_available && !s.is_booked).length} available)</span>
                        </p>
                        <div className="flex flex-wrap gap-1.5">
                          {daySlots.map(slot => (
                            <div key={slot.id} className="flex items-center gap-1">
                              <button
                                onClick={() => toggleSlot(slot)}
                                disabled={slot.is_booked}
                                title={slot.locked_reason || (slot.is_available ? 'Click to lock' : 'Click to unlock')}
                                className={`text-[10px] px-2 py-1 rounded border transition-colors flex items-center gap-1 ${
                                  slot.is_booked ? 'bg-blue-900/40 text-blue-400 border-blue-800 cursor-not-allowed'
                                  : slot.is_available ? 'bg-green-900/30 text-green-400 border-green-800 hover:bg-red-900/30 hover:text-red-400 hover:border-red-800'
                                  : 'bg-red-900/30 text-red-400 border-red-800 hover:bg-green-900/30 hover:text-green-400 hover:border-green-800'
                                }`}>
                                {slot.is_booked ? '📅' : slot.is_available ? <Unlock size={9} /> : <Lock size={9} />}
                                {slot.slot_time.slice(0, 5)}
                              </button>
                              {!slot.is_booked && (
                                <button onClick={() => deleteSlot(slot.id)} className="text-gray-600 hover:text-red-400">
                                  <X size={10} />
                                </button>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
                <div className="flex gap-4 text-[10px] text-gray-500">
                  <span className="flex items-center gap-1"><Unlock size={9} className="text-green-400" /> Available (click to lock)</span>
                  <span className="flex items-center gap-1"><Lock size={9} className="text-red-400" /> Locked (click to unlock)</span>
                  <span className="flex items-center gap-1">📅 Booked (cannot change)</span>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Add/Edit Modal */}
      {showForm && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4 overflow-y-auto">
          <div className="bg-gray-900 border border-gray-700 rounded-2xl p-6 w-full max-w-lg my-4">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-base font-semibold text-white">{editing ? 'Edit doctor' : 'Add doctor'}</h2>
              <button onClick={() => setShowForm(false)}><X size={18} className="text-gray-400" /></button>
            </div>
            <div className="space-y-3 max-h-[72vh] overflow-y-auto pr-1">
              {/* Public fields */}
              <p className="text-[10px] text-gray-500 font-semibold uppercase tracking-wide">Visible to patients</p>
              {[
                { label: 'Full name *', key: 'name', placeholder: 'Dr. Priya Sharma' },
                { label: 'Qualifications', key: 'qualifications', placeholder: 'MBBS, MD (Preventive Medicine)' },
                { label: 'Hospital / Clinic', key: 'hospital', placeholder: 'Apollo Hospitals, Chennai' },
                { label: 'Bio', key: 'bio', placeholder: 'Brief description of expertise...' },
              ].map(f => (
                <div key={f.key}>
                  <label className="text-xs text-gray-400 mb-1 block">{f.label}</label>
                  <input className="w-full bg-gray-800 border border-gray-700 text-white text-sm rounded-lg px-3 py-2"
                    value={(form as Record<string,unknown>)[f.key] as string}
                    onChange={e => setForm(p => ({ ...p, [f.key]: e.target.value }))}
                    placeholder={f.placeholder} />
                </div>
              ))}
              <div>
                <label className="text-xs text-gray-400 mb-1 block">Specialty *</label>
                <select className="w-full bg-gray-800 border border-gray-700 text-white text-sm rounded-lg px-3 py-2"
                  value={form.specialty} onChange={e => setForm(p => ({ ...p, specialty: e.target.value }))}>
                  <option value="">Select...</option>
                  {SPECIALTIES.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
              {form.specialty === 'Other (specify below)' && (
                <input className="w-full bg-gray-800 border border-teal-600 text-white text-sm rounded-lg px-3 py-2"
                  value={customSpecialty} onChange={e => setCustomSpecialty(e.target.value)}
                  placeholder="Enter specialty..." />
              )}
              <div className="grid grid-cols-3 gap-3">
                {[{ l:'Exp (yrs)', k:'experience_years', t:'number' }, { l:'Rating', k:'rating', t:'number' }, { l:'Fee (₹)', k:'consultation_fee', t:'number' }].map(f => (
                  <div key={f.k}>
                    <label className="text-xs text-gray-400 mb-1 block">{f.l}</label>
                    <input type={f.t} className="w-full bg-gray-800 border border-gray-700 text-white text-sm rounded-lg px-3 py-2"
                      value={(form as Record<string,unknown>)[f.k] as number}
                      onChange={e => setForm(p => ({ ...p, [f.k]: +e.target.value }))} />
                  </div>
                ))}
              </div>
              {/* Languages */}
              <div>
                <label className="text-xs text-gray-400 mb-1 block">Languages</label>
                <div className="flex gap-2 mb-1.5">
                  <input className="flex-1 bg-gray-800 border border-gray-700 text-white text-sm rounded-lg px-3 py-2"
                    value={langInput} onChange={e => setLangInput(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter' && langInput.trim()) { setForm(p => ({ ...p, languages: [...p.languages, langInput.trim()] })); setLangInput('') }}}
                    placeholder="Language (Enter to add)" />
                  <button onClick={() => { if (langInput.trim()) { setForm(p => ({ ...p, languages: [...p.languages, langInput.trim()] })); setLangInput('') }}}
                    className="bg-teal-700 text-white text-xs px-3 rounded-lg">Add</button>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {(form.languages || []).map(l => (
                    <span key={l} className="flex items-center gap-1 bg-gray-700 text-gray-300 text-xs px-2 py-0.5 rounded-full">
                      {l} <button onClick={() => setForm(p => ({ ...p, languages: p.languages.filter(x => x !== l) }))} className="text-gray-500 hover:text-red-400">×</button>
                    </span>
                  ))}
                </div>
              </div>

              {/* Private fields */}
              <div className="border-t border-gray-700 pt-3 mt-3">
                <p className="text-[10px] text-amber-400 font-semibold uppercase tracking-wide mb-2">
                  🔒 Private — only visible to admin, used for notifications
                </p>
                {[{ label:'Doctor email (for appointment notifications)', key:'doctor_email', placeholder:'doctor@hospital.com', type:'email' },
                  { label:'Doctor phone / WhatsApp', key:'doctor_phone', placeholder:'+91 98765 43210', type:'tel' }].map(f => (
                  <div key={f.key} className="mb-2">
                    <label className="text-xs text-gray-400 mb-1 block">{f.label}</label>
                    <input type={f.type} className="w-full bg-gray-800 border border-amber-900/50 text-white text-sm rounded-lg px-3 py-2 focus:border-amber-500"
                      value={(form as Record<string,unknown>)[f.key] as string || ''}
                      onChange={e => setForm(p => ({ ...p, [f.key]: e.target.value }))}
                      placeholder={f.placeholder} />
                  </div>
                ))}
                <div className="flex gap-4 mt-2">
                  <label className="flex items-center gap-2 text-xs text-gray-400 cursor-pointer">
                    <input type="checkbox" checked={form.notify_by_email || false}
                      onChange={e => setForm(p => ({ ...p, notify_by_email: e.target.checked }))} className="accent-teal-500" />
                    Notify by email
                  </label>
                  <label className="flex items-center gap-2 text-xs text-gray-400 cursor-pointer">
                    <input type="checkbox" checked={form.notify_by_whatsapp || false}
                      onChange={e => setForm(p => ({ ...p, notify_by_whatsapp: e.target.checked }))} className="accent-teal-500" />
                    Notify by WhatsApp
                  </label>
                </div>
              </div>
              <label className="flex items-center gap-2 text-xs text-gray-400">
                <input type="checkbox" checked={form.is_active}
                  onChange={e => setForm(p => ({ ...p, is_active: e.target.checked }))} className="accent-teal-500" />
                Visible to users
              </label>
            </div>
            <div className="flex gap-3 mt-4 pt-4 border-t border-gray-800">
              <button onClick={handleSave} disabled={saving}
                className="flex-1 bg-teal-600 hover:bg-teal-700 text-white text-sm py-2.5 rounded-lg font-medium flex items-center justify-center gap-2 disabled:opacity-60">
                <Check size={14} /> {saving ? 'Saving...' : (editing ? 'Update' : 'Add doctor')}
              </button>
              <button onClick={() => setShowForm(false)} className="px-4 text-sm text-gray-400 border border-gray-700 rounded-lg">Cancel</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
