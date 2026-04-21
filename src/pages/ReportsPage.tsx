import { useEffect, useState } from 'react'
import { FlaskConical, FileText, CheckCircle, Clock, AlertCircle, ExternalLink } from 'lucide-react'
import { useAuthStore } from '@/store/authStore'
import { getReports } from '@/services/healthService'
import ReportUpload from '@/components/ReportUpload'
import type { HealthReport } from '@/types'

const statusConfig = {
  pending:    { icon: Clock,        color: 'text-gray-400',  label: 'Pending',    bg: 'bg-gray-50' },
  processing: { icon: Clock,        color: 'text-amber-500', label: 'Analyzing…', bg: 'bg-amber-50' },
  done:       { icon: CheckCircle,  color: 'text-teal-500',  label: 'Analyzed',   bg: 'bg-teal-50' },
  failed:     { icon: AlertCircle,  color: 'text-red-500',   label: 'Failed',     bg: 'bg-red-50' },
}

export default function ReportsPage() {
  const { user } = useAuthStore()
  const [reports, setReports] = useState<HealthReport[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!user) return
    loadReports()
  }, [user])

  async function loadReports() {
    if (!user) return
    try {
      const data = await getReports(user.id)
      setReports(data)
    } catch {}
    finally { setLoading(false) }
  }

  return (
    <div className="p-6 max-w-4xl space-y-6">
      <div className="flex items-center gap-3">
        <FlaskConical size={20} className="text-teal-500" />
        <h1 className="text-xl font-medium text-gray-900">Lab reports</h1>
      </div>

      <div className="grid grid-cols-2 gap-6">
        <div>
          <h2 className="text-sm font-medium text-gray-700 mb-3">Upload new report</h2>
          <ReportUpload onUploadComplete={loadReports} />

          <div className="card mt-4 bg-blue-50 border-blue-100">
            <h3 className="text-xs font-medium text-blue-800 mb-2">How AI report scanning works</h3>
            <ol className="space-y-1.5 text-xs text-blue-600">
              <li className="flex gap-2"><span className="font-medium">1.</span> Upload PDF or image of your lab report</li>
              <li className="flex gap-2"><span className="font-medium">2.</span> Google Document AI extracts all text using OCR</li>
              <li className="flex gap-2"><span className="font-medium">3.</span> Claude AI identifies test names, values, and reference ranges</li>
              <li className="flex gap-2"><span className="font-medium">4.</span> Records are auto-added to your health dashboard</li>
              <li className="flex gap-2"><span className="font-medium">5.</span> AI generates insights based on new data</li>
            </ol>
          </div>
        </div>

        <div>
          <h2 className="text-sm font-medium text-gray-700 mb-3">
            All reports ({reports.length})
          </h2>
          {loading ? (
            <p className="text-sm text-gray-400 text-center py-8">Loading...</p>
          ) : reports.length === 0 ? (
            <div className="card text-center py-12">
              <FileText size={32} className="text-gray-200 mx-auto mb-3" />
              <p className="text-gray-400 text-sm">No reports uploaded yet</p>
              <p className="text-gray-300 text-xs mt-1">
                Supported: Thyrocare, SRL, Apollo, AIIMS PDFs
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {reports.map(report => {
                const cfg = statusConfig[report.ocr_status]
                const StatusIcon = cfg.icon
                const extracted = (report.extracted_data as { records?: unknown[] } | null)?.records
                return (
                  <div key={report.id} className={`card ${cfg.bg}`}>
                    <div className="flex items-start gap-3">
                      <FileText size={18} className="text-gray-400 mt-0.5 shrink-0" />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <p className="text-sm font-medium text-gray-900 truncate">{report.file_name}</p>
                        </div>
                        {report.lab_name && (
                          <p className="text-xs text-gray-500">{report.lab_name}</p>
                        )}
                        {report.report_date && (
                          <p className="text-xs text-gray-400">
                            {new Date(report.report_date).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' })}
                          </p>
                        )}
                        <p className="text-[10px] text-gray-400 mt-1">
                          Uploaded {new Date(report.created_at).toLocaleDateString('en-IN')}
                        </p>
                      </div>
                      <div className="flex flex-col items-end gap-1">
                        <div className={`flex items-center gap-1 text-xs ${cfg.color}`}>
                          <StatusIcon size={12} className={report.ocr_status === 'processing' ? 'animate-spin' : ''} />
                          {cfg.label}
                        </div>
                        {report.file_url && (
                          <a href={report.file_url} target="_blank" rel="noreferrer"
                            className="text-[10px] text-blue-500 flex items-center gap-0.5 hover:text-blue-700">
                            View <ExternalLink size={9} />
                          </a>
                        )}
                      </div>
                    </div>

                    {report.ocr_status === 'done' && extracted && (
                      <div className="mt-2 pt-2 border-t border-white/50">
                        <p className="text-[10px] text-teal-700 font-medium">
                          {Array.isArray(extracted) ? extracted.length : 0} test values extracted and added to your dashboard
                        </p>
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
