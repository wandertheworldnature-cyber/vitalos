import { useState, useEffect } from 'react'
import { useAuthStore } from '@/store/authStore'
import { supabase } from '@/lib/supabase'
import { GitBranch, Zap, TrendingUp, AlertTriangle, Brain, RefreshCw, ChevronRight } from 'lucide-react'
import toast from 'react-hot-toast'

interface DataPoint { name: string; value: number; unit: string; date: string; category: string }
interface Correlation {
  factor1: string; factor2: string; strength: 'strong' | 'moderate' | 'weak'
  direction: 'positive' | 'negative'; insight: string; action: string; confidence: number
}
interface PatternCluster {
  title: string; markers: string[]; pattern: string; riskLevel: 'low' | 'moderate' | 'high'
  recommendation: string; icon: string
}

const KNOWN_CORRELATIONS: Array<{ markers: string[]; insight: string; action: string; risk: PatternCluster['riskLevel']; icon: string; title: string }> = [
  { markers: ['sleep duration', 'mood log', 'stress'],                     title: 'Sleep-Stress-Mood Triangle',    risk: 'high',     icon: '😴', insight: 'Poor sleep → higher stress → lower mood. Breaking this cycle is the #1 mental health lever.', action: 'Fix sleep first. Same wake time daily resets the cycle within 2 weeks.' },
  { markers: ['vitamin d', 'hemoglobin', 'fatigue', 'energy'],             title: 'Fatigue Pattern',               risk: 'moderate', icon: '😩', insight: 'Low Vitamin D + low Hemoglobin = chronic fatigue pattern. Very common in Indian women.', action: 'D3 supplement 2000IU + iron-rich foods. Check B12 if no improvement in 6 weeks.' },
  { markers: ['hba1c', 'fasting glucose', 'weight', 'triglycerides'],      title: 'Metabolic Syndrome Risk',       risk: 'high',     icon: '⚠️', insight: 'Rising glucose + triglycerides + weight = insulin resistance developing. Catch this now.', action: 'Walk 30 min daily after meals. Cut refined carbs by 50%. Recheck HbA1c in 3 months.' },
  { markers: ['crp', 'uric acid', 'ldl', 'cholesterol'],                   title: 'Cardiovascular Inflammation',   risk: 'high',     icon: '💓', insight: 'Elevated CRP + high LDL = chronic inflammation accelerating plaque buildup in arteries.', action: 'Mediterranean diet. Reduce processed foods. Omega-3 2g/day. Consult cardiologist.' },
  { markers: ['tsh', 'vitamin d', 'hemoglobin', 'weight'],                 title: 'Thyroid-Nutrition Pattern',     risk: 'moderate', icon: '⚗️', insight: 'Thyroid issues + nutritional deficiencies often co-occur and amplify each other\'s symptoms.', action: 'Treat thyroid first, then recheck Vitamin D and Hemoglobin — levels often normalize.' },
  { markers: ['creatinine', 'uric acid', 'bun', 'urea'],                   title: 'Kidney Stress Pattern',         risk: 'high',     icon: '🫘', insight: 'Multiple kidney markers elevated suggests cumulative kidney stress. Early detection is critical.', action: 'Increase water to 3L/day. Reduce NSAIDs and protein supplements. Nephrology consult.' },
  { markers: ['daily steps', 'heart rate', 'recovery score', 'hrv'],       title: 'Cardiovascular Fitness',        risk: 'low',      icon: '🏃', insight: 'Steps + HRV correlation indicates your cardiovascular adaptation to exercise load.', action: 'Maintain 7000+ steps/day. HRV trending up means your heart is adapting well.' },
  { markers: ['cortisol', 'sleep duration', 'mood log', 'blood pressure'], title: 'Burnout-Cardiovascular Link',   risk: 'high',     icon: '🔴', insight: 'Chronic stress elevates cortisol → disrupts sleep → raises BP. This is how burnout damages the heart.', action: 'Stress reduction is medical priority. Meditation + sleep + reducing workload.' },
]

const GROQ_URL = 'https://api.groq.com/openai/v1/chat/completions'

