import { useEffect, useState } from 'react'
import { useOutletContext } from 'react-router-dom'
import { supabase } from '@/lib/supabase'
import { CalendarDays, Users, Video, TrendingUp, Clock, CheckCircle } from 'lucide-react'

interface DoctorProfile { id: string; name: string; specialty: string; hospital: string }
interface Stats {
  totalAppointments: number
  todayAppointments: number
  totalPatients: number
  completedConsultations: number
  upcomingToday: Appointment[]
}
interface Appointment {
  id: string; slot_date: string; slot_time: string; status: string; meeting_link: string; notes: string
  profile: { full_name: string; email: string }
}

export default function DoctorOverview() {
  const { doctor } = useOutletContext<{ doctor: DoctorProfile }>()
  const [stats, setStats] = useState<Stats>({
    totalAppointments: 0, todayAppointments: 0,
    totalPatients: 0, completedConsultations: 0, upcomingToday: []
  })
  const [loading, setLoading] = useState(true)

  useEffect(() => { if (doctor) loadStats() }, [doctor])

  async function loadStats() {
    const today = new Date().toISOString().split('T')[0]

    const [all, todayAppts, completed] = await Promise.all([
      supabase.from('appointments').select('id, user_id', { count: 'exact' }).eq('doctor_id', doctor.id),
      supabase.from('appointments').select('*, profile:profiles(full_name, email)')
        .eq('doctor_id', doctor.id).eq('slot_date', today).eq('status', 'scheduled')
        .order('slot_time'),
      supabase.from('appointments').select('id', { count: 'exact' })
        .eq('doctor_id', doctor.id).eq('status', 'completed'),
    ])

    // Count unique patients
    const userIds = new Set((all.data || []).map((a: { user_id: string }) => a.user_id))

    setStats({
      totalAppointments: all.count || 0,
      todayAppointments: (todayAppts.data || []).length,
      totalPatients: userIds.size,
      completedConsultations: completed.count || 0,
      upcomingToday: (todayAppts.data || []) as unknown as Appointment[],
    })
    setLoading(false)
  }

  const cards = [
    { label: 'Total appointments', value: stats.totalAppointments, icon: CalendarDays, color: 'text-blue-400', bg: 'bg-blue-900/20' },
    { label: 'Today\'s appointments', value: stats.todayAppointments, icon: Clock, color: 'text-amber-400', bg: 'bg-amber-900/20' },
    { label: 'Unique patients', value: stats.totalPatients, icon: Users, color: 'text-teal-400', bg: 'bg-teal-900/20' },
    { label: 'Completed sessions', value: stats.completedConsultations, icon: CheckCircle, color: 'text-green-400', bg: 'bg-green-900/20' },
  ]

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-white">Welcome, {doctor.name}</h1>
        <p className="text-sm text-gray-400">{doctor.specialty}{doctor.hospital ? ` · ${doctor.hospital}` : ''}</p>
      </div>

      {loading ? (
        <div className="grid grid-cols-4 gap-4">
          {[1,2,3,4].map(i => <div key={i} className="bg-gray-900 rounded-xl h-24 animate-pulse" />)}
        </div>
      ) : (
        <div className="grid grid-cols-4 gap-4">
          {cards.map(c => (
            <div key={c.label} className={`rounded-xl border border-gray-800 p-4 ${c.bg}`}>
              <div className="flex items-center justify-between mb-2">
                <p className="text-xs text-gray-400">{c.label}</p>
                <c.icon size={15} className={c.color} />
              </div>
              <p className={`text-3xl font-bold ${c.color}`}>{c.value}</p>
            </div>
          ))}
        </div>
      )}

      {/* Today's schedule */}
      <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
        <h2 className="text-sm font-semibold text-white mb-4">
          Today's consultations
          {stats.todayAppointments > 0 && (
            <span className="ml-2 text-xs bg-amber-900/50 text-amber-400 px-2 py-0.5 rounded-full">
              {stats.todayAppointments} scheduled
            </span>
          )}
        </h2>

        {stats.upcomingToday.length === 0 ? (
          <p className="text-sm text-gray-500 text-center py-6">No appointments today</p>
        ) : (
          <div className="space-y-3">
            {stats.upcomingToday.map(appt => {
              const roomId = appt.meeting_link?.split('VitalOS-')[1] || appt.meeting_link?.split('/').pop()
              return (
                <div key={appt.id} className="flex items-center justify-between bg-gray-800 rounded-xl p-3">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-full bg-teal-800 flex items-center justify-center text-teal-300 text-xs font-bold">
                      {(appt.profile?.full_name || 'P').slice(0, 2).toUpperCase()}
                    </div>
                    <div>
                      <p className="text-sm font-medium text-white">{appt.profile?.full_name || appt.profile?.email}</p>
                      <p className="text-xs text-gray-400">{appt.slot_time?.slice(0,5)}</p>
                      {appt.notes && <p className="text-xs text-gray-500 italic truncate max-w-[200px]">"{appt.notes}"</p>}
                    </div>
                  </div>
                  {appt.meeting_link && (
                    <a href={`/consultation/${roomId}`} target="_blank" rel="noreferrer"
                      className="flex items-center gap-1.5 text-xs text-white px-3 py-1.5 rounded-lg font-semibold"
                      style={{ background: 'linear-gradient(135deg,#0f6e56,#1d9e75)' }}>
                      <Video size={12} /> Join call
                    </a>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
