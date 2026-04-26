import { useState, useEffect, useRef } from 'react'
import { MessageCircle, X, Send, Minimize2, Maximize2, Brain, Zap, Sparkles } from 'lucide-react'
import { useAuthStore } from '@/store/authStore'
import { supabase } from '@/lib/supabase'

interface Message {
  role: 'user' | 'assistant'
  content: string
  time: string
}

const GROQ_URL = 'https://api.groq.com/openai/v1/chat/completions'

const WELCOME = `Hi! I'm your VitalOS AI health assistant 👋

I can help you with:
• Understanding your lab reports & trends
• Health insights & recommendations  
• Booking doctor appointments
• Diet & lifestyle advice
• Answering health questions

What would you like to know today?`

const QUICK_PROMPTS = [
  'What do my latest results mean?',
  'How can I improve my health score?',
  'What foods should I avoid?',
  'Book a doctor consultation',
  'Explain my Vitamin D levels',
]

export default function AIChat() {
  const { user } = useAuthStore()
  const [open, setOpen] = useState(false)
  const [minimized, setMinimized] = useState(false)
  const [messages, setMessages] = useState<Message[]>([
    { role: 'assistant', content: WELCOME, time: now() }
  ])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [hasNewMsg, setHasNewMsg] = useState(false)
  const [healthContext, setHealthContext] = useState('')
  const [showBubble, setShowBubble] = useState(false)
  const [bubbleMsg, setBubbleMsg] = useState('')
  const chatEndRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  function now() {
    return new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })
  }

  // Show chat bubble 3 seconds after login
  useEffect(() => {
    if (!user) return
    const t1 = setTimeout(() => {
      setBubbleMsg(`Hi ${user.full_name?.split(' ')[0] || 'there'}! 👋 How can I help with your health today?`)
      setShowBubble(true)
    }, 3000)
    const t2 = setTimeout(() => setShowBubble(false), 10000)
    return () => { clearTimeout(t1); clearTimeout(t2) }
  }, [user])

  // Load health context when chat opens
  useEffect(() => {
    if (open && user && !healthContext) loadHealthContext()
    if (open) { setTimeout(() => inputRef.current?.focus(), 100) }
  }, [open, user])

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  async function loadHealthContext() {
    if (!user) return
    try {
      const [records, insights] = await Promise.all([
        supabase.from('health_records').select('test_name,value,unit,reference_min,reference_max,recorded_at')
          .eq('user_id', user.id).order('recorded_at', { ascending: false }).limit(20),
        supabase.from('ai_insights').select('severity,title,description')
          .eq('user_id', user.id).order('generated_at', { ascending: false }).limit(5),
      ])

      const recs = (records.data || []).map((r: { test_name: string; value: number; unit: string; reference_min?: number; reference_max?: number }) =>
        `${r.test_name}: ${r.value} ${r.unit}${r.reference_min != null ? ` (ref: ${r.reference_min}-${r.reference_max})` : ''}`
      ).join('\n')

      const ins = (insights.data || []).map((i: { severity: string; title: string; description: string }) =>
        `[${i.severity.toUpperCase()}] ${i.title}: ${i.description}`
      ).join('\n')

      setHealthContext(`Patient: ${user.full_name || user.email}\n\nRecent lab values:\n${recs || 'No data yet'}\n\nAI insights:\n${ins || 'No insights yet'}`)
    } catch { /* ignore */ }
  }

  async function sendMessage(text?: string) {
    const msg = (text || input).trim()
    if (!msg || loading) return

    const userMsg: Message = { role: 'user', content: msg, time: now() }
    setMessages(prev => [...prev, userMsg])
    setInput('')
    setLoading(true)

    try {
      const key = import.meta.env.VITE_GROQ_API_KEY
      if (!key || key.includes('your-groq')) throw new Error('NO_KEY')

      const history = messages.slice(-10).map(m => ({ role: m.role, content: m.content }))

      const res = await fetch(GROQ_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` },
        body: JSON.stringify({
          model: 'llama-3.3-70b-versatile',
          messages: [
            {
              role: 'system',
              content: `You are VitalOS AI, a friendly and knowledgeable personal health assistant for an Indian preventive health platform.

${healthContext ? `PATIENT HEALTH DATA:\n${healthContext}\n` : ''}
Guidelines:
- Be warm, concise (under 150 words unless asked for more), and specific
- Reference actual patient values when relevant
- Give practical India-relevant advice (Indian foods, lifestyle)
- For booking doctors, say "Go to Doctors section in the menu"
- Never diagnose — always recommend consulting a doctor for clinical decisions
- Use simple language, avoid medical jargon unless necessary
- Add relevant emojis occasionally to make responses friendly`
            },
            ...history,
            { role: 'user', content: msg }
          ],
          max_tokens: 400,
          temperature: 0.7,
        })
      })

      if (!res.ok) throw new Error('API error')
      const data = await res.json() as { choices: Array<{ message: { content: string } }> }
      const reply = data.choices?.[0]?.message?.content || 'I had trouble responding. Please try again.'
      setMessages(prev => [...prev, { role: 'assistant', content: reply, time: now() }])
    } catch (err) {
      const msg = err instanceof Error && err.message === 'NO_KEY'
        ? 'Please add VITE_GROQ_API_KEY to your environment variables to enable AI chat.'
        : 'I\'m having trouble connecting. Please try again in a moment.'
      setMessages(prev => [...prev, { role: 'assistant', content: msg, time: now() }])
    } finally {
      setLoading(false)
    }
  }

  function handleOpen() {
    setOpen(true)
    setShowBubble(false)
    setHasNewMsg(false)
  }

  if (!user) return null

  return (
    <>
      {/* Speech bubble */}
      {showBubble && !open && (
        <div className="fixed bottom-24 right-6 z-40 max-w-xs animate-fadeIn">
          <div className="bg-white rounded-2xl shadow-xl border border-emerald-100 px-4 py-3 relative cursor-pointer"
            onClick={handleOpen}>
            <p className="text-xs text-gray-700 leading-relaxed">{bubbleMsg}</p>
            <div className="absolute -bottom-2 right-5 w-4 h-4 bg-white border-r border-b border-emerald-100 rotate-45" />
            <button onClick={e => { e.stopPropagation(); setShowBubble(false) }}
              className="absolute -top-2 -right-2 w-5 h-5 bg-gray-200 rounded-full flex items-center justify-center text-gray-500 hover:bg-gray-300">
              <X size={10} />
            </button>
          </div>
        </div>
      )}

      {/* Chat window */}
      {open && (
        <div
          className={`fixed right-6 z-50 flex flex-col bg-white rounded-2xl shadow-2xl border border-emerald-100 transition-all duration-200 ${
            minimized ? 'bottom-6 h-14 w-72' : 'bottom-6 w-80 h-[520px]'
          }`}
          style={{ boxShadow: '0 20px 60px rgba(15,110,86,0.15)' }}>

          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 rounded-t-2xl flex-shrink-0"
            style={{ background: 'linear-gradient(135deg,#0f6e56,#1d9e75)' }}>
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center">
                <Brain size={15} className="text-white" />
              </div>
              <div>
                <p className="text-xs font-bold text-white">VitalOS AI</p>
                <p className="text-[10px] text-emerald-200 flex items-center gap-1">
                  <span className="w-1.5 h-1.5 bg-green-400 rounded-full inline-block" />
                  <Zap size={8} className="inline" /> Groq · Always on
                </p>
              </div>
            </div>
            <div className="flex items-center gap-1.5">
              <button onClick={() => setMinimized(m => !m)}
                className="w-7 h-7 rounded-lg bg-white/10 hover:bg-white/20 flex items-center justify-center text-white transition-colors">
                {minimized ? <Maximize2 size={12} /> : <Minimize2 size={12} />}
              </button>
              <button onClick={() => setOpen(false)}
                className="w-7 h-7 rounded-lg bg-white/10 hover:bg-white/20 flex items-center justify-center text-white transition-colors">
                <X size={12} />
              </button>
            </div>
          </div>

          {!minimized && (
            <>
              {/* Messages */}
              <div className="flex-1 overflow-y-auto p-4 space-y-3">
                {messages.map((m, i) => (
                  <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                    {m.role === 'assistant' && (
                      <div className="w-6 h-6 rounded-full flex items-center justify-center mr-1.5 shrink-0 mt-1"
                        style={{ background: 'linear-gradient(135deg,#0f6e56,#1d9e75)' }}>
                        <Sparkles size={10} className="text-white" />
                      </div>
                    )}
                    <div className="max-w-[78%]">
                      <div className={`rounded-2xl px-3 py-2 text-xs leading-relaxed ${
                        m.role === 'user'
                          ? 'text-white rounded-tr-sm'
                          : 'bg-gray-100 text-gray-800 rounded-tl-sm'
                      }`}
                        style={m.role === 'user' ? { background: 'linear-gradient(135deg,#0f6e56,#1d9e75)' } : {}}>
                        <p className="whitespace-pre-wrap">{m.content}</p>
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
                    <div className="bg-gray-100 rounded-2xl rounded-tl-sm px-4 py-3">
                      <div className="flex gap-1">
                        {[0,200,400].map(d => (
                          <div key={d} className="w-1.5 h-1.5 bg-teal-400 rounded-full animate-bounce"
                            style={{ animationDelay: `${d}ms` }} />
                        ))}
                      </div>
                    </div>
                  </div>
                )}
                <div ref={chatEndRef} />
              </div>

              {/* Quick prompts */}
              {messages.length <= 1 && (
                <div className="px-3 pb-2 flex gap-1.5 overflow-x-auto">
                  {QUICK_PROMPTS.slice(0,3).map(p => (
                    <button key={p} onClick={() => sendMessage(p)}
                      className="shrink-0 text-[10px] text-teal-700 bg-teal-50 border border-teal-100 px-2.5 py-1.5 rounded-full hover:bg-teal-100 transition-colors whitespace-nowrap">
                      {p}
                    </button>
                  ))}
                </div>
              )}

              {/* Input */}
              <div className="p-3 border-t border-gray-100 flex gap-2">
                <input
                  ref={inputRef}
                  value={input}
                  onChange={e => setInput(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && !e.shiftKey && sendMessage()}
                  placeholder="Ask about your health..."
                  className="flex-1 text-xs border border-gray-200 rounded-xl px-3 py-2 focus:outline-none focus:border-teal-400 bg-gray-50"
                />
                <button onClick={() => sendMessage()}
                  disabled={!input.trim() || loading}
                  className="w-9 h-9 rounded-xl flex items-center justify-center text-white disabled:opacity-40 transition-all"
                  style={{ background: 'linear-gradient(135deg,#0f6e56,#1d9e75)' }}>
                  <Send size={14} />
                </button>
              </div>
            </>
          )}
        </div>
      )}

      {/* FAB button */}
      {!open && (
        <button onClick={handleOpen}
          className="fixed bottom-6 right-6 z-40 w-14 h-14 rounded-full flex items-center justify-center text-white shadow-lg transition-all hover:scale-110 active:scale-95"
          style={{ background: 'linear-gradient(135deg,#0f6e56,#1d9e75)', boxShadow: '0 8px 24px rgba(15,110,86,0.4)' }}>
          <MessageCircle size={24} />
          {hasNewMsg && (
            <span className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 rounded-full flex items-center justify-center text-[9px] text-white font-bold">1</span>
          )}
        </button>
      )}
    </>
  )
}