function findPatternClusters(data: DataPoint[]): PatternCluster[] {
  const names = data.map(d => d.name.toLowerCase())
  const clusters: PatternCluster[] = []
  for (const kc of KNOWN_CORRELATIONS) {
    const matchCount = kc.markers.filter(m => names.some(n => n.includes(m) || m.includes(n))).length
    if (matchCount >= 2) {
      clusters.push({
        title: kc.title, markers: kc.markers.filter(m => names.some(n => n.includes(m) || m.includes(n))),
        pattern: kc.insight, riskLevel: kc.risk, recommendation: kc.action, icon: kc.icon,
      })
    }
  }
  return clusters.sort((a, b) => { const o = { high: 0, moderate: 1, low: 2 }; return o[a.riskLevel] - o[b.riskLevel] })
}

const RISK_CONFIG = {
  high:     { color: '#ef4444', bg: 'bg-red-50',     border: 'border-red-100',     badge: 'bg-red-100 text-red-700'     },
  moderate: { color: '#f59e0b', bg: 'bg-amber-50',   border: 'border-amber-100',   badge: 'bg-amber-100 text-amber-700' },
  low:      { color: '#10b981', bg: 'bg-emerald-50', border: 'border-emerald-100', badge: 'bg-emerald-100 text-emerald-700' },
}

