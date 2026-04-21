import { NavLink, useNavigate } from 'react-router-dom'
import {
  LayoutDashboard, Activity, Brain, TrendingUp,
  Stethoscope, Users, FlaskConical, CreditCard, LogOut, Heart, Settings
} from 'lucide-react'
import { useAuthStore } from '@/store/authStore'
import toast from 'react-hot-toast'

const navItems = [
  { to: '/dashboard',    icon: LayoutDashboard, label: 'Dashboard'   },
  { to: '/health-data',  icon: Activity,        label: 'Health data'  },
  { to: '/insights',     icon: Brain,           label: 'AI insights'  },
  { to: '/trends',       icon: TrendingUp,      label: 'Trends'       },
  { to: '/doctors',      icon: Stethoscope,     label: 'Doctors'      },
  { to: '/family',       icon: Users,           label: 'Family'       },
  { to: '/reports',      icon: FlaskConical,    label: 'Reports'      },
  { to: '/subscription', icon: CreditCard,      label: 'Subscription' },
]

export default function Sidebar() {
  const { user, signOut } = useAuthStore()
  const navigate = useNavigate()

  const handleSignOut = async () => {
    await signOut()
    toast.success('Signed out')
    navigate('/login')
  }

  const initials = user?.full_name
    ? user.full_name.split(' ').map((n: string) => n[0]).join('').slice(0, 2).toUpperCase()
    : user?.email?.slice(0, 2).toUpperCase() || 'U'

  const planColors: Record<string, string> = {
    basic:   'bg-gray-100 text-gray-600',
    pro:     'bg-blue-100 text-blue-700',
    premium: 'bg-amber-100 text-amber-700',
  }

  return (
    <aside className="w-56 flex flex-col shrink-0 h-screen sticky top-0"
      style={{ background: 'linear-gradient(180deg, #ffffff 0%, #f0fdf8 100%)', borderRight: '1px solid #d1fae5' }}>

      {/* Logo */}
      <div className="px-4 py-5 border-b border-emerald-100">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl flex items-center justify-center shadow-md"
            style={{ background: 'linear-gradient(135deg, #0f6e56, #1d9e75)' }}>
            <Heart size={16} className="text-white" fill="white" />
          </div>
          <div>
            <div className="text-sm font-bold text-gray-900 tracking-wide">VitalOS</div>
            <div className="text-[10px] text-emerald-600 font-medium">Health operating system</div>
          </div>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 py-4 overflow-y-auto space-y-0.5">
        {navItems.map(({ to, icon: Icon, label }) => (
          <NavLink key={to} to={to}
            className={({ isActive }) => `sidebar-item ${isActive ? 'active' : ''}`}>
            <Icon size={16} />
            <span>{label}</span>
          </NavLink>
        ))}
      </nav>

      {/* Health tip widget */}
      <div className="mx-3 mb-3 p-3 rounded-xl border border-emerald-100"
        style={{ background: 'linear-gradient(135deg, #ecfdf5, #d1fae5)' }}>
        <p className="text-[10px] font-semibold text-emerald-800 mb-1">💡 Daily tip</p>
        <p className="text-[10px] text-emerald-700 leading-relaxed">
          Drink 8 glasses of water today to support kidney health and metabolism.
        </p>
      </div>

      {/* User */}
      <div className="p-3 border-t border-emerald-100">
        <div className="flex items-center gap-2.5 mb-2.5">
          <div className="w-9 h-9 rounded-full flex items-center justify-center text-white text-xs font-bold shadow-sm shrink-0"
            style={{ background: 'linear-gradient(135deg, #0f6e56, #1d9e75)' }}>
            {initials}
          </div>
          <div className="min-w-0">
            <div className="text-xs font-semibold text-gray-900 truncate">
              {user?.full_name || user?.email?.split('@')[0] || 'User'}
            </div>
            <span className={`text-[10px] px-1.5 py-0.5 rounded-md font-semibold capitalize ${planColors[user?.plan || 'basic']}`}>
              {user?.plan || 'basic'} plan
            </span>
          </div>
        </div>
        <div className="flex gap-1.5">
          <button onClick={handleSignOut}
            className="flex-1 flex items-center justify-center gap-1.5 text-[11px] text-gray-400 hover:text-red-500 py-1.5 rounded-lg hover:bg-red-50 transition-colors">
            <LogOut size={11} /> Sign out
          </button>
          <button onClick={() => navigate('/admin')}
            className="flex items-center justify-center gap-1 text-[11px] text-gray-400 hover:text-gray-700 py-1.5 px-2 rounded-lg hover:bg-gray-100 transition-colors">
            <Settings size={11} />
          </button>
        </div>
      </div>
    </aside>
  )
}
