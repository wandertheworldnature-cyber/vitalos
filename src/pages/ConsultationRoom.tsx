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
  const [copied, setCopied] = useState(false)
  const [showShare, setShowShare] = useState(false)
  const [iframeLoaded, setIframeLoaded] = useState(false)

  // Whereby free tier — unlimited 1:1, no login for guest, embeddable
  // Room name is consistent per appointment so same link always works
  const cleanRoom = (roomId || '').replace(/[^a-zA-Z0-9]/g, '').slice(0, 20)
  const wherebyUrl = `https://whereby.com/vitalos-${cleanRoom}`
  const embedUrl = `https://whereby.com/vitalos-${cleanRoom}?embed&skipMediaPermissionPrompt&displayName=${encodeURIComponent(user?.full_name || 'Patient')}`
  const shareUrl = `${window.location.origin}/consultation/${roomId}`

  useEffect(() => { if (roomId) loadInfo() }, [roomId])

  async function loadInfo() {
    const { data } = await supabase.from('appointments')
      .select('slot_date,slot_time,doctor:doctors(name,specialty)')
      .or(`meeting_link.eq.https://meet.jit.si/VitalOS-${roomId},meeting_link.eq.${shareUrl}`)
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

  function copy() {
    navigator.clipboard?.writeText(wherebyUrl)
    setCopied(true)
    setTimeout(() => setCopied(false), 2500)
  }

  function whatsapp() {
    const msg = `Join my VitalOS video consultation 🎥\n\nClick to join — no login needed:\n${wherebyUrl}\n\nSee you soon!`
    window.open(`https://wa.me/?text=${encodeURIComponent(msg)}`, '_blank')
  }

  const dateStr = apptInfo
    ? new Date(apptInfo.slot_date + 'T00:00:00').toLocaleDateString('en-IN', {
        weekday: 'short', day: 'numeric', month: 'long'
      })
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
            <p className="text-[10px] text-emerald-400 flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 bg-emerald-400 rounded-full animate-pulse inline-block" />
              Live · Whereby
              {apptInfo && (
                <span className="text-gray-500">· {dateStr} {apptInfo.slot_time?.slice(0, 5)}</span>
              )}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <button onClick={() => setShowShare(s => !s)}
            className="text-xs text-gray-400 border border-gray-700 px-2.5 py-1.5 rounded-lg hover:bg-gray-800 transition-colors">
            📤 Share
          </button>
          <a href={wherebyUrl} target="_blank" rel="noreferrer"
            className="text-xs text-gray-400 border border-gray-700 px-2.5 py-1.5 rounded-lg hover:bg-gray-800 transition-colors flex items-center gap-1">
            <ExternalLink size={11} /> Open
          </a>
          <button onClick={() => navigate(-1)}
            className="flex items-center gap-1 text-xs text-red-400 border border-red-900 px-2.5 py-1.5 rounded-lg hover:bg-red-900/20">
            <Phone size={11} className="rotate-[135deg]" /> End
          </button>
        </div>
      </div>

      {/* Share panel */}
      {showShare && (
        <div className="shrink-0 px-4 py-3 border-b border-gray-800"
          style={{ background: 'rgba(15,110,86,0.1)' }}>
          <p className="text-[10px] text-emerald-400 font-bold mb-2">
            🩺 Send to doctor — no login or account needed:
          </p>
          <div className="flex items-center gap-2">
            <code className="flex-1 text-[11px] text-teal-300 bg-black/30 px-3 py-2 rounded-lg truncate">
              {wherebyUrl}
            </code>
            <button onClick={copy}
              className="flex items-center gap-1 text-xs text-white bg-teal-700 px-3 py-2 rounded-lg whitespace-nowrap shrink-0">
              {copied ? <><Check size={11} />Copied!</> : <><Copy size={11} />Copy</>}
            </button>
            <button onClick={whatsapp}
              className="text-xs text-white bg-green-700 px-3 py-2 rounded-lg whitespace-nowrap shrink-0">
              📲 WhatsApp
            </button>
          </div>
          <p className="text-[10px] text-gray-500 mt-2">
            ✅ No payment card · No login · Free unlimited 1:1 calls · Works on mobile
          </p>
        </div>
      )}

      {/* Whereby iframe */}
      <div className="flex-1 relative overflow-hidden bg-black">
        {!iframeLoaded && (
          <div className="absolute inset-0 flex flex-col items-center justify-center z-10 gap-3">
            <div className="w-8 h-8 border-2 border-t-emerald-500 border-gray-700 rounded-full animate-spin" />
            <p className="text-sm text-gray-400">Starting video call...</p>
          </div>
        )}
        <iframe
          src={embedUrl}
          allow="camera; microphone; fullscreen; speaker; display-capture; autoplay"
          style={{ width: '100%', height: '100%', border: 'none' }}
          onLoad={() => setIframeLoaded(true)}
        />
      </div>

      <div className="px-4 py-1.5 border-t border-gray-800 bg-gray-950 text-center shrink-0">
        <p className="text-[10px] text-gray-700">
          Powered by Whereby · Free unlimited 1:1 calls · No payment needed · No login for guests
        </p>
      </div>
    </div>
  )
}
