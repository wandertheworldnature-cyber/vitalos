import { useState, useEffect } from 'react'
import { useAuthStore } from '@/store/authStore'
import { supabase } from '@/lib/supabase'
import { Sparkles, Brain, TrendingUp, Target, Calendar, Zap, RefreshCw, ChevronRight, Star } from 'lucide-react'
import toast from 'react-hot-toast'

interface CoachPlan {
  greeting: string
  lifeExpectancy: number
  currentAge: number
  bioAge: number
  longevityScore: number
  weeklyFocus: string
  dailyPriorities: string[]
  weeklyGoals: Array<{ goal: string; why: string; impact: string }>
  habitStack: Array<{ time: string; habit: string; duration: string; benefit: string }>
  avoidThisWeek: string[]
  motivationalInsight: string
  nextMilestone: string
}

export default function LongevityCoach() {
  const { user } = useAuthStore()
  const [plan, setPlan] = useState<CoachPlan | null>(null)
  const [generating, setGenerating] = useState(false)
  const [tab, setTab] = useState<'today' | 'goals' | 'habits' | 'vision'>('today')
  const [healthCtx, setHealthCtx] = useState('')
  const [checkIns, setCheckIns] = useState<Record<string, boolean>>({})

  useEffect(() => { if (user) { loadContext(); loadSavedPlan() } }, [user])

  async function loadContext() {
    if (!user) return
    const [records, profile, bioAge, mood, sleep, fitness] = await Promise.all([
      supabase.from('health_records').select('test_name,value,unit,reference_max').eq('user_id', user.id).order('recorded_at', { ascending: false }).limit(30),
      supabase.from('profiles').select('date_of_birth,gender,known_conditions,weight,height').eq('id', user.id).single(),
      supabase.from('health_records').select('value').eq('user_id', user.id).eq('test_name', 'Biological Age').order('recorded_at', { ascending: false }).limit(1),
      supabase.from('health_records').select('value').eq('user_id', user.id).eq('test_name', 'Mood Log').order('recorded_at', { ascending: false }).limit(7),
      supabase.from('health_records').select('value').eq('user_id', user.id).eq('test_name', 'Sleep Duration').order('recorded_at', { ascending: false }).limit(7),
      supabase.from('health_records').select('value,metadata').eq('user_id', user.id).eq('record_type', 'fitness').order('recorded_at', { ascending: false }).limit(5),
    ])

    const age = profile.data?.date_of_birth
      ? Math.floor((Date.now() - new Date(profile.data.date_of_birth).getTime()) / 31557600000) : 30
    const bioAgeVal = (bioAge.data?.[0] as { value?: number } | undefined)?.value || age + 2
    const avgMood = mood.data?.length ? (mood.data.reduce((a: number, b: { value: number }) => a + b.value, 0) / mood.data.length).toFixed(1) : 'N/A'
    const avgSleep = sleep.data?.length ? (sleep.data.reduce((a: number, b: { value: number }) => a + b.value, 0) / sleep.data.length).toFixed(1) : 'N/A'
    const workoutsThisWeek = fitness.data?.length || 0

    const seen = new Map()
    for (const r of (records.data || [])) {
      if (!seen.has(r.test_name)) {
        const hi = r.reference_max && r.value > r.reference_max ? ' [HIGH]' : ''
        seen.set(r.test_name, `${r.test_name}: ${r.value} ${r.unit}${hi}`)
      }
    }

    setHealthCtx(`Age: ${age}, Gender: ${profile.data?.gender||'Unknown'}, Bio Age: ${bioAgeVal}, Weight: ${profile.data?.weight||'?'}kg, Height: ${profile.data?.height||'?'}cm, Conditions: ${profile.data?.known_conditions||'None'}, Avg Mood: ${avgMood}/10, Avg Sleep: ${avgSleep}h, Workouts this week: ${workoutsThisWeek}, Lab markers: ${Array.from(seen.values()).join(', ')}`)
  }

  async function loadSavedPlan() {
    if (!user) return
    const { data } = await supabase.from('profiles').select('longevity_coach_plan').eq('id', user.id).single()
    if (data?.longevity_coach_plan) setPlan(data.longevity_coach_plan as CoachPlan)
  }

  async function generatePlan() {
    if (!healthCtx) { toast.error('Loading health data...'); return }
    const key = import.meta.env.VITE_GROQ_API_KEY
    if (!key) { toast.error('Add VITE_GROQ_API_KEY'); return }
    setGenerating(true)
    try {
      const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` },
        body: JSON.stringify({
          model: 'llama-3.3-70b-versatile',
          messages: [{
            role: 'user',
            content: `You are the VitalOS AI Longevity Coach — the most personalized health AI in India. You know this person's biology, habits, risks, and goals. Create a comprehensive weekly longevity coaching plan.

Patient Data: ${healthCtx}
Today: ${new Date().toLocaleDateString('en-IN', { weekday:'long', day:'numeric', month:'long' })}

Create a deeply personalized longevity coaching plan. Reference actual values from their data. Be specific, warm, motivating.

Return ONLY valid JSON:
{
  "greeting": "Warm personalized 1-sentence greeting using their name if known, referencing one specific health data point",
  "lifeExpectancy": <estimated years based on current biomarkers, realistic>,
  "currentAge": <their chronological age>,
  "bioAge": <their biological age>,
  "longevityScore": <0-100 based on all data>,
  "weeklyFocus": "One theme for this week based on their biggest opportunity",
  "dailyPriorities": ["priority 1 with specific action", "priority 2", "priority 3"],
  "weeklyGoals": [
    {"goal": "Specific measurable goal", "why": "Why this matters for their specific data", "impact": "What it changes"},
    {"goal": "Goal 2", "why": "Why", "impact": "Impact"},
    {"goal": "Goal 3", "why": "Why", "impact": "Impact"}
  ],
  "habitStack": [
    {"time": "6:30 AM", "habit": "Specific habit", "duration": "5 min", "benefit": "Direct benefit"},
    {"time": "8:00 AM", "habit": "Habit 2", "duration": "10 min", "benefit": "Benefit"},
    {"time": "12:00 PM", "habit": "Habit 3", "duration": "2 min", "benefit": "Benefit"},
    {"time": "10:00 PM", "habit": "Habit 4", "duration": "15 min", "benefit": "Benefit"}
  ],
  "avoidThisWeek": ["specific thing to avoid and why", "thing 2", "thing 3"],
  "motivationalInsight": "Deeply personalized insight referencing their actual data — 2 sentences",
  "nextMilestone": "Specific achievable milestone in 30 days based on their data"
}`
          }],
          max_tokens: 1200, temperature: 0.6,
          response_format: { type: 'json_object' }
        })
      })
      const data = await res.json() as { choices: Array<{ message: { content: string } }> }
      const coachPlan = JSON.parse(data.choices[0].message.content) as CoachPlan
      setPlan(coachPlan)
      // Save plan to profile
      if (user) await supabase.from('profiles').update({ longevity_coach_plan: coachPlan }).eq('id', user.id)
      toast.success('Your longevity plan is ready! 🎯')
    } catch (e) { toast.error('Plan generation failed') }
    finally { setGenerating(false) }
  }

  const toggleCheckIn = (habit: string) => setCheckIns(p => ({ ...p, [habit]: !p[habit] }))
  const completedToday = Object.values(checkIns).filter(Boolean).length

  return (
    <div className="p-4 pb-8 max-w-2xl mx-auto space-y-4">
      {/* Header */}
      <div className="card !p-5" style={{ background: 'linear-gradient(135deg,#020617,#0f172a,#0a2018)', borderColor: '#1e3a2e' }}>
        <div className="flex items-start gap-3">
          <div className="w-12 h-12 rounded-xl flex items-center justify-center shrink-0" style={{ background: 'rgba(52,211,153,0.15)' }}>
            <Sparkles size={24} className="text-emerald-400" />
          </div>
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-1">
              <h1 className="text-lg font-bold text-white">AI Longevity Coach</h1>
              <span className="text-[10px] bg-emerald-900 text-emerald-300 border border-emerald-700 px-2 py-0.5 rounded-full font-bold">🌟 Ultimate Vision</span>
            </div>
            <p className="text-sm text-emerald-300">The AI knows your biology, habits, risks, and goals — then continuously guides you toward a longer, healthier life.</p>
          </div>
        </div>

        {plan ? (
          <div className="mt-4 grid grid-cols-3 gap-2">
            {[
              { l: 'Longevity Score', v: `${plan.longevityScore}/100`, c: '#34d399' },
              { l: 'Bio Age',         v: `${plan.bioAge} yrs`,         c: '#60a5fa' },
              { l: 'Est. Lifespan',   v: `${plan.lifeExpectancy} yrs`, c: '#a78bfa' },
            ].map(s => (
              <div key={s.l} className="rounded-lg p-2 text-center bg-white/10">
                <div className="text-base font-black" style={{ color: s.c }}>{s.v}</div>
                <div className="text-[9px] text-gray-400">{s.l}</div>
              </div>
            ))}
          </div>
        ) : (
          <button onClick={generatePlan} disabled={generating}
            className="mt-4 w-full py-3 rounded-xl font-bold text-sm text-white flex items-center justify-center gap-2"
            style={{ background: 'linear-gradient(135deg,#0f6e56,#1d9e75)' }}>
            {generating ? <><RefreshCw size={16} className="animate-spin" />Generating your personalized plan...</> : <><Sparkles size={16} />Generate my longevity plan</>}
          </button>
        )}
      </div>

      {plan && (
        <>
          {/* Greeting */}
          <div className="card !p-4" style={{ background: 'linear-gradient(135deg,#ecfdf5,#d1fae5)', borderColor: '#a7f3d0' }}>
            <p className="text-sm text-emerald-800 leading-relaxed">👋 {plan.greeting}</p>
            <p className="text-xs text-emerald-600 mt-2 font-semibold">This week's focus: {plan.weeklyFocus}</p>
          </div>

          {/* Tabs */}
          <div className="flex gap-1 bg-gray-100 rounded-xl p-1">
            {(['today', 'goals', 'habits', 'vision'] as const).map(t => (
              <button key={t} onClick={() => setTab(t)}
                className={`flex-1 text-[10px] py-2 rounded-lg font-semibold capitalize transition-all ${tab === t ? 'bg-white shadow-sm text-gray-900' : 'text-gray-500'}`}>
                {t === 'today' ? '🌅 Today' : t === 'goals' ? '🎯 Goals' : t === 'habits' ? '⚡ Habits' : '🔮 Vision'}
              </button>
            ))}
          </div>

          {/* TODAY */}
          {tab === 'today' && (
            <div className="space-y-3">
              <div className="card !p-4">
                <div className="flex items-center justify-between mb-3">
                  <p className="text-sm font-bold text-gray-800">Today's priorities</p>
                  <span className="text-xs text-teal-600 font-bold">{completedToday}/{plan.dailyPriorities.length} done</span>
                </div>
                {plan.dailyPriorities.map((p, i) => (
                  <div key={i} onClick={() => toggleCheckIn(`p${i}`)}
                    className={`flex gap-2.5 p-3 rounded-xl mb-2 last:mb-0 cursor-pointer transition-all ${checkIns[`p${i}`] ? 'bg-emerald-50 border border-emerald-100' : 'bg-gray-50 border border-gray-100'}`}>
                    <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 mt-0.5 ${checkIns[`p${i}`] ? 'bg-emerald-500 border-emerald-500' : 'border-gray-300'}`}>
                      {checkIns[`p${i}`] && <span className="text-white text-[10px] font-bold">✓</span>}
                    </div>
                    <p className={`text-sm ${checkIns[`p${i}`] ? 'text-gray-400 line-through' : 'text-gray-700'}`}>{p}</p>
                  </div>
                ))}
              </div>

              <div className="card !p-4 bg-red-50 border-red-100">
                <p className="text-xs font-bold text-red-600 mb-2">🚫 Avoid this week</p>
                {plan.avoidThisWeek.map((a, i) => (
                  <p key={i} className="text-xs text-red-700 mb-1 flex gap-1.5"><span>•</span>{a}</p>
                ))}
              </div>

              <div className="card !p-4" style={{ background: 'linear-gradient(135deg,#1e1b4b,#312e81)', borderColor: '#4338ca' }}>
                <p className="text-xs font-bold text-indigo-300 mb-2 flex items-center gap-1.5"><Brain size={12}/>Coach's insight</p>
                <p className="text-sm text-white leading-relaxed">{plan.motivationalInsight}</p>
              </div>
            </div>
          )}

          {/* GOALS */}
          {tab === 'goals' && (
            <div className="space-y-3">
              {plan.weeklyGoals.map((g, i) => (
                <div key={i} className="card !p-4">
                  <div className="flex items-start gap-3">
                    <div className="w-8 h-8 rounded-full bg-teal-100 flex items-center justify-center text-sm font-black text-teal-700 shrink-0">{i + 1}</div>
                    <div>
                      <p className="text-sm font-bold text-gray-900 mb-1">{g.goal}</p>
                      <p className="text-xs text-gray-500 mb-1"><span className="font-semibold">Why:</span> {g.why}</p>
                      <p className="text-xs text-teal-600 font-medium">→ {g.impact}</p>
                    </div>
                  </div>
                </div>
              ))}
              <div className="card !p-4 bg-amber-50 border-amber-100">
                <p className="text-xs font-bold text-amber-700 mb-1 flex items-center gap-1.5"><Target size={12}/>30-day milestone</p>
                <p className="text-sm text-amber-800">{plan.nextMilestone}</p>
              </div>
            </div>
          )}

          {/* HABITS */}
          {tab === 'habits' && (
            <div className="space-y-3">
              <p className="text-xs text-gray-500">Your personalized habit stack — built around your biology and schedule:</p>
              {plan.habitStack.map((h, i) => (
                <div key={i} onClick={() => toggleCheckIn(`h${i}`)}
                  className={`card !p-4 cursor-pointer transition-all ${checkIns[`h${i}`] ? 'border-emerald-200 bg-emerald-50' : ''}`}>
                  <div className="flex items-center gap-3">
                    <div className="text-center shrink-0">
                      <p className="text-[10px] font-bold text-teal-600">{h.time}</p>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-bold text-gray-900">{h.habit}</p>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className="text-[10px] text-gray-400">{h.duration}</span>
                        <span className="text-[10px] text-teal-600">→ {h.benefit}</span>
                      </div>
                    </div>
                    <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center shrink-0 ${checkIns[`h${i}`] ? 'bg-emerald-500 border-emerald-500' : 'border-gray-200'}`}>
                      {checkIns[`h${i}`] && <span className="text-white text-[10px]">✓</span>}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* VISION */}
          {tab === 'vision' && (
            <div className="space-y-4">
              <div className="card !p-5 text-center" style={{ background: 'linear-gradient(135deg,#020617,#0f172a)', borderColor: '#1e293b' }}>
                <Star size={32} className="text-yellow-400 mx-auto mb-3" />
                <p className="text-4xl font-black text-white mb-2">{plan.lifeExpectancy}</p>
                <p className="text-sm text-gray-400 mb-4">Estimated healthy lifespan based on your current biomarkers</p>
                <div className="bg-white/10 rounded-xl p-4">
                  <div className="flex justify-between text-xs text-gray-400 mb-2">
                    <span>Current age: {plan.currentAge}</span>
                    <span>Bio age: {plan.bioAge}</span>
                    <span>Target: {plan.lifeExpectancy}</span>
                  </div>
                  <div className="h-3 bg-white/20 rounded-full overflow-hidden">
                    <div className="h-full rounded-full bg-gradient-to-r from-emerald-500 to-teal-400"
                      style={{ width: `${(plan.currentAge / plan.lifeExpectancy) * 100}%` }} />
                  </div>
                  <p className="text-[10px] text-gray-500 mt-1 text-center">{plan.lifeExpectancy - plan.currentAge} healthy years ahead</p>
                </div>
              </div>

              <div className="card !p-4">
                <p className="text-sm font-bold text-gray-800 mb-3">What determines your longevity</p>
                {[
                  { factor: 'Genetics',    pct: 20, color: '#8b5cf6', note: 'Fixed — work with it' },
                  { factor: 'Lifestyle',   pct: 40, color: '#10b981', note: 'Sleep, exercise, diet' },
                  { factor: 'Environment', pct: 20, color: '#3b82f6', note: 'Stress, pollution, social' },
                  { factor: 'Healthcare',  pct: 20, color: '#f59e0b', note: 'Preventive care, VitalOS' },
                ].map(f => (
                  <div key={f.factor} className="mb-2">
                    <div className="flex justify-between text-xs mb-1">
                      <span className="font-semibold text-gray-700">{f.factor}</span>
                      <span className="text-gray-400">{f.pct}% · {f.note}</span>
                    </div>
                    <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                      <div className="h-full rounded-full" style={{ width: `${f.pct * 5}%`, background: f.color }} />
                    </div>
                  </div>
                ))}
              </div>

              <button onClick={generatePlan} disabled={generating}
                className="w-full py-3 rounded-xl font-bold text-sm text-white flex items-center justify-center gap-2"
                style={{ background: 'linear-gradient(135deg,#0f6e56,#1d9e75)' }}>
                <RefreshCw size={14} className={generating ? 'animate-spin' : ''} />
                {generating ? 'Regenerating...' : 'Regenerate plan with latest data'}
              </button>
            </div>
          )}
        </>
      )}
    </div>
  )
}
