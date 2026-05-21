import { useState, useEffect } from 'react'
import { useAuthStore } from '@/store/authStore'
import { supabase } from '@/lib/supabase'
import { Battery, Moon, Heart, Activity, Zap, TrendingUp, RefreshCw } from 'lucide-react'
import toast from 'react-hot-toast'

interface RecoveryInputs {
  sleepHours: number
  sleepQuality: number    // 1-10
  hrv: number             // ms (optional)
  restingHR: number       // bpm
  stressLevel: number     // 1-10
  musclesoreness: number  // 1-10
  mood: number            // 1-10
  lastWorkoutIntensity: number // 1-10
}

interface RecoveryResult {
  score: number
  zone: 'peak' | 'optimal' | 'moderate' | 'recovery'
  recommendation: string
  todaysPlan: string[]
  breakdown: { sleep: number; hrv: number; stress: number; activity: number }
  readinessToTrain: 'high' | 'moderate' | 'low' | 'rest'
  sleepDebt: number
}

const ZONE_CONFIG = {
  peak:     { color:'#10b981', bg:'rgba(16,185,129,0.1)',  label:'Peak',     emoji:'🔥', desc:'Your body is primed. Push hard today.' },
  optimal:  { color:'#3b82f6', bg:'rgba(59,130,246,0.1)',  label:'Optimal',  emoji:'⚡', desc:'Great recovery. Good day to train.' },
  moderate: { color:'#f59e0b', bg:'rgba(245,158,11,0.1)',  label:'Moderate', emoji:'🟡', desc:'Moderate readiness. Train at 70%.' },
  recovery: { color:'#ef4444', bg:'rgba(239,68,68,0.1)',   label:'Recovery', emoji:'😴', desc:'Body needs rest. Light movement only.' },
}

function calcRecovery(i: RecoveryInputs): RecoveryResult {
  // Sleep score (35%)
  const sleepScore = Math.min(100, ((i.sleepHours / 8) * 60) + (i.sleepQuality * 4))

  // HRV score (25%) — higher HRV = better recovery
  let hrvScore: number
  if (i.hrv > 0) {
    hrvScore = Math.min(100, (i.hrv / 80) * 100)
  } else {
    // Estimate from resting HR (inverse relationship)
    hrvScore = Math.max(20, Math.min(100, 100 - (i.restingHR - 50) * 1.5))
  }

  // Stress score (25%) — lower stress = better recovery
  const stressScore = Math.max(0, 100 - (i.stressLevel * 8) - (i.musclesoreness * 4))

  // Activity balance (15%)
  const actScore = Math.max(0, 100 - (i.lastWorkoutIntensity * 5) + (i.mood * 5))

  const total = Math.round(
    sleepScore  * 0.35 +
    hrvScore    * 0.25 +
    stressScore * 0.25 +
    actScore    * 0.15
  )
  const score = Math.max(10, Math.min(100, total))

  const zone: RecoveryResult['zone'] =
    score >= 80 ? 'peak' : score >= 65 ? 'optimal' : score >= 45 ? 'moderate' : 'recovery'

  const sleepDebt = Math.max(0, +(8 - i.sleepHours).toFixed(1))

  const plans: Record<RecoveryResult['zone'], string[]> = {
    peak: [
      '💪 High-intensity workout — your body is ready',
      '🏃 Great day for a PB run or heavy lifting',
      '🥗 Focus on protein intake post-workout',
      '💧 Hydrate well — you\'ll sweat more today',
    ],
    optimal: [
      '🏋️ Moderate-intensity training recommended',
      '🚶 30-45 min cardio or strength training',
      '😴 Aim for 7.5-8 hrs sleep tonight',
      '🥗 Balanced macros — carbs before workout',
    ],
    moderate: [
      '🚶 Light walk or yoga only',
      '🧘 Focus on mobility and stretching',
      '💤 Prioritize sleep over exercise today',
      '🫁 Try 4-7-8 breathing to lower cortisol',
    ],
    recovery: [
      '😴 Full rest day — no intense exercise',
      '🛁 Warm bath + magnesium supplement',
      '📵 Screen-free 1 hour before bed',
      '🥗 Anti-inflammatory foods: turmeric, ginger, walnuts',
    ],
  }

  return {
    score,
    zone,
    recommendation: ZONE_CONFIG[zone].desc,
    todaysPlan: plans[zone],
    breakdown: {
      sleep: Math.round(sleepScore),
      hrv: Math.round(hrvScore),
      stress: Math.round(stressScore),
      activity: Math.round(actScore),
    },
    readinessToTrain: score>=80?'high':score>=65?'moderate':score>=45?'low':'rest',
    sleepDebt,
  }
}

