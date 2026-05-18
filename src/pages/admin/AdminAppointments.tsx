import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { Video, Mail, Phone, Copy, CheckCircle, AlertCircle, RefreshCw, ExternalLink } from 'lucide-react'
import toast from 'react-hot-toast'

interface Appt {
  id: string
  slot_date: string
  slot_time: string
  status: string
  notes: string | null
  meeting_link: string | null
  doctor: { name: string; specialty: string; doctor_email: string | null; doctor_phone: string | null }
  profile: { full_name: string; email: string; phone: string | null }
}

const STATUS_COLORS: Record<string, string> = {
  scheduled: 'bg-blue-900 text-blue-300',
  completed:  'bg-green-900 text-green-300',
  cancelled:  'bg-red-900 text-red-300',
}

export default function AdminAppointments() {
  const [appointments, setAppointments] = useState<Appt[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<'all'|'scheduled'|'completed'|'cancelled'>('scheduled')
  const [notifying, setNotifying] = useState<string | null>(null)
  const [search, setSearch] = useState('')

  useEffect(() => { load() }, [filter])

  async function load() {
    setLoading(true)
    let q = supabase.from('appointments')
      .select('*, doctor:doctors(name,specialty,doctor_email,doctor_phone), profile:profiles(full_name,email,phone)')
      .order('slot_date', { ascending: false })
      .order('slot_time', { ascending: false })
    if (filter !== 'all') q = q.eq('status', filter)
    const { data, error } = await q
    if (error) toast.error('Load failed: ' + error.message)
    setAppointments((data || []) as unknown as Appt[])
    setLoading(false)
  }

  async function sendManualNotification(appt: Appt) {
    setNotifying(appt.id)
    try {
      const { error } = await supabase.functions.invoke('send-appointment-email', {
        body: { appointmentId: appt.id, type: 'confirmed' }
      })
      if (error) throw new Error(error.message)
      toast.success(`Notification sent to patient and doctor`)
    } catch (err) {
      toast.error('Email send failed — check RESEND_API_KEY secret')
    } finally {
      setNotifying(null)
    }
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

  function copyLink(link: string) {
    navigator.clipboard?.writeText(link)
    toast.success('Meeting link copied!')
  }

  const filtered = appointments.filter(a =>
    !search ||
    a.profile?.full_name?.toLowerCase().includes(search.toLowerCase()) ||
    a.profile?.email?.toLowerCase().includes(search.toLowerCase()) ||
    a.doctor?.name?.toLowerCase().includes(search.toLowerCase())
  )

  const counts = {
    all: appointments.length,
    scheduled: appointments.filter(a => a.status === 'scheduled').length,
    completed: appointments.filter(a => a.status === 'completed').length,
    cancelled: appointments.filter(a => a.status === 'cancelled').length,
  }

  return (
    <div className="p-6 space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-semibold text-white">Appointments</h1>
          <p className="text-sm text-gray-400">{counts.scheduled} scheduled · {counts.completed} completed</p>
        </div>
        <div className="flex gap-2">
          <input
            className="bg-gray-800 border border-gray-700 text-white text-sm rounded-lg px-3 py-2 w-48 focus:outline-none focus:border-teal-500"
            placeholder="Search patient or doctor..."
            value={search} onChange={e => setSearch(e.target.value)}/>
          <button onClick={load} className="bg-gray-800 border border-gray-700 text-gray-400 hover:text-white px-3 py-2 rounded-lg text-xs">
            <RefreshCw size={14}/>
          </button>
        </div>
      </div>

      {/* Filter tabs */}
      <div className="flex gap-1 bg-gray-800 rounded-xl p-1">
        {(['all','scheduled','completed','cancelled'] as const).map(f => (
          <button key={f} onClick={() => setFilter(f)}
            className={`flex-1 text-xs py-2 rounded-lg capitalize font-medium transition-colors ${filter===f?'bg-teal-700 text-white':'text-gray-400 hover:text-white'}`}>
            {f} ({counts[f]})
          </button>
        ))}
      </div>

      {/* Appointments list */}
      {loading ? (
        <div className="space-y-3">{[1,2,3].map(i=><div key={i} className="bg-gray-900 rounded-xl h-28 animate-pulse"/>)}</div>
      ) : filtered.length === 0 ? (
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-8 text-center">
          <p className="text-gray-400 text-sm">No {filter} appointments</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map(appt => {
            const isToday = appt.slot_date === new Date().toISOString().split('T')[0]
            const roomId = appt.meeting_link?.split('VitalOS-')[1]
            return (
              <div key={appt.id}
                className={`bg-gray-900 border rounded-xl p-4 ${isToday && appt.status==='scheduled' ? 'border-teal-700' : 'border-gray-800'}`}>
                <div className="flex items-start justify-between flex-wrap gap-3">
                  {/* Patient + Doctor info */}
                  <div className="space-y-2 flex-1 min-w-0">
                    <div className="flex items-start gap-3">
                      {/* Patient */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-0.5">
                          <p className="text-xs font-bold text-gray-400 uppercase tracking-wide">Patient</p>
                          {isToday && appt.status==='scheduled' && (
                            <span className="text-[9px] bg-teal-900 text-teal-400 px-1.5 py-0.5 rounded-full font-bold">TODAY</span>
                          )}
                        </div>
                        <p className="text-sm font-semibold text-white">{appt.profile?.full_name || 'Unknown'}</p>
                        <div className="flex items-center gap-3 mt-0.5">
                          <span className="text-[10px] text-gray-400 flex items-center gap-1">
                            <Mail size={9}/>{appt.profile?.email}
                          </span>
                          {appt.profile?.phone && (
                            <span className="text-[10px] text-gray-400 flex items-center gap-1">
                              <Phone size={9}/>{appt.profile.phone}
                            </span>
                          )}
                        </div>
                      </div>

                      <div className="text-gray-600 text-xs">↔</div>

                      {/* Doctor */}
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-bold text-gray-400 uppercase tracking-wide mb-0.5">Doctor</p>
                        <p className="text-sm font-semibold text-white">{appt.doctor?.name}</p>
                        <p className="text-[10px] text-teal-400">{appt.doctor?.specialty}</p>
                        {appt.doctor?.doctor_email && (
                          <span className="text-[10px] text-gray-500 flex items-center gap-1 mt-0.5">
                            <Mail size={9}/>{appt.doctor.doctor_email}
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Date + Time */}
                    <div className="flex items-center gap-3">
                      <span className="text-xs text-gray-300 font-medium">
                        📅 {new Date(appt.slot_date+'T00:00:00').toLocaleDateString('en-IN',{weekday:'short',day:'numeric',month:'short',year:'numeric'})} at {appt.slot_time?.slice(0,5)}
                      </span>
                      <span className={`text-[10px] px-2 py-0.5 rounded font-semibold capitalize ${STATUS_COLORS[appt.status]||STATUS_COLORS.scheduled}`}>
                        {appt.status}
                      </span>
                    </div>

                    {/* Meeting link */}
                    {appt.meeting_link && (
                      <div className="flex items-center gap-2 bg-gray-800 rounded-lg px-3 py-2">
                        <Video size={12} className="text-teal-400 shrink-0"/>
                        <p className="text-[10px] text-gray-300 truncate flex-1">{appt.meeting_link}</p>
                        <button onClick={() => copyLink(appt.meeting_link!)}
                          className="text-gray-400 hover:text-teal-400 shrink-0">
                          <Copy size={11}/>
                        </button>
                        {roomId && (
                          <a href={`/consultation/${roomId}`} target="_blank" rel="noreferrer"
                            className="text-gray-400 hover:text-teal-400 shrink-0">
                            <ExternalLink size={11}/>
                          </a>
                        )}
                      </div>
                    )}

                    {appt.notes && (
                      <p className="text-[10px] text-gray-500 italic">"{appt.notes}"</p>
                    )}
                  </div>

                  {/* Actions */}
                  <div className="flex flex-col gap-2 shrink-0">
                    {/* Manual notification */}
                    <button
                      onClick={() => sendManualNotification(appt)}
                      disabled={notifying === appt.id}
                      title="Manually send confirmation email to patient + doctor"
                      className="flex items-center gap-1.5 text-[11px] text-amber-400 border border-amber-800 px-2.5 py-1.5 rounded-lg hover:bg-amber-900/30 disabled:opacity-50 transition-colors">
                      {notifying === appt.id
                        ? <><RefreshCw size={11} className="animate-spin"/>Sending...</>
                        : <><Mail size={11}/>Send notification</>}
                    </button>

                    {appt.status === 'scheduled' && (
                      <>
                        {roomId && (
                          <a href={`/consultation/${roomId}`} target="_blank" rel="noreferrer"
                            className="flex items-center gap-1.5 text-[11px] text-teal-400 border border-teal-800 px-2.5 py-1.5 rounded-lg hover:bg-teal-900/30 transition-colors">
                            <Video size={11}/>Join call
                          </a>
                        )}
                        <button onClick={() => markComplete(appt.id)}
                          className="flex items-center gap-1.5 text-[11px] text-green-400 border border-green-800 px-2.5 py-1.5 rounded-lg hover:bg-green-900/30 transition-colors">
                          <CheckCircle size={11}/>Mark done
                        </button>
                        <button onClick={() => cancelAppt(appt.id)}
                          className="flex items-center gap-1.5 text-[11px] text-red-400 border border-red-800 px-2.5 py-1.5 rounded-lg hover:bg-red-900/30 transition-colors">
                          <AlertCircle size={11}/>Cancel
                        </button>
                      </>
                    )}
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Info box */}
      <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
        <p className="text-xs font-semibold text-gray-400 mb-2">📋 Admin notes</p>
        <div className="space-y-1 text-[11px] text-gray-500">
          <p>• Click <strong className="text-amber-400">Send notification</strong> to manually resend confirmation email to patient + doctor</p>
          <p>• Copy the meeting link and share directly via WhatsApp/SMS if email not received</p>
          <p>• Click <strong className="text-teal-400">Join call</strong> to monitor or assist in the consultation</p>
          <p>• Emails require RESEND_API_KEY to be set in Supabase secrets</p>
        </div>
      </div>
    </div>
  )
}
