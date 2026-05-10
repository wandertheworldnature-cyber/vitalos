import { useState, useEffect } from 'react'
import { useAuthStore } from '@/store/authStore'
import { supabase } from '@/lib/supabase'
import { Leaf, RefreshCw, Plus, CheckCircle } from 'lucide-react'
import toast from 'react-hot-toast'

interface GutInputs {
  fiberIntake: number        // grams/day
  waterIntake: number        // glasses
  fermentedFoods: boolean    // curd, idli, dosa etc
  processedFood: number      // servings/day
  bloating: number           // 1-10
  digestionComfort: number   // 1-10
  bowelRegularity: number    // 1=irregular, 10=very regular
  stressLevel: number        // 1-10
  sleepHours: number
  antibioticsRecent: boolean // last 3 months
  probiotics: boolean
  dietType: 'veg'|'non-veg'|'vegan'
}

interface GutResult {
  score: number
  category: 'poor'|'fair'|'good'|'excellent'
  microbiomeDiversity: 'low'|'moderate'|'high'
  inflammation: 'high'|'moderate'|'low'
  breakdown: { fiber: number; fermented: number; digestion: number; lifestyle: number }
  insights: string[]
  recommendations: string[]
  indianFoods: string[]
  supplements: string[]
}

const CATEGORY_CONFIG = {
  poor:      { color:'#ef4444', bg:'rgba(239,68,68,0.08)',   label:'Poor',      emoji:'😟', desc:'Your gut needs urgent attention' },
  fair:      { color:'#f59e0b', bg:'rgba(245,158,11,0.08)',  label:'Fair',      emoji:'😐', desc:'Room for significant improvement' },
  good:      { color:'#10b981', bg:'rgba(16,185,129,0.08)',  label:'Good',      emoji:'🙂', desc:'On the right track' },
  excellent: { color:'#3b82f6', bg:'rgba(59,130,246,0.08)',  label:'Excellent', emoji:'😄', desc:'Your gut microbiome is thriving' },
}

