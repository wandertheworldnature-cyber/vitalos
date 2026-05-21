import { useNavigate } from 'react-router-dom'
import { Battery, Dna, Utensils, Moon, Brain, Cpu, ChevronRight, Zap } from 'lucide-react'

const FEATURES = [
  {
    path: '/intelligence/recovery',
    icon: Battery, emoji: '🔋',
    title: 'Recovery Score',
    subtitle: 'WHOOP-style daily readiness',
    desc: 'Sleep + HRV + Stress + Activity = Should you push hard or rest today? Daily morning check-in.',
    color: '#3b82f6', bg: 'linear-gradient(135deg,#0a1628,#0d2040)', border: '#1e40af',
    badge: 'Daily', tags: ['WHOOP-style','HRV','Train or Rest'],
  },
  {
    path: '/intelligence/biological-age',
    icon: Dna, emoji: '🧬',
    title: 'Biological Age Engine',
    subtitle: 'How old is your body really?',
    desc: 'Calculate true biological age from biomarkers. Grade A–S system. Viral shareable result card. Track improvement.',
    color: '#6366f1', bg: 'linear-gradient(135deg,#1e1b4b,#312e81)', border: '#4338ca',
    badge: '🔥 Viral', tags: ['Shareable','Bio Age','Grades'],
  },
  {
    path: '/intelligence/nutrition',
    icon: Utensils, emoji: '🥗',
    title: 'Personalized Nutrition AI',
    subtitle: 'Meals based on YOUR blood markers',
    desc: 'AI creates Indian meal plans from your lab results, gut health score, and fitness goals. Avoid, eat, supplement — all personalized.',
    color: '#22c55e', bg: 'linear-gradient(135deg,#052e16,#14532d)', border: '#166534',
    badge: 'AI Powered', tags: ['Indian Foods','Blood Markers','Daily Plan'],
  },
  {
    path: '/intelligence/sleep',
    icon: Moon, emoji: '🌙',
    title: 'Sleep Intelligence',
    subtitle: 'Not just hours — full analysis',
    desc: 'Track sleep debt, consistency, circadian score. 14-day pattern analysis. Personalized sleep debt repayment plan.',
    color: '#8b5cf6', bg: 'linear-gradient(135deg,#0c0a1e,#1e1b4b)', border: '#4338ca',
    badge: 'Daily Log', tags: ['Sleep Debt','Circadian','Consistency'],
  },
  {
    path: '/intelligence/memory',
    icon: Brain, emoji: '🧠',
    title: 'Health Memory Engine',
    subtitle: 'AI that remembers everything',
    desc: 'Log illnesses, medications, surgeries, doctor feedback. AI generates your complete health narrative. Context-aware forever.',
    color: '#64748b', bg: 'linear-gradient(135deg,#0f172a,#1e293b)', border: '#334155',
    badge: 'Lifetime', tags: ['Health History','AI Summary','Doctor Notes'],
  },
  {
    path: '/intelligence/digital-twin',
    icon: Cpu, emoji: '🚀',
    title: 'Digital Twin',
    subtitle: '🌟 Moonshot feature',
    desc: '"If I lose 10kg, what happens to my diabetes risk?" AI simulates YOUR future health outcomes from 8 lifestyle scenarios.',
    color: '#06b6d4', bg: 'linear-gradient(135deg,#020617,#0f172a)', border: '#0e7490',
    badge: '🌟 Moonshot', tags: ['Simulation','Future Health','8 Scenarios'],
  },
]

export default function IntelligenceHub() {
  const navigate = useNavigate()

  return (
    <div className="p-4 pb-8 max-w-2xl mx-auto space-y-5">
      {/* Header */}
      <div className="text-center pt-2">
        <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full mb-3"
          style={{ background:'linear-gradient(135deg,rgba(6,182,212,0.15),rgba(99,102,241,0.15))', border:'1px solid rgba(6,182,212,0.3)' }}>
          <Zap size={14} className="text-cyan-400"/>
          <span className="text-xs font-bold text-cyan-300">VitalOS Intelligence — 6 Advanced Engines</span>
        </div>
        <h1 className="text-xl font-black text-gray-900 mb-2">Health Intelligence</h1>
        <p className="text-sm text-gray-500 max-w-sm mx-auto leading-relaxed">
          Beyond tracking. These 6 engines transform VitalOS from a health dashboard into a <strong>Human Longevity OS</strong>.
        </p>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { label:'Engines', val:'6', color:'#06b6d4' },
          { label:'AI modes', val:'4+', color:'#8b5cf6' },
          { label:'Data points', val:'50+', color:'#10b981' },
        ].map(s=>(
          <div key={s.label} className="card !p-3 text-center">
            <div className="text-2xl font-black" style={{color:s.color}}>{s.val}</div>
            <div className="text-[10px] text-gray-400">{s.label}</div>
          </div>
        ))}
      </div>

      {/* Feature cards */}
      <div className="space-y-3">
        {FEATURES.map(f => (
          <div key={f.path}
            className="card !p-0 overflow-hidden cursor-pointer hover:shadow-lg transition-all hover:-translate-y-0.5"
            onClick={() => navigate(f.path)}>
            <div className="p-4" style={{ background:f.bg, borderBottom:`1px solid ${f.border}30` }}>
              <div className="flex items-start justify-between mb-2">
                <div className="flex items-center gap-3">
                  <div className="w-11 h-11 rounded-xl flex items-center justify-center text-2xl shrink-0"
                    style={{ background:`${f.color}25` }}>
                    {f.emoji}
                  </div>
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <h2 className="text-base font-black text-white">{f.title}</h2>
                      <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full text-white"
                        style={{ background:`${f.color}60` }}>{f.badge}</span>
                    </div>
                    <p className="text-xs font-medium" style={{ color:f.color }}>{f.subtitle}</p>
                  </div>
                </div>
                <ChevronRight size={16} className="text-gray-600 mt-1 shrink-0"/>
              </div>
              <p className="text-xs text-gray-400 leading-relaxed">{f.desc}</p>
            </div>
            <div className="px-4 py-2.5 bg-gray-900 flex gap-2 flex-wrap">
              {f.tags.map(t=>(
                <span key={t} className="text-[10px] text-gray-400 bg-gray-800 px-2 py-0.5 rounded-full">{t}</span>
              ))}
            </div>
          </div>
        ))}
      </div>

      {/* Competitor comparison */}
      <div className="card !p-4">
        <p className="text-sm font-bold text-gray-800 mb-3">Why this makes VitalOS unique</p>
        <div className="space-y-2">
          {[
            { feature:'Digital Twin health simulation', us:true, others:false },
            { feature:'Biological age from Indian labs', us:true, others:false },
            { feature:'Personalized Indian meal plans from blood markers', us:true, others:false },
            { feature:'WHOOP-style recovery score (free)', us:true, others:'₹12,000/yr' },
            { feature:'Health memory with AI narrative', us:true, others:false },
            { feature:'Sleep debt + circadian tracking', us:true, others:'Partial' },
          ].map(row=>(
            <div key={row.feature} className="flex items-center gap-3 text-xs">
              <span className="flex-1 text-gray-600">{row.feature}</span>
              <span className="text-[10px] font-bold text-teal-600 bg-teal-50 px-2 py-0.5 rounded whitespace-nowrap">✓ VitalOS</span>
              <span className={`text-[10px] font-bold px-2 py-0.5 rounded whitespace-nowrap ${row.others===false?'text-red-500 bg-red-50':'text-amber-600 bg-amber-50'}`}>
                {row.others===false?'✗ Competitors don\'t have':row.others}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
