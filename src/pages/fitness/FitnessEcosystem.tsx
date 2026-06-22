import { useState, useEffect } from 'react'
import { useAuthStore } from '@/store/authStore'
import { supabase } from '@/lib/supabase'
import { Activity, Zap, TrendingUp, Award, Plus, Check, Flame, Target, Calendar, ChevronRight } from 'lucide-react'
import toast from 'react-hot-toast'

interface WorkoutLog {
  id: string
  type: string
  duration: number
  intensity: number
  calories: number
  notes: string
  date: string
  readiness_before: number
  feeling_after: number
}

interface FitnessStats {
  weeklyWorkouts: number
  totalMinutes: number
  avgIntensity: number
  streak: number
  readinessToday: 'high' | 'moderate' | 'low' | 'rest'
  recommendation: string
  injuryRisk: 'low' | 'moderate' | 'high'
}

const WORKOUT_TYPES = [
  { key: 'strength',   label: 'Strength',    icon: '🏋️', color: '#8b5cf6', calories: 6 },
  { key: 'cardio',     label: 'Cardio',      icon: '🏃', color: '#ef4444', calories: 8 },
  { key: 'yoga',       label: 'Yoga',        icon: '🧘', color: '#10b981', calories: 3 },
  { key: 'hiit',       label: 'HIIT',        icon: '⚡', color: '#f59e0b', calories: 10 },
  { key: 'walk',       label: 'Walk',        icon: '🚶', color: '#3b82f6', calories: 4 },
  { key: 'swim',       label: 'Swim',        icon: '🏊', color: '#06b6d4', calories: 7 },
  { key: 'cycling',    label: 'Cycling',     icon: '🚴', color: '#f97316', calories: 7 },
  { key: 'sports',     label: 'Sports',      icon: '⚽', color: '#84cc16', calories: 6 },
]

const READINESS_CONFIG = {
  high:     { color: '#10b981', label: 'High readiness',     emoji: '🔥', bg: 'bg-emerald-50', border: 'border-emerald-100' },
  moderate: { color: '#3b82f6', label: 'Good readiness',     emoji: '💪', bg: 'bg-blue-50',    border: 'border-blue-100'    },
  low:      { color: '#f59e0b', label: 'Low readiness',      emoji: '⚠️', bg: 'bg-amber-50',   border: 'border-amber-100'   },
  rest:     { color: '#ef4444', label: 'Rest day needed',    emoji: '😴', bg: 'bg-red-50',     border: 'border-red-100'     },
}

function calcFitnessStats(logs: WorkoutLog[]): FitnessStats {
  const week = logs.filter(l => new Date(l.date) >= new Date(Date.now() - 7 * 86400000))
  const weeklyWorkouts = week.length
  const totalMinutes = week.reduce((a, b) => a + b.duration, 0)
  const avgIntensity = week.length ? +(week.reduce((a, b) => a + b.intensity, 0) / week.length).toFixed(1) : 0

  // Streak
  let streak = 0
  const today = new Date().toISOString().split('T')[0]
  const dates = [...new Set(logs.map(l => l.date))].sort().reverse()
  for (let i = 0; i < dates.length; i++) {
    const expected = new Date(Date.now() - i * 86400000).toISOString().split('T')[0]
    if (dates[i] === expected) streak++
    else break
  }

  // Readiness based on recent load
  const last2Days = logs.filter(l => new Date(l.date) >= new Date(Date.now() - 2 * 86400000))
  const recentLoad = last2Days.reduce((a, b) => a + b.intensity * b.duration, 0)
  let readinessToday: FitnessStats['readinessToday'] = 'high'
  let recommendation = 'You\'re well rested. Great day for intense training!'
  let injuryRisk: FitnessStats['injuryRisk'] = 'low'

  if (recentLoad > 200) {
    readinessToday = 'rest'
    recommendation = 'Heavy training detected in last 48h. Take a full rest or light stretch only.'
    injuryRisk = 'high'
  } else if (recentLoad > 100) {
    readinessToday = 'low'
    recommendation = 'Moderate fatigue. Light cardio or yoga recommended — avoid heavy lifting.'
    injuryRisk = 'moderate'
  } else if (weeklyWorkouts >= 4) {
    readinessToday = 'moderate'
    recommendation = 'Good week so far. Moderate intensity training recommended today.'
  }

  return { weeklyWorkouts, totalMinutes, avgIntensity, streak, readinessToday, recommendation, injuryRisk }
}

