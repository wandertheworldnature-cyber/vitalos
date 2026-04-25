import { NavLink, Outlet, useNavigate } from 'react-router-dom'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { CalendarDays, Users, Video, BarChart3, Heart, LogOut, ArrowLeft } from 'lucide-react'

interface DoctorProfile {
  id: string
  name: string
  specialty: string
  hospital: string
  doctor_email: string
}

const navItems = [
  { to: '/doctor',              icon: BarChart3,    label: 'Overview',     exact: true },
  { to: '/doctor/appointments', icon: CalendarDays, label: 'Appointments'  },
  { to: '/doctor/patients',     icon: Users,        label: 'My Patients'   },
  { to: '/doctor/consultations',icon: Video,        label: 'Consultations' },
]

export default function DoctorLayout() {
  const navigate = useNavigate()
  const [doctor, setDoctor] = useState<DoctorProfile | null>(null)
  const [checking, setChecking] = useState(true)

  useEffect(() => { checkDoctor() }, [])

  async function checkDoctor() {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { navigate('/login'); return }

    // Check if this user's email matches a doctor record
    const { data } = await supabase
      .from('doctors')
      .select('id, name, specialty, hospital, doctor_email')
      .eq('doctor_email', user.email)
      .single()

    if (!data) {
      // Not a doctor — redirect to user app
      navigate('/dashboard')
      return
    }
    setDoctor(data as DoctorProfile)
    setChecking(false)
  }

  if (checking) {
    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center">
        <div className="text-center">
          <div className="w-8 h-8 border-2 border-t-transparent border-teal-500 rounded-full animate-spin mx-auto mb-3" />
          <p className="text-sm text-gray-400">Verifying doctor access...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="flex h-screen bg-gray-950 text-gray-100">
      {/* Sidebar */}
      <aside className="w-56 bg-gray-900 border-r border-gray-800 flex flex-col">
        <div className="p-4 border-b border-gray-800">
          <div className="flex items-center gap-2 mb-3">
            <div className="w-8 h-8 rounded-xl flex items-center justify-center"
              style={{ background: 'linear-gradient(135deg,#0f6e56,#1d9e75)' }}>
              <Heart size={14} className="text-white" fill="white" />
            </div>
            <div>
              <p className="text-xs font-bold text-white">VitalOS</p>
              <p className="text-[10px] text-teal-400">Doctor Panel</p>
            </div>
          </div>
          {doctor && (
            <div className="bg-gray-800 rounded-xl p-2.5">
              <p className="text-xs font-semibold text-white truncate">{doctor.name}</p>
              <p className="text-[10px] text-teal-400 truncate">{doctor.specialty}</p>
              {doctor.hospital && (
                <p className="text-[10px] text-gray-500 truncate mt-0.5">{doctor.hospital}</p>
              )}
            </div>
          )}
        </div>

        <nav className="flex-1 py-3 space-y-0.5">
          {navItems.map(({ to, icon: Icon, label, exact }) => (
            <NavLink key={to} to={to} end={exact}
              className={({ isActive }) =>
                `flex items-center gap-3 px-4 py-2.5 text-sm transition-colors ${
                  isActive
                    ? 'bg-teal-900/50 text-teal-400 border-r-2 border-teal-400'
                    : 'text-gray-400 hover:text-gray-200 hover:bg-gray-800'
                }`
              }>
              <Icon size={15} />
              {label}
            </NavLink>
          ))}
        </nav>

        <div className="p-4 border-t border-gray-800 space-y-2">
          <button onClick={() => navigate('/dashboard')}
            className="flex items-center gap-2 text-xs text-gray-400 hover:text-white w-full">
            <ArrowLeft size={12} /> Patient app
          </button>
          <button onClick={async () => { await supabase.auth.signOut(); navigate('/login') }}
            className="flex items-center gap-2 text-xs text-gray-400 hover:text-red-400 w-full">
            <LogOut size={12} /> Sign out
          </button>
        </div>
      </aside>

      <main className="flex-1 overflow-y-auto bg-gray-950">
        <Outlet context={{ doctor }} />
      </main>
    </div>
  )
}
