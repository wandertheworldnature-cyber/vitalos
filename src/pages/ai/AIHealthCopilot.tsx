import { useState, useEffect, useRef } from 'react'
import { useAuthStore } from '@/store/authStore'
import { supabase } from '@/lib/supabase'
import { Brain, Send, Mic, MicOff, Sparkles, User, RefreshCw, Zap, Heart, Activity, Moon, Shield } from 'lucide-react'
import toast from 'react-hot-toast'

interface Message {
  id: string
  role: 'user' | 'assistant'
  content: string
  timestamp: Date
  mode?: string
}

interface HealthContext {
  recentMetrics: Array<{ name: string; value: number; unit: string; status: string }>
  latestInsights: Array<{ title: string; severity: string }>
  profile: { age?: number; gender?: string; conditions?: string }
  moodAvg?: number
  sleepAvg?: number
  recoveryScore?: number
}

const QUICK_PROMPTS = [
  { icon: '😴', text: 'Why am I feeling tired recently?', category: 'energy' },
  { icon: '🍚', text: 'What should I eat for my blood markers?', category: 'nutrition' },
  { icon: '💓', text: 'Is my heart health okay?', category: 'cardiac' },
  { icon: '🧠', text: 'Am I at risk of diabetes?', category: 'metabolic' },
  { icon: '😰', text: 'I\'ve been very stressed lately', category: 'mental' },
  { icon: '💊', text: 'What supplements do I need?', category: 'supplements' },
  { icon: '🏃', text: 'Should I exercise today?', category: 'fitness' },
  { icon: '😴', text: 'How can I sleep better?', category: 'sleep' },
]

const GROQ_URL = 'https://api.groq.com/openai/v1/chat/completions'

