import { useState, useEffect, useRef } from 'react'
import { useAuthStore } from '@/store/authStore'
import { supabase } from '@/lib/supabase'
import { ChevronDown, Check, Plus, User } from 'lucide-react'
import { useNavigate } from 'react-router-dom'

interface FamilyProfile {
  id: string
  name: string
  relation: string
  avatar_color: string | null
  is_elderly: boolean
}

// Global store for which profile is active — persisted to localStorage
export function getActiveProfile(): { id: string; name: string; isSelf: boolean } {
  const saved = localStorage.getItem('vitalos-active-profile')
  if (saved) { try { return JSON.parse(saved) } catch { /* fallthrough */ } }
  return { id: 'self', name: 'Me', isSelf: true }
}

export function setActiveProfile(profile: { id: string; name: string; isSelf: boolean }) {
  localStorage.setItem('vitalos-active-profile', JSON.stringify(profile))
  window.dispatchEvent(new CustomEvent('vitalos-profile-changed', { detail: profile }))
}

export default function ProfileSwitcher() {
  const { user } = useAuthStore()
  const navigate = useNavigate()
  const [open, setOpen] = useState(false)
  const [members, setMembers] = useState<FamilyProfile[]>([])
  const [active, setActive] = useState(getActiveProfile())
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => { if (user) loadMembers() }, [user])

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  async function loadMembers() {
    if (!user) return
    const { data } = await supabase.from('family_members')
      .select('id, name, relation, avatar_color, is_elderly')
      .eq('user_id', user.id).order('created_at', { ascending: false })
    setMembers((data || []) as FamilyProfile[])
  }

  function selectProfile(profile: { id: string; name: string; isSelf: boolean }) {
    setActive(profile)
    setActiveProfile(profile)
    setOpen(false)
  }

  const initials = active.isSelf
    ? (user?.full_name || user?.email || 'U').slice(0, 2).toUpperCase()
    : active.name[0]?.toUpperCase() || 'F'

  return (
    <div className="relative" ref={ref}>
      <button onClick={() => setOpen(o => !o)}
        className="flex items-center gap-2 px-2.5 py-1.5 rounded-xl border border-gray-200 bg-white hover:bg-gray-50 transition-colors">
        <div className="w-6 h-6 rounded-full flex items-center justify-center text-white text-[10px] font-bold shrink-0"
          style={{ background: active.isSelf ? 'linear-gradient(135deg,#0f6e56,#1d9e75)' : '#8b5cf6' }}>
          {initials}
        </div>
        <span className="text-xs font-semibold text-gray-700 max-w-[80px] truncate">{active.name}</span>
        <ChevronDown size={13} className={`text-gray-400 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <div className="absolute top-full mt-2 left-0 w-64 bg-white rounded-2xl shadow-xl border border-gray-100 py-2 z-50">
          <p className="text-[10px] font-bold text-gray-400 uppercase px-3 py-1.5">Viewing health data for</p>

          <button onClick={() => selectProfile({ id: 'self', name: 'Me', isSelf: true })}
            className="w-full flex items-center gap-3 px-3 py-2.5 hover:bg-gray-50 transition-colors">
            <div className="w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-bold shrink-0"
              style={{ background: 'linear-gradient(135deg,#0f6e56,#1d9e75)' }}>
              {(user?.full_name || user?.email || 'U').slice(0, 2).toUpperCase()}
            </div>
            <div className="flex-1 text-left">
              <p className="text-sm font-semibold text-gray-800">{user?.full_name || 'Me'}</p>
              <p className="text-[10px] text-gray-400">Your own profile</p>
            </div>
            {active.isSelf && <Check size={15} className="text-emerald-500 shrink-0" />}
          </button>

          {members.length > 0 && <div className="h-px bg-gray-100 my-1 mx-3" />}

          {members.map(m => (
            <button key={m.id} onClick={() => selectProfile({ id: m.id, name: m.name, isSelf: false })}
              className="w-full flex items-center gap-3 px-3 py-2.5 hover:bg-gray-50 transition-colors">
              <div className="w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-bold shrink-0"
                style={{ background: m.avatar_color || '#8b5cf6' }}>
                {m.name[0]}
              </div>
              <div className="flex-1 text-left">
                <p className="text-sm font-semibold text-gray-800">{m.name}</p>
                <p className="text-[10px] text-gray-400">{m.relation}{m.is_elderly ? ' · Elderly care' : ''}</p>
              </div>
              {active.id === m.id && <Check size={15} className="text-emerald-500 shrink-0" />}
            </button>
          ))}

          <div className="h-px bg-gray-100 my-1 mx-3" />

          <button onClick={() => { setOpen(false); navigate('/family-dashboard') }}
            className="w-full flex items-center gap-3 px-3 py-2.5 hover:bg-gray-50 transition-colors text-teal-600">
            <div className="w-8 h-8 rounded-full border-2 border-dashed border-teal-300 flex items-center justify-center shrink-0">
              <Plus size={14} />
            </div>
            <span className="text-sm font-semibold">Add family member</span>
          </button>
        </div>
      )}
    </div>
  )
}
