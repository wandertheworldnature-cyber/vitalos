import { useState, useEffect } from 'react'
import { useAuthStore } from '@/store/authStore'
import { supabase } from '@/lib/supabase'
import { Dna, TrendingUp, Share2, RefreshCw } from 'lucide-react'
import toast from 'react-hot-toast'

interface BioAgeResult {
  biologicalAge: number
  chronologicalAge: number
  ageDiff: number          // positive = older than actual, negative = younger
  grade: 'S'|'A'|'B'|'C'|'D'
  topFactors: Array<{factor:string; impact:number; direction:'aging'|'rejuvenating'; action:string}>
  shareText: string
  percentile: number
  projectedAt80: string
}

const GRADE_CONFIG = {
  S: { color:'#3b82f6', label:'Exceptional', desc:'You\'re aging remarkably slower than peers' },
  A: { color:'#10b981', label:'Excellent',   desc:'Biological age younger than chronological' },
  B: { color:'#f59e0b', label:'Good',        desc:'On track — minor improvements will help' },
  C: { color:'#f97316', label:'Fair',        desc:'Several factors accelerating aging' },
  D: { color:'#ef4444', label:'At Risk',     desc:'Multiple biomarkers showing accelerated aging' },
}

function calcBioAge(records: Array<{test_name:string;value:number;unit:string;reference_min?:number|null;reference_max?:number|null}>, chronoAge: number): BioAgeResult {
  let agingScore = 0
  const factors: BioAgeResult['topFactors'] = []

  for (const r of records) {
    const n = r.test_name.toLowerCase()
    const val = r.value
    const max = r.reference_max
    const min = r.reference_min

    if (n.includes('hba1c')) {
      if (val > 5.7) { agingScore += (val-5.7)*8; factors.push({factor:'HbA1c',impact:Math.round((val-5.7)*8),direction:'aging',action:'Reduce sugar, walk 8k steps daily'}) }
      else { agingScore -= 2; factors.push({factor:'HbA1c',impact:2,direction:'rejuvenating',action:'Keep blood sugar controlled'}) }
    }
    if (n.includes('ldl')) {
      if (val > 130) { agingScore += (val-130)*0.05; factors.push({factor:'LDL Cholesterol',impact:Math.round((val-130)*0.05),direction:'aging',action:'Mediterranean diet, omega-3, exercise'}) }
    }
    if (n.includes('crp') || n.includes('c-reactive')) {
      if (val > 1) { agingScore += val*3; factors.push({factor:'Inflammation (CRP)',impact:Math.round(val*3),direction:'aging',action:'Anti-inflammatory diet, reduce processed food'}) }
    }
    if (n.includes('vitamin d')) {
      if (val < 30) { agingScore += (30-val)*0.15; factors.push({factor:'Vitamin D',impact:Math.round((30-val)*0.15),direction:'aging',action:'Sunlight 15 min/day + D3 supplement'}) }
      else if (val >= 50) { agingScore -= 3; factors.push({factor:'Vitamin D',impact:3,direction:'rejuvenating',action:'Maintain current sun exposure'}) }
    }
    if (n.includes('hemoglobin')) {
      if (min && val < min) { agingScore += 3; factors.push({factor:'Hemoglobin/Anemia',impact:3,direction:'aging',action:'Iron-rich foods: spinach, rajma, meat'}) }
    }
    if (n.includes('tsh') || n.includes('thyroid')) {
      if (max && val > max) { agingScore += 2; factors.push({factor:'Thyroid (TSH)',impact:2,direction:'aging',action:'Consult endocrinologist, check iodine'}) }
    }
    if (n.includes('uric acid')) {
      if (max && val > max) { agingScore += 2; factors.push({factor:'Uric Acid',impact:2,direction:'aging',action:'Reduce red meat, increase water intake'}) }
    }
    if (n.includes('creatinine')) {
      if (max && val > max*1.1) { agingScore += 4; factors.push({factor:'Kidney Function',impact:4,direction:'aging',action:'Hydrate well, consult nephrologist'}) }
    }
  }

  const bioAge = Math.round(Math.max(18, chronoAge + agingScore * 0.5))
  const ageDiff = bioAge - chronoAge
  const grade: BioAgeResult['grade'] = ageDiff <= -5 ? 'S' : ageDiff <= 0 ? 'A' : ageDiff <= 3 ? 'B' : ageDiff <= 7 ? 'C' : 'D'
  const percentile = Math.max(5, Math.min(99, 80 - ageDiff * 4))
  const projectedAt80 = ageDiff <= 0
    ? `At this rate, your body will be ${Math.abs(ageDiff)+2} years younger than peers at 80`
    : `Without changes, biological age at 80 could be ${80+ageDiff}`

  const shareText = ageDiff <= 0
    ? `My biological age is ${bioAge} but I'm actually ${chronoAge}! 🎉 I'm ${Math.abs(ageDiff)} years younger than my age. Checked on VitalOS!`
    : `VitalOS says my biological age is ${bioAge} (actual: ${chronoAge}). Working to reverse this! #VitalOS`

  return {
    biologicalAge: bioAge,
    chronologicalAge: chronoAge,
    ageDiff,
    grade,
    topFactors: factors.sort((a,b)=>b.impact-a.impact).slice(0,5),
    shareText,
    percentile,
    projectedAt80,
  }
}

