import { useState, useEffect } from 'react'
import { useAuthStore } from '@/store/authStore'
import { supabase } from '@/lib/supabase'
import { FlaskConical, TrendingUp, TrendingDown, AlertTriangle, CheckCircle, Brain, Zap } from 'lucide-react'
import toast from 'react-hot-toast'

interface Biomarker {
  name: string
  value: number
  unit: string
  category: string
  status: 'optimal' | 'normal' | 'borderline' | 'high' | 'low' | 'critical'
  refMin: number | null
  refMax: number | null
  optimalMin?: number
  optimalMax?: number
  date: string
  trend?: 'up' | 'down' | 'stable'
  trendPct?: number
  insight: string
  action: string
}

interface BiomarkerCategory {
  name: string
  icon: string
  color: string
  markers: string[]
}

const CATEGORIES: BiomarkerCategory[] = [
  { name: 'Inflammation', icon: '🔥', color: '#ef4444', markers: ['CRP', 'C-Reactive Protein', 'ESR', 'Ferritin', 'IL-6'] },
  { name: 'Hormones', icon: '⚗️', color: '#8b5cf6', markers: ['TSH', 'T3', 'T4', 'Free T3', 'Free T4', 'Testosterone', 'Cortisol', 'Estradiol', 'Prolactin', 'FSH', 'LH'] },
  { name: 'Vitamins', icon: '💊', color: '#f59e0b', markers: ['Vitamin D', '25-OH Vitamin D', 'Vitamin B12', 'Folate', 'Vitamin B9', 'Ferritin'] },
  { name: 'Liver', icon: '🫀', color: '#f97316', markers: ['ALT', 'AST', 'SGPT', 'SGOT', 'ALP', 'Bilirubin', 'GGT', 'Albumin', 'Total Protein'] },
  { name: 'Kidney', icon: '🫘', color: '#06b6d4', markers: ['Creatinine', 'BUN', 'Urea', 'Uric Acid', 'eGFR', 'Cystatin C'] },
  { name: 'Metabolic', icon: '⚡', color: '#10b981', markers: ['HbA1c', 'Fasting Glucose', 'Insulin', 'HOMA-IR', 'LDL', 'HDL', 'Triglycerides', 'Total Cholesterol'] },
  { name: 'Blood', icon: '💉', color: '#dc2626', markers: ['Hemoglobin', 'WBC', 'RBC', 'Platelets', 'Hematocrit', 'MCV', 'MCH', 'MCHC', 'Neutrophils', 'Lymphocytes'] },
]

const OPTIMAL_RANGES: Record<string, { min: number; max: number; insight: string; action: string }> = {
  'Vitamin D': { min:40, max:80, insight:'Optimal range for Indians is 40-80 ng/mL. Deficiency causes fatigue, weak immunity, bone loss.', action:'15 min sunlight daily + D3 2000IU supplement if <30' },
  'Vitamin B12': { min:400, max:900, insight:'Optimal B12 for Indians (many vegetarian) is 400-900 pg/mL. Low B12 causes nerve damage, fatigue.', action:'B12 supplement or weekly eggs/meat/dairy. Methylcobalamin form is best absorbed.' },
  'TSH': { min:1, max:2.5, insight:'Optimal TSH is 1-2.5 mIU/L. High TSH = hypothyroid (fatigue, weight gain). India has 42M thyroid patients.', action:'Annual thyroid check. If >4, consult endocrinologist for treatment.' },
  'CRP': { min:0, max:1, insight:'CRP <1 mg/L = low inflammation. 1-3 = moderate. >3 = high chronic inflammation accelerating aging.', action:'Eliminate processed food, add turmeric/ginger. Lose weight if overweight — fat tissue produces inflammation.' },
  'HbA1c': { min:4.6, max:5.4, insight:'Optimal HbA1c is <5.4%. 5.7-6.4% = pre-diabetes. India has world\'s largest diabetic population.', action:'Walk 30 min daily, reduce refined carbs (white rice, maida), increase fiber intake.' },
  'LDL': { min:0, max:100, insight:'Optimal LDL <100 mg/dL for general health, <70 for heart risk. Each 1% LDL drop = 1% heart risk drop.', action:'Mediterranean diet, reduce saturated fats. 5g fiber daily from oats reduces LDL by 5%.' },
  'HDL': { min:60, max:100, insight:'Higher HDL is better — it removes LDL from arteries. Most Indians have low HDL (<40).', action:'Exercise 150 min/week, olive oil, nuts, moderate alcohol (optional). Smoking kills HDL.' },
  'Ferritin': { min:50, max:150, insight:'Ferritin is iron storage. Low = anemia risk (very common in Indian women). High = inflammation/liver issue.', action:'Spinach, rajma, meat for low ferritin. Vitamin C with iron foods doubles absorption.' },
  'Uric Acid': { min:3.5, max:6.5, insight:'High uric acid causes gout and kidney stones. Rising in India due to high fructose corn syrup consumption.', action:'Reduce red meat, alcohol, sweet drinks. Increase water to 3L/day. Cherry extract helps.' },
}

