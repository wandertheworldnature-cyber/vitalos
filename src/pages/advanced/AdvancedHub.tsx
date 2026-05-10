import { useNavigate } from 'react-router-dom'
import { Dna, Brain, Wind, Leaf, Lock, ChevronRight, Zap } from 'lucide-react'
import { useAuthStore } from '@/store/authStore'

const FEATURES = [
  {
    path: '/advanced/genetic',
    icon: Dna,
    emoji: '🧬',
    title: 'Genetic Risk Engine',
    subtitle: 'Your future health blueprint',
    desc: 'Upload DNA reports (23andMe, AncestryDNA). AI maps genetic predispositions for diabetes, heart disease, vitamin deficiencies, and more.',
    color: '#8b5cf6',
    bg: 'linear-gradient(135deg,#0f0a1e,#1a0a2e)',
    border: '#4c1d95',
    badge: 'DNA Analysis',
    metrics: ['Diabetes risk','Heart disease risk','Obesity tendency','Vitamin deficiencies','Sleep patterns'],
  },
  {
    path: '/advanced/stress',
    icon: Brain,
    emoji: '🧠',
    title: 'Stress Score Engine',
    subtitle: 'Invisible health damage detector',
    desc: 'Daily stress monitoring via sleep, HRV, mood, and activity. Detects burnout risk before it happens. India\'s most needed health feature.',
    color: '#6d28d9',
    bg: 'linear-gradient(135deg,#0f0522,#1a0a2e)',
    border: '#6d28d9',
    badge: 'Mental Health',
    metrics: ['Stress score /100','Burnout risk','HRV analysis','Cortisol patterns','Recovery quality'],
  },
  {
    path: '/advanced/vo2max',
    icon: Wind,
    emoji: '💨',
    title: 'VO2 Max Engine',
    subtitle: 'Your cardio longevity indicator',
    desc: 'VO2 Max is the strongest single predictor of longevity. Higher VO2 = lower mortality. Estimate via Rockport Walk Test or wearable data.',
    color: '#3b82f6',
    bg: 'linear-gradient(135deg,#0a1628,#0d2040)',
    border: '#1e40af',
    badge: 'Fitness Age',
    metrics: ['VO2 Max score','Fitness age','Cardio percentile','Longevity impact','Improvement plan'],
  },
  {
    path: '/advanced/gut',
    icon: Leaf,
    emoji: '🌿',
    title: 'Gut Health Engine',
    subtitle: 'The hidden foundation of health',
    desc: 'Gut health affects immunity, mood, weight, skin, and energy. India-specific: fiber, fermented foods (curd, idli), microbiome diversity analysis.',
    color: '#10b981',
    bg: 'linear-gradient(135deg,#051a10,#0a2818)',
    border: '#166534',
    badge: 'Microbiome',
    metrics: ['Gut health score','Microbiome diversity','Inflammation level','Indian food guide','Supplement plan'],
  },
]

