import { NavLink, useNavigate } from 'react-router-dom'
import {
  LayoutDashboard, Activity, Brain, TrendingUp, Stethoscope,
  Users, FlaskConical, CreditCard, LogOut, Heart,
  Settings, UserCog, Zap, Clock, Flame, Dna, Wind, Leaf, User,
  Battery, Utensils, Moon, Cpu
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

// All advanced + intelligence features — all under ₹5K/mo
const NAV_ADVANCED = [
  // Original 4 advanced
  { to:'/advanced/genetic', icon:Dna,      label:'Genetic Risk',    color:'#8b5cf6' },
  { to:'/advanced/stress',  icon:Brain,    label:'Stress Score',    color:'#6d28d9' },
  { to:'/advanced/vo2max',  icon:Wind,     label:'VO2 Max',         color:'#3b82f6' },
  { to:'/advanced/gut',     icon:Leaf,     label:'Gut Health',      color:'#10b981' },
  // 6 new intelligence engines
  { to:'/intelligence/recovery',        icon:Battery,  label:'Recovery Score',  color:'#3b82f6', badge:'NEW' },
  { to:'/intelligence/biological-age',  icon:Dna,      label:'Biological Age',  color:'#6366f1', badge:'NEW' },
  { to:'/intelligence/nutrition',       icon:Utensils, label:'Nutrition AI',    color:'#22c55e', badge:'NEW' },
  { to:'/intelligence/sleep',           icon:Moon,     label:'Sleep Intel',     color:'#8b5cf6', badge:'NEW' },
  { to:'/intelligence/memory',          icon:Brain,    label:'Health Memory',   color:'#64748b', badge:'NEW' },
  { to:'/intelligence/digital-twin',    icon:Cpu,      label:'Digital Twin',    color:'#06b6d4', badge:'🚀'  },
]

const TIPS = [
  'Drink 8 glasses of water to support kidney health.',
  'Walk 8,000 steps daily — reduces diabetes risk by 22%.',
  '15 min sunlight daily boosts Vitamin D naturally.',
  'Sleep 7–9 hours for optimal heart health.',
  'Deep breathing 5 min/day lowers cortisol.',
  'Eat a handful of walnuts daily to improve HDL cholesterol.',
  'Avoid sugary drinks — they raise HbA1c fastest.',
]

export default function Sidebar() {
  const { user, signOut } = useAuthStore()
  const navigate = useNavigate()
  const [isDoctor, setIsDoctor] = useState(false)
  const [alerts, setAlerts] = useState(0)
  const [tip] = useState(TIPS[new Date().getDay() % TIPS.length])
  const isPremium = user?.plan === 'premium'

  useEffect(() => {
    if (user?.id) { checkDoctor(); loadAlerts() }
  }, [user?.id])

  async function checkDoctor() {
    if (!user?.email) return
    const { data } = await supabase.from('doctors').select('id')
      .eq('doctor_email', user.email).maybeSingle()
    setIsDoctor(!!data)
  }

  async function loadAlerts() {
    if (!user?.id) return
    const { count } = await supabase.from('ai_insights')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', user.id).in('severity', ['critical', 'warning'])
      .gte('generated_at', new Date(Date.now() - 7 * 86400000).toISOString())
    setAlerts(count || 0)
  }

  const handleSignOut = async () => {
    await signOut()
    toast.success('Signed out')
    navigate('/login')
  }

  const initials = user?.full_name
    ? user.full_name.split(' ').map((n: string) => n[0]).join('').slice(0, 2).toUpperCase()
    : (user?.email || 'U').slice(0, 2).toUpperCase()

  const planBadge: Record<string, string> = {
    basic: 'bg-gray-100 text-gray-600',
    pro: 'bg-blue-100 text-blue-700',
    premium: 'bg-amber-100 text-amber-700',
  }

  return (
    <aside className="w-56 flex flex-col shrink-0 h-screen sticky top-0 overflow-y-auto"
      style={{ background: 'linear-gradient(180deg,#ffffff,#f0fdf8)', borderRight: '1px solid #d1fae5' }}>

      {/* Logo */}
      <div className="px-4 py-4 border-b border-emerald-100 shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl flex items-center justify-center shadow-sm"
            style={{ background: 'linear-gradient(135deg,#0f6e56,#1d9e75)' }}>
            <Heart size={16} className="text-white" fill="white" />
          </div>
          <div>
            <div className="text-sm font-bold text-gray-900">VitalOS</div>
            <div className="text-[10px] text-emerald-600">Health operating system</div>
          </div>
        </div>
      </div>

      {/* Main nav */}
      <nav className="flex-1 py-2 space-y-0.5">
        {NAV_MAIN.map(({ to, icon: Icon, label, badge, badgeColor }) => (
          <NavLink key={to} to={to}
            className={({ isActive }) => `sidebar-item ${isActive ? 'active' : ''}`}>
            <Icon size={15} />
            <span className="flex-1 text-sm">{label}</span>
            {badge && (
              <span className="text-[9px] px-1.5 py-0.5 rounded-full font-bold text-white shrink-0"
                style={{ background: badgeColor }}>{badge}</span>
            )}
            {to === '/insights' && alerts > 0 && (
              <span className="w-4 h-4 bg-red-500 rounded-full flex items-center justify-center text-[9px] text-white font-bold shrink-0">
                {alerts}
              </span>
            )}
          </NavLink>
        ))}

        {/* Advanced + Intelligence section */}
        <div className="px-4 pt-3 pb-1">
          <div className="flex items-center gap-2">
            <span className="text-[9px] font-bold text-gray-400 uppercase tracking-widest">Advanced</span>
            <span className="text-[8px] font-bold text-amber-600 bg-amber-50 px-1.5 py-0.5 rounded">₹5K/mo</span>
          </div>
        </div>

        {NAV_ADVANCED.map(({ to, icon: Icon, label, color, badge }) => (
          <NavLink key={to} to={to}
            className={({ isActive }) => `sidebar-item ${isActive ? 'active' : ''}`}>
            <Icon size={15} style={{ color }} />
            <span className="flex-1 text-sm">{label}</span>
            {badge ? (
              <span className="text-[9px] px-1.5 py-0.5 rounded-full font-bold shrink-0"
                style={{ background: `${color}20`, color }}>
                {badge}
              </span>
            ) : (
              !isPremium && <span className="text-[9px] text-gray-400 shrink-0">🔒</span>
            )}
          </NavLink>
        ))}
      </nav>

      {/* Daily tip */}
      <div className="mx-3 mb-2 p-3 rounded-xl border border-emerald-100 shrink-0"
        style={{ background: 'linear-gradient(135deg,#ecfdf5,#d1fae5)' }}>
        <p className="text-[10px] font-bold text-emerald-800 mb-1">💡 Daily tip</p>
        <p className="text-[10px] text-emerald-700 leading-relaxed">{tip}</p>
      </div>

      {/* User footer */}
      <div className="p-3 border-t border-emerald-100 shrink-0 space-y-2">
        <button onClick={() => navigate('/profile')}
          className="flex items-center gap-2.5 w-full hover:bg-gray-50 rounded-xl p-1.5 transition-colors">
          <div className="w-9 h-9 rounded-full flex items-center justify-center text-white text-xs font-bold shrink-0"
            style={{ background: 'linear-gradient(135deg,#0f6e56,#1d9e75)' }}>
            {initials}
          </div>
          <div className="min-w-0 text-left flex-1">
            <div className="text-xs font-semibold text-gray-900 truncate">
              {user?.full_name || user?.email?.split('@')[0] || 'User'}
            </div>
            <span className={`text-[10px] px-1.5 py-0.5 rounded font-semibold capitalize ${planBadge[user?.plan || 'basic']}`}>
              {user?.plan || 'basic'} plan
            </span>
          </div>
          <User size={12} className="text-gray-300 shrink-0" />
        </button>

        <div className="flex gap-1.5 flex-wrap">
          <button
            onClick={() => navigate(isDoctor ? '/doctor' : '/doctor/login')}
            className="flex items-center gap-1 text-[11px] font-semibold py-1.5 px-2.5 rounded-lg transition-colors"
            style={isDoctor
              ? { background: '#ecfdf5', color: '#0f6e56', border: '1px solid #a7f3d0' }
              : { background: '#eff6ff', color: '#2563eb', border: '1px solid #bfdbfe' }}>
            {isDoctor ? <UserCog size={11} /> : <Stethoscope size={11} />}
            {isDoctor ? 'Doctor panel' : 'Doctor login'}
          </button>
          <button onClick={() => navigate('/admin')}
            className="flex items-center gap-1 text-[11px] text-gray-500 hover:text-gray-800 py-1.5 px-2 rounded-lg hover:bg-gray-100 transition-colors">
            <Settings size={11} /> Admin
          </button>
          <button onClick={handleSignOut}
            className="flex items-center gap-1 text-[11px] text-gray-400 hover:text-red-500 py-1.5 px-2 rounded-lg hover:bg-red-50 transition-colors ml-auto">
            <LogOut size={11} /> Out
          </button>
        </div>
      </div>
    </aside>
  )
}