function classifyBiomarker(name: string, value: number, refMin: number|null, refMax: number|null): Biomarker['status'] {
  const optimal = OPTIMAL_RANGES[name]
  if (optimal) {
    if (value < optimal.min * 0.7 || value > optimal.max * 1.5) return 'critical'
    if (value >= optimal.min && value <= optimal.max) return 'optimal'
    if (value < optimal.min) return 'low'
    return 'borderline'
  }
  if (!refMin && !refMax) return 'normal'
  if ((refMax && value > refMax * 1.3) || (refMin && value < refMin * 0.7)) return 'critical'
  if (refMax && value > refMax) return 'high'
  if (refMin && value < refMin) return 'low'
  return 'normal'
}

const STATUS_CONFIG = {
  optimal:    { color:'#10b981', bg:'bg-emerald-50',  badge:'bg-emerald-100 text-emerald-700',  label:'Optimal'    },
  normal:     { color:'#3b82f6', bg:'bg-blue-50',     badge:'bg-blue-100 text-blue-700',        label:'Normal'     },
  borderline: { color:'#f59e0b', bg:'bg-amber-50',    badge:'bg-amber-100 text-amber-700',      label:'Borderline' },
  high:       { color:'#f97316', bg:'bg-orange-50',   badge:'bg-orange-100 text-orange-700',    label:'High'       },
  low:        { color:'#8b5cf6', bg:'bg-purple-50',   badge:'bg-purple-100 text-purple-700',    label:'Low'        },
  critical:   { color:'#ef4444', bg:'bg-red-50',      badge:'bg-red-100 text-red-700',          label:'Critical'   },
}

