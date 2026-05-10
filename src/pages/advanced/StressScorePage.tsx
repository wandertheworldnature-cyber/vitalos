import { useState, useEffect } from 'react'
import { useAuthStore } from '@/store/authStore'
import { supabase } from '@/lib/supabase'
import { Brain, Moon, Activity, Heart, Zap, TrendingDown, TrendingUp, RefreshCw } from 'lucide-react'
import toast from 'react-hot-toast'

interface StressInputs {
  sleepHours: number
  sleepQuality: number   // 1-10
  mood: number           // 1-10
  energyLevel: number    // 1-10
  screenTime: number     // hours
  exerciseToday: boolean
  meditationToday: boolean
  workStress: number     // 1-10
  hrv?: number           // ms (optional wearable)
  restingHR?: number     // bpm (optional)
}

interface StressResult {
  score: number          // 0-100 (lower = more stressed)
  level: 'low'|'moderate'|'elevated'|'high'
  breakdown: { sleep: number; mood: number; activity: number; hrv: number }
  insights: string[]
  suggestions: string[]
  burnoutRisk: 'low'|'moderate'|'high'
  trend: 'improving'|'stable'|'declining'
}

function calcStressScore(inputs: StressInputs): StressResult {
  // Sleep score (40% weight)
  const sleepScore = Math.min(100, ((inputs.sleepHours / 8) * 70) + (inputs.sleepQuality * 3))

  // Mood/mental score (20% weight)
  const moodScore = (inputs.mood * 10) - (inputs.workStress * 5) + (inputs.meditationToday ? 10 : 0)
  const moodFinal = Math.max(0, Math.min(100, moodScore))

  // Activity score (20% weight)
  const actScore = (inputs.energyLevel * 8) + (inputs.exerciseToday ? 20 : 0) - (inputs.screenTime * 3)
  const actFinal = Math.max(0, Math.min(100, actScore))

  // HRV score (20% weight) — if no wearable, estimate from other signals
  let hrvScore: number
  if (inputs.hrv) {
    hrvScore = Math.min(100, (inputs.hrv / 80) * 100)
  } else {
    // Estimate from sleep + mood
    hrvScore = (sleepScore * 0.5) + (moodFinal * 0.5)
  }

  const total = Math.round(
    sleepScore  * 0.40 +
    moodFinal   * 0.20 +
    actFinal    * 0.20 +
    hrvScore    * 0.20
  )

  const level = total >= 75 ? 'low' : total >= 55 ? 'moderate' : total >= 35 ? 'elevated' : 'high'

  const insights: string[] = []
  const suggestions: string[] = []

  if (inputs.sleepHours < 6) { insights.push(`Sleep is critically low at ${inputs.sleepHours}h — this alone raises cortisol by 37%`); suggestions.push('Set a fixed sleep time tonight — even 30 min more helps') }
  if (inputs.workStress >= 7) { insights.push('High work stress detected — your nervous system is in constant fight-or-flight'); suggestions.push('Take 5-minute breathing breaks every 90 minutes at work') }
  if (!inputs.exerciseToday) { insights.push('No exercise today — movement is the fastest stress reducer'); suggestions.push('Even a 15-min walk after dinner reduces cortisol significantly') }
  if (inputs.screenTime > 6) { insights.push(`${inputs.screenTime}h screen time strains your nervous system and disrupts sleep hormones`); suggestions.push('Enable blue light filter after 8 PM · Phone-free 30 min before bed') }
  if (inputs.mood <= 4) { insights.push('Low mood detected — may be linked to sleep deprivation or work overload'); suggestions.push('Try the 4-7-8 breathing technique: inhale 4s, hold 7s, exhale 8s') }
  if (inputs.meditationToday) insights.push('Great — meditation today is reducing your cortisol levels right now')

  if (insights.length === 0) insights.push('Your stress indicators are balanced today — keep this routine going')
  if (suggestions.length === 0) suggestions.push('Maintain your current sleep and exercise habits — they\'re working')

  const burnoutRisk: StressResult['burnoutRisk'] = (total < 35 && inputs.workStress >= 7) ? 'high' : total < 55 ? 'moderate' : 'low'

  return {
    score: total,
    level,
    breakdown: {
      sleep: Math.round(sleepScore),
      mood: Math.round(moodFinal),
      activity: Math.round(actFinal),
      hrv: Math.round(hrvScore),
    },
    insights,
    suggestions,
    burnoutRisk,
    trend: 'stable',
  }
}

const LEVEL_CONFIG = {
  low:      { color:'#10b981', bg:'rgba(16,185,129,0.1)',  label:'Low Stress',      emoji:'😌', desc:'Your nervous system is well-rested' },
  moderate: { color:'#3b82f6', bg:'rgba(59,130,246,0.1)',  label:'Moderate Stress', emoji:'😐', desc:'Some strain — manageable with small changes' },
  elevated: { color:'#f59e0b', bg:'rgba(245,158,11,0.1)',  label:'Elevated Stress', emoji:'😓', desc:'Your body is under significant load' },
  high:     { color:'#ef4444', bg:'rgba(239,68,68,0.1)',   label:'High Stress',     emoji:'😰', desc:'Burnout risk — recovery needed urgently' },
}

