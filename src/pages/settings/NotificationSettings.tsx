import { useState, useEffect } from 'react'
import { useAuthStore } from '@/store/authStore'
import { supabase } from '@/lib/supabase'
import { requestNotificationPermission, disableNotifications, isNotificationSupported, getNotificationPermissionStatus } from '@/lib/notifications'
import { Bell, BellOff, Check, Calendar, Flame, Trophy, Heart, AlertCircle } from 'lucide-react'
import toast from 'react-hot-toast'

interface NotifPrefs {
  habit_reminders: boolean
  appointment_reminders: boolean
  challenge_nudges: boolean
  health_alerts: boolean
  weekly_summary: boolean
}

const NOTIF_TYPES: Array<{ key: keyof NotifPrefs; title: string; desc: string; icon: React.ElementType; color: string }> = [
  { key: 'habit_reminders',       title: 'Daily habit reminders',   desc: 'Reminders to log habits, take meds, drink water',      icon: Flame,       color: '#f97316' },
  { key: 'appointment_reminders', title: 'Appointment reminders',   desc: '1 hour before doctor consultations and home visits',   icon: Calendar,    color: '#3b82f6' },
  { key: 'challenge_nudges',      title: 'Challenge nudges',        desc: 'Streak reminders and challenge progress updates',      icon: Trophy,      color: '#8b5cf6' },
  { key: 'health_alerts',         title: 'Health alerts',           desc: 'Critical biomarker changes, AI insights',              icon: AlertCircle, color: '#ef4444' },
  { key: 'weekly_summary',        title: 'Weekly health summary',   desc: 'Your Longevity Score and progress recap every Sunday', icon: Heart,       color: '#0f6e56' },
]

export default function NotificationSettings() {
  const { user } = useAuthStore()
  const [enabled, setEnabled] = useState(false)
  const [permStatus, setPermStatus] = useState<string>('default')
  const [prefs, setPrefs] = useState<NotifPrefs>({
    habit_reminders: true, appointment_reminders: true, challenge_nudges: true, health_alerts: true, weekly_summary: true,
  })
  const [loading, setLoading] = useState(false)
  const supported = isNotificationSupported()

  useEffect(() => {
    setPermStatus(getNotificationPermissionStatus())
    if (user) loadPrefs()
  }, [user])

  async function loadPrefs() {
    if (!user) return
    const { data } = await supabase.from('profiles').select('notification_prefs').eq('id', user.id).single()
    if (data?.notification_prefs) setPrefs(data.notification_prefs as NotifPrefs)
    const { data: tokens } = await supabase.from('push_tokens').select('id').eq('user_id', user.id).limit(1)
    setEnabled((tokens?.length || 0) > 0)
  }

  async function toggleNotifications() {
    if (!user) return
    setLoading(true)
    try {
      if (enabled) {
        await disableNotifications(user.id)
        setEnabled(false)
        toast.success('Notifications turned off')
      } else {
        const granted = await requestNotificationPermission(user.id)
        if (granted) {
          setEnabled(true)
          setPermStatus('granted')
          toast.success('Notifications enabled! 🔔')
        } else {
          toast.error('Permission denied. Enable in browser settings to receive notifications.')
          setPermStatus(getNotificationPermissionStatus())
        }
      }
    } finally { setLoading(false) }
  }

  async function savePrefs() {
    if (!user) return
    await supabase.from('profiles').update({ notification_prefs: prefs }).eq('id', user.id)
    toast.success('Preferences saved')
  }

  function togglePref(key: keyof NotifPrefs) {
    setPrefs(p => ({ ...p, [key]: !p[key] }))
  }

  return (
    <div className="p-4 pb-8 max-w-2xl mx-auto space-y-4">
      <div className="card !p-5" style={{ background: 'linear-gradient(135deg,#1c0533,#2d0a4e)', borderColor: '#7c3aed' }}>
        <div className="flex items-start gap-3">
          <div className="w-12 h-12 rounded-xl flex items-center justify-center shrink-0" style={{ background: 'rgba(139,92,246,0.2)' }}>
            {enabled ? <Bell size={24} className="text-purple-400" /> : <BellOff size={24} className="text-purple-400" />}
          </div>
          <div>
            <h1 className="text-lg font-bold text-white mb-1">Notifications</h1>
            <p className="text-sm text-purple-300">Stay on top of your health with timely reminders — never spammy, always useful.</p>
          </div>
        </div>
      </div>

      {!supported && (
        <div className="card !p-4 bg-amber-50 border-amber-100">
          <p className="text-xs text-amber-700">Push notifications aren't supported on this browser/device. Try Chrome or add VitalOS to your home screen.</p>
        </div>
      )}

      {supported && (
        <div className="card !p-5">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-bold text-gray-900">Push notifications</p>
              <p className="text-xs text-gray-400">{enabled ? 'Enabled on this device' : permStatus === 'denied' ? 'Blocked — enable in browser settings' : 'Get reminders even when app is closed'}</p>
            </div>
            <button onClick={toggleNotifications} disabled={loading || permStatus === 'denied'}
              className={`w-12 h-7 rounded-full shrink-0 transition-colors relative disabled:opacity-40 ${enabled ? 'bg-emerald-500' : 'bg-gray-200'}`}>
              <div className="w-6 h-6 bg-white rounded-full absolute top-0.5 transition-all shadow-sm" style={{ left: enabled ? '22px' : '2px' }} />
            </button>
          </div>
        </div>
      )}

      {enabled && (
        <div className="space-y-3">
          <p className="text-xs font-bold text-gray-500 uppercase tracking-wider px-1">What to notify me about</p>
          {NOTIF_TYPES.map(n => {
            const Icon = n.icon
            return (
              <div key={n.key} className="card !p-4">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0" style={{ background: `${n.color}15` }}>
                    <Icon size={16} style={{ color: n.color }} />
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-semibold text-gray-800">{n.title}</p>
                    <p className="text-xs text-gray-400">{n.desc}</p>
                  </div>
                  <button onClick={() => togglePref(n.key)}
                    className={`w-10 h-6 rounded-full shrink-0 transition-colors relative ${prefs[n.key] ? 'bg-emerald-500' : 'bg-gray-200'}`}>
                    <div className="w-5 h-5 bg-white rounded-full absolute top-0.5 transition-all shadow-sm" style={{ left: prefs[n.key] ? '18px' : '2px' }} />
                  </button>
                </div>
              </div>
            )
          })}
          <button onClick={savePrefs} className="btn-primary w-full py-3 flex items-center justify-center gap-2">
            <Check size={15} /> Save preferences
          </button>
        </div>
      )}
    </div>
  )
}
