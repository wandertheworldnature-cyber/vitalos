import { useState, useEffect } from 'react'
import { useAuthStore } from '@/store/authStore'
import { supabase } from '@/lib/supabase'
import { Cpu, Sliders, TrendingDown, TrendingUp, Zap, AlertTriangle, CheckCircle, RefreshCw, Play } from 'lucide-react'
import toast from 'react-hot-toast'

interface Scenario {
  label: string
  icon: string
  description: string
  params: Record<string, number>
}

interface SimResult {
  scenarioLabel: string
  currentBioAge: number
  projectedBioAge: number
  bioAgeChange: number
  riskChanges: Array<{ condition: string; current: number; projected: number; change: number; unit: string }>
  longevityScoreChange: number
  topBenefits: string[]
  warnings: string[]
  timeToSeeResults: string
  confidence: 'high' | 'moderate' | 'low'
}

const PRESET_SCENARIOS: Scenario[] = [
  { label: 'Lose 10 kg', icon: '⚖️', description: 'What happens if you lose 10 kg over 3 months?', params: { weightLoss: 10, exerciseDaysPerWeek: 5, dietChange: 0.8 } },
  { label: 'Walk 10k steps daily', icon: '🚶', description: 'Add 10,000 steps every day for 90 days', params: { dailySteps: 10000, weightLoss: 2, stressReduction: 0.2 } },
  { label: 'Quit sugar completely', icon: '🚫', description: 'Eliminate added sugars for 90 days', params: { sugarReduction: 1, weightLoss: 3, hba1cChange: -0.5 } },
  { label: 'Sleep 8 hours daily', icon: '😴', description: 'Optimize sleep to 8h for 60 days', params: { sleepHours: 8, stressReduction: 0.3, recoveryBoost: 0.4 } },
  { label: 'Add strength training', icon: '💪', description: '3x/week strength training for 3 months', params: { exerciseDaysPerWeek: 3, weightLoss: 2, muscleGain: 2 } },
  { label: 'Mediterranean diet', icon: '🥗', description: 'Switch to Mediterranean diet for 90 days', params: { dietChange: 1, weightLoss: 3, ldlChange: -15, inflammationChange: -0.3 } },
  { label: 'Meditate daily', icon: '🧘', description: '20 min meditation daily for 60 days', params: { stressReduction: 0.4, sleepBoost: 0.5, hrvBoost: 10 } },
  { label: 'Custom scenario', icon: '🔬', description: 'Build your own simulation', params: {} },
]

const GROQ_URL = 'https://api.groq.com/openai/v1/chat/completions'

