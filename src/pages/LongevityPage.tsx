import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuthStore } from '@/store/authStore'
import { supabase } from '@/lib/supabase'
import { computeLongevityScore, type LongevityBreakdown } from '@/services/longevityEngine'
import { TrendingUp, Zap, RefreshCw, ChevronRight, Info, Heart, Activity, Brain, Shield, Target } from 'lucide-react'

interface LifestyleForm {
  steps: string
  sleepHours: string
  exerciseDays: string
  dietQuality: 'poor' | 'fair' | 'good' | 'excellent'
  age: string
}

const BREAKDOWN_META = [
  { key: 'biomarkers',  label: 'Biomarkers',         icon: Activity, color: '#10b981', tip: 'Based on your uploaded lab reports',              weight: '40%' },
  { key: 'lifestyle',   label: 'Lifestyle',           icon: Heart,    color: '#3b82f6', tip: 'Steps, sleep, exercise and diet quality',         weight: '25%' },
  { key: 'trends',      label: 'Trends',              icon: TrendingUp,color:'#8b5cf6', tip: 'Direction your health is moving over time',       weight: '15%' },
  { key: 'preventive',  label: 'Preventive Actions',  icon: Shield,   color: '#f59e0b', tip: 'Reports uploaded, doctor visits, plan adherence', weight: '10%' },
  { key: 'consistency', label: 'Consistency',         icon: Target,   color: '#ec4899', tip: 'Regular app usage and health tracking',           weight: '10%' },
]

