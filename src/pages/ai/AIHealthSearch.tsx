import { useState, useEffect, useRef } from 'react'
import { useAuthStore } from '@/store/authStore'
import { supabase } from '@/lib/supabase'
import { Search, Clock } from 'lucide-react'
import toast from 'react-hot-toast'

interface SearchResult { query:string; answer:string; timestamp:Date }

const EXAMPLES = [
  'Why do I feel tired after lunch?',
  'Why is my HbA1c rising despite exercise?',
  'What causes my afternoon energy crash?',
  'Why do I sleep 8 hours but still feel tired?',
  'What is causing my hair fall?',
  'Why do I feel anxious without reason?',
  'What does my high neutrophil count mean?',
]

export default function AIHealthSearch() {
  const { user } = useAuthStore()
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<SearchResult[]>([])
  const [searching, setSearching] = useState(false)
  const [ctx, setCtx] = useState('')

  useEffect(() => { if (user) loadCtx() }, [user])

  async function loadCtx() {
    if (!user) return
    const { data } = await supabase.from('health_records')
      .select('test_name,value,unit').eq('user_id', user.id)
      .order('recorded_at', { ascending: false }).limit(20)
    const seen = new Map()
    for (const r of (data || [])) { if (!seen.has(r.test_name)) seen.set(r.test_name, r) }
    setCtx(Array.from(seen.values()).map((r: Record<string,unknown>) => `${r.test_name}: ${r.value} ${r.unit}`).join(', '))
  }

  async function search(q?: string) {
    const searchQ = q || query
    if (!searchQ.trim()) return
    const key = import.meta.env.VITE_GROQ_API_KEY
    if (!key) { toast.error('Add VITE_GROQ_API_KEY'); return }
    setSearching(true)
    try {
      const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method:'POST',
        headers:{'Content-Type':'application/json', Authorization:`Bearer ${key}`},
        body: JSON.stringify({
          model:'openai/gpt-oss-120b',
          messages:[{ role:'user', content:`You are VitalOS AI Health Search. Patient health data: ${ctx||'No data yet'}. Question: "${searchQ}". Analyze their actual data and answer specifically. Format: 1) Direct answer 2) What their data shows 3) Likely causes 4) Next steps. Under 200 words. Indian context.` }],
          max_tokens:400, temperature:0.5,
        })
      })
      const data = await res.json() as {choices:Array<{message:{content:string}}>}
      setResults(prev => [{ query:searchQ, answer:data.choices[0].message.content, timestamp:new Date() }, ...prev.slice(0,4)])
      setQuery('')
    } catch { toast.error('Search failed') }
    finally { setSearching(false) }
  }

  return (
    <div className="p-4 pb-8 max-w-2xl mx-auto space-y-4">
      <div className="card !p-5" style={{ background:'linear-gradient(135deg,#020617,#0f172a)', borderColor:'#1e293b' }}>
        <div className="flex items-start gap-3 mb-4">
          <div className="w-12 h-12 rounded-xl flex items-center justify-center shrink-0" style={{ background:'rgba(251,191,36,0.15)' }}>
            <Search size={24} className="text-yellow-400"/>
          </div>
          <div>
            <div className="flex items-center gap-2 mb-1">
              <h1 className="text-lg font-bold text-white">AI Health Search</h1>
              <span className="text-[10px] bg-yellow-900 text-yellow-300 border border-yellow-700 px-2 py-0.5 rounded-full font-bold">Context-aware</span>
            </div>
            <p className="text-sm text-slate-300">"Why do I feel tired after lunch?" — AI analyzes your sleep, glucose, gut health and answers from YOUR data.</p>
          </div>
        </div>
        <div className="flex gap-2">
          <input type="text" className="flex-1 bg-white/10 border border-white/20 rounded-xl px-4 py-3 text-white text-sm placeholder-white/40 outline-none focus:border-yellow-400/50"
            placeholder="Ask anything about your health..." value={query}
            onChange={e=>setQuery(e.target.value)} onKeyDown={e=>e.key==='Enter'&&search()}/>
          <button onClick={()=>search()} disabled={searching||!query.trim()}
            className="px-4 py-3 rounded-xl font-bold text-sm text-black disabled:opacity-40 shrink-0"
            style={{ background:'linear-gradient(135deg,#fbbf24,#f59e0b)' }}>
            {searching?'...':'Search'}
          </button>
        </div>
      </div>

      {results.length===0 && (
        <div className="space-y-2">
          <p className="text-xs font-bold text-gray-500 mb-2">Try asking:</p>
          {EXAMPLES.map(q=>(
            <button key={q} onClick={()=>search(q)}
              className="w-full text-left text-xs bg-white border border-gray-200 text-gray-600 px-4 py-2.5 rounded-xl hover:border-yellow-300 transition-all flex items-center gap-2">
              <Search size={11} className="text-yellow-500 shrink-0"/>{q}
            </button>
          ))}
        </div>
      )}

      <div className="space-y-4">
        {results.map((r,i)=>(
          <div key={i} className="card !p-5">
            <p className="text-sm font-bold text-gray-900 italic mb-3">"{r.query}"</p>
            <p className="text-sm text-gray-700 leading-relaxed whitespace-pre-line">{r.answer}</p>
            <p className="text-[10px] text-gray-400 mt-3 flex items-center gap-1"><Clock size={10}/>{r.timestamp.toLocaleTimeString('en-IN')}</p>
          </div>
        ))}
      </div>
    </div>
  )
}