export default function RecoveryScorePage() {
  const { user } = useAuthStore()
  const [inputs, setInputs] = useState<RecoveryInputs>({
    sleepHours:7, sleepQuality:6, hrv:0, restingHR:70,
    stressLevel:4, musclesoreness:3, mood:7, lastWorkoutIntensity:5,
  })
  const [result, setResult] = useState<RecoveryResult|null>(null)
  const [history, setHistory] = useState<Array<{date:string;score:number;zone:string}>>([])
  const [saving, setSaving] = useState(false)

  useEffect(()=>{ if(user) loadHistory() },[user])

  async function loadHistory() {
    if(!user) return
    const {data}=await supabase.from('health_records').select('value,recorded_at,metadata')
      .eq('user_id',user.id).eq('test_name','Recovery Score')
      .order('recorded_at',{ascending:false}).limit(7)
    setHistory((data||[]).map((r:{value:number;recorded_at:string;metadata:{zone?:string}|null})=>({
      date:r.recorded_at.split('T')[0], score:r.value, zone:(r.metadata as {zone?:string}|null)?.zone||'moderate'
    })))
  }

  async function calculate() {
    const res = calcRecovery(inputs)
    setResult(res)
    if(!user) return
    setSaving(true)
    try {
      await supabase.from('health_records').insert({
        user_id:user.id, record_type:'recovery', test_name:'Recovery Score',
        value:res.score, unit:'/100', source:'manual',
        recorded_at:new Date().toISOString(),
        metadata:{ zone:res.zone, breakdown:res.breakdown, sleepDebt:res.sleepDebt }
      })
      toast.success('Recovery score saved!')
      loadHistory()
    } finally { setSaving(false) }
  }

  const cfg = result ? ZONE_CONFIG[result.zone] : null

  return (
    <div className="p-4 pb-8 max-w-2xl mx-auto space-y-4">
      <div className="card !p-5" style={{background:'linear-gradient(135deg,#0a1628,#0f2a1e)',borderColor:'#1e40af'}}>
        <div className="flex items-start gap-3">
          <div className="w-12 h-12 rounded-xl flex items-center justify-center shrink-0" style={{background:'rgba(59,130,246,0.2)'}}>
            <Battery size={24} className="text-blue-400"/>
          </div>
          <div>
            <div className="flex items-center gap-2 mb-1">
              <h1 className="text-lg font-bold text-white">Recovery Score</h1>
              <span className="text-[10px] bg-blue-900 text-blue-300 border border-blue-700 px-2 py-0.5 rounded-full font-bold">WHOOP-style</span>
            </div>
            <p className="text-sm text-blue-300">Sleep(35%) + HRV(25%) + Stress(25%) + Activity(15%) = Should you push or rest today?</p>
          </div>
        </div>
      </div>

      {/* 7-day history */}
      {history.length>0 && (
        <div className="card !p-4">
          <p className="text-xs font-bold text-gray-500 mb-3">7-day recovery trend</p>
          <div className="flex items-end gap-2 h-14">
            {history.slice().reverse().map((h,i)=>{
              const c = ZONE_CONFIG[h.zone as keyof typeof ZONE_CONFIG]?.color||'#6b7280'
              return (
                <div key={i} className="flex-1 flex flex-col items-center gap-1">
                  <div className="w-full rounded-t-sm" style={{height:`${(h.score/100)*50}px`,background:c,minHeight:4}}/>
                  <span className="text-[8px] text-gray-500">{h.date.slice(5)}</span>
                  <span className="text-[9px] font-bold text-gray-400">{h.score}</span>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Inputs */}
      <div className="card !p-4 space-y-4">
        <p className="text-sm font-bold text-gray-800">Today's morning check-in</p>
        {[
          {label:'Sleep hours',           key:'sleepHours',            min:2, max:12, step:0.5, unit:'hrs', icon:'😴'},
          {label:'Sleep quality',         key:'sleepQuality',          min:1, max:10, step:1,   unit:'/10', icon:'🌙'},
          {label:'Resting heart rate',    key:'restingHR',             min:40,max:100,step:1,   unit:'bpm', icon:'💓'},
          {label:'HRV (optional, wearable)',key:'hrv',                 min:0, max:150,step:1,   unit:'ms',  icon:'📊'},
          {label:'Stress level',          key:'stressLevel',           min:1, max:10, step:1,   unit:'/10', icon:'😤'},
          {label:'Muscle soreness',       key:'musclesoreness',        min:1, max:10, step:1,   unit:'/10', icon:'💪'},
          {label:'Morning mood',          key:'mood',                  min:1, max:10, step:1,   unit:'/10', icon:'😊'},
          {label:'Yesterday workout intensity', key:'lastWorkoutIntensity', min:1,max:10,step:1, unit:'/10',icon:'🏋️'},
        ].map(f=>{
          const val=(inputs as Record<string,number>)[f.key]
          const pct=((val-f.min)/(f.max-f.min))*100
          const isInverse=['stressLevel','musclesoreness','restingHR'].includes(f.key)
          return (
            <div key={f.key}>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-xs font-medium text-gray-700 flex items-center gap-1.5">
                  <span>{f.icon}</span>{f.label}
                  {f.key==='hrv' && <span className="text-[10px] text-gray-400">(0 = auto-estimate)</span>}
                </label>
                <span className="text-sm font-bold text-gray-900">{val}{f.unit}</span>
              </div>
              <input type="range" min={f.min} max={f.max} step={f.step} value={val}
                onChange={e=>setInputs(p=>({...p,[f.key]:parseFloat(e.target.value)}))}
                className="w-full h-2 rounded-full appearance-none cursor-pointer"
                style={{background:isInverse
                  ?`linear-gradient(90deg,#10b981 ${100-pct}%,#e5e7eb ${100-pct}%)`
                  :`linear-gradient(90deg,#3b82f6 ${pct}%,#e5e7eb ${pct}%)`}}/>
            </div>
          )
        })}
        <button onClick={calculate} disabled={saving} className="btn-primary w-full py-3 flex items-center justify-center gap-2">
          <Battery size={16}/>Calculate recovery score
        </button>
      </div>

      {/* Result */}
      {result && cfg && (
        <div className="card !p-5" style={{background:cfg.bg,borderColor:cfg.color+'40'}}>
          <div className="flex items-center gap-4 mb-4">
            <div className="relative w-24 h-24 shrink-0">
              <svg viewBox="0 0 100 100" style={{transform:'rotate(-90deg)'}}>
                <circle cx="50" cy="50" r="42" fill="none" stroke="rgba(0,0,0,0.1)" strokeWidth="8"/>
                <circle cx="50" cy="50" r="42" fill="none" stroke={cfg.color} strokeWidth="8"
                  strokeDasharray={`${result.score*2.64} ${264}`} strokeLinecap="round"/>
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <span className="text-3xl font-black" style={{color:cfg.color}}>{result.score}</span>
                <span className="text-[9px] text-gray-500">/100</span>
              </div>
            </div>
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-1">
                <span className="text-2xl">{cfg.emoji}</span>
                <span className="text-xl font-black text-gray-900">{cfg.label} Zone</span>
              </div>
              <p className="text-sm text-gray-600 mb-2">{result.recommendation}</p>
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-[10px] px-2 py-0.5 rounded-full text-white font-bold capitalize"
                  style={{background:cfg.color}}>
                  Train: {result.readinessToTrain.toUpperCase()}
                </span>
                {result.sleepDebt>0 && (
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-red-100 text-red-700 font-bold">
                    Sleep debt: -{result.sleepDebt}h
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Breakdown */}
          <div className="grid grid-cols-4 gap-2 mb-4">
            {[
              {label:'Sleep',   val:result.breakdown.sleep,    icon:'😴', color:'#8b5cf6'},
              {label:'HRV',     val:result.breakdown.hrv,      icon:'💓', color:'#ef4444'},
              {label:'Stress',  val:result.breakdown.stress,   icon:'🧠', color:'#f59e0b'},
              {label:'Activity',val:result.breakdown.activity, icon:'🏃', color:'#10b981'},
            ].map(b=>(
              <div key={b.label} className="bg-white/60 rounded-xl p-2.5 text-center">
                <div className="text-base mb-0.5">{b.icon}</div>
                <div className="text-base font-black" style={{color:b.color}}>{b.val}</div>
                <div className="text-[9px] text-gray-500">{b.label}</div>
              </div>
            ))}
          </div>

          {/* Today's plan */}
          <div>
            <p className="text-[10px] font-bold text-gray-600 mb-2">TODAY'S PLAN</p>
            {result.todaysPlan.map((p,i)=>(
              <div key={i} className="flex gap-2 text-sm text-gray-700 mb-2 bg-white/50 rounded-lg p-2.5">
                {p}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
