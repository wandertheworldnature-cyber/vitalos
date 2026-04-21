import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { RefreshCw, ArrowRight, Sparkles, TrendingUp, AlertTriangle, CheckCircle, Upload } from 'lucide-react'
import { useAuthStore } from '@/store/authStore'
import { getLatestMetrics, getInsights, getLongevityScore, generateInsights } from '@/services/healthService'
import MetricCard from '@/components/MetricCard'
import InsightCard from '@/components/InsightCard'
import ReportUpload from '@/components/ReportUpload'
import type { MetricCard as MetricCardType, AIInsight, LongevityScore } from '@/types'
import toast from 'react-hot-toast'

const DEMO_METRICS: MetricCardType[] = [
  { id:'1', label:'Fasting Glucose', value:98,   unit:'mg/dL', trend:5,  trendDir:'up',     status:'warning',  referenceRange:'70-100' },
  { id:'2', label:'LDL Cholesterol', value:142,  unit:'mg/dL', trend:3,  trendDir:'up',     status:'warning',  referenceRange:'0-130' },
  { id:'3', label:'Hemoglobin',      value:13.8, unit:'g/dL',  trend:-1, trendDir:'down',   status:'normal',   referenceRange:'12-17' },
  { id:'4', label:'TSH',             value:2.4,  unit:'mIU/L', trend:0,  trendDir:'stable', status:'good',     referenceRange:'0.4-4.0' },
  { id:'5', label:'Vitamin D',       value:18,   unit:'ng/mL', trend:-8, trendDir:'down',   status:'critical', referenceRange:'30-100' },
  { id:'6', label:'HbA1c',           value:5.8,  unit:'%',     trend:2,  trendDir:'up',     status:'warning',  referenceRange:'0-5.7' },
]

const DEMO_INSIGHTS: AIInsight[] = [
  { id:'1', user_id:'', severity:'critical', title:'Pre-diabetes trajectory detected',
    description:'Fasting glucose rising 5% every quarter from 88→98 mg/dL. Pre-diabetic threshold (100 mg/dL) may be crossed in 2 quarters.',
    recommendation:'Walk 8,000 steps daily for 30 days. Switch to low-GI diet: replace white rice with millets/brown rice. Retest HbA1c in 3 months.',
    risk_reduction:'−22% risk', related_metrics:['Fasting Glucose','HbA1c'], timeframe:'18 months', generated_at: new Date().toISOString() },
  { id:'2', user_id:'', severity:'critical', title:'Severe Vitamin D deficiency',
    description:'At 18 ng/mL, 40% below minimum (30 ng/mL). Linked to fatigue, impaired insulin sensitivity, and immune dysfunction.',
    recommendation:'15 min direct sunlight 10am–2pm daily. Supplement 60,000 IU D3/week for 8 weeks (doctor supervised).',
    risk_reduction:'−35% bone risk', related_metrics:['Vitamin D'], timeframe:'8 weeks', generated_at: new Date().toISOString() },
  { id:'3', user_id:'', severity:'good', title:'Thyroid function stable',
    description:'TSH at 2.4 mIU/L — optimal range. No evidence of thyroid disorder.',
    recommendation:'Continue current lifestyle. Retest annually.',
    related_metrics:['TSH'], generated_at: new Date().toISOString() },
]

function getHour() { return new Date().getHours() }
function getGreeting() {
  const h = getHour()
  if (h < 12) return 'Good morning'
  if (h < 17) return 'Good afternoon'
  return 'Good evening'
}

