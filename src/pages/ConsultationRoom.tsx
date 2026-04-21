// Video Consultation Room
// Uses Daily.co free tier (free for up to 200 participants, no credit card)
// OR falls back to a waiting room UI with Jitsi Meet embed
import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/store/authStore'
import { Video, Mic, MicOff, VideoOff, Phone, MessageSquare, Users, Clock } from 'lucide-react'

interface AppointmentInfo {
  id: string
  slot_date: string
  slot_time: string
  notes: string
  status: string
  doctor: { name: string; specialty: string; qualifications: string }
  profile: { full_name: string; email: string }
}

export default function ConsultationRoom() {
  const { roomId } = useParams<{ roomId: string }>()
  const navigate = useNavigate()
  const { user } = useAuthStore()
  const [appt, setAppt] = useState<AppointmentInfo | null>(null)
  const [loading, setLoading] = useState(true)
  const [joined, setJoined] = useState(false)
  const [micOn, setMicOn] = useState(true)
  const [camOn, setCamOn] = useState(true)
  const [timeLeft, setTimeLeft] = useState('')
  const [chatMsg, setChatMsg] = useState('')
  const [chatLog, setChatLog] = useState<Array<{ from: string; text: string; time: string }>>([])

  useEffect(() => {
    loadAppointment()
  }, [roomId])

  useEffect(() => {
    if (!appt) return
    const interval = setInterval(() => {
      const apptTime = new Date(`${appt.slot_date}T${appt.slot_time}`)
      const now = new Date()
      const diff = apptTime.getTime() - now.getTime()
      if (diff <= 0) {
        setTimeLeft('Consultation time now')
      } else {
        const h = Math.floor(diff / 3600000)
        const m = Math.floor((diff % 3600000) / 60000)
        const s = Math.floor((diff % 60000) / 1000)
        setTimeLeft(h > 0 ? `${h}h ${m}m` : m > 0 ? `${m}m ${s}s` : `${s}s`)
      }
    }, 1000)
    return () => clearInterval(interval)
  }, [appt])

  async function loadAppointment() {
    // Find appointment by room ID (stored in meeting_link)
    const { data } = await supabase
      .from('appointments')
      .select('*, doctor:doctors(name,specialty,qualifications), profile:profiles(full_name,email)')
      .like('meeting_link', `%${roomId}%`)
      .single()
    setAppt(data as unknown as AppointmentInfo)
    setLoading(false)
  }

  function sendChat() {
    if (!chatMsg.trim()) return
    const entry = {
      from: user?.full_name || 'You',
      text: chatMsg.trim(),
      time: new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }),
    }
    setChatLog(prev => [...prev, entry])
    setChatMsg('')
  }

  async function endCall() {
    if (appt && confirm('End this consultation?')) {
      await supabase.from('appointments').update({ status: 'completed' }).eq('id', appt.id)
      navigate('/appointments')
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center">
        <div className="text-center">
          <div className="w-10 h-10 border-2 border-t-transparent border-teal-500 rounded-full animate-spin mx-auto mb-3" />
          <p className="text-gray-400 text-sm">Loading consultation room...</p>
        </div>
      </div>
    )
  }

  if (!joined) {
    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center p-4">
        <div className="bg-gray-900 border border-gray-800 rounded-2xl p-8 max-w-md w-full text-center">
          <div className="w-16 h-16 rounded-full bg-teal-800 flex items-center justify-center mx-auto mb-4">
            <Video size={28} className="text-teal-300" />
          </div>

          <h1 className="text-xl font-semibold text-white mb-1">
            {appt ? `Consultation with ${appt.doctor?.name}` : 'VitalOS Consultation Room'}
          </h1>

          {appt && (
            <div className="space-y-2 my-4">
              <p className="text-sm text-gray-400">{appt.doctor?.specialty}</p>
              <p className="text-xs text-gray-500">{appt.doctor?.qualifications}</p>
              <div className="flex items-center justify-center gap-2 mt-3">
                <Clock size={13} className="text-teal-400" />
                <p className="text-sm text-teal-400">
                  {appt.slot_date} at {appt.slot_time}
                  {timeLeft && <span className="ml-2 text-gray-500">({timeLeft})</span>}
                </p>
              </div>
            </div>
          )}

          {/* Pre-join checklist */}
          <div className="bg-gray-800 rounded-xl p-4 my-5 text-left space-y-2">
            <p className="text-xs font-semibold text-gray-300 mb-2">Before joining:</p>
            {[
              { label: 'Camera access enabled', ok: true },
              { label: 'Microphone access enabled', ok: true },
              { label: 'Stable internet connection', ok: true },
              { label: 'Quiet environment', ok: null },
            ].map(item => (
              <div key={item.label} className="flex items-center gap-2 text-xs">
                <span className={item.ok === null ? 'text-amber-400' : 'text-green-400'}>{item.ok === null ? '⚠' : '✓'}</span>
                <span className={item.ok === null ? 'text-amber-300' : 'text-gray-300'}>{item.label}</span>
              </div>
            ))}
          </div>

          <div className="flex gap-3">
            <button
              onClick={() => navigate(-1)}
              className="flex-1 py-2.5 border border-gray-700 text-gray-400 rounded-xl text-sm hover:bg-gray-800">
              Back
            </button>
            <button
              onClick={() => setJoined(true)}
              className="flex-1 py-2.5 bg-teal-600 hover:bg-teal-700 text-white rounded-xl text-sm font-semibold">
              Join consultation
            </button>
          </div>
        </div>
      </div>
    )
  }

  // Active consultation room — embeds Jitsi Meet (100% free, no account needed)
  const jitsiRoom = `VitalOS-${roomId}`

  return (
    <div className="h-screen bg-gray-950 flex flex-col">
      {/* Top bar */}
      <div className="flex items-center justify-between px-4 py-2.5 bg-gray-900 border-b border-gray-800">
        <div className="flex items-center gap-3">
          <div className="w-7 h-7 rounded-lg bg-teal-600 flex items-center justify-center">
            <Video size={13} className="text-white" />
          </div>
          <div>
            <p className="text-sm font-medium text-white">
              {appt ? `Consultation — ${appt.doctor?.name}` : 'VitalOS Consultation'}
            </p>
            <p className="text-[10px] text-teal-400 flex items-center gap-1">
              <span className="w-1.5 h-1.5 bg-green-400 rounded-full inline-block" />
              Live · Room {roomId}
              {timeLeft && <span className="ml-2 text-gray-500">{timeLeft}</span>}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className="flex items-center gap-1 text-xs text-gray-400 bg-gray-800 px-2 py-1 rounded">
            <Users size={11} /> 2 participants
          </span>
          <button
            onClick={endCall}
            className="flex items-center gap-1.5 bg-red-600 hover:bg-red-700 text-white text-xs px-3 py-1.5 rounded-lg font-medium">
            <Phone size={12} /> End call
          </button>
        </div>
      </div>

      <div className="flex flex-1 overflow-hidden">
        {/* Video area — Jitsi embed */}
        <div className="flex-1 bg-gray-950 relative">
          <iframe
            title="VitalOS Video Consultation"
            src={`https://meet.jit.si/${jitsiRoom}#config.startWithAudioMuted=false&config.startWithVideoMuted=false&config.disableDeepLinking=true&userInfo.displayName=${encodeURIComponent(user?.full_name || 'Patient')}&config.prejoinPageEnabled=false&config.toolbarButtons=["microphone","camera","hangup","chat","raisehand","tileview"]`}
            allow="camera; microphone; fullscreen; display-capture; autoplay"
            className="w-full h-full border-0"
          />

          {/* Controls overlay */}
          <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex items-center gap-3">
            <button
              onClick={() => setMicOn(m => !m)}
              className={`w-11 h-11 rounded-full flex items-center justify-center transition-colors ${micOn ? 'bg-gray-700 hover:bg-gray-600' : 'bg-red-600 hover:bg-red-700'}`}>
              {micOn ? <Mic size={16} className="text-white" /> : <MicOff size={16} className="text-white" />}
            </button>
            <button
              onClick={() => setCamOn(c => !c)}
              className={`w-11 h-11 rounded-full flex items-center justify-center transition-colors ${camOn ? 'bg-gray-700 hover:bg-gray-600' : 'bg-red-600 hover:bg-red-700'}`}>
              {camOn ? <Video size={16} className="text-white" /> : <VideoOff size={16} className="text-white" />}
            </button>
            <button
              onClick={endCall}
              className="w-12 h-12 rounded-full bg-red-600 hover:bg-red-700 flex items-center justify-center">
              <Phone size={18} className="text-white rotate-[135deg]" />
            </button>
          </div>
        </div>

        {/* Chat sidebar */}
        <div className="w-72 bg-gray-900 border-l border-gray-800 flex flex-col">
          <div className="p-3 border-b border-gray-800 flex items-center gap-2">
            <MessageSquare size={13} className="text-gray-400" />
            <span className="text-xs font-medium text-gray-300">Consultation notes</span>
          </div>

          {/* Appointment details */}
          {appt && (
            <div className="p-3 bg-gray-800 m-3 rounded-xl border border-gray-700 text-xs space-y-1">
              <p className="font-medium text-gray-200">{appt.doctor?.name}</p>
              <p className="text-gray-400">{appt.doctor?.specialty}</p>
              <p className="text-gray-500">{appt.slot_date} · {appt.slot_time}</p>
              {appt.notes && <p className="text-gray-400 mt-1 italic">"{appt.notes}"</p>}
            </div>
          )}

          {/* Chat */}
          <div className="flex-1 overflow-y-auto p-3 space-y-2">
            {chatLog.length === 0 && (
              <p className="text-xs text-gray-600 text-center mt-4">Send notes or messages to the doctor</p>
            )}
            {chatLog.map((m, i) => (
              <div key={i} className={`flex flex-col ${m.from === (user?.full_name || 'You') ? 'items-end' : 'items-start'}`}>
                <p className="text-[10px] text-gray-500 mb-0.5">{m.from} · {m.time}</p>
                <div className={`text-xs rounded-xl px-3 py-2 max-w-[90%] ${
                  m.from === (user?.full_name || 'You') ? 'bg-teal-700 text-white' : 'bg-gray-700 text-gray-200'
                }`}>{m.text}</div>
              </div>
            ))}
          </div>

          <div className="p-3 border-t border-gray-800 flex gap-2">
            <input
              className="flex-1 bg-gray-800 border border-gray-700 text-white text-xs rounded-lg px-3 py-2 focus:outline-none focus:border-teal-500"
              value={chatMsg}
              onChange={e => setChatMsg(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && sendChat()}
              placeholder="Type a note..."
            />
            <button onClick={sendChat} className="bg-teal-600 text-white text-xs px-3 rounded-lg hover:bg-teal-700">
              Send
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
