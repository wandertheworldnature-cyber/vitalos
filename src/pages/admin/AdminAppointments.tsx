import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { CalendarDays, Check, X, Video } from 'lucide-react'
import toast from 'react-hot-toast'

interface Appt {
  id: string
  slot_date: string
  slot_time: string
  status: string
  notes: string
  meeting_link: string
  doctor: { name: string; specialty: string }
  profile: { email: string; full_name: string }
}

export default function AdminAppointments() {
  const [appts, setAppts] = useState<Appt[]>([])
  const [filter, setFilter] = useState('scheduled')
  const [loading, setLoading] = useState(true)

  useEffect(() => { loadAppts() }, [filter])

  async function loadAppts() {
    setLoading(true)
    let q = supabase
      .from('appointments')
      .select('*, doctor:doctors(name,specialty), profile:profiles(email,full_name)')
      .order('slot_date', { ascending: true })
    if (filter !== 'all') q = q.eq('status', filter)
    const { data } = await q
    setAppts((data || []) as unknown as Appt[])
    setLoading(false)
  }

  async function updateStatus(id: string, status: string) {
    await supabase.from('appointments').update({ status }).eq('id', id)
    toast.success(`Appointment ${status}`)
    loadAppts()
  }

  const statusStyle: Record<string, string> = {
    scheduled: 'bg-blue-900 text-blue-300',
    completed: 'bg-green-900 text-green-300',
    cancelled: 'bg-red-900 text-red-300',
  }

  return (
    <div className="p-6 space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-white">Appointments</h1>
          <p className="text-sm text-gray-400">{appts.length} {filter} appointments</p>
        </div>
        <div className="flex gap-2">
          {['all', 'scheduled', 'completed', 'cancelled'].map(f => (
            <button key={f} onClick={() => setFilter(f)}
              className={`text-xs px-3 py-1.5 rounded-lg capitalize transition-colors ${
                filter === f ? 'bg-teal-600 text-white' : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
              }`}>{f}</button>
          ))}
        </div>
      </div>

      {loading ? <p className="text-gray-500 text-sm">Loading...</p> : (
        <div className="space-y-3">
          {appts.length === 0 && (
            <div className="bg-gray-900 border border-gray-800 rounded-xl p-8 text-center text-gray-500 text-sm">
              No {filter} appointments
            </div>
          )}
          {appts.map(a => (
            <div key={a.id} className="bg-gray-900 border border-gray-800 rounded-xl p-4">
              <div className="flex items-start justify-between">
                <div className="flex gap-3">
                  <div className="w-9 h-9 rounded-full bg-teal-800 flex items-center justify-center shrink-0">
                    <CalendarDays size={14} className="text-teal-300" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2 mb-0.5">
                      <p className="text-sm font-medium text-white">{a.profile?.full_name || a.profile?.email}</p>
                      <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${statusStyle[a.status] || statusStyle.scheduled}`}>
                        {a.status}
                      </span>
                    </div>
                    <p className="text-xs text-gray-400">
                      {a.doctor?.name} · {a.doctor?.specialty}
                    </p>
                    <p className="text-xs text-gray-500">
                      {new Date(a.slot_date).toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' })} at {a.slot_time}
                    </p>
                    {a.notes && <p className="text-xs text-gray-500 mt-1 italic">"{a.notes}"</p>}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {a.meeting_link && (
                    <a href={a.meeting_link} target="_blank" rel="noreferrer"
                      className="flex items-center gap-1 text-xs text-teal-400 hover:text-teal-300 border border-teal-800 rounded px-2 py-1">
                      <Video size={11} /> Join
                    </a>
                  )}
                  {a.status === 'scheduled' && (
                    <>
                      <button onClick={() => updateStatus(a.id, 'completed')}
                        className="flex items-center gap-1 text-xs text-green-400 border border-green-800 rounded px-2 py-1 hover:bg-green-900/30">
                        <Check size={11} /> Done
                      </button>
                      <button onClick={() => updateStatus(a.id, 'cancelled')}
                        className="flex items-center gap-1 text-xs text-red-400 border border-red-800 rounded px-2 py-1 hover:bg-red-900/30">
                        <X size={11} /> Cancel
                      </button>
                    </>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