export default function BiomarkerAnalytics() {
  const { user } = useAuthStore()
  const [biomarkers, setBiomarkers] = useState<Biomarker[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState('all')
  const [aiCorrelations, setAiCorrelations] = useState<string[]>([])
  const [analyzing, setAnalyzing] = useState(false)

  useEffect(() => { if (user) load() }, [user])

  async function load() {
    if (!user) return
    setLoading(true)
    const { data } = await supabase.from('health_records')
      .select('test_name, value, unit, reference_min, reference_max, recorded_at')
      .eq('user_id', user.id)
      .order('recorded_at', { ascending: false })

    if (!data?.length) { setLoading(false); return }

    // Get unique latest value per test
    const seen = new Map<string, typeof data[0]>()
    const allForTrend = new Map<string, typeof data>()
    for (const r of data) {
      const key = r.test_name.toLowerCase()
      if (!seen.has(key)) seen.set(key, r)
      if (!allForTrend.has(key)) allForTrend.set(key, [])
      allForTrend.get(key)!.push(r)
    }

    const markers: Biomarker[] = []
    for (const [, r] of seen) {
      const history = allForTrend.get(r.test_name.toLowerCase()) || []
      let trend: Biomarker['trend'] = 'stable'
      let trendPct = 0
      if (history.length > 1) {
        const oldest = history[history.length-1].value
        trendPct = oldest !== 0 ? +((r.value - oldest) / Math.abs(oldest) * 100).toFixed(1) : 0
        trend = Math.abs(trendPct) < 2 ? 'stable' : trendPct > 0 ? 'up' : 'down'
      }
      const status = classifyBiomarker(r.test_name, r.value, r.reference_min, r.reference_max)
      const opt = OPTIMAL_RANGES[r.test_name]
      markers.push({
        name: r.test_name, value: r.value, unit: r.unit || '', category: getCat(r.test_name),
        status, refMin: r.reference_min, refMax: r.reference_max,
        optimalMin: opt?.min, optimalMax: opt?.max,
        date: r.recorded_at.split('T')[0], trend, trendPct: Math.abs(trendPct),
        insight: opt?.insight || `Reference: ${r.reference_min ?? '—'}–${r.reference_max ?? '—'} ${r.unit}`,
        action: opt?.action || 'Consult your doctor if outside reference range',
      })
    }
    markers.sort((a,b) => {
      const o = {critical:0, high:1, low:2, borderline:3, normal:4, optimal:5}
      return o[a.status] - o[b.status]
    })
    setBiomarkers(markers)
    setLoading(false)
  }

  function getCat(name: string): string {
    const lower = name.toLowerCase()
    for (const cat of CATEGORIES) {
      if (cat.markers.some(m => lower.includes(m.toLowerCase()) || m.toLowerCase().includes(lower))) return cat.name
    }
    return 'Other'
  }

  async function findCorrelations() {
    const key = import.meta.env.VITE_GROQ_API_KEY
    if (!key) { toast.error('Add VITE_GROQ_API_KEY'); return }
    setAnalyzing(true)
    try {
      const markerStr = biomarkers.slice(0,15).map(b => `${b.name}: ${b.value} ${b.unit} (${b.status})`).join('\n')
      const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method:'POST',
        headers:{'Content-Type':'application/json', Authorization:`Bearer ${key}`},
        body: JSON.stringify({
          model:'llama-3.3-70b-versatile',
          messages:[{ role:'user', content:`You are a biomarker correlation AI for VitalOS (Indian health platform). Analyze these biomarkers and identify 3-4 key correlations/patterns. Be specific, mention actual values, explain the connection in simple English. Format as bullet points.\n\nBiomarkers:\n${markerStr}` }],
          max_tokens:400, temperature:0.4,
          response_format:{ type:'json_object' }
        })
      })
      const raw = await res.json() as {choices:Array<{message:{content:string}}>}
      try {
        const parsed = JSON.parse(raw.choices[0].message.content)
        const items = parsed.correlations || parsed.patterns || parsed.insights || []
        setAiCorrelations(Array.isArray(items) ? items : [raw.choices[0].message.content])
      } catch {
        setAiCorrelations([raw.choices[0].message.content])
      }
    } catch { toast.error('Analysis failed') }
    finally { setAnalyzing(false) }
  }

  const cats = ['all', ...new Set(biomarkers.map(b => b.category))]
  const filtered = filter === 'all' ? biomarkers : biomarkers.filter(b => b.category === filter)
  const critical = biomarkers.filter(b => b.status === 'critical' || b.status === 'high').length
  const optimal  = biomarkers.filter(b => b.status === 'optimal').length

  return (
    <div className="p-4 pb-8 max-w-2xl mx-auto space-y-4">
      <div className="card !p-5" style={{ background:'linear-gradient(135deg,#0f2a1e,#1a3a2a)', borderColor:'#166534' }}>
        <div className="flex items-start gap-3">
          <div className="w-12 h-12 rounded-xl flex items-center justify-center shrink-0" style={{ background:'rgba(34,197,94,0.15)' }}>
            <FlaskConical size={24} className="text-green-400"/>
          </div>
          <div>
            <div className="flex items-center gap-2 mb-1">
              <h1 className="text-lg font-bold text-white">Biomarker Analytics</h1>
              <span className="text-[10px] bg-green-900 text-green-300 border border-green-700 px-2 py-0.5 rounded-full font-bold">Advanced</span>
            </div>
            <p className="text-sm text-green-300">Deep analysis of inflammation, hormones, vitamins, liver, kidney, metabolic markers with optimal ranges beyond "normal".</p>
          </div>
        </div>
        {biomarkers.length > 0 && (
          <div className="mt-4 grid grid-cols-4 gap-2">
            {[
              { l:'Total', v:biomarkers.length, c:'#6366f1' },
              { l:'Optimal', v:optimal, c:'#10b981' },
              { l:'Watch', v:biomarkers.filter(b=>b.status==='borderline'||b.status==='low').length, c:'#f59e0b' },
              { l:'Critical', v:critical, c:'#ef4444' },
            ].map(s=>(
              <div key={s.l} className="rounded-lg p-2 text-center" style={{ background:`${s.c}20`, border:`1px solid ${s.c}30` }}>
                <div className="text-xl font-black" style={{ color:s.c }}>{s.v}</div>
                <div className="text-[9px] text-gray-400">{s.l}</div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* AI Correlations */}
      <div className="card !p-4">
        <div className="flex items-center justify-between mb-2">
          <p className="text-sm font-bold text-gray-800 flex items-center gap-2"><Brain size={14} className="text-green-500"/>AI correlation engine</p>
          <button onClick={findCorrelations} disabled={analyzing||biomarkers.length===0}
            className="text-xs text-green-600 border border-green-200 px-3 py-1.5 rounded-lg hover:bg-green-50 disabled:opacity-40 flex items-center gap-1">
            <Zap size={11}/>{analyzing?'Analyzing...':'Find correlations'}
          </button>
        </div>
        {aiCorrelations.length > 0 ? (
          <div className="space-y-2">
            {aiCorrelations.map((c,i)=>(
              <div key={i} className="flex gap-2 text-xs text-gray-700 bg-gray-50 rounded-lg p-2.5">
                <span className="text-green-500 shrink-0">→</span>{c}
              </div>
            ))}
          </div>
        ) : (
          <p className="text-xs text-gray-400">Upload lab reports to analyze correlations between your biomarkers. Example: "Poor sleep + Vitamin D deficiency + high stress = fatigue pattern"</p>
        )}
      </div>

      {/* Category filters */}
      <div className="flex gap-1.5 overflow-x-auto pb-1 scrollbar-hide">
        {cats.map(c=>(
          <button key={c} onClick={()=>setFilter(c)}
            className={`text-xs px-3 py-1.5 rounded-lg border whitespace-nowrap font-semibold flex-shrink-0 capitalize transition-colors ${filter===c?'bg-gray-900 text-white border-gray-900':'border-gray-200 text-gray-500'}`}>
            {c==='all'?`All (${biomarkers.length})`:c}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="space-y-2">{[1,2,3,4].map(i=><div key={i} className="card h-20 animate-pulse bg-gray-50"/>)}</div>
      ) : biomarkers.length === 0 ? (
        <div className="card border-dashed border-2 text-center py-12">
          <FlaskConical size={32} className="text-gray-200 mx-auto mb-3"/>
          <p className="text-sm font-semibold text-gray-600 mb-1">No biomarker data yet</p>
          <p className="text-xs text-gray-400 mb-4">Upload a lab report to get deep biomarker analysis</p>
          <a href="/reports" className="btn-primary text-xs py-2 inline-block">Upload lab report</a>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map(b=>{
            const cfg = STATUS_CONFIG[b.status]
            return (
              <div key={b.name} className={`card !p-4 border ${cfg.bg}`}>
                <div className="flex items-start justify-between mb-2">
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="text-sm font-bold text-gray-900">{b.name}</p>
                      <span className={`text-[9px] px-1.5 py-0.5 rounded font-bold ${cfg.badge}`}>{cfg.label}</span>
                      <span className="text-[9px] text-gray-400 bg-gray-100 px-1.5 py-0.5 rounded">{b.category}</span>
                    </div>
                    <p className="text-xs text-gray-400 mt-0.5">{b.date}</p>
                  </div>
                  <div className="text-right shrink-0">
                    <div className="text-xl font-black" style={{ color:cfg.color }}>{b.value}</div>
                    <div className="text-[10px] text-gray-400">{b.unit}</div>
                    {b.trend && b.trendPct && b.trendPct > 1 && (
                      <div className={`text-[10px] font-bold flex items-center justify-end gap-0.5 ${b.trend==='up'?'text-red-500':'b.trend'==='down'?'text-emerald-500':'text-gray-400'}`}>
                        {b.trend==='up'?<TrendingUp size={10}/>:<TrendingDown size={10}/>}{b.trendPct}%
                      </div>
                    )}
                  </div>
                </div>
                {/* Progress bar */}
                {(b.refMin||b.refMax) && (
                  <div className="mb-2">
                    <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                      <div className="h-full rounded-full transition-all" style={{
                        width:`${Math.min(100, b.refMax ? (b.value/b.refMax)*80 : 50)}%`,
                        background:cfg.color
                      }}/>
                    </div>
                    <div className="flex justify-between text-[9px] text-gray-400 mt-0.5">
                      <span>{b.refMin||'—'}</span>
                      {b.optimalMin && <span className="text-green-500">Optimal: {b.optimalMin}–{b.optimalMax}</span>}
                      <span>{b.refMax||'—'} {b.unit}</span>
                    </div>
                  </div>
                )}
                <p className="text-xs text-gray-600 mb-1">{b.insight}</p>
                <div className="flex gap-1.5 items-start">
                  <CheckCircle size={11} className="text-teal-500 shrink-0 mt-0.5"/>
                  <p className="text-[11px] text-teal-700 font-medium">{b.action}</p>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
