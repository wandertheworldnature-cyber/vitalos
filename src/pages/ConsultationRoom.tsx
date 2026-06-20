import { useParams, useNavigate } from 'react-router-dom'
import { useEffect, useRef, useState } from 'react'
import { useAuthStore } from '@/store/authStore'
import { supabase } from '@/lib/supabase'
import { Video, Phone, Copy, Check, Calendar, ExternalLink } from 'lucide-react'

interface ApptInfo {
  doctor_name: string
  doctor_specialty: string
  slot_date: string
  slot_time: string
}

// JaaS App ID — set VITE_JAAS_APP_ID in Vercel env vars
// Get it free at jaas.8x8.vc (25 users/month free, no moderator issue)
const JAAS_APP_ID = import.meta.env.VITE_JAAS_APP_ID || ''

export default function ConsultationRoom() {
  const { roomId } = useParams<{ roomId: string }>()
  const { user } = useAuthStore()
  const navigate = useNavigate()
  const jaasRef = useRef<HTMLDivElement>(null)
  const apiRef = useRef<{ dispose: () => void } | null>(null)
  const [apptInfo, setApptInfo] = useState<ApptInfo | null>(null)
  const [status, setStatus] = useState<'loading' | 'ready' | 'fallback'>('loading')
  const [copied, setCopied] = useState<string | null>(null)

  const cleanRoom = (roomId || '').replace(/[^a-zA-Z0-9]/g, '').toLowerCase()

  // If JaaS App ID available — use embedded JaaS (no moderator, no time limit)
  // Otherwise — fallback to direct Jitsi URL (patient opens first = moderator)
  const jaasRoom  = JAAS_APP_ID ? `${JAAS_APP_ID}/VitalOS${cleanRoom}` : ''
  const jitsiUrl  = `https://meet.jit.si/VitalOS${cleanRoom}`
  const shareUrl  = `${window.location.origin}/consultation/${roomId}`

  useEffect(() => {
    if (roomId) loadInfo()
    return () => { apiRef.current?.dispose() }
  }, [roomId])

  useEffect(() => {
    if (JAAS_APP_ID) initJaaS()
    else setStatus('fallback')
  }, [JAAS_APP_ID])

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

  function initJaaS() {
    const existing = document.getElementById('jitsi-api-script')
    if (existing) { startJaaS(); return }
    const script = document.createElement('script')
    script.id = 'jitsi-api-script'
    script.src = 'https://8x8.vc/vpaas-magic-cookie-free/external_api.js'
    script.async = true
    script.onload = startJaaS
    script.onerror = () => setStatus('fallback')
    document.head.appendChild(script)
  }

  function startJaaS() {
    if (!jaasRef.current || !jaasRoom) return
    // @ts-ignore
    if (!window.JitsiMeetExternalAPI) { setStatus('fallback'); return }
    apiRef.current?.dispose()
    // @ts-ignore
    const api = new window.JitsiMeetExternalAPI('8x8.vc', {
      roomName: jaasRoom,
      parentNode: jaasRef.current,
      width: '100%', height: '100%',
      userInfo: { displayName: user?.full_name || 'Patient', email: user?.email || '' },
      configOverwrite: {
        prejoinPageEnabled: false,
        startWithVideoMuted: false,
        startWithAudioMuted: false,
        disableDeepLinking: true,
      },
      interfaceConfigOverwrite: {
        SHOW_JITSI_WATERMARK: false,
        SHOW_WATERMARK_FOR_GUESTS: false,
        MOBILE_APP_PROMO: false,
        TOOLBAR_BUTTONS: ['microphone','camera','hangup','chat','tileview','fullscreen'],
      },
    })
    api.addEventListener('videoConferenceJoined', () => setStatus('ready'))
    api.addEventListener('readyToClose', () => navigate(-1))
    apiRef.current = api
  }

  function copy(text: string, label: string) {
    navigator.clipboard?.writeText(text)
    setCopied(label)
    setTimeout(() => setCopied(null), 2500)
  }

  function whatsapp() {
    const link = JAAS_APP_ID ? shareUrl : jitsiUrl
    const msg = `Join my VitalOS video consultation 🎥\n\nClick to join:\n${link}\n\nNo login needed!`
    window.open(`https://wa.me/?text=${encodeURIComponent(msg)}`, '_blank')
  }

  const dateStr = apptInfo
    ? new Date(apptInfo.slot_date + 'T00:00:00').toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'long' })
    : ''

  // ─── JAAS EMBEDDED VIEW ────────────────────────────────────────
  if (JAAS_APP_ID) {
    return (
      <div className="flex flex-col h-screen bg-gray-950">
        <div className="flex items-center justify-between px-4 py-2.5 border-b border-gray-800 shrink-0"
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
              <p className="text-[10px] text-emerald-400 flex items-center gap-1.5">
                <span className={`w-1.5 h-1.5 rounded-full inline-block ${status === 'ready' ? 'bg-emerald-400 animate-pulse' : 'bg-amber-400'}`} />
                {status === 'ready' ? 'Live' : 'Connecting...'} · JaaS
                {apptInfo && <span className="text-gray-500">· {dateStr} {apptInfo.slot_time?.slice(0,5)}</span>}
              </p>
            </div>
          </div>
          <div className="flex gap-2">
            <button onClick={() => copy(shareUrl, 'share')}
              className="flex items-center gap-1 text-xs text-gray-400 border border-gray-700 px-2.5 py-1.5 rounded-lg">
              {copied === 'share' ? <Check size={11}/> : <Copy size={11}/>} Share
            </button>
            <button onClick={whatsapp}
              className="text-xs text-white bg-green-700 px-2.5 py-1.5 rounded-lg">📲</button>
            <button onClick={() => navigate(-1)}
              className="flex items-center gap-1 text-xs text-red-400 border border-red-900 px-2.5 py-1.5 rounded-lg">
              <Phone size={11} className="rotate-[135deg]" /> End
            </button>
          </div>
        </div>
        <div className="flex-1 relative overflow-hidden bg-black">
          {status === 'loading' && (
            <div className="absolute inset-0 flex flex-col items-center justify-center z-10 gap-3">
              <div className="w-8 h-8 border-2 border-t-emerald-500 border-gray-700 rounded-full animate-spin"/>
              <p className="text-sm text-gray-400">Starting secure video call...</p>
            </div>
          )}
          <div ref={jaasRef} style={{ width:'100%', height:'100%' }}/>
        </div>
        <div className="px-4 py-1.5 border-t border-gray-800 bg-gray-950 text-center shrink-0">
          <p className="text-[10px] text-gray-700">Powered by JaaS · Free 25 users/month · No moderator required</p>
        </div>
      </div>
    )
  }

  // ─── FALLBACK: NO JAAS — DIRECT URL + INSTRUCTIONS ─────────────
  return (
    <div className="min-h-screen flex flex-col" style={{ background: 'linear-gradient(160deg,#0a1a28,#0f2a1e)' }}>
      <div className="flex items-center justify-between px-4 py-3 border-b border-white/10"
        style={{ background: 'linear-gradient(135deg,#0f1a15,#0a2018)' }}>
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="w-8 h-8 rounded-xl flex items-center justify-center shrink-0"
            style={{ background: 'linear-gradient(135deg,#0f6e56,#1d9e75)' }}>
            <Video size={14} className="text-white"/>
          </div>
          <div className="min-w-0">
            <p className="text-sm font-bold text-white truncate">
              {apptInfo ? `${apptInfo.doctor_name} · ${apptInfo.doctor_specialty}` : 'VitalOS Consultation'}
            </p>
            <p className="text-[10px] text-emerald-400">Room: VitalOS{cleanRoom}</p>
          </div>
        </div>
        <button onClick={() => navigate(-1)}
          className="flex items-center gap-1.5 text-xs text-red-400 border border-red-800/50 px-3 py-1.5 rounded-lg">
          <Phone size={12} className="rotate-[135deg]"/> Leave
        </button>
      </div>

      <div className="flex-1 flex flex-col items-center justify-start px-4 py-6 gap-4 max-w-md mx-auto w-full">

        {apptInfo && (
          <div className="w-full rounded-2xl p-5"
            style={{ background:'rgba(15,110,86,0.15)', border:'1px solid rgba(29,158,117,0.3)' }}>
            <div className="flex items-center gap-4">
              <div className="w-14 h-14 rounded-2xl flex items-center justify-center text-xl font-black text-white shrink-0"
                style={{ background:'linear-gradient(135deg,#0f6e56,#1d9e75)' }}>
                {apptInfo.doctor_name.split(' ').slice(-1)[0].slice(0,2)}
              </div>
              <div>
                <p className="text-base font-black text-white">{apptInfo.doctor_name}</p>
                <p className="text-sm text-emerald-400">{apptInfo.doctor_specialty}</p>
                <p className="text-xs text-gray-400 mt-1 flex items-center gap-1">
                  <Calendar size={10}/> {dateStr} · {apptInfo.slot_time?.slice(0,5)}
                </p>
              </div>
            </div>
          </div>
        )}

        <div className="w-full rounded-xl p-4"
          style={{ background:'rgba(245,158,11,0.1)', border:'1px solid rgba(245,158,11,0.25)' }}>
          <p className="text-xs font-bold text-amber-400 mb-2">⚡ You must open the meeting FIRST</p>
          <p className="text-xs text-amber-200 leading-relaxed">
            Open the meeting before sharing the link. First person = automatic host. No login screen.
          </p>
        </div>

        <a href={jitsiUrl} target="_blank" rel="noreferrer"
          className="w-full py-4 rounded-2xl font-black text-lg text-white flex items-center justify-center gap-3"
          style={{ background:'linear-gradient(135deg,#0f6e56,#1d9e75)', boxShadow:'0 8px 32px rgba(15,110,86,0.5)' }}>
          <ExternalLink size={20}/> Open video call
        </a>

        <div className="w-full space-y-3">
          <p className="text-xs font-bold text-gray-500 uppercase tracking-wider">Share with doctor after joining</p>
          <div className="rounded-xl p-3" style={{ background:'rgba(255,255,255,0.04)', border:'1px solid rgba(255,255,255,0.1)' }}>
            <p className="text-[10px] text-gray-400 font-bold mb-2">🩺 Doctor link</p>
            <div className="flex items-start gap-2">
              <code className="flex-1 text-[11px] text-teal-300 break-all">{jitsiUrl}</code>
              <div className="flex flex-col gap-1.5 shrink-0">
                <button onClick={() => copy(jitsiUrl, 'jitsi')}
                  className="flex items-center gap-1 text-[11px] text-white bg-teal-700 px-2.5 py-1.5 rounded-lg">
                  {copied === 'jitsi' ? <><Check size={10}/>Copied</> : <><Copy size={10}/>Copy</>}
                </button>
                <button onClick={whatsapp}
                  className="text-[11px] text-white bg-green-700 px-2.5 py-1.5 rounded-lg text-center">
                  📲 WhatsApp
                </button>
              </div>
            </div>
          </div>
        </div>

        <div className="w-full rounded-xl p-4" style={{ background:'rgba(59,130,246,0.08)', border:'1px solid rgba(59,130,246,0.2)' }}>
          <p className="text-xs font-bold text-blue-400 mb-2">🚀 Upgrade to embedded video</p>
          <p className="text-[11px] text-blue-300 leading-relaxed mb-2">
            Sign up at <strong>jaas.8x8.vc</strong> (free, 25 users/month) → get App ID → add <strong>VITE_JAAS_APP_ID</strong> to Vercel env → video embeds directly in VitalOS, no moderator screen ever.
          </p>
          <a href="https://jaas.8x8.vc" target="_blank" rel="noreferrer"
            className="text-[11px] text-blue-400 font-semibold flex items-center gap-1">
            Get free JaaS account <ExternalLink size={10}/>
          </a>
        </div>

        <p className="text-[10px] text-gray-600 text-center pb-4">Jitsi Meet · Free · Open source</p>
      </div>
    </div>
  )
}
