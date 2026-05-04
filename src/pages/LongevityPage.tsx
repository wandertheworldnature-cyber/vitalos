import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuthStore } from '@/store/authStore'
import { supabase } from '@/lib/supabase'
import { computeLongevityScore } from '@/services/longevityEngine'
import { RefreshCw, Activity, Heart, TrendingUp, Shield, Target, ChevronRight, Brain } from 'lucide-react'

interface LifestyleForm {
  steps: string; sleepHours: string; exerciseDays: string
  dietQuality: 'poor'|'fair'|'good'|'excellent'; age: string
}

const BREAKDOWN_META = [
  { key:'biomarkers',  label:'Biomarkers',        icon:Activity,    color:'#10b981', tip:'Based on lab reports', weight:'40%' },
  { key:'lifestyle',   label:'Lifestyle',          icon:Heart,       color:'#3b82f6', tip:'Steps, sleep, diet',   weight:'25%' },
  { key:'trends',      label:'Trends',             icon:TrendingUp,  color:'#8b5cf6', tip:'Direction of change',  weight:'15%' },
  { key:'preventive',  label:'Preventive',         icon:Shield,      color:'#f59e0b', tip:'Reports & doctor visits',weight:'10%' },
  { key:'consistency', label:'Consistency',        icon:Target,      color:'#ec4899', tip:'Regular tracking',     weight:'10%' },
]

