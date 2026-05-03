import { useState, useEffect, useRef } from 'react'
import { MessageCircle, X, Send, Minimize2, Maximize2, Brain, Zap, Sparkles } from 'lucide-react'
import { useAuthStore } from '@/store/authStore'
import { supabase } from '@/lib/supabase'

interface Message { role: 'user' | 'assistant'; content: string; time: string }

const GROQ_URL = 'https://api.groq.com/openai/v1/chat/completions'

const VITALOS_SYSTEM_PROMPT = `You are a preventive healthcare AI assistant for an app called VitalOS.

Your role:
- Analyze user health data over time
- Detect early risk patterns
- Explain insights in simple, non-technical language
- Suggest actionable next steps

Rules:
- Do NOT diagnose diseases
- Do NOT create panic
- Always give balanced, calm explanations
- Highlight trends, not just single values
- Compare with normal ranges and past data
- Prioritize prevention and lifestyle suggestions

Tone:
- Friendly, calm, supportive
- Simple English (Indian users)
- No jargon unless explained

Always mention specific values from the data when available.
Reference Indian foods, labs (Thyrocare, SRL, Apollo), and lifestyle habits.`

const WELCOME = `Hi! I'm your VitalOS health assistant 👋

I can help you:
• Understand your lab reports
• Detect health risks early
• Give lifestyle advice
• Suggest which doctor to see

What would you like to know?`

const QUICK_PROMPTS = [
  'Explain my latest results',
  'Am I at risk for diabetes?',
  'How to improve my score?',
  'Which doctor should I see?',
]

