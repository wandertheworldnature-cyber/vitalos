import { useEffect, useState, useRef } from 'react'
import { Brain, Send, RefreshCw, Zap, Sparkles } from 'lucide-react'
import { useAuthStore } from '@/store/authStore'
import { getInsights, generateInsights } from '@/services/healthService'
import { chatWithHealthAI } from '@/services/groqService'
import InsightCard from '@/components/InsightCard'
import type { AIInsight } from '@/types'
import toast from 'react-hot-toast'

interface ChatMessage { role: 'user' | 'assistant'; content: string }

export default function InsightsPage() {
  const { user } = useAuthStore()
  const [insights, setInsights] = useState<AIInsight[]>([])
  const [loading, setLoading] = useState(true)
  const [generating, setGenerating] = useState(false)
  const [filter, setFilter] = useState<'all'|'critical'|'warning'|'info'|'good'>('all')
  const [chat, setChat] = useState<ChatMessage[]>([{
    role: 'assistant',
    content: 'Hi! I\'m your VitalOS AI health analyst. Once you have health data, I can give you personalized insights. What would you like to know?'
  }])
  const [chatInput, setChatInput] = useState('')
  const [chatLoading, setChatLoading] = useState(false)
  const chatEndRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (user) loadInsights()
  }, [user])

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [chat])

  async function loadInsights() {
    if (!user) return
    setLoading(true)
    try {
      const data = await getInsights(user.id)
      setInsights(data)
    } catch { toast.error('Failed to load insights') }
    finally { setLoading(false) }
  }

  async function handleGenerate() {
    if (!user) return
    setGenerating(true)
    try {
      const fresh = await generateInsights(user.id)
      if (fresh.length > 0) {
        setInsights(fresh)
        toast.success(`Generated ${fresh.length} AI insights from your health data!`)
      } else {
        toast('Upload lab reports first to generate personalized insights', { icon: 'ℹ️' })
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : ''
      if (msg.includes('VITE_GROQ_API_KEY')) toast.error('Add VITE_GROQ_API_KEY to your .env')
      else toast.error('Upload health data first')
    } finally { setGenerating(false) }
  }

  async function sendChat() {
    if (!chatInput.trim() || chatLoading) return
    const msg = chatInput.trim()
    const newHistory = [...chat, { role: 'user' as const, content: msg }]
    setChat(newHistory)
    setChatInput('')
    setChatLoading(true)
    try {
      const ctx = insights.map(i => `${i.severity.toUpperCase()}: ${i.title} — ${i.description}`).join('\n')
      const history = chat.slice(-8).map(m => ({ role: m.role as 'user'|'assistant', content: m.content }))
      const reply = await chatWithHealthAI(msg, history, ctx)
      setChat(prev => [...prev, { role: 'assistant', content: reply }])
    } catch {
      setChat(prev => [...prev, { role: 'assistant', content: 'Please add VITE_GROQ_API_KEY to .env to enable AI chat.' }])
    } finally { setChatLoading(false) }
  }

  const filtered = filter === 'all' ? insights : insights.filter(i => i.severity === filter)
  const counts = {
    all: insights.length,
    critical: insights.filter(i => i.severity === 'critical').length,
    warning: insights.filter(i => i.severity === 'warning').length,
    info: insights.filter(i => i.severity === 'info').length,
    good: insights.filter(i => i.severity === 'good').length,
  }

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
        <button onClick={handleGenerate} disabled={generating} className="btn-secondary flex items-center gap-2">
          <RefreshCw size={14} className={generating ? 'animate-spin' : ''} />
          {generating ? 'Analyzing...' : 'Generate insights'}
        </button>
      </div>

      <div className="grid grid-cols-3 gap-6">
        {/* Insights */}
        <div className="col-span-2 space-y-4">
          <div className="flex gap-2 flex-wrap">
            {(['all','critical','warning','info','good'] as const).map(f => (
              <button key={f} onClick={() => setFilter(f)}
                className={`text-xs px-3 py-1.5 rounded-lg border transition-colors ${
                  filter === f ? 'bg-gray-900 text-white border-gray-900' : 'border-gray-200 text-gray-500 hover:border-gray-300'
                }`}>
                {f.charAt(0).toUpperCase() + f.slice(1)} <span className="opacity-60">({counts[f]})</span>
              </button>
            ))}
          </div>

          {loading ? (
            <div className="space-y-3">
              {[1,2,3].map(i => <div key={i} className="card h-24 animate-pulse bg-gray-50" />)}
            </div>
          ) : filtered.length === 0 ? (
            <div className="card border-dashed border-2 border-purple-100 text-center py-12">
              <Sparkles size={32} className="text-purple-200 mx-auto mb-3" />
              <p className="text-sm font-semibold text-gray-600">No insights yet</p>
              <p className="text-xs text-gray-400 mt-1 mb-4">
                Upload lab reports then click "Generate insights" to get AI-powered health analysis
              </p>
              <button onClick={handleGenerate} disabled={generating} className="btn-primary text-xs py-2">
                Generate now
              </button>
            </div>
          ) : (
            <div className="space-y-3">
              {filtered.map(i => <InsightCard key={i.id} insight={i} />)}
            </div>
          )}
        </div>

        {/* Chat */}
        <div className="card flex flex-col" style={{ height: 600 }}>
          <div className="flex items-center gap-2 mb-4 pb-3 border-b border-gray-100">
            <div className="w-7 h-7 rounded-full bg-teal-100 flex items-center justify-center">
              <Brain size={13} className="text-teal-600" />
            </div>
            <div>
              <p className="text-xs font-bold text-gray-900">VitalOS AI</p>
              <p className="text-[10px] text-teal-500 flex items-center gap-1"><Zap size={8} /> Groq · Free</p>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto space-y-3 mb-3">
            {chat.map((m, i) => (
              <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div className={`max-w-[85%] rounded-xl px-3 py-2 text-xs leading-relaxed ${
                  m.role === 'user' ? 'text-white' : 'bg-gray-100 text-gray-700'
                }`} style={m.role === 'user' ? { background: 'linear-gradient(135deg,#0f6e56,#1d9e75)' } : {}}>
                  {m.content}
                </div>
              </div>
            ))}
            {chatLoading && (
              <div className="flex justify-start">
                <div className="bg-gray-100 rounded-xl px-3 py-2 flex gap-1">
                  {[0,150,300].map(d => (
                    <div key={d} className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: `${d}ms` }} />
                  ))}
                </div>
              </div>
            )}
            <div ref={chatEndRef} />
          </div>

          <div className="flex gap-2">
            <input value={chatInput} onChange={e => setChatInput(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && sendChat()}
              placeholder="Ask about your health..." className="input text-xs" />
            <button onClick={sendChat} disabled={chatLoading || !chatInput.trim()} className="btn-primary px-3">
              <Send size={13} />
            </button>
          </div>
          <div className="mt-2 flex flex-wrap gap-1">
            {['What to eat?','Exercise plan?','Book a doctor?'].map(q => (
              <button key={q} onClick={() => setChatInput(q)}
                className="text-[10px] text-blue-500 border border-blue-100 rounded px-2 py-0.5 hover:bg-blue-50">{q}</button>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