export default function AdvancedHub() {
  const navigate = useNavigate()
  const { user } = useAuthStore()
  const isPremium = user?.plan === 'premium'

  return (
    <div className="p-4 pb-8 max-w-2xl mx-auto space-y-5">
      {/* Header */}
      <div className="text-center pt-2">
        <div className="inline-flex items-center gap-2 bg-gradient-to-r from-purple-900/50 to-blue-900/50 border border-purple-700/50 px-4 py-2 rounded-full mb-3">
          <Zap size={14} className="text-yellow-400"/>
          <span className="text-xs font-bold text-yellow-300">ADVANCED FEATURES — ₹5,000/mo · ₹50,000/yr</span>
        </div>
        <h1 className="text-xl font-black text-gray-900 mb-2">VitalOS Advanced</h1>
        <p className="text-sm text-gray-500 leading-relaxed max-w-sm mx-auto">
          Move beyond health monitoring into <strong>human longevity optimization</strong>. 4 premium engines that competitors don't have.
        </p>
      </div>

      {/* Plan lock banner for non-premium */}
      {!isPremium && (
        <div className="card !p-4 border-amber-200" style={{ background:'linear-gradient(135deg,#fefce8,#fef9c3)' }}>
          <div className="flex items-start gap-3">
            <Lock size={18} className="text-amber-600 mt-0.5 shrink-0"/>
            <div>
              <p className="text-sm font-bold text-amber-800 mb-1">Premium plan required</p>
              <p className="text-xs text-amber-700 leading-relaxed mb-2">
                These 4 advanced features are available on the VitalOS Advanced plan at ₹5,000/month or ₹50,000/year. Includes all Pro features plus genetic analysis, stress tracking, VO2 Max, and gut health.
              </p>
              <button onClick={() => navigate('/subscription')}
                className="text-xs font-bold text-amber-800 bg-amber-200 hover:bg-amber-300 px-3 py-1.5 rounded-lg transition-colors">
                Upgrade to Advanced →
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Feature cards */}
      <div className="space-y-3">
        {FEATURES.map(f => (
          <div key={f.path}
            className="card !p-0 overflow-hidden cursor-pointer hover:shadow-lg transition-all hover:-translate-y-0.5"
            onClick={() => navigate(f.path)}>
            <div className="p-5" style={{ background:f.bg, borderBottom:`1px solid ${f.border}30` }}>
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-3">
                  <div className="w-11 h-11 rounded-xl flex items-center justify-center text-2xl"
                    style={{ background:`${f.color}25` }}>
                    {f.emoji}
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h2 className="text-base font-black text-white">{f.title}</h2>
                      {!isPremium && <Lock size={12} className="text-gray-500"/>}
                    </div>
                    <p className="text-xs font-medium" style={{ color:f.color }}>{f.subtitle}</p>
                  </div>
                </div>
                <ChevronRight size={18} className="text-gray-600 mt-1 shrink-0"/>
              </div>
              <p className="text-xs text-gray-400 leading-relaxed">{f.desc}</p>
            </div>
            <div className="px-5 py-3 bg-gray-900 flex items-center gap-2 flex-wrap">
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full text-white" style={{ background:f.color }}>{f.badge}</span>
              {f.metrics.map(m => (
                <span key={m} className="text-[10px] text-gray-400 bg-gray-800 px-2 py-0.5 rounded-full">{m}</span>
              ))}
            </div>
          </div>
        ))}
      </div>

      {/* Comparison */}
      <div className="card !p-4">
        <p className="text-sm font-bold text-gray-800 mb-3">What competitors are missing</p>
        <div className="space-y-2">
          {[
            { feature:'Genetic risk from DNA reports', us:true,  comp:false },
            { feature:'Stress score with burnout detection', us:true,  comp:false },
            { feature:'VO2 Max & fitness age', us:true,  comp:'Wearable only' },
            { feature:'Gut health + Indian food guide', us:true,  comp:false },
            { feature:'AI predicts disease before symptoms', us:true,  comp:false },
            { feature:'Family caregiver mode', us:true,  comp:false },
          ].map(row => (
            <div key={row.feature} className="flex items-center gap-3 text-xs">
              <span className="flex-1 text-gray-600">{row.feature}</span>
              <span className="text-[10px] font-bold text-teal-600 bg-teal-50 px-2 py-0.5 rounded whitespace-nowrap">✓ VitalOS</span>
              <span className={`text-[10px] font-bold px-2 py-0.5 rounded whitespace-nowrap ${row.comp===false?'text-red-500 bg-red-50':'text-amber-600 bg-amber-50'}`}>
                {row.comp===false?'✗ Missing':row.comp}
              </span>
            </div>
          ))}
        </div>
      </div>

      {!isPremium && (
        <button onClick={() => navigate('/subscription')}
          className="btn-primary w-full py-3 text-sm flex items-center justify-center gap-2">
          <Zap size={16}/> Upgrade to Advanced — ₹5,000/mo
        </button>
      )}
    </div>
  )
}