export default function AIChat() {
  const { user } = useAuthStore()
  const [open, setOpen] = useState(false)
  const [minimized, setMinimized] = useState(false)
  const [isMobile, setIsMobile] = useState(false)
  const [messages, setMessages] = useState<Message[]>([
    { role: 'assistant', content: WELCOME, time: now() }
  ])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [showBubble, setShowBubble] = useState(false)
  const [healthContext, setHealthContext] = useState('')
  const chatEndRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  function now() { return new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }) }

  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 768)
    check()
    window.addEventListener('resize', check)
    return () => window.removeEventListener('resize', check)
  }, [])

  useEffect(() => {
    if (!user) return
    const t1 = setTimeout(() => { setShowBubble(true) }, 3000)
    const t2 = setTimeout(() => setShowBubble(false), 10000)
    return () => { clearTimeout(t1); clearTimeout(t2) }
  }, [user])

  useEffect(() => {
    if (open && user && !healthContext) loadContext()
    if (open) setTimeout(() => inputRef.current?.focus(), 100)
  }, [open, user])

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  async function loadContext() {
    if (!user) return
    try {
      const { data } = await supabase.from('health_records')
        .select('test_name,value,unit,reference_min,reference_max')
        .eq('user_id', user.id).order('recorded_at', { ascending: false }).limit(20)
      const ctx = (data || []).map((r: { test_name: string; value: number; unit: string; reference_min?: number; reference_max?: number }) =>
        `${r.test_name}: ${r.value} ${r.unit}${r.reference_min != null ? ` (normal: ${r.reference_min}-${r.reference_max})` : ''}`
      ).join('\n')
      setHealthContext(`Patient: ${user.full_name || user.email}\n\nLab values:\n${ctx || 'No data yet'}`)
    } catch { /* ignore */ }
  }

  async function send(text?: string) {
    const msg = (text || input).trim()
    if (!msg || loading) return
    setMessages(prev => [...prev, { role: 'user', content: msg, time: now() }])
    setInput('')
    setLoading(true)
    try {
      const key = import.meta.env.VITE_GROQ_API_KEY
      if (!key || key.includes('your-groq')) throw new Error('NO_KEY')
      const history = messages.slice(-8).map(m => ({ role: m.role, content: m.content }))
      const res = await fetch(GROQ_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` },
        body: JSON.stringify({
          model: 'llama-3.3-70b-versatile',
          messages: [
            { role: 'system', content: `${VITALOS_SYSTEM_PROMPT}\n\nPATIENT DATA:\n${healthContext || 'No lab data yet'}` },
            ...history,
            { role: 'user', content: msg }
          ],
          max_tokens: 400, temperature: 0.7,
        })
      })
      if (!res.ok) throw new Error('API')
      const d = await res.json() as { choices: Array<{ message: { content: string } }> }
      setMessages(prev => [...prev, { role: 'assistant', content: d.choices?.[0]?.message?.content || 'Try again', time: now() }])
    } catch (err) {
      const isNoKey = err instanceof Error && err.message === 'NO_KEY'
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: isNoKey ? 'Add VITE_GROQ_API_KEY to Vercel environment variables.' : 'Connection error. Please try again.',
        time: now()
      }])
    } finally { setLoading(false) }
  }

  if (!user) return null

  // Mobile: full screen chat
  if (isMobile && open) {
    return (
      <div className="fixed inset-0 z-50 bg-white flex flex-col">
        <div className="flex items-center justify-between px-4 py-3 shrink-0"
          style={{ background: 'linear-gradient(135deg,#0f6e56,#1d9e75)' }}>
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center">
              <Brain size={15} className="text-white" />
            </div>
            <div>
              <p className="text-sm font-bold text-white">VitalOS AI</p>
              <p className="text-[10px] text-emerald-200 flex items-center gap-1"><Zap size={8} /> Always on</p>
            </div>
          </div>
          <button onClick={() => setOpen(false)} className="w-8 h-8 bg-white/20 rounded-full flex items-center justify-center">
            <X size={16} className="text-white" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-gray-50">
          {messages.map((m, i) => (
            <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
              {m.role === 'assistant' && (
                <div className="w-7 h-7 rounded-full flex items-center justify-center mr-2 shrink-0 mt-1"
                  style={{ background: 'linear-gradient(135deg,#0f6e56,#1d9e75)' }}>
                  <Sparkles size={11} className="text-white" />
                </div>
              )}
              <div className="max-w-[80%]">
                <div className={`rounded-2xl px-4 py-2.5 text-sm leading-relaxed whitespace-pre-wrap ${
                  m.role === 'user' ? 'text-white rounded-tr-sm' : 'bg-white text-gray-800 rounded-tl-sm shadow-sm'
                }`} style={m.role === 'user' ? { background: 'linear-gradient(135deg,#0f6e56,#1d9e75)' } : {}}>
                  {m.content}
                </div>
                <p className="text-[10px] text-gray-400 mt-0.5 px-1">{m.time}</p>
              </div>
            </div>
          ))}
          {loading && (
            <div className="flex justify-start">
              <div className="w-7 h-7 rounded-full flex items-center justify-center mr-2 shrink-0"
                style={{ background: 'linear-gradient(135deg,#0f6e56,#1d9e75)' }}>
                <Sparkles size={11} className="text-white" />
              </div>
              <div className="bg-white rounded-2xl px-4 py-3 shadow-sm">
                <div className="flex gap-1">
                  {[0,200,400].map(d => <div key={d} className="w-2 h-2 bg-teal-400 rounded-full animate-bounce" style={{ animationDelay:`${d}ms` }}/>)}
                </div>
              </div>
            </div>
          )}
          <div ref={chatEndRef} />
        </div>

        {messages.length <= 1 && (
          <div className="px-4 py-2 flex gap-2 overflow-x-auto bg-white border-t border-gray-100">
            {QUICK_PROMPTS.map(q => (
              <button key={q} onClick={() => send(q)}
                className="shrink-0 text-xs text-teal-700 bg-teal-50 border border-teal-100 px-3 py-1.5 rounded-full whitespace-nowrap">
                {q}
              </button>
            ))}
          </div>
        )}

        <div className="flex gap-2 p-3 bg-white border-t border-gray-100">
          <input ref={inputRef} value={input} onChange={e => setInput(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && send()}
            placeholder="Ask about your health..."
            className="flex-1 border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-teal-400 bg-gray-50" />
          <button onClick={() => send()} disabled={!input.trim() || loading}
            className="w-11 h-11 rounded-xl flex items-center justify-center text-white disabled:opacity-40 shrink-0"
            style={{ background: 'linear-gradient(135deg,#0f6e56,#1d9e75)' }}>
            <Send size={16} />
          </button>
        </div>
      </div>
    )
  }

  // Desktop: floating window
  return (
    <>
      {/* Bubble */}
      {showBubble && !open && (
        <div className={`fixed z-40 max-w-xs animate-fadeIn ${isMobile ? 'bottom-24 right-4' : 'bottom-24 right-6'}`}>
          <div className="bg-white rounded-2xl shadow-xl border border-emerald-100 px-4 py-3 relative cursor-pointer"
            onClick={() => { setOpen(true); setShowBubble(false) }}>
            <p className="text-xs text-gray-700 leading-relaxed">
              Hi {user.full_name?.split(' ')[0] || 'there'}! 👋 How can I help with your health today?
            </p>
            <div className="absolute -bottom-2 right-5 w-4 h-4 bg-white border-r border-b border-emerald-100 rotate-45" />
            <button onClick={e => { e.stopPropagation(); setShowBubble(false) }}
              className="absolute -top-2 -right-2 w-5 h-5 bg-gray-200 rounded-full flex items-center justify-center">
              <X size={10} className="text-gray-500" />
            </button>
          </div>
        </div>
      )}

      {/* Desktop floating chat */}
      {open && !isMobile && (
        <div className={`fixed right-6 z-50 flex flex-col bg-white rounded-2xl shadow-2xl border border-emerald-100 transition-all ${
          minimized ? 'bottom-6 h-14 w-72' : 'bottom-6 w-80 h-[520px]'
        }`} style={{ boxShadow: '0 20px 60px rgba(15,110,86,0.15)' }}>
          <div className="flex items-center justify-between px-4 py-3 rounded-t-2xl shrink-0"
            style={{ background: 'linear-gradient(135deg,#0f6e56,#1d9e75)' }}>
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-full bg-white/20 flex items-center justify-center">
                <Brain size={13} className="text-white" />
              </div>
              <div>
                <p className="text-xs font-bold text-white">VitalOS AI</p>
                <p className="text-[10px] text-emerald-200 flex items-center gap-1"><Zap size={8} /> Groq · Always on</p>
              </div>
            </div>
            <div className="flex gap-1.5">
              <button onClick={() => setMinimized(m => !m)} className="w-6 h-6 rounded-md bg-white/10 hover:bg-white/20 flex items-center justify-center">
                {minimized ? <Maximize2 size={11} className="text-white" /> : <Minimize2 size={11} className="text-white" />}
              </button>
              <button onClick={() => setOpen(false)} className="w-6 h-6 rounded-md bg-white/10 hover:bg-white/20 flex items-center justify-center">
                <X size={11} className="text-white" />
              </button>
            </div>
          </div>

          {!minimized && (
            <>
              <div className="flex-1 overflow-y-auto p-3 space-y-2.5">
                {messages.map((m, i) => (
                  <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                    {m.role === 'assistant' && (
                      <div className="w-6 h-6 rounded-full flex items-center justify-center mr-1.5 shrink-0 mt-0.5"
                        style={{ background: 'linear-gradient(135deg,#0f6e56,#1d9e75)' }}>
                        <Sparkles size={10} className="text-white" />
                      </div>
                    )}
                    <div className="max-w-[82%]">
                      <div className={`rounded-2xl px-3 py-2 text-xs leading-relaxed whitespace-pre-wrap ${
                        m.role === 'user' ? 'text-white rounded-tr-sm' : 'bg-gray-100 text-gray-800 rounded-tl-sm'
                      }`} style={m.role === 'user' ? { background: 'linear-gradient(135deg,#0f6e56,#1d9e75)' } : {}}>
                        {m.content}
                      </div>
                      <p className="text-[9px] text-gray-400 mt-0.5 px-1">{m.time}</p>
                    </div>
                  </div>
                ))}
                {loading && (
                  <div className="flex justify-start">
                    <div className="w-6 h-6 rounded-full flex items-center justify-center mr-1.5"
                      style={{ background: 'linear-gradient(135deg,#0f6e56,#1d9e75)' }}>
                      <Sparkles size={10} className="text-white" />
                    </div>
                    <div className="bg-gray-100 rounded-2xl px-3 py-2.5">
                      <div className="flex gap-1">
                        {[0,200,400].map(d => <div key={d} className="w-1.5 h-1.5 bg-teal-400 rounded-full animate-bounce" style={{ animationDelay:`${d}ms` }}/>)}
                      </div>
                    </div>
                  </div>
                )}
                <div ref={chatEndRef} />
              </div>

              {messages.length <= 1 && (
                <div className="px-3 pb-2 flex gap-1.5 overflow-x-auto">
                  {QUICK_PROMPTS.slice(0,3).map(q => (
                    <button key={q} onClick={() => send(q)}
                      className="shrink-0 text-[10px] text-teal-700 bg-teal-50 border border-teal-100 px-2 py-1 rounded-full whitespace-nowrap">
                      {q}
                    </button>
                  ))}
                </div>
              )}

              <div className="p-3 border-t border-gray-100 flex gap-2">
                <input ref={inputRef} value={input} onChange={e => setInput(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && send()}
                  placeholder="Ask about your health..."
                  className="flex-1 text-xs border border-gray-200 rounded-xl px-3 py-2 focus:outline-none focus:border-teal-400 bg-gray-50" />
                <button onClick={() => send()} disabled={!input.trim() || loading}
                  className="w-9 h-9 rounded-xl flex items-center justify-center text-white disabled:opacity-40 shrink-0"
                  style={{ background: 'linear-gradient(135deg,#0f6e56,#1d9e75)' }}>
                  <Send size={13} />
                </button>
              </div>
            </>
          )}
        </div>
      )}

      {/* FAB */}
      {!open && (
        <button onClick={() => setOpen(true)}
          className={`fixed z-40 w-14 h-14 rounded-full flex items-center justify-center text-white shadow-lg transition-all hover:scale-110 ${
            isMobile ? 'bottom-20 right-4' : 'bottom-6 right-6'
          }`}
          style={{ background: 'linear-gradient(135deg,#0f6e56,#1d9e75)', boxShadow: '0 8px 24px rgba(15,110,86,0.4)' }}>
          <MessageCircle size={24} />
        </button>
      )}
    </>
  )
}
