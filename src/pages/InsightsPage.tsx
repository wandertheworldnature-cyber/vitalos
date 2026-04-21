import { useEffect, useState, useRef } from 'react'
import { Brain, Send, RefreshCw, Zap } from 'lucide-react'
import { useAuthStore } from '@/store/authStore'
import { getInsights, generateInsights } from '@/services/healthService'
import { chatWithHealthAI } from '@/services/groqService'
import InsightCard from '@/components/InsightCard'
import type { AIInsight } from '@/types'
import toast from 'react-hot-toast'

interface ChatMessage {
  role: 'user' | 'assistant'
  content: string
}

const DEMO_INSIGHTS: AIInsight[] = [
  {
    id: '1', user_id: '', severity: 'critical',
    title: 'Pre-diabetes trajectory detected',
    description: 'Fasting glucose risen from 88→98 mg/dL over 3 quarters — a consistent 5% quarterly increase. Pre-diabetic threshold (100 mg/dL) may be crossed within 6 months.',
    recommendation: '30-day glucose reset: walk 8,000 steps daily, remove sugar-sweetened drinks, replace white rice with millets. Retest HbA1c in 3 months.',
    risk_reduction: '−22% risk', related_metrics: ['Fasting Glucose', 'HbA1c'], timeframe: '18 months', generated_at: new Date().toISOString(),
  },
  {
    id: '2', user_id: '', severity: 'critical',
    title: 'Severe Vitamin D deficiency',
    description: 'Vitamin D at 18 ng/mL — 40% below healthy threshold (30 ng/mL). Linked to impaired insulin sensitivity, fatigue, and immune dysfunction.',
    recommendation: '15 min sunlight 10am–2pm daily. Supplement 60,000 IU Vitamin D3 weekly for 8 weeks (doctor supervised). Add eggs, fatty fish to diet.',
    risk_reduction: '−35% bone risk', related_metrics: ['Vitamin D'], timeframe: '8 weeks', generated_at: new Date().toISOString(),
  },
  {
    id: '3', user_id: '', severity: 'warning',
    title: 'LDL borderline — cardiovascular watch',
    description: 'LDL at 142 mg/dL (optimal <130) combined with rising glucose creates compounding cardiovascular risk — especially for South Asian metabolic profiles.',
    recommendation: 'Reduce ghee/butter, add 1 tbsp flaxseeds + 10 walnuts daily. 30 min cardio 5x/week. Retest lipid panel in 3 months.',
    risk_reduction: '−18% cardiac risk', related_metrics: ['LDL Cholesterol', 'Fasting Glucose'], timeframe: '3 months', generated_at: new Date().toISOString(),
  },
  {
    id: '4', user_id: '', severity: 'warning',
    title: 'HbA1c approaching pre-diabetic range',
    description: 'HbA1c at 5.8% is close to the 5.7% pre-diabetic threshold. Combined with rising fasting glucose, this requires urgent lifestyle intervention.',
    recommendation: '150 min moderate exercise/week per ICMR guidelines. Reduce carb intake by 20%, increase dietary fiber to 25g/day.',
    risk_reduction: '−28% diabetes risk', related_metrics: ['HbA1c', 'Fasting Glucose'], timeframe: '6 months', generated_at: new Date().toISOString(),
  },
  {
    id: '5', user_id: '', severity: 'good',
    title: 'Thyroid function normal',
    description: 'TSH at 2.4 mIU/L — within optimal range. No evidence of thyroid disorder.',
    recommendation: 'Continue current lifestyle. Annual retest recommended as part of full panel.',
    related_metrics: ['TSH'], generated_at: new Date().toISOString(),
  },
  {
    id: '6', user_id: '', severity: 'info',
    title: 'Hemoglobin — monitor trend',
    description: 'Hemoglobin at 13.8 g/dL is within normal range but toward the lower end for adult males. Worth monitoring annually.',
    recommendation: 'Include iron-rich foods: spinach, legumes, liver. Avoid tea/coffee with meals. Pair iron foods with Vitamin C for better absorption.',
    related_metrics: ['Hemoglobin'], generated_at: new Date().toISOString(),
  },
]

