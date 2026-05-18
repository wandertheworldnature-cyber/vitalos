import { useEffect, useState } from 'react'
import { Star, Video, Clock, Check, X, Brain, Stethoscope, ExternalLink } from 'lucide-react'
import { useAuthStore } from '@/store/authStore'
import { supabase } from '@/lib/supabase'
import toast from 'react-hot-toast'

const SPECIALTIES = ['All','Preventive Medicine','General Physician','Cardiologist',
  'Endocrinologist','Internal Medicine','Neurologist','Dermatologist',
  'Gynecologist & Obstetrician','Psychiatrist','Nutritionist & Dietitian']

interface Doctor { id:string; name:string; specialty:string; qualifications:string; experience_years:number; rating:number; consultation_fee:number; hospital:string; languages:string[]; bio:string; is_active:boolean }
interface Slot   { id:string; slot_date:string; slot_time:string; is_available:boolean; is_booked:boolean }
interface Appt   { id:string; slot_date:string; slot_time:string; status:string; notes:string|null; meeting_link:string|null; doctor_id:string; doctor?:{ name:string; specialty:string }; attached_reports?:string[] }

function aiSuggest(insights: Array<{severity:string;title:string;description:string}>) {
  const all = insights.map(i=>`${i.title} ${i.description}`.toLowerCase())
  const out: Array<{specialty:string;reason:string;urgency:'urgent'|'recommended'|'routine'}> = []
  if (all.some(t=>t.includes('glucose')||t.includes('hba1c')||t.includes('diabet')))
    out.push({specialty:'Endocrinologist',reason:'High glucose or HbA1c pattern',urgency:'urgent'})
  if (all.some(t=>t.includes('cholesterol')||t.includes('ldl')||t.includes('cardiovascular')))
    out.push({specialty:'Cardiologist',reason:'Lipid profile concerns',urgency:'recommended'})
  if (all.some(t=>t.includes('thyroid')||t.includes('vitamin d')||t.includes('hemoglobin')))
    out.push({specialty:'Endocrinologist',reason:'Thyroid or vitamin imbalance',urgency:'recommended'})
  if (out.length===0) out.push({specialty:'Preventive Medicine',reason:'Annual preventive check-up',urgency:'routine'})
  return out.filter((s,i,a)=>a.findIndex(x=>x.specialty===s.specialty)===i).slice(0,3)
}

