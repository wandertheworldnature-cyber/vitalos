import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/store/authStore'
import { FlaskConical, FileText, CheckCircle, Clock, AlertCircle, ExternalLink, TrendingUp, TrendingDown, Minus, ChevronDown, ChevronUp } from 'lucide-react'
import ReportUpload from '@/components/ReportUpload'
import type { HealthReport } from '@/types'

interface ReportRecord { test_name: string; value: number; unit: string; reference_min?: number | null; reference_max?: number | null }
interface ReportWithChanges extends HealthReport {
  changes?: Array<{ name: string; current: number; previous: number; unit: string; pct: number; status: 'improved'|'worsened'|'stable'|'new' }>
  abnormal?: ReportRecord[]
}

const statusConfig = {
  pending:    { icon: Clock,       color: 'text-gray-400',  label: 'Pending'    },
  processing: { icon: Clock,       color: 'text-amber-500', label: 'Analyzing…' },
  done:       { icon: CheckCircle, color: 'text-teal-500',  label: 'Analyzed'   },
  failed:     { icon: AlertCircle, color: 'text-red-500',   label: 'Failed'     },
}

export default function ReportsPage() {
  const { user } = useAuthStore()
  const [reports, setReports] = useState<ReportWithChanges[]>([])
  const [loading, setLoading] = useState(true)
  const [expanded, setExpanded] = useState<string | null>(null)

  useEffect(() => { if (user) loadReports() }, [user])

  async function loadReports() {
    if (!user) return
    setLoading(true)
    const { data } = await supabase.from('health_reports').select('*')
      .eq('user_id', user.id).order('created_at', { ascending: false })

    const allDone = ((data || []) as HealthReport[]).filter(r => r.ocr_status === 'done' && r.extracted_data)
    const enriched: ReportWithChanges[] = []

    for (let i = 0; i < allDone.length; i++) {
      const current = allDone[i]
      const prev = allDone[i + 1]
      const currRecords: ReportRecord[] = (current.extracted_data as { records?: ReportRecord[] } | null)?.records || []
      const prevRecords: ReportRecord[] = (prev?.extracted_data as { records?: ReportRecord[] } | null)?.records || []

      const abnormal = currRecords.filter(r =>
        (r.reference_max != null && r.value > r.reference_max) ||
        (r.reference_min != null && r.value < r.reference_min)
      )

      const changes = currRecords.map(r => {
        const p = prevRecords.find(pr => pr.test_name.toLowerCase() === r.test_name.toLowerCase())
        if (!p) return { name: r.test_name, current: r.value, previous: 0, unit: r.unit, pct: 0, status: 'new' as const }
        const pct = ((r.value - p.value) / Math.abs(p.value)) * 100
        const isHigherBetter = ['hdl','hemoglobin','vitamin d','vitamin b12','ferritin'].some(k => r.test_name.toLowerCase().includes(k))
        let status: 'improved'|'worsened'|'stable' = 'stable'
        if (Math.abs(pct) >= 3) status = (isHigherBetter ? pct > 0 : pct < 0) ? 'improved' : 'worsened'
        return { name: r.test_name, current: r.value, previous: p.value, unit: r.unit, pct, status }
      }).filter(c => c.status !== 'stable').sort((a, b) => Math.abs(b.pct) - Math.abs(a.pct))

      enriched.push({ ...current, changes, abnormal })
    }

    const others = ((data || []) as HealthReport[]).filter(r => r.ocr_status !== 'done')
    setReports([...enriched, ...others].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()))
    setLoading(false)
  }

  return (
    <div className="p-6 max-w-4xl space-y-6">
      <div className="flex items-center gap-3">
        <FlaskConical size={20} className="text-teal-500" />
        <h1 className="text-xl font-bold text-gray-900">Lab reports</h1>
      </div>
      <div className="grid grid-cols-2 gap-6">
        <div className="space-y-4">
          <h2 className="text-sm font-bold text-gray-700">Upload new report</h2>
          <ReportUpload onUploadComplete={loadReports} />
          <div className="card bg-blue-50 border-blue-100">
            <h3 className="text-xs font-bold text-blue-800 mb-2">Smart Analysis</h3>
            <ol className="space-y-1 text-xs text-blue-700">
              {['Upload PDF or image','AI extracts all test values','Highlights abnormal values in red','Shows what changed vs last report','Auto-generates risk alerts'].map((s,i) => (
                <li key={i} className="flex gap-2"><span className="font-bold">{i+1}.</span>{s}</li>
              ))}
            </ol>
          </div>
        </div>

        <div>
          <h2 className="text-sm font-bold text-gray-700 mb-3">All reports ({reports.length})</h2>
          {loading ? (
            <div className="space-y-3">{[1,2,3].map(i => <div key={i} className="card h-16 animate-pulse bg-gray-100" />)}</div>
          ) : reports.length === 0 ? (
            <div className="card border-dashed border-2 text-center py-12">
              <FileText size={28} className="text-gray-200 mx-auto mb-2" />
              <p className="text-gray-400 text-sm">No reports yet</p>
            </div>
          ) : (
            <div className="space-y-3">
              {reports.map(report => {
                const cfg = statusConfig[report.ocr_status] || statusConfig.pending
                const StatusIcon = cfg.icon
                const isExp = expanded === report.id
                const hasAbnormal = report.abnormal && report.abnormal.length > 0
                const hasChanges = report.changes && report.changes.length > 0
                return (
                  <div key={report.id} className={`card border ${hasAbnormal ? 'border-red-100' : 'border-gray-100'}`}>
                    <div className="flex items-start gap-3 cursor-pointer" onClick={() => setExpanded(isExp ? null : report.id)}>
                      <FileText size={15} className="text-gray-400 mt-0.5 shrink-0" />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-0.5">
                          <p className="text-sm font-semibold text-gray-900 truncate">{report.file_name}</p>
                          {hasAbnormal && <span className="text-[10px] bg-red-100 text-red-700 px-1.5 py-0.5 rounded-full font-bold shrink-0">⚠ {report.abnormal!.length} abnormal</span>}
                        </div>
                        {report.lab_name && <p className="text-xs text-gray-500">{report.lab_name}</p>}
                        <p className="text-[10px] text-gray-400">{new Date(report.created_at).toLocaleDateString('en-IN',{day:'numeric',month:'short',year:'numeric'})}</p>
                        {report.ocr_status === 'done' && (
                          <div className="flex items-center gap-3 mt-0.5">
                            <p className="text-[10px] text-teal-600 font-medium">{(report.extracted_data as { records?: unknown[] } | null)?.records?.length || 0} values</p>
                            {hasChanges && <p className="text-[10px] text-blue-600 font-medium">{report.changes!.length} changes</p>}
                          </div>
                        )}
                      </div>
                      <div className="flex flex-col items-end gap-1 shrink-0">
                        <div className={`flex items-center gap-1 text-xs ${cfg.color}`}>
                          <StatusIcon size={11} className={report.ocr_status==='processing'?'animate-spin':''} />
                          {cfg.label}
                        </div>
                        {report.file_url && (
                          <a href={report.file_url} target="_blank" rel="noreferrer" onClick={e=>e.stopPropagation()}
                            className="text-[10px] text-blue-500 flex items-center gap-0.5 hover:text-blue-700">
                            View <ExternalLink size={9} />
                          </a>
                        )}
                        {report.ocr_status==='done' && (isExp ? <ChevronUp size={12} className="text-gray-400"/> : <ChevronDown size={12} className="text-gray-400"/>)}
                      </div>
                    </div>

                    {isExp && report.ocr_status==='done' && (
                      <div className="mt-3 pt-3 border-t border-gray-100 space-y-4">
                        {hasAbnormal && (
                          <div>
                            <p className="text-xs font-bold text-red-600 mb-2">⚠️ Abnormal values</p>
                            <div className="grid grid-cols-2 gap-2">
                              {report.abnormal!.map(r => {
                                const isHigh = r.reference_max != null && r.value > r.reference_max
                                return (
                                  <div key={r.test_name} className="bg-red-50 border border-red-100 rounded-lg p-2.5">
                                    <p className="text-[10px] text-gray-500 truncate">{r.test_name}</p>
                                    <div className="flex items-baseline gap-1">
                                      <span className="text-sm font-bold text-red-600">{r.value}</span>
                                      <span className="text-[10px] text-gray-400">{r.unit}</span>
                                    </div>
                                    <p className="text-[9px] text-red-500 font-medium">
                                      {isHigh ? `↑ High (max: ${r.reference_max})` : `↓ Low (min: ${r.reference_min})`}
                                    </p>
                                  </div>
                                )
                              })}
                            </div>
                          </div>
                        )}
                        {hasChanges && (
                          <div>
                            <p className="text-xs font-bold text-blue-700 mb-2">📊 Changes vs previous report</p>
                            <div className="space-y-1.5">
                              {report.changes!.slice(0,8).map(c => (
                                <div key={c.name} className="flex items-center gap-2 text-xs bg-gray-50 rounded-lg px-2.5 py-1.5">
                                  {c.status==='improved' ? <TrendingDown size={12} className="text-teal-500 shrink-0"/>
                                   : c.status==='worsened' ? <TrendingUp size={12} className="text-red-500 shrink-0"/>
                                   : c.status==='new' ? <span className="text-[9px] bg-blue-100 text-blue-700 px-1 rounded shrink-0">NEW</span>
                                   : <Minus size={12} className="text-gray-400 shrink-0"/>}
                                  <span className="text-gray-600 flex-1 truncate">{c.name}</span>
                                  <span className={`font-semibold text-right shrink-0 ${c.status==='improved'?'text-teal-600':c.status==='worsened'?'text-red-600':'text-gray-500'}`}>
                                    {c.status==='new' ? `${c.current} ${c.unit}` : `${c.previous}→${c.current} ${c.unit} (${c.pct>0?'+':''}${c.pct.toFixed(1)}%)`}
                                  </span>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