function calcGutScore(inputs: GutInputs): GutResult {
  // Fiber score (0-100)
  const fiberScore = Math.min(100, (inputs.fiberIntake / 30) * 100)

  // Fermented foods score
  const fermentedScore = inputs.fermentedFoods ? 80 : 30

  // Digestion score
  const digestionScore = ((inputs.digestionComfort + inputs.bowelRegularity) / 20) * 100 - (inputs.bloating * 5)

  // Lifestyle score
  const lifestyleScore = ((inputs.waterIntake / 8) * 40) +
    (inputs.sleepHours >= 7 ? 30 : inputs.sleepHours >= 6 ? 20 : 10) +
    (inputs.probiotics ? 15 : 0) +
    (inputs.antibioticsRecent ? -30 : 0) -
    (inputs.processedFood * 8) -
    (inputs.stressLevel * 3)

  const breakdown = {
    fiber: Math.round(Math.max(0, Math.min(100, fiberScore))),
    fermented: Math.round(Math.max(0, Math.min(100, fermentedScore))),
    digestion: Math.round(Math.max(0, Math.min(100, digestionScore))),
    lifestyle: Math.round(Math.max(0, Math.min(100, lifestyleScore))),
  }

  const total = Math.round(
    breakdown.fiber * 0.25 +
    breakdown.fermented * 0.25 +
    breakdown.digestion * 0.30 +
    breakdown.lifestyle * 0.20
  )

  const category: GutResult['category'] = total >= 75 ? 'excellent' : total >= 55 ? 'good' : total >= 35 ? 'fair' : 'poor'
  const microbiomeDiversity: GutResult['microbiomeDiversity'] = inputs.fiberIntake >= 25 && inputs.fermentedFoods ? 'high' : inputs.fiberIntake >= 15 ? 'moderate' : 'low'
  const inflammation: GutResult['inflammation'] = inputs.processedFood >= 3 || inputs.stressLevel >= 7 ? 'high' : inputs.processedFood >= 1 ? 'moderate' : 'low'

  const insights: string[] = []
  const recommendations: string[] = []

  if (inputs.fiberIntake < 15) { insights.push(`Your fiber intake (${inputs.fiberIntake}g) is less than half the recommended 25-30g/day — gut bacteria are starving`); recommendations.push('Add 1 cup rajma/chana/dal to every meal — easiest way to hit fiber targets') }
  if (!inputs.fermentedFoods) { insights.push('No fermented foods detected — missing critical probiotic bacteria for gut immunity'); recommendations.push('Have 1 cup curd (dahi) daily — 100 million+ live cultures per serving') }
  if (inputs.bloating >= 6) { insights.push('High bloating suggests poor gut motility or food intolerance'); recommendations.push('Try eliminating maida/refined wheat for 2 weeks — very common Indian gut irritant') }
  if (inputs.processedFood >= 3) { insights.push(`${inputs.processedFood} servings of processed food damages gut lining and reduces microbial diversity`); recommendations.push('Replace packaged snacks with roasted makhana, peanuts, or fruit') }
  if (inputs.antibioticsRecent) { insights.push('Recent antibiotics can reduce gut bacteria by 90% — recovery takes 6+ months without active rebuilding'); recommendations.push('Take Lactobacillus + Bifidobacterium probiotic supplement for 60 days') }
  if (inputs.stressLevel >= 7) { insights.push('High stress directly disrupts gut-brain axis — increases leaky gut permeability'); recommendations.push('10 min morning yoga (especially child\'s pose + twists) improves gut motility') }
  if (inputs.waterIntake < 6) { insights.push(`Low water intake (${inputs.waterIntake} glasses) slows intestinal transit — increases toxin reabsorption`); recommendations.push('Drink 1 glass warm water with lemon immediately on waking') }

  if (insights.length === 0) insights.push('Your gut health indicators are well-balanced. Keep your current diet and lifestyle.')
  if (recommendations.length === 0) recommendations.push('Maintain diversity — try 1 new vegetable per week to feed different bacterial strains')

  const indianFoods = [
    'Curd/Dahi — 1 cup daily (probiotics)',
    'Idli/Dosa (fermented) — 3x/week',
    'Rajma/Chana — high fiber, prebiotic',
    'Banana (unripe) — resistant starch feeds gut bacteria',
    'Amla (Indian gooseberry) — powerful gut antioxidant',
    'Kanji (fermented carrot drink) — traditional probiotic',
    'Turmeric milk — anti-inflammatory for gut lining',
    'Jeera water (cumin) — reduces bloating naturally',
  ]

  const supplements = [
    inputs.microbiomeDiversity === 'low' ? 'Probiotic: Lactobacillus acidophilus + Bifidobacterium longum (10 billion CFU)' : null,
    inputs.fiberIntake < 20 ? 'Prebiotic fiber: Inulin or Psyllium husk (isabgol) — 5g/day in water' : null,
    inflammation === 'high' ? 'Digestive enzymes with meals — helps break down food more completely' : null,
    inputs.antibioticsRecent ? 'Saccharomyces boulardii (probiotic yeast) — helps rebuild post-antibiotic microbiome' : null,
    'L-Glutamine (5g/day) — repairs gut lining integrity',
  ].filter(Boolean) as string[]

  return { score: Math.max(10, Math.min(100, total)), category, microbiomeDiversity, inflammation, breakdown, insights, recommendations, indianFoods, supplements }
}

