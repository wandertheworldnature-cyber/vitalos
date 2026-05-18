import { useEffect, useState } from 'react'
import { Star, Video, Clock, Check, X, Calendar, Brain, Stethoscope } from 'lucide-react'
import { useAuthStore } from '@/store/authStore'
import { supabase } from '@/lib/supabase'
import type { Doctor, Appointment } from '@/types'
import toast from 'react-hot-toast'

const SPECIALTIES = ['All','Preventive Medicine','General Physician','Cardiologist',
  'Endocrinologist','Internal Medicine','Neurologist','Dermatologist',
  'Gynecologist & Obstetrician','Psychiatrist','Nutritionist & Dietitian']

interface DBSlot { id: string; slot_date: string; slot_time: string; is_available: boolean; is_booked: boolean }

function getAISuggestions(insights: Array<{ severity: string; title: string; description: string }>) {
  const suggestions: Array<{ specialty: string; reason: string; urgency: 'urgent'|'recommended'|'routine' }> = []
  const all = insights.map(i => `${i.title} ${i.description}`.toLowerCase())
  if (all.some(t => t.includes('glucose')||t.includes('hba1c')||t.includes('diabet')))
    suggestions.push({ specialty:'Endocrinologist', reason:'High glucose or HbA1c pattern detected', urgency:'urgent' })
  if (all.some(t => t.includes('cholesterol')||t.includes('ldl')||t.includes('cardiovascular')))
    suggestions.push({ specialty:'Cardiologist', reason:'Lipid profile concerns — cardiovascular risk', urgency:'recommended' })
  if (all.some(t => t.includes('thyroid')||t.includes('vitamin d')||t.includes('hemoglobin')))
    suggestions.push({ specialty:'Endocrinologist', reason:'Thyroid or vitamin imbalance detected', urgency:'recommended' })
  if (all.some(t => t.includes('kidney')||t.includes('creatinine')))
    suggestions.push({ specialty:'Nephrologist', reason:'Kidney function markers need evaluation', urgency:'urgent' })
  if (suggestions.length === 0)
    suggestions.push({ specialty:'Preventive Medicine', reason:'Annual preventive health check-up', urgency:'routine' })
  return suggestions.filter((s,i,a)=>a.findIndex(x=>x.specialty===s.specialty)===i).slice(0,3)
}

