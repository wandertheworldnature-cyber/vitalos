import { useParams, useNavigate } from 'react-router-dom'
import { useEffect, useState } from 'react'
import { useAuthStore } from '@/store/authStore'
import { supabase } from '@/lib/supabase'
import { Video, Copy, ExternalLink, Phone, Calendar, Check, AlertTriangle } from 'lucide-react'

interface ApptInfo {
  doctor_name: string
  doctor_specialty: string
  slot_date: string
  slot_time: string
  notes: string | null
}

export default function ConsultationRoom() {
  const { roomId } = useParams<{ roomId: string }>()
  const { user } = useAuthStore()
  const navigate = useNavigate()
  const [apptInfo, setApptInfo] = useState<ApptInfo | null>(null)
  const [copied, setCopied] = useState<string | null>(null)
  const [opened, setOpened] = useState(false)

  // Use direct Jitsi URL (not embedded) — avoids 5-minute embed restriction
  const jitsiUrl = `https://meet.jit.si/VitalOS${roomId}`
  const shareUrl = `${window.location.origin}/consultation/${roomId}`

  useEffect(() => { if (roomId) loadInfo() }, [roomId])

  async function loadInfo() {
    const link = `https://meet.jit.si/VitalOS-${roomId}`
    const { data } = await supabase.from('appointments')
      .select('slot_date,slot_time,notes,doctor:doctors(name,specialty)')
      .eq('meeting_link', link).single()
    if (data) {
      const doc = data.doctor as unknown as { name: string; specialty: string }
      setApptInfo({ doctor_name: doc?.name || 'Doctor', doctor_specialty: doc?.specialty || '', slot_date: data.slot_date, slot_time: data.slot_time, notes: data.notes })
    }
  }

  function openMeeting() {
    window.open(jitsiUrl, '_blank', 'noopener,noreferrer')
    setOpened(true)
  }

  function copy(text: string, label: string) {
    navigator.clipboard?.writeText(text)
    setCopied(label)
    setTimeout(() => setCopied(null), 2500)
  }

  const dateStr = apptInfo
    ? new Date(apptInfo.slot_date + 'T00:00:00').toLocaleDateString('en-IN', { weekday:'short', day:'numeric', month:'long' })
    : ''

  return (
    <div className="min-h-screen flex flex-col"
      style={{ background:'linear-gradient(160deg,#0a1a28 0%,#0f2a1e 100%)' }}>

      {/* Top bar */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-white/10 shrink-0">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl flex items-center justify-center"
            style={{ background:'linear-gradient(135deg,#0f6e56,#1d9e75)' }}>
            <Video size={15} className="text-white"/>
          </div>
          <div>
            <p className="text-sm font-bold text-white leading-tight">VitalOS Consultation</p>
            <p className="text-[10px] text-emerald-400 flex items-center gap-1">
              <span className="w-1.5 h-1.5 bg-emerald-400 rounded-full animate-pulse inline-block"/>
              Room {roomId}
            </p>
          </div>
        </div>
        <button onClick={() => navigate(-1)}
          className="flex items-center gap-1.5 text-xs text-red-400 border border-red-800/50 px-3 py-1.5 rounded-lg hover:bg-red-900/20">
          <Phone size={12} className="rotate-[135deg]"/> Leave
        </button>
      </div>

      {/* Main content — centered, mobile friendly */}
      <div className="flex-1 flex flex-col items-center justify-start px-4 py-6 gap-4 max-w-md mx-auto w-full">

        {/* Doctor card */}
        <div className="w-full rounded-2xl p-5"
          style={{ background:'rgba(15,110,86,0.15)', border:'1px solid rgba(29,158,117,0.3)' }}>
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-2xl flex items-center justify-center text-xl font-black text-white shrink-0"
              style={{ background:'linear-gradient(135deg,#0f6e56,#1d9e75)' }}>
              {apptInfo?.doctor_name.split(' ').slice(-1)[0].slice(0,2) || 'Dr'}
            </div>
            <div className="min-w-0">
              <p className="text-base font-black text-white truncate">
                {apptInfo?.doctor_name || 'Your Doctor'}
              </p>
              <p className="text-sm text-emerald-400 font-medium">
                {apptInfo?.doctor_specialty || 'Specialist'}
              </p>
              {apptInfo && (
                <p className="text-xs text-gray-400 mt-1 flex items-center gap-1">
                  <Calendar size={10}/>
                  {dateStr} · {apptInfo.slot_time?.slice(0,5)}
                </p>
              )}
            </div>
          </div>
          {apptInfo?.notes && (
            <p className="text-xs text-gray-400 mt-3 pt-3 border-t border-white/10 italic">"{apptInfo.notes}"</p>
          )}
        </div>

        {/* How it works */}
        <div className="w-full rounded-xl p-4"
          style={{ background:'rgba(245,158,11,0.08)', border:'1px solid rgba(245,158,11,0.2)' }}>
          <p className="text-xs font-bold text-amber-400 mb-2.5">How to join your video call</p>
          <div className="space-y-2">
            {[
              { n:1, t:'Tap "Join video call" — opens Jitsi in browser' },
              { n:2, t:'You join as moderator (first person = no waiting)' },
              { n:3, t:'Send doctor link below via WhatsApp / SMS' },
              { n:4, t:'Doctor joins — call starts immediately' },
            ].map(s => (
              <div key={s.n} className="flex items-start gap-2.5">
                <span className="w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold text-white shrink-0 mt-0.5"
                  style={{ background:'rgba(245,158,11,0.3)', border:'1px solid rgba(245,158,11,0.4)' }}>
                  {s.n}
                </span>
                <p className="text-xs text-amber-200 leading-relaxed">{s.t}</p>
              </div>
            ))}
          </div>
        </div>

        {/* JOIN BUTTON — big and obvious */}
        <button onClick={openMeeting}
          className="w-full py-4 rounded-2xl font-black text-lg text-white flex items-center justify-center gap-3 transition-all active:scale-95"
          style={{ background:'linear-gradient(135deg,#0f6e56,#1d9e75)', boxShadow:'0 8px 32px rgba(15,110,86,0.5)' }}>
          <Video size={24}/>
          {opened ? 'Rejoin video call' : 'Join video call'}
        </button>

        {opened && (
          <div className="w-full flex items-center gap-2 rounded-xl p-3"
            style={{ background:'rgba(16,185,129,0.1)', border:'1px solid rgba(16,185,129,0.3)' }}>
            <Check size={14} className="text-emerald-400 shrink-0"/>
            <p className="text-xs text-emerald-300">Meeting opened. Come back here to copy links.</p>
          </div>
        )}

        {/* Share links */}
        <div className="w-full space-y-3">
          <p className="text-xs font-bold text-gray-500 uppercase tracking-wider">Share with participants</p>

          {/* Doctor link */}
          <div className="rounded-xl p-3" style={{ background:'rgba(255,255,255,0.04)', border:'1px solid rgba(255,255,255,0.1)' }}>
            <p className="text-[10px] text-gray-400 font-bold mb-2">🩺 Send to doctor (opens directly)</p>
            <div className="flex items-center gap-2">
              <code className="flex-1 text-[11px] text-teal-300 break-all leading-relaxed">{jitsiUrl}</code>
              <div className="flex flex-col gap-1.5 shrink-0">
                <button onClick={() => copy(jitsiUrl, 'doctor')}
                  className="flex items-center gap-1 text-[11px] text-white bg-teal-700 hover:bg-teal-600 px-2.5 py-1.5 rounded-lg transition-colors whitespace-nowrap">
                  {copied==='doctor' ? <><Check size={10}/>Copied!</> : <><Copy size={10}/>Copy</>}
                </button>
                <a href={`https://wa.me/?text=${encodeURIComponent('Join my VitalOS consultation: ' + jitsiUrl)}`}
                  target="_blank" rel="noreferrer"
                  className="flex items-center justify-center gap-1 text-[11px] text-white bg-green-700 hover:bg-green-600 px-2.5 py-1.5 rounded-lg transition-colors whitespace-nowrap">
                  📲 WhatsApp
                </a>
              </div>
            </div>
          </div>

          {/* Patient VitalOS link */}
          <div className="rounded-xl p-3" style={{ background:'rgba(255,255,255,0.04)', border:'1px solid rgba(255,255,255,0.1)' }}>
            <p className="text-[10px] text-gray-400 font-bold mb-2">👤 Share VitalOS consultation page</p>
            <div className="flex items-center gap-2">
              <code className="flex-1 text-[11px] text-blue-300 break-all leading-relaxed">{shareUrl}</code>
              <button onClick={() => copy(shareUrl, 'patient')}
                className="flex items-center gap-1 text-[11px] text-white bg-blue-700 hover:bg-blue-600 px-2.5 py-1.5 rounded-lg transition-colors whitespace-nowrap shrink-0">
                {copied==='patient' ? <><Check size={10}/>Copied!</> : <><Copy size={10}/>Copy</>}
              </button>
            </div>
          </div>
        </div>

        {/* JaaS upgrade notice */}
        <div className="w-full rounded-xl p-4" style={{ background:'rgba(59,130,246,0.08)', border:'1px solid rgba(59,130,246,0.2)' }}>
          <p className="text-xs font-bold text-blue-400 mb-1.5 flex items-center gap-1.5">
            <AlertTriangle size={12}/> Production note
          </p>
          <p className="text-[11px] text-blue-300 leading-relaxed mb-2">
            For unlimited production calls, sign up for <strong>Jitsi as a Service (JaaS)</strong> at 8x8.vc — free tier includes 25 monthly active users. No 5-minute limit.
          </p>
          <a href="https://jaas.8x8.vc" target="_blank" rel="noreferrer"
            className="inline-flex items-center gap-1 text-[11px] text-blue-400 hover:text-blue-300 font-semibold">
            Get free JaaS account <ExternalLink size={10}/>
          </a>
        </div>

        <p className="text-[10px] text-gray-700 text-center pb-4">
          Powered by Jitsi Meet · Free & open source · End-to-end encrypted
        </p>
      </div>
    </div>
  )
}
