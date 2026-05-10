import { useState, useEffect } from 'react'
import { useAuthStore } from '@/store/authStore'
import { supabase } from '@/lib/supabase'
import { Wind, Activity, TrendingUp, Zap, RefreshCw, Info } from 'lucide-react'
import toast from 'react-hot-toast'

interface VO2Inputs {
  age: number
  gender: 'male' | 'female'
  weight: number          // kg
  restingHR: number       // bpm
  maxHR?: number          // bpm (optional)
  walkTime?: number       // minutes for 1 mile walk test
  walkHR?: number         // HR at end of walk test
  exerciseLevel: 'sedentary' | 'light' | 'moderate' | 'active' | 'athlete'
  dailySteps?: number
}

interface VO2Result {
  vo2max: number
  fitnessAge: number
  category: 'poor' | 'fair' | 'good' | 'excellent' | 'superior'
  score: number           // 0-100 for longevity score integration
  percentile: number
  longevityImpact: string
  improvements: string[]
  targetVO2: number
  weeksToTarget: number
}

const CATEGORY_CONFIG = {
  poor:      { color:'#ef4444', label:'Poor',      emoji:'😔', range:'< 30',    mortalityRisk:'High' },
  fair:      { color:'#f97316', label:'Fair',      emoji:'😐', range:'30–39',   mortalityRisk:'Moderate' },
  good:      { color:'#f59e0b', label:'Good',      emoji:'🙂', range:'40–49',   mortalityRisk:'Average' },
  excellent: { color:'#10b981', label:'Excellent', emoji:'😊', range:'50–59',   mortalityRisk:'Low' },
  superior:  { color:'#3b82f6', label:'Superior',  emoji:'💪', range:'60+',     mortalityRisk:'Very Low' },
}

// VO2Max estimation formulas
function estimateVO2Max(inputs: VO2Inputs): VO2Result {
  let vo2max: number

  if (inputs.walkTime && inputs.walkHR) {
    // Rockport Walk Test formula
    vo2max = 132.853 - (0.0769 * (inputs.weight * 2.205)) - (0.3877 * inputs.age) +
             (inputs.gender === 'female' ? 6.315 : 0) - (3.2649 * inputs.walkTime) -
             (0.1565 * inputs.walkHR)
  } else if (inputs.restingHR) {
    // Estimated from resting HR (Uth–Sørensen–Overgaard–Pedersen formula)
    const maxHR = inputs.maxHR || (220 - inputs.age)
    vo2max = 15 * (maxHR / inputs.restingHR)

    // Activity level adjustment
    const adjustments = { sedentary:-5, light:-2, moderate:0, active:3, athlete:6 }
    vo2max += adjustments[inputs.exerciseLevel]

    // Steps adjustment
    if (inputs.dailySteps) {
      if (inputs.dailySteps >= 10000) vo2max += 3
      else if (inputs.dailySteps >= 7500) vo2max += 1
      else if (inputs.dailySteps < 5000) vo2max -= 3
    }
  } else {
    // Baseline from demographics
    const baseByAge: Record<number, number> = { 25:45, 30:43, 35:41, 40:39, 45:37, 50:35, 55:33, 60:31 }
    const ageKey = Math.round(inputs.age / 5) * 5
    vo2max = baseByAge[Math.min(60, Math.max(25, ageKey))] || 38
    if (inputs.gender === 'female') vo2max -= 5
    const actAdj = { sedentary:-5, light:-2, moderate:0, active:4, athlete:9 }
    vo2max += actAdj[inputs.exerciseLevel]
  }

  vo2max = Math.round(Math.max(15, Math.min(80, vo2max)))

  // Category based on age + gender norms
  let category: VO2Result['category']
  const isFemale = inputs.gender === 'female'
  const thresholds = isFemale
    ? { poor:28, fair:35, good:43, excellent:52 }
    : { poor:33, fair:40, good:48, excellent:57 }

  if (vo2max < thresholds.poor) category = 'poor'
  else if (vo2max < thresholds.fair) category = 'fair'
  else if (vo2max < thresholds.good) category = 'good'
  else if (vo2max < thresholds.excellent) category = 'excellent'
  else category = 'superior'

  // Fitness age (years younger/older based on VO2)
  const expectedVO2 = isFemale ? (50 - inputs.age * 0.3) : (57 - inputs.age * 0.3)
  const diff = vo2max - expectedVO2
  const fitnessAge = Math.round(inputs.age - (diff * 0.7))

  // Longevity score contribution (0-100)
  const score = Math.round(Math.min(100, (vo2max / 60) * 100))
  const percentile = Math.round(Math.min(99, score * 0.95))

  const longevityImpact = vo2max >= 50
    ? 'Each 3.5 mL/kg/min increase in VO2 Max reduces all-cause mortality by ~11%. Your fitness level provides significant longevity protection.'
    : vo2max >= 40
    ? 'Moderate cardiorespiratory fitness. Studies show improving VO2 Max from this range by 10 units cuts heart disease risk by 40%.'
    : 'Low VO2 Max is a stronger predictor of mortality than smoking or obesity. Improving this should be your #1 health priority.'

  const targetVO2 = Math.min(vo2max + 8, 60)
  const weeksToTarget = Math.round((targetVO2 - vo2max) / 0.5) // ~0.5 mL/kg/min per week with training

  const improvements: string[] = []
  if (vo2max < 40) improvements.push('Start with 20 min brisk walks 5x/week — this alone can improve VO2 by 15% in 3 months')
  if (inputs.exerciseLevel === 'sedentary' || inputs.exerciseLevel === 'light') {
    improvements.push('Zone 2 cardio (conversational pace): 45 min, 4x/week — the most effective VO2 builder')
    improvements.push('Add 1 HIIT session/week: 8 × 30s sprints with 90s rest — boosts VO2 Max rapidly')
  }
  if (inputs.exerciseLevel === 'moderate') {
    improvements.push('Add interval training: 4×4 protocol (4 min at 90% max HR, 4x) — proven to raise VO2 Max 10% in 8 weeks')
  }
  improvements.push('Nasal breathing during exercise improves O2 efficiency — try it on easy runs')
  improvements.push('Lose 1 kg → gain ~1 mL/kg/min VO2 Max automatically')

  return { vo2max, fitnessAge, category, score, percentile, longevityImpact, improvements, targetVO2, weeksToTarget }
}