export default function InsightsPage() {
  const { user } = useAuthStore()
  const [insights, setInsights] = useState<AIInsight[]>(DEMO_INSIGHTS)
  const [generating, setGenerating] = useState(false)
  const [filter, setFilter] = useState<'all' | 'critical' | 'warning' | 'info' | 'good'>('all')
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([
    {
      role: 'assistant',
      content: 'Hi! I\'m your VitalOS AI health analyst, powered by Llama 3.3 (Groq). I\'ve reviewed your health insights — you have 2 critical alerts and 2 warnings. What would you like to know?',
    }
  ])
  const [chatInput, setChatInput] = useState('')
  const [chatLoading, setChatLoading] = useState(false)
  const chatEndRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!user) return
    getInsights(user.id)
      .then(data => { if (data.length > 0) setInsights(data) })
      .catch(() => {})
  }, [user])

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [chatMessages])

  async function handleGenerateInsights() {
    if (!user) return
    setGenerating(true)
    try {
      const newInsights = await generateInsights(user.id)
      if (newInsights.length > 0) {
        setInsights(newInsights)
        toast.success('AI insights refreshed with Groq Llama 3.3!')
      } else {
        toast('Upload lab reports to get personalized AI insights', { icon: 'ℹ️' })
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : ''
      if (msg.includes('VITE_GROQ_API_KEY')) {
        toast.error('Add VITE_GROQ_API_KEY to .env (free at console.groq.com)')
      } else {
        toast.error('Upload health data first, then refresh insights')
      }
    } finally {
      setGenerating(false)
    }
  }

  async function handleChat() {
    if (!chatInput.trim() || chatLoading) return
    const userMsg = chatInput.trim()
    const newHistory = [...chatMessages, { role: 'user' as const, content: userMsg }]
    setChatMessages(newHistory)
    setChatInput('')
    setChatLoading(true)

    try {
      const insightContext = insights
        .map(i => `${i.severity.toUpperCase()}: ${i.title} — ${i.description}`)
        .join('\n')

      // Chat history for Groq (last 8 turns)
      const history = chatMessages.slice(-8).map(m => ({
        role: m.role as 'user' | 'assistant',
        content: m.content,
      }))

      const reply = await chatWithHealthAI(userMsg, history, insightContext)
      setChatMessages(prev => [...prev, { role: 'assistant', content: reply }])
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : ''
      setChatMessages(prev => [...prev, {
        role: 'assistant',
        content: msg.includes('VITE_GROQ_API_KEY')
          ? 'Please add VITE_GROQ_API_KEY to your .env file. Get a free key at console.groq.com'
          : 'I couldn\'t connect right now. Please try again in a moment.',
      }])
    } finally {
      setChatLoading(false)
    }
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
          <h1 className="text-xl font-medium text-gray-900">AI health insights</h1>
          <span className="flex items-center gap-1 text-[10px] bg-green-50 text-green-700 border border-green-100 px-2 py-0.5 rounded-full">
            <Zap size={9} /> Groq Llama 3.3 · Free
          </span>
        </div>
        <button
          onClick={handleGenerateInsights}
          disabled={generating}
          className="btn-secondary flex items-center gap-2"
        >
          <RefreshCw size={14} className={generating ? 'animate-spin' : ''} />
          {generating ? 'Analyzing with Groq...' : 'Refresh insights'}
        </button>
      </div>

      <div className="grid grid-cols-3 gap-6">
        {/* Insights list */}
        <div className="col-span-2 space-y-4">
          <div className="flex gap-2 flex-wrap">
            {(['all', 'critical', 'warning', 'info', 'good'] as const).map(f => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={`text-xs px-3 py-1.5 rounded-lg border transition-colors ${
                  filter === f
                    ? 'bg-gray-900 text-white border-gray-900'
                    : 'border-gray-200 text-gray-500 hover:border-gray-300'
                }`}
              >
                {f.charAt(0).toUpperCase() + f.slice(1)}
                <span className="ml-1.5 opacity-60">({counts[f]})</span>
              </button>
            ))}
          </div>

          <div className="space-y-3">
            {filtered.map(insight => (
              <InsightCard key={insight.id} insight={insight} />
            ))}
          </div>
        </div>

        {/* AI Chat — Groq powered */}
        <div className="card flex flex-col h-[600px]">
          <div className="flex items-center gap-2 mb-4 pb-3 border-b border-gray-100">
            <div className="w-7 h-7 rounded-full bg-teal-100 flex items-center justify-center">
              <Brain size={13} className="text-teal-600" />
            </div>
            <div>
              <p className="text-xs font-medium text-gray-900">VitalOS AI</p>
              <p className="text-[10px] text-teal-500 flex items-center gap-1">
                <Zap size={8} /> Groq · Llama 3.3 · Free
              </p>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto space-y-3 mb-3">
            {chatMessages.map((msg, i) => (
              <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div className={`max-w-[85%] rounded-xl px-3 py-2 text-xs leading-relaxed ${
                  msg.role === 'user'
                    ? 'bg-teal-500 text-white'
                    : 'bg-gray-100 text-gray-700'
                }`}>
                  {msg.content}
                </div>
              </div>
            ))}
            {chatLoading && (
              <div className="flex justify-start">
                <div className="bg-gray-100 rounded-xl px-3 py-2">
                  <div className="flex gap-1">
                    {[0, 150, 300].map(delay => (
                      <div key={delay} className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: `${delay}ms` }} />
                    ))}
                  </div>
                </div>
              </div>
            )}
            <div ref={chatEndRef} />
          </div>

          <div className="flex gap-2">
            <input
              type="text"
              value={chatInput}
              onChange={e => setChatInput(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleChat()}
              placeholder="Ask about your health..."
              className="input text-xs"
            />
            <button
              onClick={handleChat}
              disabled={chatLoading || !chatInput.trim()}
              className="btn-primary px-3"
            >
              <Send size={13} />
            </button>
          </div>

          <div className="mt-2 flex flex-wrap gap-1">
            {['What foods to avoid?', 'Exercise plan?', 'Book a doctor?'].map(q => (
              <button
                key={q}
                onClick={() => setChatInput(q)}
                className="text-[10px] text-blue-500 border border-blue-100 rounded px-2 py-0.5 hover:bg-blue-50"
              >
                {q}
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