export default function FitnessEcosystem() {
  const { user } = useAuthStore()
  const [logs, setLogs] = useState<WorkoutLog[]>([])
  const [stats, setStats] = useState<FitnessStats | null>(null)
  const [tab, setTab] = useState<'today' | 'log' | 'history'>('today')
  const [form, setForm] = useState({ type: 'strength', duration: 45, intensity: 7, notes: '', readiness_before: 7, feeling_after: 7 })
  const [saving, setSaving] = useState(false)
  const [loading, setLoading] = useState(true)

  useEffect(() => { if (user) load() }, [user])
  useEffect(() => { if (logs.length >= 0) setStats(calcFitnessStats(logs)) }, [logs])

  async function load() {
    if (!user) return
    setLoading(true)
    const { data } = await supabase.from('health_records')
      .select('id,value,unit,recorded_at,metadata,test_name')
      .eq('user_id', user.id).eq('record_type', 'fitness')
      .order('recorded_at', { ascending: false }).limit(50)
    setLogs((data || []).map((r: Record<string,unknown>) => ({
      id: r.id as string,
      type: (r.metadata as Record<string,unknown>)?.workout_type as string || 'other',
      duration: r.value as number,
      intensity: (r.metadata as Record<string,unknown>)?.intensity as number || 5,
      calories: (r.metadata as Record<string,unknown>)?.calories as number || 0,
      notes: (r.metadata as Record<string,unknown>)?.notes as string || '',
      date: (r.recorded_at as string).split('T')[0],
      readiness_before: (r.metadata as Record<string,unknown>)?.readiness_before as number || 5,
      feeling_after: (r.metadata as Record<string,unknown>)?.feeling_after as number || 5,
    })))
    setLoading(false)
  }

  async function logWorkout() {
    if (!user) return
    setSaving(true)
    try {
      const wt = WORKOUT_TYPES.find(w => w.key === form.type)
      const calories = Math.round(wt ? wt.calories * form.duration : 5 * form.duration)
      await supabase.from('health_records').insert({
        user_id: user.id, record_type: 'fitness', test_name: 'Workout',
        value: form.duration, unit: 'minutes', source: 'manual',
        recorded_at: new Date().toISOString(),
        metadata: { workout_type: form.type, intensity: form.intensity, calories, notes: form.notes, readiness_before: form.readiness_before, feeling_after: form.feeling_after }
      })
      toast.success(`✅ ${wt?.label || 'Workout'} logged! ${calories} kcal burned`)
      setForm({ type: 'strength', duration: 45, intensity: 7, notes: '', readiness_before: 7, feeling_after: 7 })
      load(); setTab('today')
    } finally { setSaving(false) }
  }

  const wt = WORKOUT_TYPES.find(w => w.key === form.type)
  const estCalories = Math.round((wt?.calories || 5) * form.duration)
  const rcfg = stats ? READINESS_CONFIG[stats.readinessToday] : null

  return (
    <div className="p-4 pb-8 max-w-2xl mx-auto space-y-4">
      {/* Header */}
      <div className="card !p-5" style={{ background: 'linear-gradient(135deg,#1c0533,#2d0a4e)', borderColor: '#7c3aed' }}>
        <div className="flex items-start gap-3">
          <div className="w-12 h-12 rounded-xl flex items-center justify-center shrink-0" style={{ background: 'rgba(139,92,246,0.2)' }}>
            <Activity size={24} className="text-purple-400" />
          </div>
          <div>
            <div className="flex items-center gap-2 mb-1">
              <h1 className="text-lg font-bold text-white">Fitness & Recovery</h1>
              <span className="text-[10px] bg-purple-900 text-purple-300 border border-purple-700 px-2 py-0.5 rounded-full font-bold">Ecosystem</span>
            </div>
            <p className="text-sm text-purple-300">Track workouts, monitor recovery, predict injury risk, get AI-powered readiness score every day.</p>
          </div>
        </div>
        {stats && (
          <div className="mt-4 grid grid-cols-4 gap-2">
            {[
              { l: 'This week', v: `${stats.weeklyWorkouts}x`, c: '#a78bfa' },
              { l: 'Minutes',   v: stats.totalMinutes,          c: '#f59e0b' },
              { l: 'Streak',    v: `${stats.streak}d 🔥`,       c: '#ef4444' },
              { l: 'Avg intensity', v: `${stats.avgIntensity}/10`, c: '#10b981' },
            ].map(s => (
              <div key={s.l} className="rounded-lg p-2 text-center" style={{ background: `${s.c}20`, border: `1px solid ${s.c}30` }}>
                <div className="text-base font-black" style={{ color: s.c }}>{s.v}</div>
                <div className="text-[9px] text-gray-400">{s.l}</div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-gray-100 rounded-xl p-1">
        {(['today', 'log', 'history'] as const).map(t => (
          <button key={t} onClick={() => setTab(t)}
            className={`flex-1 text-xs py-2 rounded-lg font-semibold transition-all ${tab === t ? 'bg-white shadow-sm text-gray-900' : 'text-gray-500'}`}>
            {t === 'today' ? '📊 Readiness' : t === 'log' ? '➕ Log workout' : '📅 History'}
          </button>
        ))}
      </div>

      {/* TODAY - Readiness */}
      {tab === 'today' && stats && rcfg && (
        <div className="space-y-4">
          <div className={`card !p-5 border ${rcfg.bg} ${rcfg.border}`}>
            <div className="flex items-center gap-4 mb-4">
              <div className="text-5xl">{rcfg.emoji}</div>
              <div>
                <p className="text-xl font-black text-gray-900">{rcfg.label}</p>
                <p className="text-sm text-gray-600 mt-1">{stats.recommendation}</p>
                <div className="flex gap-2 mt-2">
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full text-white" style={{ background: rcfg.color }}>
                    Injury risk: {stats.injuryRisk}
                  </span>
                  {stats.streak > 0 && <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-orange-100 text-orange-700">{stats.streak} day streak 🔥</span>}
                </div>
              </div>
            </div>

            {/* Recommended workouts for today */}
            <div>
              <p className="text-xs font-bold text-gray-600 mb-2">Recommended for today:</p>
              <div className="grid grid-cols-2 gap-2">
                {WORKOUT_TYPES
                  .filter(w => stats.readinessToday === 'high' ? ['strength','hiit','cardio'].includes(w.key) :
                               stats.readinessToday === 'moderate' ? ['cardio','cycling','sports'].includes(w.key) :
                               ['yoga','walk'].includes(w.key))
                  .slice(0, 4)
                  .map(w => (
                    <button key={w.key} onClick={() => { setForm(p => ({ ...p, type: w.key })); setTab('log') }}
                      className="flex items-center gap-2 p-2.5 bg-white rounded-xl border border-gray-100 hover:shadow-sm transition-all">
                      <span className="text-lg">{w.icon}</span>
                      <div className="text-left">
                        <p className="text-xs font-bold text-gray-800">{w.label}</p>
                        <p className="text-[10px] text-gray-400">{w.calories} kcal/min</p>
                      </div>
                      <ChevronRight size={12} className="text-gray-300 ml-auto" />
                    </button>
                  ))}
              </div>
            </div>
          </div>

          {/* Weekly progress */}
          {logs.length > 0 && (
            <div className="card !p-4">
              <p className="text-sm font-bold text-gray-800 mb-3">Last 7 days</p>
              <div className="flex items-end gap-2 h-16">
                {Array.from({ length: 7 }, (_, i) => {
                  const date = new Date(Date.now() - (6 - i) * 86400000).toISOString().split('T')[0]
                  const dayLogs = logs.filter(l => l.date === date)
                  const totalDur = dayLogs.reduce((a, b) => a + b.duration, 0)
                  const hasWorkout = dayLogs.length > 0
                  return (
                    <div key={i} className="flex-1 flex flex-col items-center gap-1">
                      <div className="w-full rounded-t-lg transition-all" style={{ height: `${Math.max(4, (totalDur / 90) * 56)}px`, background: hasWorkout ? '#8b5cf6' : '#e5e7eb', minHeight: 4 }} />
                      <span className="text-[9px] text-gray-400">{new Date(date + 'T00:00:00').toLocaleDateString('en-IN', { weekday: 'short' }).slice(0, 2)}</span>
                      {hasWorkout && <span className="text-[8px] text-purple-600 font-bold">{totalDur}m</span>}
                    </div>
                  )
                })}
              </div>
            </div>
          )}
        </div>
      )}

      {/* LOG WORKOUT */}
      {tab === 'log' && (
        <div className="card !p-5 space-y-4">
          <p className="text-sm font-bold text-gray-800">Log a workout</p>

          {/* Workout type */}
          <div>
            <label className="text-xs text-gray-500 mb-2 block">Workout type</label>
            <div className="grid grid-cols-4 gap-2">
              {WORKOUT_TYPES.map(w => (
                <button key={w.key} onClick={() => setForm(p => ({ ...p, type: w.key }))}
                  className={`p-2.5 rounded-xl border text-center transition-all ${form.type === w.key ? 'text-white border-transparent' : 'border-gray-200 bg-gray-50'}`}
                  style={form.type === w.key ? { background: w.color } : {}}>
                  <div className="text-xl mb-0.5">{w.icon}</div>
                  <div className="text-[10px] font-semibold">{w.label}</div>
                </button>
              ))}
            </div>
          </div>

          {/* Duration */}
          <div>
            <div className="flex justify-between mb-1">
              <label className="text-xs text-gray-500">⏱ Duration</label>
              <span className="text-sm font-bold text-gray-900">{form.duration} min · ~{estCalories} kcal</span>
            </div>
            <input type="range" min="10" max="120" step="5" value={form.duration}
              onChange={e => setForm(p => ({ ...p, duration: +e.target.value }))}
              className="w-full h-2 rounded-full appearance-none cursor-pointer"
              style={{ background: `linear-gradient(90deg,#8b5cf6 ${(form.duration - 10) / 110 * 100}%,#e5e7eb ${(form.duration - 10) / 110 * 100}%)` }} />
          </div>

          {/* Intensity */}
          <div>
            <div className="flex justify-between mb-1">
              <label className="text-xs text-gray-500">🔥 Intensity</label>
              <span className="text-sm font-bold text-gray-900">{form.intensity}/10</span>
            </div>
            <input type="range" min="1" max="10" value={form.intensity}
              onChange={e => setForm(p => ({ ...p, intensity: +e.target.value }))}
              className="w-full h-2 rounded-full appearance-none cursor-pointer"
              style={{ background: `linear-gradient(90deg,#ef4444 ${(form.intensity - 1) / 9 * 100}%,#e5e7eb ${(form.intensity - 1) / 9 * 100}%)` }} />
          </div>

          {/* Readiness before & feeling after */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <div className="flex justify-between mb-1">
                <label className="text-xs text-gray-500">Readiness before</label>
                <span className="text-xs font-bold">{form.readiness_before}/10</span>
              </div>
              <input type="range" min="1" max="10" value={form.readiness_before}
                onChange={e => setForm(p => ({ ...p, readiness_before: +e.target.value }))}
                className="w-full h-1.5 rounded-full appearance-none cursor-pointer"
                style={{ background: `linear-gradient(90deg,#10b981 ${(form.readiness_before - 1) / 9 * 100}%,#e5e7eb ${(form.readiness_before - 1) / 9 * 100}%)` }} />
            </div>
            <div>
              <div className="flex justify-between mb-1">
                <label className="text-xs text-gray-500">Feeling after</label>
                <span className="text-xs font-bold">{form.feeling_after}/10</span>
              </div>
              <input type="range" min="1" max="10" value={form.feeling_after}
                onChange={e => setForm(p => ({ ...p, feeling_after: +e.target.value }))}
                className="w-full h-1.5 rounded-full appearance-none cursor-pointer"
                style={{ background: `linear-gradient(90deg,#3b82f6 ${(form.feeling_after - 1) / 9 * 100}%,#e5e7eb ${(form.feeling_after - 1) / 9 * 100}%)` }} />
            </div>
          </div>

          <div>
            <label className="text-xs text-gray-500 mb-1 block">Notes (optional)</label>
            <input className="input text-sm" placeholder="Personal record? Injury? How did it feel?" value={form.notes} onChange={e => setForm(p => ({ ...p, notes: e.target.value }))} />
          </div>

          <button onClick={logWorkout} disabled={saving} className="btn-primary w-full py-3 flex items-center justify-center gap-2" style={{ background: 'linear-gradient(135deg,#7c3aed,#8b5cf6)' }}>
            <Check size={15} />{saving ? 'Saving...' : `Log ${WORKOUT_TYPES.find(w => w.key === form.type)?.label || 'Workout'}`}
          </button>
        </div>
      )}

      {/* HISTORY */}
      {tab === 'history' && (
        <div className="space-y-2">
          {loading ? (
            [1, 2, 3].map(i => <div key={i} className="card h-16 animate-pulse bg-gray-50" />)
          ) : logs.length === 0 ? (
            <div className="card border-dashed border-2 text-center py-10">
              <Activity size={32} className="text-gray-200 mx-auto mb-3" />
              <p className="text-sm font-semibold text-gray-600 mb-1">No workouts logged yet</p>
              <button onClick={() => setTab('log')} className="btn-primary text-xs py-2 mt-2">Log first workout</button>
            </div>
          ) : logs.map(l => {
            const w = WORKOUT_TYPES.find(x => x.key === l.type)
            return (
              <div key={l.id} className="card !p-3.5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <span className="text-2xl">{w?.icon || '🏃'}</span>
                    <div>
                      <p className="text-sm font-bold text-gray-900">{w?.label || l.type} · {l.duration} min</p>
                      <p className="text-xs text-gray-400">{new Date(l.date + 'T00:00:00').toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' })}</p>
                      {l.notes && <p className="text-xs text-gray-500 mt-0.5 italic">{l.notes}</p>}
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-black" style={{ color: w?.color || '#6b7280' }}>{l.calories} kcal</p>
                    <p className="text-xs text-gray-400">Intensity: {l.intensity}/10</p>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