export default function LongevityPage() {
  const { user } = useAuthStore()
  const navigate = useNavigate()
  const [score, setScore] = useState<LongevityBreakdown | null>(null)
  const [loading, setLoading] = useState(true)
  const [computing, setComputing] = useState(false)
  const [showLifestyle, setShowLifestyle] = useState(false)
  const [form, setForm] = useState<LifestyleForm>({
    steps: '6000', sleepHours: '6.5', exerciseDays: '2', dietQuality: 'fair', age: '30'
  })
  const [activeTab, setActiveTab] = useState<'score' | 'metrics' | 'actions'>('score')

  useEffect(() => { if (user) loadScore() }, [user])

  async function loadScore() {
    if (!user) return
    setLoading(true)
    try {
      // Load all data in parallel
      const [records, allRecords, reports, appointments, insights, profile] = await Promise.all([
        supabase.from('health_records').select('*').eq('user_id', user.id)
          .order('recorded_at', { ascending: false }),
        supabase.from('health_records').select('*').eq('user_id', user.id)
          .order('recorded_at', { ascending: true }),
        supabase.from('health_reports').select('id', { count: 'exact', head: true }).eq('user_id', user.id),
        supabase.from('appointments').select('id', { count: 'exact', head: true }).eq('user_id', user.id),
        supabase.from('ai_insights').select('id', { count: 'exact', head: true }).eq('user_id', user.id),
        supabase.from('profiles').select('created_at, date_of_birth').eq('id', user.id).single(),
      ])

      // Latest unique metrics
      const seen = new Map()
      for (const r of (records.data || [])) {
        if (!seen.has(r.test_name.toLowerCase())) seen.set(r.test_name.toLowerCase(), r)
      }
      const latestRecords = Array.from(seen.values())

      // Account age in days
      const created = profile.data?.created_at ? new Date(profile.data.created_at) : new Date()
      const accountAgedays = Math.floor((Date.now() - created.getTime()) / 86400000)

      // User age from DOB
      let userAge: number | undefined
      if (profile.data?.date_of_birth) {
        const dob = new Date(profile.data.date_of_birth)
        userAge = Math.floor((Date.now() - dob.getTime()) / 31557600000)
      } else if (form.age) {
        userAge = parseInt(form.age)
      }

      const breakdown = computeLongevityScore({
        latestRecords,
        allRecords: allRecords.data || [],
        lifestyle: {
          steps: parseInt(form.steps) || undefined,
          sleepHours: parseFloat(form.sleepHours) || undefined,
          exerciseDaysPerWeek: parseInt(form.exerciseDays) || undefined,
          dietQuality: form.dietQuality,
        },
        reportCount: reports.count || 0,
        appointmentCount: appointments.count || 0,
        insightCount: insights.count || 0,
        accountAgedays,
        userAge,
      })

      setScore(breakdown)

      // Save to DB
      await supabase.from('longevity_scores').insert({
        user_id: user.id,
        score: breakdown.total,
        change: 0,
        breakdown: {
          metabolic: breakdown.biomarkers,
          cardiovascular: breakdown.biomarkers,
          sleep: breakdown.lifestyle,
          activity: breakdown.lifestyle,
          nutrition: breakdown.lifestyle,
        },
        computed_at: new Date().toISOString(),
      })
    } catch (e) { console.error(e) }
    finally { setLoading(false) }
  }

  async function recompute() {
    setComputing(true)
    await loadScore()
    setComputing(false)
  }

  const getColor = (s: number) =>
    s >= 85 ? '#10b981' : s >= 70 ? '#f59e0b' : s >= 50 ? '#f97316' : '#ef4444'

  const getRing = (s: number) => {
    const c = Math.PI * 2 * 54
    return c - (s / 100) * c
  }

  if (loading) {
    return (
      <div className="p-6 max-w-4xl">
        <div className="flex items-center gap-3 mb-6">
          <Brain size={22} className="text-teal-600" />
          <h1 className="text-xl font-bold text-gray-900">Longevity Score</h1>
        </div>
        <div className="grid grid-cols-3 gap-4">
          {[1,2,3,4,5,6].map(i => <div key={i} className="card h-32 animate-pulse bg-gray-100" />)}
        </div>
      </div>
    )
  }

  return (
    <div className="p-6 max-w-5xl space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Brain size={22} className="text-teal-600" />
          <h1 className="text-xl font-bold text-gray-900">Longevity Score</h1>
          <span className="text-xs text-gray-400 font-normal">Your health future, quantified</span>
        </div>
        <div className="flex gap-2">
          <button onClick={() => setShowLifestyle(s => !s)}
            className="btn-secondary text-xs py-2 flex items-center gap-1.5">
            <Activity size={13} /> Update lifestyle
          </button>
          <button onClick={recompute} disabled={computing}
            className="btn-secondary text-xs py-2 flex items-center gap-1.5">
            <RefreshCw size={13} className={computing ? 'animate-spin' : ''} />
            {computing ? 'Computing...' : 'Recompute'}
          </button>
        </div>
      </div>

      {/* Lifestyle input panel */}
      {showLifestyle && (
        <div className="card border-teal-200" style={{ background: 'linear-gradient(135deg,#f0fdf8,#ecfdf5)' }}>
          <h3 className="text-sm font-bold text-gray-800 mb-3">Your lifestyle (affects 25% of score)</h3>
          <div className="grid grid-cols-5 gap-3">
            <div>
              <label className="text-xs text-gray-500 mb-1 block">Daily steps</label>
              <input type="number" className="input text-sm" value={form.steps}
                onChange={e => setForm(f => ({ ...f, steps: e.target.value }))} placeholder="6000" />
            </div>
            <div>
              <label className="text-xs text-gray-500 mb-1 block">Sleep (hours)</label>
              <input type="number" step="0.5" className="input text-sm" value={form.sleepHours}
                onChange={e => setForm(f => ({ ...f, sleepHours: e.target.value }))} placeholder="7" />
            </div>
            <div>
              <label className="text-xs text-gray-500 mb-1 block">Exercise days/wk</label>
              <input type="number" min="0" max="7" className="input text-sm" value={form.exerciseDays}
                onChange={e => setForm(f => ({ ...f, exerciseDays: e.target.value }))} placeholder="3" />
            </div>
            <div>
              <label className="text-xs text-gray-500 mb-1 block">Diet quality</label>
              <select className="input text-sm" value={form.dietQuality}
                onChange={e => setForm(f => ({ ...f, dietQuality: e.target.value as LifestyleForm['dietQuality'] }))}>
                <option value="poor">Poor</option>
                <option value="fair">Fair</option>
                <option value="good">Good</option>
                <option value="excellent">Excellent</option>
              </select>
            </div>
            <div>
              <label className="text-xs text-gray-500 mb-1 block">Your age</label>
              <input type="number" className="input text-sm" value={form.age}
                onChange={e => setForm(f => ({ ...f, age: e.target.value }))} placeholder="30" />
            </div>
          </div>
          <button onClick={recompute} disabled={computing}
            className="btn-primary mt-3 text-xs py-2">
            {computing ? 'Computing...' : 'Update & recompute score'}
          </button>
        </div>
      )}

      {score && (
        <>
          {/* Hero score + biological age */}
          <div className="grid grid-cols-3 gap-5">
            {/* Big score ring */}
            <div className="card col-span-1 flex flex-col items-center justify-center py-6"
              style={{ background: `linear-gradient(135deg, ${score.color}10, ${score.color}05)`, borderColor: `${score.color}30` }}>
              <div className="relative w-40 h-40 mb-4">
                <svg viewBox="0 0 120 120" className="w-full h-full -rotate-90">
                  <circle cx="60" cy="60" r="54" fill="none" stroke="#f3f4f6" strokeWidth="10" />
                  <circle cx="60" cy="60" r="54" fill="none" stroke={score.color} strokeWidth="10"
                    strokeDasharray={`${Math.PI * 2 * 54}`}
                    strokeDashoffset={getRing(score.total)}
                    strokeLinecap="round"
                    style={{ transition: 'stroke-dashoffset 1s ease' }} />
                </svg>
                <div className="absolute inset-0 flex flex-col items-center justify-center">
                  <span className="text-5xl font-black" style={{ color: score.color }}>{score.total}</span>
                  <span className="text-xs text-gray-400 font-medium">/ 100</span>
                </div>
              </div>
              <p className="text-sm font-bold text-gray-800">{score.label}</p>
              <p className="text-xs text-gray-400 mt-1">Longevity Score</p>
            </div>

            {/* Biological age + breakdown */}
            <div className="col-span-2 grid grid-cols-2 gap-4">
              {/* Biological age card */}
              {score.biologicalAge && (
                <div className="card flex flex-col justify-center"
                  style={{ background: 'linear-gradient(135deg,#1e1b4b,#312e81)', borderColor: '#4338ca' }}>
                  <p className="text-xs text-indigo-300 mb-1 font-semibold">🧬 Biological Age</p>
                  <div className="flex items-baseline gap-2">
                    <span className="text-5xl font-black text-white">{score.biologicalAge}</span>
                    <span className="text-lg text-indigo-300">yrs</span>
                  </div>
                  <p className="text-xs text-indigo-300 mt-2">
                    {score.biologicalAge < parseInt(form.age || '30')
                      ? `🎉 ${parseInt(form.age) - score.biologicalAge} years younger than actual age`
                      : `${score.biologicalAge - parseInt(form.age)} years older than actual age — let's fix this`}
                  </p>
                  <p className="text-[10px] text-indigo-400 mt-1">Formula: Age − ((Score − 50) / 5)</p>
                </div>
              )}

              {/* Score interpretation */}
              <div className="card flex flex-col justify-between">
                <div>
                  <p className="text-xs font-semibold text-gray-500 mb-2">What this means</p>
                  <div className="space-y-1.5">
                    {[
                      { range: '85–100', label: 'Excellent 🟢', desc: 'On track for long life' },
                      { range: '70–84',  label: 'Good 🟡',      desc: 'Minor areas to improve' },
                      { range: '50–69',  label: 'At Risk 🟠',   desc: 'Action needed soon' },
                      { range: '<50',    label: 'High Risk 🔴', desc: 'See a doctor now' },
                    ].map(r => (
                      <div key={r.range} className={`flex items-center gap-2 text-xs p-1.5 rounded-lg ${score.total >= parseInt(r.range.split('–')[0]) && (r.range.includes('–') ? score.total <= parseInt(r.range.split('–')[1]) : true) ? 'bg-gray-100 font-bold' : ''}`}>
                        <span className="text-gray-400 w-12 shrink-0">{r.range}</span>
                        <span className="text-gray-700">{r.label}</span>
                        <span className="text-gray-400 text-[10px]">{r.desc}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Quick stats */}
              <div className="col-span-2 grid grid-cols-3 gap-3">
                {[
                  { label: 'Metrics tracked', value: score.metricScores.length, icon: '🔬' },
                  { label: 'Optimal metrics', value: score.metricScores.filter(m => m.status === 'optimal').length, icon: '✅' },
                  { label: 'Need attention', value: score.metricScores.filter(m => m.status === 'concerning').length, icon: '⚠️' },
                ].map(s => (
                  <div key={s.label} className="card py-3 text-center">
                    <p className="text-2xl mb-1">{s.icon}</p>
                    <p className="text-xl font-bold text-gray-900">{s.value}</p>
                    <p className="text-[10px] text-gray-400">{s.label}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Tabs */}
          <div className="flex gap-1 bg-gray-100 rounded-xl p-1">
            {(['score', 'metrics', 'actions'] as const).map(t => (
              <button key={t} onClick={() => setActiveTab(t)}
                className={`flex-1 text-xs py-2 rounded-lg font-medium capitalize transition-all ${activeTab === t ? 'bg-white shadow-sm text-gray-900' : 'text-gray-500'}`}>
                {t === 'score' ? '📊 Score Breakdown' : t === 'metrics' ? '🔬 Lab Metrics' : '⚡ Score Impact'}
              </button>
            ))}
          </div>

          {/* Tab: Score Breakdown */}
          {activeTab === 'score' && (
            <div className="space-y-3">
              {BREAKDOWN_META.map(({ key, label, icon: Icon, color, tip, weight }) => {
                const val = score[key as keyof LongevityBreakdown] as number
                return (
                  <div key={key} className="card">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: `${color}20` }}>
                          <Icon size={15} style={{ color }} />
                        </div>
                        <div>
                          <p className="text-sm font-semibold text-gray-900">{label}</p>
                          <p className="text-[10px] text-gray-400">{tip} · Weight: {weight}</p>
                        </div>
                      </div>
                      <div className="text-right">
                        <span className="text-2xl font-black" style={{ color: getColor(val) }}>{val}</span>
                        <span className="text-xs text-gray-400">/100</span>
                      </div>
                    </div>
                    <div className="h-2.5 bg-gray-100 rounded-full overflow-hidden">
                      <div className="h-full rounded-full transition-all duration-700"
                        style={{ width: `${val}%`, background: `linear-gradient(90deg, ${color}88, ${color})` }} />
                    </div>
                    <div className="flex justify-between mt-1">
                      <span className="text-[10px] text-gray-400">
                        {val >= 85 ? 'Excellent' : val >= 70 ? 'Good' : val >= 50 ? 'Needs work' : 'Critical'}
                      </span>
                      <span className="text-[10px] text-gray-400">
                        Contributes {Math.round(val * parseFloat(weight) / 100)} pts to total
                      </span>
                    </div>
                  </div>
                )
              })}
            </div>
          )}

          {/* Tab: Lab Metrics */}
          {activeTab === 'metrics' && (
            <div>
              {score.metricScores.length === 0 ? (
                <div className="card border-dashed border-2 text-center py-12">
                  <p className="text-gray-400 text-sm mb-3">No lab data yet — upload a report to see metric scores</p>
                  <button onClick={() => navigate('/reports')} className="btn-primary text-xs py-2">Upload lab report</button>
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-3">
                  {score.metricScores.map(m => (
                    <div key={m.name} className={`card border-l-4 ${m.status === 'optimal' ? 'border-l-emerald-400' : m.status === 'borderline' ? 'border-l-amber-400' : 'border-l-red-400'}`}>
                      <div className="flex items-start justify-between mb-2">
                        <div>
                          <p className="text-sm font-semibold text-gray-900">{m.name}</p>
                          <div className="flex items-baseline gap-1">
                            <span className="text-xl font-black text-gray-900">{m.value}</span>
                            <span className="text-xs text-gray-400">{m.unit}</span>
                          </div>
                        </div>
                        <div className="text-right">
                          <span className="text-lg font-bold" style={{ color: getColor(m.score) }}>{m.score}</span>
                          <p className="text-[10px] text-gray-400">score</p>
                        </div>
                      </div>
                      <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                        <div className="h-full rounded-full" style={{ width: `${m.score}%`, background: getColor(m.score) }} />
                      </div>
                      <p className="text-[10px] mt-1 capitalize font-medium"
                        style={{ color: m.status === 'optimal' ? '#10b981' : m.status === 'borderline' ? '#f59e0b' : '#ef4444' }}>
                        {m.status === 'optimal' ? '✓ Optimal' : m.status === 'borderline' ? '⚠ Borderline' : '⛔ Concerning'}
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Tab: Impact Actions */}
          {activeTab === 'actions' && (
            <div className="space-y-3">
              <div className="card" style={{ background: 'linear-gradient(135deg,#ecfdf5,#d1fae5)', borderColor: '#a7f3d0' }}>
                <p className="text-sm font-bold text-emerald-800 mb-1">
                  🎯 How to reach {Math.min(score.total + 15, 100)} points
                </p>
                <p className="text-xs text-emerald-700">
                  Follow these actions to improve your longevity score by up to <strong>+{score.impactActions.reduce((a,b) => a+b.points, 0)} points</strong> in 30–90 days.
                </p>
              </div>

              {score.impactActions.length === 0 ? (
                <div className="card text-center py-8">
                  <p className="text-gray-400 text-sm">Upload lab reports to get personalized impact actions</p>
                </div>
              ) : (
                score.impactActions.map((action, i) => (
                  <div key={i} className="card flex items-center gap-4 hover:shadow-md transition-shadow cursor-pointer">
                    <span className="text-2xl">{action.icon}</span>
                    <div className="flex-1">
                      <p className="text-sm font-semibold text-gray-900">{action.action}</p>
                      <p className="text-xs text-gray-400 capitalize">{action.category} improvement</p>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      <span className="text-lg font-black text-emerald-600">+{action.points}</span>
                      <span className="text-xs text-emerald-600 font-medium">pts</span>
                    </div>
                    <ChevronRight size={16} className="text-gray-300" />
                  </div>
                ))
              )}

              <div className="card border-dashed border-2 border-purple-100 text-center py-5">
                <Brain size={24} className="text-purple-300 mx-auto mb-2" />
                <p className="text-sm font-semibold text-gray-700 mb-1">Ask AI how to reach {Math.min(score.total + 15, 100)}</p>
                <p className="text-xs text-gray-400 mb-3">Get a personalized 30-day plan based on your health data</p>
                <button onClick={() => navigate('/insights')} className="btn-primary text-xs py-2">
                  Open AI Health Advisor
                </button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}
