import { useEffect, useState, useRef } from 'react'
import { Brain, Send, RefreshCw, Zap, Sparkles, AlertTriangle, CheckCircle, Info, TrendingUp } from 'lucide-react'
import { useAuthStore } from '@/store/authStore'
import { supabase } from '@/lib/supabase'
import type { AIInsight } from '@/types'
import toast from 'react-hot-toast'

interface ChatMsg { role:'user'|'assistant'; content:string; time:string }

const GROQ_URL = 'https://api.groq.com/openai/v1/chat/completions'

const QUICK_Q = [
  'Explain my latest results',
  'Am I at risk for diabetes?',
  'How to improve my score?',
  'Which doctor should I see?',
  'What foods should I avoid?',
]

const VITALOS_PROMPT = `You are a preventive healthcare AI assistant for VitalOS.
Rules: Do NOT diagnose. Do NOT panic. Be calm, friendly, simple English for Indian users.
Format: 1.Summary 2.Key Observations 3.Risk Signals 4.Recommended Actions 5.When to see doctor.
Reference Indian foods and labs. Mention specific values. Keep responses concise (under 200 words).`

export default function InsightsPage() {
  const { user } = useAuthStore()
  const [insights, setInsights] = useState<AIInsight[]>([])
  const [loading, setLoading] = useState(true)
  const [generating, setGenerating] = useState(false)
  const [filter, setFilter] = useState<'all'|'critical'|'warning'|'info'|'good'>('all')
  const [view, setView] = useState<'insights'|'chat'>('insights')
  const [chat, setChat] = useState<ChatMsg[]>([{
    role:'assistant',
    content:'Hi! I\'m your VitalOS AI health analyst 🧬\n\nAsk me anything about your health — I\'ll explain in simple terms.',
    time: new Date().toLocaleTimeString('en-IN',{hour:'2-digit',minute:'2-digit'})
  }])
  const [chatInput, setChatInput] = useState('')
  const [chatLoading, setChatLoading] = useState(false)
  const [context, setContext] = useState('')
  const chatEndRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => { if (user) { loadInsights(); loadContext() } }, [user])
  useEffect(() => { chatEndRef.current?.scrollIntoView({ behavior:'smooth' }) }, [chat])

  async function loadInsights() {
    if (!user) return
    setLoading(true)
    const { data } = await supabase.from('ai_insights').select('*')
      .eq('user_id', user.id).order('generated_at',{ascending:false}).limit(30)
    setInsights((data||[]) as AIInsight[])
    setLoading(false)
  }

  async function loadContext() {
    if (!user) return
    const { data } = await supabase.from('health_records')
      .select('test_name,value,unit,reference_min,reference_max')
      .eq('user_id', user.id).order('recorded_at',{ascending:false}).limit(20)
    const ctx = (data||[]).map((r:{test_name:string;value:number;unit:string;reference_min?:number;reference_max?:number}) =>
      `${r.test_name}: ${r.value} ${r.unit}${r.reference_min!=null?` (normal: ${r.reference_min}-${r.reference_max})`:''}`)
      .join('\n')
    setContext(`Patient: ${user.full_name||user.email}\n\nLab values:\n${ctx||'No data yet'}`)
  }

  async function generate() {
    if (!user) return
    setGenerating(true)
    try {
      const key = import.meta.env.VITE_GROQ_API_KEY
      if (!key||key.includes('your-groq')) throw new Error('NO_KEY')
      const { data:recs } = await supabase.from('health_records').select('*')
        .eq('user_id', user.id).order('recorded_at',{ascending:false}).limit(40)
      if (!recs?.length) { toast('Upload lab reports first', {icon:'ℹ️'}); return }
      const recStr = recs.map(r=>`${r.test_name}: ${r.value} ${r.unit}${r.reference_min!=null?` [normal: ${r.reference_min}-${r.reference_max}]`:''}`).join('\n')
      const res = await fetch(GROQ_URL,{
        method:'POST',
        headers:{'Content-Type':'application/json',Authorization:`Bearer ${key}`},
        body:JSON.stringify({model:'llama-3.3-70b-versatile',messages:[
          {role:'system',content:VITALOS_PROMPT},
          {role:'user',content:`Analyze these lab results. Generate 4-6 insights as JSON array.\n\nData:\n${recStr}\n\nReturn ONLY JSON:\n[{"severity":"critical|warning|info|good","title":"string","description":"2-3 sentences with specific values","recommendation":"Indian-relevant steps","risk_reduction":"e.g. -30% risk","related_metrics":["string"],"timeframe":"string"}]`}
        ],max_tokens:2000,temperature:0.3})
      })
      if (!res.ok) throw new Error('API')
      const d = await res.json() as {choices:Array<{message:{content:string}}>}
      const text = d.choices?.[0]?.message?.content||''
      const match = text.replace(/```json|```/g,'').match(/\[[\s\S]*\]/)
      if (!match) throw new Error('parse')
      const parsed = JSON.parse(match[0]) as AIInsight[]
      const toInsert = parsed.filter(i=>i.title&&i.description).map(i=>({...i,user_id:user.id,generated_at:new Date().toISOString()}))
      const { data:saved } = await supabase.from('ai_insights').insert(toInsert).select()
      setInsights(prev=>[...(saved||toInsert) as AIInsight[],...prev].slice(0,30))
      toast.success(`Generated ${toInsert.length} insights!`)
    } catch(err) {
      const msg = err instanceof Error?err.message:''
      if (msg==='NO_KEY') toast.error('Add VITE_GROQ_API_KEY to Vercel env vars')
      else toast.error('Upload health data first')
    } finally { setGenerating(false) }
  }

  async function sendChat(text?:string) {
    const msg = (text||chatInput).trim()
    if (!msg||chatLoading) return
    const time = new Date().toLocaleTimeString('en-IN',{hour:'2-digit',minute:'2-digit'})
    setChat(prev=>[...prev,{role:'user',content:msg,time}])
    setChatInput('')
    setChatLoading(true)
    try {
      const key = import.meta.env.VITE_GROQ_API_KEY
      if (!key||key.includes('your-groq')) throw new Error('NO_KEY')
      const history = chat.slice(-8).map(m=>({role:m.role as 'user'|'assistant',content:m.content}))
      const res = await fetch(GROQ_URL,{
        method:'POST',
        headers:{'Content-Type':'application/json',Authorization:`Bearer ${key}`},
        body:JSON.stringify({model:'llama-3.3-70b-versatile',messages:[
          {role:'system',content:`${VITALOS_PROMPT}\n\nPATIENT DATA:\n${context||'No lab data yet'}`},
          ...history,{role:'user',content:msg}
        ],max_tokens:500,temperature:0.7})
      })
      if (!res.ok) throw new Error('API')
      const d = await res.json() as {choices:Array<{message:{content:string}}>}
      const reply = d.choices?.[0]?.message?.content||'Try again.'
      setChat(prev=>[...prev,{role:'assistant',content:reply,time:new Date().toLocaleTimeString('en-IN',{hour:'2-digit',minute:'2-digit'})}])
    } catch(err) {
      const isNoKey = err instanceof Error&&err.message==='NO_KEY'
      setChat(prev=>[...prev,{role:'assistant',content:isNoKey?'Add VITE_GROQ_API_KEY to Vercel.':'Connection error. Try again.',time:new Date().toLocaleTimeString()}])
    } finally { setChatLoading(false) }
  }

  const sevCfg = {
    critical:{icon:AlertTriangle,color:'text-red-600',bg:'bg-red-50 border-red-100',badge:'bg-red-100 text-red-700'},
    warning: {icon:AlertTriangle,color:'text-amber-600',bg:'bg-amber-50 border-amber-100',badge:'bg-amber-100 text-amber-700'},
    info:    {icon:Info,color:'text-blue-600',bg:'bg-blue-50 border-blue-100',badge:'bg-blue-100 text-blue-700'},
    good:    {icon:CheckCircle,color:'text-teal-600',bg:'bg-teal-50 border-teal-100',badge:'bg-teal-100 text-teal-700'},
  }
  const counts = {all:insights.length,critical:insights.filter(i=>i.severity==='critical').length,warning:insights.filter(i=>i.severity==='warning').length,info:insights.filter(i=>i.severity==='info').length,good:insights.filter(i=>i.severity==='good').length}
  const filtered = filter==='all'?insights:insights.filter(i=>i.severity===filter)

  return (
    <div className="flex flex-col h-full">
      {/* Top controls */}
      <div className="px-4 pt-4 pb-3 space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Brain size={18} className="text-teal-500"/>
            <h1 className="text-lg font-bold text-gray-900">AI Health Insights</h1>
            <span className="text-[10px] bg-green-50 text-green-700 border border-green-100 px-2 py-0.5 rounded-full flex items-center gap-1">
              <Zap size={8}/>Free
            </span>
          </div>
          <button onClick={generate} disabled={generating}
            className="flex items-center gap-1.5 text-xs border border-gray-200 bg-white px-3 py-1.5 rounded-lg text-gray-600">
            <RefreshCw size={12} className={generating?'animate-spin':''}/>
            {generating?'Analyzing...':'Generate'}
          </button>
        </div>

        {/* Toggle: Insights / Chat */}
        <div className="flex gap-1 bg-gray-100 rounded-xl p-1">
          <button onClick={()=>setView('insights')}
            className={`flex-1 text-xs py-2 rounded-lg font-semibold transition-all ${view==='insights'?'bg-white shadow-sm text-gray-900':'text-gray-500'}`}>
            📊 Insights ({insights.length})
          </button>
          <button onClick={()=>{setView('chat');setTimeout(()=>inputRef.current?.focus(),100)}}
            className={`flex-1 text-xs py-2 rounded-lg font-semibold transition-all ${view==='chat'?'bg-white shadow-sm text-gray-900':'text-gray-500'}`}>
            🤖 AI Chat
          </button>
        </div>
      </div>

      {/* Insights view */}
      {view==='insights' && (
        <div className="flex-1 overflow-y-auto px-4 pb-4 space-y-3">
          {/* Filters */}
          <div className="flex gap-1.5 flex-wrap">
            {(['all','critical','warning','info','good'] as const).map(f=>(
              <button key={f} onClick={()=>setFilter(f)}
                className={`text-[11px] px-2.5 py-1 rounded-lg border capitalize transition-colors ${filter===f?'bg-gray-900 text-white border-gray-900':'border-gray-200 text-gray-500'}`}>
                {f} ({counts[f]})
              </button>
            ))}
          </div>

          {loading?(
            <div className="space-y-3">{[1,2,3].map(i=><div key={i} className="card h-20 animate-pulse bg-gray-50"/>)}</div>
          ):filtered.length===0?(
            <div className="card border-dashed border-2 border-purple-100 text-center py-10">
              <Sparkles size={28} className="text-purple-200 mx-auto mb-2"/>
              <p className="text-sm font-semibold text-gray-600">No insights yet</p>
              <p className="text-xs text-gray-400 mt-1 mb-3">Upload reports → tap Generate</p>
              <button onClick={generate} disabled={generating} className="btn-primary text-xs py-2">Generate now</button>
            </div>
          ):(
            filtered.map(insight=>{
              const cfg = sevCfg[insight.severity]||sevCfg.info
              const Icon = cfg.icon
              return (
                <div key={insight.id} className={`card border ${cfg.bg} !p-4`}>
                  <div className="flex items-start gap-2.5 mb-2">
                    <Icon size={15} className={`${cfg.color} mt-0.5 shrink-0`}/>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2 mb-1">
                        <p className="text-sm font-bold text-gray-900 leading-snug">{insight.title}</p>
                        <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold capitalize shrink-0 ${cfg.badge}`}>{insight.severity}</span>
                      </div>
                      <p className="text-xs text-gray-600 leading-relaxed">{insight.description}</p>
                    </div>
                  </div>
                  {insight.recommendation&&(
                    <div className="ml-6 p-2.5 bg-white/70 rounded-lg border border-white">
                      <p className="text-[10px] font-bold text-gray-700 mb-0.5">Recommended action</p>
                      <p className="text-xs text-gray-600 leading-relaxed">{insight.recommendation}</p>
                    </div>
                  )}
                  {(insight.risk_reduction||insight.timeframe)&&(
                    <div className="ml-6 mt-2 flex items-center gap-2 flex-wrap">
                      {insight.risk_reduction&&<span className="text-[10px] text-teal-700 bg-teal-50 px-2 py-0.5 rounded-full font-semibold flex items-center gap-1"><TrendingUp size={8}/>{insight.risk_reduction}</span>}
                      {insight.timeframe&&<span className="text-[10px] text-gray-400">{insight.timeframe}</span>}
                    </div>
                  )}
                </div>
              )
            })
          )}
        </div>
      )}

      {/* Chat view */}
      {view==='chat' && (
        <div className="flex-1 flex flex-col overflow-hidden">
          <div className="flex-1 overflow-y-auto px-4 py-2 space-y-3">
            {chat.map((m,i)=>(
              <div key={i} className={`flex ${m.role==='user'?'justify-end':'justify-start'}`}>
                {m.role==='assistant'&&(
                  <div className="w-7 h-7 rounded-full flex items-center justify-center mr-2 shrink-0 mt-1"
                    style={{background:'linear-gradient(135deg,#0f6e56,#1d9e75)'}}>
                    <Sparkles size={12} className="text-white"/>
                  </div>
                )}
                <div className="max-w-[80%]">
                  <div className={`rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed whitespace-pre-wrap ${m.role==='user'?'text-white rounded-tr-sm':'bg-white text-gray-800 rounded-tl-sm shadow-sm'}`}
                    style={m.role==='user'?{background:'linear-gradient(135deg,#0f6e56,#1d9e75)'}:{}}>
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
            <div className="px-4 py-2 flex gap-2 overflow-x-auto">
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
  )
}
