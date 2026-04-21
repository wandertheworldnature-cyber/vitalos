import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { Users, FileText, CalendarDays, TrendingUp, Activity, AlertCircle } from 'lucide-react'

interface Stats {
  totalUsers: number
  proUsers: number
  totalReports: number
  totalAppointments: number
  todaySignups: number
  failedReports: number
}

export default function AdminOverview() {
  const [stats, setStats] = useState<Stats>({
    totalUsers: 0, proUsers: 0, totalReports: 0,
    totalAppointments: 0, todaySignups: 0, failedReports: 0
  })
  const [recentUsers, setRecentUsers] = useState<Array<{ email: string; plan: string; created_at: string }>>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => { loadStats() }, [])

  async function loadStats() {
    const [users, proUsers, reports, appointments, failedReports] = await Promise.all([
      supabase.from('profiles').select('id', { count: 'exact', head: true }),
      supabase.from('profiles').select('id', { count: 'exact', head: true }).neq('plan', 'basic'),
      supabase.from('health_reports').select('id', { count: 'exact', head: true }),
      supabase.from('appointments').select('id', { count: 'exact', head: true }),
      supabase.from('health_reports').select('id', { count: 'exact', head: true }).eq('ocr_status', 'failed'),
    ])

    const today = new Date().toISOString().split('T')[0]
    const { count: todayCount } = await supabase
      .from('profiles').select('id', { count: 'exact', head: true })
      .gte('created_at', today)

    setStats({
      totalUsers: users.count || 0,
      proUsers: proUsers.count || 0,
      totalReports: reports.count || 0,
      totalAppointments: appointments.count || 0,
      todaySignups: todayCount || 0,
      failedReports: failedReports.count || 0,
    })

    const { data: recent } = await supabase
      .from('profiles')
      .select('email, plan, created_at')
      .order('created_at', { ascending: false })
      .limit(8)
    setRecentUsers(recent || [])
    setLoading(false)
  }

  const cards = [
    { label: 'Total users', value: stats.totalUsers, icon: Users, color: 'text-blue-400', bg: 'bg-blue-900/30' },
    { label: 'Paid users', value: stats.proUsers, icon: TrendingUp, color: 'text-teal-400', bg: 'bg-teal-900/30' },
    { label: 'Reports uploaded', value: stats.totalReports, icon: FileText, color: 'text-purple-400', bg: 'bg-purple-900/30' },
    { label: 'Appointments', value: stats.totalAppointments, icon: CalendarDays, color: 'text-amber-400', bg: 'bg-amber-900/30' },
    { label: 'Signups today', value: stats.todaySignups, icon: Activity, color: 'text-green-400', bg: 'bg-green-900/30' },
    { label: 'Failed OCR', value: stats.failedReports, icon: AlertCircle, color: 'text-red-400', bg: 'bg-red-900/30' },
  ]

  const planBadge: Record<string, string> = {
    basic: 'bg-gray-700 text-gray-300',
    pro: 'bg-blue-900 text-blue-300',
    premium: 'bg-amber-900 text-amber-300',
  }

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-white">Admin overview</h1>
        <p className="text-sm text-gray-400 mt-0.5">VitalOS platform health at a glance</p>
      </div>

      {loading ? (
        <div className="text-gray-500 text-sm">Loading stats...</div>
      ) : (
        <>
          <div className="grid grid-cols-3 gap-4">
            {cards.map(c => (
              <div key={c.label} className={`rounded-xl border border-gray-800 p-4 ${c.bg}`}>
                <div className="flex items-center justify-between mb-2">
                  <p className="text-xs text-gray-400">{c.label}</p>
                  <c.icon size={15} className={c.color} />
                </div>
                <p className={`text-3xl font-bold ${c.color}`}>{c.value}</p>
              </div>
            ))}
          </div>

          <div className="bg-gray-900 rounded-xl border border-gray-800 p-5">
            <h2 className="text-sm font-semibold text-white mb-4">Recent signups</h2>
            <div className="space-y-2">
              {recentUsers.length === 0 && (
                <p className="text-sm text-gray-500">No users yet</p>
              )}
              {recentUsers.map((u, i) => (
                <div key={i} className="flex items-center justify-between py-2 border-b border-gray-800 last:border-0">
                  <div>
                    <p className="text-sm text-gray-200">{u.email}</p>
                    <p className="text-xs text-gray-500">
                      {new Date(u.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                    </p>
                  </div>
                  <span className={`text-xs px-2 py-0.5 rounded font-medium capitalize ${planBadge[u.plan] || planBadge.basic}`}>
                    {u.plan}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  )
}
