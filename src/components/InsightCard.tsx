import type { AIInsight } from '@/types'
import { AlertTriangle, AlertCircle, Info, CheckCircle, ChevronRight } from 'lucide-react'

const severityConfig = {
  critical: {
    icon: AlertCircle,
    bg: 'bg-red-50',
    border: 'border-red-200',
    iconColor: 'text-red-500',
    badge: 'badge-red',
    label: 'Critical',
  },
  warning: {
    icon: AlertTriangle,
    bg: 'bg-amber-50',
    border: 'border-amber-200',
    iconColor: 'text-amber-500',
    badge: 'badge-amber',
    label: 'Warning',
  },
  info: {
    icon: Info,
    bg: 'bg-blue-50',
    border: 'border-blue-200',
    iconColor: 'text-blue-500',
    badge: 'bg-blue-50 text-blue-700 text-xs px-2 py-1 rounded-md font-medium',
    label: 'Info',
  },
  good: {
    icon: CheckCircle,
    bg: 'bg-teal-50',
    border: 'border-teal-200',
    iconColor: 'text-teal-500',
    badge: 'badge-green',
    label: 'Good',
  },
}

interface Props {
  insight: AIInsight
  onAction?: () => void
}

export default function InsightCard({ insight, onAction }: Props) {
  const cfg = severityConfig[insight.severity]
  const Icon = cfg.icon

  return (
    <div className={`rounded-xl border p-4 ${cfg.bg} ${cfg.border}`}>
      <div className="flex items-start gap-3">
        <Icon size={18} className={`${cfg.iconColor} mt-0.5 shrink-0`} />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <h4 className="text-sm font-medium text-gray-900">{insight.title}</h4>
            <span className={cfg.badge}>{cfg.label}</span>
          </div>
          <p className="text-xs text-gray-600 leading-relaxed mb-2">
            {insight.description}
          </p>
          <div className="bg-white/60 rounded-lg p-2.5 mb-2">
            <p className="text-xs font-medium text-gray-700 mb-0.5">Recommended action</p>
            <p className="text-xs text-gray-600">{insight.recommendation}</p>
          </div>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3 text-[10px] text-gray-400">
              {insight.risk_reduction && (
                <span className="text-teal-600 font-medium">{insight.risk_reduction} risk reduction</span>
              )}
              {insight.timeframe && <span>{insight.timeframe}</span>}
            </div>
            {onAction && (
              <button
                onClick={onAction}
                className="flex items-center gap-1 text-xs text-blue-600 hover:text-blue-800 font-medium"
              >
                Take action <ChevronRight size={12} />
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
