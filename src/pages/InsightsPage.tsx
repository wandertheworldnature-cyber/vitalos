import { useEffect, useState, useRef } from 'react'
import { Brain, Send, RefreshCw, Zap, Sparkles, AlertTriangle, CheckCircle, Info, TrendingUp } from 'lucide-react'
import { useAuthStore } from '@/store/authStore'
import { supabase } from '@/lib/supabase'
import type { AIInsight } from '@/types'
import toast from 'react-hot-toast'

interface ChatMessage { role: 'user' | 'assistant'; content: string; time: string }

const GROQ_URL = 'https://api.groq.com/openai/v1/chat/completions'

const SUGGESTED_QUESTIONS = [
  'Why is my MCV high?',
  'What does high LDL cholesterol mean?',
  'How can I improve my Vitamin D levels?',
  'Am I at risk for diabetes?',
  'What should I eat to lower my HbA1c?',
  'Explain my latest report in simple terms',
  'How to reach longevity score 85?',
  'Which doctor should I see?',
]

export default function InsightsPage() {
  const { user } = useAuthStore()
  const [insights, setInsights] = useState<AIInsight[]>([])
  const [loading, setLoading] = useState(true)
  const [generating, setGenerating] = useState(false)
  const [filter, setFilter] = useState<'all'|'critical'|'warning'|'info'|'good'>('all')
  const [chat, setChat] = useState<ChatMessage[]>([{
    role: 'assistant',
    content: `Hi! I'm your VitalOS AI health analyst 🧬\n\nI can explain any health metric, predict risks, and guide you step-by-step.\n\nTry asking me something from the quick questions below, or type your own!`,
    time: new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })
  }])
  const [chatInput, setChatInput] = useState('')
  const [chatLoading, setChatLoading] = useState(false)
  const [healthContext, setHealthContext] = useState('')
  const chatEndRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => { if (user) { loadInsights(); loadHealthContext() } }, [user])
  useEffect(() => { chatEndRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [chat])

  async function loadInsights() {
    if (!user) return
    setLoading(true)
    const { data } = await supabase.from('ai_insights').select('*')
      .eq('user_id', user.id).order('generated_at', { ascending: false }).limit(30)
    setInsights((data || []) as AIInsight[])
    setLoading(false)
  }

  async function loadHealthContext() {
    if (!user) return
    const [records, profile] = await Promise.all([
      supabase.from('health_records').select('test_name,value,unit,reference_min,reference_max,recorded_at')
        .eq('user_id', user.id).order('recorded_at', { ascending: false }).limit(30),
      supabase.from('profiles').select('full_name,date_of_birth').eq('id', user.id).single(),
    ])
    const recs = (records.data || []).map((r: { test_name: string; value: number; unit: string; reference_min?: number; reference_max?: number }) =>
      `${r.test_name}: ${r.value} ${r.unit}${r.reference_min != null ? ` (normal: ${r.reference_min}–${r.reference_max})` : ''}`
    ).join('\n')

    let age = ''
    if (profile.data?.date_of_birth) {
      age = `Age: ${Math.floor((Date.now() - new Date(profile.data.date_of_birth).getTime()) / 31557600000)} years`
    }
    setHealthContext(`Patient: ${user.full_name || user.email}\n${age}\n\nLatest lab values:\n${recs || 'No lab data yet'}`)
  }

  async function handleGenerate() {
    if (!user) return
    setGenerating(true)
    try {
      const key = import.meta.env.VITE_GROQ_API_KEY
      if (!key || key.includes('your-groq')) throw new Error('NO_KEY')

      const records = await supabase.from('health_records').select('*')
        .eq('user_id', user.id).order('recorded_at', { ascending: false }).limit(40)

      if (!records.data?.length) { toast('Upload lab reports first to generate insights', { icon: 'ℹ️' }); return }

      const recs = records.data.map(r => `${r.test_name}: ${r.value} ${r.unit}${r.reference_min != null ? ` (normal: ${r.reference_min}–${r.reference_max})` : ''}`).join('\n')

      const res = await fetch(GROQ_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` },
        body: JSON.stringify({
          model: 'llama-3.3-70b-versatile',
          messages: [{
            role: 'user',
            content: `You are a preventive health expert analyzing Indian patient lab data. Generate 4-6 actionable health insights in JSON format.

Patient lab values:
${recs}

Return ONLY a JSON array, no markdown:
[{"severity":"critical|warning|info|good","title":"string","description":"string (2-3 sentences, mention specific values)","recommendation":"string (concrete Indian-relevant action steps)","risk_reduction":"string (e.g. '-30% diabetes risk')","related_metrics":["string"],"timeframe":"string"}]`
          }],
          max_tokens: 2000,
          temperature: 0.3,
        })
      })

      if (!res.ok) throw new Error('API error')
      const data = await res.json() as { choices: Array<{ message: { content: string } }> }
      const text = data.choices?.[0]?.message?.content || ''
      const cleaned = text.replace(/```json|```/g, '').trim()
      const parsed = JSON.parse(cleaned.match(/\[[\s\S]*\]/)?.[0] || '[]') as AIInsight[]

      if (parsed.length > 0) {
        const toInsert = parsed.map(i => ({ ...i, user_id: user.id, generated_at: new Date().toISOString() }))
        const { data: saved } = await supabase.from('ai_insights').insert(toInsert).select()
        setInsights(prev => [...(saved || toInsert) as AIInsight[], ...prev].slice(0, 30))
        toast.success(`Generated ${parsed.length} AI insights!`)
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : ''
      if (msg === 'NO_KEY') toast.error('Add VITE_GROQ_API_KEY to Vercel environment variables')
      else toast.error('Upload health data first to generate insights')
    } finally { setGenerating(false) }
  }

  async function sendChat(text?: string) {
    const msg = (text || chatInput).trim()
    if (!msg || chatLoading) return
    const time = new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })
    setChat(prev => [...prev, { role: 'user', content: msg, time }])
    setChatInput('')
    setChatLoading(true)

    try {
      const key = import.meta.env.VITE_GROQ_API_KEY
      if (!key || key.includes('your-groq')) throw new Error('NO_KEY')

      const history = chat.slice(-8).map(m => ({ role: m.role as 'user'|'assistant', content: m.content }))

      const res = await fetch(GROQ_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` },
        body: JSON.stringify({
          model: 'llama-3.3-70b-versatile',
          messages: [
            {
              role: 'system',
              content: `You are VitalOS AI, a friendly preventive health analyst for an Indian health platform.

PATIENT DATA:
${healthContext || 'No lab data yet — advise user to upload reports'}

CURRENT INSIGHTS:
${insights.slice(0,3).map(i => `[${i.severity.toUpperCase()}] ${i.title}: ${i.description}`).join('\n') || 'None yet'}

STYLE GUIDE:
- Concise (under 200 words unless complex topic)
- Mention specific lab values when relevant
- Give India-relevant advice (Indian foods, labs, doctors)
- Structure: Explanation → Risk level → 2-3 Action steps
- For doctor referrals: say which specialist and why
- Never diagnose — always recommend consulting a doctor
- Use occasional emojis to be friendly`
            },
            ...history,
            { role: 'user', content: msg }
          ],
          max_tokens: 500,
          temperature: 0.7,
        })
      })

      if (!res.ok) throw new Error('API error')
      const data = await res.json() as { choices: Array<{ message: { content: string } }> }
      const reply = data.choices?.[0]?.message?.content || 'I had trouble responding. Please try again.'
      const replyTime = new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })
      setChat(prev => [...prev, { role: 'assistant', content: reply, time: replyTime }])
    } catch (err) {
      const msg = err instanceof Error ? err.message : ''
      const reply = msg === 'NO_KEY'
        ? 'Add VITE_GROQ_API_KEY to your Vercel environment variables to enable AI chat.'
        : 'Connection error. Please try again in a moment.'
      const replyTime = new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })
      setChat(prev => [...prev, { role: 'assistant', content: reply, time: replyTime }])
    } finally { setChatLoading(false) }
  }

  const sevConfig = {
    critical: { icon: AlertTriangle, color: 'text-red-600',    bg: 'bg-red-50 border-red-100',    badge: 'bg-red-100 text-red-700'    },
    warning:  { icon: AlertTriangle, color: 'text-amber-600',  bg: 'bg-amber-50 border-amber-100',badge: 'bg-amber-100 text-amber-700' },
    info:     { icon: Info,          color: 'text-blue-600',   bg: 'bg-blue-50 border-blue-100',  badge: 'bg-blue-100 text-blue-700'  },
    good:     { icon: CheckCircle,   color: 'text-teal-600',   bg: 'bg-teal-50 border-teal-100',  badge: 'bg-teal-100 text-teal-700'  },
  }

  const filtered = filter === 'all' ? insights : insights.filter(i => i.severity === filter)
  const counts = { all: insights.length, critical: insights.filter(i=>i.severity==='critical').length, warning: insights.filter(i=>i.severity==='warning').length, info: insights.filter(i=>i.severity==='info').length, good: insights.filter(i=>i.severity==='good').length }

  return (
    <div className="p-6 max-w-6xl">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <Brain size={20} className="text-teal-500" />
          <h1 className="text-xl font-bold text-gray-900">AI health insights</h1>
          <span className="flex items-center gap-1 text-[10px] bg-green-50 text-green-700 border border-green-100 px-2 py-0.5 rounded-full">
            <Zap size={9} /> Groq · Llama 3.3 · Free
          </span>
        </div>
        <button onClick={handleGenerate} disabled={generating} className="btn-secondary flex items-center gap-2 text-xs py-2">
          <RefreshCw size={13} className={generating ? 'animate-spin' : ''} />
          {generating ? 'Analyzing your data...' : 'Generate insights'}
        </button>
      </div>

      <div className="grid grid-cols-5 gap-6">
        {/* Insights panel */}
        <div className="col-span-3 space-y-4">
          {/* Filters */}
          <div className="flex gap-2 flex-wrap">
            {(['all','critical','warning','info','good'] as const).map(f => (
              <button key={f} onClick={() => setFilter(f)}
                className={`text-xs px-3 py-1.5 rounded-lg border capitalize transition-colors ${filter===f ? 'bg-gray-900 text-white border-gray-900' : 'border-gray-200 text-gray-500 hover:border-gray-300'}`}>
                {f} <span className="opacity-60">({counts[f]})</span>
              </button>
            ))}
          </div>

          {loading ? (
            <div className="space-y-3">{[1,2,3].map(i => <div key={i} className="card h-24 animate-pulse bg-gray-50"/>)}</div>
          ) : filtered.length === 0 ? (
            <div className="card border-dashed border-2 border-purple-100 text-center py-12">
              <Sparkles size={32} className="text-purple-200 mx-auto mb-3"/>
              <p className="text-sm font-semibold text-gray-600">No insights yet</p>
              <p className="text-xs text-gray-400 mt-1 mb-4">Upload lab reports → click "Generate insights" → get personalized analysis</p>
              <button onClick={handleGenerate} disabled={generating} className="btn-primary text-xs py-2">Generate now</button>
            </div>
          ) : (
            <div className="space-y-3">
              {filtered.map(insight => {
                const cfg = sevConfig[insight.severity] || sevConfig.info
                const Icon = cfg.icon
                return (
                  <div key={insight.id} className={`card border ${cfg.bg}`}>
                    <div className="flex items-start gap-3 mb-2">
                      <Icon size={16} className={`${cfg.color} mt-0.5 shrink-0`} />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <p className="text-sm font-bold text-gray-900">{insight.title}</p>
                          <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold capitalize shrink-0 ${cfg.badge}`}>{insight.severity}</span>
                        </div>
                        <p className="text-xs text-gray-600 leading-relaxed">{insight.description}</p>
                      </div>
                    </div>
                    {insight.recommendation && (
                      <div className="ml-7 p-2.5 bg-white/70 rounded-lg border border-white">
                        <p className="text-xs font-semibold text-gray-700 mb-1">Recommended action</p>
                        <p className="text-xs text-gray-600 leading-relaxed">{insight.recommendation}</p>
                      </div>
                    )}
                    <div className="ml-7 mt-2 flex items-center gap-3">
                      {insight.risk_reduction && (
                        <span className="text-[10px] text-teal-700 bg-teal-50 px-2 py-0.5 rounded-full font-semibold flex items-center gap-1">
                          <TrendingUp size={9} /> {insight.risk_reduction}
                        </span>
                      )}
                      {insight.timeframe && <span className="text-[10px] text-gray-400">{insight.timeframe}</span>}
                      {(insight.related_metrics || []).slice(0,3).map(m => (
                        <span key={m} className="text-[10px] bg-gray-100 text-gray-500 px-1.5 py-0.5 rounded">{m}</span>
                      ))}
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* Chat panel */}
        <div className="col-span-2 card flex flex-col" style={{ height: 580 }}>
          <div className="flex items-center gap-2 mb-4 pb-3 border-b border-gray-100">
            <div className="w-8 h-8 rounded-full flex items-center justify-center"
              style={{ background: 'linear-gradient(135deg,#0f6e56,#1d9e75)' }}>
              <Brain size={14} className="text-white"/>
            </div>
            <div>
              <p className="text-xs font-bold text-gray-900">VitalOS AI Chat</p>
              <p className="text-[10px] text-teal-500 flex items-center gap-1"><Zap size={8}/> Context-aware · Personalized</p>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto space-y-3 mb-3 pr-1">
            {chat.map((m, i) => (
              <div key={i} className={`flex ${m.role==='user' ? 'justify-end' : 'justify-start'}`}>
                {m.role === 'assistant' && (
                  <div className="w-6 h-6 rounded-full flex items-center justify-center mr-1.5 shrink-0 mt-1"
                    style={{ background: 'linear-gradient(135deg,#0f6e56,#1d9e75)' }}>
                    <Sparkles size={10} className="text-white"/>
                  </div>
                )}
                <div className="max-w-[85%]">
                  <div className={`rounded-2xl px-3 py-2 text-xs leading-relaxed whitespace-pre-wrap ${
                    m.role==='user' ? 'text-white rounded-tr-sm' : 'bg-gray-100 text-gray-800 rounded-tl-sm'
                  }`} style={m.role==='user' ? { background:'linear-gradient(135deg,#0f6e56,#1d9e75)' } : {}}>
                    {m.content}
                  </div>
                  <p className="text-[9px] text-gray-400 mt-0.5 px-1">{m.time}</p>
                </div>
              </div>
            ))}
            {chatLoading && (
              <div className="flex justify-start">
                <div className="w-6 h-6 rounded-full flex items-center justify-center mr-1.5"
                  style={{ background:'linear-gradient(135deg,#0f6e56,#1d9e75)' }}>
                  <Sparkles size={10} className="text-white"/>
                </div>
                <div className="bg-gray-100 rounded-2xl px-4 py-3">
                  <div className="flex gap-1">
                    {[0,200,400].map(d => <div key={d} className="w-1.5 h-1.5 bg-teal-400 rounded-full animate-bounce" style={{ animationDelay:`${d}ms` }}/>)}
                  </div>
                </div>
              </div>
            )}
            <div ref={chatEndRef}/>
          </div>

          {/* Quick questions */}
          {chat.length <= 2 && (
            <div className="mb-2 flex flex-wrap gap-1">
              {SUGGESTED_QUESTIONS.slice(0,4).map(q => (
                <button key={q} onClick={() => sendChat(q)}
                  className="text-[10px] text-teal-700 bg-teal-50 border border-teal-100 px-2 py-1 rounded-full hover:bg-teal-100 transition-colors">
                  {q}
                </button>
              ))}
            </div>
          )}

          <div className="flex gap-2">
            <input ref={inputRef} value={chatInput}
              onChange={e => setChatInput(e.target.value)}
              onKeyDown={e => e.key==='Enter' && !e.shiftKey && sendChat()}
              placeholder="Ask anything about your health..."
              className="input text-xs flex-1" />
            <button onClick={() => sendChat()} disabled={!chatInput.trim() || chatLoading}
              className="w-9 h-9 rounded-xl flex items-center justify-center text-white disabled:opacity-40 shrink-0"
              style={{ background:'linear-gradient(135deg,#0f6e56,#1d9e75)' }}>
              <Send size={14}/>
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
