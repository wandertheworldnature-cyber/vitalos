import { useState, useEffect } from 'react'
import { useAuthStore } from '@/store/authStore'
import { supabase } from '@/lib/supabase'
import { Moon, TrendingDown, AlertTriangle, Check, RefreshCw } from 'lucide-react'
import toast from 'react-hot-toast'

interface SleepEntry { date:string; hours:number; quality:number; bedtime:string; wakeTime:string }
interface SleepAnalysis {
  avgHours: number; avgQuality: number; sleepDebt: number; consistency: number
  phase: 'restorative'|'sufficient'|'deficit'|'chronic'
  insights: string[]; recommendations: string[]
  weeklyPattern: Array<{day:string; hours:number; quality:number}>
  debtRepayPlan: string
  circadianScore: number
}

const PHASE_CONFIG = {
  restorative: { color:'#10b981', label:'Restorative',      emoji:'🌟', desc:'Excellent sleep — body is fully recovering' },
  sufficient:  { color:'#3b82f6', label:'Sufficient',       emoji:'😊', desc:'Good sleep — minor tweaks can optimize further' },
  deficit:     { color:'#f59e0b', label:'Sleep Deficit',    emoji:'⚠️', desc:'Accumulating sleep debt — address this week' },
  chronic:     { color:'#ef4444', label:'Chronic Deficit',  emoji:'🔴', desc:'Chronic sleep deprivation — health risk increasing' },
}

function analyzeSleep(entries: SleepEntry[]): SleepAnalysis {
  if(!entries.length) return { avgHours:0, avgQuality:0, sleepDebt:0, consistency:0, phase:'sufficient', insights:['Log your sleep to get insights'], recommendations:['Start logging sleep daily'], weeklyPattern:[], debtRepayPlan:'', circadianScore:0 }
  const avg = (arr: number[]) => arr.reduce((a,b)=>a+b,0)/arr.length
  const avgHours = +avg(entries.map(e=>e.hours)).toFixed(1)
  const avgQuality = +avg(entries.map(e=>e.quality)).toFixed(1)
  const sleepDebt = +Math.max(0,(8-avgHours)*entries.length).toFixed(1)
  const hourVariance = entries.map(e=>Math.abs(e.hours-avgHours))
  const consistency = Math.round(Math.max(0,100-avg(hourVariance)*20))
  const phase: SleepAnalysis['phase'] = avgHours>=7.5&&avgQuality>=7?'restorative':avgHours>=6.5?'sufficient':sleepDebt>10?'chronic':'deficit'
  const circadianScore = Math.round(consistency*0.4+(avgQuality/10)*40+(Math.min(avgHours,8)/8)*20)
  const insights: string[] = []
  const recs: string[] = []
  if(avgHours<6) { insights.push(`Averaging only ${avgHours}h — minimum 7h needed for cell repair and memory consolidation`); recs.push('Move bedtime 30 min earlier this week, then another 30 min next week') }
  if(avgQuality<6) { insights.push('Low sleep quality despite hours — likely due to stress, screen time, or poor sleep hygiene'); recs.push('No screens 1 hour before bed — blue light blocks melatonin production') }
  if(sleepDebt>5) { insights.push(`${sleepDebt}h total sleep debt accumulated — impairs cognitive function like being drunk`); recs.push('Recover 1h extra sleep per night for next 5 days to repay debt') }
  if(consistency<60) { insights.push('Inconsistent sleep schedule disrupts circadian rhythm — even on weekends'); recs.push('Fix wake time first — same time daily trains your body clock automatically') }
  if(avgHours>=8&&avgQuality>=8) { insights.push('Excellent sleep architecture — your body is recovering optimally'); recs.push('Maintain current routine — it\'s working perfectly') }
  const debtRepayPlan = sleepDebt>0 ? `Add ${Math.min(1.5, sleepDebt/7).toFixed(1)}h sleep per night for ${Math.ceil(sleepDebt/1.5)} nights to clear debt` : 'No sleep debt — maintain current schedule'
  return { avgHours, avgQuality, sleepDebt, consistency, phase, insights, recommendations:recs, weeklyPattern:entries.slice(-7).map(e=>({day:new Date(e.date).toLocaleDateString('en-IN',{weekday:'short'}),hours:e.hours,quality:e.quality})), debtRepayPlan, circadianScore }
}

