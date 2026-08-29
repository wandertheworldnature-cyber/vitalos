import { useState, useEffect } from 'react'
import { useAuthStore } from '@/store/authStore'
import { supabase } from '@/lib/supabase'
import { Stethoscope, Brain, FileText, AlertTriangle, TrendingUp, RefreshCw, Check } from 'lucide-react'
import toast from 'react-hot-toast'

interface PatientSummary {
  name: string; age: number; gender: string
  criticalMarkers: Array<{name:string;value:number;unit:string;status:string}>
  riskFlags: string[]; trendAlerts: string[]
  aiSummary: string; recommendedTests: string[]
}

export default function ClinicalDecisionSupport() {
  const { user } = useAuthStore()
  const [summary, setSummary] = useState<PatientSummary|null>(null)
  const [generating, setGenerating] = useState(false)
  const [tab, setTab] = useState<'summary'|'risks'|'tests'>('summary')

  useEffect(() => { if (user) loadPatientData() }, [user])

  async function loadPatientData() {
    if (!user) return
    const [profile, records] = await Promise.all([
      supabase.from('profiles').select('*').eq('id', user.id).single(),
      supabase.from('health_records').select('test_name,value,unit,reference_min,reference_max,recorded_at')
        .eq('user_id', user.id).order('recorded_at', { ascending: false }).limit(50)
    ])
    const age = profile.data?.date_of_birth
      ? Math.floor((Date.now() - new Date(profile.data.date_of_birth).getTime()) / 31557600000) : 30
    const seen = new Map()
    for (const r of (records.data||[])) { if (!seen.has(r.test_name)) seen.set(r.test_name, r) }
    const criticalMarkers = Array.from(seen.values())
      .filter((r:Record<string,unknown>) => (r.reference_max && (r.value as number) > (r.reference_max as number)) || (r.reference_min && (r.value as number) < (r.reference_min as number)))
      .map((r:Record<string,unknown>) => ({
        name: r.test_name as string, value: r.value as number, unit: r.unit as string,
        status: (r.reference_max && (r.value as number) > (r.reference_max as number)) ? 'HIGH' : 'LOW'
      })).slice(0, 8)
    setSummary({ name: profile.data?.full_name||'Patient', age, gender: profile.data?.gender||'Unknown', criticalMarkers, riskFlags:[], trendAlerts:[], aiSummary:'', recommendedTests:[] })
  }

  async function generateAISummary() {
    if (!summary || !user) return
    const key = import.meta.env.VITE_GROQ_API_KEY
    if (!key) { toast.error('Add VITE_GROQ_API_KEY'); return }
    setGenerating(true)
    try {
      const { data:records } = await supabase.from('health_records')
        .select('test_name,value,unit,reference_min,reference_max,recorded_at')
        .eq('user_id', user.id).order('recorded_at', { ascending: false }).limit(30)
      const dataStr = (records||[]).slice(0,20).map((r:Record<string,unknown>)=>`${r.test_name}: ${r.value} ${r.unit}`).join('\n')
      const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method:'POST', headers:{'Content-Type':'application/json', Authorization:`Bearer ${key}`},
        body: JSON.stringify({
          model:'openai/gpt-oss-120b',
          messages:[{ role:'user', content:`You are a Clinical Decision Support AI for VitalOS. Generate a concise clinical summary for a doctor reviewing this patient.\n\nPatient: ${summary.name}, Age: ${summary.age}, Gender: ${summary.gender}\n\nLab Results:\n${dataStr}\n\nProvide JSON with:\n{"aiSummary":"2-3 sentence clinical summary","riskFlags":["risk 1","risk 2"],"trendAlerts":["alert 1"],"recommendedTests":["test 1","test 2"]}` }],
          max_tokens:500, temperature:0.3, response_format:{type:'json_object'}
        })
      })
      const data = await res.json() as {choices:Array<{message:{content:string}}>}
      const parsed = JSON.parse(data.choices[0].message.content)
      setSummary(prev => prev ? {...prev, ...parsed} : prev)
      toast.success('Clinical summary generated!')
    } catch { toast.error('Generation failed') }
    finally { setGenerating(false) }
  }

  if (!summary) return <div className="p-8 text-center text-gray-400">Loading patient data...</div>

  return (
    <div className="p-4 pb-8 max-w-2xl mx-auto space-y-4">
      <div className="card !p-5" style={{ background:'linear-gradient(135deg,#0c1a2e,#1a2a3a)', borderColor:'#1e40af' }}>
        <div className="flex items-start gap-3">
          <div className="w-12 h-12 rounded-xl flex items-center justify-center shrink-0" style={{ background:'rgba(59,130,246,0.2)' }}>
            <Stethoscope size={24} className="text-blue-400"/>
          </div>
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-1">
              <h1 className="text-lg font-bold text-white">Clinical Decision Support</h1>
              <span className="text-[10px] bg-blue-900 text-blue-300 border border-blue-700 px-2 py-0.5 rounded-full font-bold">Doctor AI</span>
            </div>
            <p className="text-sm text-slate-300">AI summaries · Risk analysis · Trend detection for faster, smarter consultations.</p>
          </div>
        </div>
        <div className="mt-4 bg-white/10 rounded-xl p-3">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-bold text-white">{summary.name}</p>
              <p className="text-xs text-gray-400">{summary.age} yrs · {summary.gender} · {summary.criticalMarkers.length} abnormal markers</p>
            </div>
            <button onClick={generateAISummary} disabled={generating}
              className="flex items-center gap-1.5 text-xs text-blue-300 border border-blue-700 px-3 py-1.5 rounded-lg hover:bg-blue-900/30">
              <RefreshCw size={11} className={generating?'animate-spin':''}/>{generating?'Generating...':'Generate AI summary'}
            </button>
          </div>
        </div>
      </div>

      <div className="flex gap-1 bg-gray-100 rounded-xl p-1">
        {(['summary','risks','tests'] as const).map(t=>(
          <button key={t} onClick={()=>setTab(t)}
            className={`flex-1 text-xs py-2 rounded-lg font-semibold capitalize ${tab===t?'bg-white shadow-sm text-gray-900':'text-gray-500'}`}>
            {t==='summary'?'📋 Summary':t==='risks'?'⚠️ Risks':'🔬 Tests'}
          </button>
        ))}
      </div>

      {tab==='summary' && (
        <div className="space-y-3">
          {summary.aiSummary ? (
            <div className="card !p-4 bg-blue-50 border-blue-100">
              <p className="text-xs font-bold text-blue-700 mb-2 flex items-center gap-1.5"><Brain size={12}/>AI Clinical Summary</p>
              <p className="text-sm text-gray-700 leading-relaxed">{summary.aiSummary}</p>
            </div>
          ) : (
            <div className="card !p-4 border-dashed border-2 text-center py-8">
              <Brain size={28} className="text-gray-200 mx-auto mb-2"/>
              <p className="text-sm text-gray-500 mb-3">Generate AI summary to get clinical insights</p>
              <button onClick={generateAISummary} className="btn-primary text-xs py-2">Generate now</button>
            </div>
          )}
          {summary.criticalMarkers.length > 0 && (
            <div className="card !p-4">
              <p className="text-sm font-bold text-gray-800 mb-3">Abnormal markers ({summary.criticalMarkers.length})</p>
              <div className="space-y-2">
                {summary.criticalMarkers.map((m,i)=>(
                  <div key={i} className={`flex items-center justify-between p-2.5 rounded-lg ${m.status==='HIGH'?'bg-red-50 border border-red-100':'bg-purple-50 border border-purple-100'}`}>
                    <span className="text-sm font-semibold text-gray-800">{m.name}</span>
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-black" style={{ color:m.status==='HIGH'?'#ef4444':'#8b5cf6' }}>{m.value} {m.unit}</span>
                      <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded ${m.status==='HIGH'?'bg-red-100 text-red-700':'bg-purple-100 text-purple-700'}`}>{m.status}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {tab==='risks' && (
        <div className="space-y-3">
          {summary.riskFlags.length > 0 ? summary.riskFlags.map((r,i)=>(
            <div key={i} className="card !p-4 bg-red-50 border-red-100">
              <div className="flex gap-2"><AlertTriangle size={14} className="text-red-500 shrink-0 mt-0.5"/><p className="text-sm text-gray-700">{r}</p></div>
            </div>
          )) : (
            <div className="card border-dashed border-2 text-center py-10">
              <p className="text-sm text-gray-500">Generate AI summary first to see risk flags</p>
            </div>
          )}
          {summary.trendAlerts.length > 0 && summary.trendAlerts.map((a,i)=>(
            <div key={i} className="card !p-4 bg-amber-50 border-amber-100">
              <div className="flex gap-2"><TrendingUp size={14} className="text-amber-500 shrink-0 mt-0.5"/><p className="text-sm text-gray-700">{a}</p></div>
            </div>
          ))}
        </div>
      )}

      {tab==='tests' && (
        <div className="card !p-4">
          <p className="text-sm font-bold text-gray-800 mb-3">Recommended follow-up tests</p>
          {summary.recommendedTests.length > 0 ? summary.recommendedTests.map((t,i)=>(
            <div key={i} className="flex gap-2 py-2 border-b border-gray-50 last:border-0">
              <Check size={13} className="text-teal-500 shrink-0 mt-0.5"/><p className="text-sm text-gray-700">{t}</p>
            </div>
          )) : (
            <p className="text-xs text-gray-400">Generate AI summary to get test recommendations</p>
          )}
        </div>
      )}
    </div>
  )
}

