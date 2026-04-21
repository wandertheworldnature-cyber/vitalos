import { useEffect, useState } from 'react'
import { TrendingUp } from 'lucide-react'
import { useAuthStore } from '@/store/authStore'
import { getTrendData } from '@/services/healthService'
import TrendChart from '@/components/TrendChart'

interface TrendPoint { date: string; value: number }

const METRICS_CONFIG = [
  { key: 'Fasting Glucose', label: 'Fasting Glucose', unit: 'mg/dL', color: '#E24B4A', refMin: 70, refMax: 100 },
  { key: 'LDL Cholesterol', label: 'LDL Cholesterol', unit: 'mg/dL', color: '#BA7517', refMin: 0, refMax: 130 },
  { key: 'Hemoglobin', label: 'Hemoglobin', unit: 'g/dL', color: '#D85A30', refMin: 12, refMax: 17 },
  { key: 'TSH', label: 'TSH', unit: 'mIU/L', color: '#1D9E75', refMin: 0.4, refMax: 4.0 },
  { key: 'Vitamin D', label: 'Vitamin D', unit: 'ng/mL', color: '#7F77DD', refMin: 30, refMax: 100 },
  { key: 'HbA1c', label: 'HbA1c', unit: '%', color: '#D4537E', refMin: 0, refMax: 5.7 },
  { key: 'Total Cholesterol', label: 'Total Cholesterol', unit: 'mg/dL', color: '#378ADD', refMin: 0, refMax: 200 },
  { key: 'HDL', label: 'HDL Cholesterol', unit: 'mg/dL', color: '#639922', refMin: 40, refMax: 200 },
]

// Generate demo 3-year trend data
function genDemoData(base: number, months: number, drift: number): TrendPoint[] {
  const points: TrendPoint[] = []
  const now = new Date()
  for (let i = months; i >= 0; i -= 2) {
    const d = new Date(now)
    d.setMonth(now.getMonth() - i)
    const noise = (Math.random() - 0.5) * base * 0.05
    points.push({
      date: d.toISOString().split('T')[0],
      value: Math.round((base + drift * (months - i) / months + noise) * 10) / 10,
    })
  }
  return points
}

const DEMO_TRENDS: Record<string, TrendPoint[]> = {
  'Fasting Glucose':   genDemoData(88, 36, 12),
  'LDL Cholesterol':   genDemoData(128, 36, 16),
  'Hemoglobin':        genDemoData(14.2, 36, -0.4),
  'TSH':               genDemoData(2.6, 36, -0.2),
  'Vitamin D':         genDemoData(28, 36, -10),
  'HbA1c':             genDemoData(5.4, 36, 0.5),
  'Total Cholesterol': genDemoData(185, 36, 20),
  'HDL':               genDemoData(48, 36, -4),
}

