import type { MetricCard as MetricCardType } from '@/types'
import { TrendingUp, TrendingDown, Minus } from 'lucide-react'

const statusConfig = {
  normal:   { bg: 'from-emerald-50 to-teal-50',   border: 'border-emerald-100', bar: '#10b981', badge: 'bg-emerald-100 text-emerald-700', label: 'Normal',  dot: '#10b981' },
  good:     { bg: 'from-emerald-50 to-green-50',  border: 'border-emerald-100', bar: '#10b981', badge: 'bg-emerald-100 text-emerald-700', label: 'Good',    dot: '#10b981' },
  warning:  { bg: 'from-amber-50 to-orange-50',   border: 'border-amber-100',   bar: '#f59e0b', badge: 'bg-amber-100 text-amber-700',    label: 'Watch',   dot: '#f59e0b' },
  critical: { bg: 'from-red-50 to-rose-50',       border: 'border-red-100',     bar: '#ef4444', badge: 'bg-red-100 text-red-700',        label: 'High',    dot: '#ef4444' },
}

interface Props { metric: MetricCardType; onClick?: () => void }

export default function MetricCard({ metric, onClick }: Props) {
  const cfg = statusConfig[metric.status] || statusConfig.normal

  const TrendIcon = metric.trendDir === 'up' ? TrendingUp : metric.trendDir === 'down' ? TrendingDown : Minus
  const trendColor = metric.status === 'critical' && metric.trendDir === 'up' ? 'text-red-500'
    : metric.status === 'warning' && metric.trendDir === 'up' ? 'text-amber-600'
    : metric.trendDir === 'down' ? 'text-emerald-500' : 'text-gray-400'

  const pct = metric.referenceRange
    ? Math.min(100, Math.max(0, (() => {
        const [min, max] = metric.referenceRange!.split('-').map(Number)
        const v = Number(metric.value)
        if (!min || !max) return 50
        return ((v - min) / (max - min)) * 100
      })()))
    : 55

  return (
    <div
      className={`rounded-2xl border bg-gradient-to-br ${cfg.bg} ${cfg.border} p-4 cursor-pointer transition-all hover:scale-[1.02] hover:shadow-md animate-fadeIn`}
      onClick={onClick}
      style={{ boxShadow: '0 1px 4px rgba(0,0,0,0.05)' }}
    >
      {/* Header */}
      <div className="flex items-start justify-between mb-3">
        <p className="text-xs font-medium text-gray-500 leading-tight">{metric.label}</p>
        <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${cfg.badge}`}>
          <span className="inline-block w-1.5 h-1.5 rounded-full mr-1" style={{ background: cfg.dot, verticalAlign: 'middle' }} />
          {cfg.label}
        </span>
      </div>

      {/* Value */}
      <div className="flex items-baseline gap-1 mb-1">
        <span className="text-2xl font-bold text-gray-900">{metric.value}</span>
        {metric.unit && <span className="text-xs text-gray-400 font-medium">{metric.unit}</span>}
      </div>

      {/* Trend */}
      {metric.trend !== undefined && (
        <div className={`flex items-center gap-1 text-[11px] mb-3 font-medium ${trendColor}`}>
          <TrendIcon size={11} />
          <span>{metric.trend > 0 ? '+' : ''}{metric.trend}% vs last test</span>
        </div>
      )}

      {/* Progress bar */}
      <div className="h-1.5 bg-white/70 rounded-full overflow-hidden">
        <div className="h-full rounded-full transition-all duration-500"
          style={{ width: `${Math.min(pct, 100)}%`, background: cfg.bar }} />
      </div>

      {metric.referenceRange && (
        <p className="text-[10px] text-gray-400 mt-1.5">Ref: {metric.referenceRange} {metric.unit}</p>
      )}
    </div>
  )
}
