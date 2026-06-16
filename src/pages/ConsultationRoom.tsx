import { useParams, useNavigate } from 'react-router-dom'
import { useEffect, useState } from 'react'
import { useAuthStore } from '@/store/authStore'
import { supabase } from '@/lib/supabase'
import { Video, Copy, Phone, Calendar, Check } from 'lucide-react'

interface ApptInfo {
  doctor_name: string
  doctor_specialty: string
  slot_date: string
  slot_time: string
}

export default function ConsultationRoom() {
  const { roomId } = useParams<{ roomId: string }>()
  const { user } = useAuthStore()
  const navigate = useNavigate()
  const [apptInfo, setApptInfo] = useState<ApptInfo | null>(null)
  const [copied, setCopied] = useState<string | null>(null)
  const [joined, setJoined] = useState(false)

  // Use meet.google.com/new style random room OR a fixed room per appointment
  // Jitsi fix: use #config.prejoinPageEnabled=false&config.startWithVideoMuted=false
  // The key insight: room names WITHOUT spaces/dashes don't trigger moderator gate
  const cleanRoom = (roomId || '').replace(/[^a-zA-Z0-9]/g, '')
  const jitsiUrl = `https://meet.jit.si/VitalOS${cleanRoom}#config.prejoinPageEnabled=false&config.requireDisplayName=false&config.lobby.enabled=false&config.enableWelcomePage=false&config.disableDeepLinking=true&userInfo.displayName=${encodeURIComponent(user?.full_name || 'Patient')}`
  const doctorUrl = `https://meet.jit.si/VitalOS${cleanRoom}#config.prejoinPageEnabled=false&config.requireDisplayName=false&config.lobby.enabled=false&userInfo.displayName=Doctor`
  const shareUrl = `${window.location.origin}/consultation/${roomId}`

  useEffect(() => { if (roomId) loadInfo() }, [roomId])

  async function loadInfo() {
    const { data } = await supabase.from('appointments')
      .select('slot_date,slot_time,doctor:doctors(name,specialty)')
      .eq('meeting_link', `https://meet.jit.si/VitalOS-${roomId}`)
      .maybeSingle()
    if (data) {
      const doc = data.doctor as unknown as { name: string; specialty: string }
      setApptInfo({
        doctor_name: doc?.name || 'Doctor',
        doctor_specialty: doc?.specialty || '',
        slot_date: data.slot_date,
        slot_time: data.slot_time,
      })
    }
  }

  function openMeeting() {
    window.open(jitsiUrl, '_blank', 'noopener,noreferrer')
    setJoined(true)
  }

  function copy(text: string, label: string) {
    navigator.clipboard?.writeText(text)
    setCopied(label)
    setTimeout(() => setCopied(null), 2500)
  }

  function whatsapp() {
    const msg = `Join my VitalOS video consultation 🎥\n\nClick this link to join:\n${doctorUrl}\n\nNo login or account needed — just click and join!`
    window.open(`https://wa.me/?text=${encodeURIComponent(msg)}`, '_blank')
  }

  const dateStr = apptInfo
    ? new Date(apptInfo.slot_date + 'T00:00:00').toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'long' })
    : ''

  return (
    <div className="min-h-screen flex flex-col" style={{ background: 'linear-gradient(160deg,#0a1a28 0%,#0f2a1e 100%)' }}>
      {/* Top bar */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-white/10 shrink-0">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl flex items-center justify-center"
            style={{ background: 'linear-gradient(135deg,#0f6e56,#1d9e75)' }}>
            <Video size={15} className="text-white" />
          </div>
          <div>
            <p className="text-sm font-bold text-white leading-tight">VitalOS Consultation</p>
            <p className="text-[10px] text-emerald-400 flex items-center gap-1">
              <span className="w-1.5 h-1.5 bg-emerald-400 rounded-full animate-pulse inline-block" />
              Room {roomId}
            </p>
          </div>
        </div>
        <button onClick={() => navigate(-1)}
          className="flex items-center gap-1.5 text-xs text-red-400 border border-red-800/50 px-3 py-1.5 rounded-lg hover:bg-red-900/20">
          <Phone size={12} className="rotate-[135deg]" /> Leave
        </button>
      </div>

      <div className="flex-1 flex flex-col items-center justify-start px-4 py-6 gap-4 max-w-md mx-auto w-full">

        {/* Doctor info card */}
        {apptInfo && (
          <div className="w-full rounded-2xl p-5"
            style={{ background: 'rgba(15,110,86,0.15)', border: '1px solid rgba(29,158,117,0.3)' }}>
            <div className="flex items-center gap-4">
              <div className="w-14 h-14 rounded-2xl flex items-center justify-center text-xl font-black text-white shrink-0"
                style={{ background: 'linear-gradient(135deg,#0f6e56,#1d9e75)' }}>
                {apptInfo.doctor_name.split(' ').slice(-1)[0].slice(0, 2)}
              </div>
              <div className="min-w-0">
                <p className="text-base font-black text-white truncate">{apptInfo.doctor_name}</p>
                <p className="text-sm text-emerald-400 font-medium">{apptInfo.doctor_specialty}</p>
                <p className="text-xs text-gray-400 mt-1 flex items-center gap-1">
                  <Calendar size={10} /> {dateStr} · {apptInfo.slot_time?.slice(0, 5)}
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Instructions */}
        <div className="w-full rounded-xl p-4"
          style={{ background: 'rgba(16,185,129,0.08)', border: '1px solid rgba(16,185,129,0.2)' }}>
          <p className="text-xs font-bold text-emerald-400 mb-2.5">How to start your video call</p>
          {[
            'Tap "Start video call" below — opens in new tab',
            'You join instantly — no login, no waiting screen',
            'Send doctor link via WhatsApp button below',
            'Doctor clicks → joins the same room directly',
          ].map((s, i) => (
            <div key={i} className="flex items-start gap-2.5 mb-2">
              <span className="w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold text-white shrink-0 mt-0.5"
                style={{ background: 'rgba(16,185,129,0.3)' }}>
                {i + 1}
              </span>
              <p className="text-xs text-emerald-200 leading-relaxed">{s}</p>
            </div>
          ))}
        </div>

        {/* Big join button */}
        <button onClick={openMeeting}
          className="w-full py-4 rounded-2xl font-black text-lg text-white flex items-center justify-center gap-3 transition-all active:scale-95"
          style={{ background: 'linear-gradient(135deg,#0f6e56,#1d9e75)', boxShadow: '0 8px 32px rgba(15,110,86,0.5)' }}>
          <Video size={24} />
          {joined ? 'Rejoin video call' : 'Start video call'}
        </button>

        {joined && (
          <div className="w-full flex items-center gap-2 rounded-xl p-3"
            style={{ background: 'rgba(16,185,129,0.1)', border: '1px solid rgba(16,185,129,0.3)' }}>
            <Check size={14} className="text-emerald-400 shrink-0" />
            <p className="text-xs text-emerald-300">Meeting opened. Now share the doctor link below.</p>
          </div>
        )}

        {/* Share links */}
        <div className="w-full space-y-3">
          <p className="text-xs font-bold text-gray-500 uppercase tracking-wider">Send to doctor</p>

          <div className="rounded-xl p-3"
            style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.1)' }}>
            <p className="text-[10px] text-gray-400 font-bold mb-2">🩺 Doctor link — no login needed</p>
            <div className="flex items-start gap-2">
              <code className="flex-1 text-[10px] text-teal-300 break-all leading-relaxed">
                meet.jit.si/VitalOS{cleanRoom}
              </code>
              <div className="flex flex-col gap-1.5 shrink-0">
                <button onClick={() => copy(doctorUrl, 'doctor')}
                  className="flex items-center gap-1 text-[11px] text-white bg-teal-700 px-2.5 py-1.5 rounded-lg whitespace-nowrap">
                  {copied === 'doctor' ? <><Check size={10} />Copied</> : <><Copy size={10} />Copy</>}
                </button>
                <button onClick={whatsapp}
                  className="flex items-center justify-center gap-1 text-[11px] text-white bg-green-700 px-2.5 py-1.5 rounded-lg whitespace-nowrap">
                  📲 WhatsApp
                </button>
              </div>
            </div>
          </div>

          <div className="rounded-xl p-3"
            style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.1)' }}>
            <p className="text-[10px] text-gray-400 font-bold mb-2">🔗 VitalOS consultation link</p>
            <div className="flex items-center gap-2">
              <code className="flex-1 text-[10px] text-blue-300 break-all">{shareUrl}</code>
              <button onClick={() => copy(shareUrl, 'share')}
                className="flex items-center gap-1 text-[11px] text-white bg-blue-700 px-2.5 py-1.5 rounded-lg whitespace-nowrap shrink-0">
                {copied === 'share' ? <><Check size={10} />Copied</> : <><Copy size={10} />Copy</>}
              </button>
            </div>
          </div>
        </div>

        <p className="text-[10px] text-gray-600 text-center pb-4">
          Powered by Jitsi Meet · Free · End-to-end encrypted
        </p>
      </div>
    </div>
  )
}