export default function StressScorePage() {
  const { user } = useAuthStore()
  const [inputs, setInputs] = useState<StressInputs>({
    sleepHours: 7, sleepQuality: 6, mood: 6, energyLevel: 6,
    screenTime: 5, exerciseToday: false, meditationToday: false, workStress: 5,
  })
  const [result, setResult] = useState<StressResult | null>(null)
  const [history, setHistory] = useState<Array<{ date: string; score: number; level: string }>>([])
  const [saving, setSaving] = useState(false)

  useEffect(() => { if (user) loadHistory() }, [user])

  async function loadHistory() {
    if (!user) return
    const { data } = await supabase.from('health_records')
      .select('value, recorded_at, metadata')
      .eq('user_id', user.id).eq('test_name', 'Stress Score')
      .order('recorded_at', { ascending: false }).limit(7)
    setHistory((data || []).map((r: { value: number; recorded_at: string; metadata: { level?: string } | null }) => ({
      date: r.recorded_at.split('T')[0],
      score: r.value,
      level: (r.metadata as { level?: string } | null)?.level || 'moderate'
    })))
  }

  async function calculate() {
    const res = calcStressScore(inputs)
    setResult(res)

    if (!user) return
    setSaving(true)
    try {
      await supabase.from('health_records').insert({
        user_id: user.id,
        record_type: 'mental',
        test_name: 'Stress Score',
        value: res.score,
        unit: '/100',
        source: 'manual',
        recorded_at: new Date().toISOString(),
        metadata: { level: res.level, breakdown: res.breakdown, burnoutRisk: res.burnoutRisk },
      })
      toast.success('Stress score saved!')
      loadHistory()
    } finally { setSaving(false) }
  }

  const cfg = result ? LEVEL_CONFIG[result.level] : null

  return (
    <div className="p-4 pb-8 max-w-2xl mx-auto space-y-4">
      {/* Header */}
      <div className="card !p-5" style={{ background:'linear-gradient(135deg,#0f0522,#1a0a2e)', borderColor:'#6d28d9' }}>
        <div className="flex items-start gap-3">
          <div className="w-12 h-12 rounded-xl flex items-center justify-center shrink-0" style={{ background:'rgba(139,92,246,0.2)' }}>
            <Brain size={24} className="text-purple-400"/>
          </div>
          <div>
            <div className="flex items-center gap-2 mb-1">
              <h1 className="text-lg font-bold text-white">Stress Score Engine</h1>
              <span className="text-[10px] bg-purple-900 text-purple-300 border border-purple-700 px-2 py-0.5 rounded-full font-bold">PREMIUM</span>
            </div>
            <p className="text-sm text-purple-300">Formula: Sleep(40%) + HRV(20%) + Mood(20%) + Activity(20%)</p>
          </div>
        </div>
      </div>

      {/* History bars */}
      {history.length > 0 && (
        <div className="card !p-4">
          <p className="text-xs font-bold text-gray-400 mb-3">7-day stress trend</p>
          <div className="flex items-end gap-2 h-16">
            {history.slice(0,7).reverse().map((h, i) => {
              const c = LEVEL_CONFIG[h.level as keyof typeof LEVEL_CONFIG]?.color || '#6b7280'
              return (
                <div key={i} className="flex-1 flex flex-col items-center gap-1">
                  <div className="w-full rounded-t-sm" style={{ height:`${(h.score/100)*56}px`, background:c, minHeight:4 }}/>
                  <span className="text-[8px] text-gray-500">{h.date.slice(5)}</span>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Input form */}
      <div className="card !p-4 space-y-4">
        <p className="text-sm font-bold text-gray-800">Today's check-in</p>

        {/* Sliders */}
        {[
          { label:'Sleep hours last night', key:'sleepHours',    min:3, max:10, step:0.5, unit:'hrs', icon:'😴' },
          { label:'Sleep quality',          key:'sleepQuality',  min:1, max:10, step:1,   unit:'/10', icon:'🌙' },
          { label:'Current mood',           key:'mood',          min:1, max:10, step:1,   unit:'/10', icon:'😊' },
          { label:'Energy level',           key:'energyLevel',   min:1, max:10, step:1,   unit:'/10', icon:'⚡' },
          { label:'Work/study stress',      key:'workStress',    min:1, max:10, step:1,   unit:'/10', icon:'💼' },
          { label:'Screen time today',      key:'screenTime',    min:0, max:16, step:0.5, unit:'hrs', icon:'📱' },
        ].map(f => {
          const val = inputs[f.key as keyof StressInputs] as number
          const pct = ((val - f.min) / (f.max - f.min)) * 100
          return (
            <div key={f.key}>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-xs font-medium text-gray-700 flex items-center gap-1.5">
                  <span>{f.icon}</span>{f.label}
                </label>
                <span className="text-sm font-bold text-gray-900">{val}{f.unit}</span>
              </div>
              <input type="range" min={f.min} max={f.max} step={f.step} value={val}
                onChange={e => setInputs(p => ({ ...p, [f.key]: parseFloat(e.target.value) }))}
                className="w-full h-2 rounded-full appearance-none cursor-pointer"
                style={{ background:`linear-gradient(90deg,#0f6e56 ${pct}%,#e5e7eb ${pct}%)` }}/>
            </div>
          )
        })}

        {/* Toggles */}
        <div className="grid grid-cols-2 gap-2">
          {[
            { key:'exerciseToday', label:'Exercised today', icon:'🏃' },
            { key:'meditationToday', label:'Meditated today', icon:'🧘' },
          ].map(f => {
            const val = inputs[f.key as keyof StressInputs] as boolean
            return (
              <button key={f.key} onClick={() => setInputs(p => ({ ...p, [f.key]: !val }))}
                className={`flex items-center gap-2 p-3 rounded-xl border text-sm font-semibold transition-all ${val ? 'text-white border-transparent' : 'border-gray-200 text-gray-500 bg-white'}`}
                style={val ? { background:'linear-gradient(135deg,#0f6e56,#1d9e75)' } : {}}>
                <span>{f.icon}</span>{f.label}
                <span className="ml-auto">{val ? '✓' : '○'}</span>
              </button>
            )
          })}
        </div>

        {/* Optional HRV */}
        <div>
          <label className="text-xs text-gray-500 mb-1 block">HRV (optional — from Apple Watch/Garmin)</label>
          <input type="number" className="input text-sm" placeholder="e.g. 45 ms — leave blank if no wearable"
            onChange={e => setInputs(p => ({ ...p, hrv: e.target.value ? parseFloat(e.target.value) : undefined }))}/>
        </div>

        <button onClick={calculate} disabled={saving} className="btn-primary w-full py-3 flex items-center justify-center gap-2">
          <Brain size={16}/> Calculate my stress score
        </button>
      </div>

      {/* Result */}
      {result && cfg && (
        <>
          <div className="card !p-5" style={{ background:cfg.bg, borderColor:cfg.color+'40' }}>
            <div className="flex items-center gap-4 mb-4">
              <div style={{ width:80, height:80, position:'relative', flexShrink:0 }}>
                <svg viewBox="0 0 80 80" style={{ transform:'rotate(-90deg)' }}>
                  <circle cx="40" cy="40" r="34" fill="none" stroke="rgba(255,255,255,0.1)" strokeWidth="8"/>
                  <circle cx="40" cy="40" r="34" fill="none" stroke={cfg.color} strokeWidth="8"
                    strokeDasharray={`${result.score * 2.136} ${213.6}`} strokeLinecap="round"/>
                </svg>
                <div style={{ position:'absolute', inset:0, display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center' }}>
                  <span style={{ fontSize:22, fontWeight:900, color:cfg.color }}>{result.score}</span>
                  <span style={{ fontSize:9, color:'#9ca3af' }}>/100</span>
                </div>
              </div>
              <div>
                <div style={{ fontSize:24 }}>{cfg.emoji}</div>
                <p className="text-lg font-black text-gray-900">{cfg.label}</p>
                <p className="text-xs text-gray-500">{cfg.desc}</p>
                {result.burnoutRisk === 'high' && (
                  <span className="text-[10px] bg-red-100 text-red-700 px-2 py-0.5 rounded-full font-bold mt-1 inline-block">⚠️ Burnout Risk: HIGH</span>
                )}
              </div>
            </div>

            <div className="grid grid-cols-4 gap-2 mb-4">
              {[
                { label:'Sleep', val:result.breakdown.sleep, icon:'😴' },
                { label:'Mood', val:result.breakdown.mood,  icon:'😊' },
                { label:'Activity', val:result.breakdown.activity, icon:'🏃' },
                { label:'HRV', val:result.breakdown.hrv,   icon:'💓' },
              ].map(b => (
                <div key={b.label} className="bg-white/60 rounded-xl p-2.5 text-center">
                  <div style={{ fontSize:16 }}>{b.icon}</div>
                  <div className="text-base font-black text-gray-900">{b.val}</div>
                  <div className="text-[9px] text-gray-500">{b.label}</div>
                </div>
              ))}
            </div>

            <div className="space-y-2 mb-3">
              {result.insights.map((ins, i) => (
                <div key={i} className="flex gap-2 text-xs text-gray-700 bg-white/50 rounded-lg p-2.5">
                  <span className="shrink-0">💡</span>{ins}
                </div>
              ))}
            </div>

            <div className="bg-white/60 rounded-xl p-3">
              <p className="text-[10px] font-bold text-gray-600 mb-2">TODAY'S RECOMMENDATIONS</p>
              {result.suggestions.map((s, i) => (
                <p key={i} className="text-xs text-gray-700 flex gap-2 mb-1.5"><span className="text-teal-600 shrink-0">→</span>{s}</p>
              ))}
            </div>
          </div>

          <button onClick={() => setResult(null)} className="w-full btn-secondary text-xs py-2">
            <RefreshCw size={12} className="inline mr-1"/> Re-check
          </button>
        </>
      )}
    </div>
  )
}