export default function DoctorsPage() {
  const { user } = useAuthStore()
  const [doctors, setDoctors]   = useState<Doctor[]>([])
  const [appts, setAppts]       = useState<Appt[]>([])
  const [specialty, setSpecialty] = useState('All')
  const [loading, setLoading]   = useState(true)
  const [selected, setSelected] = useState<Doctor|null>(null)
  const [slots, setSlots]       = useState<Slot[]>([])
  const [slotsLoading, setSlotsLoading] = useState(false)
  const [selSlot, setSelSlot]   = useState<Slot|null>(null)
  const [booking, setBooking]   = useState(false)
  const [notes, setNotes]       = useState('')
  const [tab, setTab]           = useState<'find'|'appointments'>('find')
  const [suggestions, setSuggestions] = useState<ReturnType<typeof aiSuggest>>([])
  const [reports, setReports]   = useState<Array<{id:string;file_name:string;lab_name:string|null}>>([])
  const [attached, setAttached] = useState<string[]>([])

  useEffect(()=>{ loadDoctors() }, [specialty])
  useEffect(()=>{ if(user){ loadAppts(); loadSuggestions(); loadReports() } }, [user])

  async function loadDoctors() {
    setLoading(true)
    let q = supabase.from('doctors')
      .select('id,name,specialty,qualifications,experience_years,rating,consultation_fee,hospital,languages,bio,is_active')
      .eq('is_active',true).order('rating',{ascending:false})
    if(specialty!=='All') q=q.ilike('specialty',`%${specialty.split(' ')[0]}%`)
    const {data}=await q
    setDoctors((data||[]) as Doctor[])
    setLoading(false)
  }

  async function loadAppts() {
    if(!user) return
    const {data}=await supabase.from('appointments')
      .select('id,slot_date,slot_time,status,notes,meeting_link,doctor_id,attached_reports,doctor:doctors(name,specialty)')
      .eq('user_id',user.id).order('slot_date',{ascending:true})
    setAppts((data||[]) as unknown as Appt[])
  }

  async function loadSuggestions() {
    if(!user) return
    const {data}=await supabase.from('ai_insights').select('severity,title,description')
      .eq('user_id',user.id).order('generated_at',{ascending:false}).limit(10)
    if(data?.length) setSuggestions(aiSuggest(data as Array<{severity:string;title:string;description:string}>))
  }

  async function loadReports() {
    if(!user) return
    const {data}=await supabase.from('health_reports').select('id,file_name,lab_name')
      .eq('user_id',user.id).order('created_at',{ascending:false}).limit(10)
    setReports((data||[]) as Array<{id:string;file_name:string;lab_name:string|null}>)
  }

  async function loadSlots(doc:Doctor) {
    setSelected(doc); setSelSlot(null); setSlotsLoading(true)
    const today=new Date().toISOString().split('T')[0]
    const end=new Date(Date.now()+14*86400000).toISOString().split('T')[0]
    const {data}=await supabase.from('doctor_slots').select('*')
      .eq('doctor_id',doc.id).eq('is_booked',false).eq('is_available',true)
      .gte('slot_date',today).lte('slot_date',end)
      .order('slot_date').order('slot_time')
    setSlots((data||[]) as Slot[])
    setSlotsLoading(false)
  }

  async function book() {
    if(!user||!selected||!selSlot){ toast.error('Select a time slot first'); return }
    setBooking(true)
    try {
      const roomId = Math.random().toString(36).slice(2,9)
      const meetLink = `https://meet.jit.si/VitalOS-${roomId}`

      // Step 1: Insert appointment
      const insertData = {
        user_id: user.id,
        doctor_id: selected.id,
        slot_date: selSlot.slot_date,
        slot_time: selSlot.slot_time,
        notes: notes||null,
        status: 'scheduled',
        meeting_link: meetLink,
        ...(attached.length>0 ? {attached_reports:attached} : {}),
      }

      const {data:appt, error:apptErr} = await supabase
        .from('appointments').insert(insertData).select('id').single()

      if(apptErr) {
        console.error('Appointment insert error:', JSON.stringify(apptErr))
        toast.error(`Booking failed: ${apptErr.message}`)
        setBooking(false)
        return
      }

      // Step 2: Mark slot as booked (separate call, non-blocking if fails)
      const {error:slotErr} = await supabase
        .from('doctor_slots').update({is_booked:true}).eq('id',selSlot.id)
      if(slotErr) console.warn('Slot update warning:', slotErr.message)

      // Step 3: Send email (non-blocking)
      supabase.functions.invoke('send-appointment-email',{
        body:{appointmentId:appt.id,type:'confirmed'}
      }).catch(e=>console.log('Email skipped:',e))

      toast.success(
        `✅ Booked with ${selected.name}!\n📧 Confirmation sent to ${user.email}\n🔗 Meeting link ready`,
        {duration:6000}
      )
      setSelected(null); setSelSlot(null); setNotes(''); setSlots([]); setAttached([])
      loadAppts(); setTab('appointments')
    } catch(err) {
      console.error('Booking exception:', err)
      toast.error('Unexpected error — please try again')
    } finally { setBooking(false) }
  }

  async function cancel(id:string, date:string, time:string, docId:string) {
    if(!confirm('Cancel this appointment?')) return
    await supabase.from('appointments').update({status:'cancelled'}).eq('id',id)
    await supabase.from('doctor_slots').update({is_booked:false})
      .eq('doctor_id',docId).eq('slot_date',date).eq('slot_time',time)
    supabase.functions.invoke('send-appointment-email',{body:{appointmentId:id,type:'cancelled'}}).catch(()=>{})
    toast.success('Cancelled')
    loadAppts()
  }

  const slotsByDate = slots.reduce((a,s)=>{ if(!a[s.slot_date]) a[s.slot_date]=[]; a[s.slot_date].push(s); return a },{} as Record<string,Slot[]>)
  const statusCls: Record<string,string> = {
    scheduled:'bg-blue-50 text-blue-700 border border-blue-200',
    completed:'bg-green-50 text-green-700 border border-green-200',
    cancelled:'bg-red-50 text-red-700 border border-red-200',
  }

  return (
    <div className="p-4 md:p-6 max-w-5xl space-y-5">
      {/* Header + tabs */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <h1 className="text-xl font-bold text-gray-900">Doctors & consultations</h1>
        <div className="flex gap-1 bg-gray-100 rounded-lg p-1">
          {(['find','appointments'] as const).map(t=>(
            <button key={t} onClick={()=>setTab(t)}
              className={`text-xs px-3 py-1.5 rounded-md capitalize transition-colors ${tab===t?'bg-white shadow-sm font-semibold text-gray-900':'text-gray-500'}`}>
              {t==='find'?'Find doctors':`My appointments (${appts.length})`}
            </button>
          ))}
        </div>
      </div>

      {/* FIND TAB */}
      {tab==='find' && (
        <>
          {/* AI suggestions */}
          {suggestions.length>0 && (
            <div className="card border-purple-100" style={{background:'linear-gradient(135deg,#faf5ff,#f3e8ff)'}}>
              <p className="text-sm font-bold text-purple-800 mb-2 flex items-center gap-2"><Brain size={15}/>AI suggests for you</p>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
                {suggestions.map((s,i)=>(
                  <button key={i} onClick={()=>setSpecialty(s.specialty)}
                    className={`text-left p-2.5 rounded-xl border text-xs ${
                      s.urgency==='urgent'?'bg-red-50 border-red-200 text-red-700':
                      s.urgency==='recommended'?'bg-amber-50 border-amber-200 text-amber-700':
                      'bg-blue-50 border-blue-200 text-blue-700'}`}>
                    <div className="font-bold">{s.specialty}</div>
                    <div className="opacity-80 text-[10px] mt-0.5">{s.reason} · {s.urgency}</div>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Specialty filters */}
          <div className="flex gap-2 flex-wrap">
            {SPECIALTIES.map(s=>(
              <button key={s} onClick={()=>setSpecialty(s)}
                className={`text-xs px-3 py-1.5 rounded-full border transition-colors ${specialty===s?'text-white border-transparent':'border-gray-200 text-gray-500'}`}
                style={specialty===s?{background:'linear-gradient(135deg,#0f6e56,#1d9e75)'}:{}}>
                {s}
              </button>
            ))}
          </div>

          {/* Doctor cards */}
          {loading?<p className="text-gray-400 text-sm">Loading...</p>:(
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {doctors.map(doc=>(
                <div key={doc.id} onClick={()=>loadSlots(doc)}
                  className={`card cursor-pointer hover:shadow-md transition-all ${selected?.id===doc.id?'border-teal-400 ring-1 ring-teal-100':''}`}>
                  <div className="flex gap-3 mb-2">
                    <div className="w-12 h-12 rounded-full flex items-center justify-center text-white font-bold text-sm shrink-0"
                      style={{background:'linear-gradient(135deg,#0f6e56,#1d9e75)'}}>
                      {doc.name.split(' ').slice(-1)[0].slice(0,2)}
                    </div>
                    <div>
                      <p className="text-sm font-bold text-gray-900">{doc.name}</p>
                      <p className="text-xs text-teal-600 font-semibold">{doc.specialty}</p>
                      <p className="text-[10px] text-gray-400">{doc.qualifications}</p>
                    </div>
                  </div>
                  <div className="flex gap-4 text-xs text-gray-500 mb-2">
                    <span className="flex items-center gap-1"><Star size={10} className="fill-amber-400 text-amber-400"/>{doc.rating}</span>
                    <span>{doc.experience_years} yrs</span>
                    <span className="flex items-center gap-1 text-teal-600"><Video size={10}/>Video</span>
                  </div>
                  {doc.bio && <p className="text-xs text-gray-500 mb-2 line-clamp-2">{doc.bio}</p>}
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-bold text-gray-900">₹{doc.consultation_fee}</p>
                    {doc.hospital && <p className="text-[10px] text-gray-400">{doc.hospital}</p>}
                  </div>
                </div>
              ))}
              {doctors.length===0 && (
                <div className="col-span-2 card text-center py-10 border-dashed">
                  <Stethoscope size={28} className="text-gray-200 mx-auto mb-2"/>
                  <p className="text-gray-400 text-sm">No doctors — Admin → Doctors → Add</p>
                </div>
              )}
            </div>
          )}

          {/* Booking panel */}
          {selected && (
            <div className="card border-teal-200" style={{background:'linear-gradient(135deg,#f0fdf8,#ecfdf5)'}}>
              <div className="flex items-start justify-between mb-3">
                <div>
                  <h3 className="text-sm font-bold text-gray-900">Book with {selected.name}</h3>
                  <p className="text-xs text-teal-600">{selected.specialty} · ₹{selected.consultation_fee}</p>
                </div>
                <div className="text-[10px] bg-amber-100 text-amber-700 px-2 py-1 rounded-lg font-medium">
                  🧪 Test mode — no payment
                </div>
              </div>

              {slotsLoading ? (
                <p className="text-xs text-gray-400 py-4 text-center">Loading available slots...</p>
              ) : Object.keys(slotsByDate).length===0 ? (
                <div className="bg-amber-50 border border-amber-100 rounded-xl p-4 text-center">
                  <p className="text-sm font-semibold text-amber-700">No slots available</p>
                  <p className="text-xs text-amber-600 mt-1">Admin needs to add slots for this doctor.</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {Object.entries(slotsByDate).map(([date,daySlots])=>{
                    const avail=daySlots.filter(s=>s.is_available)
                    if(!avail.length) return null
                    return (
                      <div key={date}>
                        <p className="text-xs font-bold text-gray-700 mb-1.5">
                          {new Date(date+'T00:00:00').toLocaleDateString('en-IN',{weekday:'long',day:'numeric',month:'short'})}
                        </p>
                        <div className="flex flex-wrap gap-2">
                          {avail.map(slot=>(
                            <button key={slot.id} onClick={()=>setSelSlot(slot)}
                              className={`text-xs px-3 py-1.5 rounded-lg border flex items-center gap-1 transition-colors ${selSlot?.id===slot.id?'text-white border-transparent':'bg-white border-gray-200 text-gray-600 hover:border-teal-300'}`}
                              style={selSlot?.id===slot.id?{background:'linear-gradient(135deg,#0f6e56,#1d9e75)'}:{}}>
                              <Clock size={10}/>{slot.slot_time.slice(0,5)}
                            </button>
                          ))}
                        </div>
                      </div>
                    )
                  })}

                  <textarea value={notes} onChange={e=>setNotes(e.target.value)}
                    className="input text-xs h-14 resize-none w-full"
                    placeholder="Symptoms or reason (optional)"/>

                  {reports.length>0 && (
                    <div>
                      <p className="text-xs font-semibold text-gray-700 mb-1.5">Attach lab reports for doctor</p>
                      <div className="flex flex-wrap gap-2">
                        {reports.map(r=>(
                          <label key={r.id} className="flex items-center gap-1.5 text-xs cursor-pointer">
                            <input type="checkbox" className="accent-teal-500"
                              checked={attached.includes(r.id)}
                              onChange={e=>setAttached(p=>e.target.checked?[...p,r.id]:p.filter(x=>x!==r.id))}/>
                            <span className="text-gray-600 truncate max-w-[160px]">{r.lab_name||r.file_name}</span>
                          </label>
                        ))}
                      </div>
                    </div>
                  )}

                  <div className="bg-blue-50 border border-blue-100 rounded-lg p-3 text-xs text-blue-700">
                    📧 Confirmation + video meeting link sent to <strong>{user?.email}</strong> and doctor
                  </div>

                  <div className="flex gap-3 items-center flex-wrap">
                    <button onClick={book} disabled={!selSlot||booking}
                      className="btn-primary flex items-center gap-2 disabled:opacity-40">
                      <Check size={14}/>{booking?'Booking...':!selSlot?'Select a slot first':`Confirm — ₹${selected.consultation_fee}`}
                    </button>
                    <button onClick={()=>{setSelected(null);setSlots([])}} className="btn-secondary flex items-center gap-2">
                      <X size={14}/>Cancel
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </>
      )}

      {/* APPOINTMENTS TAB */}
      {tab==='appointments' && (
        <div className="space-y-3">
          {appts.length===0 ? (
            <div className="card text-center py-12">
              <p className="text-gray-400 text-sm mb-3">No appointments yet</p>
              <button onClick={()=>setTab('find')} className="btn-primary text-xs py-2">Find a doctor</button>
            </div>
          ) : appts.map(appt=>{
            const roomId = appt.meeting_link?.split('VitalOS-')[1]
            return (
              <div key={appt.id} className="card">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex gap-3">
                    <div className="w-10 h-10 rounded-full flex items-center justify-center text-white text-xs font-bold shrink-0"
                      style={{background:'linear-gradient(135deg,#0f6e56,#1d9e75)'}}>Dr</div>
                    <div>
                      <p className="text-sm font-bold text-gray-900">{appt.doctor?.name}</p>
                      <p className="text-xs text-teal-600">{appt.doctor?.specialty}</p>
                      <p className="text-xs text-gray-400 mt-1">
                        📅 {new Date(appt.slot_date+'T00:00:00').toLocaleDateString('en-IN',{weekday:'short',day:'numeric',month:'long'})} · {appt.slot_time?.slice(0,5)}
                      </p>
                      {appt.meeting_link && (
                        <p className="text-[10px] text-teal-600 mt-0.5 flex items-center gap-1">
                          🔗 {appt.meeting_link}
                        </p>
                      )}
                      {appt.notes && <p className="text-[10px] text-gray-400 mt-0.5 italic">"{appt.notes}"</p>}
                    </div>
                  </div>
                  <div className="flex flex-col items-end gap-2 shrink-0">
                    <span className={`text-xs px-2 py-1 rounded-lg font-semibold capitalize ${statusCls[appt.status]||statusCls.scheduled}`}>
                      {appt.status}
                    </span>
                    {appt.status==='scheduled' && roomId && (
                      <a href={`/consultation/${roomId}`}
                        className="flex items-center gap-1.5 text-xs text-white px-3 py-1.5 rounded-lg font-semibold"
                        style={{background:'linear-gradient(135deg,#0f6e56,#1d9e75)'}}>
                        <Video size={11}/>Join call
                      </a>
                    )}
                    {appt.status==='scheduled' && (
                      <button onClick={()=>cancel(appt.id,appt.slot_date,appt.slot_time,appt.doctor_id)}
                        className="text-xs text-red-500 hover:text-red-700">Cancel</button>
                    )}
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