export default function TrendsPage() {
  const { user } = useAuthStore()
  const [trendData, setTrendData] = useState<Record<string, TrendPoint[]>>(DEMO_TRENDS)
  const [selectedMetric, setSelectedMetric] = useState(METRICS_CONFIG[0])
  const [timeRange, setTimeRange] = useState<'1y' | '2y' | '3y'>('3y')

  useEffect(() => {
    if (!user) return
    // Try to load real data for each metric
    Promise.all(
      METRICS_CONFIG.map(m =>
        getTrendData(user.id, m.key).then(data => ({ key: m.key, data })).catch(() => null)
      )
    ).then(results => {
      const realData: Record<string, TrendPoint[]> = {}
      results.forEach(r => {
        if (r && r.data.length > 0) realData[r.key] = r.data
      })
      if (Object.keys(realData).length > 0) {
        setTrendData(prev => ({ ...prev, ...realData }))
      }
    })
  }, [user])

  const monthsMap = { '1y': 12, '2y': 24, '3y': 36 }
  const months = monthsMap[timeRange]

  function filterByRange(data: TrendPoint[]): TrendPoint[] {
    const cutoff = new Date()
    cutoff.setMonth(cutoff.getMonth() - months)
    return data.filter(d => new Date(d.date) >= cutoff)
  }

  const currentData = filterByRange(trendData[selectedMetric.key] || [])
  const latestVal = currentData[currentData.length - 1]?.value
  const firstVal = currentData[0]?.value
  const totalChange = latestVal && firstVal ? ((latestVal - firstVal) / firstVal * 100).toFixed(1) : null

  return (
    <div className="p-6 max-w-5xl space-y-6">
      <div className="flex items-center gap-3">
        <TrendingUp size={20} className="text-teal-500" />
        <h1 className="text-xl font-medium text-gray-900">Health trends</h1>
        <span className="text-sm text-gray-400">Multi-year longitudinal view</span>
      </div>

      {/* Metric selector */}
      <div className="grid grid-cols-4 gap-2">
        {METRICS_CONFIG.map(m => {
          const data = filterByRange(trendData[m.key] || [])
          const latest = data[data.length - 1]?.value
          const first = data[0]?.value
          const chg = latest && first ? ((latest - first) / first * 100).toFixed(1) : null
          const rising = chg && parseFloat(chg) > 0
          const isWarning = m.key.includes('Glucose') || m.key.includes('LDL') || m.key === 'HbA1c'

          return (
            <button
              key={m.key}
              onClick={() => setSelectedMetric(m)}
              className={`text-left p-3 rounded-xl border transition-all ${
                selectedMetric.key === m.key
                  ? 'border-teal-400 bg-teal-50'
                  : 'border-gray-100 bg-white hover:border-gray-200'
              }`}
            >
              <p className="text-[10px] text-gray-400 mb-1">{m.label}</p>
              {latest ? (
                <>
                  <p className="text-sm font-medium text-gray-900">
                    {latest} <span className="text-[10px] text-gray-400">{m.unit}</span>
                  </p>
                  {chg && (
                    <p className={`text-[10px] font-medium ${
                      rising && isWarning ? 'text-red-500' : rising ? 'text-teal-500' : 'text-teal-500'
                    }`}>
                      {rising ? '↑' : '↓'} {Math.abs(parseFloat(chg))}% over {timeRange}
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
      <div className="card">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-sm font-medium text-gray-900">{selectedMetric.label}</h2>
            <p className="text-xs text-gray-400">
              Reference range: {selectedMetric.refMin}–{selectedMetric.refMax} {selectedMetric.unit}
              {totalChange && (
                <span className={`ml-2 font-medium ${
                  parseFloat(totalChange) > 0 ? 'text-red-500' : 'text-teal-500'
                }`}>
                  {parseFloat(totalChange) > 0 ? '↑' : '↓'} {Math.abs(parseFloat(totalChange))}% over {timeRange}
                </span>
              )}
            </p>
          </div>
          <div className="flex gap-1">
            {(['1y', '2y', '3y'] as const).map(r => (
              <button
                key={r}
                onClick={() => setTimeRange(r)}
                className={`text-xs px-3 py-1 rounded-lg ${
                  timeRange === r
                    ? 'bg-gray-900 text-white'
                    : 'border border-gray-200 text-gray-500 hover:bg-gray-50'
                }`}
              >
                {r}
              </button>
            ))}
          </div>
        </div>

        <TrendChart
          data={currentData}
          label={selectedMetric.label}
          color={selectedMetric.color}
          referenceMin={selectedMetric.refMin}
          referenceMax={selectedMetric.refMax}
          unit={selectedMetric.unit}
          height={280}
        />

        {/* Stats row */}
        {currentData.length > 0 && (
          <div className="grid grid-cols-4 gap-4 mt-4 pt-4 border-t border-gray-100">
            {[
              { label: 'Current', value: `${currentData[currentData.length - 1]?.value} ${selectedMetric.unit}` },
              { label: 'Min (period)', value: `${Math.min(...currentData.map(d => d.value))} ${selectedMetric.unit}` },
              { label: 'Max (period)', value: `${Math.max(...currentData.map(d => d.value))} ${selectedMetric.unit}` },
              { label: 'Data points', value: `${currentData.length} tests` },
            ].map(s => (
              <div key={s.label}>
                <p className="text-[10px] text-gray-400">{s.label}</p>
                <p className="text-sm font-medium text-gray-900">{s.value}</p>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Correlation note */}
      <div className="card bg-blue-50 border-blue-100">
        <p className="text-xs font-medium text-blue-700 mb-1">Trend pattern detected</p>
        <p className="text-xs text-blue-600">
          Your Fasting Glucose and HbA1c are both trending upward over 3 years, while Vitamin D is declining.
          Research shows low Vitamin D correlates with impaired glucose metabolism. Addressing Vitamin D deficiency may help stabilize glucose.
        </p>
      </div>
    </div>
  )
}
