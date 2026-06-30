import { NavLink, Outlet, useNavigate } from 'react-router-dom'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import {
  LayoutDashboard, Users, Stethoscope, ShoppingBag,
  Bell, CalendarDays, BarChart3, Shield, LogOut, Heart
} from 'lucide-react'

const navItems = [
  { to: '/admin',              icon: LayoutDashboard, label: 'Overview',     exact: true },
  { to: '/admin/users',        icon: Users,           label: 'Users'         },
  { to: '/admin/doctors',      icon: Stethoscope,     label: 'Doctors'       },
  { to: '/admin/appointments', icon: CalendarDays,    label: 'Appointments'  },
  { to: '/admin/products',     icon: ShoppingBag,     label: 'Products'      },
  { to: '/admin/announcements',icon: Bell,            label: 'Announcements' },
  { to: '/admin/analytics',    icon: BarChart3,       label: 'Analytics'     },
]

export default function AdminLayout() {
  const navigate = useNavigate()
  const [adminEmail, setAdminEmail] = useState('')
  const [checking, setChecking] = useState(true)

  useEffect(() => {
    checkAdmin()
  }, [])

  async function checkAdmin() {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { navigate('/login'); return }

    const { data } = await supabase
      .from('admin_users')
      .select('email, role')
      .eq('id', user.id)
      .single()

    if (!data) {
      alert('Access denied — not an admin account')
      navigate('/dashboard')
      return
    }
    setAdminEmail(data.email)
    setChecking(false)
  }

  if (checking) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-950">
        <div className="text-center">
          <div className="w-8 h-8 border-2 border-t-transparent rounded-full animate-spin mx-auto mb-3"
            style={{ borderColor: '#1D9E75', borderTopColor: 'transparent' }} />
          <p className="text-sm text-gray-400">Verifying admin access...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="flex h-screen bg-gray-950 text-gray-100">
      {/* Sidebar */}
      <aside className="w-56 bg-gray-900 border-r border-gray-800 flex flex-col">
        <div className="p-4 border-b border-gray-800">
          <div className="flex items-center gap-2">
            <img src="/logo.jpeg" alt="VitalOS" className="w-9 h-9 rounded-xl object-cover shadow-sm"/>
            <div>
              <p className="text-sm font-semibold text-white">VitalOS</p>
              <p className="text-[10px] text-teal-400 flex items-center gap-1">
                <Shield size={8} /> Admin Panel
              </p>
            </div>
          </div>
        </div>

        <nav className="flex-1 py-3 space-y-0.5">
          {navItems.map(({ to, icon: Icon, label, exact }) => (
            <NavLink
              key={to}
              to={to}
              end={exact}
              className={({ isActive }) =>
                `flex items-center gap-3 px-4 py-2.5 text-sm transition-colors ${
                  isActive
                    ? 'bg-teal-900/50 text-teal-400 border-r-2 border-teal-400'
                    : 'text-gray-400 hover:text-gray-200 hover:bg-gray-800'
                }`
              }
            >
              <Icon size={15} />
              {label}
            </NavLink>
          ))}
        </nav>

        <div className="p-4 border-t border-gray-800">
          <p className="text-[10px] text-gray-500 mb-2 truncate">{adminEmail}</p>
          <div className="flex gap-2">
            <button
              onClick={() => navigate('/dashboard')}
              className="text-xs text-gray-400 hover:text-white flex items-center gap-1"
            >
              ← User app
            </button>
            <button
              onClick={async () => { await supabase.auth.signOut(); navigate('/login') }}
              className="text-xs text-gray-400 hover:text-red-400 flex items-center gap-1 ml-auto"
            >
              <LogOut size={11} /> Out
            </button>
          </div>
        </div>
      </aside>

      {/* Main */}
      <main className="flex-1 overflow-y-auto bg-gray-950">
        <Outlet />
      </main>
    </div>
  )
}
