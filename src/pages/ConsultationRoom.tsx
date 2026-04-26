import { useEffect, useState, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/store/authStore'
import {
  Video, VideoOff, Mic, MicOff, Phone, MessageSquare,
  Users, Clock, Circle, Square, Download, AlertCircle
} from 'lucide-react'

interface AppointmentInfo {
  id: string; slot_date: string; slot_time: string
  notes: string; status: string; meeting_link: string
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

  // Recording state
  const [isRecording, setIsRecording] = useState(false)
  const [recordingTime, setRecordingTime] = useState(0)
  const [recordingBlob, setRecordingBlob] = useState<Blob | null>(null)
  const [showRecordConsent, setShowRecordConsent] = useState(false)
  const [recordingError, setRecordingError] = useState('')
  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const recordingChunks = useRef<Blob[]>([])
  const recordingTimerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const iframeRef = useRef<HTMLIFrameElement>(null)

  useEffect(() => { loadAppointment() }, [roomId])

  useEffect(() => {
    if (!appt) return
    const interval = setInterval(() => {
      const apptTime = new Date(`${appt.slot_date}T${appt.slot_time}`)
      const diff = apptTime.getTime() - Date.now()
      if (diff <= 0) setTimeLeft('In session')
      else {
        const h = Math.floor(diff / 3600000)
        const m = Math.floor((diff % 3600000) / 60000)
        const s = Math.floor((diff % 60000) / 1000)
        setTimeLeft(h > 0 ? `${h}h ${m}m` : m > 0 ? `${m}m ${s}s` : `${s}s`)
      }
    }, 1000)
    return () => clearInterval(interval)
  }, [appt])

  async function loadAppointment() {
    const { data } = await supabase
      .from('appointments')
      .select('*, doctor:doctors(name,specialty,qualifications), profile:profiles(full_name,email)')
      .or(`meeting_link.like.%${roomId}%`)
      .single()
    setAppt(data as unknown as AppointmentInfo)
    setLoading(false)
  }

  // ── Recording ──────────────────────────────────────────────────
  async function startRecording() {
    setRecordingError('')
    try {
      // Capture the entire tab (screen + audio)
      const stream = await navigator.mediaDevices.getDisplayMedia({
        video: { frameRate: 30 },
        audio: true,
      })

      // Also capture microphone
      let micStream: MediaStream | null = null
      try {
        micStream = await navigator.mediaDevices.getUserMedia({ audio: true })
      } catch { /* mic optional */ }

      // Combine streams if we have mic
      let finalStream = stream
      if (micStream) {
        const audioCtx = new AudioContext()
        const dest = audioCtx.createMediaStreamDestination()
        if (stream.getAudioTracks().length > 0) {
          audioCtx.createMediaStreamSource(stream).connect(dest)
        }
        audioCtx.createMediaStreamSource(micStream).connect(dest)
        finalStream = new MediaStream([
          ...stream.getVideoTracks(),
          ...dest.stream.getTracks()
        ])
      }

      recordingChunks.current = []
      const mr = new MediaRecorder(finalStream, {
        mimeType: MediaRecorder.isTypeSupported('video/webm;codecs=vp9,opus')
          ? 'video/webm;codecs=vp9,opus'
          : 'video/webm'
      })

      mr.ondataavailable = e => { if (e.data.size > 0) recordingChunks.current.push(e.data) }
      mr.onstop = () => {
        const blob = new Blob(recordingChunks.current, { type: 'video/webm' })
        setRecordingBlob(blob)
        finalStream.getTracks().forEach(t => t.stop())
        if (micStream) micStream.getTracks().forEach(t => t.stop())
      }

      // Stop recording if user stops screen share
      stream.getVideoTracks()[0].onended = () => stopRecording()

      mr.start(1000) // collect data every second
      mediaRecorderRef.current = mr
      setIsRecording(true)
      setRecordingTime(0)
      recordingTimerRef.current = setInterval(() => {
        setRecordingTime(t => t + 1)
      }, 1000)

    } catch (err) {
      if (err instanceof Error && err.name === 'NotAllowedError') {
        setRecordingError('Screen sharing permission denied. Please allow screen capture to record.')
      } else if (err instanceof Error && err.name === 'NotSupportedError') {
        setRecordingError('Screen recording not supported in this browser. Use Chrome or Edge.')
      } else {
        setRecordingError('Could not start recording. Try Chrome with screen share permission.')
      }
    }
  }

  function stopRecording() {
    if (mediaRecorderRef.current?.state !== 'inactive') {
      mediaRecorderRef.current?.stop()
    }
    if (recordingTimerRef.current) clearInterval(recordingTimerRef.current)
    setIsRecording(false)
  }

  function downloadRecording() {
    if (!recordingBlob) return
    const url = URL.createObjectURL(recordingBlob)
    const a = document.createElement('a')
    a.href = url
    a.download = `VitalOS-Consultation-${appt?.doctor?.name?.replace(/\s/g,'_')}-${new Date().toISOString().split('T')[0]}.webm`
    a.click()
    URL.revokeObjectURL(url)
  }

  function formatRecTime(s: number) {
    const m = Math.floor(s / 60)
    const sec = s % 60
    return `${m.toString().padStart(2,'0')}:${sec.toString().padStart(2,'0')}`
  }

  function sendChat() {
    if (!chatMsg.trim()) return
    setChatLog(prev => [...prev, {
      from: user?.full_name || 'You',
      text: chatMsg.trim(),
      time: new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })
    }])
    setChatMsg('')
  }

  async function endCall() {
    if (isRecording) stopRecording()
    if (appt && confirm('End this consultation?')) {
      await supabase.from('appointments').update({ status: 'completed' }).eq('id', appt.id)
      navigate('/doctors')
    }
  }

  const jitsiRoom = `VitalOS-${roomId}`

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
        <div className="bg-gray-900 border border-gray-800 rounded-2xl p-8 max-w-md w-full">
          <div className="w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4"
            style={{ background: 'linear-gradient(135deg,#0f6e56,#1d9e75)' }}>
            <Video size={28} className="text-white" />
          </div>
          <h1 className="text-xl font-semibold text-white text-center mb-1">
            {appt ? `Consultation with ${appt.doctor?.name}` : 'VitalOS Consultation'}
          </h1>
          {appt && (
            <div className="text-center space-y-1 my-4">
              <p className="text-sm text-teal-400">{appt.doctor?.specialty}</p>
              <p className="text-xs text-gray-500">{appt.doctor?.qualifications}</p>
              <div className="flex items-center justify-center gap-2 mt-2">
                <Clock size={12} className="text-teal-400" />
                <p className="text-sm text-teal-400">
                  {new Date(appt.slot_date + 'T00:00:00').toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' })} · {appt.slot_time?.slice(0,5)}
                  {timeLeft && <span className="ml-2 text-gray-500 text-xs">({timeLeft})</span>}
                </p>
              </div>
            </div>
          )}

          <div className="bg-gray-800 rounded-xl p-4 my-5 space-y-2">
            <p className="text-xs font-semibold text-gray-300 mb-2">Before joining:</p>
            {[
              { ok: true,  label: 'Stable internet connection' },
              { ok: true,  label: 'Camera & microphone ready' },
              { ok: null,  label: 'Quiet environment recommended' },
              { ok: null,  label: 'Lab reports / notes ready' },
            ].map(item => (
              <div key={item.label} className="flex items-center gap-2 text-xs">
                <span className={item.ok === null ? 'text-amber-400' : 'text-green-400'}>{item.ok === null ? '⚠' : '✓'}</span>
                <span className={item.ok === null ? 'text-amber-300' : 'text-gray-300'}>{item.label}</span>
              </div>
            ))}
          </div>

          <div className="bg-gray-800 rounded-xl p-3 mb-5">
            <p className="text-xs font-semibold text-gray-300 mb-1.5 flex items-center gap-1.5">
              <Circle size={10} className="text-red-400" /> Optional: Record consultation
            </p>
            <p className="text-[11px] text-gray-500 leading-relaxed">
              You can record the video call for personal reference. Recording requires screen share permission in your browser. 
              <strong className="text-gray-400"> Always get verbal consent from your doctor before recording.</strong>
            </p>
          </div>

          <div className="flex gap-3">
            <button onClick={() => navigate(-1)} className="flex-1 py-2.5 border border-gray-700 text-gray-400 rounded-xl text-sm hover:bg-gray-800">
              Back
            </button>
            <button onClick={() => setJoined(true)}
              className="flex-1 py-2.5 text-white rounded-xl text-sm font-semibold"
              style={{ background: 'linear-gradient(135deg,#0f6e56,#1d9e75)' }}>
              Join consultation
            </button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="h-screen bg-gray-950 flex flex-col">
      {/* Top bar */}
      <div className="flex items-center justify-between px-4 py-2.5 bg-gray-900 border-b border-gray-800 shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-7 h-7 rounded-lg flex items-center justify-center"
            style={{ background: 'linear-gradient(135deg,#0f6e56,#1d9e75)' }}>
            <Video size={13} className="text-white" />
          </div>
          <div>
            <p className="text-sm font-semibold text-white">
              {appt ? `${appt.doctor?.name} · ${appt.doctor?.specialty}` : 'VitalOS Consultation'}
            </p>
            <p className="text-[10px] text-teal-400 flex items-center gap-1">
              <span className="w-1.5 h-1.5 bg-green-400 rounded-full" />
              Live · Room {roomId}
              {timeLeft && timeLeft !== 'In session' && <span className="text-gray-500 ml-1">{timeLeft}</span>}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <span className="flex items-center gap-1 text-xs text-gray-400 bg-gray-800 px-2 py-1 rounded">
            <Users size={11} /> 2 participants
          </span>

          {/* Recording controls */}
          {!isRecording ? (
            <button onClick={() => setShowRecordConsent(true)}
              className="flex items-center gap-1.5 text-xs text-gray-300 bg-gray-800 hover:bg-gray-700 px-3 py-1.5 rounded-lg border border-gray-700 transition-colors">
              <Circle size={11} className="text-red-400" /> Record
            </button>
          ) : (
            <button onClick={stopRecording}
              className="flex items-center gap-1.5 text-xs text-red-300 bg-red-900/30 px-3 py-1.5 rounded-lg border border-red-800 animate-pulse">
              <Square size={11} className="text-red-400 fill-red-400" />
              {formatRecTime(recordingTime)}
            </button>
          )}

          {recordingBlob && !isRecording && (
            <button onClick={downloadRecording}
              className="flex items-center gap-1.5 text-xs text-green-300 bg-green-900/30 px-3 py-1.5 rounded-lg border border-green-800 hover:bg-green-900/50">
              <Download size={11} /> Save recording
            </button>
          )}

          <button onClick={endCall}
            className="flex items-center gap-1.5 bg-red-600 hover:bg-red-700 text-white text-xs px-3 py-1.5 rounded-lg font-medium">
            <Phone size={12} className="rotate-[135deg]" /> End call
          </button>
        </div>
      </div>

      {/* Recording consent modal */}
      {showRecordConsent && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
          <div className="bg-gray-900 border border-gray-700 rounded-2xl p-6 max-w-sm w-full">
            <div className="flex items-start gap-3 mb-4">
              <AlertCircle size={20} className="text-amber-400 mt-0.5 shrink-0" />
              <div>
                <h3 className="text-sm font-semibold text-white mb-1">Recording consent required</h3>
                <p className="text-xs text-gray-400 leading-relaxed">
                  Before recording, you must inform and get verbal consent from your doctor. 
                  Recording without consent may be illegal in some jurisdictions.
                </p>
              </div>
            </div>
            <div className="bg-gray-800 rounded-lg p-3 mb-4 text-xs text-gray-400">
              <p className="font-medium text-gray-300 mb-1">How recording works:</p>
              <ul className="space-y-1">
                <li>• Your browser will ask you to share your screen</li>
                <li>• Select the browser tab with the video call</li>
                <li>• Recording captures video + audio</li>
                <li>• Saved as .webm file to your device</li>
                <li>• Not uploaded to any server — stays on your device</li>
              </ul>
            </div>
            {recordingError && (
              <div className="bg-red-900/30 border border-red-800 rounded-lg p-2.5 mb-3">
                <p className="text-xs text-red-300">{recordingError}</p>
              </div>
            )}
            <div className="flex gap-3">
              <button onClick={() => { setShowRecordConsent(false); setRecordingError('') }}
                className="flex-1 py-2 border border-gray-700 text-gray-400 rounded-xl text-sm hover:bg-gray-800">
                Cancel
              </button>
              <button onClick={() => { setShowRecordConsent(false); startRecording() }}
                className="flex-1 py-2 text-white rounded-xl text-sm font-semibold"
                style={{ background: 'linear-gradient(135deg,#991b1b,#dc2626)' }}>
                I have consent — Start recording
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="flex flex-1 overflow-hidden">
        {/* Video — Jitsi Meet */}
        <div className="flex-1 relative bg-gray-950">
          <iframe
            ref={iframeRef}
            title="VitalOS Video Consultation"
            src={`https://meet.jit.si/${jitsiRoom}#config.startWithAudioMuted=false&config.startWithVideoMuted=false&config.disableDeepLinking=true&userInfo.displayName=${encodeURIComponent(user?.full_name || 'Patient')}&config.prejoinPageEnabled=false&config.toolbarButtons=["microphone","camera","hangup","chat","raisehand","tileview","fullscreen","settings"]`}
            allow="camera; microphone; fullscreen; display-capture; autoplay"
            className="w-full h-full border-0"
          />

          {/* Recording indicator overlay */}
          {isRecording && (
            <div className="absolute top-4 left-4 flex items-center gap-2 bg-black/70 rounded-full px-3 py-1.5">
              <span className="w-2 h-2 bg-red-500 rounded-full animate-pulse" />
              <span className="text-xs text-white font-medium">REC {formatRecTime(recordingTime)}</span>
            </div>
          )}

          {/* Bottom controls */}
          <div className="absolute bottom-6 left-1/2 -translate-x-1/2 flex items-center gap-3">
            <button onClick={() => setMicOn(m => !m)}
              className={`w-11 h-11 rounded-full flex items-center justify-center transition-colors ${micOn ? 'bg-gray-700 hover:bg-gray-600' : 'bg-red-600'}`}>
              {micOn ? <Mic size={16} className="text-white" /> : <MicOff size={16} className="text-white" />}
            </button>
            <button onClick={() => setCamOn(c => !c)}
              className={`w-11 h-11 rounded-full flex items-center justify-center transition-colors ${camOn ? 'bg-gray-700 hover:bg-gray-600' : 'bg-red-600'}`}>
              {camOn ? <Video size={16} className="text-white" /> : <VideoOff size={16} className="text-white" />}
            </button>
            <button onClick={endCall}
              className="w-12 h-12 rounded-full bg-red-600 hover:bg-red-700 flex items-center justify-center">
              <Phone size={18} className="text-white rotate-[135deg]" />
            </button>
          </div>
        </div>

        {/* Chat + notes sidebar */}
        <div className="w-72 bg-gray-900 border-l border-gray-800 flex flex-col shrink-0">
          <div className="p-3 border-b border-gray-800 flex items-center gap-2">
            <MessageSquare size={13} className="text-gray-400" />
            <span className="text-xs font-semibold text-gray-300">Session notes</span>
          </div>

          {appt && (
            <div className="m-3 p-3 bg-gray-800 rounded-xl text-xs space-y-1">
              <p className="font-semibold text-gray-200">{appt.doctor?.name}</p>
              <p className="text-gray-400">{appt.doctor?.specialty}</p>
              <p className="text-gray-500">
                {new Date(appt.slot_date + 'T00:00:00').toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })} · {appt.slot_time?.slice(0,5)}
              </p>
              {appt.notes && <p className="text-gray-400 italic pt-1 border-t border-gray-700">"{appt.notes}"</p>}
            </div>
          )}

          <div className="flex-1 overflow-y-auto p-3 space-y-2">
            {chatLog.length === 0 && (
              <p className="text-xs text-gray-600 text-center mt-4">Type notes or reminders here</p>
            )}
            {chatLog.map((m, i) => (
              <div key={i} className="text-xs bg-gray-800 rounded-lg p-2.5">
                <div className="flex justify-between mb-0.5">
                  <span className="font-medium text-teal-400">{m.from}</span>
                  <span className="text-gray-600">{m.time}</span>
                </div>
                <p className="text-gray-300">{m.text}</p>
              </div>
            ))}
          </div>

          <div className="p-3 border-t border-gray-800 flex gap-2">
            <input
              className="flex-1 bg-gray-800 border border-gray-700 text-white text-xs rounded-lg px-3 py-2 focus:outline-none focus:border-teal-500"
              value={chatMsg}
              onChange={e => setChatMsg(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && sendChat()}
              placeholder="Add a note..."
            />
            <button onClick={sendChat}
              className="px-3 text-white rounded-lg text-xs font-medium"
              style={{ background: 'linear-gradient(135deg,#0f6e56,#1d9e75)' }}>
              Save
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