export default function AIHealthCopilot() {
  const { user } = useAuthStore()
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [context, setContext] = useState<HealthContext | null>(null)
  const [listening, setListening] = useState(false)
  const [recognition, setRecognition] = useState<SpeechRecognition | null>(null)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => { if (user) { loadContext(); initVoice() } }, [user])
  useEffect(() => { messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [messages])

  useEffect(() => {
    if (messages.length === 0 && context) {
      const greeting = getGreeting()
      setMessages([{
        id: '0', role: 'assistant', timestamp: new Date(),
        content: `${greeting} I'm your personal AI health copilot. I've reviewed your health data and I'm ready to help.\n\n${getContextSummary(context)}\n\nWhat's on your mind today?`
      }])
    }
  }, [context])

  function getGreeting() {
    const h = new Date().getHours()
    return h < 12 ? 'Good morning! 🌅' : h < 17 ? 'Good afternoon! ☀️' : 'Good evening! 🌙'
  }

  function getContextSummary(ctx: HealthContext) {
    const issues = ctx.recentMetrics.filter(m => m.status === 'warning' || m.status === 'critical')
    if (issues.length > 0) return `⚠️ I noticed ${issues.length} metric${issues.length > 1 ? 's' : ''} that need attention: ${issues.slice(0, 3).map(m => m.name).join(', ')}.`
    return '✅ Your recent metrics look generally stable. Always happy to dig deeper into anything specific.'
  }

  async function loadContext() {
    if (!user) return
    const [metrics, insights, profile, mood, sleep] = await Promise.all([
      supabase.from('health_records').select('test_name,value,unit,reference_min,reference_max').eq('user_id', user.id).order('recorded_at', { ascending: false }).limit(30),
      supabase.from('ai_insights').select('title,severity').eq('user_id', user.id).order('generated_at', { ascending: false }).limit(5),
      supabase.from('profiles').select('date_of_birth,gender,known_conditions').eq('id', user.id).single(),
      supabase.from('health_records').select('value').eq('user_id', user.id).eq('test_name', 'Mood Log').order('recorded_at', { ascending: false }).limit(7),
      supabase.from('health_records').select('value').eq('user_id', user.id).eq('test_name', 'Sleep Duration').order('recorded_at', { ascending: false }).limit(7),
    ])

    let age: number | undefined
    if (profile.data?.date_of_birth) age = Math.floor((Date.now() - new Date(profile.data.date_of_birth).getTime()) / 31557600000)

    const seen = new Map()
    for (const r of (metrics.data || [])) {
      if (!seen.has(r.test_name)) {
        const status = r.reference_max && r.value > r.reference_max ? 'critical' : r.reference_min && r.value < r.reference_min ? 'warning' : 'normal'
        seen.set(r.test_name, { name: r.test_name, value: r.value, unit: r.unit || '', status })
      }
    }

    const moodVals = (mood.data || []).map((r: { value: number }) => r.value)
    const sleepVals = (sleep.data || []).map((r: { value: number }) => r.value)

    setContext({
      recentMetrics: Array.from(seen.values()),
      latestInsights: (insights.data || []) as Array<{ title: string; severity: string }>,
      profile: { age, gender: profile.data?.gender, conditions: profile.data?.known_conditions },
      moodAvg: moodVals.length ? +(moodVals.reduce((a: number, b: number) => a + b, 0) / moodVals.length).toFixed(1) : undefined,
      sleepAvg: sleepVals.length ? +(sleepVals.reduce((a: number, b: number) => a + b, 0) / sleepVals.length).toFixed(1) : undefined,
    })
  }

  function initVoice() {
    if (!('webkitSpeechRecognition' in window) && !('SpeechRecognition' in window)) return
    const SR = (window as Window & { SpeechRecognition?: typeof SpeechRecognition; webkitSpeechRecognition?: typeof SpeechRecognition }).SpeechRecognition ||
               (window as Window & { SpeechRecognition?: typeof SpeechRecognition; webkitSpeechRecognition?: typeof SpeechRecognition }).webkitSpeechRecognition
    if (!SR) return
    const r = new SR()
    r.continuous = false; r.interimResults = false; r.lang = 'en-IN'
    r.onresult = (e: SpeechRecognitionEvent) => {
      const transcript = e.results[0][0].transcript
      setInput(transcript)
      setListening(false)
    }
    r.onerror = () => { setListening(false); toast.error('Voice recognition failed') }
    r.onend = () => setListening(false)
    setRecognition(r)
  }

  function toggleVoice() {
    if (!recognition) { toast.error('Voice not supported on this browser'); return }
    if (listening) { recognition.stop(); setListening(false) }
    else { recognition.start(); setListening(true); toast('Listening...', { icon: '🎤' }) }
  }

  async function sendMessage(text?: string) {
    const msg = (text || input).trim()
    if (!msg || loading) return
    setInput('')

    const userMsg: Message = { id: Date.now().toString(), role: 'user', content: msg, timestamp: new Date() }
    setMessages(prev => [...prev, userMsg])
    setLoading(true)

    try {
      const key = import.meta.env.VITE_GROQ_API_KEY
      if (!key) { toast.error('Add VITE_GROQ_API_KEY to Vercel env vars'); setLoading(false); return }

      // Build rich health context for AI
      const ctxStr = context ? `
PATIENT HEALTH CONTEXT:
- Age: ${context.profile.age || 'Unknown'}, Gender: ${context.profile.gender || 'Unknown'}
- Known conditions: ${context.profile.conditions || 'None reported'}
- Average mood: ${context.moodAvg ? `${context.moodAvg}/10` : 'Not tracked'}
- Average sleep: ${context.sleepAvg ? `${context.sleepAvg} hours` : 'Not tracked'}
- Recent lab markers (${context.recentMetrics.length} total): ${context.recentMetrics.slice(0, 15).map(m => `${m.name}: ${m.value} ${m.unit} [${m.status}]`).join(', ')}
- Active health alerts: ${context.latestInsights.slice(0, 3).map(i => `${i.title} (${i.severity})`).join(', ') || 'None'}` : ''

      const conversationHistory = messages.slice(-6).map(m => ({ role: m.role, content: m.content }))

      const res = await fetch(GROQ_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` },
        body: JSON.stringify({
          model: 'llama-3.3-70b-versatile',
          messages: [
            {
              role: 'system',
              content: `You are an AI health copilot for VitalOS, a preventive health platform for Indian users. You are warm, empathetic, and knowledgeable — like a doctor friend who knows the patient personally.

${ctxStr}

RULES:
- Always reference the patient's actual health data when relevant
- Never diagnose — instead say "this pattern suggests" or "this may indicate"
- Be specific with numbers from their data, not generic advice
- Give Indian-context recommendations (Indian foods, Indian climate, common Indian conditions)
- Keep responses concise — 3-5 sentences max unless detailed explanation needed
- End with one specific actionable next step
- If mental health concern, be extra empathetic and suggest professional help when needed
- NEVER say "I don't have access to your data" — you DO have their context above`
            },
            ...conversationHistory,
            { role: 'user', content: msg }
          ],
          max_tokens: 400,
          temperature: 0.6,
        })
      })

      const data = await res.json() as { choices: Array<{ message: { content: string } }> }
      const reply = data.choices[0].message.content

      const assistantMsg: Message = { id: (Date.now() + 1).toString(), role: 'assistant', content: reply, timestamp: new Date() }
      setMessages(prev => [...prev, assistantMsg])

      // Save to health memory
      if (user) {
        await supabase.from('health_records').insert({
          user_id: user.id, record_type: 'memory', test_name: 'AI Copilot Chat',
          value: 0, unit: '', source: 'ai', recorded_at: new Date().toISOString(),
          metadata: { type: 'insight', title: msg.slice(0, 80), description: reply.slice(0, 200), tags: ['copilot'], source: 'ai' }
        }).then(() => {})
      }
    } catch (e) {
      toast.error('AI response failed — check API key')
      console.error(e)
    } finally { setLoading(false) }
  }

  const proactiveAlerts = context?.recentMetrics.filter(m => m.status === 'critical' || m.status === 'warning').slice(0, 3) || []

  return (
    <div className="flex flex-col h-[calc(100vh-0px)] max-h-screen">
      {/* Header */}
      <div className="px-4 py-3 border-b border-gray-100 shrink-0" style={{ background: 'linear-gradient(135deg,#0f2a1e,#1a3a2a)' }}>
        <div className="flex items-center gap-3 max-w-2xl mx-auto">
          <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0" style={{ background: 'linear-gradient(135deg,#0f6e56,#1d9e75)' }}>
            <Brain size={20} className="text-white" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <h1 className="text-base font-bold text-white">AI Health Copilot</h1>
              <span className="text-[9px] bg-emerald-800 text-emerald-300 border border-emerald-700 px-1.5 py-0.5 rounded-full font-bold">Knows your data</span>
            </div>
            <p className="text-[10px] text-emerald-400">
              {context ? `${context.recentMetrics.length} markers · ${context.latestInsights.length} alerts · Mood ${context.moodAvg || '—'}/10` : 'Loading your health context...'}
            </p>
          </div>
          <button onClick={() => { setMessages([]); setTimeout(() => loadContext(), 100) }}
            className="text-gray-400 hover:text-white p-1.5 rounded-lg hover:bg-white/10">
            <RefreshCw size={14} />
          </button>
        </div>
      </div>

      {/* Proactive alerts */}
      {proactiveAlerts.length > 0 && (
        <div className="px-4 py-2 border-b border-amber-100 shrink-0" style={{ background: '#fffbeb' }}>
          <div className="max-w-2xl mx-auto">
            <p className="text-[10px] font-bold text-amber-600 mb-1">⚡ Proactive alerts from your latest data:</p>
            <div className="flex gap-2 flex-wrap">
              {proactiveAlerts.map(m => (
                <button key={m.name} onClick={() => sendMessage(`Tell me about my ${m.name} level of ${m.value} ${m.unit}`)}
                  className="text-[11px] bg-amber-100 text-amber-700 px-2.5 py-1 rounded-full border border-amber-200 hover:bg-amber-200 transition-colors">
                  {m.name}: {m.value} {m.unit} ⚠️
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
        <div className="max-w-2xl mx-auto space-y-4">
          {messages.length === 0 && !context && (
            <div className="flex items-center justify-center py-12">
              <div className="flex flex-col items-center gap-3">
                <div className="w-12 h-12 border-2 border-t-emerald-500 border-gray-200 rounded-full animate-spin" />
                <p className="text-sm text-gray-400">Loading your health context...</p>
              </div>
            </div>
          )}

          {messages.map(msg => (
            <div key={msg.id} className={`flex gap-3 ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
              {msg.role === 'assistant' && (
                <div className="w-8 h-8 rounded-full flex items-center justify-center shrink-0 mt-1" style={{ background: 'linear-gradient(135deg,#0f6e56,#1d9e75)' }}>
                  <Brain size={14} className="text-white" />
                </div>
              )}
              <div className={`max-w-[80%] rounded-2xl px-4 py-3 ${msg.role === 'user'
                ? 'text-white rounded-tr-sm'
                : 'bg-white border border-gray-100 text-gray-800 rounded-tl-sm shadow-sm'}`}
                style={msg.role === 'user' ? { background: 'linear-gradient(135deg,#0f6e56,#1d9e75)' } : {}}>
                <p className="text-sm leading-relaxed whitespace-pre-line">{msg.content}</p>
                <p className={`text-[9px] mt-1 ${msg.role === 'user' ? 'text-white/60 text-right' : 'text-gray-400'}`}>
                  {msg.timestamp.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}
                </p>
              </div>
              {msg.role === 'user' && (
                <div className="w-8 h-8 rounded-full flex items-center justify-center shrink-0 mt-1 bg-gray-100 text-xs font-bold text-gray-600">
                  {user?.full_name?.[0] || 'U'}
                </div>
              )}
            </div>
          ))}

          {loading && (
            <div className="flex gap-3">
              <div className="w-8 h-8 rounded-full flex items-center justify-center shrink-0" style={{ background: 'linear-gradient(135deg,#0f6e56,#1d9e75)' }}>
                <Brain size={14} className="text-white" />
              </div>
              <div className="bg-white border border-gray-100 rounded-2xl rounded-tl-sm px-4 py-3 shadow-sm">
                <div className="flex gap-1 items-center">
                  <div className="w-2 h-2 bg-teal-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                  <div className="w-2 h-2 bg-teal-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                  <div className="w-2 h-2 bg-teal-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                </div>
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>
      </div>

      {/* Quick prompts */}
      {messages.length <= 1 && (
        <div className="px-4 py-2 border-t border-gray-100 shrink-0">
          <div className="max-w-2xl mx-auto">
            <p className="text-[10px] text-gray-400 mb-2 font-semibold">Quick questions:</p>
            <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
              {QUICK_PROMPTS.map(p => (
                <button key={p.text} onClick={() => sendMessage(p.text)}
                  className="flex items-center gap-1.5 text-xs bg-gray-50 border border-gray-200 text-gray-600 px-3 py-2 rounded-xl whitespace-nowrap hover:bg-gray-100 transition-colors shrink-0">
                  <span>{p.icon}</span>{p.text}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Input */}
      <div className="px-4 py-3 border-t border-gray-100 bg-white shrink-0">
        <div className="max-w-2xl mx-auto flex gap-2">
          <div className="flex-1 flex items-center gap-2 bg-gray-50 border border-gray-200 rounded-xl px-3 py-2.5 focus-within:border-teal-400 focus-within:ring-1 focus-within:ring-teal-100 transition-all">
            <input ref={inputRef} type="text" className="flex-1 bg-transparent text-sm text-gray-800 outline-none placeholder-gray-400"
              placeholder="Ask anything about your health..." value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && !e.shiftKey && sendMessage()} />
            <button onClick={toggleVoice}
              className={`shrink-0 p-1 rounded-lg transition-colors ${listening ? 'text-red-500 bg-red-50' : 'text-gray-400 hover:text-teal-600'}`}>
              {listening ? <MicOff size={16} /> : <Mic size={16} />}
            </button>
          </div>
          <button onClick={() => sendMessage()} disabled={!input.trim() || loading}
            className="w-10 h-10 rounded-xl flex items-center justify-center text-white shrink-0 disabled:opacity-40 transition-all"
            style={{ background: 'linear-gradient(135deg,#0f6e56,#1d9e75)' }}>
            <Send size={16} />
          </button>
        </div>
      </div>
    </div>
  )
}
