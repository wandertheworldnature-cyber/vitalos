import { useParams, useNavigate } from 'react-router-dom'
import { useEffect, useRef, useState } from 'react'
import { useAuthStore } from '@/store/authStore'
import { supabase } from '@/lib/supabase'
import { Copy, Phone, Video } from 'lucide-react'

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
  const jitsiRef = useRef<HTMLDivElement>(null)
  const apiRef = useRef<{dispose:()=>void}|null>(null)
  const [apptInfo, setApptInfo] = useState<ApptInfo|null>(null)
  const [status, setStatus] = useState<'loading'|'ready'|'error'>('loading')

  useEffect(() => {
    if (roomId) { loadInfo(); initJitsi() }
    return () => { apiRef.current?.dispose() }
  }, [roomId])

  async function loadInfo() {
    if (!roomId) return
    const link = `https://meet.jit.si/VitalOS-${roomId}`
    const { data } = await supabase.from('appointments')
      .select('slot_date,slot_time,doctor:doctors(name,specialty)')
      .eq('meeting_link', link).single()
    if (data) {
      const doc = data.doctor as unknown as { name:string; specialty:string }
      setApptInfo({ doctor_name:doc?.name||'Doctor', doctor_specialty:doc?.specialty||'', slot_date:data.slot_date, slot_time:data.slot_time })
    }
  }

  function initJitsi() {
    // Load Jitsi External API script
    const existing = document.getElementById('jitsi-script')
    if (existing) { startMeeting(); return }

    const script = document.createElement('script')
    script.id = 'jitsi-script'
    script.src = 'https://meet.jit.si/external_api.js'
    script.async = true
    script.onload = () => startMeeting()
    script.onerror = () => setStatus('error')
    document.head.appendChild(script)
  }

  function startMeeting() {
    if (!jitsiRef.current || !roomId) return
    // @ts-ignore
    if (!window.JitsiMeetExternalAPI) { setStatus('error'); return }

    apiRef.current?.dispose()

    // @ts-ignore
    const api = new window.JitsiMeetExternalAPI('meet.jit.si', {
      roomName: `VitalOS${roomId}`,   // No dash/spaces in room name — prevents moderator gate
      parentNode: jitsiRef.current,
      width: '100%',
      height: '100%',
      configOverwrite: {
        prejoinPageEnabled: false,
        startWithAudioMuted: false,
        startWithVideoMuted: false,
        disableModeratorIndicator: true,
        enableWelcomePage: false,
        enableClosePage: false,
        disableDeepLinking: true,
        disableInviteFunctions: true,
        doNotStoreRoom: true,
        // These two settings remove the moderator/lobby restriction
        lobby: { autoKnock: false, enableChat: false },
        hideLobbyButton: true,
      },
      interfaceConfigOverwrite: {
        SHOW_JITSI_WATERMARK: false,
        SHOW_WATERMARK_FOR_GUESTS: false,
        SHOW_BRAND_WATERMARK: false,
        SHOW_CHROME_EXTENSION_BANNER: false,
        MOBILE_APP_PROMO: false,
        TOOLBAR_BUTTONS: ['microphone','camera','hangup','chat','tileview','raisehand','fullscreen'],
        DEFAULT_REMOTE_DISPLAY_NAME: 'Participant',
      },
      userInfo: {
        displayName: user?.full_name || user?.email?.split('@')[0] || 'Patient',
        email: user?.email || '',
      },
    })

    api.addEventListener('videoConferenceJoined', () => setStatus('ready'))
    api.addEventListener('readyToClose', () => navigate(-1))
    apiRef.current = api
  }

  function copyLink() {
    const link = `https://vitalos-six.vercel.app/consultation/${roomId}`
    navigator.clipboard?.writeText(link)
      .then(() => alert('Consultation link copied!\n\nShare this with your doctor:\n' + link))
  }

  return (
    <div className="flex flex-col h-screen bg-gray-900">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-800 shrink-0"
        style={{ background:'linear-gradient(135deg,#0f1a15,#0a2018)' }}>
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0"
            style={{ background:'linear-gradient(135deg,#0f6e56,#1d9e75)' }}>
            <Video size={16} className="text-white"/>
          </div>
          <div>
            <p className="text-sm font-bold text-white">
              {apptInfo ? `${apptInfo.doctor_name} · ${apptInfo.doctor_specialty}` : 'VitalOS Consultation'}
            </p>
            <p className="text-xs flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full animate-pulse inline-block"
                style={{ background: status==='ready'?'#10b981':'#f59e0b' }}/>
              <span style={{ color: status==='ready'?'#10b981':'#9ca3af' }}>
                {status==='loading'?'Connecting...':status==='ready'?'Live':'Connection issue'} · Room {roomId}
              </span>
              {apptInfo && (
                <span className="text-gray-500 ml-2">
                  📅 {new Date(apptInfo.slot_date+'T00:00:00').toLocaleDateString('en-IN',{day:'numeric',month:'short'})} {apptInfo.slot_time?.slice(0,5)}
                </span>
              )}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={copyLink}
            className="flex items-center gap-1.5 text-xs text-gray-400 hover:text-white border border-gray-700 px-3 py-1.5 rounded-lg transition-colors">
            <Copy size={12}/> Share link
          </button>
          <button onClick={() => navigate(-1)}
            className="flex items-center gap-1.5 text-xs text-red-400 border border-red-900 px-3 py-1.5 rounded-lg hover:bg-red-900/30 transition-colors">
            <Phone size={12}/> Leave
          </button>
        </div>
      </div>

      {/* Jitsi container */}
      <div className="flex-1 relative bg-black overflow-hidden">
        {status === 'error' ? (
          /* Fallback if Jitsi script fails */
          <div className="flex flex-col items-center justify-center h-full gap-4 p-6 text-center">
            <div className="text-4xl">📹</div>
            <p className="text-white font-semibold">Video consultation ready</p>
            <p className="text-gray-400 text-sm">Click below to open the meeting in a new tab</p>
            <a href={`https://meet.jit.si/VitalOS${roomId}`} target="_blank" rel="noreferrer"
              className="px-6 py-3 rounded-xl text-white font-bold text-sm"
              style={{ background:'linear-gradient(135deg,#0f6e56,#1d9e75)' }}>
              Open meeting room →
            </a>
            <p className="text-xs text-gray-500 mt-2">
              Room: <span className="text-teal-400 font-mono">VitalOS{roomId}</span>
            </p>
          </div>
        ) : (
          <div ref={jitsiRef} style={{ width:'100%', height:'100%' }}/>
        )}
      </div>

      <div className="px-4 py-2 border-t border-gray-800 bg-gray-950 text-center shrink-0">
        <p className="text-[10px] text-gray-600">
          Powered by Jitsi Meet · End-to-end encrypted · Free ·
          Direct link: <span className="text-teal-600 font-mono text-[9px]">meet.jit.si/VitalOS{roomId}</span>
        </p>
      </div>
    </div>
  )
}