export default function DoctorsPage() {
  const { user } = useAuthStore()
  const [doctors, setDoctors] = useState<Doctor[]>([])
  const [appointments, setAppointments] = useState<Appointment[]>([])
  const [specialty, setSpecialty] = useState('All')
  const [loading, setLoading] = useState(true)
  const [selected, setSelected] = useState<Doctor | null>(null)
  const [slots, setSlots] = useState<DBSlot[]>([])
  const [slotsLoading, setSlotsLoading] = useState(false)
  const [selectedSlot, setSelectedSlot] = useState<DBSlot | null>(null)
  const [booking, setBooking] = useState(false)
  const [notes, setNotes] = useState('')
  const [tab, setTab] = useState<'find'|'appointments'>('find')
  const [aiSuggestions, setAiSuggestions] = useState<ReturnType<typeof getAISuggestions>>([])
  const [attachReports, setAttachReports] = useState<string[]>([])
  const [availableReports, setAvailableReports] = useState<Array<{id:string;file_name:string;lab_name:string|null}>>([])

  useEffect(() => { loadDoctors() }, [specialty])
  useEffect(() => { if (user) { loadAppointments(); loadAISuggestions(); loadReports() } }, [user])

  async function loadDoctors() {
    setLoading(true)
    let q = supabase.from('doctors')
      .select('id,name,specialty,qualifications,experience_years,rating,consultation_fee,hospital,languages,bio,is_active')
      .eq('is_active', true).order('rating', { ascending: false })
    if (specialty !== 'All') q = q.ilike('specialty', `%${specialty.split(' ')[0]}%`)
    const { data } = await q
    setDoctors((data||[]) as Doctor[])
    setLoading(false)
  }

  async function loadAppointments() {
    if (!user) return
    const { data } = await supabase.from('appointments')
      .select('*, doctor:doctors(id,name,specialty,qualifications)')
      .eq('user_id', user.id).order('slot_date', { ascending: true })
    setAppointments((data||[]) as unknown as Appointment[])
  }

  async function loadAISuggestions() {
    if (!user) return
    const { data } = await supabase.from('ai_insights').select('severity,title,description')
      .eq('user_id', user.id).order('generated_at', { ascending: false }).limit(10)
    if (data?.length) setAiSuggestions(getAISuggestions(data as Array<{ severity: string; title: string; description: string }>))
  }

  async function loadReports() {
    if (!user) return
    const { data } = await supabase.from('health_reports').select('id,file_name,lab_name')
      .eq('user_id', user.id).eq('ocr_status','done').order('created_at',{ ascending:false }).limit(10)
    setAvailableReports((data||[]) as Array<{id:string;file_name:string;lab_name:string|null}>)
  }

  async function loadSlots(doctor: Doctor) {
    setSelected(doctor); setSelectedSlot(null); setSlotsLoading(true)
    const today = new Date().toISOString().split('T')[0]
    const future = new Date(); future.setDate(future.getDate()+14)
    const end = future.toISOString().split('T')[0]
    const { data } = await supabase.from('doctor_slots').select('*')
      .eq('doctor_id', doctor.id).eq('is_booked', false).eq('is_available', true)
      .gte('slot_date', today).lte('slot_date', end)
      .order('slot_date').order('slot_time')
    setSlots((data||[]) as DBSlot[])
    setSlotsLoading(false)
  }

  async function handleBook() {
    if (!user || !selected || !selectedSlot) return
    setBooking(true)
    try {
      const roomId = Math.random().toString(36).slice(2,9)
      const meetLink = `https://meet.jit.si/VitalOS-${roomId}`

      // Insert appointment — simple, no payment required in test mode
      const { data: apptData, error } = await supabase
        .from('appointments')
        .insert({
          user_id: user.id,
          doctor_id: selected.id,
          slot_date: selectedSlot.slot_date,
          slot_time: selectedSlot.slot_time,
          notes: notes || null,
          status: 'scheduled',
          meeting_link: meetLink,
          attached_reports: attachReports.length > 0 ? attachReports : null,
        })
        .select('id, slot_date, slot_time, meeting_link')
        .single()

      if (error) {
        console.error('Booking error:', error)
        toast.error(`Booking failed: ${error.message}`)
        setBooking(false)
        return
      }

      // Mark slot as booked
      await supabase.from('doctor_slots')
        .update({ is_booked: true })
        .eq('id', selectedSlot.id)

      // Send email notification (non-blocking — don't fail if email fails)
      try {
        await supabase.functions.invoke('send-appointment-email', {
          body: { appointmentId: apptData.id, type: 'confirmed' }
        })
      } catch (emailErr) {
        console.log('Email notification skipped:', emailErr)
      }

      toast.success(`✅ Appointment confirmed with ${selected.name}!\nMeeting link sent to ${user.email}`, { duration: 5000 })
      setSelected(null); setSelectedSlot(null); setNotes(''); setSlots([]); setAttachReports([])
      loadAppointments()
      setTab('appointments')
    } catch (err) {
      console.error('Unexpected booking error:', err)
      toast.error('Something went wrong. Please try again.')
    } finally {
      setBooking(false)
    }
  }

  async function cancelAppointment(apptId: string, slotDate: string, slotTime: string, doctorId: string) {
    if (!confirm('Cancel this appointment?')) return
    await supabase.from('appointments').update({ status:'cancelled' }).eq('id', apptId)
    await supabase.from('doctor_slots').update({ is_booked:false })
      .eq('doctor_id', doctorId).eq('slot_date', slotDate).eq('slot_time', slotTime)
    try {
      await supabase.functions.invoke('send-appointment-email', { body:{ appointmentId:apptId, type:'cancelled' } })
    } catch {}
    toast.success('Appointment cancelled')
    loadAppointments()
  }

  const slotsByDate = slots.reduce((acc,s) => {
    if (!acc[s.slot_date]) acc[s.slot_date]=[]
    acc[s.slot_date].push(s)
    return acc
  }, {} as Record<string,DBSlot[]>)

  const statusStyle: Record<string,string> = {
    scheduled: 'bg-blue-50 text-blue-700 border border-blue-200',
    completed:  'bg-green-50 text-green-700 border border-green-200',
    cancelled:  'bg-red-50 text-red-700 border border-red-200',
  }
  const urgencyStyle = {
    urgent:      'bg-red-50 border-red-200 text-red-700',
    recommended: 'bg-amber-50 border-amber-200 text-amber-700',
    routine:     'bg-blue-50 border-blue-200 text-blue-700',
  }

  return (
    <div className="p-4 md:p-6 max-w-5xl space-y-5">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-gray-900">Doctors & consultations</h1>
        <div className="flex gap-1 bg-gray-100 rounded-lg p-1">
          {(['find','appointments'] as const).map(t => (
            <button key={t} onClick={() => setTab(t)}
              className={`text-xs px-3 py-1.5 rounded-md capitalize transition-colors ${tab===t?'bg-white shadow-sm font-semibold text-gray-900':'text-gray-500'}`}>
              {t==='find' ? 'Find doctors' : `My appointments (${appointments.length})`}
            </button>
          ))}
        </div>
      </div>

      {tab === 'find' && (
        <>
          {aiSuggestions.length>0 && (
            <div className="card border-purple-100" style={{ background:'linear-gradient(135deg,#faf5ff,#f3e8ff)' }}>
              <div className="flex items-center gap-2 mb-3">
                <Brain size={15} className="text-purple-600"/>
                <p className="text-sm font-bold text-purple-800">AI suggests these specialists for you</p>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
                {aiSuggestions.map((s,i) => (
                  <button key={i} onClick={() => setSpecialty(s.specialty)}
                    className={`text-left p-2.5 rounded-xl border text-xs transition-all hover:shadow-sm ${urgencyStyle[s.urgency]}`}>
                    <div className="flex items-start justify-between mb-1">
                      <p className="font-bold">{s.specialty}</p>
                      <span className="text-[9px] capitalize font-semibold opacity-70">{s.urgency}</span>
                    </div>
                    <p className="opacity-80 text-[10px]">{s.reason}</p>
                  </button>
                ))}
              </div>
            </div>
          )}

          <div className="flex gap-2 flex-wrap">
            {SPECIALTIES.map(s => (
              <button key={s} onClick={() => setSpecialty(s)}
                className={`text-xs px-3 py-1.5 rounded-full border transition-colors ${specialty===s?'text-white border-transparent':'border-gray-200 text-gray-500 hover:border-teal-300'}`}
                style={specialty===s?{background:'linear-gradient(135deg,#0f6e56,#1d9e75)'}:{}}>
                {s}
              </button>
            ))}
          </div>

          {loading ? <p className="text-gray-400 text-sm">Loading doctors...</p> : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {doctors.map(doc => (
                <div key={doc.id} onClick={() => loadSlots(doc)}
                  className={`card cursor-pointer transition-all hover:shadow-md ${selected?.id===doc.id?'border-teal-400 ring-1 ring-teal-100':''}`}>
                  <div className="flex gap-3 mb-3">
                    <div className="w-12 h-12 rounded-full flex items-center justify-center font-bold text-sm text-white shrink-0"
                      style={{ background:'linear-gradient(135deg,#0f6e56,#1d9e75)' }}>
                      {doc.name.split(' ').slice(-1)[0].slice(0,2)}
                    </div>
                    <div>
                      <p className="text-sm font-bold text-gray-900">{doc.name}</p>
                      <p className="text-xs text-teal-600 font-semibold">{doc.specialty}</p>
                      <p className="text-[10px] text-gray-400">{doc.qualifications}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-4 text-xs text-gray-500 mb-2">
                    <span className="flex items-center gap-1"><Star size={11} className="fill-amber-400 text-amber-400"/>{doc.rating}</span>
                    <span>{doc.experience_years} yrs</span>
                    <span className="flex items-center gap-1 text-teal-600"><Video size={11}/>Video</span>
                  </div>
                  {doc.bio && <p className="text-xs text-gray-500 mb-3 line-clamp-2">{doc.bio}</p>}
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-bold text-gray-900">₹{doc.consultation_fee}</p>
                    <div className="flex gap-1 flex-wrap">
                      {(doc.languages||[]).map(l=><span key={l} className="text-[10px] bg-gray-100 text-gray-500 px-1.5 py-0.5 rounded">{l}</span>)}
                    </div>
                  </div>
                  {doc.hospital && <p className="text-[10px] text-gray-400 mt-1">{doc.hospital}</p>}
                </div>
              ))}
              {doctors.length===0 && (
                <div className="col-span-2 card text-center py-12 border-dashed">
                  <Stethoscope size={28} className="text-gray-200 mx-auto mb-2"/>
                  <p className="text-gray-400 text-sm">No doctors found</p>
                </div>
              )}
            </div>
          )}

          {selected && (
            <div className="card border-teal-200" style={{ background:'linear-gradient(135deg,#f0fdf8,#ecfdf5)' }}>
              <h3 className="text-sm font-bold text-gray-900 mb-1">Book with {selected.name}</h3>
              <p className="text-xs text-gray-500 mb-4">
                🎯 Test mode: Booking is free — Razorpay integration coming soon
              </p>

              {slotsLoading ? (
                <p className="text-xs text-gray-400">Loading available slots...</p>
              ) : slots.length===0 ? (
                <div className="bg-amber-50 border border-amber-100 rounded-xl p-4 text-center">
                  <p className="text-sm font-semibold text-amber-700">No available slots</p>
                  <p className="text-xs text-amber-600 mt-1">Admin needs to add availability for this doctor.</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {Object.entries(slotsByDate).map(([date,daySlots]) => {
                    const available = daySlots.filter(s=>s.is_available)
                    if (!available.length) return null
                    return (
                      <div key={date}>
                        <p className="text-xs font-bold text-gray-700 mb-2">
                          {new Date(date+'T00:00:00').toLocaleDateString('en-IN',{weekday:'long',day:'numeric',month:'short'})}
                        </p>
                        <div className="flex flex-wrap gap-2">
                          {available.map(slot => (
                            <button key={slot.id} onClick={() => setSelectedSlot(slot)}
                              className={`text-xs px-3 py-1.5 rounded-lg border flex items-center gap-1 transition-colors ${selectedSlot?.id===slot.id?'text-white border-transparent':'bg-white border-gray-200 text-gray-600 hover:border-teal-300'}`}
                              style={selectedSlot?.id===slot.id?{background:'linear-gradient(135deg,#0f6e56,#1d9e75)'}:{}}>
                              <Clock size={10}/>{slot.slot_time.slice(0,5)}
                            </button>
                          ))}
                        </div>
                      </div>
                    )
                  })}

                  <textarea value={notes} onChange={e=>setNotes(e.target.value)}
                    className="input text-xs h-14 resize-none w-full"
                    placeholder="Symptoms or reason for consultation (optional)"/>

                  {availableReports.length>0 && (
                    <div>
                      <p className="text-xs font-semibold text-gray-700 mb-2">Attach lab reports</p>
                      <div className="flex flex-wrap gap-2">
                        {availableReports.map(r=>(
                          <label key={r.id} className="flex items-center gap-1.5 cursor-pointer">
                            <input type="checkbox" checked={attachReports.includes(r.id)}
                              onChange={e=>setAttachReports(prev=>e.target.checked?[...prev,r.id]:prev.filter(x=>x!==r.id))}
                              className="accent-teal-500"/>
                            <span className="text-xs text-gray-600 truncate max-w-[150px]">{r.lab_name||r.file_name}</span>
                          </label>
                        ))}
                      </div>
                    </div>
                  )}

                  <div className="bg-blue-50 border border-blue-100 rounded-lg p-3 text-xs text-blue-700">
                    📧 Confirmation + video link sent to <strong>{user?.email}</strong> and doctor
                  </div>

                  <div className="flex gap-3 items-center">
                    <button onClick={handleBook} disabled={!selectedSlot||booking}
                      className="btn-primary flex items-center gap-2 disabled:opacity-40">
                      <Check size={14}/>{booking?'Confirming...':`Confirm booking — ₹${selected.consultation_fee}`}
                    </button>
                    <button onClick={()=>{setSelected(null);setSlots([])}} className="btn-secondary flex items-center gap-2">
                      <X size={14}/>Cancel
                    </button>
                    {!selectedSlot && <p className="text-xs text-gray-400">← Select a time first</p>}
                  </div>
                </div>
              )}
            </div>
          )}
        </>
      )}

      {tab==='appointments' && (
        <div className="space-y-3">
          {appointments.length===0 ? (
            <div className="card text-center py-12">
              <p className="text-gray-400 text-sm mb-3">No appointments yet</p>
              <button onClick={()=>setTab('find')} className="btn-primary text-xs py-2">Find a doctor</button>
            </div>
          ) : appointments.map(appt=>{
            const roomId = appt.meeting_link?.split('VitalOS-')[1]
            const attachedCount = (appt as unknown as { attached_reports?: string[] }).attached_reports?.length||0
            return (
              <div key={appt.id} className="card">
                <div className="flex items-start justify-between">
                  <div className="flex gap-3">
                    <div className="w-10 h-10 rounded-full flex items-center justify-center font-bold text-xs text-white shrink-0"
                      style={{ background:'linear-gradient(135deg,#0f6e56,#1d9e75)' }}>Dr</div>
                    <div>
                      <p className="text-sm font-bold text-gray-900">{appt.doctor?.name}</p>
                      <p className="text-xs text-teal-600 font-medium">{appt.doctor?.specialty}</p>
                      <p className="text-xs text-gray-400 mt-1">
                        {new Date(appt.slot_date+'T00:00:00').toLocaleDateString('en-IN',{weekday:'short',day:'numeric',month:'long'})} at {appt.slot_time?.slice(0,5)}
                      </p>
                      {attachedCount>0 && <p className="text-[10px] text-teal-600 mt-0.5">📎 {attachedCount} report{attachedCount>1?'s':''} attached</p>}
                      {appt.meeting_link && (
                        <p className="text-[10px] text-gray-400 mt-0.5 break-all">🔗 {appt.meeting_link}</p>
                      )}
                    </div>
                  </div>
                  <div className="flex flex-col items-end gap-2">
                    <span className={`text-xs px-2 py-1 rounded-lg font-semibold capitalize ${statusStyle[appt.status]||statusStyle.scheduled}`}>
                      {appt.status}
                    </span>
                    {appt.status==='scheduled' && roomId && (
                      <a href={`/consultation/${roomId}`}
                        className="flex items-center gap-1.5 text-xs text-white px-3 py-1.5 rounded-lg font-semibold"
                        style={{ background:'linear-gradient(135deg,#0f6e56,#1d9e75)' }}>
                        <Video size={11}/> Join call
                      </a>
                    )}
                    {appt.status==='scheduled' && (
                      <button onClick={()=>cancelAppointment(appt.id,appt.slot_date,appt.slot_time,appt.doctor_id||appt.doctor?.id||'')}
                        className="text-xs text-red-500 hover:text-red-700">Cancel</button>
                    )}
                  </div>
                </div>
                {appt.notes && <p className="text-xs text-gray-400 mt-3 pt-3 border-t border-gray-100 italic">"{appt.notes}"</p>}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
