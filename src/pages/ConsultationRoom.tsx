import { useParams, useNavigate } from 'react-router-dom'
import { useEffect, useRef, useState } from 'react'
import { useAuthStore } from '@/store/authStore'
import { supabase } from '@/lib/supabase'
import { Video, Phone, Copy, Check, Calendar } from 'lucide-react'

interface ApptInfo {
  doctor_name: string
  doctor_specialty: string
  slot_date: string
  slot_time: string
}

// Daily.co domain from env — set VITE_DAILY_DOMAIN=vitalos in Vercel
const DAILY_DOMAIN = import.meta.env.VITE_DAILY_DOMAIN || 'vitalos'

export default function ConsultationRoom() {
  const { roomId } = useParams<{ roomId: string }>()
  const { user } = useAuthStore()
  const navigate = useNavigate()
  const iframeRef = useRef<HTMLIFrameElement>(null)
  const [apptInfo, setApptInfo] = useState<ApptInfo | null>(null)
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading')
  const [copied, setCopied] = useState(false)
  const [showInfo, setShowInfo] = useState(false)

  // Clean room name — Daily.co room names must be alphanumeric + dashes only
  const cleanRoom = `VitalOS-${(roomId || '').replace(/[^a-zA-Z0-9]/g, '').slice(0, 20)}`
  const dailyUrl = `https://${DAILY_DOMAIN}.daily.co/${cleanRoom}`
  const shareUrl = `${window.location.origin}/consultation/${roomId}`

  useEffect(() => { if (roomId) { loadInfo(); createRoom() } }, [roomId])

  async function loadInfo() {
    const { data } = await supabase.from('appointments')
      .select('slot_date,slot_time,doctor:doctors(name,specialty)')
      .eq('meeting_link', `https://meet.jit.si/VitalOS-${roomId}`)
      .maybeSingle()
    if (data) {
      const doc = data.doctor as unknown as { name: string; specialty: string }
      setApptInfo({ doctor_name: doc?.name || 'Doctor', doctor_specialty: doc?.specialty || '', slot_date: data.slot_date, slot_time: data.slot_time })
    }
  }

  async function createRoom() {
    // Create room via Daily REST API — rooms persist so same link always works
    try {
      const apiKey = import.meta.env.VITE_DAILY_API_KEY
      if (!apiKey) { setStatus('ready'); return } // no API key — use public room

      // Try to create room (will fail silently if already exists)
      await fetch('https://api.daily.co/v1/rooms', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
        body: JSON.stringify({
          name: cleanRoom,
          privacy: 'public', // anyone with link can join, no login needed
          properties: {
            enable_prejoin_ui: false,  // skip prejoin screen
            enable_knocking: false,    // no knocking/lobby
            start_video_off: false,
            start_audio_off: false,
            exp: Math.floor(Date.now() / 1000) + 86400 * 7, // expires in 7 days
          }
        })
      })
    } catch { /* ignore — room might already exist */ }
    setStatus('ready')
  }

  function copy() {
    navigator.clipboard?.writeText(dailyUrl)
    setCopied(true)
    setTimeout(() => setCopied(false), 2500)
  }

  function whatsapp() {
    const msg = `Join my VitalOS video consultation 🎥\n\nClick to join (no login needed):\n${dailyUrl}`
    window.open(`https://wa.me/?text=${encodeURIComponent(msg)}`, '_blank')
  }

  const dateStr = apptInfo
    ? new Date(apptInfo.slot_date + 'T00:00:00').toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'long' })
    : ''

  return (
    <div className="flex flex-col h-screen bg-gray-950">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-2.5 border-b border-gray-800 shrink-0"
        style={{ background: 'linear-gradient(135deg,#0f1a15,#0a2018)' }}>
        <div className="flex items-center gap-3 min-w-0">
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
              {status === 'ready' ? 'Live' : 'Connecting...'} · {DAILY_DOMAIN}.daily.co
              {apptInfo && <span className="text-gray-500 ml-1">· {dateStr} {apptInfo.slot_time?.slice(0,5)}</span>}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <button onClick={() => setShowInfo(s => !s)}
            className="text-xs text-gray-400 border border-gray-700 px-2.5 py-1.5 rounded-lg hover:bg-gray-800">
            Share
          </button>
          <button onClick={() => navigate(-1)}
            className="flex items-center gap-1 text-xs text-red-400 border border-red-900 px-2.5 py-1.5 rounded-lg hover:bg-red-900/20">
            <Phone size={11} className="rotate-[135deg]" /> End
          </button>
        </div>
      </div>

      {/* Share panel */}
      {showInfo && (
        <div className="shrink-0 border-b border-gray-800 px-4 py-3"
          style={{ background: 'rgba(255,255,255,0.02)' }}>
          <p className="text-[10px] text-gray-400 mb-2 font-bold">Send to doctor — they click and join instantly, no login needed:</p>
          <div className="flex items-center gap-2">
            <code className="flex-1 text-[11px] text-teal-300 bg-gray-900 px-3 py-2 rounded-lg truncate">{dailyUrl}</code>
            <button onClick={copy}
              className="flex items-center gap-1 text-xs text-white bg-teal-700 px-3 py-2 rounded-lg whitespace-nowrap shrink-0">
              {copied ? <><Check size={11}/>Copied!</> : <><Copy size={11}/>Copy</>}
            </button>
            <button onClick={whatsapp}
              className="text-xs text-white bg-green-700 px-3 py-2 rounded-lg whitespace-nowrap shrink-0">
              📲 WhatsApp
            </button>
          </div>
        </div>
      )}

      {/* Daily.co iframe — full screen, no moderator issue */}
      <div className="flex-1 relative overflow-hidden">
        {status === 'loading' && (
          <div className="absolute inset-0 flex items-center justify-center bg-gray-950 z-10">
            <div className="flex flex-col items-center gap-3">
              <div className="w-8 h-8 border-2 border-t-emerald-500 border-gray-700 rounded-full animate-spin" />
              <p className="text-xs text-gray-400">Starting video call...</p>
            </div>
          </div>
        )}

        <iframe
          ref={iframeRef}
          src={`${dailyUrl}?showLeaveButton=false&showFullscreenButton=true&userName=${encodeURIComponent(user?.full_name || 'Patient')}`}
          allow="camera; microphone; fullscreen; speaker; display-capture"
          style={{ width: '100%', height: '100%', border: 'none', background: '#000' }}
          onLoad={() => setStatus('ready')}
          onError={() => setStatus('error')}
        />

        {status === 'error' && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-gray-950 gap-4 p-6 text-center">
            <div className="text-4xl">📹</div>
            <p className="text-white font-semibold">Unable to load video</p>
            <p className="text-gray-400 text-sm">Open the meeting directly in your browser</p>
            <a href={dailyUrl} target="_blank" rel="noreferrer"
              className="px-6 py-3 rounded-xl text-white font-bold text-sm"
              style={{ background: 'linear-gradient(135deg,#0f6e56,#1d9e75)' }}>
              Open video call →
            </a>
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="px-4 py-1.5 border-t border-gray-800 bg-gray-950 shrink-0">
        <p className="text-[10px] text-gray-700 text-center">
          Powered by Daily.co · 10,000 free mins/month · End-to-end encrypted · No login needed for doctor
        </p>
      </div>
    </div>
  )
}
