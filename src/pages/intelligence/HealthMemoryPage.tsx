import { useState, useEffect } from 'react'
import { useAuthStore } from '@/store/authStore'
import { supabase } from '@/lib/supabase'
import { Brain, Plus, Tag, Clock, TrendingUp, Stethoscope, Pill, AlertCircle, X, Check } from 'lucide-react'
import toast from 'react-hot-toast'

interface MemoryEntry {
  id: string
  type: 'illness'|'medication'|'surgery'|'insight'|'doctor_feedback'|'milestone'|'allergy'
  title: string
  description: string
  date: string
  tags: string[]
  source: 'manual'|'ai'|'doctor'
  created_at: string
}

const TYPE_CONFIG = {
  illness:        { icon:AlertCircle, color:'#ef4444', bg:'bg-red-50',    border:'border-red-100',    label:'Illness'        },
  medication:     { icon:Pill,        color:'#8b5cf6', bg:'bg-purple-50', border:'border-purple-100', label:'Medication'     },
  surgery:        { icon:Stethoscope, color:'#f59e0b', bg:'bg-amber-50',  border:'border-amber-100',  label:'Surgery'        },
  insight:        { icon:Brain,       color:'#3b82f6', bg:'bg-blue-50',   border:'border-blue-100',   label:'AI Insight'     },
  doctor_feedback:{ icon:Stethoscope, color:'#0f6e56', bg:'bg-teal-50',  border:'border-teal-100',   label:'Doctor Feedback'},
  milestone:      { icon:TrendingUp,  color:'#10b981', bg:'bg-green-50',  border:'border-green-100',  label:'Milestone'      },
  allergy:        { icon:AlertCircle, color:'#f97316', bg:'bg-orange-50', border:'border-orange-100', label:'Allergy'        },
}

