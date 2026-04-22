import { useEffect, useState } from 'react'
import { TrendingUp, Info } from 'lucide-react'
import { useAuthStore } from '@/store/authStore'
import { getTrendData, getLatestMetrics } from '@/services/healthService'
import TrendChart from '@/components/TrendChart'
import { useNavigate } from 'react-router-dom'

interface TrendPoint { date: string; value: number }
interface MetricOption { key: string; unit: string; color: string; refMin?: number; refMax?: number }

const DEFAULT_METRICS: MetricOption[] = [
  { key: 'Fasting Glucose',   unit: 'mg/dL',  color: '#E24B4A', refMin: 70,  refMax: 100  },
  { key: 'LDL Cholesterol',   unit: 'mg/dL',  color: '#BA7517', refMin: 0,   refMax: 130  },
  { key: 'Hemoglobin',        unit: 'g/dL',   color: '#D85A30', refMin: 12,  refMax: 17   },
  { key: 'TSH',               unit: 'mIU/L',  color: '#1D9E75', refMin: 0.4, refMax: 4.0  },
  { key: 'Vitamin D',         unit: 'ng/mL',  color: '#7F77DD', refMin: 30,  refMax: 100  },
  { key: 'HbA1c',             unit: '%',      color: '#D4537E', refMin: 0,   refMax: 5.7  },
  { key: 'Total Cholesterol', unit: 'mg/dL',  color: '#378ADD', refMin: 0,   refMax: 200  },
  { key: 'HDL',               unit: 'mg/dL',  color: '#639922', refMin: 40,  refMax: 200  },
]

