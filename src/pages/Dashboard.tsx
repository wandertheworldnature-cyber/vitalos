import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { RefreshCw, ArrowRight, Sparkles, TrendingUp, AlertTriangle, CheckCircle, Upload, Plus, Activity } from 'lucide-react'
import { useAuthStore } from '@/store/authStore'
import { getLatestMetrics, getInsights, getLongevityScore, generateInsights } from '@/services/healthService'
import MetricCard from '@/components/MetricCard'
import InsightCard from '@/components/InsightCard'
import ReportUpload from '@/components/ReportUpload'
import type { MetricCard as MetricCardType, AIInsight, LongevityScore } from '@/types'
import toast from 'react-hot-toast'

function getGreeting() {
  const h = new Date().getHours()
  if (h < 12) return 'Good morning'
  if (h < 17) return 'Good afternoon'
  return 'Good evening'
}

export default function Dashboard() {
  const { user } = useAuthStore()
  const navigate = useNavigate()
  const [metrics, setMetrics] = useState<MetricCardType[]>([])
  const [insights, setInsights] = useState<AIInsight[]>([])
  const [score, setScore] = useState<LongevityScore | null>(null)
  const [generating, setGenerating] = useState(false)
  const [loading, setLoading] = useState(true)

  useEffect(() => { if (user) loadData() }, [user])

  async function loadData() {
    if (!user) return
    setLoading(true)
    try {
      const [rawMetrics, rawInsights, rawScore] = await Promise.all([
        getLatestMetrics(user.id),
        getInsights(user.id),
        getLongevityScore(user.id),
      ])
      setMetrics(rawMetrics.map(r => ({
        id: r.id, label: r.test_name, value: r.value, unit: r.unit,
        status: calcStatus(r.value, r.reference_min, r.reference_max),
        referenceRange: r.reference_min != null && r.reference_max != null ? `${r.reference_min}-${r.reference_max}` : undefined,
      })))
      setInsights(rawInsights)
      if (rawScore) setScore(rawScore)
    } catch (e) { console.error('Dashboard load error:', e) }
    finally { setLoading(false) }
  }

  function calcStatus(v: number, min?: number | null, max?: number | null): MetricCardType['status'] {
    if (min == null || max == null) return 'normal'
    if (v > max * 1.15 || v < min * 0.85) return 'critical'
    if (v > max || v < min) return 'warning'
    return 'good'
  }

  async function handleRefreshInsights() {
    if (!user) return
    setGenerating(true)
    try {
      const fresh = await generateInsights(user.id)
      if (fresh.length > 0) { setInsights(fresh); toast.success('AI insights refreshed!') }
      else toast('Upload lab reports to get personalized AI insights', { icon: 'ℹ️' })
    } catch { toast.error('Add VITE_GROQ_API_KEY to Vercel environment variables') }
    finally { setGenerating(false) }
  }

  const critCount = insights.filter(i => i.severity === 'critical').length
  const warnCount = insights.filter(i => i.severity === 'warning').length
  const hasData = metrics.length > 0

  return (
    <div className="p-6 space-y-6 max-w-6xl">
      {/* Greeting */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">
            {getGreeting()}, {user?.full_name?.split(' ')[0] || 'there'} 👋
          </h1>
          <div className="flex items-center gap-3 mt-1 flex-wrap">
            {critCount > 0 && <span className="flex items-center gap-1 text-xs text-red-600 font-medium"><AlertTriangle size={13}/>{critCount} critical</span>}
            {warnCount > 0 && <span className="flex items-center gap-1 text-xs text-amber-600 font-medium"><AlertTriangle size={13}/>{warnCount} warning{warnCount>1?'s':''}</span>}
            {!loading && hasData && critCount===0 && warnCount===0 && <span className="flex items-center gap-1 text-xs text-emerald-600 font-medium"><CheckCircle size={13}/>All metrics healthy</span>}
            {!loading && !hasData && <span className="text-xs text-gray-400">Upload your first lab report to see your health data</span>}
          </div>
        </div>

        {/* Longevity score */}
        {score ? (
          <div className="card py-4 px-5 flex items-center gap-5 min-w-[280px] cursor-pointer hover:shadow-md transition-shadow"
            style={{ background:'linear-gradient(135deg,#ecfdf5,#d1fae5)', borderColor:'#a7f3d0' }}
            onClick={() => navigate('/longevity')}>
            <div className="text-center">
              <p className="text-xs text-emerald-700 font-semibold mb-1">Longevity score</p>
              <div className="flex items-baseline gap-1.5">
                <span className="text-5xl font-black text-emerald-600">{score.score}</span>
                {score.change > 0 && <span className="text-sm text-emerald-500 font-bold">↑{score.change}</span>}
              </div>
              <p className="text-[10px] text-emerald-600 mt-0.5">Click for full breakdown →</p>
            </div>
            {score.breakdown && (
              <div className="flex items-end gap-1.5 h-12">
                {Object.entries(score.breakdown).map(([key, val]) => (
                  <div key={key} className="flex flex-col items-center gap-1">
                    <div className="w-4 rounded-t-sm" style={{ height:`${(val/100)*48}px`, background: val>70?'#10b981':val>50?'#f59e0b':'#ef4444' }}/>
                    <span className="text-[8px] text-emerald-700 capitalize">{key.slice(0,3)}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        ) : (
          <div className="card py-4 px-6 text-center cursor-pointer hover:shadow-md"
            style={{ background:'linear-gradient(135deg,#f9fafb,#f3f4f6)', borderColor:'#e5e7eb', minWidth:200 }}
            onClick={() => navigate('/longevity')}>
            <Activity size={24} className="text-gray-300 mx-auto mb-2"/>
            <p className="text-xs font-semibold text-gray-600">Longevity score</p>
            <p className="text-[10px] text-gray-400 mt-1">Upload reports to generate</p>
            <button className="mt-2 text-[11px] text-teal-600 font-semibold hover:underline">Upload now →</button>
          </div>
        )}
      </div>

      {/* Metrics */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-base font-bold text-gray-800 flex items-center gap-2">
            <TrendingUp size={16} className="text-teal-600"/> Latest metrics
            {loading && <span className="text-xs text-gray-400 font-normal">(loading...)</span>}
          </h2>
          <div className="flex gap-2">
            <button onClick={() => navigate('/health-data')}
              className="text-xs text-gray-500 hover:text-gray-700 flex items-center gap-1 border border-gray-200 px-2.5 py-1 rounded-lg">
              <Plus size={11}/> Add reading
            </button>
            <button onClick={() => navigate('/trends')}
              className="text-xs text-teal-600 font-semibold flex items-center gap-1">
              View all <ArrowRight size={12}/>
            </button>
          </div>
        </div>

        {!loading && metrics.length === 0 ? (
          <div className="card border-dashed border-2 border-gray-200 text-center py-10">
            <Activity size={32} className="text-gray-200 mx-auto mb-3"/>
            <p className="text-sm font-semibold text-gray-500">No health data yet</p>
            <p className="text-xs text-gray-400 mt-1 mb-4">Upload a lab report or add readings manually to get started</p>
            <div className="flex gap-3 justify-center">
              <button onClick={() => navigate('/reports')} className="btn-primary text-xs py-2">Upload report</button>
              <button onClick={() => navigate('/health-data')} className="btn-secondary text-xs py-2">Add manually</button>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
            {loading ? Array.from({length:6}).map((_,i) => <div key={i} className="rounded-2xl bg-gray-100 h-32 animate-pulse"/>)
              : metrics.slice(0,6).map(m => <MetricCard key={m.id} metric={m} onClick={() => navigate('/trends')}/>)}
          </div>
        )}
      </div>

      {/* Insights + Upload */}
      <div className="grid grid-cols-3 gap-6">
        <div className="col-span-2 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-bold text-gray-800 flex items-center gap-2">
              <Sparkles size={16} className="text-purple-500"/> AI health insights
            </h2>
            <button onClick={handleRefreshInsights} disabled={generating}
              className="flex items-center gap-1.5 text-xs text-gray-500 hover:text-teal-700 font-medium">
              <RefreshCw size={12} className={generating?'animate-spin text-teal-500':''}/>
              {generating ? 'Analyzing...' : 'Refresh'}
            </button>
          </div>

          {insights.length === 0 && !loading ? (
            <div className="card border-dashed border-2 border-purple-100 text-center py-8">
              <Sparkles size={28} className="text-purple-200 mx-auto mb-2"/>
              <p className="text-sm font-semibold text-gray-600">No AI insights yet</p>
              <p className="text-xs text-gray-400 mt-1 mb-4">Upload a lab report — AI will analyze and generate personalized insights</p>
              <button onClick={handleRefreshInsights} disabled={generating||metrics.length===0}
                className="btn-primary text-xs py-2 disabled:opacity-40">
                {metrics.length===0 ? 'Upload data first' : 'Generate insights'}
              </button>
            </div>
          ) : (
            <div className="space-y-3">
              {insights.slice(0,3).map(i => <InsightCard key={i.id} insight={i} onAction={() => navigate('/insights')}/>)}
              {insights.length > 0 && (
                <button onClick={() => navigate('/insights')}
                  className="w-full text-sm text-teal-600 hover:text-teal-800 flex items-center justify-center gap-1.5 py-2 font-semibold">
                  View all {insights.length} insights <ArrowRight size={14}/>
                </button>
              )}
            </div>
          )}
        </div>

        <div className="space-y-4">
          <div className="card border-dashed border-2 border-teal-200" style={{ background:'linear-gradient(135deg,#f0fdf8,#ecfdf5)' }}>
            <div className="flex items-center gap-2 mb-3">
              <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background:'linear-gradient(135deg,#0f6e56,#1d9e75)' }}>
                <Upload size={14} className="text-white"/>
              </div>
              <h3 className="text-sm font-bold text-gray-800">Upload lab report</h3>
            </div>
            <ReportUpload onUploadComplete={loadData}/>
          </div>

          <div className="card">
            <h3 className="text-sm font-bold text-gray-800 mb-3">Quick actions</h3>
            <div className="space-y-1.5">
              {[
                { e:'🩺', l:'Book a doctor',      a: () => navigate('/doctors'),     c:'hover:bg-teal-50 hover:text-teal-700' },
                { e:'📊', l:'Add manual reading', a: () => navigate('/health-data'), c:'hover:bg-blue-50 hover:text-blue-700' },
                { e:'👨‍👩‍👧', l:'Family health',      a: () => navigate('/family'),      c:'hover:bg-purple-50 hover:text-purple-700' },
                { e:'🔥', l:'Daily habits',       a: () => navigate('/habits'),      c:'hover:bg-orange-50 hover:text-orange-700' },
                { e:'⏱️', l:'Health timeline',    a: () => navigate('/timeline'),    c:'hover:bg-indigo-50 hover:text-indigo-700' },
              ].map(a => (
                <button key={a.l} onClick={a.a}
                  className={`w-full text-left text-xs text-gray-600 py-2 px-3 rounded-xl flex items-center justify-between transition-all ${a.c}`}>
                  <span>{a.e} {a.l}</span>
                  <ArrowRight size={11} className="text-gray-300"/>
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