export default function VO2MaxPage() {
  const { user } = useAuthStore()
  const [inputs, setInputs] = useState<VO2Inputs>({
    age: 30, gender:'male', weight:70, restingHR:70, exerciseLevel:'moderate', dailySteps:6000,
  })
  const [result, setResult] = useState<VO2Result | null>(null)
  const [history, setHistory] = useState<Array<{ date: string; vo2: number }>>([])
  const [saving, setSaving] = useState(false)
  const [showWalkTest, setShowWalkTest] = useState(false)

  useEffect(() => { if (user) { loadProfile(); loadHistory() } }, [user])

  async function loadProfile() {
    if (!user) return
    const { data } = await supabase.from('profiles').select('date_of_birth,gender').eq('id', user.id).single()
    if (data?.date_of_birth) {
      const age = Math.floor((Date.now() - new Date(data.date_of_birth).getTime()) / 31557600000)
      setInputs(p => ({ ...p, age }))
    }
    if (data?.gender) setInputs(p => ({ ...p, gender: data.gender === 'Female' ? 'female' : 'male' }))
  }

  async function loadHistory() {
    if (!user) return
    const { data } = await supabase.from('health_records').select('value,recorded_at')
      .eq('user_id', user.id).eq('test_name', 'VO2 Max').order('recorded_at', { ascending: false }).limit(6)
    setHistory((data || []).map((r: { value: number; recorded_at: string }) => ({ date: r.recorded_at.split('T')[0], vo2: r.value })))
  }

  async function calculate() {
    const res = estimateVO2Max(inputs)
    setResult(res)
    if (!user) return
    setSaving(true)
    try {
      await supabase.from('health_records').insert({
        user_id: user.id, record_type: 'fitness', test_name: 'VO2 Max',
        value: res.vo2max, unit: 'mL/kg/min', source: 'manual',
        recorded_at: new Date().toISOString(),
        metadata: { fitnessAge: res.fitnessAge, category: res.category, score: res.score },
      })
      toast.success('VO2 Max saved!')
      loadHistory()
    } finally { setSaving(false) }
  }

  const cfg = result ? CATEGORY_CONFIG[result.category] : null

  return (
    <div className="p-4 pb-8 max-w-2xl mx-auto space-y-4">
      {/* Header */}
      <div className="card !p-5" style={{ background:'linear-gradient(135deg,#0a1628,#0d2040)', borderColor:'#1e40af' }}>
        <div className="flex items-start gap-3">
          <div className="w-12 h-12 rounded-xl flex items-center justify-center shrink-0" style={{ background:'rgba(59,130,246,0.2)' }}>
            <Wind size={24} className="text-blue-400"/>
          </div>
          <div>
            <div className="flex items-center gap-2 mb-1">
              <h1 className="text-lg font-bold text-white">VO2 Max Engine</h1>
              <span className="text-[10px] bg-blue-900 text-blue-300 border border-blue-700 px-2 py-0.5 rounded-full font-bold">PREMIUM</span>
            </div>
            <p className="text-sm text-blue-300 leading-relaxed">Cardiorespiratory fitness — the strongest predictor of longevity. Higher VO2 Max = longer, healthier life.</p>
          </div>
        </div>
        <div className="mt-3 grid grid-cols-3 gap-2 text-center">
          {[['< 30', 'Poor — High risk'], ['40–49', 'Good — Low risk'], ['60+', 'Superior — Very low risk']].map(([range, label]) => (
            <div key={range} className="bg-blue-900/30 rounded-lg p-2">
              <div className="text-sm font-black text-blue-300">{range}</div>
              <div className="text-[9px] text-blue-400">{label}</div>
            </div>
          ))}
        </div>
      </div>

      {/* History */}
      {history.length > 0 && (
        <div className="card !p-4">
          <p className="text-xs font-bold text-gray-500 mb-3">VO2 Max history</p>
          <div className="flex items-end gap-2 h-14">
            {history.slice().reverse().map((h, i) => (
              <div key={i} className="flex-1 flex flex-col items-center gap-1">
                <div className="w-full rounded-t-sm bg-blue-500" style={{ height:`${(h.vo2/60)*50}px`, minHeight:4 }}/>
                <span className="text-[8px] text-gray-500">{h.date.slice(5)}</span>
                <span className="text-[9px] font-bold text-blue-400">{h.vo2}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Inputs */}
      <div className="card !p-4 space-y-3">
        <p className="text-sm font-bold text-gray-800">Enter your details</p>

        <div className="grid grid-cols-2 gap-3">
          {[
            { label:'Age', key:'age', unit:'years', type:'number', min:15, max:80 },
            { label:'Weight', key:'weight', unit:'kg', type:'number', min:30, max:150 },
            { label:'Resting heart rate', key:'restingHR', unit:'bpm', type:'number', min:40, max:100 },
            { label:'Daily steps (avg)', key:'dailySteps', unit:'steps', type:'number', min:0, max:25000 },
          ].map(f => (
            <div key={f.key}>
              <label className="text-xs text-gray-500 mb-1 block">{f.label}</label>
              <div className="relative">
                <input type={f.type} className="input text-sm !py-2 pr-14"
                  value={(inputs as Record<string,unknown>)[f.key] as number || ''}
                  min={f.min} max={f.max}
                  onChange={e => setInputs(p => ({ ...p, [f.key]: parseFloat(e.target.value)||0 }))}/>
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] text-gray-400">{f.unit}</span>
              </div>
            </div>
          ))}
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-xs text-gray-500 mb-1 block">Gender</label>
            <div className="flex gap-2">
              {(['male','female'] as const).map(g => (
                <button key={g} onClick={() => setInputs(p => ({ ...p, gender:g }))}
                  className={`flex-1 py-2 rounded-lg text-xs font-semibold border capitalize ${inputs.gender===g ? 'text-white border-transparent' : 'border-gray-200 text-gray-500'}`}
                  style={inputs.gender===g ? { background:'linear-gradient(135deg,#0f6e56,#1d9e75)' } : {}}>
                  {g}
                </button>
              ))}
            </div>
          </div>
          <div>
            <label className="text-xs text-gray-500 mb-1 block">Exercise level</label>
            <select className="input text-sm !py-2" value={inputs.exerciseLevel}
              onChange={e => setInputs(p => ({ ...p, exerciseLevel: e.target.value as VO2Inputs['exerciseLevel'] }))}>
              <option value="sedentary">Sedentary (office)</option>
              <option value="light">Light (1-2x/week)</option>
              <option value="moderate">Moderate (3-4x/week)</option>
              <option value="active">Active (5-6x/week)</option>
              <option value="athlete">Athlete (daily+)</option>
            </select>
          </div>
        </div>

        {/* Walk test toggle */}
        <button onClick={() => setShowWalkTest(s => !s)}
          className="text-xs text-blue-600 hover:text-blue-800 font-medium flex items-center gap-1">
          <Info size={12}/> {showWalkTest ? 'Hide' : 'Use'} Rockport Walk Test (more accurate)
        </button>

        {showWalkTest && (
          <div className="bg-blue-50 rounded-xl p-3 space-y-2">
            <p className="text-xs font-bold text-blue-700">Walk Test: Walk 1.6 km (1 mile) as fast as possible, then record:</p>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-[10px] text-gray-500 mb-1 block">Time to complete (minutes)</label>
                <input type="number" step="0.5" className="input text-sm !py-2" placeholder="e.g. 14.5"
                  onChange={e => setInputs(p => ({ ...p, walkTime: parseFloat(e.target.value)||undefined }))}/>
              </div>
              <div>
                <label className="text-[10px] text-gray-500 mb-1 block">Heart rate immediately after</label>
                <input type="number" className="input text-sm !py-2" placeholder="e.g. 145 bpm"
                  onChange={e => setInputs(p => ({ ...p, walkHR: parseFloat(e.target.value)||undefined }))}/>
              </div>
            </div>
          </div>
        )}

        <button onClick={calculate} disabled={saving} className="btn-primary w-full py-3 flex items-center justify-center gap-2">
          <Wind size={16}/> Calculate VO2 Max
        </button>
      </div>

      {/* Result */}
      {result && cfg && (
        <>
          <div className="card !p-5" style={{ background:`${cfg.color}10`, borderColor:`${cfg.color}30` }}>
            <div className="flex items-center gap-5 mb-4">
              <div className="text-center">
                <div className="text-5xl font-black" style={{ color:cfg.color }}>{result.vo2max}</div>
                <div className="text-xs text-gray-400 mt-1">mL/kg/min</div>
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-xl">{cfg.emoji}</span>
                  <span className="text-lg font-black text-gray-900">{cfg.label}</span>
                  <span className="text-[10px] px-2 py-0.5 rounded-full text-white font-bold" style={{ background:cfg.color }}>Top {100-result.percentile}%</span>
                </div>
                <p className="text-xs text-gray-500 mb-2">Normal range: {cfg.range} mL/kg/min</p>
                <div className="flex items-center gap-2">
                  <div className="bg-indigo-100 rounded-lg px-3 py-2 text-center">
                    <div className="text-xl font-black text-indigo-700">{result.fitnessAge}</div>
                    <div className="text-[9px] text-indigo-500">Fitness age</div>
                  </div>
                  <div className="bg-teal-100 rounded-lg px-3 py-2 text-center">
                    <div className="text-xl font-black text-teal-700">{result.score}</div>
                    <div className="text-[9px] text-teal-500">Longevity pts</div>
                  </div>
                  <div className="bg-amber-100 rounded-lg px-3 py-2 text-center">
                    <div className="text-sm font-black text-amber-700">{result.targetVO2}</div>
                    <div className="text-[9px] text-amber-500">Target in {result.weeksToTarget}wks</div>
                  </div>
                </div>
              </div>
            </div>

            <div className="bg-white/70 rounded-xl p-3 mb-3">
              <p className="text-[10px] font-bold text-gray-600 mb-1">🔬 LONGEVITY IMPACT</p>
              <p className="text-xs text-gray-700 leading-relaxed">{result.longevityImpact}</p>
            </div>

            <div className="space-y-2">
              <p className="text-[10px] font-bold text-gray-600">💪 HOW TO IMPROVE</p>
              {result.improvements.map((imp, i) => (
                <div key={i} className="flex gap-2 text-xs text-gray-700 bg-white/60 rounded-lg p-2.5">
                  <span className="text-blue-500 shrink-0">→</span>{imp}
                </div>
              ))}
            </div>
          </div>

          <button onClick={() => setResult(null)} className="w-full btn-secondary text-xs py-2">
            <RefreshCw size={12} className="inline mr-1"/> Recalculate
          </button>
        </>
      )}
    </div>
  )
}