export default function BiologicalAgePage() {
  const { user } = useAuthStore()
  const [result, setResult] = useState<BioAgeResult|null>(null)
  const [loading, setLoading] = useState(false)
  const [chronoAge, setChronoAge] = useState(30)
  const [history, setHistory] = useState<Array<{date:string;bioAge:number}>>([])

  useEffect(()=>{ if(user) { loadAge(); loadHistory() } },[user])

  async function loadAge() {
    if(!user) return
    const {data}=await supabase.from('profiles').select('date_of_birth').eq('id',user.id).single()
    if(data?.date_of_birth) {
      const age=Math.floor((Date.now()-new Date(data.date_of_birth).getTime())/31557600000)
      setChronoAge(age)
    }
  }

  async function loadHistory() {
    if(!user) return
    const {data}=await supabase.from('health_records').select('value,recorded_at')
      .eq('user_id',user.id).eq('test_name','Biological Age')
      .order('recorded_at',{ascending:false}).limit(6)
    setHistory((data||[]).map((r:{value:number;recorded_at:string})=>({date:r.recorded_at.split('T')[0],bioAge:r.value})))
  }

  async function generate() {
    if(!user) return
    setLoading(true)
    try {
      const {data:records}=await supabase.from('health_records').select('test_name,value,unit,reference_min,reference_max')
        .eq('user_id',user.id).order('recorded_at',{ascending:false}).limit(50)
      if(!records?.length) { toast('Upload lab reports first',{icon:'ℹ️'}); return }
      const seen = new Map()
      for(const r of records) { if(!seen.has(r.test_name.toLowerCase())) seen.set(r.test_name.toLowerCase(),r) }
      const res = calcBioAge(Array.from(seen.values()), chronoAge)
      setResult(res)
      await supabase.from('health_records').insert({
        user_id:user.id, record_type:'bioage', test_name:'Biological Age',
        value:res.biologicalAge, unit:'years', source:'calculated',
        recorded_at:new Date().toISOString(),
        metadata:{chronologicalAge:chronoAge, ageDiff:res.ageDiff, grade:res.grade}
      })
      loadHistory()
      toast.success('Biological age calculated!')
    } finally { setLoading(false) }
  }

  function share() {
    if(!result) return
    if(navigator.share) {
      navigator.share({ title:'My Biological Age — VitalOS', text:result.shareText, url:'https://vitalos-six.vercel.app' })
    } else {
      navigator.clipboard?.writeText(result.shareText)
      toast.success('Copied! Share on WhatsApp/Twitter')
    }
  }

  const cfg = result ? GRADE_CONFIG[result.grade] : null

  return (
    <div className="p-4 pb-8 max-w-2xl mx-auto space-y-4">
      <div className="card !p-5" style={{background:'linear-gradient(135deg,#1e1b4b,#312e81)',borderColor:'#4338ca'}}>
        <div className="flex items-start gap-3">
          <div className="w-12 h-12 rounded-xl flex items-center justify-center shrink-0" style={{background:'rgba(99,102,241,0.2)'}}>
            <Dna size={24} className="text-indigo-400"/>
          </div>
          <div>
            <div className="flex items-center gap-2 mb-1">
              <h1 className="text-lg font-bold text-white">Biological Age Engine</h1>
              <span className="text-[10px] bg-indigo-900 text-indigo-300 border border-indigo-700 px-2 py-0.5 rounded-full font-bold">VIRAL</span>
            </div>
            <p className="text-sm text-indigo-300">Your body's true age based on biomarkers — not your birth certificate.</p>
          </div>
        </div>
      </div>

      {/* History sparkline */}
      {history.length>1 && (
        <div className="card !p-4">
          <p className="text-xs font-bold text-gray-500 mb-3">Biological age trend</p>
          <div className="flex items-end gap-3 h-14">
            {history.slice().reverse().map((h,i)=>(
              <div key={i} className="flex-1 flex flex-col items-center gap-1">
                <div className="w-full rounded-t-sm" style={{height:`${Math.max(10,(h.bioAge/60)*50)}px`, background:h.bioAge>chronoAge?'#ef4444':'#10b981'}}/>
                <span className="text-[8px] text-gray-500">{h.date.slice(5)}</span>
                <span className="text-[9px] font-bold" style={{color:h.bioAge>chronoAge?'#ef4444':'#10b981'}}>{h.bioAge}</span>
              </div>
            ))}
          </div>
          <div className="flex justify-between text-[10px] text-gray-400 mt-1">
            <span>← older</span><span>Goal: reduce biological age →</span>
          </div>
        </div>
      )}

      {/* Age input */}
      <div className="card !p-4">
        <div className="flex items-center justify-between mb-3">
          <div>
            <p className="text-sm font-bold text-gray-800">Your chronological age</p>
            <p className="text-xs text-gray-400">Auto-filled from profile. Adjust if needed.</p>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={()=>setChronoAge(a=>Math.max(15,a-1))} className="w-8 h-8 rounded-lg bg-gray-100 text-gray-600 font-bold hover:bg-gray-200">−</button>
            <span className="text-2xl font-black text-gray-900 w-12 text-center">{chronoAge}</span>
            <button onClick={()=>setChronoAge(a=>Math.min(100,a+1))} className="w-8 h-8 rounded-lg bg-gray-100 text-gray-600 font-bold hover:bg-gray-200">+</button>
          </div>
        </div>
        <button onClick={generate} disabled={loading} className="btn-primary w-full py-3 flex items-center justify-center gap-2">
          <Dna size={16}/>{loading?'Calculating...':'Calculate biological age'}
        </button>
      </div>

      {result && cfg && (
        <>
          {/* Main result — VIRAL CARD */}
          <div className="card !p-6 text-center relative overflow-hidden"
            style={{background:`linear-gradient(135deg,${cfg.color}15,${cfg.color}08)`, borderColor:`${cfg.color}40`}}>
            <div className="relative z-10">
              <p className="text-xs font-bold text-gray-500 mb-2 uppercase tracking-wider">Your Biological Age</p>
              <div className="flex items-end justify-center gap-3 mb-2">
                <div className="text-center">
                  <div className="text-7xl font-black" style={{color:cfg.color}}>{result.biologicalAge}</div>
                  <div className="text-xs text-gray-400 mt-1">biological age</div>
                </div>
                <div className="text-center mb-3">
                  <div className="text-3xl font-bold text-gray-400">{result.ageDiff>0?'+':''}{result.ageDiff}</div>
                  <div className="text-[10px] text-gray-400">vs actual age {result.chronologicalAge}</div>
                </div>
              </div>

              <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full mb-3"
                style={{background:`${cfg.color}20`, border:`1px solid ${cfg.color}40`}}>
                <span className="text-lg font-black" style={{color:cfg.color}}>Grade {result.grade}</span>
                <span className="text-sm font-bold text-gray-700">{cfg.label}</span>
              </div>

              <p className="text-sm text-gray-600 mb-1">{cfg.desc}</p>
              <p className="text-xs text-gray-400 mb-4">{result.projectedAt80}</p>

              <div className="flex gap-2 justify-center">
                <button onClick={share}
                  className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold text-white"
                  style={{background:`linear-gradient(135deg,${cfg.color},${cfg.color}cc)`}}>
                  <Share2 size={14}/>Share this result
                </button>
                <button onClick={generate} disabled={loading}
                  className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold btn-secondary">
                  <RefreshCw size={14}/>Recalculate
                </button>
              </div>
            </div>
          </div>

          {/* Factors */}
          <div className="card !p-4">
            <p className="text-sm font-bold text-gray-800 mb-3">What's affecting your biological age</p>
            <div className="space-y-3">
              {result.topFactors.map((f,i)=>(
                <div key={i} className={`p-3 rounded-xl border ${f.direction==='aging'?'bg-red-50 border-red-100':'bg-green-50 border-green-100'}`}>
                  <div className="flex items-center justify-between mb-1">
                    <p className="text-sm font-bold text-gray-900">{f.factor}</p>
                    <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${f.direction==='aging'?'bg-red-100 text-red-700':'bg-green-100 text-green-700'}`}>
                      {f.direction==='aging'?`+${f.impact} yrs older`:`-${f.impact} yrs younger`}
                    </span>
                  </div>
                  <p className="text-xs text-gray-600">→ {f.action}</p>
                </div>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  )
}
