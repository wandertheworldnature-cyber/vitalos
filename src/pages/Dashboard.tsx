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
        referenceRange: r.reference_min != null && r.reference_max != null
          ? `${r.reference_min}-${r.reference_max}` : undefined,
      })))
      setInsights(rawInsights)
      if (rawScore) setScore(rawScore)
    } catch (e) { console.error(e) }
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
      else toast('Upload lab reports first', { icon: 'ℹ️' })
    } catch { toast.error('Add VITE_GROQ_API_KEY to Vercel env vars') }
    finally { setGenerating(false) }
  }

  const critCount = insights.filter(i => i.severity === 'critical').length
  const warnCount = insights.filter(i => i.severity === 'warning').length
  const hasData = metrics.length > 0

  return (
    <div className="p-4 md:p-6 space-y-5 max-w-6xl">

      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-xl md:text-2xl font-bold text-gray-900">
            {getGreeting()}, {user?.full_name?.split(' ')[0] || 'there'} 👋
          </h1>
          <div className="flex flex-wrap items-center gap-2 mt-1">
            {critCount > 0 && (
              <span className="flex items-center gap-1 text-xs text-red-600 font-medium">
                <AlertTriangle size={12} /> {critCount} critical
              </span>
            )}
            {warnCount > 0 && (
              <span className="flex items-center gap-1 text-xs text-amber-600 font-medium">
                <AlertTriangle size={12} /> {warnCount} warning{warnCount > 1 ? 's' : ''}
              </span>
            )}
            {!loading && hasData && critCount === 0 && warnCount === 0 && (
              <span className="flex items-center gap-1 text-xs text-emerald-600 font-medium">
                <CheckCircle size={12} /> All metrics healthy
              </span>
            )}
            {!loading && !hasData && (
              <span className="text-xs text-gray-400">Upload your first lab report to get started</span>
            )}
          </div>
        </div>

        {/* Longevity score — compact on mobile */}
        <div
          className="card py-3 px-4 flex items-center gap-3 cursor-pointer hover:shadow-md transition-shadow shrink-0"
          style={{ background: 'linear-gradient(135deg,#ecfdf5,#d1fae5)', borderColor: '#a7f3d0', minWidth: 140 }}
          onClick={() => navigate('/longevity')}>
          <div className="text-center">
            <p className="text-[10px] text-emerald-700 font-semibold">Longevity score</p>
            <div className="flex items-baseline gap-1">
              <span className="text-4xl font-black text-emerald-600">{score?.score ?? '—'}</span>
              {score?.change > 0 && <span className="text-xs text-emerald-500 font-bold">↑{score.change}</span>}
            </div>
            <p className="text-[10px] text-emerald-600">Full breakdown →</p>
          </div>
          {score?.breakdown && (
            <div className="hidden md:flex items-end gap-1 h-10">
              {Object.entries(score.breakdown).map(([key, val]) => (
                <div key={key} className="flex flex-col items-center gap-0.5">
                  <div className="w-3.5 rounded-t-sm" style={{ height: `${(val / 100) * 40}px`, background: val > 70 ? '#10b981' : val > 50 ? '#f59e0b' : '#ef4444' }} />
                  <span className="text-[7px] text-emerald-700">{key.slice(0, 3)}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Latest metrics */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-bold text-gray-800 flex items-center gap-2">
            <TrendingUp size={15} className="text-teal-600" /> Latest metrics
          </h2>
          <div className="flex gap-2">
            <button onClick={() => navigate('/health-data')}
              className="text-xs text-gray-500 border border-gray-200 px-2.5 py-1 rounded-lg flex items-center gap-1">
              <Plus size={10} /> Add
            </button>
            <button onClick={() => navigate('/trends')}
              className="text-xs text-teal-600 font-semibold flex items-center gap-1">
              All <ArrowRight size={11} />
            </button>
          </div>
        </div>

        {!loading && metrics.length === 0 ? (
          <div className="card border-dashed border-2 border-gray-200 text-center py-8">
            <Activity size={28} className="text-gray-200 mx-auto mb-2" />
            <p className="text-sm font-semibold text-gray-500">No health data yet</p>
            <p className="text-xs text-gray-400 mt-1 mb-3">Upload a lab report to see your metrics</p>
            <div className="flex gap-2 justify-center">
              <button onClick={() => navigate('/reports')} className="btn-primary text-xs py-1.5">Upload report</button>
              <button onClick={() => navigate('/health-data')} className="btn-secondary text-xs py-1.5">Add manually</button>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-2.5">
            {loading
              ? Array.from({ length: 6 }).map((_, i) => <div key={i} className="rounded-2xl bg-gray-100 h-28 animate-pulse" />)
              : metrics.slice(0, 6).map(m => (
                  <MetricCard key={m.id} metric={m} onClick={() => navigate('/trends')} />
                ))
            }
          </div>
        )}
      </div>

      {/* Mobile: Upload + Quick actions row */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">

        {/* Upload */}
        <div className="card border-dashed border-2 border-teal-200 md:col-span-1"
          style={{ background: 'linear-gradient(135deg,#f0fdf8,#ecfdf5)' }}>
          <div className="flex items-center gap-2 mb-2">
            <div className="w-7 h-7 rounded-lg flex items-center justify-center"
              style={{ background: 'linear-gradient(135deg,#0f6e56,#1d9e75)' }}>
              <Upload size={13} className="text-white" />
            </div>
            <h3 className="text-sm font-bold text-gray-800">Upload lab report</h3>
          </div>
          <ReportUpload onUploadComplete={loadData} />
        </div>

        {/* AI Insights */}
        <div className="md:col-span-2 space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-bold text-gray-800 flex items-center gap-2">
              <Sparkles size={15} className="text-purple-500" /> AI health insights
            </h2>
            <button onClick={handleRefreshInsights} disabled={generating}
              className="flex items-center gap-1 text-xs text-gray-500 hover:text-teal-700">
              <RefreshCw size={11} className={generating ? 'animate-spin' : ''} />
              {generating ? 'Analyzing...' : 'Refresh'}
            </button>
          </div>

          {insights.length === 0 && !loading ? (
            <div className="card border-dashed border-2 border-purple-100 text-center py-6">
              <Sparkles size={24} className="text-purple-200 mx-auto mb-2" />
              <p className="text-sm font-semibold text-gray-600">No AI insights yet</p>
              <p className="text-xs text-gray-400 mt-1 mb-3">Upload a lab report to get AI analysis</p>
              <button onClick={handleRefreshInsights} disabled={generating || metrics.length === 0}
                className="btn-primary text-xs py-1.5 disabled:opacity-40">
                {metrics.length === 0 ? 'Upload data first' : 'Generate insights'}
              </button>
            </div>
          ) : (
            <>
              {insights.slice(0, 2).map(i => (
                <InsightCard key={i.id} insight={i} onAction={() => navigate('/insights')} />
              ))}
              {insights.length > 0 && (
                <button onClick={() => navigate('/insights')}
                  className="w-full text-xs text-teal-600 font-semibold flex items-center justify-center gap-1 py-2">
                  View all {insights.length} insights <ArrowRight size={12} />
                </button>
              )}
            </>
          )}
        </div>
      </div>

      {/* Quick actions — only on mobile (desktop has sidebar) */}
      <div className="md:hidden card">
        <h3 className="text-sm font-bold text-gray-800 mb-2">Quick actions</h3>
        <div className="grid grid-cols-2 gap-2">
          {[
            { e: '🩺', l: 'Book a doctor',   a: '/doctors'     },
            { e: '👨‍👩‍👧', l: 'Family health',   a: '/family'      },
            { e: '⏱️', l: 'Health timeline', a: '/timeline'    },
            { e: '📊', l: 'All reports',     a: '/reports'     },
          ].map(item => (
            <button key={item.l} onClick={() => navigate(item.a)}
              className="flex items-center gap-2 text-xs text-gray-600 bg-gray-50 hover:bg-teal-50 hover:text-teal-700 py-2.5 px-3 rounded-xl transition-all">
              <span>{item.e}</span> {item.l}
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}
