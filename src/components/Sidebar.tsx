import { NavLink, useNavigate } from 'react-router-dom'
import {
  LayoutDashboard, Activity, Brain, TrendingUp, Stethoscope,
  Users, FlaskConical, CreditCard, LogOut, Heart,
  Settings, UserCog, Zap, Clock, Flame, Dna, Wind, Leaf, User
} from 'lucide-react'
import { useAuthStore } from '@/store/authStore'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import toast from 'react-hot-toast'

const NAV_MAIN = [
  { to:'/dashboard',   icon:LayoutDashboard, label:'Dashboard'        },
  { to:'/longevity',   icon:Zap,             label:'Longevity Score', badge:'CORE', badgeColor:'#f59e0b' },
  { to:'/habits',      icon:Flame,           label:'Daily Habits',    badge:'NEW',  badgeColor:'#ef4444' },
  { to:'/timeline',    icon:Clock,           label:'Health Timeline', badge:'NEW',  badgeColor:'#8b5cf6' },
  { to:'/health-data', icon:Activity,        label:'Health data'      },
  { to:'/insights',    icon:Brain,           label:'AI insights'      },
  { to:'/trends',      icon:TrendingUp,      label:'Trends'           },
  { to:'/doctors',     icon:Stethoscope,     label:'Doctors'          },
  { to:'/family',      icon:Users,           label:'Family'           },
  { to:'/reports',     icon:FlaskConical,    label:'Reports'          },
  { to:'/subscription',icon:CreditCard,      label:'Subscription'     },
]

const NAV_ADVANCED = [
  { to:'/advanced/genetic',icon:Dna,   label:'Genetic Risk', color:'#8b5cf6' },
  { to:'/advanced/stress', icon:Brain, label:'Stress Score', color:'#6d28d9' },
  { to:'/advanced/vo2max', icon:Wind,  label:'VO2 Max',      color:'#3b82f6' },
  { to:'/advanced/gut',    icon:Leaf,  label:'Gut Health',   color:'#10b981' },
]

const TIPS = [
  'Drink 8 glasses of water to support kidney health.',
  'Walk 8,000 steps daily — reduces diabetes risk by 22%.',
  '15 min sunlight daily boosts Vitamin D naturally.',
  'Sleep 7–9 hours for optimal heart and metabolic health.',
  'Deep breathing 5 min/day lowers cortisol significantly.',
  'Eat walnuts daily to improve HDL cholesterol.',
  'Avoid sugar-sweetened beverages — they raise HbA1c fastest.',
]