export default function TrendsPage() {
  const { user } = useAuthStore()
  const navigate = useNavigate()
  const [availableMetrics, setAvailableMetrics] = useState<MetricOption[]>([])
  const [selected, setSelected] = useState<MetricOption | null>(null)
  const [trendData, setTrendData] = useState<TrendPoint[]>([])
  const [timeRange, setTimeRange] = useState<'1y'|'2y'|'3y'>('1y')
  const [loading, setLoading] = useState(true)
  const [loadingTrend, setLoadingTrend] = useState(false)

  useEffect(() => { if (user) loadAvailable() }, [user])
  useEffect(() => { if (user && selected) loadTrend() }, [user, selected, timeRange])

  async function loadAvailable() {
    if (!user) return
    setLoading(true)
    try {
      const metrics = await getLatestMetrics(user.id)
      if (metrics.length === 0) { setLoading(false); return }

      const opts: MetricOption[] = metrics.map(m => {
        const preset = DEFAULT_METRICS.find(d =>
          d.key.toLowerCase() === m.test_name.toLowerCase() ||
          m.test_name.toLowerCase().includes(d.key.toLowerCase().split(' ')[0])
        )
        return {
          key: m.test_name,
          unit: m.unit,
          color: preset?.color || '#1D9E75',
          refMin: m.reference_min ?? preset?.refMin,
          refMax: m.reference_max ?? preset?.refMax,
        }
      })
      setAvailableMetrics(opts)
      if (opts.length > 0) setSelected(opts[0])
    } catch (e) { console.error(e) }
    finally { setLoading(false) }
  }

  async function loadTrend() {
    if (!user || !selected) return
    setLoadingTrend(true)
    try {
      const raw = await getTrendData(user.id, selected.key)
      const cutoff = new Date()
      cutoff.setFullYear(cutoff.getFullYear() - parseInt(timeRange))
      setTrendData(raw.filter(d => new Date(d.date) >= cutoff))
    } catch { setTrendData([]) }
    finally { setLoadingTrend(false) }
  }

  const latestVal  = trendData[trendData.length - 1]?.value
  const firstVal   = trendData[0]?.value
  const totalPct   = latestVal && firstVal ? ((latestVal - firstVal) / firstVal * 100).toFixed(1) : null
  const isRising   = totalPct && parseFloat(totalPct) > 0

  const isHighRisk = selected && selected.refMax != null && latestVal != null && latestVal > selected.refMax

  return (
    <div className="p-6 max-w-5xl space-y-6">
      <div className="flex items-center gap-3">
        <TrendingUp size={20} className="text-teal-500" />
        <h1 className="text-xl font-bold text-gray-900">Health trends</h1>
        <span className="text-sm text-gray-400">Longitudinal view over time</span>
      </div>

      {loading ? (
        <div className="card text-center py-12">
          <div className="w-8 h-8 border-2 border-t-transparent border-teal-400 rounded-full animate-spin mx-auto mb-3" />
          <p className="text-sm text-gray-400">Loading your health data...</p>
        </div>
      ) : availableMetrics.length === 0 ? (
        <div className="card border-dashed border-2 border-gray-200 text-center py-12">
          <TrendingUp size={32} className="text-gray-200 mx-auto mb-3" />
          <p className="text-sm font-semibold text-gray-600">No trend data yet</p>
          <p className="text-xs text-gray-400 mt-1 mb-4">
            Upload at least one lab report to see trends
          </p>
          <button onClick={() => navigate('/reports')} className="btn-primary text-xs py-2">
            Upload lab report
          </button>
        </div>
      ) : (
        <>
          {/* Metric selector */}
          <div className="grid grid-cols-4 gap-2">
            {availableMetrics.slice(0, 8).map(m => {
              const data = trendData
              const latest = selected?.key === m.key ? latestVal : undefined
              return (
                <button key={m.key} onClick={() => setSelected(m)}
                  className={`text-left p-3 rounded-xl border transition-all ${
                    selected?.key === m.key
                      ? 'border-teal-400 bg-teal-50'
                      : 'border-gray-100 bg-white hover:border-gray-200'
                  }`}>
                  <p className="text-[10px] text-gray-400 mb-1 truncate">{m.key}</p>
                  {latest != null ? (
                    <>
                      <p className="text-sm font-bold text-gray-900">{latest} <span className="text-[10px] text-gray-400">{m.unit}</span></p>
                      {totalPct && selected?.key === m.key && (
                        <p className={`text-[10px] font-semibold ${isRising && isHighRisk ? 'text-red-500' : 'text-teal-500'}`}>
                          {isRising ? '↑' : '↓'} {Math.abs(parseFloat(totalPct))}%
                        </p>
                      )}
                    </>
                  ) : (
                    <p className="text-xs text-gray-300">No data</p>
                  )}
                </button>
              )
            })}
          </div>

          {/* Main chart */}
          {selected && (
            <div className="card">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h2 className="text-sm font-bold text-gray-900">{selected.key}</h2>
                  <p className="text-xs text-gray-400">
                    {selected.refMin != null && selected.refMax != null
                      ? `Reference: ${selected.refMin}–${selected.refMax} ${selected.unit}`
                      : `Unit: ${selected.unit}`}
                    {totalPct && (
                      <span className={`ml-2 font-semibold ${isRising && isHighRisk ? 'text-red-500' : isRising ? 'text-amber-500' : 'text-teal-500'}`}>
                        {isRising ? '↑' : '↓'} {Math.abs(parseFloat(totalPct))}% over {timeRange}
                      </span>
                    )}
                  </p>
                </div>
                <div className="flex gap-1">
                  {(['1y','2y','3y'] as const).map(r => (
                    <button key={r} onClick={() => setTimeRange(r)}
                      className={`text-xs px-3 py-1 rounded-lg ${timeRange === r ? 'bg-gray-900 text-white' : 'border border-gray-200 text-gray-500 hover:bg-gray-50'}`}>
                      {r}
                    </button>
                  ))}
                </div>
              </div>

              {loadingTrend ? (
                <div className="h-60 flex items-center justify-center">
                  <div className="w-6 h-6 border-2 border-t-transparent border-teal-400 rounded-full animate-spin" />
                </div>
              ) : (
                <TrendChart data={trendData} label={selected.key} color={selected.color}
                  referenceMin={selected.refMin} referenceMax={selected.refMax}
                  unit={selected.unit} height={260} />
              )}

              {trendData.length > 0 && (
                <div className="grid grid-cols-4 gap-4 mt-4 pt-4 border-t border-gray-100">
                  {[
                    { label: 'Latest',      value: `${trendData[trendData.length-1]?.value} ${selected.unit}` },
                    { label: 'Min (period)', value: `${Math.min(...trendData.map(d=>d.value))} ${selected.unit}` },
                    { label: 'Max (period)', value: `${Math.max(...trendData.map(d=>d.value))} ${selected.unit}` },
                    { label: 'Tests logged', value: `${trendData.length}` },
                  ].map(s => (
                    <div key={s.label}>
                      <p className="text-[10px] text-gray-400">{s.label}</p>
                      <p className="text-sm font-bold text-gray-900">{s.value}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {trendData.length < 2 && (
            <div className="flex items-start gap-2 bg-blue-50 border border-blue-100 rounded-xl p-4">
              <Info size={15} className="text-blue-500 mt-0.5 shrink-0" />
              <p className="text-xs text-blue-700">
                Upload more lab reports over time to see trend lines. The more reports you upload, the more insightful your health trends become.
              </p>
            </div>
          )}
        </>
      )}
    </div>
  )
}
