import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { TrendingUp, Users, FileText, IndianRupee } from 'lucide-react'

export default function AdminAnalytics() {
  const [data, setData] = useState({
    planBreakdown: { basic: 0, pro: 0, premium: 0 },
    mrr: 0, reportsByDay: [] as { date: string; count: number }[],
    topTests: [] as { test_name: string; count: number }[],
  })

  useEffect(() => { load() }, [])

  async function load() {
    const [profiles, reports, tests] = await Promise.all([
      supabase.from('profiles').select('plan'),
      supabase.from('health_reports').select('created_at').order('created_at', { ascending: false }).limit(30),
      supabase.from('health_records').select('test_name'),
    ])

    const planBreakdown = { basic: 0, pro: 0, premium: 0 }
    ;(profiles.data || []).forEach((p: { plan: string }) => {
      if (p.plan in planBreakdown) planBreakdown[p.plan as keyof typeof planBreakdown]++
    })

    const mrr = planBreakdown.pro * 999 + planBreakdown.premium * 1999

    // Group reports by date
    const byDay: Record<string, number> = {}
    ;(reports.data || []).forEach((r: { created_at: string }) => {
      const d = r.created_at.split('T')[0]
      byDay[d] = (byDay[d] || 0) + 1
    })
    const reportsByDay = Object.entries(byDay).slice(-7).map(([date, count]) => ({ date, count }))

    // Top tests
    const testCount: Record<string, number> = {}
    ;(tests.data || []).forEach((r: { test_name: string }) => {
      testCount[r.test_name] = (testCount[r.test_name] || 0) + 1
    })
    const topTests = Object.entries(testCount)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 8)
      .map(([test_name, count]) => ({ test_name, count }))

    setData({ planBreakdown, mrr, reportsByDay, topTests })
  }

  const total = data.planBreakdown.basic + data.planBreakdown.pro + data.planBreakdown.premium

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-white">Analytics</h1>
        <p className="text-sm text-gray-400">Platform-wide metrics</p>
      </div>

      {/* MRR */}
      <div className="grid grid-cols-3 gap-4">
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
          <div className="flex items-center gap-2 mb-2">
            <IndianRupee size={14} className="text-teal-400" />
            <p className="text-xs text-gray-400">Monthly Revenue (MRR)</p>
          </div>
          <p className="text-3xl font-bold text-teal-400">₹{data.mrr.toLocaleString('en-IN')}</p>
          <p className="text-xs text-gray-500 mt-1">Pro × 999 + Premium × 1999</p>
        </div>
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
          <div className="flex items-center gap-2 mb-2">
            <Users size={14} className="text-blue-400" />
            <p className="text-xs text-gray-400">Paid users</p>
          </div>
          <p className="text-3xl font-bold text-blue-400">{data.planBreakdown.pro + data.planBreakdown.premium}</p>
          <p className="text-xs text-gray-500 mt-1">of {total} total</p>
        </div>
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
          <div className="flex items-center gap-2 mb-2">
            <TrendingUp size={14} className="text-purple-400" />
            <p className="text-xs text-gray-400">Conversion rate</p>
          </div>
          <p className="text-3xl font-bold text-purple-400">
            {total > 0 ? Math.round(((data.planBreakdown.pro + data.planBreakdown.premium) / total) * 100) : 0}%
          </p>
          <p className="text-xs text-gray-500 mt-1">Free → paid</p>
        </div>
      </div>

      {/* Plan breakdown */}
      <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
        <h2 className="text-sm font-semibold text-white mb-4">Plan breakdown</h2>
        <div className="space-y-3">
          {[
            { plan: 'Basic', count: data.planBreakdown.basic, color: 'bg-gray-600' },
            { plan: 'Pro', count: data.planBreakdown.pro, color: 'bg-blue-500' },
            { plan: 'Premium', count: data.planBreakdown.premium, color: 'bg-amber-500' },
          ].map(p => (
            <div key={p.plan}>
              <div className="flex items-center justify-between text-xs mb-1">
                <span className="text-gray-300">{p.plan}</span>
                <span className="text-gray-400">{p.count} users</span>
              </div>
              <div className="h-2 bg-gray-800 rounded-full overflow-hidden">
                <div className={`h-full ${p.color} rounded-full transition-all`}
                  style={{ width: total > 0 ? `${(p.count / total) * 100}%` : '0%' }} />
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Top tests tracked */}
      <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
        <h2 className="text-sm font-semibold text-white mb-4">Most tracked tests</h2>
        <div className="space-y-2">
          {data.topTests.length === 0 && <p className="text-xs text-gray-500">No health records yet</p>}
          {data.topTests.map((t, i) => (
            <div key={t.test_name} className="flex items-center gap-3">
              <span className="text-xs text-gray-600 w-5">{i + 1}</span>
              <div className="flex-1">
                <div className="flex items-center justify-between text-xs mb-0.5">
                  <span className="text-gray-300">{t.test_name}</span>
                  <span className="text-gray-500">{t.count}</span>
                </div>
                <div className="h-1.5 bg-gray-800 rounded-full overflow-hidden">
                  <div className="h-full bg-teal-600 rounded-full"
                    style={{ width: `${(t.count / (data.topTests[0]?.count || 1)) * 100}%` }} />
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