export default function DigitalTwinPage() {
  const { user } = useAuthStore()
  const [selected, setSelected] = useState<Scenario | null>(null)
  const [result, setResult] = useState<SimResult | null>(null)
  const [loading, setLoading] = useState(false)
  const [healthData, setHealthData] = useState<{ records: Array<{test_name:string;value:number;unit:string;reference_max?:number|null}>; bioAge: number; chronoAge: number; longevityScore: number }>({ records: [], bioAge: 30, chronoAge: 30, longevityScore: 65 })
  const [customParams, setCustomParams] = useState({ weightLoss: 0, exerciseDays: 3, sleepHours: 7, stressLevel: 5, dietQuality: 5 })

  useEffect(() => { if (user) loadHealthData() }, [user])

  async function loadHealthData() {
    if (!user) return
    const [records, profile, longevity] = await Promise.all([
      supabase.from('health_records').select('test_name,value,unit,reference_max').eq('user_id', user.id).order('recorded_at', { ascending: false }).limit(40),
      supabase.from('profiles').select('date_of_birth').eq('id', user.id).single(),
      supabase.from('health_records').select('value').eq('user_id', user.id).eq('test_name', 'Biological Age').order('recorded_at', { ascending: false }).limit(1),
    ])
    let chronoAge = 30
    if (profile.data?.date_of_birth) chronoAge = Math.floor((Date.now() - new Date(profile.data.date_of_birth).getTime()) / 31557600000)
    const bioAge = (longevity.data?.[0] as { value?: number } | undefined)?.value || chronoAge + 2
    setHealthData({ records: (records.data || []) as Array<{test_name:string;value:number;unit:string;reference_max?:number|null}>, bioAge, chronoAge, longevityScore: 65 })
  }

  async function runSimulation(scenario: Scenario) {
    const key = import.meta.env.VITE_GROQ_API_KEY
    if (!key || key.includes('your-groq')) { toast.error('Add VITE_GROQ_API_KEY to Vercel env vars'); return }
    setLoading(true)
    setResult(null)
    try {
      const recStr = healthData.records.map(r => {
        const hi = r.reference_max && r.value > r.reference_max ? ' [HIGH]' : ''
        return `${r.test_name}: ${r.value} ${r.unit}${hi}`
      }).join('\n')
      const params = scenario.label === 'Custom scenario'
        ? `Weight loss: ${customParams.weightLoss}kg, Exercise: ${customParams.exerciseDays}x/week, Sleep: ${customParams.sleepHours}h, Stress level: ${customParams.stressLevel}/10, Diet quality: ${customParams.dietQuality}/10`
        : Object.entries(scenario.params).map(([k, v]) => `${k}: ${v}`).join(', ')

      const res = await fetch(GROQ_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` },
        body: JSON.stringify({
          model: 'llama-3.3-70b-versatile',
          messages: [{ role: 'user', content: `You are a precision health AI running a simulation for VitalOS "Digital Twin" feature.

CURRENT PATIENT DATA:
- Chronological age: ${healthData.chronoAge} years
- Current biological age: ${healthData.bioAge} years
- Current lab results:
${recStr || 'No lab data available — use reasonable estimates'}

SCENARIO TO SIMULATE: "${scenario.label}"
${scenario.description}
Parameters: ${params}
Duration: 90 days

Simulate realistic health outcomes. Use evidence-based medicine. Be specific with numbers.
For Indian patients, consider relevant conditions (diabetes, thyroid, vitamin D deficiency).

Return ONLY valid JSON:
{
  "scenarioLabel": "${scenario.label}",
  "currentBioAge": ${healthData.bioAge},
  "projectedBioAge": <realistic projected biological age after 90 days>,
  "bioAgeChange": <change in years, negative means younger>,
  "riskChanges": [
    {"condition": "Type 2 Diabetes", "current": 45, "projected": 32, "change": -13, "unit": "% risk"},
    {"condition": "Cardiovascular Disease", "current": 30, "projected": 22, "change": -8, "unit": "% risk"},
    {"condition": "Fasting Glucose", "current": 98, "projected": 89, "change": -9, "unit": "mg/dL"},
    {"condition": "LDL Cholesterol", "current": 140, "projected": 125, "change": -15, "unit": "mg/dL"}
  ],
  "longevityScoreChange": <change in longevity score points, positive is good>,
  "topBenefits": ["specific benefit 1 with numbers","specific benefit 2","specific benefit 3","specific benefit 4"],
  "warnings": ["realistic warning or side effect if any"],
  "timeToSeeResults": "When they'll notice changes, e.g. '2 weeks for energy, 6 weeks for blood markers'",
  "confidence": "high|moderate|low"
}` }],
          max_tokens: 1200, temperature: 0.3,
          response_format: { type: 'json_object' },
        })
      })
      if (!res.ok) throw new Error('API error')
      const data = await res.json() as { choices: Array<{ message: { content: string } }> }
      const sim = JSON.parse(data.choices[0].message.content) as SimResult
      setResult(sim)
      toast.success('Simulation complete!')
    } catch (err) { toast.error('Simulation failed — try again') }
    finally { setLoading(false) }
  }

  const confidenceConfig = { high: { color: '#10b981', label: 'High confidence' }, moderate: { color: '#f59e0b', label: 'Moderate confidence' }, low: { color: '#ef4444', label: 'Low confidence' } }

  return (
    <div className="p-4 pb-8 max-w-2xl mx-auto space-y-5">
      {/* Header */}
      <div className="card !p-5" style={{ background: 'linear-gradient(135deg,#020617,#0f172a)', borderColor: '#1e293b' }}>
        <div className="flex items-start gap-3">
          <div className="w-12 h-12 rounded-xl flex items-center justify-center shrink-0" style={{ background: 'rgba(6,182,212,0.2)' }}>
            <Cpu size={24} className="text-cyan-400" />
          </div>
          <div>
            <div className="flex items-center gap-2 mb-1">
              <h1 className="text-lg font-bold text-white">Digital Twin</h1>
              <span className="text-[10px] bg-cyan-900 text-cyan-300 border border-cyan-700 px-2 py-0.5 rounded-full font-bold">🚀 MOONSHOT</span>
            </div>
            <p className="text-sm text-cyan-300">Simulate your future health. "If I lose 10kg, what happens to my diabetes risk?" — AI runs the numbers on YOUR data.</p>
          </div>
        </div>
        <div className="mt-3 grid grid-cols-3 gap-2">
          {[['Your Bio Age', `${healthData.bioAge} yrs`, '#06b6d4'], ['Records analyzed', `${healthData.records.length}`, '#8b5cf6'], ['Simulations', 'Unlimited', '#10b981']].map(([l, v, c]) => (
            <div key={l} className="rounded-lg p-2 text-center" style={{ background: `${c}15`, border: `1px solid ${c}30` }}>
              <div className="text-sm font-black" style={{ color: c }}>{v}</div>
              <div className="text-[9px] text-gray-400">{l}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Scenario picker */}
      <div>
        <p className="text-sm font-bold text-gray-800 mb-3">Choose a scenario to simulate</p>
        <div className="grid grid-cols-2 gap-2.5">
          {PRESET_SCENARIOS.map(s => (
            <button key={s.label} onClick={() => { setSelected(s); setResult(null) }}
              className={`card !p-3.5 text-left transition-all hover:shadow-md ${selected?.label === s.label ? 'border-cyan-400 ring-1 ring-cyan-100' : ''}`}>
              <span className="text-xl mb-2 block">{s.icon}</span>
              <p className="text-sm font-bold text-gray-900 leading-tight">{s.label}</p>
              <p className="text-[10px] text-gray-400 mt-1 leading-relaxed">{s.description}</p>
            </button>
          ))}
        </div>
      </div>

      {/* Custom params */}
      {selected?.label === 'Custom scenario' && (
        <div className="card !p-4 space-y-3">
          <p className="text-sm font-bold text-gray-800">Custom simulation parameters</p>
          {[
            { label: '⚖️ Weight loss target', key: 'weightLoss', unit: 'kg', min: 0, max: 30 },
            { label: '🏃 Exercise days/week', key: 'exerciseDays', unit: 'days', min: 0, max: 7 },
            { label: '😴 Target sleep hours', key: 'sleepHours', unit: 'hrs', min: 4, max: 10 },
            { label: '🧠 Target stress level', key: 'stressLevel', unit: '/10', min: 1, max: 10 },
            { label: '🥗 Diet quality', key: 'dietQuality', unit: '/10', min: 1, max: 10 },
          ].map(f => (
            <div key={f.key}>
              <div className="flex justify-between mb-1">
                <label className="text-xs text-gray-600">{f.label}</label>
                <span className="text-xs font-bold text-gray-900">{(customParams as Record<string, number>)[f.key]}{f.unit}</span>
              </div>
              <input type="range" min={f.min} max={f.max} value={(customParams as Record<string, number>)[f.key]}
                onChange={e => setCustomParams(p => ({ ...p, [f.key]: parseInt(e.target.value) }))}
                className="w-full h-2 rounded-full appearance-none cursor-pointer"
                style={{ background: `linear-gradient(90deg,#06b6d4 ${(((customParams as Record<string, number>)[f.key] - f.min) / (f.max - f.min)) * 100}%,#e5e7eb ${(((customParams as Record<string, number>)[f.key] - f.min) / (f.max - f.min)) * 100}%)` }} />
            </div>
          ))}
        </div>
      )}

      {/* Run button */}
      {selected && (
        <button onClick={() => runSimulation(selected)} disabled={loading}
          className="w-full py-4 rounded-2xl font-black text-base text-white flex items-center justify-center gap-3 transition-all active:scale-95"
          style={{ background: 'linear-gradient(135deg,#0891b2,#06b6d4)', boxShadow: '0 8px 32px rgba(6,182,212,0.4)' }}>
          {loading ? <><RefreshCw size={20} className="animate-spin" />Simulating your future health...</> : <><Play size={20} />Run simulation: {selected.label}</>}
        </button>
      )}

      {/* Result */}
      {result && (
        <>
          {/* Bio age comparison */}
          <div className="card !p-5" style={{ background: 'linear-gradient(135deg,#020617,#0c1a2e)', borderColor: '#1e3a5f' }}>
            <p className="text-xs font-bold text-cyan-400 mb-4 uppercase tracking-wider">Simulation result: {result.scenarioLabel}</p>
            <div className="flex items-center justify-center gap-6 mb-4">
              <div className="text-center">
                <div className="text-xs text-gray-400 mb-1">Current bio age</div>
                <div className="text-5xl font-black text-white">{result.currentBioAge}</div>
                <div className="text-xs text-gray-500">years</div>
              </div>
              <div className="text-center">
                <div className={`text-3xl font-black ${result.bioAgeChange < 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                  {result.bioAgeChange > 0 ? '+' : ''}{result.bioAgeChange}
                </div>
                <div className="text-xs text-gray-400">bio age change</div>
              </div>
              <div className="text-center">
                <div className="text-xs text-gray-400 mb-1">Projected bio age</div>
                <div className={`text-5xl font-black ${result.projectedBioAge < result.currentBioAge ? 'text-emerald-400' : 'text-red-400'}`}>
                  {result.projectedBioAge}
                </div>
                <div className="text-xs text-gray-500">after 90 days</div>
              </div>
            </div>

            <div className="flex items-center justify-center gap-3 mb-4 flex-wrap">
              <span className={`text-xs px-3 py-1.5 rounded-full font-bold ${result.longevityScoreChange > 0 ? 'bg-emerald-900 text-emerald-300' : 'bg-red-900 text-red-300'}`}>
                Longevity score: {result.longevityScoreChange > 0 ? '+' : ''}{result.longevityScoreChange} pts
              </span>
              {result.confidence && (
                <span className="text-xs px-3 py-1.5 rounded-full font-bold" style={{ background: `${confidenceConfig[result.confidence].color}20`, color: confidenceConfig[result.confidence].color }}>
                  {confidenceConfig[result.confidence].label}
                </span>
              )}
            </div>

            <div className="bg-white/5 rounded-xl p-3 border border-white/10">
              <p className="text-[10px] font-bold text-gray-400 mb-1">⏱ When you'll see results</p>
              <p className="text-sm text-cyan-300">{result.timeToSeeResults}</p>
            </div>
          </div>

          {/* Risk changes */}
          {result.riskChanges?.length > 0 && (
            <div className="card !p-4">
              <p className="text-sm font-bold text-gray-800 mb-3">Health metric projections</p>
              <div className="space-y-3">
                {result.riskChanges.map((r, i) => {
                  const improved = r.change < 0
                  const pct = Math.abs(r.change / r.current) * 100
                  return (
                    <div key={i}>
                      <div className="flex items-center justify-between mb-1">
                        <p className="text-xs font-semibold text-gray-700">{r.condition}</p>
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-gray-400">{r.current} → <strong style={{ color: improved ? '#10b981' : '#ef4444' }}>{r.projected}</strong> {r.unit}</span>
                          <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${improved ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'}`}>
                            {improved ? '↓' : '↑'}{Math.abs(r.change)}{r.unit.includes('%') ? '' : ' ' + r.unit}
                          </span>
                        </div>
                      </div>
                      <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                        <div className="h-full rounded-full transition-all" style={{ width: `${Math.min(100, (r.projected / r.current) * 100)}%`, background: improved ? '#10b981' : '#ef4444' }} />
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {/* Benefits */}
          {result.topBenefits?.length > 0 && (
            <div className="card !p-4" style={{ background: 'linear-gradient(135deg,#ecfdf5,#d1fae5)', borderColor: '#a7f3d0' }}>
              <p className="text-sm font-bold text-emerald-800 mb-2">🎯 Expected benefits</p>
              {result.topBenefits.map((b, i) => (
                <div key={i} className="flex gap-2 text-sm text-emerald-700 mb-2 bg-white/50 rounded-lg p-2.5">
                  <CheckCircle size={14} className="text-emerald-500 shrink-0 mt-0.5" />{b}
                </div>
              ))}
            </div>
          )}

          {result.warnings?.length > 0 && result.warnings[0] !== 'None' && (
            <div className="card !p-4 bg-amber-50 border-amber-100">
              <p className="text-sm font-bold text-amber-800 mb-2">⚠️ Things to note</p>
              {result.warnings.map((w, i) => (
                <div key={i} className="flex gap-2 text-xs text-amber-700 mb-1.5 bg-white/50 rounded-lg p-2.5">
                  <AlertTriangle size={12} className="shrink-0 mt-0.5" />{w}
                </div>
              ))}
            </div>
          )}

          <button onClick={() => { setResult(null); setSelected(null) }} className="w-full btn-secondary text-xs py-2">
            Try another scenario
          </button>

          <p className="text-[10px] text-gray-400 text-center leading-relaxed">
            ⚠️ This is a simulation based on population-level research and your biomarkers. Individual results vary. Consult your doctor before making major lifestyle changes.
          </p>
        </>
      )}
    </div>
  )
}
