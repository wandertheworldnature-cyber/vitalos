import { useParams, useNavigate } from 'react-router-dom'
import { useEffect, useRef, useState } from 'react'
import { useAuthStore } from '@/store/authStore'
import { supabase } from '@/lib/supabase'
import { Copy, Phone, Video, Calendar } from 'lucide-react'

interface ApptInfo {
  doctor_name: string; doctor_specialty: string
  slot_date: string; slot_time: string; notes: string | null
}

declare global {
  interface Window { JitsiMeetExternalAPI: new (domain: string, opts: object) => {
    dispose: () => void
    executeCommand: (cmd: string, ...args: unknown[]) => void
    getNumberOfParticipants: () => number
  }}
}

export default function ConsultationRoom() {
  const { roomId } = useParams<{ roomId: string }>()
  const { user } = useAuthStore()
  const navigate = useNavigate()
  const containerRef = useRef<HTMLDivElement>(null)
  const apiRef = useRef<ReturnType<typeof window.JitsiMeetExternalAPI> | null>(null)
  const [apptInfo, setApptInfo] = useState<ApptInfo | null>(null)
  const [apiLoaded, setApiLoaded] = useState(false)

  useEffect(() => {
    if (user && roomId) loadApptInfo()
    loadJitsiScript()
    return () => { apiRef.current?.dispose() }
  }, [])

  useEffect(() => {
    if (apiLoaded && roomId && user) startMeeting()
  }, [apiLoaded, roomId, user])

  async function loadApptInfo() {
    if (!user || !roomId) return
    const link = `https://meet.jit.si/VitalOS-${roomId}`
    const { data } = await supabase.from('appointments')
      .select('slot_date,slot_time,notes,doctor:doctors(name,specialty)')
      .eq('meeting_link', link).single()
    if (data) {
      const doc = data.doctor as unknown as { name: string; specialty: string }
      setApptInfo({ doctor_name: doc?.name || 'Doctor', doctor_specialty: doc?.specialty || '', slot_date: data.slot_date, slot_time: data.slot_time, notes: data.notes })
    }
  }

  function loadJitsiScript() {
    if (window.JitsiMeetExternalAPI) { setApiLoaded(true); return }
    const s = document.createElement('script')
    s.src = 'https://meet.jit.si/external_api.js'
    s.onload = () => setApiLoaded(true)
    s.onerror = () => {
      // Fallback to iframe if script blocked
      setApiLoaded(false)
    }
    document.head.appendChild(s)
  }

  function startMeeting() {
    if (!containerRef.current || !roomId || !window.JitsiMeetExternalAPI) return
    apiRef.current?.dispose()
    apiRef.current = new window.JitsiMeetExternalAPI('meet.jit.si', {
      roomName: `VitalOS-${roomId}`,
      parentNode: containerRef.current,
      width: '100%',
      height: '100%',
      configOverwrite: {
        prejoinPageEnabled: false,          // Skip pre-join screen
        startWithAudioMuted: false,
        startWithVideoMuted: false,
        disableModeratorIndicator: true,
        enableWelcomePage: false,
        enableClosePage: false,
        disableDeepLinking: true,
        startAsSilentAudience: false,
        subject: apptInfo ? `VitalOS — ${apptInfo.doctor_name}` : 'VitalOS Consultation',
      },
      interfaceConfigOverwrite: {
        TOOLBAR_BUTTONS: ['microphone','camera','hangup','chat','tileview','raisehand','fullscreen'],
        SHOW_JITSI_WATERMARK: false,
        SHOW_WATERMARK_FOR_GUESTS: false,
        SHOW_BRAND_WATERMARK: false,
        BRAND_WATERMARK_LINK: '',
        DEFAULT_REMOTE_DISPLAY_NAME: 'Participant',
        SHOW_CHROME_EXTENSION_BANNER: false,
        MOBILE_APP_PROMO: false,
      },
      userInfo: {
        displayName: user?.full_name || user?.email?.split('@')[0] || 'Patient',
        email: user?.email || '',
      },
    })
  }

  function copyLink() {
    const link = `https://meet.jit.si/VitalOS-${roomId}`
    navigator.clipboard?.writeText(link).then(() => alert('Link copied! Share with doctor.'))
  }

  // Fallback iframe URL (if External API script fails to load)
  const fallbackUrl = `https://meet.jit.si/VitalOS-${roomId}#config.prejoinPageEnabled=false&config.startWithAudioMuted=false&config.startWithVideoMuted=false&config.disableModeratorIndicator=true&config.subject=${encodeURIComponent('VitalOS Consultation')}&userInfo.displayName=${encodeURIComponent(user?.full_name || 'Patient')}`

  return (
    <div className="flex flex-col h-screen bg-gray-900">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-800"
        style={{ background:'linear-gradient(135deg,#0f1a15,#0a2018)' }}>
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl flex items-center justify-center"
            style={{ background:'linear-gradient(135deg,#0f6e56,#1d9e75)' }}>
            <Video size={16} className="text-white"/>
          </div>
          <div>
            <p className="text-sm font-bold text-white">
              {apptInfo ? `${apptInfo.doctor_name} · ${apptInfo.doctor_specialty}` : 'VitalOS Consultation'}
            </p>
            <p className="text-xs text-emerald-400 flex items-center gap-1.5">
              <span className="w-2 h-2 bg-emerald-400 rounded-full animate-pulse inline-block"/>
              Live · Room {roomId}
              {apptInfo && <span className="ml-2 text-gray-500">
                📅 {new Date(apptInfo.slot_date+'T00:00:00').toLocaleDateString('en-IN',{day:'numeric',month:'short'})} {apptInfo.slot_time?.slice(0,5)}
              </span>}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={copyLink}
            className="flex items-center gap-1.5 text-xs text-gray-400 hover:text-white border border-gray-700 px-3 py-1.5 rounded-lg">
            <Copy size={12}/> Copy link
          </button>
          <button onClick={() => navigate(-1)}
            className="flex items-center gap-1.5 text-xs text-red-400 border border-red-900 px-3 py-1.5 rounded-lg hover:bg-red-900/30">
            <Phone size={12}/> Leave
          </button>
        </div>
      </div>

      {/* Meeting area */}
      <div className="flex-1 relative bg-black">
        {apiLoaded ? (
          <div ref={containerRef} style={{ width:'100%', height:'100%' }}/>
        ) : (
          // Fallback iframe if External API doesn't load
          <iframe src={fallbackUrl}
            allow="camera; microphone; display-capture; fullscreen; autoplay"
            style={{ width:'100%', height:'100%', border:'none' }}
            title="VitalOS Video Consultation"/>
        )}
      </div>

      <div className="px-4 py-2 border-t border-gray-800 bg-gray-950 text-center">
        <p className="text-[10px] text-gray-600">Powered by Jitsi Meet · End-to-end encrypted · Free</p>
      </div>
    </div>
  )
}
