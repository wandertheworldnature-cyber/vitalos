import { useParams, useNavigate } from 'react-router-dom'
import { useEffect, useRef, useState } from 'react'
import { useAuthStore } from '@/store/authStore'
import { supabase } from '@/lib/supabase'
import { Video, Phone, Copy, Check, Calendar, Loader } from 'lucide-react'

interface ApptInfo {
  doctor_name: string
  doctor_specialty: string
  slot_date: string
  slot_time: string
}

const DAILY_DOMAIN = import.meta.env.VITE_DAILY_DOMAIN || 'vitalos'

export default function ConsultationRoom() {
  const { roomId } = useParams<{ roomId: string }>()
  const { user } = useAuthStore()
  const navigate = useNavigate()
  const [apptInfo, setApptInfo] = useState<ApptInfo | null>(null)
  const [roomUrl, setRoomUrl] = useState<string | null>(null)
  const [status, setStatus] = useState<'creating' | 'ready' | 'error'>('creating')
  const [errorMsg, setErrorMsg] = useState('')
  const [copied, setCopied] = useState(false)
  const [showShare, setShowShare] = useState(false)
  const shareUrl = `${window.location.origin}/consultation/${roomId}`

  useEffect(() => {
    if (roomId) { loadInfo(); setupRoom() }
  }, [roomId])

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

  async function setupRoom() {
    try {
      // Call edge function to create/get room
      const { data, error } = await supabase.functions.invoke('create-daily-room', {
        body: { roomId }
      })
      if (error || !data?.url) {
        // Fallback: try direct room URL (works if room was manually created)
        const cleanRoom = `VitalOS-${(roomId || '').replace(/[^a-zA-Z0-9]/g, '').slice(0, 20)}`
        const fallbackUrl = `https://${DAILY_DOMAIN}.daily.co/${cleanRoom}`
        setRoomUrl(fallbackUrl)
        setStatus('ready')
        return
      }
      setRoomUrl(data.url)
      setStatus('ready')
    } catch (e) {
      setErrorMsg('Could not create meeting room. Please try again.')
      setStatus('error')
    }
  }

  function copy() {
    if (!roomUrl) return
    navigator.clipboard?.writeText(roomUrl)
    setCopied(true)
    setTimeout(() => setCopied(false), 2500)
  }

  function whatsapp() {
    if (!roomUrl) return
    const msg = `Join my VitalOS video consultation 🎥\n\nClick to join (no login needed):\n${roomUrl}\n\nSee you soon!`
    window.open(`https://wa.me/?text=${encodeURIComponent(msg)}`, '_blank')
  }

  const dateStr = apptInfo
    ? new Date(apptInfo.slot_date + 'T00:00:00').toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'long' })
    : ''

  const iframeUrl = roomUrl
    ? `${roomUrl}?showLeaveButton=false&showFullscreenButton=true&userName=${encodeURIComponent(user?.full_name || 'Patient')}`
    : null

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
            <p className="text-[10px] text-emerald-400 flex items-center gap-1.5">
              <span className={`w-1.5 h-1.5 rounded-full inline-block ${status === 'ready' ? 'bg-emerald-400 animate-pulse' : 'bg-amber-400'}`} />
              {status === 'creating' ? 'Setting up room...' : status === 'ready' ? 'Live · Daily.co' : 'Error'}
              {apptInfo && <span className="text-gray-500">· {dateStr} {apptInfo.slot_time?.slice(0,5)}</span>}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <button onClick={() => setShowShare(s => !s)}
            className="text-xs text-gray-400 border border-gray-700 px-2.5 py-1.5 rounded-lg hover:bg-gray-800 transition-colors">
            📤 Share
          </button>
          <button onClick={() => navigate(-1)}
            className="flex items-center gap-1 text-xs text-red-400 border border-red-900 px-2.5 py-1.5 rounded-lg hover:bg-red-900/20">
            <Phone size={11} className="rotate-[135deg]" /> End
          </button>
        </div>
      </div>

      {/* Share panel */}
      {showShare && roomUrl && (
        <div className="shrink-0 px-4 py-3 border-b border-gray-800" style={{ background: 'rgba(15,110,86,0.1)' }}>
          <p className="text-[10px] text-emerald-400 font-bold mb-2">
            🩺 Send this link to doctor — they join instantly, no login needed:
          </p>
          <div className="flex items-center gap-2">
            <code className="flex-1 text-[11px] text-teal-300 bg-black/30 px-3 py-2 rounded-lg truncate">{roomUrl}</code>
            <button onClick={copy}
              className="flex items-center gap-1 text-xs text-white bg-teal-700 px-3 py-2 rounded-lg whitespace-nowrap shrink-0">
              {copied ? <><Check size={11}/>Copied!</> : <><Copy size={11}/>Copy</>}
            </button>
            <button onClick={whatsapp}
              className="text-xs text-white bg-green-700 px-3 py-2 rounded-lg whitespace-nowrap shrink-0">
              📲
            </button>
          </div>
        </div>
      )}

      {/* Main content */}
      <div className="flex-1 relative overflow-hidden">
        {status === 'creating' && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-gray-950 z-10 gap-4">
            <Loader size={32} className="text-emerald-500 animate-spin" />
            <p className="text-sm text-gray-300 font-medium">Setting up your video room...</p>
            <p className="text-xs text-gray-500">This takes just a second</p>
          </div>
        )}

        {status === 'error' && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-gray-950 gap-4 p-6 text-center">
            <div className="text-5xl">⚠️</div>
            <p className="text-white font-bold text-lg">Room setup failed</p>
            <p className="text-gray-400 text-sm max-w-xs">{errorMsg}</p>
            <button onClick={setupRoom}
              className="px-6 py-3 rounded-xl text-white font-bold text-sm mt-2"
              style={{ background: 'linear-gradient(135deg,#0f6e56,#1d9e75)' }}>
              Try again
            </button>
            <p className="text-xs text-gray-600 mt-2">Make sure DAILY_API_KEY is set in Supabase edge function secrets</p>
          </div>
        )}

        {status === 'ready' && iframeUrl && (
          <iframe
            src={iframeUrl}
            allow="camera; microphone; fullscreen; speaker; display-capture; autoplay"
            style={{ width: '100%', height: '100%', border: 'none', background: '#000' }}
          />
        )}
      </div>

      <div className="px-4 py-1.5 border-t border-gray-800 bg-gray-950 text-center shrink-0">
        <p className="text-[10px] text-gray-700">
          Daily.co · 10,000 free minutes/month · No login for doctor · End-to-end encrypted
        </p>
      </div>
    </div>
  )
}
