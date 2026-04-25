import { useEffect, useState } from 'react'
import { useOutletContext } from 'react-router-dom'
import { supabase } from '@/lib/supabase'
import { Video, ExternalLink, Clock, CheckCircle } from 'lucide-react'
import toast from 'react-hot-toast'

interface DoctorProfile { id: string }
interface Appt {
  id: string; slot_date: string; slot_time: string
  status: string; meeting_link: string; notes: string
  profile: { full_name: string; email: string }
}

export default function DoctorConsultations() {
  const { doctor } = useOutletContext<{ doctor: DoctorProfile }>()
  const [appts, setAppts] = useState<Appt[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => { if (doctor) load() }, [doctor])

  async function load() {
    setLoading(true)
    const today = new Date().toISOString().split('T')[0]
    const { data } = await supabase
      .from('appointments')
      .select('*, profile:profiles(full_name,email)')
      .eq('doctor_id', doctor.id)
      .gte('slot_date', today)
      .eq('status', 'scheduled')
      .order('slot_date').order('slot_time')
    setAppts((data || []) as unknown as Appt[])
    setLoading(false)
  }

  async function markComplete(id: string) {
    await supabase.from('appointments').update({ status: 'completed' }).eq('id', id)
    toast.success('Consultation marked complete')
    load()
  }

  const today = new Date().toISOString().split('T')[0]

  return (
    <div className="p-6 space-y-5">
      <h1 className="text-xl font-semibold text-white">Upcoming consultations</h1>

      {loading ? (
        <div className="space-y-3">
          {[1,2,3].map(i => <div key={i} className="bg-gray-900 rounded-xl h-20 animate-pulse" />)}
        </div>
      ) : appts.length === 0 ? (
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-12 text-center">
          <Video size={32} className="text-gray-700 mx-auto mb-3" />
          <p className="text-gray-400 text-sm">No upcoming consultations</p>
        </div>
      ) : (
        <div className="space-y-3">
          {appts.map(appt => {
            const roomId = appt.meeting_link?.split('VitalOS-')[1] || appt.meeting_link?.split('/').pop()
            const isToday = appt.slot_date === today
            const slotDateTime = new Date(`${appt.slot_date}T${appt.slot_time}`)
            const minutesUntil = Math.round((slotDateTime.getTime() - Date.now()) / 60000)
            const canJoin = minutesUntil <= 15 && minutesUntil >= -60
            return (
              <div key={appt.id}
                className={`bg-gray-900 border rounded-xl p-4 ${isToday ? 'border-teal-700' : 'border-gray-800'}`}>
                <div className="flex items-start justify-between">
                  <div className="flex gap-3">
                    <div className="w-10 h-10 rounded-full bg-teal-800 flex items-center justify-center text-teal-300 font-bold text-sm">
                      {(appt.profile?.full_name||'P').slice(0,2).toUpperCase()}
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-semibold text-white">{appt.profile?.full_name}</p>
                        {isToday && <span className="text-[10px] bg-teal-900 text-teal-400 px-1.5 py-0.5 rounded-full">TODAY</span>}
                        {canJoin && <span className="text-[10px] bg-green-900 text-green-400 px-1.5 py-0.5 rounded-full animate-pulse">LIVE NOW</span>}
                      </div>
                      <p className="text-xs text-gray-400">{appt.profile?.email}</p>
                      <div className="flex items-center gap-1 mt-1">
                        <Clock size={11} className="text-gray-500" />
                        <p className="text-xs text-gray-400">
                          {new Date(appt.slot_date+'T00:00:00').toLocaleDateString('en-IN',{weekday:'short',day:'numeric',month:'short'})} at {appt.slot_time?.slice(0,5)}
                          {isToday && minutesUntil > 0 && <span className="text-amber-400 ml-2">in {minutesUntil}m</span>}
                          {isToday && minutesUntil <= 0 && minutesUntil >= -60 && <span className="text-green-400 ml-2">in session</span>}
                        </p>
                      </div>
                      {appt.notes && <p className="text-xs text-gray-500 italic mt-0.5">"{appt.notes}"</p>}
                    </div>
                  </div>
                  <div className="flex flex-col items-end gap-2">
                    {appt.meeting_link && roomId && (
                      <a href={`/consultation/${roomId}`} target="_blank" rel="noreferrer"
                        className={`flex items-center gap-1.5 text-xs text-white px-3 py-2 rounded-lg font-semibold transition-all ${canJoin ? 'animate-pulse' : ''}`}
                        style={{ background: canJoin ? 'linear-gradient(135deg,#059669,#10b981)' : 'linear-gradient(135deg,#0f6e56,#1d9e75)' }}>
                        <Video size={12} /> {canJoin ? 'Join now' : 'Join call'}
                        <ExternalLink size={10} />
                      </a>
                    )}
                    <button onClick={() => markComplete(appt.id)}
                      className="flex items-center gap-1 text-xs text-green-400 border border-green-800 px-2.5 py-1.5 rounded-lg hover:bg-green-900/30">
                      <CheckCircle size={11} /> Mark done
                    </button>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}

      <div className="bg-gray-900/50 border border-gray-800 rounded-xl p-4">
        <p className="text-xs font-semibold text-gray-400 mb-2">📋 How video consultations work</p>
        <div className="space-y-1.5 text-xs text-gray-500">
          <p>• Patient books a slot → both receive email confirmation with the video link</p>
          <p>• Click "Join call" 5 minutes before the appointment time</p>
          <p>• Video uses Jitsi Meet (free, no account needed) — works in any browser</p>
          <p>• After the call, click "Mark done" to complete the appointment</p>
        </div>
      </div>
    </div>
  )
}