export default function Dashboard() {
  const { user } = useAuthStore()
  const navigate = useNavigate()
  const [metrics, setMetrics] = useState<MetricCardType[]>(DEMO_METRICS)
  const [insights, setInsights] = useState<AIInsight[]>(DEMO_INSIGHTS)
  const [score, setScore] = useState<LongevityScore | null>({
    score: 72, change: 3,
    breakdown: { metabolic:65, cardiovascular:70, sleep:58, activity:80, nutrition:68 },
    computed_at: new Date().toISOString(),
  })
  const [generating, setGenerating] = useState(false)

  useEffect(() => {
    if (!user) return
    loadData()
  }, [user])

  async function loadData() {
    if (!user) return
    try {
      const [rawMetrics, rawInsights, rawScore] = await Promise.all([
        getLatestMetrics(user.id),
        getInsights(user.id),
        getLongevityScore(user.id),
      ])
      if (rawMetrics.length > 0) {
        setMetrics(rawMetrics.map(r => ({
          id: r.id, label: r.test_name, value: r.value, unit: r.unit,
          status: getStatus(r.value, r.reference_min, r.reference_max),
          referenceRange: r.reference_min != null && r.reference_max != null ? `${r.reference_min}-${r.reference_max}` : undefined,
        })))
      }
      if (rawInsights.length > 0) setInsights(rawInsights)
      if (rawScore) setScore(rawScore)
    } catch {}
  }

  function getStatus(value: number, min?: number, max?: number): MetricCardType['status'] {
    if (min == null || max == null) return 'normal'
    if (value > max * 1.2 || value < min * 0.8) return 'critical'
    if (value > max || value < min) return 'warning'
    return 'good'
  }

  async function handleRefreshInsights() {
    if (!user) return
    setGenerating(true)
    try {
      const newInsights = await generateInsights(user.id)
      if (newInsights.length > 0) { setInsights(newInsights); toast.success('AI insights refreshed!') }
      else toast('Upload lab reports for personalized insights', { icon: 'ℹ️' })
    } catch { toast.error('Add VITE_GROQ_API_KEY to .env for AI insights') }
    finally { setGenerating(false) }
  }

  const criticalCount = insights.filter(i => i.severity === 'critical').length
  const warningCount = insights.filter(i => i.severity === 'warning').length
  const breakdownEntries = score?.breakdown ? Object.entries(score.breakdown) : []

  return (
    <div className="p-6 space-y-6 max-w-6xl animate-fadeIn">

      {/* Top bar */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">
            {getGreeting()}, {user?.full_name?.split(' ')[0] || 'there'} 👋
          </h1>
          <div className="flex items-center gap-3 mt-1">
            {criticalCount > 0 && (
              <span className="flex items-center gap-1 text-xs text-red-600 font-medium">
                <AlertTriangle size={13} /> {criticalCount} critical alert{criticalCount > 1 ? 's' : ''}
              </span>
            )}
            {warningCount > 0 && (
              <span className="flex items-center gap-1 text-xs text-amber-600 font-medium">
                <AlertTriangle size={13} /> {warningCount} warning{warningCount > 1 ? 's' : ''}
              </span>
            )}
            {criticalCount === 0 && warningCount === 0 && (
              <span className="flex items-center gap-1 text-xs text-emerald-600 font-medium">
                <CheckCircle size={13} /> All metrics looking healthy
              </span>
            )}
          </div>
        </div>

        {/* Longevity Score card */}
        {score && (
          <div className="card py-4 px-5 flex items-center gap-5 min-w-[280px]"
            style={{ background: 'linear-gradient(135deg, #ecfdf5, #d1fae5)', borderColor: '#a7f3d0' }}>
            <div className="text-center">
              <p className="text-xs text-emerald-700 font-semibold mb-1">Longevity score</p>
              <div className="flex items-baseline gap-1.5">
                <span className="text-5xl font-black text-emerald-600">{score.score}</span>
                <span className="text-sm text-emerald-500 font-bold">↑{score.change}</span>
              </div>
              <p className="text-[10px] text-emerald-600 mt-0.5">this month</p>
            </div>
            <div className="flex items-end gap-1.5 h-12">
              {breakdownEntries.map(([key, val]) => (
                <div key={key} className="flex flex-col items-center gap-1">
                  <div className="w-4 rounded-t-sm transition-all"
                    style={{ height: `${(val / 100) * 48}px`, background: val > 70 ? '#10b981' : val > 50 ? '#f59e0b' : '#ef4444' }} />
                  <span className="text-[8px] text-emerald-700 capitalize font-medium">{key.slice(0,3)}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Metrics */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-base font-bold text-gray-800 flex items-center gap-2">
            <TrendingUp size={16} className="text-teal-600" /> Latest metrics
          </h2>
          <button onClick={() => navigate('/health-data')}
            className="text-xs text-teal-600 font-semibold flex items-center gap-1 hover:text-teal-800">
            View all <ArrowRight size={12} />
          </button>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
          {metrics.slice(0, 6).map(m => (
            <MetricCard key={m.id} metric={m} onClick={() => navigate('/trends')} />
          ))}
        </div>
      </div>

      {/* Insights + Upload */}
      <div className="grid grid-cols-3 gap-6">
        <div className="col-span-2 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-bold text-gray-800 flex items-center gap-2">
              <Sparkles size={16} className="text-purple-500" /> AI health insights
            </h2>
            <button onClick={handleRefreshInsights} disabled={generating}
              className="flex items-center gap-1.5 text-xs text-gray-500 hover:text-teal-700 font-medium transition-colors">
              <RefreshCw size={12} className={generating ? 'animate-spin text-teal-500' : ''} />
              {generating ? 'Analyzing...' : 'Refresh'}
            </button>
          </div>
          <div className="space-y-3">
            {insights.slice(0, 3).map(i => (
              <InsightCard key={i.id} insight={i} onAction={() => navigate('/insights')} />
            ))}
            <button onClick={() => navigate('/insights')}
              className="w-full text-sm text-teal-600 hover:text-teal-800 flex items-center justify-center gap-1.5 py-2 font-semibold transition-colors">
              View all insights <ArrowRight size={14} />
            </button>
          </div>
        </div>

        <div className="space-y-4">
          {/* Upload card */}
          <div className="card border-dashed border-2 border-teal-200 hover:border-teal-400 transition-colors"
            style={{ background: 'linear-gradient(135deg, #f0fdf8, #ecfdf5)' }}>
            <div className="flex items-center gap-2 mb-3">
              <div className="w-8 h-8 rounded-lg flex items-center justify-center"
                style={{ background: 'linear-gradient(135deg, #0f6e56, #1d9e75)' }}>
                <Upload size={14} className="text-white" />
              </div>
              <h3 className="text-sm font-bold text-gray-800">Upload report</h3>
            </div>
            <ReportUpload onUploadComplete={loadData} />
          </div>

          {/* Quick actions */}
          <div className="card">
            <h3 className="text-sm font-bold text-gray-800 mb-3">Quick actions</h3>
            <div className="space-y-1.5">
              {[
                { label: '🩺 Book doctor consultation', action: () => navigate('/doctors'), color: 'hover:bg-teal-50 hover:text-teal-700' },
                { label: '📊 Add manual reading',       action: () => navigate('/health-data'), color: 'hover:bg-blue-50 hover:text-blue-700' },
                { label: '👨‍👩‍👧 View family health',      action: () => navigate('/family'),     color: 'hover:bg-purple-50 hover:text-purple-700' },
                { label: '⚡ Upgrade to Pro',           action: () => navigate('/subscription'), color: 'hover:bg-amber-50 hover:text-amber-700' },
              ].map(a => (
                <button key={a.label} onClick={a.action}
                  className={`w-full text-left text-xs text-gray-600 py-2 px-3 rounded-xl flex items-center justify-between transition-all ${a.color}`}>
                  {a.label}
                  <ArrowRight size={11} className="text-gray-300" />
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
