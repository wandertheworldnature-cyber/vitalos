import { useEffect, useState } from 'react'
import { useOutletContext } from 'react-router-dom'
import { supabase } from '@/lib/supabase'
import { Video, CheckCircle, X, Clock, Calendar } from 'lucide-react'
import toast from 'react-hot-toast'

interface DoctorProfile { id: string; name: string }
interface Appointment {
  id: string; slot_date: string; slot_time: string; status: string
  notes: string; meeting_link: string
  profile: { full_name: string; email: string; phone?: string }
}

export default function DoctorAppointments() {
  const { doctor } = useOutletContext<{ doctor: DoctorProfile }>()
  const [appointments, setAppointments] = useState<Appointment[]>([])
  const [filter, setFilter] = useState<'upcoming'|'all'|'completed'|'cancelled'>('upcoming')
  const [loading, setLoading] = useState(true)

  useEffect(() => { if (doctor) load() }, [doctor, filter])

  async function load() {
    setLoading(true)
    const today = new Date().toISOString().split('T')[0]
    let q = supabase.from('appointments')
      .select('*, profile:profiles(full_name, email, phone)')
      .eq('doctor_id', doctor.id)
      .order('slot_date', { ascending: true })
      .order('slot_time', { ascending: true })

    if (filter === 'upcoming') q = q.gte('slot_date', today).eq('status', 'scheduled')
    else if (filter === 'completed') q = q.eq('status', 'completed')
    else if (filter === 'cancelled') q = q.eq('status', 'cancelled')

    const { data } = await q
    setAppointments((data || []) as unknown as Appointment[])
    setLoading(false)
  }

  async function markComplete(id: string) {
    await supabase.from('appointments').update({ status: 'completed' }).eq('id', id)
    toast.success('Marked as completed')
    load()
  }

  async function cancelAppt(id: string) {
    if (!confirm('Cancel this appointment?')) return
    await supabase.from('appointments').update({ status: 'cancelled' }).eq('id', id)
    toast.success('Appointment cancelled')
    load()
  }

  const statusColor: Record<string, string> = {
    scheduled: 'bg-blue-900 text-blue-300',
    completed: 'bg-green-900 text-green-300',
    cancelled: 'bg-red-900 text-red-300',
  }

  const tabs = [
    { k: 'upcoming', l: 'Upcoming' },
    { k: 'all', l: 'All' },
    { k: 'completed', l: 'Completed' },
    { k: 'cancelled', l: 'Cancelled' },
  ] as const

  return (
    <div className="p-6 space-y-5">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold text-white">Appointments</h1>
        <div className="flex gap-1 bg-gray-800 rounded-lg p-1">
          {tabs.map(t => (
            <button key={t.k} onClick={() => setFilter(t.k)}
              className={`text-xs px-3 py-1.5 rounded-md transition-colors ${filter===t.k ? 'bg-teal-700 text-white' : 'text-gray-400 hover:text-white'}`}>
              {t.l}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="space-y-3">
          {[1,2,3].map(i => <div key={i} className="bg-gray-900 rounded-xl h-20 animate-pulse" />)}
        </div>
      ) : appointments.length === 0 ? (
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-8 text-center">
          <Calendar size={32} className="text-gray-700 mx-auto mb-3" />
          <p className="text-gray-400 text-sm">No {filter} appointments</p>
        </div>
      ) : (
        <div className="space-y-3">
          {appointments.map(appt => {
            const roomId = appt.meeting_link?.split('VitalOS-')[1] || appt.meeting_link?.split('/').pop()
            const isToday = appt.slot_date === new Date().toISOString().split('T')[0]
            return (
              <div key={appt.id} className={`bg-gray-900 border rounded-xl p-4 ${isToday ? 'border-teal-700' : 'border-gray-800'}`}>
                <div className="flex items-start justify-between">
                  <div className="flex gap-3">
                    <div className="w-10 h-10 rounded-full bg-teal-800 flex items-center justify-center text-teal-300 text-sm font-bold shrink-0">
                      {(appt.profile?.full_name || 'P').slice(0,2).toUpperCase()}
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-semibold text-white">{appt.profile?.full_name || appt.profile?.email}</p>
                        {isToday && <span className="text-[10px] bg-teal-900 text-teal-400 px-1.5 py-0.5 rounded-full font-semibold">TODAY</span>}
                      </div>
                      <p className="text-xs text-gray-400">{appt.profile?.email}</p>
                      {appt.profile?.phone && <p className="text-xs text-gray-500">📱 {appt.profile.phone}</p>}
                      <div className="flex items-center gap-2 mt-1">
                        <Clock size={11} className="text-gray-500" />
                        <p className="text-xs text-gray-400">
                          {new Date(appt.slot_date+'T00:00:00').toLocaleDateString('en-IN',{weekday:'short',day:'numeric',month:'short'})} at {appt.slot_time?.slice(0,5)}
                        </p>
                      </div>
                      {appt.notes && <p className="text-xs text-gray-500 italic mt-1">"{appt.notes}"</p>}
                    </div>
                  </div>
                  <div className="flex flex-col items-end gap-2">
                    <span className={`text-[10px] px-2 py-0.5 rounded font-semibold capitalize ${statusColor[appt.status]}`}>
                      {appt.status}
                    </span>
                    {appt.status === 'scheduled' && (
                      <div className="flex gap-2">
                        {appt.meeting_link && roomId && (
                          <a href={`/consultation/${roomId}`} target="_blank" rel="noreferrer"
                            className="flex items-center gap-1 text-xs text-white px-2.5 py-1.5 rounded-lg font-medium"
                            style={{ background: 'linear-gradient(135deg,#0f6e56,#1d9e75)' }}>
                            <Video size={11} /> Join
                          </a>
                        )}
                        <button onClick={() => markComplete(appt.id)}
                          className="flex items-center gap-1 text-xs text-green-400 border border-green-800 px-2.5 py-1.5 rounded-lg hover:bg-green-900/30">
                          <CheckCircle size={11} /> Done
                        </button>
                        <button onClick={() => cancelAppt(appt.id)}
                          className="flex items-center gap-1 text-xs text-red-400 border border-red-800 px-2 py-1.5 rounded-lg hover:bg-red-900/30">
                          <X size={11} />
                        </button>
                      </div>
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
