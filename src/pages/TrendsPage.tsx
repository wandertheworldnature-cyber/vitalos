import { useEffect, useState } from 'react'
import { useAuthStore } from '@/store/authStore'
import { supabase } from '@/lib/supabase'
import { TrendingUp, TrendingDown, Minus, Activity } from 'lucide-react'

interface Record {
  test_name: string
  value: number
  unit: string
  reference_min: number | null
  reference_max: number | null
  recorded_at: string
}

interface MetricGroup {
  name: string
  unit: string
  refMin: number | null
  refMax: number | null
  points: Array<{ date: string; value: number }>
  latest: number
  min: number
  max: number
  trend: 'up' | 'down' | 'stable'
  trendPct: number
  status: 'good' | 'warning' | 'critical'
}

const PERIODS = [
  { label: '1y', days: 365 },
  { label: '2y', days: 730 },
  { label: '3y', days: 1095 },
]

function calcStatus(val: number, min: number | null, max: number | null): MetricGroup['status'] {
  if (min == null && max == null) return 'good'
  if ((max != null && val > max * 1.15) || (min != null && val < min * 0.85)) return 'critical'
  if ((max != null && val > max) || (min != null && val < min)) return 'warning'
  return 'good'
}

const STATUS_CONFIG = {
  good:     { color: '#10b981', bg: 'bg-emerald-50', badge: 'bg-emerald-100 text-emerald-700', label: 'Good'     },
  warning:  { color: '#f59e0b', bg: 'bg-amber-50',   badge: 'bg-amber-100 text-amber-700',    label: 'Watch'    },
  critical: { color: '#ef4444', bg: 'bg-red-50',     badge: 'bg-red-100 text-red-700',        label: 'High Risk'},
}