export default function SleepIntelligencePage() {
  const { user } = useAuthStore()
  const [entries, setEntries] = useState<SleepEntry[]>([])
  const [analysis, setAnalysis] = useState<SleepAnalysis|null>(null)
  const [form, setForm] = useState({ hours:'7', quality:'7', bedtime:'22:30', wakeTime:'06:00' })
  const [saving, setSaving] = useState(false)
  const [tab, setTab] = useState<'log'|'analysis'>('log')

  useEffect(()=>{ if(user) loadEntries() },[user])
  useEffect(()=>{ if(entries.length) setAnalysis(analyzeSleep(entries)) },[entries])

  async function loadEntries() {
    if(!user) return
    const {data}=await supabase.from('health_records').select('value,recorded_at,metadata')
      .eq('user_id',user.id).eq('test_name','Sleep Duration')
      .order('recorded_at',{ascending:false}).limit(14)
    const mapped = (data||[]).map((r:{value:number;recorded_at:string;metadata:{quality?:number;bedtime?:string;wakeTime?:string}|null})=>({
      date:r.recorded_at.split('T')[0], hours:r.value,
      quality:(r.metadata as {quality?:number}|null)?.quality||5,
      bedtime:(r.metadata as {bedtime?:string}|null)?.bedtime||'22:00',
      wakeTime:(r.metadata as {wakeTime?:string}|null)?.wakeTime||'06:00',
    }))
    setEntries(mapped)
  }

  async function saveEntry() {
    if(!user) return
    setSaving(true)
    try {
      await supabase.from('health_records').insert({
        user_id:user.id, record_type:'sleep', test_name:'Sleep Duration',
        value:parseFloat(form.hours), unit:'hours', source:'manual',
        recorded_at:new Date().toISOString(),
        metadata:{ quality:parseInt(form.quality), bedtime:form.bedtime, wakeTime:form.wakeTime },
      })
      toast.success('Sleep logged!')
      loadEntries()
      setTab('analysis')
    } finally { setSaving(false) }
  }

  const cfg = analysis ? PHASE_CONFIG[analysis.phase] : null
  const maxHours = Math.max(...entries.map(e=>e.hours), 9)

  return (
    <div className="p-4 pb-8 max-w-2xl mx-auto space-y-4">
      <div className="card !p-5" style={{background:'linear-gradient(135deg,#0c0a1e,#1e1b4b)',borderColor:'#4338ca'}}>
        <div className="flex items-start gap-3">
          <div className="w-12 h-12 rounded-xl flex items-center justify-center shrink-0" style={{background:'rgba(99,102,241,0.2)'}}>
            <Moon size={24} className="text-indigo-400"/>
          </div>
          <div>
            <div className="flex items-center gap-2 mb-1">
              <h1 className="text-lg font-bold text-white">Sleep Intelligence</h1>
              <span className="text-[10px] bg-indigo-900 text-indigo-300 border border-indigo-700 px-2 py-0.5 rounded-full font-bold">Daily</span>
            </div>
            <p className="text-sm text-indigo-300">Not just hours — sleep debt, consistency, circadian rhythm, recovery impact.</p>
          </div>
        </div>
      </div>

      <div className="flex gap-1 bg-gray-100 rounded-xl p-1">
        {(['log','analysis'] as const).map(t=>(
          <button key={t} onClick={()=>setTab(t)}
            className={`flex-1 text-xs py-2 rounded-lg font-semibold transition-all ${tab===t?'bg-white shadow-sm text-gray-900':'text-gray-500'}`}>
            {t==='log'?'📝 Log tonight':'📊 My analysis'}
          </button>
        ))}
      </div>

      {tab==='log' && (
        <div className="card !p-4 space-y-4">
          <p className="text-sm font-bold text-gray-800">Log last night's sleep</p>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-gray-500 mb-1 block">😴 Sleep hours</label>
              <input type="number" step="0.5" min="2" max="12" className="input text-sm"
                value={form.hours} onChange={e=>setForm(p=>({...p,hours:e.target.value}))}/>
            </div>
            <div>
              <label className="text-xs text-gray-500 mb-1 block">⭐ Quality /10</label>
              <input type="number" min="1" max="10" className="input text-sm"
                value={form.quality} onChange={e=>setForm(p=>({...p,quality:e.target.value}))}/>
            </div>
            <div>
              <label className="text-xs text-gray-500 mb-1 block">🌙 Bedtime</label>
              <input type="time" className="input text-sm" value={form.bedtime} onChange={e=>setForm(p=>({...p,bedtime:e.target.value}))}/>
            </div>
            <div>
              <label className="text-xs text-gray-500 mb-1 block">⏰ Wake time</label>
              <input type="time" className="input text-sm" value={form.wakeTime} onChange={e=>setForm(p=>({...p,wakeTime:e.target.value}))}/>
            </div>
          </div>
          <button onClick={saveEntry} disabled={saving} className="btn-primary w-full py-3">
            {saving?'Saving...':'Log sleep'}
          </button>
          {entries.length>0 && (
            <div>
              <p className="text-xs font-bold text-gray-500 mb-2">Recent entries</p>
              <div className="flex items-end gap-1.5 h-16">
                {entries.slice(0,10).reverse().map((e,i)=>(
                  <div key={i} className="flex-1 flex flex-col items-center gap-1">
                    <div className="w-full rounded-t-sm" style={{height:`${(e.hours/maxHours)*56}px`,background:e.hours>=7?'#10b981':'#f59e0b',minHeight:4}}/>
                    <span className="text-[8px] text-gray-400">{e.date.slice(5)}</span>
                    <span className="text-[9px] font-bold text-gray-600">{e.hours}h</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {tab==='analysis' && analysis && cfg && (
        <>
          <div className="card !p-5" style={{background:cfg.bg||`${cfg.color}10`,borderColor:`${cfg.color}40`}}>
            <div className="flex items-center gap-4 mb-4">
              <div className="text-center">
                <div className="text-4xl font-black" style={{color:cfg.color}}>{analysis.avgHours}h</div>
                <div className="text-xs text-gray-400">avg/night</div>
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-xl">{cfg.emoji}</span>
                  <span className="text-lg font-black text-gray-900">{cfg.label}</span>
                </div>
                <p className="text-xs text-gray-500 mb-2">{cfg.desc}</p>
                <div className="flex gap-2 flex-wrap">
                  <span className="text-[10px] bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full">Quality: {analysis.avgQuality}/10</span>
                  <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${analysis.sleepDebt>5?'bg-red-100 text-red-700':'bg-green-100 text-green-700'}`}>
                    Debt: {analysis.sleepDebt>0?`-${analysis.sleepDebt}h`:'None'}
                  </span>
                  <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${analysis.consistency<60?'bg-amber-100 text-amber-700':'bg-blue-100 text-blue-700'}`}>
                    Consistency: {analysis.consistency}%
                  </span>
                </div>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2 mb-3">
              <div className="bg-white/60 rounded-xl p-3 text-center">
                <div className="text-2xl font-black text-indigo-600">{analysis.circadianScore}</div>
                <div className="text-[10px] text-gray-500">Circadian score /100</div>
              </div>
              <div className="bg-white/60 rounded-xl p-3 text-center">
                <div className="text-sm font-bold text-gray-700">{analysis.debtRepayPlan.split(':')[0]}</div>
                <div className="text-[10px] text-gray-500">Debt repayment plan</div>
              </div>
            </div>
            <div className="space-y-2">
              {analysis.insights.map((ins,i)=><div key={i} className="flex gap-2 text-xs text-gray-700 bg-white/50 rounded-lg p-2.5"><span className="shrink-0">💡</span>{ins}</div>)}
            </div>
            <div className="mt-3 space-y-1.5">
              {analysis.recommendations.map((r,i)=><div key={i} className="flex gap-2 text-xs text-gray-700 bg-white/50 rounded-lg p-2.5"><Check size={12} className="text-teal-500 shrink-0 mt-0.5"/>{r}</div>)}
            </div>
          </div>

          {analysis.weeklyPattern.length>0 && (
            <div className="card !p-4">
              <p className="text-xs font-bold text-gray-500 mb-3">Weekly sleep pattern</p>
              <div className="flex items-end gap-2 h-20">
                {analysis.weeklyPattern.map((d,i)=>(
                  <div key={i} className="flex-1 flex flex-col items-center gap-1">
                    <div className="w-full rounded-t-lg" style={{height:`${(d.hours/9)*64}px`,background:d.hours>=7?'#6366f1':'#f59e0b',minHeight:6}}/>
                    <span className="text-[9px] text-gray-400">{d.day}</span>
                    <span className="text-[9px] font-bold text-gray-600">{d.hours}h</span>
                  </div>
                ))}
              </div>
              <div className="flex items-center gap-4 mt-2 text-[10px] text-gray-400">
                <span className="flex items-center gap-1"><span className="w-2 h-2 bg-indigo-500 rounded-sm inline-block"/>≥7h optimal</span>
                <span className="flex items-center gap-1"><span className="w-2 h-2 bg-amber-500 rounded-sm inline-block"/>deficit</span>
              </div>
            </div>
          )}
        </>
      )}

      {tab==='analysis' && entries.length===0 && (
        <div className="card text-center py-12 border-dashed border-2">
          <Moon size={32} className="text-indigo-200 mx-auto mb-3"/>
          <p className="text-sm font-semibold text-gray-600">No sleep data yet</p>
          <p className="text-xs text-gray-400 mt-1 mb-4">Log at least 3 nights to get analysis</p>
          <button onClick={()=>setTab('log')} className="btn-primary text-xs py-2">Log tonight's sleep</button>
        </div>
      )}
    </div>
  )
}