export default function HealthMemoryPage() {
  const { user } = useAuthStore()
  const [memories, setMemories] = useState<MemoryEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [showAdd, setShowAdd] = useState(false)
  const [filter, setFilter] = useState<'all'|MemoryEntry['type']>('all')
  const [search, setSearch] = useState('')
  const [form, setForm] = useState({ type:'illness' as MemoryEntry['type'], title:'', description:'', date:new Date().toISOString().split('T')[0], tags:'' })
  const [saving, setSaving] = useState(false)
  const [aiSummary, setAiSummary] = useState<string|null>(null)
  const [summarizing, setSummarizing] = useState(false)

  useEffect(()=>{ if(user) load() },[user])

  async function load() {
    if(!user) return
    setLoading(true)
    const {data}=await supabase.from('health_records')
      .select('id,test_name,value,unit,recorded_at,metadata,source')
      .eq('user_id',user.id).eq('record_type','memory')
      .order('recorded_at',{ascending:false})
    const mapped = (data||[]).map((r:{id:string;test_name:string;recorded_at:string;metadata:{type?:string;title?:string;description?:string;tags?:string[];source?:string}|null;source:string})=>({
      id:r.id,
      type:((r.metadata as {type?:string}|null)?.type||'insight') as MemoryEntry['type'],
      title:(r.metadata as {title?:string}|null)?.title||r.test_name,
      description:(r.metadata as {description?:string}|null)?.description||'',
      date:r.recorded_at.split('T')[0],
      tags:(r.metadata as {tags?:string[]}|null)?.tags||[],
      source:((r.metadata as {source?:string}|null)?.source||'manual') as MemoryEntry['source'],
      created_at:r.recorded_at,
    }))
    setMemories(mapped)
    setLoading(false)
  }

  async function save() {
    if(!user||!form.title) { toast.error('Title is required'); return }
    setSaving(true)
    try {
      await supabase.from('health_records').insert({
        user_id:user.id, record_type:'memory',
        test_name:form.title, value:0, unit:'',
        source:'manual', recorded_at:new Date(form.date).toISOString(),
        metadata:{ type:form.type, title:form.title, description:form.description, tags:form.tags.split(',').map(t=>t.trim()).filter(Boolean), source:'manual' },
      })
      toast.success('Memory saved!')
      setShowAdd(false)
      setForm({ type:'illness', title:'', description:'', date:new Date().toISOString().split('T')[0], tags:'' })
      load()
    } finally { setSaving(false) }
  }

  async function generateAISummary() {
    const key = import.meta.env.VITE_GROQ_API_KEY
    if(!key||key.includes('your-groq')) { toast.error('Add VITE_GROQ_API_KEY'); return }
    setSummarizing(true)
    try {
      const memStr = memories.slice(0,20).map(m=>`[${m.type.toUpperCase()}] ${m.date}: ${m.title} — ${m.description}`).join('\n')
      const res = await fetch('https://api.groq.com/openai/v1/chat/completions',{
        method:'POST',
        headers:{'Content-Type':'application/json',Authorization:`Bearer ${key}`},
        body:JSON.stringify({
          model:'llama-3.3-70b-versatile',
          messages:[{
            role:'user',
            content:`You are a health AI reviewing a patient's complete health history. Summarize the key patterns, risks, and health journey in 3-4 paragraphs. Be specific, mention dates and conditions. End with 2-3 personalized recommendations based on the history.\n\nHealth memory:\n${memStr||'No memories recorded yet'}`
          }],
          max_tokens:600, temperature:0.5,
        })
      })
      const data = await res.json() as {choices:Array<{message:{content:string}}>}
      setAiSummary(data.choices[0].message.content)
    } catch { toast.error('Summary failed') }
    finally { setSummarizing(false) }
  }

  async function deleteMemory(id: string) {
    if(!confirm('Delete this memory?')) return
    await supabase.from('health_records').delete().eq('id',id)
    setMemories(prev=>prev.filter(m=>m.id!==id))
    toast.success('Deleted')
  }

  const filtered = memories.filter(m=>{
    const matchType = filter==='all'||m.type===filter
    const matchSearch = !search||m.title.toLowerCase().includes(search.toLowerCase())||m.description.toLowerCase().includes(search.toLowerCase())||m.tags.some(t=>t.toLowerCase().includes(search.toLowerCase()))
    return matchType&&matchSearch
  })

  // Group by year
  const byYear = filtered.reduce((acc,m)=>{
    const yr = m.date.split('-')[0]
    if(!acc[yr]) acc[yr]=[]
    acc[yr].push(m)
    return acc
  },{} as Record<string,MemoryEntry[]>)

  return (
    <div className="p-4 pb-8 max-w-2xl mx-auto space-y-4">
      <div className="card !p-5" style={{background:'linear-gradient(135deg,#0f172a,#1e293b)',borderColor:'#334155'}}>
        <div className="flex items-start justify-between">
          <div className="flex items-start gap-3">
            <div className="w-12 h-12 rounded-xl flex items-center justify-center shrink-0" style={{background:'rgba(99,102,241,0.2)'}}>
              <Brain size={24} className="text-indigo-400"/>
            </div>
            <div>
              <div className="flex items-center gap-2 mb-1">
                <h1 className="text-lg font-bold text-white">Health Memory Engine</h1>
                <span className="text-[10px] bg-slate-800 text-slate-300 border border-slate-700 px-2 py-0.5 rounded-full font-bold">Context-aware forever</span>
              </div>
              <p className="text-sm text-slate-300">VitalOS remembers everything — illnesses, medications, surgeries, doctor feedback, AI insights. Your AI becomes your personal health historian.</p>
            </div>
          </div>
        </div>
        <div className="mt-3 flex gap-2 flex-wrap">
          {Object.entries(TYPE_CONFIG).map(([type,cfg])=>(
            <span key={type} className="text-[10px] px-2 py-1 rounded-lg font-semibold text-white" style={{background:`${cfg.color}40`,border:`1px solid ${cfg.color}30`}}>
              {cfg.label}
            </span>
          ))}
        </div>
      </div>

      {/* AI Summary */}
      <div className="card !p-4">
        <div className="flex items-center justify-between mb-2">
          <p className="text-sm font-bold text-gray-800 flex items-center gap-2"><Brain size={14} className="text-purple-500"/>AI health summary</p>
          <button onClick={generateAISummary} disabled={summarizing||memories.length===0}
            className="text-xs text-purple-600 border border-purple-200 px-3 py-1.5 rounded-lg hover:bg-purple-50 disabled:opacity-40">
            {summarizing?'Summarizing...':'Generate'}
          </button>
        </div>
        {aiSummary ? (
          <p className="text-xs text-gray-600 leading-relaxed whitespace-pre-line">{aiSummary}</p>
        ) : (
          <p className="text-xs text-gray-400">Add memories, then click Generate to get an AI summary of your entire health journey.</p>
        )}
      </div>

      {/* Controls */}
      <div className="flex gap-2">
        <input className="input text-sm flex-1" placeholder="Search memories..." value={search} onChange={e=>setSearch(e.target.value)}/>
        <button onClick={()=>setShowAdd(true)} className="btn-primary text-xs px-4 py-2 flex items-center gap-1.5 shrink-0">
          <Plus size={14}/>Add memory
        </button>
      </div>

      {/* Type filters */}
      <div className="flex gap-1.5 flex-wrap">
        <button onClick={()=>setFilter('all')}
          className={`text-xs px-2.5 py-1 rounded-lg border capitalize ${filter==='all'?'bg-gray-900 text-white border-gray-900':'border-gray-200 text-gray-500'}`}>
          All ({memories.length})
        </button>
        {(Object.keys(TYPE_CONFIG) as MemoryEntry['type'][]).map(t=>{
          const count=memories.filter(m=>m.type===t).length
          if(!count) return null
          const cfg=TYPE_CONFIG[t]
          return (
            <button key={t} onClick={()=>setFilter(t)}
              className={`text-xs px-2.5 py-1 rounded-lg border capitalize transition-colors ${filter===t?'text-white border-transparent':'border-gray-200 text-gray-500'}`}
              style={filter===t?{background:cfg.color}:{}}>
              {cfg.label} ({count})
            </button>
          )
        })}
      </div>

      {/* Add form */}
      {showAdd && (
        <div className="card !p-4 border-teal-200" style={{background:'linear-gradient(135deg,#f0fdf8,#ecfdf5)'}}>
          <div className="flex items-center justify-between mb-3">
            <p className="text-sm font-bold text-gray-800">Add health memory</p>
            <button onClick={()=>setShowAdd(false)}><X size={15} className="text-gray-400"/></button>
          </div>
          <div className="space-y-2.5">
            <div>
              <label className="text-xs text-gray-500 mb-1 block">Type</label>
              <div className="flex flex-wrap gap-1.5">
                {(Object.entries(TYPE_CONFIG) as Array<[MemoryEntry['type'],typeof TYPE_CONFIG[keyof typeof TYPE_CONFIG]]>).map(([t,cfg])=>(
                  <button key={t} onClick={()=>setForm(p=>({...p,type:t}))}
                    className={`text-[11px] px-2.5 py-1 rounded-lg border font-semibold transition-colors ${form.type===t?'text-white border-transparent':'border-gray-200 text-gray-500'}`}
                    style={form.type===t?{background:cfg.color}:{}}>
                    {cfg.label}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label className="text-xs text-gray-500 mb-1 block">Title *</label>
              <input className="input text-sm" placeholder="e.g. Diagnosed with hypertension"
                value={form.title} onChange={e=>setForm(p=>({...p,title:e.target.value}))}/>
            </div>
            <div>
              <label className="text-xs text-gray-500 mb-1 block">Description</label>
              <textarea className="input text-sm h-16 resize-none" placeholder="Details, doctor name, hospital, outcome..."
                value={form.description} onChange={e=>setForm(p=>({...p,description:e.target.value}))}/>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-xs text-gray-500 mb-1 block">Date</label>
                <input type="date" className="input text-sm" value={form.date} onChange={e=>setForm(p=>({...p,date:e.target.value}))}/>
              </div>
              <div>
                <label className="text-xs text-gray-500 mb-1 block">Tags (comma separated)</label>
                <input className="input text-sm" placeholder="kidney, apollo, chronic"
                  value={form.tags} onChange={e=>setForm(p=>({...p,tags:e.target.value}))}/>
              </div>
            </div>
            <button onClick={save} disabled={saving} className="btn-primary w-full text-xs py-2.5 flex items-center justify-center gap-2">
              <Check size={13}/>{saving?'Saving...':'Save memory'}
            </button>
          </div>
        </div>
      )}

      {/* Timeline by year */}
      {loading ? (
        <div className="space-y-3">{[1,2,3].map(i=><div key={i} className="card h-16 animate-pulse bg-gray-50"/>)}</div>
      ) : Object.keys(byYear).length===0 ? (
        <div className="card border-dashed border-2 text-center py-12">
          <Brain size={32} className="text-gray-200 mx-auto mb-3"/>
          <p className="text-sm font-semibold text-gray-600">No health memories yet</p>
          <p className="text-xs text-gray-400 mt-1 mb-4">Add your health history — past illnesses, medications, doctor feedback</p>
          <button onClick={()=>setShowAdd(true)} className="btn-primary text-xs py-2">Add first memory</button>
        </div>
      ) : (
        Object.entries(byYear).sort((a,b)=>parseInt(b[0])-parseInt(a[0])).map(([year,mems])=>(
          <div key={year}>
            <div className="flex items-center gap-2 mb-2">
              <span className="text-xs font-black text-gray-400">{year}</span>
              <div className="flex-1 h-px bg-gray-100"/>
              <span className="text-[10px] text-gray-400">{mems.length} events</span>
            </div>
            <div className="space-y-2">
              {mems.map(m=>{
                const cfg=TYPE_CONFIG[m.type]||TYPE_CONFIG.insight
                const Icon=cfg.icon
                return (
                  <div key={m.id} className={`card !p-3.5 border ${cfg.bg} ${cfg.border}`}>
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-start gap-2.5 flex-1 min-w-0">
                        <Icon size={15} className="mt-0.5 shrink-0" style={{color:cfg.color}}/>
                        <div className="min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <p className="text-sm font-bold text-gray-900">{m.title}</p>
                            <span className="text-[9px] px-1.5 py-0.5 rounded font-bold text-white shrink-0" style={{background:cfg.color}}>{cfg.label}</span>
                            {m.source==='ai' && <span className="text-[9px] text-purple-600 font-bold">AI</span>}
                          </div>
                          <p className="text-xs text-gray-500 mt-0.5">{new Date(m.date).toLocaleDateString('en-IN',{day:'numeric',month:'long',year:'numeric'})}</p>
                          {m.description && <p className="text-xs text-gray-600 mt-1 leading-relaxed">{m.description}</p>}
                          {m.tags.length>0 && (
                            <div className="flex gap-1 mt-1.5 flex-wrap">
                              {m.tags.map(t=><span key={t} className="text-[9px] bg-white/80 text-gray-500 px-1.5 py-0.5 rounded border border-gray-100 flex items-center gap-0.5"><Tag size={8}/>{t}</span>)}
                            </div>
                          )}
                        </div>
                      </div>
                      <button onClick={()=>deleteMemory(m.id)} className="text-gray-300 hover:text-red-400 shrink-0">
                        <X size={14}/>
                      </button>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        ))
      )}
    </div>
  )
}