function LineChart({ points, refMin, refMax, color }: {
  points: Array<{ date: string; value: number }>
  refMin: number | null
  refMax: number | null
  color: string
}) {
  if (!points || points.length < 1) return null
  const W = 320, H = 120, PAD = 20
  const vals = points.map(p => p.value)
  const allVals = [...vals, ...(refMin != null ? [refMin] : []), ...(refMax != null ? [refMax] : [])]
  const minV = Math.min(...allVals) * 0.95
  const maxV = Math.max(...allVals) * 1.05
  const range = maxV - minV || 1
  const toX = (i: number) => PAD + (i / Math.max(points.length - 1, 1)) * (W - PAD * 2)
  const toY = (v: number) => H - PAD - ((v - minV) / range) * (H - PAD * 2)
  const linePath = points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${toX(i)} ${toY(p.value)}`).join(' ')
  const areaPath = `${linePath} L ${toX(points.length - 1)} ${H - PAD} L ${toX(0)} ${H - PAD} Z`

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full" style={{ height: 120 }}>
      {refMin != null && refMax != null && (
        <rect x={PAD} y={toY(refMax)} width={W - PAD * 2}
          height={Math.abs(toY(refMin) - toY(refMax))}
          fill="rgba(16,185,129,0.08)" stroke="rgba(16,185,129,0.15)" strokeWidth="1"/>
      )}
      <path d={areaPath} fill={`${color}18`}/>
      <path d={linePath} fill="none" stroke={color} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
      {points.map((p, i) => (
        <circle key={i} cx={toX(i)} cy={toY(p.value)} r="3.5" fill="#fff" stroke={color} strokeWidth="2"/>
      ))}
      {points.length > 0 && (
        <text x={toX(points.length - 1)} y={toY(points[points.length - 1].value) - 8}
          textAnchor="middle" fontSize="11" fill={color} fontWeight="700">
          {points[points.length - 1].value}
        </text>
      )}
    </svg>
  )
}

export default function TrendsPage() {
  const { user } = useAuthStore()
  const [allRecords, setAllRecords] = useState<Record[]>([])
  const [metrics, setMetrics] = useState<MetricGroup[]>([])
  const [selected, setSelected] = useState<string>('')
  const [period, setPeriod] = useState(0)
  const [loading, setLoading] = useState(true)

  // Fetch ALL records once on mount
  useEffect(() => {
    if (user) fetchAll()
  }, [user])

  // Re-group when period changes
  useEffect(() => {
    if (allRecords.length > 0) buildMetrics(allRecords)
  }, [allRecords, period])

  async function fetchAll() {
    if (!user) return
    setLoading(true)
    try {
      // Fetch ALL records — no date filter, no type filter
      const { data, error } = await supabase
        .from('health_records')
        .select('test_name, value, unit, reference_min, reference_max, recorded_at')
        .eq('user_id', user.id)
        .order('recorded_at', { ascending: true })

      if (error) { console.error('Trends error:', error); setLoading(false); return }
      console.log('Trends: total records from DB:', data?.length)
      setAllRecords((data || []) as Record[])
    } catch (e) {
      console.error('Trends fetch exception:', e)
    } finally {
      setLoading(false)
    }
  }

  function buildMetrics(records: Record[]) {
    // Apply period filter client-side
    const since = new Date()
    since.setDate(since.getDate() - PERIODS[period].days)
    let filtered = records.filter(r => new Date(r.recorded_at) >= since)

    // If period filter removes everything, show all data regardless
    if (filtered.length === 0) filtered = records

    // Group by test_name
    const groups = new Map<string, Record[]>()
    for (const r of filtered) {
      const key = r.test_name.trim()
      if (!groups.has(key)) groups.set(key, [])
      groups.get(key)!.push(r)
    }

    const result: MetricGroup[] = []
    for (const [name, recs] of groups) {
      const sorted = [...recs].sort((a, b) =>
        new Date(a.recorded_at).getTime() - new Date(b.recorded_at).getTime()
      )
      const vals = sorted.map(r => Number(r.value))
      const latest = vals[vals.length - 1]
      const first = vals[0]
      const trendPct = first !== 0 ? +((latest - first) / Math.abs(first) * 100).toFixed(1) : 0
      const trend: MetricGroup['trend'] = Math.abs(trendPct) < 2 ? 'stable' : trendPct > 0 ? 'up' : 'down'
      const refMin = sorted[sorted.length - 1].reference_min
      const refMax = sorted[sorted.length - 1].reference_max

      result.push({
        name,
        unit: sorted[0].unit || '',
        refMin,
        refMax,
        points: sorted.map(r => ({ date: r.recorded_at.split('T')[0], value: Number(r.value) })),
        latest,
        min: Math.min(...vals),
        max: Math.max(...vals),
        trend,
        trendPct: Math.abs(trendPct),
        status: calcStatus(latest, refMin, refMax),
      })
    }

    result.sort((a, b) => {
      const order = { critical: 0, warning: 1, good: 2 }
      return order[a.status] - order[b.status]
    })

    setMetrics(result)
    if (result.length > 0 && (!selected || !result.find(m => m.name === selected))) {
      setSelected(result[0].name)
    }
  }

  const active = metrics.find(m => m.name === selected)
  const cfg = active ? STATUS_CONFIG[active.status] : null

  return (
    <div className="p-4 md:p-6 max-w-5xl space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h1 className="text-xl font-bold text-gray-900 flex items-center gap-2">
            <TrendingUp size={18} className="text-teal-600"/> Health trends
          </h1>
          <p className="text-xs text-gray-400 mt-0.5">
            {allRecords.length > 0 ? `${metrics.length} metrics · ${allRecords.length} total readings` : 'Longitudinal view over time'}
          </p>
        </div>
        <div className="flex gap-1 bg-gray-100 rounded-lg p-1">
          {PERIODS.map((p, i) => (
            <button key={p.label} onClick={() => setPeriod(i)}
              className={`text-xs px-3 py-1.5 rounded-md font-semibold transition-colors ${period === i ? 'bg-white shadow-sm text-gray-900' : 'text-gray-500'}`}>
              {p.label}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
          {[1,2,3,4,5,6,7,8].map(i => <div key={i} className="h-16 bg-gray-100 rounded-xl animate-pulse"/>)}
        </div>
      ) : metrics.length === 0 ? (
        <div className="card border-dashed border-2 border-gray-200 text-center py-16">
          <Activity size={36} className="text-gray-200 mx-auto mb-3"/>
          <p className="text-sm font-semibold text-gray-600 mb-1">No health data found</p>
          <p className="text-xs text-gray-400 mb-4">Upload a lab report to see your trends</p>
          <a href="/reports" className="btn-primary text-xs py-2 inline-block">Upload report</a>
        </div>
      ) : (
        <>
          {/* Metric cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
            {metrics.map(m => {
              const c = STATUS_CONFIG[m.status]
              const isActive = selected === m.name
              return (
                <button key={m.name} onClick={() => setSelected(m.name)}
                  className={`rounded-xl p-3 text-left border transition-all ${isActive ? 'ring-2 shadow-sm' : 'hover:shadow-sm'}`}
                  style={isActive
                    ? { borderColor: c.color, background: `${c.color}08` }
                    : { borderColor: '#e5e7eb', background: '#fff' }}>
                  <p className="text-[10px] text-gray-500 truncate mb-1">{m.name}</p>
                  <p className="text-lg font-black text-gray-900 leading-tight">
                    {m.latest}
                    <span className="text-[10px] text-gray-400 font-normal ml-1">{m.unit}</span>
                  </p>
                  <div className="flex items-center gap-1 mt-1">
                    <span className={`text-[9px] px-1.5 py-0.5 rounded font-bold ${c.badge}`}>{c.label}</span>
                    {m.points.length > 1 && (
                      <span className={`text-[9px] font-semibold ${m.trend === 'up' ? 'text-red-500' : m.trend === 'down' ? 'text-emerald-600' : 'text-gray-400'}`}>
                        {m.trend === 'up' ? '↑' : m.trend === 'down' ? '↓' : '→'}{m.trendPct}%
                      </span>
                    )}
                  </div>
                </button>
              )
            })}
          </div>

          {/* Chart */}
          {active && cfg && (
            <div className="card !p-5">
              <div className="flex items-start justify-between mb-4 flex-wrap gap-2">
                <div>
                  <h2 className="text-base font-bold text-gray-900">{active.name}</h2>
                  {(active.refMin != null || active.refMax != null) && (
                    <p className="text-xs text-gray-400">
                      Reference: {active.refMin ?? '—'}–{active.refMax ?? '—'} {active.unit}
                    </p>
                  )}
                </div>
                <div className="flex gap-4">
                  {[{ label: 'Latest', val: active.latest }, { label: 'Min', val: active.min }, { label: 'Max', val: active.max }].map(s => (
                    <div key={s.label} className="text-center">
                      <div className="text-sm font-black text-gray-900">{s.val}</div>
                      <div className="text-[10px] text-gray-400">{s.label}</div>
                    </div>
                  ))}
                </div>
              </div>

              {active.points.length < 2 ? (
                <div className="py-8 text-center">
                  <div className="w-4 h-4 rounded-full mx-auto mb-3" style={{ background: cfg.color }}/>
                  <p className="text-sm font-bold text-gray-700">{active.latest} {active.unit}</p>
                  <p className="text-xs text-gray-400 mt-1">{active.points[0]?.date}</p>
                  <p className="text-xs text-gray-400 mt-3">Upload more reports to see trend line</p>
                </div>
              ) : (
                <>
                  <LineChart points={active.points} refMin={active.refMin} refMax={active.refMax} color={cfg.color}/>
                  <div className="flex justify-between mt-1">
                    <span className="text-[10px] text-gray-400">{active.points[0]?.date}</span>
                    <span className="text-[10px] text-gray-400">{active.points[active.points.length - 1]?.date}</span>
                  </div>
                </>
              )}

              <div className={`mt-4 p-3 rounded-xl flex items-center gap-3 ${cfg.bg}`}>
                {active.trend === 'up' ? <TrendingUp size={16} style={{ color: cfg.color }}/> :
                 active.trend === 'down' ? <TrendingDown size={16} style={{ color: cfg.color }}/> :
                 <Minus size={16} style={{ color: cfg.color }}/>}
                <div>
                  <p className="text-xs font-bold text-gray-700">
                    {active.trend === 'stable' ? 'Stable' :
                     active.trend === 'up' ? `↑ Rising ${active.trendPct}%` :
                     `↓ Declining ${active.trendPct}%`}
                    {' '}· {active.points.length} reading{active.points.length !== 1 ? 's' : ''}
                  </p>
                  {active.refMin != null && active.refMax != null && (
                    <p className="text-[10px] text-gray-500 mt-0.5">
                      {active.latest < active.refMin ? `Below minimum (${active.refMin} ${active.unit})` :
                       active.latest > active.refMax ? `Above maximum (${active.refMax} ${active.unit})` :
                       'Within normal range'}
                    </p>
                  )}
                </div>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}
