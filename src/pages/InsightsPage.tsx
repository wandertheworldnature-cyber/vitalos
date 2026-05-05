import { useEffect, useState, useRef } from 'react'
import { Brain, Send, RefreshCw, Zap, Sparkles, AlertTriangle, CheckCircle,
         Info, TrendingUp, Target, Activity, Calendar, Lightbulb } from 'lucide-react'
import { useAuthStore } from '@/store/authStore'
import { supabase } from '@/lib/supabase'
import {
  generateInsightMode, explainMetric, predictRisks, generateActionPlan, chatWithVitalOS,
  type AIInsightResponse, type ExplainResponse, type PredictionResponse, type ActionPlanResponse,
  type HealthRecord, type UserContext
} from '@/services/vitalosAI'
import toast from 'react-hot-toast'

interface ChatMsg { role: 'user'|'assistant'; content: string; time: string }

const QUICK_Q = [
  'Explain my latest results',
  'Am I at risk for diabetes?',
  'Create a 7-day health plan',
  'Predict my future risks',
  'Why is my Hemoglobin low?',
  'Which doctor should I see?',
]

const MODES = [
  { id:'insights',  icon:Brain,     label:'Insights',    desc:'AI analysis of your reports'     },
  { id:'predict',   icon:TrendingUp,label:'Predict',     desc:'Future risk predictions'          },
  { id:'plan',      icon:Target,    label:'Action Plan', desc:'7-day personalized plan'          },
  { id:'chat',      icon:Sparkles,  label:'AI Chat',     desc:'Ask anything about your health'   },
] as const

type Mode = typeof MODES[number]['id']

function now() { return new Date().toLocaleTimeString('en-IN', { hour:'2-digit', minute:'2-digit' }) }

const sevStyle = {
  critical: { icon:AlertTriangle, color:'text-red-600',   bg:'bg-red-50 border-red-100',   badge:'bg-red-100 text-red-700'  },
  warning:  { icon:AlertTriangle, color:'text-amber-600', bg:'bg-amber-50 border-amber-100',badge:'bg-amber-100 text-amber-700'},
  info:     { icon:Info,          color:'text-blue-600',  bg:'bg-blue-50 border-blue-100',  badge:'bg-blue-100 text-blue-700' },
  good:     { icon:CheckCircle,   color:'text-teal-600',  bg:'bg-teal-50 border-teal-100',  badge:'bg-teal-100 text-teal-700' },
}

const riskColors = { low:'#10b981', moderate:'#f59e0b', high:'#ef4444' }
const catColors: Record<string,string> = { diet:'#10b981', exercise:'#3b82f6', lifestyle:'#8b5cf6', medical:'#ef4444' }