export default function LongevityPage() {
  const { user } = useAuthStore()
  const navigate = useNavigate()
  const [score, setScore] = useState<ReturnType<typeof computeLongevityScore> | null>(null)
  const [loading, setLoading] = useState(true)
  const [computing, setComputing] = useState(false)
  const [showLifestyle, setShowLifestyle] = useState(false)
  const [activeTab, setActiveTab] = useState<'score'|'metrics'|'actions'>('score')
  const [form, setForm] = useState<LifestyleForm>({
    steps:'6000', sleepHours:'7', exerciseDays:'3', dietQuality:'fair', age:'30'
  })

  useEffect(() => { if (user) loadScore() }, [user])

  async function loadScore() {
    if (!user) return
    setLoading(true)
    try {
      const [records, allRecs, reports, appts, insights, profile] = await Promise.all([
        supabase.from('health_records').select('*').eq('user_id', user.id).order('recorded_at', { ascending: false }),
        supabase.from('health_records').select('*').eq('user_id', user.id).order('recorded_at', { ascending: true }),
        supabase.from('health_reports').select('id', { count:'exact', head:true }).eq('user_id', user.id),
        supabase.from('appointments').select('id', { count:'exact', head:true }).eq('user_id', user.id),
        supabase.from('ai_insights').select('id', { count:'exact', head:true }).eq('user_id', user.id),
        supabase.from('profiles').select('created_at,date_of_birth').eq('id', user.id).single(),
      ])
      const seen = new Map()
      for (const r of (records.data || [])) {
        if (!seen.has(r.test_name.toLowerCase())) seen.set(r.test_name.toLowerCase(), r)
      }
      const created = profile.data?.created_at ? new Date(profile.data.created_at) : new Date()
      const accountAgedays = Math.floor((Date.now() - created.getTime()) / 86400000)
      let userAge = parseInt(form.age) || 30
      if (profile.data?.date_of_birth) {
        userAge = Math.floor((Date.now() - new Date(profile.data.date_of_birth).getTime()) / 31557600000)
        setForm(f => ({ ...f, age: String(userAge) }))
      }
      const result = computeLongevityScore({
        latestRecords: Array.from(seen.values()),
        allRecords: allRecs.data || [],
        lifestyle: {
          steps: parseInt(form.steps)||undefined,
          sleepHours: parseFloat(form.sleepHours)||undefined,
          exerciseDaysPerWeek: parseInt(form.exerciseDays)||undefined,
          dietQuality: form.dietQuality,
        },
        reportCount: reports.count||0,
        appointmentCount: appts.count||0,
        insightCount: insights.count||0,
        accountAgedays,
        userAge,
      })
      setScore(result)
    } catch (e) { console.error(e) }
    finally { setLoading(false) }
  }

  async function recompute() { setComputing(true); await loadScore(); setComputing(false) }

  const getColor = (s: number) => s >= 85 ? '#10b981' : s >= 70 ? '#f59e0b' : s >= 50 ? '#f97316' : '#ef4444'
  const getRingOffset = (s: number) => { const c = Math.PI * 2 * 54; return c - (s / 100) * c }

  if (loading) return (
    <div className="p-4 flex flex-col items-center justify-center min-h-[60vh]">
      <div className="w-12 h-12 border-3 border-t-transparent border-teal-500 rounded-full animate-spin mb-3" />
      <p className="text-sm text-gray-400">Computing your longevity score...</p>
    </div>
  )

  return (
    <div className="p-4 pb-6 space-y-4 max-w-2xl mx-auto">
      {/* Header */}
      <div className="flex items-start justify-between gap-2">
        <div>
          <h1 className="text-lg font-bold text-gray-900 flex items-center gap-2">
            <Brain size={18} className="text-teal-600" /> Longevity Score
          </h1>
          <p className="text-xs text-gray-400">Your health future, quantified</p>
        </div>
        <div className="flex gap-2">
          <button onClick={() => setShowLifestyle(s => !s)}
            className="text-xs border border-gray-200 bg-white px-3 py-1.5 rounded-lg text-gray-600">
            Lifestyle
          </button>
          <button onClick={recompute} disabled={computing}
            className="text-xs border border-gray-200 bg-white px-3 py-1.5 rounded-lg text-gray-600">
            <RefreshCw size={12} className={computing ? 'animate-spin' : ''} />
          </button>
        </div>
      </div>

      {/* Lifestyle form */}
      {showLifestyle && (
        <div className="card border-teal-200 !p-4" style={{ background:'linear-gradient(135deg,#f0fdf8,#ecfdf5)' }}>
          <p className="text-xs font-bold text-gray-700 mb-3">Update your lifestyle (affects 25% of score)</p>
          <div className="grid grid-cols-2 gap-2 mb-3">
            {[
              { label:'Daily steps', key:'steps', placeholder:'6000', type:'number' },
              { label:'Sleep (hours)', key:'sleepHours', placeholder:'7', type:'number' },
              { label:'Exercise days/wk', key:'exerciseDays', placeholder:'3', type:'number' },
              { label:'Your age', key:'age', placeholder:'30', type:'number' },
            ].map(f => (
              <div key={f.key}>
                <label className="text-[10px] text-gray-500 mb-1 block">{f.label}</label>
                <input type={f.type} className="input text-sm !py-2"
                  value={(form as Record<string,string>)[f.key]}
                  onChange={e => setForm(p => ({ ...p, [f.key]: e.target.value }))}
                  placeholder={f.placeholder} />
              </div>
            ))}
          </div>
          <div className="mb-3">
            <label className="text-[10px] text-gray-500 mb-1 block">Diet quality</label>
            <div className="grid grid-cols-4 gap-1.5">
              {(['poor','fair','good','excellent'] as const).map(d => (
                <button key={d} onClick={() => setForm(p => ({ ...p, dietQuality: d }))}
                  className={`text-xs py-1.5 rounded-lg capitalize font-medium border transition-colors ${form.dietQuality===d ? 'text-white border-transparent' : 'border-gray-200 text-gray-500'}`}
                  style={form.dietQuality===d ? { background:'linear-gradient(135deg,#0f6e56,#1d9e75)' } : {}}>
                  {d}
                </button>
              ))}
            </div>
          </div>
          <button onClick={recompute} disabled={computing} className="btn-primary w-full text-xs py-2">
            {computing ? 'Computing...' : 'Update score'}
          </button>
        </div>
      )}

      {score && (
        <>
          {/* Hero — Score + Biological Age side by side */}
          <div className="grid grid-cols-2 gap-3">
            {/* Score ring */}
            <div className="card !p-4 flex flex-col items-center justify-center"
              style={{ background:`linear-gradient(135deg,${score.color}10,${score.color}05)`, borderColor:`${score.color}30` }}>
              <div className="relative w-28 h-28 mb-2">
                <svg viewBox="0 0 120 120" className="w-full h-full -rotate-90">
                  <circle cx="60" cy="60" r="54" fill="none" stroke="#f3f4f6" strokeWidth="10"/>
                  <circle cx="60" cy="60" r="54" fill="none" stroke={score.color} strokeWidth="10"
                    strokeDasharray={`${Math.PI*2*54}`}
                    strokeDashoffset={getRingOffset(score.total)}
                    strokeLinecap="round"
                    style={{ transition:'stroke-dashoffset 1s ease' }}/>
                </svg>
                <div className="absolute inset-0 flex flex-col items-center justify-center">
                  <span className="text-3xl font-black" style={{ color:score.color }}>{score.total}</span>
                  <span className="text-[10px] text-gray-400">/100</span>
                </div>
              </div>
              <p className="text-xs font-bold text-gray-800">{score.label}</p>
            </div>

            {/* Biological age */}
            {score.biologicalAge ? (
              <div className="card !p-4 flex flex-col justify-center"
                style={{ background:'linear-gradient(135deg,#1e1b4b,#312e81)', borderColor:'#4338ca' }}>
                <p className="text-[10px] text-indigo-300 font-semibold mb-1">🧬 Biological Age</p>
                <div className="flex items-baseline gap-1">
                  <span className="text-4xl font-black text-white">{score.biologicalAge}</span>
                  <span className="text-sm text-indigo-300">yrs</span>
                </div>
                <p className="text-[10px] text-indigo-300 mt-1 leading-relaxed">
                  {score.biologicalAge < parseInt(form.age||'30')
                    ? `🎉 ${parseInt(form.age)-score.biologicalAge} yrs younger than actual`
                    : `${score.biologicalAge-parseInt(form.age)} yrs older — let's improve`}
                </p>
              </div>
            ) : (
              <div className="card !p-4 flex flex-col items-center justify-center text-center">
                <p className="text-xs text-gray-500 font-semibold mb-1">Enter your age</p>
                <p className="text-[10px] text-gray-400">in Lifestyle to see biological age</p>
              </div>
            )}
          </div>

          {/* Score legend */}
          <div className="card !p-3">
            <div className="grid grid-cols-4 gap-1.5">
              {[
                { range:'85–100', label:'Excellent', color:'#10b981' },
                { range:'70–84',  label:'Good',      color:'#f59e0b' },
                { range:'50–69',  label:'At Risk',   color:'#f97316' },
                { range:'<50',    label:'High Risk',  color:'#ef4444' },
              ].map(r => {
                const isCurrentRange =
                  (r.range === '85–100' && score.total >= 85) ||
                  (r.range === '70–84'  && score.total >= 70 && score.total < 85) ||
                  (r.range === '50–69'  && score.total >= 50 && score.total < 70) ||
                  (r.range === '<50'    && score.total < 50)
                return (
                  <div key={r.range} className={`text-center p-2 rounded-xl ${isCurrentRange ? 'ring-2' : ''}`}
                    style={isCurrentRange ? { ringColor:r.color, background:`${r.color}15` } : {}}>
                    <div className="w-3 h-3 rounded-full mx-auto mb-1" style={{ background:r.color }}/>
                    <p className="text-[9px] font-bold text-gray-700">{r.label}</p>
                    <p className="text-[9px] text-gray-400">{r.range}</p>
                  </div>
                )
              })}
            </div>
          </div>

          {/* Tabs */}
          <div className="flex gap-1 bg-gray-100 rounded-xl p-1">
            {(['score','metrics','actions'] as const).map(t => (
              <button key={t} onClick={() => setActiveTab(t)}
                className={`flex-1 text-[11px] py-2 rounded-lg font-semibold transition-all ${activeTab===t ? 'bg-white shadow-sm text-gray-900' : 'text-gray-500'}`}>
                {t==='score' ? '📊 Breakdown' : t==='metrics' ? '🔬 Metrics' : '⚡ Actions'}
              </button>
            ))}
          </div>

          {/* Score Breakdown */}
          {activeTab === 'score' && (
            <div className="space-y-2.5">
              {BREAKDOWN_META.map(({ key, label, icon:Icon, color, tip, weight }) => {
                const val = score[key as keyof typeof score] as number
                return (
                  <div key={key} className="card !p-4">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0"
                          style={{ background:`${color}20` }}>
                          <Icon size={15} style={{ color }}/>
                        </div>
                        <div>
                          <p className="text-sm font-semibold text-gray-900">{label}</p>
                          <p className="text-[10px] text-gray-400">{tip} · {weight}</p>
                        </div>
                      </div>
                      <div className="text-right shrink-0">
                        <span className="text-2xl font-black" style={{ color:getColor(val) }}>{val}</span>
                        <span className="text-xs text-gray-400">/100</span>
                      </div>
                    </div>
                    <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                      <div className="h-full rounded-full transition-all duration-700"
                        style={{ width:`${val}%`, background:`linear-gradient(90deg,${color}88,${color})` }}/>
                    </div>
                    <div className="flex justify-between mt-1">
                      <span className="text-[10px] text-gray-400">
                        {val>=85?'Excellent':val>=70?'Good':val>=50?'Needs work':'Critical'}
                      </span>
                      <span className="text-[10px] text-gray-400">
                        +{Math.round(val*parseFloat(weight)/100)} pts
                      </span>
                    </div>
                  </div>
                )
              })}
            </div>
          )}

          {/* Metrics */}
          {activeTab === 'metrics' && (
            <div>
              {score.metricScores.length === 0 ? (
                <div className="card border-dashed border-2 text-center py-10">
                  <p className="text-gray-400 text-sm mb-3">No lab data yet</p>
                  <button onClick={() => navigate('/reports')} className="btn-primary text-xs py-2">Upload report</button>
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-2.5">
                  {score.metricScores.map(m => (
                    <div key={m.name} className={`card !p-3 border-l-4 ${
                      m.status==='optimal'?'border-l-emerald-400':m.status==='borderline'?'border-l-amber-400':'border-l-red-400'
                    }`}>
                      <p className="text-[10px] text-gray-500 truncate mb-1">{m.name}</p>
                      <div className="flex items-baseline gap-1">
                        <span className="text-xl font-black text-gray-900">{m.value}</span>
                        <span className="text-[10px] text-gray-400">{m.unit}</span>
                      </div>
                      <div className="flex items-center justify-between mt-1.5">
                        <p className="text-[9px] font-semibold capitalize"
                          style={{ color:m.status==='optimal'?'#10b981':m.status==='borderline'?'#f59e0b':'#ef4444' }}>
                          {m.status==='optimal'?'✓ Optimal':m.status==='borderline'?'⚠ Watch':'⛔ Low'}
                        </p>
                        <span className="text-sm font-bold" style={{ color:getColor(m.score) }}>{m.score}</span>
                      </div>
                      <div className="h-1 bg-gray-100 rounded-full mt-1.5">
                        <div className="h-full rounded-full" style={{ width:`${m.score}%`, background:getColor(m.score) }}/>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Impact Actions */}
          {activeTab === 'actions' && (
            <div className="space-y-2.5">
              <div className="card !p-4" style={{ background:'linear-gradient(135deg,#ecfdf5,#d1fae5)', borderColor:'#a7f3d0' }}>
                <p className="text-sm font-bold text-emerald-800">
                  🎯 How to reach {Math.min(score.total+15,100)} points
                </p>
                <p className="text-xs text-emerald-700 mt-1">
                  These actions can improve your score by up to <strong>+{score.impactActions.reduce((a,b)=>a+b.points,0)} points</strong>
                </p>
              </div>
              {score.impactActions.length === 0 ? (
                <div className="card text-center py-6">
                  <p className="text-gray-400 text-sm">Upload lab reports for personalized actions</p>
                </div>
              ) : score.impactActions.map((action, i) => (
                <div key={i} className="card !p-4 flex items-center gap-3">
                  <span className="text-2xl shrink-0">{action.icon}</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-gray-900 leading-snug">{action.action}</p>
                    <p className="text-[10px] text-gray-400 capitalize mt-0.5">{action.category}</p>
                  </div>
                  <div className="flex items-center gap-0.5 shrink-0">
                    <span className="text-lg font-black text-emerald-600">+{action.points}</span>
                    <span className="text-[10px] text-emerald-600 font-medium">pts</span>
                  </div>
                  <ChevronRight size={14} className="text-gray-300 shrink-0"/>
                </div>
              ))}
              <button onClick={() => navigate('/insights')}
                className="w-full card !p-4 text-center border-dashed border-2 border-purple-100">
                <Brain size={20} className="text-purple-300 mx-auto mb-1.5"/>
                <p className="text-sm font-semibold text-gray-700">Ask AI for a 30-day plan</p>
                <p className="text-xs text-gray-400 mt-0.5">Personalized roadmap to score {Math.min(score.total+15,100)}</p>
              </button>
            </div>
          )}
        </>
      )}
    </div>
  )
}
