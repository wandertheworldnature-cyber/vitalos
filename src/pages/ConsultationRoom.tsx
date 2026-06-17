import { useParams, useNavigate } from 'react-router-dom'
import { useEffect, useState } from 'react'
import { useAuthStore } from '@/store/authStore'
import { supabase } from '@/lib/supabase'
import { Video, Phone, Copy, Check, Calendar, ExternalLink } from 'lucide-react'

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

  // Jitsi direct URL — patient opens first = auto moderator, no login screen
  // Key: no dashes in room name, short alphanumeric only
  const clean = (roomId || '').replace(/[^a-zA-Z0-9]/g, '').toLowerCase()
  const jitsiRoom = `vitalos${clean}`
  const jitsiUrl  = `https://meet.jit.si/${jitsiRoom}`
  const shareUrl  = `${window.location.origin}/consultation/${roomId}`

  useEffect(() => { if (roomId) loadInfo() }, [roomId])

  async function loadInfo() {
    const { data } = await supabase.from('appointments')
      .select('slot_date,slot_time,doctor:doctors(name,specialty)')
      .or(`meeting_link.eq.https://meet.jit.si/VitalOS-${roomId},meeting_link.like.%${roomId}%`)
      .maybeSingle()
    if (data) {
      const doc = data.doctor as unknown as { name: string; specialty: string }
      setApptInfo({ doctor_name: doc?.name || 'Doctor', doctor_specialty: doc?.specialty || '', slot_date: data.slot_date, slot_time: data.slot_time })
    }
  }

  function openMeeting() {
    // Open Jitsi in new tab — first person to open becomes moderator automatically
    window.open(jitsiUrl, '_blank', 'noopener,noreferrer')
    setJoined(true)
  }

  function copy(text: string, label: string) {
    navigator.clipboard?.writeText(text)
    setCopied(label)
    setTimeout(() => setCopied(null), 2500)
  }

  function whatsapp() {
    const msg = `🎥 Join my VitalOS video consultation\n\nClick to join — no login needed, just open in browser:\n${jitsiUrl}\n\n(Room: ${jitsiRoom})`
    window.open(`https://wa.me/?text=${encodeURIComponent(msg)}`, '_blank')
  }

  const dateStr = apptInfo
    ? new Date(apptInfo.slot_date + 'T00:00:00').toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'long' })
    : ''

  return (
    <div className="min-h-screen flex flex-col" style={{ background: 'linear-gradient(160deg,#0a1a28 0%,#0f2a1e 100%)' }}>
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-white/10 shrink-0"
        style={{ background: 'linear-gradient(135deg,#0f1a15,#0a2018)' }}>
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="w-8 h-8 rounded-xl flex items-center justify-center shrink-0"
            style={{ background: 'linear-gradient(135deg,#0f6e56,#1d9e75)' }}>
            <Video size={14} className="text-white" />
          </div>
          <div className="min-w-0">
            <p className="text-sm font-bold text-white truncate">
              {apptInfo ? `${apptInfo.doctor_name} · ${apptInfo.doctor_specialty}` : 'VitalOS Consultation'}
            </p>
            <p className="text-[10px] text-emerald-400 flex items-center gap-1">
              <span className="w-1.5 h-1.5 bg-emerald-400 rounded-full animate-pulse inline-block" />
              Room: {jitsiRoom}
              {apptInfo && <span className="text-gray-500 ml-1">· {dateStr} {apptInfo.slot_time?.slice(0,5)}</span>}
            </p>
          </div>
        </div>
        <button onClick={() => navigate(-1)}
          className="flex items-center gap-1.5 text-xs text-red-400 border border-red-800/50 px-3 py-1.5 rounded-lg hover:bg-red-900/20">
          <Phone size={12} className="rotate-[135deg]" /> Leave
        </button>
      </div>

      <div className="flex-1 flex flex-col items-center justify-start px-4 py-6 gap-4 max-w-md mx-auto w-full">

        {/* Doctor card */}
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
                <p className="text-sm text-emerald-400">{apptInfo.doctor_specialty}</p>
                {apptInfo && (
                  <p className="text-xs text-gray-400 mt-1 flex items-center gap-1">
                    <Calendar size={10} /> {dateStr} · {apptInfo.slot_time?.slice(0, 5)}
                  </p>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Important instruction */}
        <div className="w-full rounded-xl p-4"
          style={{ background: 'rgba(245,158,11,0.1)', border: '1px solid rgba(245,158,11,0.25)' }}>
          <p className="text-xs font-bold text-amber-400 mb-2">⚡ Important — read before joining</p>
          <p className="text-xs text-amber-200 leading-relaxed">
            <strong>You must open the meeting first</strong> before sharing the link with your doctor. 
            The first person to open the room becomes the host automatically — no login needed.
          </p>
        </div>

        {/* Steps */}
        <div className="w-full rounded-xl p-4"
          style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}>
          <p className="text-xs font-bold text-gray-400 mb-3">How to start your call</p>
          {[
            ['1', 'Tap "Open video call" — Jitsi opens in new tab'],
            ['2', 'You are now host — no waiting, no login required'],
            ['3', 'Come back here, copy doctor link, send via WhatsApp'],
            ['4', 'Doctor opens the link → joins your room directly'],
          ].map(([n, t]) => (
            <div key={n} className="flex items-start gap-2.5 mb-2 last:mb-0">
              <span className="w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold text-white shrink-0"
                style={{ background: 'rgba(29,158,117,0.4)' }}>{n}</span>
              <p className="text-xs text-gray-300 leading-relaxed">{t}</p>
            </div>
          ))}
        </div>

        {/* Join button */}
        <button onClick={openMeeting}
          className="w-full py-4 rounded-2xl font-black text-lg text-white flex items-center justify-center gap-3 transition-all active:scale-95"
          style={{ background: 'linear-gradient(135deg,#0f6e56,#1d9e75)', boxShadow: '0 8px 32px rgba(15,110,86,0.5)' }}>
          <ExternalLink size={20} />
          {joined ? 'Rejoin video call' : 'Open video call'}
        </button>

        {joined && (
          <div className="w-full flex items-center gap-2 rounded-xl p-3"
            style={{ background: 'rgba(16,185,129,0.1)', border: '1px solid rgba(16,185,129,0.3)' }}>
            <Check size={14} className="text-emerald-400 shrink-0" />
            <p className="text-xs text-emerald-300">Meeting opened! Now share the doctor link below.</p>
          </div>
        )}

        {/* Share links */}
        <div className="w-full space-y-3">
          <p className="text-xs font-bold text-gray-500 uppercase tracking-wider">Send to doctor</p>

          <div className="rounded-xl p-3"
            style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.1)' }}>
            <p className="text-[10px] text-gray-400 font-bold mb-2">🩺 Direct meeting link (share this with doctor)</p>
            <div className="flex items-start gap-2">
              <code className="flex-1 text-[11px] text-teal-300 break-all leading-relaxed">{jitsiUrl}</code>
              <div className="flex flex-col gap-1.5 shrink-0">
                <button onClick={() => copy(jitsiUrl, 'jitsi')}
                  className="flex items-center gap-1 text-[11px] text-white bg-teal-700 px-2.5 py-1.5 rounded-lg whitespace-nowrap">
                  {copied === 'jitsi' ? <><Check size={10}/>Copied</> : <><Copy size={10}/>Copy</>}
                </button>
                <button onClick={whatsapp}
                  className="text-[11px] text-white bg-green-700 px-2.5 py-1.5 rounded-lg whitespace-nowrap text-center">
                  📲 WhatsApp
                </button>
              </div>
            </div>
          </div>
        </div>

        <p className="text-[10px] text-gray-600 text-center pb-4">
          Jitsi Meet · Free · No account needed · Works on all devices
        </p>
      </div>
    </div>
  )
}