export default function CorrelationEngine() {
  const { user } = useAuthStore()
  const [data, setData] = useState<DataPoint[]>([])
  const [clusters, setClusters] = useState<PatternCluster[]>([])
  const [aiInsights, setAiInsights] = useState<string[]>([])
  const [loading, setLoading] = useState(true)
  const [analyzing, setAnalyzing] = useState(false)
  const [expanded, setExpanded] = useState<string | null>(null)
  const [selectedCluster, setSelectedCluster] = useState<PatternCluster | null>(null)
  const [deepDive, setDeepDive] = useState('')
  const [diving, setDiving] = useState(false)

  useEffect(() => { if (user) load() }, [user])

  async function load() {
    if (!user) return
    setLoading(true)
    const { data: records } = await supabase.from('health_records')
      .select('test_name,value,unit,recorded_at,record_type')
      .eq('user_id', user.id)
      .order('recorded_at', { ascending: false }).limit(100)

    const seen = new Map<string, DataPoint>()
    for (const r of (records || [])) {
      const key = r.test_name.toLowerCase()
      if (!seen.has(key)) {
        seen.set(key, { name: r.test_name, value: r.value, unit: r.unit || '', date: r.recorded_at.split('T')[0], category: r.record_type || 'lab' })
      }
    }
    const pts = Array.from(seen.values())
    setData(pts)
    setClusters(findPatternClusters(pts))
    setLoading(false)
  }

  async function runAIAnalysis() {
    const key = import.meta.env.VITE_GROQ_API_KEY
    if (!key) { toast.error('Add VITE_GROQ_API_KEY'); return }
    setAnalyzing(true)
    try {
      const dataStr = data.slice(0, 20).map(d => `${d.name}: ${d.value} ${d.unit}`).join('\n')
      const res = await fetch(GROQ_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` },
        body: JSON.stringify({
          model: 'llama-3.3-70b-versatile',
          messages: [{
            role: 'user',
            content: `You are an advanced biomarker correlation AI for VitalOS (Indian health platform). Analyze these health markers and find hidden correlations that a normal doctor might miss. Think like an integrative medicine specialist.\n\nData:\n${dataStr}\n\nFind 4-5 specific correlations between these markers. For each, explain:\n1. Which markers are correlated\n2. What this pattern means physiologically\n3. What the patient should do\n\nRespond as JSON: {"correlations": ["insight 1", "insight 2", ...]}`
          }],
          max_tokens: 600, temperature: 0.4,
          response_format: { type: 'json_object' }
        })
      })
      const raw = await res.json() as { choices: Array<{ message: { content: string } }> }
      const parsed = JSON.parse(raw.choices[0].message.content)
      setAiInsights(parsed.correlations || [])
      toast.success('AI correlation analysis complete!')
    } catch { toast.error('Analysis failed') }
    finally { setAnalyzing(false) }
  }

  async function deepDiveCluster(cluster: PatternCluster) {
    const key = import.meta.env.VITE_GROQ_API_KEY
    if (!key) { toast.error('Add VITE_GROQ_API_KEY'); return }
    setSelectedCluster(cluster)
    setDiving(true)
    setDeepDive('')
    try {
      const relevantData = data.filter(d => cluster.markers.some(m => d.name.toLowerCase().includes(m) || m.includes(d.name.toLowerCase())))
      const dataStr = relevantData.map(d => `${d.name}: ${d.value} ${d.unit}`).join('\n')
      const res = await fetch(GROQ_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` },
        body: JSON.stringify({
          model: 'llama-3.3-70b-versatile',
          messages: [{
            role: 'user',
            content: `Deep dive analysis for "${cluster.title}" pattern in an Indian patient.\n\nRelevant markers:\n${dataStr}\n\nProvide a detailed 4-5 sentence analysis covering:\n1. What this specific pattern means for this patient\n2. The physiological mechanism behind it\n3. Timeline if left untreated\n4. Step-by-step action plan with Indian context\n\nBe specific, use actual values, be actionable.`
          }],
          max_tokens: 400, temperature: 0.5
        })
      })
      const raw = await res.json() as { choices: Array<{ message: { content: string } }> }
      setDeepDive(raw.choices[0].message.content)
    } catch { toast.error('Deep dive failed') }
    finally { setDiving(false) }
  }

  return (
    <div className="p-4 pb-8 max-w-2xl mx-auto space-y-4">
      {/* Header */}
      <div className="card !p-5" style={{ background: 'linear-gradient(135deg,#020617,#0f172a)', borderColor: '#1e293b' }}>
        <div className="flex items-start gap-3">
          <div className="w-12 h-12 rounded-xl flex items-center justify-center shrink-0" style={{ background: 'rgba(6,182,212,0.15)' }}>
            <GitBranch size={24} className="text-cyan-400" />
          </div>
          <div>
            <div className="flex items-center gap-2 mb-1">
              <h1 className="text-lg font-bold text-white">AI Correlation Engine</h1>
              <span className="text-[10px] bg-cyan-900 text-cyan-300 border border-cyan-700 px-2 py-0.5 rounded-full font-bold">Advanced</span>
            </div>
            <p className="text-sm text-cyan-300">Finds hidden patterns between your biomarkers, sleep, mood, fitness and lifestyle that no single doctor sees. Example: "Poor sleep + Vitamin D deficiency + stress = fatigue pattern"</p>
          </div>
        </div>
        <div className="mt-4 grid grid-cols-3 gap-2">
          {[
            { l: 'Data points', v: data.length, c: '#06b6d4' },
            { l: 'Patterns found', v: clusters.length, c: '#8b5cf6' },
            { l: 'High risk', v: clusters.filter(c => c.riskLevel === 'high').length, c: '#ef4444' },
          ].map(s => (
            <div key={s.l} className="rounded-lg p-2 text-center" style={{ background: `${s.c}20`, border: `1px solid ${s.c}30` }}>
              <div className="text-xl font-black" style={{ color: s.c }}>{s.v}</div>
              <div className="text-[9px] text-gray-400">{s.l}</div>
            </div>
          ))}
        </div>
      </div>

      {/* AI Analysis button */}
      <div className="card !p-4">
        <div className="flex items-center justify-between mb-3">
          <div>
            <p className="text-sm font-bold text-gray-800 flex items-center gap-2"><Brain size={14} className="text-cyan-500" />AI deep correlation analysis</p>
            <p className="text-xs text-gray-400">Uses Groq AI to find correlations beyond what's pre-programmed</p>
          </div>
          <button onClick={runAIAnalysis} disabled={analyzing || data.length === 0}
            className="flex items-center gap-1.5 text-xs text-cyan-600 border border-cyan-200 px-3 py-2 rounded-lg hover:bg-cyan-50 disabled:opacity-40 shrink-0">
            <Zap size={12} />{analyzing ? 'Analyzing...' : 'Run AI analysis'}
          </button>
        </div>
        {aiInsights.length > 0 ? (
          <div className="space-y-2">
            {aiInsights.map((insight, i) => (
              <div key={i} className="flex gap-2 text-xs text-gray-700 bg-cyan-50 rounded-lg p-3 border border-cyan-100">
                <span className="text-cyan-500 font-bold shrink-0">{i + 1}.</span>{insight}
              </div>
            ))}
          </div>
        ) : (
          <p className="text-xs text-gray-400">Upload lab reports and track mood/sleep/fitness for at least a week, then run AI analysis to find hidden health patterns.</p>
        )}
      </div>

      {/* Pattern clusters */}
      {loading ? (
        <div className="space-y-2">{[1, 2, 3].map(i => <div key={i} className="card h-24 animate-pulse bg-gray-50" />)}</div>
      ) : clusters.length === 0 ? (
        <div className="card border-dashed border-2 text-center py-12">
          <GitBranch size={32} className="text-gray-200 mx-auto mb-3" />
          <p className="text-sm font-semibold text-gray-600 mb-1">No pattern clusters detected yet</p>
          <p className="text-xs text-gray-400 mb-4">Upload lab reports, track mood, sleep, and fitness for 2+ weeks</p>
        </div>
      ) : (
        <div className="space-y-3">
          <p className="text-xs font-bold text-gray-500 uppercase tracking-wider">{clusters.length} pattern{clusters.length !== 1 ? 's' : ''} detected in your data</p>
          {clusters.map((cluster, i) => {
            const rcfg = RISK_CONFIG[cluster.riskLevel]
            const isExpanded = expanded === cluster.title
            const isSelected = selectedCluster?.title === cluster.title
            return (
              <div key={i} className={`card !p-0 overflow-hidden border ${rcfg.border}`}>
                <div className={`p-4 ${rcfg.bg}`}>
                  <div className="flex items-start gap-3">
                    <span className="text-2xl shrink-0">{cluster.icon}</span>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap mb-1">
                        <p className="text-sm font-bold text-gray-900">{cluster.title}</p>
                        <span className={`text-[9px] px-1.5 py-0.5 rounded font-bold capitalize ${rcfg.badge}`}>{cluster.riskLevel} risk</span>
                      </div>
                      <div className="flex flex-wrap gap-1 mb-2">
                        {cluster.markers.map(m => <span key={m} className="text-[9px] bg-white/70 text-gray-500 px-1.5 py-0.5 rounded border border-gray-100 capitalize">{m}</span>)}
                      </div>
                      <p className="text-xs text-gray-700 leading-relaxed">{cluster.pattern}</p>
                    </div>
                  </div>

                  {isExpanded && (
                    <div className="mt-3 pt-3 border-t border-gray-100">
                      <div className="flex gap-2 items-start mb-3">
                        <TrendingUp size={12} className="text-teal-500 shrink-0 mt-0.5" />
                        <p className="text-xs text-teal-700 font-medium">{cluster.recommendation}</p>
                      </div>
                      {isSelected && deepDive && (
                        <div className="bg-white/70 rounded-xl p-3 border border-gray-100">
                          <p className="text-[10px] font-bold text-gray-500 mb-1.5">🔬 AI Deep Dive</p>
                          <p className="text-xs text-gray-700 leading-relaxed">{deepDive}</p>
                        </div>
                      )}
                      {isSelected && diving && (
                        <div className="flex items-center gap-2 mt-2">
                          <RefreshCw size={12} className="text-cyan-500 animate-spin" />
                          <p className="text-xs text-gray-400">Running deep analysis...</p>
                        </div>
                      )}
                    </div>
                  )}

                  <div className="flex gap-2 mt-3">
                    <button onClick={() => setExpanded(isExpanded ? null : cluster.title)}
                      className="flex items-center gap-1 text-xs text-gray-500 hover:text-gray-700">
                      <ChevronRight size={12} className={`transition-transform ${isExpanded ? 'rotate-90' : ''}`} />
                      {isExpanded ? 'Less' : 'Details'}
                    </button>
                    {isExpanded && (
                      <button onClick={() => deepDiveCluster(cluster)} disabled={diving}
                        className="flex items-center gap-1 text-xs text-cyan-600 hover:text-cyan-700 disabled:opacity-40 ml-auto">
                        <Brain size={12} />{diving && isSelected ? 'Analyzing...' : 'AI Deep Dive'}
                      </button>
                    )}
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