export default function InsightsPage() {
  const { user } = useAuthStore()
  const [mode, setMode] = useState<Mode>('insights')
  const [records, setRecords] = useState<HealthRecord[]>([])
  const [userCtx, setUserCtx] = useState<UserContext>({})
  const [insights, setInsights]   = useState<AIInsightResponse[]>([])
  const [prediction, setPrediction] = useState<PredictionResponse | null>(null)
  const [actionPlan, setActionPlan] = useState<ActionPlanResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [generating, setGenerating] = useState(false)
  const [filter, setFilter] = useState<'all'|'critical'|'warning'|'info'|'good'>('all')
  const [chat, setChat] = useState<ChatMsg[]>([{
    role:'assistant',
    content:'Hi! I\'m your VitalOS AI — I know your health data and remember your patterns 🧠\n\nAsk me anything: explain a test, predict risks, or get a personalized action plan.',
    time: now()
  }])
  const [chatInput, setChatInput] = useState('')
  const [chatLoading, setChatLoading] = useState(false)
  const chatEndRef = useRef<HTMLDivElement>(null)
  const inputRef   = useRef<HTMLInputElement>(null)

  useEffect(() => { if (user) init() }, [user])
  useEffect(() => { chatEndRef.current?.scrollIntoView({ behavior:'smooth' }) }, [chat])

  async function init() {
    if (!user) return
    setLoading(true)
    try {
      const [recsRes, profileRes, insightsDB] = await Promise.all([
        supabase.from('health_records').select('*').eq('user_id', user.id).order('recorded_at',{ascending:false}).limit(50),
        supabase.from('profiles').select('*').eq('id', user.id).single(),
        supabase.from('ai_insights').select('*').eq('user_id', user.id).order('generated_at',{ascending:false}).limit(20),
      ])

      const recs = (recsRes.data||[]) as HealthRecord[]
      setRecords(recs)

      const p = profileRes.data
      let age: number|undefined
      if (p?.date_of_birth) age = Math.floor((Date.now()-new Date(p.date_of_birth).getTime())/31557600000)
      const ctx: UserContext = { name: user.full_name||undefined, age, gender: p?.gender||undefined }
      setUserCtx(ctx)

      // Load saved insights from DB
      if (insightsDB.data?.length) {
        const mapped = insightsDB.data.map(i => ({
          title: i.title, summary: i.description, severity: i.severity as 'good'|'info'|'warning'|'critical',
          observations: [i.description], risks: [], doctor_advice: i.recommendation||'',
          actions: [{step:i.recommendation||'',category:'lifestyle',timeframe:'1 month'}]
        }))
        setInsights(mapped)
      }
    } catch (e) { console.error(e) }
    finally { setLoading(false) }
  }

  async function runInsights() {
    if (records.length === 0) { toast('Upload lab reports first', {icon:'ℹ️'}); return }
    setGenerating(true)
    try {
      const prev = insights.slice(0,3).map(i=>i.summary)
      const result = await generateInsightMode(records, userCtx, undefined, prev)
      setInsights(result)
      // Save to DB
      if (user && result.length > 0) {
        const rows = result.map(i=>({
          user_id: user.id, severity: i.severity, title: i.title,
          description: i.summary, recommendation: i.actions?.[0]?.step||'',
          related_metrics: [], generated_at: new Date().toISOString()
        }))
        await supabase.from('ai_insights').insert(rows)
      }
      toast.success(`${result.length} insights generated!`)
    } catch (err) {
      const m = err instanceof Error ? err.message : ''
      if (m.includes('NO_GROQ_KEY')) toast.error('Add VITE_GROQ_API_KEY to Vercel env vars')
      else toast.error('Failed — check API key')
    } finally { setGenerating(false) }
  }

  async function runPrediction() {
    if (records.length === 0) { toast('Upload lab reports first', {icon:'ℹ️'}); return }
    setGenerating(true)
    try {
      const result = await predictRisks(records, userCtx)
      setPrediction(result)
      toast.success('Risk prediction complete!')
    } catch { toast.error('Prediction failed') }
    finally { setGenerating(false) }
  }

  async function runActionPlan() {
    if (records.length === 0) { toast('Upload lab reports first', {icon:'ℹ️'}); return }
    setGenerating(true)
    try {
      const result = await generateActionPlan(records, userCtx, 7)
      setActionPlan(result)
      toast.success('Your 7-day plan is ready!')
    } catch { toast.error('Action plan failed') }
    finally { setGenerating(false) }
  }

  async function sendChat(text?: string) {
    const msg = (text||chatInput).trim()
    if (!msg||chatLoading) return
    setChat(prev=>[...prev,{role:'user',content:msg,time:now()}])
    setChatInput('')
    setChatLoading(true)
    try {
      const history = chat.slice(-8).map(m=>({role:m.role as 'user'|'assistant',content:m.content}))
      const reply = await chatWithVitalOS(msg, history, records, userCtx)
      setChat(prev=>[...prev,{role:'assistant',content:reply,time:now()}])
    } catch (err) {
      const isNoKey = err instanceof Error && err.message.includes('NO_GROQ_KEY')
      setChat(prev=>[...prev,{role:'assistant',content:isNoKey?'Add VITE_GROQ_API_KEY to Vercel env vars.':'Connection error. Try again.',time:now()}])
    } finally { setChatLoading(false) }
  }

  const filtered = filter==='all'?insights:insights.filter(i=>i.severity===filter)
  const counts = {all:insights.length,critical:insights.filter(i=>i.severity==='critical').length,warning:insights.filter(i=>i.severity==='warning').length,info:insights.filter(i=>i.severity==='info').length,good:insights.filter(i=>i.severity==='good').length}

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="px-4 pt-4 pb-3 space-y-3 border-b border-gray-100">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Brain size={18} className="text-teal-500"/>
            <h1 className="text-lg font-bold text-gray-900">VitalOS AI</h1>
            <span className="text-[10px] bg-green-50 text-green-700 border border-green-100 px-2 py-0.5 rounded-full flex items-center gap-1">
              <Zap size={8}/>4 AI Modes
            </span>
          </div>
          {mode==='insights' && (
            <button onClick={runInsights} disabled={generating}
              className="flex items-center gap-1.5 text-xs border border-gray-200 bg-white px-3 py-1.5 rounded-lg text-gray-600">
              <RefreshCw size={11} className={generating?'animate-spin':''}/>{generating?'Analyzing...':'Generate'}
            </button>
          )}
        </div>

        {/* Mode selector */}
        <div className="flex gap-1.5 overflow-x-auto pb-0.5">
          {MODES.map(m=>(
            <button key={m.id} onClick={()=>setMode(m.id)}
              className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold shrink-0 transition-all border ${
                mode===m.id?'text-white border-transparent':'border-gray-200 text-gray-500 bg-white'
              }`}
              style={mode===m.id?{background:'linear-gradient(135deg,#0f6e56,#1d9e75)'}:{}}>
              <m.icon size={13}/>{m.label}
            </button>
          ))}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto">
        {/* INSIGHTS MODE */}
        {mode==='insights' && (
          <div className="px-4 py-3 space-y-3">
            <div className="flex gap-1.5 flex-wrap">
              {(['all','critical','warning','info','good'] as const).map(f=>(
                <button key={f} onClick={()=>setFilter(f)}
                  className={`text-[11px] px-2.5 py-1 rounded-lg border capitalize ${filter===f?'bg-gray-900 text-white border-gray-900':'border-gray-200 text-gray-500'}`}>
                  {f} ({counts[f]})
                </button>
              ))}
            </div>
            {loading?(<div className="space-y-3">{[1,2,3].map(i=><div key={i} className="card h-20 animate-pulse bg-gray-50"/>)}</div>)
            :filtered.length===0?(
              <div className="card border-dashed border-2 border-purple-100 text-center py-10">
                <Sparkles size={28} className="text-purple-200 mx-auto mb-2"/>
                <p className="text-sm font-semibold text-gray-600">No insights yet</p>
                <p className="text-xs text-gray-400 mt-1 mb-3">Upload reports → tap Generate</p>
                <button onClick={runInsights} disabled={generating} className="btn-primary text-xs py-2">Generate now</button>
              </div>
            ):filtered.map((ins,idx)=>{
              const cfg=sevStyle[ins.severity]||sevStyle.info; const Icon=cfg.icon
              return (
                <div key={idx} className={`card border ${cfg.bg} !p-4`}>
                  <div className="flex items-start gap-2.5 mb-2">
                    <Icon size={15} className={`${cfg.color} mt-0.5 shrink-0`}/>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2 mb-1.5">
                        <p className="text-sm font-bold text-gray-900 leading-snug">{ins.title}</p>
                        <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold capitalize shrink-0 ${cfg.badge}`}>{ins.severity}</span>
                      </div>
                      <p className="text-xs text-gray-600 leading-relaxed">{ins.summary}</p>
                    </div>
                  </div>
                  {ins.observations?.length>0&&(
                    <div className="ml-6 mb-2">
                      {ins.observations.slice(0,3).map((o,i)=>(
                        <p key={i} className="text-xs text-gray-600 flex gap-1.5 mb-1"><span className="text-teal-500 shrink-0">•</span>{o}</p>
                      ))}
                    </div>
                  )}
                  {ins.actions?.length>0&&(
                    <div className="ml-6 p-2.5 bg-white/70 rounded-lg border border-white">
                      <p className="text-[10px] font-bold text-gray-700 mb-1">Recommended actions</p>
                      {ins.actions.slice(0,2).map((a,i)=>(
                        <div key={i} className="flex items-start gap-2 mb-1">
                          <div className="w-3 h-3 rounded-full mt-0.5 shrink-0" style={{background:catColors[a.category]||'#6b7280'}}/>
                          <p className="text-xs text-gray-600">{a.step} <span className="text-gray-400">({a.timeframe})</span></p>
                        </div>
                      ))}
                    </div>
                  )}
                  {ins.risks?.some(r=>r.level==='high'||r.level==='medium')&&(
                    <div className="ml-6 mt-2 flex flex-wrap gap-1.5">
                      {ins.risks.filter(r=>r.level!=='low').map((r,i)=>(
                        <span key={i} className="text-[10px] px-2 py-0.5 rounded-full font-semibold text-white"
                          style={{background:riskColors[r.level]||'#6b7280'}}>
                          ⚠ {r.signal}
                        </span>
                      ))}
                    </div>
                  )}
                  {ins.doctor_advice&&ins.doctor_advice!=='No immediate consultation needed'&&(
                    <p className="ml-6 mt-2 text-[10px] text-blue-600 bg-blue-50 px-2.5 py-1.5 rounded-lg">
                      🩺 {ins.doctor_advice}
                    </p>
                  )}
                </div>
              )
            })}
          </div>
        )}

        {/* PREDICT MODE */}
        {mode==='predict' && (
          <div className="px-4 py-3 space-y-3">
            <div className="card !p-4" style={{background:'linear-gradient(135deg,#1e1b4b,#312e81)',borderColor:'#4338ca'}}>
              <p className="text-xs text-indigo-300 font-semibold mb-1">🔮 Prediction Mode</p>
              <p className="text-sm font-bold text-white mb-0.5">Future Disease Risk Analysis</p>
              <p className="text-[11px] text-indigo-300 leading-relaxed">AI analyzes your trends to predict potential health risks. Uses probability — not certainty.</p>
            </div>
            {!prediction?(
              <div className="card border-dashed border-2 border-indigo-100 text-center py-10">
                <TrendingUp size={28} className="text-indigo-200 mx-auto mb-2"/>
                <p className="text-sm font-semibold text-gray-600">No prediction yet</p>
                <p className="text-xs text-gray-400 mt-1 mb-3">Requires at least one lab report</p>
                <button onClick={runPrediction} disabled={generating} className="btn-primary text-xs py-2">
                  {generating?'Predicting...':'Run prediction'}
                </button>
              </div>
            ):(
              <>
                <div className="space-y-3">
                  {prediction.risks?.map((r,i)=>(
                    <div key={i} className="card !p-4">
                      <div className="flex items-start justify-between mb-2">
                        <p className="text-sm font-bold text-gray-900">{r.condition}</p>
                        <span className="text-xs px-2.5 py-1 rounded-full font-bold text-white capitalize"
                          style={{background:riskColors[r.probability]||'#6b7280'}}>
                          {r.probability} risk
                        </span>
                      </div>
                      <p className="text-xs text-gray-500 mb-2">⏱ {r.timeframe}</p>
                      <div className="mb-2">
                        <p className="text-[10px] font-bold text-gray-600 mb-1">Contributing factors:</p>
                        {r.contributing_factors?.map((f,j)=>(
                          <p key={j} className="text-xs text-gray-600 flex gap-1.5 mb-0.5"><span className="text-amber-500">•</span>{f}</p>
                        ))}
                      </div>
                      <div className="bg-emerald-50 border border-emerald-100 rounded-lg p-2.5">
                        <p className="text-[10px] font-bold text-emerald-700 mb-1">Prevention steps:</p>
                        {r.prevention_steps?.slice(0,3).map((s,j)=>(
                          <p key={j} className="text-xs text-emerald-600 flex gap-1.5 mb-0.5"><span>✓</span>{s}</p>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
                {prediction.positive_outlook&&(
                  <div className="card !p-4" style={{background:'linear-gradient(135deg,#ecfdf5,#d1fae5)',borderColor:'#a7f3d0'}}>
                    <p className="text-xs font-bold text-emerald-700 mb-1">✨ Positive outlook</p>
                    <p className="text-sm text-emerald-800">{prediction.positive_outlook}</p>
                  </div>
                )}
                {prediction.next_test_recommendation&&(
                  <div className="card !p-4 bg-blue-50 border-blue-100">
                    <p className="text-xs font-bold text-blue-700 mb-1">📅 Next step</p>
                    <p className="text-sm text-blue-800">{prediction.next_test_recommendation}</p>
                  </div>
                )}
                <button onClick={runPrediction} disabled={generating}
                  className="w-full btn-secondary text-xs py-2 flex items-center justify-center gap-2">
                  <RefreshCw size={12} className={generating?'animate-spin':''}/>{generating?'Predicting...':'Refresh prediction'}
                </button>
              </>
            )}
          </div>
        )}

        {/* ACTION PLAN MODE */}
        {mode==='plan' && (
          <div className="px-4 py-3 space-y-3">
            <div className="card !p-4" style={{background:'linear-gradient(135deg,#ecfdf5,#d1fae5)',borderColor:'#a7f3d0'}}>
              <p className="text-xs text-emerald-700 font-semibold mb-1">⚡ Action Plan Mode</p>
              <p className="text-sm font-bold text-emerald-900 mb-0.5">Personalized 7-Day Health Plan</p>
              <p className="text-[11px] text-emerald-700">AI creates a practical, India-specific plan based on your lab data.</p>
            </div>
            {!actionPlan?(
              <div className="card border-dashed border-2 border-emerald-100 text-center py-10">
                <Target size={28} className="text-emerald-200 mx-auto mb-2"/>
                <p className="text-sm font-semibold text-gray-600">No plan yet</p>
                <button onClick={runActionPlan} disabled={generating} className="btn-primary text-xs py-2 mt-3">
                  {generating?'Creating plan...':'Generate 7-day plan'}
                </button>
              </div>
            ):(
              <>
                <div className="card !p-4 text-center" style={{background:'linear-gradient(135deg,#0f6e56,#1d9e75)'}}>
                  <p className="text-lg font-black text-white">{actionPlan.plan_title}</p>
                  <p className="text-xs text-emerald-200 mt-1">{actionPlan.duration}</p>
                  {actionPlan.week_goal&&<p className="text-sm text-white/90 mt-2 font-medium">Goal: {actionPlan.week_goal}</p>}
                </div>

                {/* Diet */}
                {actionPlan.diet?.length>0&&(
                  <div className="card !p-4">
                    <p className="text-sm font-bold text-gray-800 mb-2 flex items-center gap-2">🥗 Diet plan</p>
                    <div className="space-y-2">
                      {actionPlan.diet.slice(0,4).map((d,i)=>(
                        <div key={i} className="flex gap-2.5 bg-green-50 rounded-lg p-2.5">
                          <span className="text-base shrink-0">🌿</span>
                          <div>
                            <p className="text-xs font-semibold text-gray-800">{d.suggestion}</p>
                            <p className="text-[10px] text-gray-500">{d.reasoning}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Activity */}
                {actionPlan.activity?.length>0&&(
                  <div className="card !p-4">
                    <p className="text-sm font-bold text-gray-800 mb-2">💪 Activity plan</p>
                    <div className="space-y-2">
                      {actionPlan.activity.map((a,i)=>(
                        <div key={i} className="flex gap-2.5 bg-blue-50 rounded-lg p-2.5">
                          <span className="text-base shrink-0">🏃</span>
                          <div>
                            <p className="text-xs font-semibold text-gray-800">{a.suggestion}</p>
                            <p className="text-[10px] text-gray-500">{a.frequency} · {a.benefit}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Daily habits */}
                {actionPlan.daily_habits?.length>0&&(
                  <div className="card !p-4">
                    <p className="text-sm font-bold text-gray-800 mb-2">⏰ Daily habits</p>
                    <div className="space-y-2">
                      {actionPlan.daily_habits.map((h,i)=>(
                        <div key={i} className="flex items-start gap-2.5">
                          <span className="text-[10px] bg-purple-100 text-purple-700 px-2 py-0.5 rounded font-bold shrink-0 mt-0.5 capitalize">{h.time}</span>
                          <div>
                            <p className="text-xs font-semibold text-gray-800">{h.habit}</p>
                            <p className="text-[10px] text-gray-500">{h.impact}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {actionPlan.motivation&&(
                  <div className="card !p-4 text-center bg-amber-50 border-amber-100">
                    <p className="text-2xl mb-1">💛</p>
                    <p className="text-sm text-amber-800 font-medium italic">{actionPlan.motivation}</p>
                  </div>
                )}

                <button onClick={runActionPlan} disabled={generating}
                  className="w-full btn-secondary text-xs py-2 flex items-center justify-center gap-2">
                  <RefreshCw size={12} className={generating?'animate-spin':''}/>{generating?'Creating...':'Regenerate plan'}
                </button>
              </>
            )}
          </div>
        )}

        {/* CHAT MODE */}
        {mode==='chat' && (
          <div className="flex flex-col" style={{height:'calc(100vh - 200px)'}}>
            <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3">
              {chat.map((m,i)=>(
                <div key={i} className={`flex ${m.role==='user'?'justify-end':'justify-start'}`}>
                  {m.role==='assistant'&&(
                    <div className="w-7 h-7 rounded-full flex items-center justify-center mr-2 shrink-0 mt-1"
                      style={{background:'linear-gradient(135deg,#0f6e56,#1d9e75)'}}>
                      <Sparkles size={12} className="text-white"/>
                    </div>
                  )}
                  <div className="max-w-[82%]">
                    <div className={`rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed whitespace-pre-wrap ${
                      m.role==='user'?'text-white rounded-tr-sm':'bg-white text-gray-800 rounded-tl-sm shadow-sm'
                    }`} style={m.role==='user'?{background:'linear-gradient(135deg,#0f6e56,#1d9e75)'}:{}}>
                      {m.content}
                    </div>
                    <p className="text-[9px] text-gray-400 mt-0.5 px-1">{m.time}</p>
                  </div>
                </div>
              ))}
              {chatLoading&&(
                <div className="flex justify-start">
                  <div className="w-7 h-7 rounded-full flex items-center justify-center mr-2 shrink-0"
                    style={{background:'linear-gradient(135deg,#0f6e56,#1d9e75)'}}>
                    <Sparkles size={12} className="text-white"/>
                  </div>
                  <div className="bg-white rounded-2xl px-4 py-3 shadow-sm">
                    <div className="flex gap-1">{[0,200,400].map(d=><div key={d} className="w-2 h-2 bg-teal-400 rounded-full animate-bounce" style={{animationDelay:`${d}ms`}}/>)}</div>
                  </div>
                </div>
              )}
              <div ref={chatEndRef}/>
            </div>

            {chat.length<=1&&(
              <div className="px-4 py-2 flex gap-2 overflow-x-auto border-t border-gray-100">
                {QUICK_Q.map(q=>(
                  <button key={q} onClick={()=>sendChat(q)}
                    className="shrink-0 text-xs text-teal-700 bg-teal-50 border border-teal-100 px-3 py-1.5 rounded-full whitespace-nowrap">
                    {q}
                  </button>
                ))}
              </div>
            )}

            <div className="flex gap-2 px-4 py-3 border-t border-gray-100 bg-white">
              <input ref={inputRef} value={chatInput} onChange={e=>setChatInput(e.target.value)}
                onKeyDown={e=>e.key==='Enter'&&sendChat()}
                placeholder="Ask about your health..."
                className="flex-1 border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-teal-400 bg-gray-50"/>
              <button onClick={()=>sendChat()} disabled={!chatInput.trim()||chatLoading}
                className="w-11 h-11 rounded-xl flex items-center justify-center text-white disabled:opacity-40 shrink-0"
                style={{background:'linear-gradient(135deg,#0f6e56,#1d9e75)'}}>
                <Send size={16}/>
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