export default function Sidebar() {
  const { user, signOut } = useAuthStore()
  const navigate = useNavigate()
  const [isDoctor, setIsDoctor] = useState(false)
  const [unreadAlerts, setUnreadAlerts] = useState(0)
  const [tip] = useState(TIPS[new Date().getDay() % TIPS.length])
  const isPremium = user?.plan === 'premium'

  useEffect(() => {
    if (user?.email) { checkDoctor(); loadAlerts() }
  }, [user?.email])

  async function checkDoctor() {
    const { data } = await supabase.from('doctors').select('id')
      .eq('doctor_email', user?.email).single()
    setIsDoctor(!!data)
  }

  async function loadAlerts() {
    if (!user) return
    const { count } = await supabase.from('ai_insights')
      .select('id', { count:'exact', head:true })
      .eq('user_id', user.id).in('severity',['critical','warning'])
      .gte('generated_at', new Date(Date.now()-7*86400000).toISOString())
    setUnreadAlerts(count || 0)
  }

  const handleSignOut = async () => { await signOut(); toast.success('Signed out'); navigate('/login') }

  const initials = user?.full_name
    ? user.full_name.split(' ').map((n:string)=>n[0]).join('').slice(0,2).toUpperCase()
    : user?.email?.slice(0,2).toUpperCase() || 'U'

  const planColors: Record<string,string> = {
    basic:'bg-gray-100 text-gray-600',
    pro:'bg-blue-100 text-blue-700',
    premium:'bg-amber-100 text-amber-700',
  }

  return (
    <aside className="w-56 flex flex-col shrink-0 h-screen sticky top-0"
      style={{ background:'linear-gradient(180deg,#ffffff 0%,#f0fdf8 100%)', borderRight:'1px solid #d1fae5' }}>

      {/* Logo */}
      <div className="px-4 py-4 border-b border-emerald-100">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl flex items-center justify-center shadow-md"
            style={{ background:'linear-gradient(135deg,#0f6e56,#1d9e75)' }}>
            <Heart size={16} className="text-white" fill="white"/>
          </div>
          <div>
            <div className="text-sm font-bold text-gray-900">VitalOS</div>
            <div className="text-[10px] text-emerald-600 font-medium">Health operating system</div>
          </div>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 py-2 overflow-y-auto space-y-0.5">
        {NAV_MAIN.map(({ to, icon:Icon, label, badge, badgeColor }) => (
          <NavLink key={to} to={to}
            className={({ isActive }) => `sidebar-item ${isActive?'active':''}`}>
            <Icon size={15}/>
            <span className="flex-1 text-sm">{label}</span>
            {badge && <span className="text-[9px] px-1.5 py-0.5 rounded-full font-bold text-white shrink-0"
              style={{ background:badgeColor }}>{badge}</span>}
            {to==='/insights' && unreadAlerts>0 && (
              <span className="w-4 h-4 bg-red-500 rounded-full flex items-center justify-center text-[9px] text-white font-bold shrink-0">
                {unreadAlerts}
              </span>
            )}
          </NavLink>
        ))}

        {/* Advanced section */}
        <div className="px-4 pt-3 pb-1">
          <div className="flex items-center gap-2">
            <span className="text-[9px] font-bold text-gray-400 uppercase tracking-widest">Advanced</span>
            <span className="text-[8px] font-bold text-amber-600 bg-amber-50 px-1.5 py-0.5 rounded">₹5K/mo</span>
          </div>
        </div>
        {NAV_ADVANCED.map(({ to, icon:Icon, label, color }) => (
          <NavLink key={to} to={to}
            className={({ isActive }) => `sidebar-item ${isActive?'active':''} ${!isPremium?'opacity-60':''}`}>
            <Icon size={15} style={{ color }}/>
            <span className="flex-1 text-sm">{label}</span>
            {!isPremium && <span className="text-[9px] text-gray-400">🔒</span>}
          </NavLink>
        ))}
      </nav>

      {/* Daily tip */}
      <div className="mx-3 mb-2 p-3 rounded-xl border border-emerald-100"
        style={{ background:'linear-gradient(135deg,#ecfdf5,#d1fae5)' }}>
        <p className="text-[10px] font-bold text-emerald-800 mb-1">💡 Daily tip</p>
        <p className="text-[10px] text-emerald-700 leading-relaxed">{tip}</p>
      </div>

      {/* User section */}
      <div className="p-3 border-t border-emerald-100">
        <button onClick={() => navigate('/profile')}
          className="flex items-center gap-2.5 w-full hover:opacity-80 transition-opacity mb-2.5">
          <div className="w-9 h-9 rounded-full flex items-center justify-center text-white text-xs font-bold shrink-0"
            style={{ background:'linear-gradient(135deg,#0f6e56,#1d9e75)' }}>
            {initials}
          </div>
          <div className="min-w-0 text-left">
            <div className="text-xs font-semibold text-gray-900 truncate">
              {user?.full_name || user?.email?.split('@')[0] || 'User'}
            </div>
            <span className={`text-[10px] px-1.5 py-0.5 rounded-md font-semibold capitalize ${planColors[user?.plan||'basic']}`}>
              {user?.plan || 'basic'} plan
            </span>
          </div>
          <User size={13} className="text-gray-300 shrink-0 ml-auto"/>
        </button>

        <div className="flex gap-1.5 flex-wrap">
          {/* Doctor login / Doctor panel */}
          {isDoctor ? (
            <button onClick={() => navigate('/doctor')}
              className="flex items-center gap-1 text-[11px] text-teal-700 bg-teal-50 hover:bg-teal-100 py-1 px-2 rounded-lg font-semibold transition-colors">
              <UserCog size={11}/> Doctor panel
            </button>
          ) : (
            <button onClick={() => navigate('/doctor/login')}
              className="flex items-center gap-1 text-[11px] text-blue-600 bg-blue-50 hover:bg-blue-100 py-1 px-2 rounded-lg font-semibold transition-colors">
              <Stethoscope size={11}/> Doctor login
            </button>
          )}

          <button onClick={() => navigate('/admin')}
            className="flex items-center gap-1 text-[11px] text-gray-400 hover:text-gray-700 py-1 px-2 rounded-lg hover:bg-gray-100 transition-colors">
            <Settings size={11}/> Admin
          </button>

          <button onClick={handleSignOut}
            className="flex items-center gap-1 text-[11px] text-gray-400 hover:text-red-500 py-1 px-2 rounded-lg hover:bg-red-50 transition-colors ml-auto">
            <LogOut size={11}/> Out
          </button>
        </div>
      </div>
    </aside>
  )
}
