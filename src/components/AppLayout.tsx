import { Outlet, useLocation, useNavigate } from 'react-router-dom'
import { useState, useEffect } from 'react'
import Sidebar from './Sidebar'
import AIChat from './AIChat'
import { LayoutDashboard, Zap, Stethoscope, Brain, Menu, Flame } from 'lucide-react'

const BOTTOM_NAV = [
  { to: '/dashboard', icon: LayoutDashboard, label: 'Home'    },
  { to: '/longevity',  icon: Zap,            label: 'Score'   },
  { to: '/habits',     icon: Flame,          label: 'Habits'  },
  { to: '/insights',   icon: Brain,          label: 'AI'      },
  { to: '/doctors',    icon: Stethoscope,    label: 'Doctors' },
]

export default function AppLayout() {
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [isMobile, setIsMobile] = useState(false)
  const location = useLocation()
  const navigate = useNavigate()

  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 768)
    check()
    window.addEventListener('resize', check)
    return () => window.removeEventListener('resize', check)
  }, [])

  useEffect(() => { setSidebarOpen(false) }, [location.pathname])

  return (
    <div className="flex h-screen overflow-hidden bg-gray-50">
      {!isMobile && <Sidebar />}

      {isMobile && sidebarOpen && (
        <>
          <div className="fixed inset-0 bg-black/50 z-40" onClick={() => setSidebarOpen(false)} />
          <div className="fixed left-0 top-0 h-full z-50 w-64 shadow-2xl">
            <Sidebar />
          </div>
        </>
      )}

      <main className={`flex-1 overflow-y-auto ${isMobile ? 'pb-20' : ''}`}>
        {isMobile && (
          <div className="sticky top-0 z-30 flex items-center justify-between px-4 py-3 border-b border-emerald-100 bg-white">
            <button onClick={() => navigate('/dashboard')}
              className="flex items-center gap-2.5 active:opacity-70 transition-opacity">
              <div className="w-8 h-8 rounded-xl flex items-center justify-center"
                style={{ background: 'linear-gradient(135deg,#0f6e56,#1d9e75)' }}>
                <span className="text-white text-xs font-bold">❤</span>
              </div>
              <div className="text-left">
                <p className="text-sm font-bold text-gray-900">VitalOS</p>
                <p className="text-[10px] text-emerald-600">Health operating system</p>
              </div>
            </button>
            <button onClick={() => setSidebarOpen(true)}
              className="w-9 h-9 rounded-xl bg-gray-100 flex items-center justify-center">
              <Menu size={18} className="text-gray-600" />
            </button>
          </div>
        )}
        <Outlet />
      </main>

      {isMobile && (
        <nav className="fixed bottom-0 left-0 right-0 z-30 bg-white border-t border-gray-100"
          style={{ boxShadow: '0 -4px 20px rgba(0,0,0,0.08)', paddingBottom: 'env(safe-area-inset-bottom)' }}>
          <div className="flex items-center justify-around px-1 py-2">
            {BOTTOM_NAV.map(({ to, icon: Icon, label }) => {
              const active = location.pathname.startsWith(to) && (to !== '/dashboard' || location.pathname === '/dashboard')
              return (
                <button key={to} onClick={() => navigate(to)}
                  className="flex flex-col items-center gap-0.5 px-3 py-1.5 rounded-xl transition-all min-w-[56px]"
                  style={active ? { background:'linear-gradient(135deg,#ecfdf5,#d1fae5)' } : {}}>
                  <Icon size={21} className={active ? 'text-teal-600' : 'text-gray-400'} />
                  <span className={`text-[10px] font-semibold ${active ? 'text-teal-700' : 'text-gray-400'}`}>{label}</span>
                </button>
              )
            })}
          </div>
        </nav>
      )}

      <AIChat />
    </div>
  )
}