export default function GutHealthPage() {
  const { user } = useAuthStore()
  const [inputs, setInputs] = useState<GutInputs>({
    fiberIntake: 15, waterIntake: 6, fermentedFoods: false, processedFood: 2,
    bloating: 4, digestionComfort: 6, bowelRegularity: 6, stressLevel: 5,
    sleepHours: 7, antibioticsRecent: false, probiotics: false, dietType:'veg',
  })
  const [result, setResult] = useState<GutResult | null>(null)
  const [history, setHistory] = useState<Array<{ date:string; score:number }>>([])
  const [saving, setSaving] = useState(false)
  const [activeTab, setActiveTab] = useState<'insights'|'food'|'supplements'>('insights')

  useEffect(() => { if (user) loadHistory() }, [user])

  async function loadHistory() {
    if (!user) return
    const { data } = await supabase.from('health_records').select('value,recorded_at')
      .eq('user_id', user.id).eq('test_name', 'Gut Health Score')
      .order('recorded_at', { ascending: false }).limit(7)
    setHistory((data||[]).map((r:{value:number;recorded_at:string}) => ({ date:r.recorded_at.split('T')[0], score:r.value })))
  }

  async function calculate() {
    const res = calcGutScore(inputs)
    setResult(res)
    if (!user) return
    setSaving(true)
    try {
      await supabase.from('health_records').insert({
        user_id: user.id, record_type: 'gut', test_name: 'Gut Health Score',
        value: res.score, unit: '/100', source: 'manual',
        recorded_at: new Date().toISOString(),
        metadata: { category:res.category, microbiomeDiversity:res.microbiomeDiversity, inflammation:res.inflammation, breakdown:res.breakdown },
      })
      toast.success('Gut health score saved!')
      loadHistory()
    } finally { setSaving(false) }
  }

  const cfg = result ? CATEGORY_CONFIG[result.category] : null

  return (
    <div className="p-4 pb-8 max-w-2xl mx-auto space-y-4">
      {/* Header */}
      <div className="card !p-5" style={{ background:'linear-gradient(135deg,#051a10,#0a2818)', borderColor:'#166534' }}>
        <div className="flex items-start gap-3">
          <div className="w-12 h-12 rounded-xl flex items-center justify-center shrink-0" style={{ background:'rgba(16,185,129,0.2)' }}>
            <Leaf size={24} className="text-emerald-400"/>
          </div>
          <div>
            <div className="flex items-center gap-2 mb-1">
              <h1 className="text-lg font-bold text-white">Gut Health Engine</h1>
              <span className="text-[10px] bg-emerald-900 text-emerald-300 border border-emerald-700 px-2 py-0.5 rounded-full font-bold">PREMIUM</span>
            </div>
            <p className="text-sm text-emerald-300 leading-relaxed">Your gut microbiome affects immunity, mood, weight, skin, and energy. India's most neglected health system.</p>
          </div>
        </div>
        <div className="mt-3 grid grid-cols-4 gap-1.5 text-center">
          {['💪 Immunity', '😊 Mood', '⚖️ Weight', '✨ Skin'].map(t => (
            <div key={t} className="bg-emerald-900/30 rounded-lg py-1.5 text-[10px] text-emerald-300">{t}</div>
          ))}
        </div>
      </div>

      {/* History */}
      {history.length > 0 && (
        <div className="card !p-4">
          <p className="text-xs font-bold text-gray-500 mb-3">Gut health trend</p>
          <div className="flex items-end gap-2 h-14">
            {history.slice().reverse().map((h, i) => (
              <div key={i} className="flex-1 flex flex-col items-center gap-1">
                <div className="w-full rounded-t-sm bg-emerald-500" style={{ height:`${(h.score/100)*50}px`, minHeight:4 }}/>
                <span className="text-[8px] text-gray-500">{h.date.slice(5)}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Inputs */}
      <div className="card !p-4 space-y-4">
        <p className="text-sm font-bold text-gray-800">Gut health check-in</p>

        {/* Sliders */}
        {[
          { label:'Fiber intake today', key:'fiberIntake', min:0, max:50, step:1, unit:'g', icon:'🌾', tip:'25-30g daily recommended' },
          { label:'Water intake', key:'waterIntake', min:0, max:15, step:0.5, unit:'glasses', icon:'💧', tip:'8+ glasses ideal' },
          { label:'Processed food servings', key:'processedFood', min:0, max:10, step:0.5, unit:'servings', icon:'🍕', tip:'Less = better' },
          { label:'Bloating level', key:'bloating', min:1, max:10, step:1, unit:'/10', icon:'🫃', tip:'1=none, 10=severe' },
          { label:'Digestion comfort', key:'digestionComfort', min:1, max:10, step:1, unit:'/10', icon:'✨', tip:'10=perfectly comfortable' },
          { label:'Bowel regularity', key:'bowelRegularity', min:1, max:10, step:1, unit:'/10', icon:'⏰', tip:'10=very regular' },
          { label:'Stress level', key:'stressLevel', min:1, max:10, step:1, unit:'/10', icon:'😤', tip:'Lower is better' },
          { label:'Sleep hours', key:'sleepHours', min:3, max:10, step:0.5, unit:'hrs', icon:'😴', tip:'7-9 hrs optimal' },
        ].map(f => {
          const val = (inputs as Record<string,unknown>)[f.key] as number
          const pct = ((val - f.min) / (f.max - f.min)) * 100
          const isInverse = ['bloating','processedFood','stressLevel'].includes(f.key)
          const trackColor = isInverse
            ? `linear-gradient(90deg, #10b981 ${100-pct}%, #ef4444 ${100-pct}%)`
            : `linear-gradient(90deg, #10b981 ${pct}%, #e5e7eb ${pct}%)`
          return (
            <div key={f.key}>
              <div className="flex items-center justify-between mb-1">
                <label className="text-xs font-medium text-gray-700 flex items-center gap-1">
                  <span>{f.icon}</span>{f.label}
                  <span className="text-[10px] text-gray-400">({f.tip})</span>
                </label>
                <span className="text-sm font-bold text-gray-900">{val}{f.unit}</span>
              </div>
              <input type="range" min={f.min} max={f.max} step={f.step} value={val}
                onChange={e => setInputs(p => ({ ...p, [f.key]: parseFloat(e.target.value) }))}
                className="w-full h-2 rounded-full appearance-none cursor-pointer"
                style={{ background:trackColor }}/>
            </div>
          )
        })}

        {/* Toggles */}
        <div className="grid grid-cols-2 gap-2">
          {[
            { key:'fermentedFoods', label:'Fermented foods today', icon:'🥛', tip:'Curd, idli, dosa...' },
            { key:'probiotics', label:'Taking probiotics', icon:'💊', tip:'Supplement or natural' },
            { key:'antibioticsRecent', label:'Antibiotics (last 3 months)', icon:'⚠️', tip:'Disrupts gut flora' },
          ].map(f => {
            const val = (inputs as Record<string,unknown>)[f.key] as boolean
            const isWarning = f.key === 'antibioticsRecent'
            return (
              <button key={f.key} onClick={() => setInputs(p => ({ ...p, [f.key]: !val }))}
                className={`flex items-start gap-2 p-3 rounded-xl border text-left transition-all ${val ? 'text-white border-transparent' : 'border-gray-200 bg-white'}`}
                style={val ? { background: isWarning ? 'linear-gradient(135deg,#b91c1c,#ef4444)' : 'linear-gradient(135deg,#0f6e56,#1d9e75)' } : {}}>
                <span className="text-base shrink-0">{f.icon}</span>
                <div>
                  <div className="text-xs font-semibold">{f.label}</div>
                  <div className={`text-[10px] ${val ? 'text-white/70' : 'text-gray-400'}`}>{f.tip}</div>
                </div>
              </button>
            )
          })}
          <div>
            <label className="text-xs text-gray-500 mb-1 block">Diet type</label>
            <select className="input text-sm !py-2" value={inputs.dietType}
              onChange={e => setInputs(p => ({ ...p, dietType: e.target.value as GutInputs['dietType'] }))}>
              <option value="veg">Vegetarian</option>
              <option value="non-veg">Non-vegetarian</option>
              <option value="vegan">Vegan</option>
            </select>
          </div>
        </div>

        <button onClick={calculate} disabled={saving} className="btn-primary w-full py-3 flex items-center justify-center gap-2">
          <Leaf size={16}/> Analyse gut health
        </button>
      </div>

      {/* Result */}
      {result && cfg && (
        <>
          <div className="card !p-5" style={{ background:cfg.bg, borderColor:cfg.color+'40' }}>
            <div className="flex items-center gap-4 mb-4">
              <div className="text-center">
                <div className="text-5xl font-black" style={{ color:cfg.color }}>{result.score}</div>
                <div className="text-xs text-gray-400 mt-1">/100</div>
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-xl">{cfg.emoji}</span>
                  <span className="text-lg font-black text-gray-900">{cfg.label}</span>
                </div>
                <p className="text-xs text-gray-500 mb-2">{cfg.desc}</p>
                <div className="flex gap-2">
                  <div className="bg-white/60 rounded-lg px-3 py-1.5 text-center">
                    <div className="text-xs font-black" style={{ color: result.microbiomeDiversity==='high'?'#10b981':result.microbiomeDiversity==='moderate'?'#f59e0b':'#ef4444' }}>
                      {result.microbiomeDiversity.toUpperCase()}
                    </div>
                    <div className="text-[9px] text-gray-500">Diversity</div>
                  </div>
                  <div className="bg-white/60 rounded-lg px-3 py-1.5 text-center">
                    <div className="text-xs font-black" style={{ color: result.inflammation==='low'?'#10b981':result.inflammation==='moderate'?'#f59e0b':'#ef4444' }}>
                      {result.inflammation.toUpperCase()}
                    </div>
                    <div className="text-[9px] text-gray-500">Inflammation</div>
                  </div>
                </div>
              </div>
            </div>

            {/* Breakdown */}
            <div className="grid grid-cols-4 gap-2 mb-4">
              {[
                { label:'Fiber', val:result.breakdown.fiber, icon:'🌾' },
                { label:'Fermented', val:result.breakdown.fermented, icon:'🥛' },
                { label:'Digestion', val:result.breakdown.digestion, icon:'✨' },
                { label:'Lifestyle', val:result.breakdown.lifestyle, icon:'🌿' },
              ].map(b => (
                <div key={b.label} className="bg-white/60 rounded-xl p-2.5 text-center">
                  <div className="text-base mb-0.5">{b.icon}</div>
                  <div className="text-base font-black text-gray-900">{b.val}</div>
                  <div className="text-[9px] text-gray-500">{b.label}</div>
                  <div className="h-1 bg-gray-200 rounded-full mt-1.5 overflow-hidden">
                    <div className="h-full rounded-full" style={{ width:`${b.val}%`, background:cfg.color }}/>
                  </div>
                </div>
              ))}
            </div>

            <div className="flex gap-1 bg-white/40 rounded-xl p-1 mb-3">
              {(['insights','food','supplements'] as const).map(t => (
                <button key={t} onClick={() => setActiveTab(t)}
                  className={`flex-1 text-[11px] py-1.5 rounded-lg font-semibold capitalize transition-all ${activeTab===t?'bg-white shadow-sm text-gray-900':'text-gray-500'}`}>
                  {t==='insights'?'💡 Insights':t==='food'?'🥘 Indian Foods':'💊 Supplements'}
                </button>
              ))}
            </div>

            {activeTab==='insights' && (
              <div className="space-y-2">
                {result.insights.map((ins, i) => (
                  <div key={i} className="flex gap-2 bg-white/50 rounded-lg p-2.5 text-xs text-gray-700"><span className="shrink-0">💡</span>{ins}</div>
                ))}
                <div className="mt-2">
                  <p className="text-[10px] font-bold text-gray-600 mb-1.5">RECOMMENDATIONS</p>
                  {result.recommendations.map((r, i) => (
                    <div key={i} className="flex gap-2 bg-white/50 rounded-lg p-2.5 text-xs text-gray-700 mb-1.5"><span className="text-emerald-600 shrink-0">→</span>{r}</div>
                  ))}
                </div>
              </div>
            )}

            {activeTab==='food' && (
              <div className="space-y-2">
                <p className="text-[10px] font-bold text-gray-600 mb-1">BEST INDIAN GUT FOODS FOR YOU</p>
                {result.indianFoods.map((food, i) => (
                  <div key={i} className="flex gap-2 bg-white/50 rounded-lg p-2.5 text-xs text-gray-700"><span className="text-emerald-500 shrink-0">🌿</span>{food}</div>
                ))}
              </div>
            )}

            {activeTab==='supplements' && (
              <div className="space-y-2">
                <p className="text-[10px] font-bold text-gray-600 mb-1">RECOMMENDED SUPPLEMENTS</p>
                {result.supplements.map((s, i) => (
                  <div key={i} className="flex gap-2 bg-white/50 rounded-lg p-2.5 text-xs text-gray-700">
                    <CheckCircle size={12} className="text-emerald-500 shrink-0 mt-0.5"/>{s}
                  </div>
                ))}
                <p className="text-[10px] text-gray-400 mt-2">Consult your doctor before starting any supplement regimen.</p>
              </div>
            )}
          </div>

          <button onClick={() => setResult(null)} className="w-full btn-secondary text-xs py-2">
            <RefreshCw size={12} className="inline mr-1"/> Re-check
          </button>
        </>
      )}
    </div>
  )
}
