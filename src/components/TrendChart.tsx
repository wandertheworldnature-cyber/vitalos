import { useEffect, useRef } from 'react'
import {
  Chart,
  LineElement,
  PointElement,
  LineController,
  CategoryScale,
  LinearScale,
  Tooltip,
  Legend,
  Filler,
} from 'chart.js'

Chart.register(LineElement, PointElement, LineController, CategoryScale, LinearScale, Tooltip, Legend, Filler)

interface TrendPoint {
  date: string
  value: number
}

interface Props {
  data: TrendPoint[]
  label: string
  color?: string
  referenceMin?: number
  referenceMax?: number
  unit?: string
  height?: number
}

export default function TrendChart({
  data,
  label,
  color = '#1D9E75',
  referenceMin,
  referenceMax,
  unit = '',
  height = 200,
}: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const chartRef = useRef<Chart | null>(null)

  useEffect(() => {
    if (!canvasRef.current || data.length === 0) return

    if (chartRef.current) {
      chartRef.current.destroy()
    }

    const labels = data.map(d => {
      const date = new Date(d.date)
      return date.toLocaleDateString('en-IN', { month: 'short', year: '2-digit' })
    })

    const datasets: Chart['data']['datasets'] = [
      {
        label,
        data: data.map(d => d.value),
        borderColor: color,
        backgroundColor: `${color}15`,
        fill: true,
        tension: 0.4,
        pointRadius: data.length > 20 ? 2 : 4,
        pointBackgroundColor: color,
        borderWidth: 2,
      },
    ]

    if (referenceMax !== undefined) {
      datasets.push({
        label: 'Upper limit',
        data: data.map(() => referenceMax),
        borderColor: '#E24B4A55',
        borderDash: [5, 4],
        borderWidth: 1,
        pointRadius: 0,
        fill: false,
      })
    }

    if (referenceMin !== undefined) {
      datasets.push({
        label: 'Lower limit',
        data: data.map(() => referenceMin),
        borderColor: '#BA751755',
        borderDash: [5, 4],
        borderWidth: 1,
        pointRadius: 0,
        fill: false,
      })
    }

    chartRef.current = new Chart(canvasRef.current, {
      type: 'line',
      data: { labels, datasets },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
          tooltip: {
            callbacks: {
              label: (ctx) => `${ctx.parsed.y} ${unit}`,
            },
          },
        },
        scales: {
          x: {
            ticks: { font: { size: 10 }, color: '#9ca3af', maxTicksLimit: 8 },
            grid: { display: false },
          },
          y: {
            ticks: { font: { size: 10 }, color: '#9ca3af', callback: v => `${v}` },
            grid: { color: 'rgba(0,0,0,0.04)' },
          },
        },
      },
    })

    return () => { chartRef.current?.destroy() }
  }, [data, label, color, referenceMin, referenceMax, unit])

  if (data.length === 0) {
    return (
      <div className="flex items-center justify-center text-gray-400 text-sm" style={{ height }}>
        No data yet — upload a report to see trends
      </div>
    )
  }

  return (
    <div style={{ position: 'relative', height }}>
      <canvas ref={canvasRef} />
    </div>
  )
}
