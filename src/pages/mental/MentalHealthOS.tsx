import { useState, useEffect } from 'react'
import { useAuthStore } from '@/store/authStore'
import { supabase } from '@/lib/supabase'
import { Brain, Smile, Frown, Meh, Sun, Moon, Wind, AlertTriangle, TrendingDown, Check, BookOpen, Zap } from 'lucide-react'
import toast from 'react-hot-toast'

interface MoodEntry {
  id: string
  mood: number // 1-10
  energy: number // 1-10
  stress: number // 1-10
  sleep_quality: number // 1-10
  journal: string
  tags: string[]
  date: string
}

interface MentalAnalysis {
  burnoutRisk: 'low' | 'moderate' | 'high'
  burnoutScore: number
  avgMood: number
  avgStress: number
  avgEnergy: number
  trend: 'improving' | 'stable' | 'declining'
  insights: string[]
  recommendations: string[]
}

const MOOD_EMOJIS = ['😭','😢','😞','😕','😐','🙂','😊','😄','🥳','🤩']
const MOOD_LABELS = ['Terrible','Very bad','Bad','Low','Okay','Good','Great','Excellent','Amazing','Perfect']
const STRESS_COLORS = ['#10b981','#10b981','#10b981','#f59e0b','#f59e0b','#f97316','#ef4444','#dc2626','#b91c1c','#7f1d1d']

const QUICK_TAGS = ['anxious','tired','focused','motivated','overwhelmed','calm','sad','happy','stressed','energetic','burnt out','grateful']

function analyzeMental(entries: MoodEntry[]): MentalAnalysis {
  if (!entries.length) return { burnoutRisk:'low', burnoutScore:0, avgMood:0, avgStress:0, avgEnergy:0, trend:'stable', insights:[], recommendations:[] }
  const avg = (arr: number[]) => arr.reduce((a,b)=>a+b,0)/arr.length
  const avgMood   = +avg(entries.map(e=>e.mood)).toFixed(1)
  const avgStress = +avg(entries.map(e=>e.stress)).toFixed(1)
  const avgEnergy = +avg(entries.map(e=>e.energy)).toFixed(1)
  const avgSleep  = +avg(entries.map(e=>e.sleep_quality)).toFixed(1)

  // Burnout score: high stress + low energy + low mood = burnout
  const burnoutScore = Math.round(((avgStress/10)*40) + ((1-avgEnergy/10)*35) + ((1-avgMood/10)*25))
  const burnoutRisk: MentalAnalysis['burnoutRisk'] = burnoutScore > 65 ? 'high' : burnoutScore > 40 ? 'moderate' : 'low'

  // Trend: compare first half vs second half
  const half = Math.floor(entries.length/2)
  const firstHalf = entries.slice(half)
  const secondHalf = entries.slice(0, half)
  const moodTrend = secondHalf.length ? avg(secondHalf.map(e=>e.mood)) - avg(firstHalf.map(e=>e.mood)) : 0
  const trend: MentalAnalysis['trend'] = Math.abs(moodTrend) < 0.5 ? 'stable' : moodTrend > 0 ? 'improving' : 'declining'

  const insights: string[] = []
  const recommendations: string[] = []

  if (avgStress > 7) { insights.push(`High stress averaging ${avgStress}/10 — chronic stress accelerates aging by 1.5-2 years`); recommendations.push('5-minute box breathing: inhale 4s, hold 4s, exhale 4s, hold 4s — reduces cortisol by 20%') }
  if (avgEnergy < 4) { insights.push('Low energy levels detected — may indicate burnout, poor sleep, or nutritional deficiency'); recommendations.push('Check iron, B12, Vitamin D — all common causes of chronic fatigue in Indians') }
  if (avgMood < 5) { insights.push('Mood trending below baseline — early indicator of depression risk'); recommendations.push('Daily 15-min outdoor walk increases serotonin naturally — as effective as mild antidepressants for mild cases') }
  if (avgSleep < 5) { insights.push('Poor sleep quality correlating with mood dips — sleep is the #1 mental health lever'); recommendations.push('Fix sleep first: same wake time daily, no screens 1hr before bed, room temp 18-20°C') }
  if (burnoutRisk === 'high') { insights.push('Burnout pattern detected — stress is high, energy is depleted, mood is low'); recommendations.push('Take 1 full rest day this week — no work, no obligations. Burnout recovery requires deliberate rest.') }
  if (trend === 'improving') insights.push('Mental wellbeing trending upward — your habits are working')
  if (entries.filter(e=>e.tags.includes('anxious')).length > entries.length*0.4) {
    insights.push('Anxiety appearing in 40%+ of your logs — consider speaking with a professional')
    recommendations.push('Journaling reduces anxiety by 30-40% — continue daily mood logging')
  }

  return { burnoutRisk, burnoutScore, avgMood, avgStress, avgEnergy, trend, insights, recommendations }
}

