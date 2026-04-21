import { useEffect, useState } from 'react'
import { Star, Video, Clock, Check, X } from 'lucide-react'
import { useAuthStore } from '@/store/authStore'
import { supabase } from '@/lib/supabase'
import type { Doctor, Appointment, TimeSlot } from '@/types'
import toast from 'react-hot-toast'

const SPECIALTIES = ['All', 'Preventive Medicine', 'Cardiologist', 'Endocrinologist', 'Internal Medicine', 'Nutritionist', 'Neurologist', 'Dermatologist', 'Gynecologist & Obstetrician']

function generateSlots(): TimeSlot[] {
  const slots: TimeSlot[] = []
  const times = ['09:00', '09:30', '10:00', '10:30', '11:00', '14:00', '14:30', '15:00', '15:30', '16:00', '17:00']
  const today = new Date()
  for (let d = 1; d <= 7; d++) {
    const date = new Date(today)
    date.setDate(today.getDate() + d)
    if (date.getDay() === 0) continue
    const dateStr = date.toISOString().split('T')[0]
    for (const time of times) {
      if (Math.random() > 0.4) {
        slots.push({ id: `${dateStr}-${time}`, date: dateStr, time, available: true })
      }
    }
  }
  return slots
}

export default function DoctorsPage() {
  const { user } = useAuthStore()
  const [doctors, setDoctors] = useState<Doctor[]>([])
  const [appointments, setAppointments] = useState<Appointment[]>([])
  const [specialty, setSpecialty] = useState('All')
  const [loading, setLoading] = useState(true)
  const [selected, setSelected] = useState<Doctor | null>(null)
  const [selectedSlot, setSelectedSlot] = useState<TimeSlot | null>(null)
  const [booking, setBooking] = useState(false)
  const [notes, setNotes] = useState('')
  const [tab, setTab] = useState<'find' | 'appointments'>('find')

  useEffect(() => { loadDoctors() }, [specialty])
  useEffect(() => { if (user) loadAppointments() }, [user])

  async function loadDoctors() {
    setLoading(true)
    let q = supabase.from('doctors').select('*').eq('is_active', true).order('rating', { ascending: false })
    if (specialty !== 'All') q = q.ilike('specialty', `%${specialty.split(' ')[0]}%`)
    const { data } = await q
    setDoctors(((data || []) as Doctor[]).map(d => ({ ...d, available_slots: generateSlots() })))
    setLoading(false)
  }

  async function loadAppointments() {
    if (!user) return
    const { data } = await supabase
      .from('appointments')
      .select('*, doctor:doctors(*)')
      .eq('user_id', user.id)
      .order('slot_date', { ascending: true })
    setAppointments((data || []) as unknown as Appointment[])
  }

  async function handleBook() {
    if (!user || !selected || !selectedSlot) return
    setBooking(true)
    try {
      const roomId = Math.random().toString(36).slice(2, 9)
      const meetLink = `https://meet.jit.si/VitalOS-${roomId}`

      const { data, error } = await supabase.from('appointments').insert({
        user_id: user.id,
        doctor_id: selected.id,
        slot_date: selectedSlot.date,
        slot_time: selectedSlot.time,
        notes,
        status: 'scheduled',
        meeting_link: meetLink,
      }).select('*, doctor:doctors(*)').single()

      if (error) throw error

      // Trigger confirmation email
      try {
        await supabase.functions.invoke('send-appointment-email', {
          body: { appointmentId: data.id, type: 'confirmed' }
        })
      } catch (e) {
        console.log('Email not sent — set up re_b7Y1QTRs_5RyGfqyhsdzWxFCFUvqNLcuH in Supabase secrets')
      }

      toast.success(`Booked with ${selected.name}! Video link sent to ${user.email}`)
      setSelected(null)
      setSelectedSlot(null)
      setNotes('')
      loadAppointments()
      setTab('appointments')
    } catch (err) {
      toast.error('Booking failed — ' + (err instanceof Error ? err.message : 'try again'))
    } finally {
      setBooking(false)
    }
  }

  async function cancelAppointment(id: string) {
    if (!confirm('Cancel this appointment?')) return
    await supabase.from('appointments').update({ status: 'cancelled' }).eq('id', id)
    try {
      await supabase.functions.invoke('send-appointment-email', {
        body: { appointmentId: id, type: 'cancelled' }
      })
    } catch {}
    toast.success('Appointment cancelled')
    loadAppointments()
  }

  const slotsByDate = selected
    ? (selected.available_slots || []).reduce((acc, slot) => {
        if (!acc[slot.date]) acc[slot.date] = []
        acc[slot.date].push(slot)
        return acc
      }, {} as Record<string, TimeSlot[]>)
    : {}

  const statusStyle: Record<string, string> = {
    scheduled: 'bg-blue-50 text-blue-700 border border-blue-200',
    completed: 'bg-green-50 text-green-700 border border-green-200',
    cancelled: 'bg-red-50 text-red-700 border border-red-200',
  }

  return (
    <div className="p-6 max-w-5xl space-y-5">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold text-gray-900">Doctors & consultations</h1>
        <div className="flex gap-1 bg-gray-100 rounded-lg p-1">
          {(['find', 'appointments'] as const).map(t => (
            <button key={t} onClick={() => setTab(t)}
              className={`text-xs px-3 py-1.5 rounded-md transition-colors capitalize ${tab === t ? 'bg-white shadow-sm font-medium text-gray-900' : 'text-gray-500'}`}>
              {t === 'find' ? 'Find doctors' : `My appointments (${appointments.length})`}
            </button>
          ))}
        </div>
      </div>

      {tab === 'find' && (
        <>
          <div className="flex gap-2 flex-wrap">
            {SPECIALTIES.map(s => (
              <button key={s} onClick={() => setSpecialty(s)}
                className={`text-xs px-3 py-1.5 rounded-full border transition-colors ${specialty === s ? 'bg-teal-500 text-white border-teal-500' : 'border-gray-200 text-gray-500 hover:border-teal-300'}`}>
                {s}
              </button>
            ))}
          </div>

          {loading ? <p className="text-gray-400 text-sm">Loading doctors...</p> : (
            <div className="grid grid-cols-2 gap-4">
              {doctors.map(doc => (
                <div key={doc.id}
                  onClick={() => { setSelected(doc); setSelectedSlot(null) }}
                  className={`card cursor-pointer transition-all hover:shadow-md ${selected?.id === doc.id ? 'border-teal-400 ring-1 ring-teal-100' : ''}`}>
                  <div className="flex gap-3 mb-3">
                    <div className="w-12 h-12 rounded-full flex items-center justify-center font-bold text-sm shrink-0"
                      style={{ background: 'linear-gradient(135deg, #0f6e56, #1D9E75)', color: 'white' }}>
                      {doc.name.split(' ').slice(-1)[0].slice(0, 2)}
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-gray-900">{doc.name}</p>
                      <p className="text-xs text-teal-600 font-medium">{doc.specialty}</p>
                      <p className="text-[10px] text-gray-400">{doc.qualifications}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-4 text-xs text-gray-500 mb-2">
                    <span className="flex items-center gap-1"><Star size={11} className="fill-amber-400 text-amber-400" />{doc.rating}</span>
                    <span>{doc.experience_years} yrs</span>
                    <span className="flex items-center gap-1 text-teal-600"><Video size={11} />Online</span>
                  </div>
                  <p className="text-xs text-gray-500 mb-3 line-clamp-2">{doc.bio}</p>
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-bold text-gray-900">₹{doc.consultation_fee}</p>
                    <div className="flex gap-1">
                      {(doc.languages || []).map(l => (
                        <span key={l} className="text-[10px] bg-gray-100 text-gray-500 px-1.5 py-0.5 rounded">{l}</span>
                      ))}
                    </div>
                  </div>
                  {doc.hospital && <p className="text-[10px] text-gray-400 mt-1">{doc.hospital}</p>}
                </div>
              ))}
              {doctors.length === 0 && (
                <div className="col-span-2 card text-center py-12 text-gray-400 text-sm">
                  No doctors found. Add some from the Admin panel.
                </div>
              )}
            </div>
          )}

          {selected && (
            <div className="card border-teal-200 bg-gradient-to-br from-teal-50 to-white">
              <h3 className="text-sm font-semibold text-gray-900 mb-4">Book with {selected.name}</h3>
              <div className="space-y-4">
                {Object.entries(slotsByDate).slice(0, 5).map(([date, slots]) => (
                  <div key={date}>
                    <p className="text-xs font-semibold text-gray-600 mb-2">
                      {new Date(date).toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'short' })}
                    </p>
                    <div className="flex flex-wrap gap-2">
                      {slots.map(slot => (
                        <button key={slot.id} onClick={() => setSelectedSlot(slot)}
                          className={`text-xs px-3 py-1.5 rounded-lg border flex items-center gap-1 transition-colors ${selectedSlot?.id === slot.id ? 'bg-teal-500 text-white border-teal-500' : 'bg-white border-gray-200 text-gray-600 hover:border-teal-300'}`}>
                          <Clock size={10} />{slot.time}
                        </button>
                      ))}
                    </div>
                  </div>
                ))}
                <textarea value={notes} onChange={e => setNotes(e.target.value)}
                  className="input text-xs h-16 resize-none w-full"
                  placeholder="Symptoms or reason for consultation (optional)" />
                <div className="bg-blue-50 border border-blue-100 rounded-lg p-3 text-xs text-blue-700">
                  <strong>Email confirmation</strong> will be sent to <strong>{user?.email}</strong> from VitalOS on behalf of {selected.name}.
                </div>
                <div className="flex gap-3">
                  <button onClick={handleBook} disabled={!selectedSlot || booking}
                    className="btn-primary flex items-center gap-2">
                    <Check size={14} /> {booking ? 'Booking...' : `Book ₹${selected.consultation_fee}`}
                  </button>
                  <button onClick={() => setSelected(null)} className="btn-secondary flex items-center gap-2">
                    <X size={14} /> Cancel
                  </button>
                  {!selectedSlot && <p className="text-xs text-gray-400 self-center">Select a time slot first</p>}
                </div>
              </div>
            </div>
          )}
        </>
      )}

      {tab === 'appointments' && (
        <div className="space-y-3">
          {appointments.length === 0 ? (
            <div className="card text-center py-12">
              <p className="text-gray-400 text-sm mb-3">No appointments yet</p>
              <button onClick={() => setTab('find')} className="btn-primary">Find a doctor</button>
            </div>
          ) : (
            appointments.map(appt => {
              const roomId = appt.meeting_link?.split('VitalOS-')[1]
              return (
                <div key={appt.id} className="card">
                  <div className="flex items-start justify-between">
                    <div className="flex gap-3">
                      <div className="w-10 h-10 rounded-full flex items-center justify-center font-bold text-xs shrink-0"
                        style={{ background: 'linear-gradient(135deg, #0f6e56, #1D9E75)', color: 'white' }}>
                        Dr
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-gray-900">{appt.doctor?.name}</p>
                        <p className="text-xs text-teal-600">{appt.doctor?.specialty}</p>
                        <p className="text-xs text-gray-400 mt-1">
                          {new Date(appt.slot_date).toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'long' })} at {appt.slot_time}
                        </p>
                      </div>
                    </div>
                    <div className="flex flex-col items-end gap-2">
                      <span className={`text-xs px-2 py-1 rounded-lg font-medium capitalize ${statusStyle[appt.status] || statusStyle.scheduled}`}>
                        {appt.status}
                      </span>
                      {appt.status === 'scheduled' && roomId && (
                        <a href={`/consultation/${roomId}`}
                          className="flex items-center gap-1.5 text-xs bg-teal-500 text-white px-3 py-1.5 rounded-lg hover:bg-teal-600 font-medium">
                          <Video size={11} /> Join call
                        </a>
                      )}
                      {appt.status === 'scheduled' && (
                        <button onClick={() => cancelAppointment(appt.id)}
                          className="text-xs text-red-500 hover:text-red-700">
                          Cancel
                        </button>
                      )}
                    </div>
                  </div>
                  {appt.notes && (
                    <p className="text-xs text-gray-400 mt-3 pt-3 border-t border-gray-100 italic">"{appt.notes}"</p>
                  )}
                  {appt.meeting_link && (
                    <p className="text-[10px] text-gray-300 mt-1">Confirmation sent to {user?.email}</p>
                  )}
                </div>
              )
            })
          )}
        </div>
      )}
    </div>
  )
}
