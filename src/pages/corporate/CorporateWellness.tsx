import { useState } from 'react'
import { Building2, CheckCircle } from 'lucide-react'

const METRICS = [
  { label:'Employees tracked', value:'2,847', change:'+12%', color:'#3b82f6' },
  { label:'Avg health score',  value:'71/100', change:'+8pts',color:'#10b981' },
  { label:'Burnout risk',      value:'18%',   change:'-6%',  color:'#f59e0b' },
  { label:'Sick days saved',   value:'4.2/yr', change:'-32%',color:'#8b5cf6' },
]

const PLANS = [
  { name:'Starter',    price:'₹199',  per:'per employee/mo', color:'#6b7280',
    features:['Up to 50 employees','Basic dashboard','Monthly reports','Email support'] },
  { name:'Growth',     price:'₹399',  per:'per employee/mo', color:'#3b82f6', popular:true,
    features:['Up to 500 employees','Burnout analytics','Dept dashboards','Weekly insights','Dedicated support'] },
  { name:'Enterprise', price:'Custom', per:'contact sales',   color:'#8b5cf6',
    features:['Unlimited employees','AI health coach','Custom integrations','On-site health camps','SLA guarantee'] },
]

export default function CorporateWellness() {
  const [tab, setTab] = useState<'overview'|'analytics'|'pricing'>('overview')

  return (
    <div className="p-4 pb-8 max-w-2xl mx-auto space-y-4">
      <div className="card !p-5" style={{background:'linear-gradient(135deg,#0a1628,#1e293b)',borderColor:'#334155'}}>
        <div className="flex items-start gap-3">
          <div className="w-12 h-12 rounded-xl flex items-center justify-center shrink-0" style={{background:'rgba(59,130,246,0.2)'}}>
            <Building2 size={24} className="text-blue-400"/>
          </div>
          <div>
            <div className="flex items-center gap-2 mb-1">
              <h1 className="text-lg font-bold text-white">Corporate Wellness</h1>
              <span className="text-[10px] bg-blue-900 text-blue-300 border border-blue-700 px-2 py-0.5 rounded-full font-bold">B2B</span>
            </div>
            <p className="text-sm text-slate-300">Employee health tracking · Burnout analytics · Preventive care dashboards.</p>
          </div>
        </div>
        <div className="mt-3 bg-amber-900/30 border border-amber-700/50 rounded-lg p-2.5">
          <p className="text-[11px] text-amber-300">📊 Demo — TechCorp India, 2,847 employees</p>
        </div>
      </div>

      <div className="flex gap-1 bg-gray-100 rounded-xl p-1">
        {(['overview','analytics','pricing'] as const).map(t=>(
          <button key={t} onClick={()=>setTab(t)}
            className={`flex-1 text-xs py-2 rounded-lg font-semibold capitalize ${tab===t?'bg-white shadow-sm text-gray-900':'text-gray-500'}`}>
            {t==='overview'?'📊 Overview':t==='analytics'?'🧠 Analytics':'💰 Pricing'}
          </button>
        ))}
      </div>

      {tab==='overview' && (
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            {METRICS.map(m=>(
              <div key={m.label} className="card !p-4">
                <p className="text-2xl font-black" style={{color:m.color}}>{m.value}</p>
                <p className="text-xs text-gray-600 mt-0.5">{m.label}</p>
                <p className="text-[10px] font-bold mt-1" style={{color:m.color}}>{m.change} this quarter</p>
              </div>
            ))}
          </div>
          <div className="card !p-4" style={{background:'linear-gradient(135deg,#f0fdf8,#ecfdf5)',borderColor:'#a7f3d0'}}>
            <p className="text-sm font-bold text-emerald-800 mb-2">💰 ROI for your company</p>
            {[['Sick days reduction','32% fewer absences'],['Insurance savings','₹18,000/employee/yr'],['Productivity','23% increase'],['Burnout detection','Before it costs ₹5L to replace']].map(([l,v])=>(
              <div key={l} className="flex justify-between text-xs py-1">
                <span className="text-gray-600">{l}</span>
                <span className="font-bold text-emerald-700">{v}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {tab==='analytics' && (
        <div className="space-y-3">
          {[{team:'Engineering A',risk:82,reason:'High overtime + low sleep + rising stress',action:'Immediate intervention — 1:1 with manager'},
            {team:'Sales East',risk:61,reason:'High travel + irregular meals + low exercise',action:'Wellness program enrollment recommended'},
            {team:'Customer Support',risk:45,reason:'Repetitive tasks + moderate stress',action:'Job rotation and skill development'}].map(b=>(
            <div key={b.team} className={`card !p-4 ${b.risk>70?'bg-red-50 border-red-100':b.risk>50?'bg-amber-50 border-amber-100':'bg-emerald-50 border-emerald-100'}`}>
              <div className="flex items-center justify-between mb-1">
                <p className="text-sm font-bold text-gray-900">{b.team}</p>
                <span className="text-lg font-black" style={{color:b.risk>70?'#ef4444':b.risk>50?'#f59e0b':'#10b981'}}>{b.risk}%</span>
              </div>
              <p className="text-xs text-gray-500 mb-1">📌 {b.reason}</p>
              <p className="text-xs font-semibold text-teal-700">→ {b.action}</p>
            </div>
          ))}
        </div>
      )}

      {tab==='pricing' && (
        <div className="space-y-3">
          {PLANS.map(p=>(
            <div key={p.name} className={`card !p-5 ${p.popular?'border-2':''}`} style={p.popular?{borderColor:p.color}:{}}>
              {p.popular&&<div className="text-[10px] font-bold mb-2" style={{color:p.color}}>⭐ MOST POPULAR</div>}
              <div className="flex items-baseline gap-1 mb-1">
                <span className="text-3xl font-black" style={{color:p.color}}>{p.price}</span>
                <span className="text-xs text-gray-400">{p.per}</span>
              </div>
              <p className="text-base font-bold text-gray-900 mb-3">{p.name}</p>
              <div className="space-y-1.5 mb-4">
                {p.features.map(f=>(
                  <div key={f} className="flex gap-2 text-xs text-gray-600">
                    <CheckCircle size={12} className="text-teal-500 shrink-0 mt-0.5"/>{f}
                  </div>
                ))}
              </div>
              <button className="w-full py-2.5 rounded-xl text-sm font-bold text-white" style={{background:`linear-gradient(135deg,${p.color},${p.color}cc)`}}>
                {p.name==='Enterprise'?'Contact sales →':'Get started →'}
              </button>
            </div>
          ))}
          <p className="text-xs text-gray-400 text-center">Min 10 employees · Annual billing · GST extra</p>
        </div>
      )}
    </div>
  )
}