const BURNOUT_CONFIG = {
  low:      { color:'#10b981', bg:'bg-emerald-50', border:'border-emerald-100', label:'Low risk',        emoji:'😊' },
  moderate: { color:'#f59e0b', bg:'bg-amber-50',   border:'border-amber-100',   label:'Moderate risk',  emoji:'⚠️' },
  high:     { color:'#ef4444', bg:'bg-red-50',     border:'border-red-100',     label:'High risk',      emoji:'🚨' },
}

export default function MentalHealthOS() {
  const { user } = useAuthStore()
  const [entries, setEntries] = useState<MoodEntry[]>([])
  const [analysis, setAnalysis] = useState<MentalAnalysis | null>(null)
  const [tab, setTab] = useState<'log'|'analysis'|'journal'>('log')
  const [loading, setLoading] = useState(false)
  const [form, setForm] = useState({ mood:5, energy:5, stress:5, sleep_quality:6, journal:'', tags:[] as string[] })
  const [saving, setSaving] = useState(false)
  const [aiInsight, setAiInsight] = useState('')
  const [generatingAI, setGeneratingAI] = useState(false)

  useEffect(() => { if (user) load() }, [user])

  async function load() {
    if (!user) return
    setLoading(true)
    const { data } = await supabase.from('health_records')
      .select('id, value, recorded_at, metadata')
      .eq('user_id', user.id).eq('test_name', 'Mood Log')
      .order('recorded_at', { ascending: false }).limit(30)
    const mapped = (data||[]).map((r: {id:string;value:number;recorded_at:string;metadata:Record<string,unknown>|null}) => ({
      id: r.id, mood: r.value,
      energy: (r.metadata?.energy as number)||5,
      stress: (r.metadata?.stress as number)||5,
      sleep_quality: (r.metadata?.sleep_quality as number)||5,
      journal: (r.metadata?.journal as string)||'',
      tags: (r.metadata?.tags as string[])||[],
      date: r.recorded_at.split('T')[0],
    }))
    setEntries(mapped)
    setAnalysis(analyzeMental(mapped))
    setLoading(false)
  }

  async function saveLog() {
    if (!user) return
    setSaving(true)
    try {
      await supabase.from('health_records').insert({
        user_id: user.id, record_type: 'mental', test_name: 'Mood Log',
        value: form.mood, unit: '/10', source: 'manual',
        recorded_at: new Date().toISOString(),
        metadata: { energy: form.energy, stress: form.stress, sleep_quality: form.sleep_quality, journal: form.journal, tags: form.tags }
      })
      toast.success('Mood logged!')
      setForm({ mood:5, energy:5, stress:5, sleep_quality:6, journal:'', tags:[] })
      load(); setTab('analysis')
    } finally { setSaving(false) }
  }

  async function generateAIInsight() {
    const key = import.meta.env.VITE_GROQ_API_KEY
    if (!key) { toast.error('Add VITE_GROQ_API_KEY'); return }
    setGeneratingAI(true)
    try {
      const recentStr = entries.slice(0,7).map(e =>
        `${e.date}: Mood ${e.mood}/10, Stress ${e.stress}/10, Energy ${e.energy}/10${e.journal?`, Journal: "${e.journal.slice(0,100)}"`:''}`
      ).join('\n')
      const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method:'POST',
        headers:{'Content-Type':'application/json', Authorization:`Bearer ${key}`},
        body: JSON.stringify({
          model:'llama-3.3-70b-versatile',
          messages:[{ role:'user', content:`You are a mental health AI coach for VitalOS. Analyze this week's mood data for an Indian user and give compassionate, specific, actionable advice in 3-4 sentences. Focus on patterns, not just scores. Be warm and human.\n\nData:\n${recentStr}` }],
          max_tokens:200, temperature:0.7
        })
      })
      const data = await res.json() as {choices:Array<{message:{content:string}}>}
      setAiInsight(data.choices[0].message.content)
    } catch { toast.error('AI insight failed') }
    finally { setGeneratingAI(false) }
  }

  function toggleTag(tag: string) {
    setForm(p => ({ ...p, tags: p.tags.includes(tag) ? p.tags.filter(t=>t!==tag) : [...p.tags, tag] }))
  }

  const cfg = analysis ? BURNOUT_CONFIG[analysis.burnoutRisk] : null

  return (
    <div className="p-4 pb-8 max-w-2xl mx-auto space-y-4">
      <div className="card !p-5" style={{ background:'linear-gradient(135deg,#1e1b4b,#312e81)', borderColor:'#4338ca' }}>
        <div className="flex items-start gap-3">
          <div className="w-12 h-12 rounded-xl flex items-center justify-center shrink-0" style={{ background:'rgba(99,102,241,0.2)' }}>
            <Brain size={24} className="text-indigo-400"/>
          </div>
          <div>
            <div className="flex items-center gap-2 mb-1">
              <h1 className="text-lg font-bold text-white">Mental Health OS</h1>
              <span className="text-[10px] bg-indigo-900 text-indigo-300 border border-indigo-700 px-2 py-0.5 rounded-full font-bold">Daily tracking</span>
            </div>
            <p className="text-sm text-indigo-300">Mood tracking · Burnout detection · Anxiety signals · Sleep-emotion correlation · AI insights</p>
          </div>
        </div>
        {analysis && (
          <div className="mt-4 grid grid-cols-4 gap-2">
            {[
              { l:'Mood', v:`${analysis.avgMood}/10`, c:'#6366f1' },
              { l:'Stress', v:`${analysis.avgStress}/10`, c:'#ef4444' },
              { l:'Energy', v:`${analysis.avgEnergy}/10`, c:'#f59e0b' },
              { l:'Burnout', v:analysis.burnoutRisk, c:BURNOUT_CONFIG[analysis.burnoutRisk].color },
            ].map(s=>(
              <div key={s.l} className="rounded-lg p-2 text-center" style={{ background:`${s.c}20`, border:`1px solid ${s.c}30` }}>
                <div className="text-sm font-black capitalize" style={{ color:s.c }}>{s.v}</div>
                <div className="text-[9px] text-gray-400">{s.l}</div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="flex gap-1 bg-gray-100 rounded-xl p-1">
        {(['log','analysis','journal'] as const).map(t=>(
          <button key={t} onClick={()=>setTab(t)}
            className={`flex-1 text-xs py-2 rounded-lg font-semibold capitalize transition-all ${tab===t?'bg-white shadow-sm text-gray-900':'text-gray-500'}`}>
            {t==='log'?'😊 Log mood':t==='analysis'?'📊 Analysis':'📓 Journal'}
          </button>
        ))}
      </div>

      {tab==='log' && (
        <div className="card !p-5 space-y-5">
          <p className="text-sm font-bold text-gray-800">How are you feeling today?</p>
          {/* Mood picker */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-xs font-medium text-gray-600">😊 Overall mood</label>
              <span className="text-sm font-black text-indigo-600">{MOOD_EMOJIS[form.mood-1]} {MOOD_LABELS[form.mood-1]}</span>
            </div>
            <input type="range" min="1" max="10" value={form.mood} onChange={e=>setForm(p=>({...p,mood:+e.target.value}))}
              className="w-full h-2 rounded-full appearance-none cursor-pointer"
              style={{background:`linear-gradient(90deg,#6366f1 ${(form.mood-1)/9*100}%,#e5e7eb ${(form.mood-1)/9*100}%)`}}/>
          </div>
          {[
            { key:'energy', label:'⚡ Energy level', color:'#f59e0b' },
            { key:'stress', label:'😤 Stress level', color:'#ef4444', inverse:true },
            { key:'sleep_quality', label:'😴 Sleep quality', color:'#8b5cf6' },
          ].map(f=>{
            const val = (form as Record<string,unknown>)[f.key] as number
            const pct = (val-1)/9*100
            return (
              <div key={f.key}>
                <div className="flex justify-between mb-1">
                  <label className="text-xs font-medium text-gray-600">{f.label}</label>
                  <span className="text-sm font-bold" style={{color:f.color}}>{val}/10</span>
                </div>
                <input type="range" min="1" max="10" value={val}
                  onChange={e=>setForm(p=>({...p,[f.key]:+e.target.value}))}
                  className="w-full h-2 rounded-full appearance-none cursor-pointer"
                  style={{background:f.inverse
                    ?`linear-gradient(90deg,${f.color} ${pct}%,#e5e7eb ${pct}%)`
                    :`linear-gradient(90deg,${f.color} ${pct}%,#e5e7eb ${pct}%)`}}/>
              </div>
            )
          })}
          {/* Tags */}
          <div>
            <label className="text-xs font-medium text-gray-600 mb-2 block">How do you feel? (select all that apply)</label>
            <div className="flex flex-wrap gap-1.5">
              {QUICK_TAGS.map(tag=>(
                <button key={tag} onClick={()=>toggleTag(tag)}
                  className={`text-xs px-2.5 py-1 rounded-full border capitalize transition-colors ${form.tags.includes(tag)?'bg-indigo-600 text-white border-indigo-600':'border-gray-200 text-gray-500'}`}>
                  {tag}
                </button>
              ))}
            </div>
          </div>
          {/* Journal */}
          <div>
            <label className="text-xs font-medium text-gray-600 mb-1 block">📓 Quick journal (optional)</label>
            <textarea className="input text-sm h-20 resize-none" placeholder="What's on your mind today? Any thoughts, events, or feelings..." value={form.journal} onChange={e=>setForm(p=>({...p,journal:e.target.value}))}/>
          </div>
          <button onClick={saveLog} disabled={saving} className="btn-primary w-full py-3 flex items-center justify-center gap-2">
            <Check size={15}/>{saving?'Saving...':'Log today\'s mood'}
          </button>
        </div>
      )}

      {tab==='analysis' && analysis && cfg && (
        <>
          {/* Burnout card */}
          <div className={`card !p-5 border ${cfg.bg} ${cfg.border}`}>
            <div className="flex items-center gap-4 mb-4">
              <div className="text-center">
                <div className="text-5xl font-black" style={{color:cfg.color}}>{analysis.burnoutScore}</div>
                <div className="text-xs text-gray-400">/100 burnout score</div>
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-xl">{cfg.emoji}</span>
                  <span className="text-lg font-black text-gray-900">{cfg.label}</span>
                </div>
                <p className="text-xs text-gray-500 mb-1">Trend: <span className={`font-bold ${analysis.trend==='improving'?'text-emerald-600':analysis.trend==='declining'?'text-red-500':'text-gray-600'}`}>
                  {analysis.trend==='improving'?'↑ Improving':analysis.trend==='declining'?'↓ Declining':'→ Stable'}
                </span></p>
                <p className="text-xs text-gray-400">{entries.length} days tracked</p>
              </div>
            </div>
            <div className="space-y-2">
              {analysis.insights.map((ins,i)=><div key={i} className="flex gap-2 text-xs text-gray-700 bg-white/60 rounded-lg p-2.5"><AlertTriangle size={12} className="shrink-0 mt-0.5" style={{color:cfg.color}}/>{ins}</div>)}
            </div>
            <div className="mt-3 space-y-1.5">
              {analysis.recommendations.map((r,i)=><div key={i} className="flex gap-2 text-xs text-gray-700 bg-white/60 rounded-lg p-2.5"><Check size={12} className="text-teal-500 shrink-0 mt-0.5"/>{r}</div>)}
            </div>
          </div>

          {/* Mood chart */}
          {entries.length > 1 && (
            <div className="card !p-4">
              <p className="text-xs font-bold text-gray-500 mb-3">Mood trend (last {Math.min(entries.length,14)} days)</p>
              <div className="flex items-end gap-1 h-16">
                {entries.slice(0,14).reverse().map((e,i)=>(
                  <div key={i} className="flex-1 flex flex-col items-center gap-0.5">
                    <div className="w-full rounded-t" style={{height:`${(e.mood/10)*56}px`, background:STRESS_COLORS[e.mood-1], minHeight:4}}/>
                    <span className="text-[7px] text-gray-400">{e.date.slice(5)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* AI insight */}
          <div className="card !p-4">
            <div className="flex items-center justify-between mb-2">
              <p className="text-sm font-bold text-gray-800 flex items-center gap-2"><Brain size={14} className="text-indigo-500"/>AI mental health insight</p>
              <button onClick={generateAIInsight} disabled={generatingAI||entries.length===0}
                className="text-xs text-indigo-600 border border-indigo-200 px-3 py-1.5 rounded-lg hover:bg-indigo-50 disabled:opacity-40">
                {generatingAI?'Generating...':'Generate'}
              </button>
            </div>
            {aiInsight ? <p className="text-sm text-gray-600 leading-relaxed">{aiInsight}</p> : <p className="text-xs text-gray-400">Log at least 3 days of mood data, then generate your personalized AI insight.</p>}
          </div>
        </>
      )}

      {tab==='journal' && (
        <div className="space-y-3">
          {entries.filter(e=>e.journal).length===0 ? (
            <div className="card border-dashed border-2 text-center py-10">
              <BookOpen size={32} className="text-gray-200 mx-auto mb-3"/>
              <p className="text-sm font-semibold text-gray-600 mb-1">No journal entries yet</p>
              <p className="text-xs text-gray-400 mb-4">Add a note when logging your mood</p>
              <button onClick={()=>setTab('log')} className="btn-primary text-xs py-2">Log today's mood</button>
            </div>
          ) : entries.filter(e=>e.journal).map(e=>(
            <div key={e.id} className="card !p-4">
              <div className="flex items-center gap-2 mb-2">
                <span className="text-xl">{MOOD_EMOJIS[e.mood-1]}</span>
                <div>
                  <p className="text-xs font-bold text-gray-900">{new Date(e.date+'T00:00:00').toLocaleDateString('en-IN',{weekday:'long',day:'numeric',month:'long'})}</p>
                  <div className="flex gap-2 text-[10px] text-gray-400">
                    <span>Mood: {e.mood}/10</span><span>Stress: {e.stress}/10</span><span>Energy: {e.energy}/10</span>
                  </div>
                </div>
              </div>
              <p className="text-sm text-gray-600 leading-relaxed italic">"{e.journal}"</p>
              {e.tags.length>0 && (
                <div className="flex gap-1 mt-2 flex-wrap">
                  {e.tags.map(t=><span key={t} className="text-[9px] bg-indigo-50 text-indigo-600 px-2 py-0.5 rounded-full">{t}</span>)}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
