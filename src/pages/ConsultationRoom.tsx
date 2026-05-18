import { useParams, useNavigate } from 'react-router-dom'
import { useEffect, useState, useRef } from 'react'
import { useAuthStore } from '@/store/authStore'
import { supabase } from '@/lib/supabase'
import { Video, Mic, MicOff, VideoOff, Phone, Users, FileText, Copy } from 'lucide-react'

interface AppointmentInfo {
  doctor_name: string
  doctor_specialty: string
  slot_date: string
  slot_time: string
  notes: string | null
  meeting_link: string
}

export default function ConsultationRoom() {
  const { roomId } = useParams<{ roomId: string }>()
  const { user } = useAuthStore()
  const navigate = useNavigate()
  const iframeRef = useRef<HTMLIFrameElement>(null)
  const [apptInfo, setApptInfo] = useState<AppointmentInfo | null>(null)
  const [joined, setJoined] = useState(false)
  const [participants, setParticipants] = useState(1)

  useEffect(() => {
    if (user && roomId) loadAppointmentInfo()
  }, [user, roomId])

  async function loadAppointmentInfo() {
    if (!user || !roomId) return
    const meetLink = `https://meet.jit.si/VitalOS-${roomId}`
    const { data } = await supabase
      .from('appointments')
      .select('slot_date, slot_time, notes, meeting_link, doctor:doctors(name, specialty)')
      .eq('meeting_link', meetLink)
      .single()

    if (data) {
      const doc = data.doctor as unknown as { name: string; specialty: string }
      setApptInfo({
        doctor_name: doc?.name || 'Doctor',
        doctor_specialty: doc?.specialty || '',
        slot_date: data.slot_date,
        slot_time: data.slot_time,
        notes: data.notes,
        meeting_link: data.meeting_link,
      })
    }
  }

  function copyLink() {
    const link = `https://meet.jit.si/VitalOS-${roomId}`
    navigator.clipboard?.writeText(link)
      .then(() => alert('Meeting link copied! Share with doctor or patient.'))
  }

  // Build Jitsi URL with auto-join config (no moderator wait)
  const jitsiUrl = roomId
    ? `https://meet.jit.si/VitalOS-${roomId}#config.prejoinPageEnabled=false&config.startWithAudioMuted=false&config.startWithVideoMuted=false&config.disableModeratorIndicator=true&config.enableWelcomePage=false&config.enableClosePage=false&userInfo.displayName=${encodeURIComponent(user?.full_name || user?.email || 'Patient')}&interfaceConfig.TOOLBAR_BUTTONS=["microphone","camera","hangup","chat","raisehand","tileview"]&config.startAsSilentAudience=false&config.subject=${encodeURIComponent('VitalOS Consultation')}`
    : ''

  return (
    <div className="flex flex-col h-screen bg-gray-900">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-800"
        style={{ background: 'linear-gradient(135deg,#0f1a15,#0a2018)' }}>
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl flex items-center justify-center"
            style={{ background: 'linear-gradient(135deg,#0f6e56,#1d9e75)' }}>
            <Video size={16} className="text-white"/>
          </div>
          <div>
            {apptInfo ? (
              <>
                <p className="text-sm font-bold text-white">{apptInfo.doctor_name} · {apptInfo.doctor_specialty}</p>
                <p className="text-xs text-emerald-400 flex items-center gap-1">
                  <span className="w-2 h-2 bg-emerald-400 rounded-full animate-pulse inline-block"/>
                  Live · Room {roomId}
                </p>
              </>
            ) : (
              <>
                <p className="text-sm font-bold text-white">VitalOS Consultation</p>
                <p className="text-xs text-emerald-400 flex items-center gap-1">
                  <span className="w-2 h-2 bg-emerald-400 rounded-full animate-pulse inline-block"/>
                  Live · Room {roomId}
                </p>
              </>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={copyLink}
            className="flex items-center gap-1.5 text-xs text-gray-400 hover:text-white border border-gray-700 px-3 py-1.5 rounded-lg">
            <Copy size={12}/> Copy link
          </button>
          {apptInfo && (
            <div className="text-xs text-gray-400 border border-gray-700 px-3 py-1.5 rounded-lg">
              📅 {new Date(apptInfo.slot_date+'T00:00:00').toLocaleDateString('en-IN',{day:'numeric',month:'short'})} · {apptInfo.slot_time?.slice(0,5)}
            </div>
          )}
          <button onClick={() => navigate(-1)}
            className="flex items-center gap-1.5 text-xs text-red-400 border border-red-900 px-3 py-1.5 rounded-lg hover:bg-red-900/30">
            <Phone size={12}/> Leave
          </button>
        </div>
      </div>

      {/* Jitsi iframe — auto-joins without moderator gate */}
      <div className="flex-1 relative">
        <iframe
          ref={iframeRef}
          src={jitsiUrl}
          allow="camera; microphone; display-capture; fullscreen; autoplay"
          style={{ width:'100%', height:'100%', border:'none', background:'#111' }}
          title="VitalOS Video Consultation"
          onLoad={() => setJoined(true)}
        />
      </div>

      {/* Bottom info bar */}
      <div className="px-4 py-2.5 border-t border-gray-800 flex items-center justify-between bg-gray-950">
        <div className="flex items-center gap-3">
          <span className="text-xs text-gray-500 flex items-center gap-1.5">
            <Users size={12}/> {participants} participant{participants>1?'s':''}
          </span>
          {apptInfo?.notes && (
            <span className="text-xs text-gray-500 flex items-center gap-1.5">
              <FileText size={12}/> "{apptInfo.notes}"
            </span>
          )}
        </div>
        <p className="text-[10px] text-gray-600">Powered by Jitsi Meet · End-to-end encrypted</p>
      </div>
    </div>
  )
}
