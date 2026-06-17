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
  meeting_link: string | null
}

export default function ConsultationRoom() {
  const { roomId } = useParams<{ roomId: string }>()
  const { user } = useAuthStore()
  const navigate = useNavigate()
  const [apptInfo, setApptInfo] = useState<ApptInfo | null>(null)
  const [copied, setCopied] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  // Generate a stable Google Meet-style room link from roomId
  // We use a hash of the roomId to create a consistent 3-part meet code
  const getRoomCode = (id: string) => {
    const clean = id.replace(/[^a-zA-Z0-9]/g, '').toLowerCase()
    const p1 = clean.slice(0, 3) || 'abc'
    const p2 = clean.slice(3, 7) || 'defg'
    const p3 = clean.slice(7, 10) || 'hij'
    return `${p1}-${p2}-${p3}`
  }
  const meetCode = getRoomCode(roomId || '')
  const meetUrl = `https://meet.google.com/${meetCode}`
  const consultationUrl = `${window.location.origin}/consultation/${roomId}`

  useEffect(() => { if (roomId) loadInfo() }, [roomId])

  async function loadInfo() {
    setLoading(true)
    // Try to find appointment by any meeting link format
    const { data } = await supabase.from('appointments')
      .select('slot_date,slot_time,meeting_link,doctor:doctors(name,specialty,hospital)')
      .or(`meeting_link.eq.https://meet.jit.si/VitalOS-${roomId},meeting_link.like.%${roomId}%`)
      .maybeSingle()
    if (data) {
      const doc = data.doctor as unknown as { name: string; specialty: string; hospital: string }
      setApptInfo({
        doctor_name: doc?.name || 'Doctor',
        doctor_specialty: doc?.specialty || '',
        slot_date: data.slot_date,
        slot_time: data.slot_time,
        meeting_link: data.meeting_link,
      })
    }
    setLoading(false)
  }

  function copy(text: string, label: string) {
    navigator.clipboard?.writeText(text)
    setCopied(label)
    setTimeout(() => setCopied(null), 2500)
  }

  function whatsapp() {
    const msg = `Join my VitalOS video consultation 🎥\n\nI'm starting the Google Meet now — click to join:\n${meetUrl}\n\nNo account needed to join!`
    window.open(`https://wa.me/?text=${encodeURIComponent(msg)}`, '_blank')
  }

  function openMeet() {
    window.open(meetUrl, '_blank', 'noopener,noreferrer')
  }

  const dateStr = apptInfo
    ? new Date(apptInfo.slot_date + 'T00:00:00').toLocaleDateString('en-IN', {
        weekday: 'short', day: 'numeric', month: 'long'
      })
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
              Room {roomId}
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
                <p className="text-xs text-gray-400 mt-1 flex items-center gap-1">
                  <Calendar size={10} /> {dateStr} · {apptInfo.slot_time?.slice(0, 5)}
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Google Meet CTA */}
        <div className="w-full rounded-2xl p-5"
          style={{ background: 'rgba(66,133,244,0.1)', border: '1px solid rgba(66,133,244,0.25)' }}>
          <div className="flex items-center gap-3 mb-3">
            <span className="text-2xl">🎥</span>
            <div>
              <p className="text-sm font-bold text-white">Google Meet</p>
              <p className="text-xs text-blue-300">Free · No time limit for 1:1 calls · No account needed to join</p>
            </div>
          </div>
          <p className="text-xs text-gray-400 mb-4 leading-relaxed">
            You start the meeting. Share the link with your doctor — they join with one click, no Google account needed.
          </p>
          <button onClick={openMeet}
            className="w-full py-3.5 rounded-xl font-bold text-base text-white flex items-center justify-center gap-2 mb-3"
            style={{ background: 'linear-gradient(135deg,#1a73e8,#4285f4)', boxShadow: '0 6px 24px rgba(66,133,244,0.4)' }}>
            <ExternalLink size={18} /> Start Google Meet
          </button>
          <p className="text-[11px] text-gray-500 text-center">Opens in new tab — you become the host automatically</p>
        </div>

        {/* Share links */}
        <div className="w-full space-y-3">
          <p className="text-xs font-bold text-gray-500 uppercase tracking-wider">Share with doctor</p>

          {/* Google Meet link */}
          <div className="rounded-xl p-3"
            style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.1)' }}>
            <p className="text-[10px] text-gray-400 font-bold mb-2">🩺 Google Meet link (share this)</p>
            <div className="flex items-center gap-2">
              <code className="flex-1 text-[11px] text-blue-300 break-all leading-relaxed">{meetUrl}</code>
              <div className="flex flex-col gap-1.5 shrink-0">
                <button onClick={() => copy(meetUrl, 'meet')}
                  className="flex items-center gap-1 text-[11px] text-white bg-blue-700 hover:bg-blue-600 px-2.5 py-1.5 rounded-lg">
                  {copied === 'meet' ? <><Check size={10} />Copied</> : <><Copy size={10} />Copy</>}
                </button>
                <button onClick={whatsapp}
                  className="flex items-center justify-center text-[11px] text-white bg-green-700 px-2.5 py-1.5 rounded-lg">
                  📲 WhatsApp
                </button>
              </div>
            </div>
          </div>

          {/* VitalOS link */}
          <div className="rounded-xl p-3"
            style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.1)' }}>
            <p className="text-[10px] text-gray-400 font-bold mb-2">🔗 VitalOS consultation page</p>
            <div className="flex items-center gap-2">
              <code className="flex-1 text-[11px] text-teal-300 break-all">{consultationUrl}</code>
              <button onClick={() => copy(consultationUrl, 'vitalos')}
                className="flex items-center gap-1 text-[11px] text-white bg-teal-700 px-2.5 py-1.5 rounded-lg shrink-0">
                {copied === 'vitalos' ? <><Check size={10} />Copied</> : <><Copy size={10} />Copy</>}
              </button>
            </div>
          </div>
        </div>

        {/* How it works */}
        <div className="w-full rounded-xl p-4"
          style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.06)' }}>
          <p className="text-xs font-bold text-gray-400 mb-3">How it works</p>
          {[
            ['1', 'Click "Start Google Meet" — you become host'],
            ['2', 'Copy the Meet link and send to doctor via WhatsApp'],
            ['3', 'Doctor clicks link — joins instantly, no Google login needed'],
            ['4', 'Start your consultation!'],
          ].map(([n, t]) => (
            <div key={n} className="flex items-start gap-2.5 mb-2 last:mb-0">
              <span className="w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold text-white shrink-0"
                style={{ background: 'rgba(255,255,255,0.1)' }}>{n}</span>
              <p className="text-xs text-gray-400">{t}</p>
            </div>
          ))}
        </div>

        <p className="text-[10px] text-gray-600 text-center pb-4">
          Google Meet · Free unlimited 1:1 calls · No time limit · Works on all devices
        </p>
      </div>
    </div>
  )
}
