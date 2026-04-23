import { useCallback, useState } from 'react'
import { useDropzone } from 'react-dropzone'
import { Upload, CheckCircle, Loader, XCircle, AlertTriangle, FileText, Image } from 'lucide-react'
import { uploadAndScanReport } from '@/services/healthService'
import { useAuthStore } from '@/store/authStore'
import toast from 'react-hot-toast'

interface Props { onUploadComplete?: () => void; familyMemberId?: string }
type Status = 'idle'|'uploading'|'ocr'|'saving'|'done'|'error'

export default function ReportUpload({ onUploadComplete, familyMemberId }: Props) {
  const { user } = useAuthStore()
  const [status, setStatus] = useState<Status>('idle')
  const [statusMsg, setStatusMsg] = useState('')
  const [fileName, setFileName] = useState('')
  const [recordsFound, setRecordsFound] = useState(0)
  const [errorMsg, setErrorMsg] = useState('')
  const [isPDFError, setIsPDFError] = useState(false)

  const onDrop = useCallback(async (accepted: File[], rejected: unknown[]) => {
    if (!user) { toast.error('Please sign in first'); return }
    if ((rejected as []).length > 0) {
      toast.error('File too large (max 15MB) or unsupported format')
      return
    }
    if (accepted.length === 0) return

    const file = accepted[0]
    const isPDF = file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf')
    setFileName(file.name)
    setStatus('uploading')
    setStatusMsg('Uploading...')
    setErrorMsg('')
    setIsPDFError(false)

    try {
      const { recordsAdded } = await uploadAndScanReport(
        user.id, file, familyMemberId,
        (msg) => {
          setStatusMsg(msg)
          if (msg.includes('Gemini') || msg.includes('Groq') || msg.includes('AI') || msg.includes('reading')) setStatus('ocr')
          else if (msg.includes('Saving') || msg.includes('Saved')) setStatus('saving')
        }
      )
      setRecordsFound(recordsAdded)
      setStatus('done')
      if (recordsAdded > 0) {
        toast.success(`✅ ${recordsAdded} test values extracted and saved!`)
      } else {
        toast('Report saved — no test values detected. Try a clearer image.', { icon: '⚠️' })
      }
      onUploadComplete?.()
    } catch (err: unknown) {
      setStatus('error')
      const msg = err instanceof Error ? err.message : 'Upload failed'
      const isPDFIssue = msg.includes('PDF') || (isPDF && msg.includes('Edge Function'))
      setIsPDFError(isPDFIssue)
      setErrorMsg(msg.split('\n')[0])
      if (msg.includes('Storage')) toast.error('Storage not configured — run SQL migration 002')
      else if (msg.includes('Edge Function') || msg.includes('ocr-report')) toast.error('Deploy the OCR Edge Function or use JPG/PNG')
      else toast.error('Upload failed')
    }
  }, [user, familyMemberId, onUploadComplete])

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'application/pdf': ['.pdf'],
      'image/jpeg': ['.jpg', '.jpeg'],
      'image/png': ['.png'],
      'image/webp': ['.webp'],
    },
    maxFiles: 1,
    maxSize: 15 * 1024 * 1024,
    disabled: ['uploading','ocr','saving'].includes(status),
  })

  const isProcessing = ['uploading','ocr','saving'].includes(status)

  return (
    <div className="space-y-3">
      <div {...getRootProps()}
        className={`border-2 border-dashed rounded-xl p-5 text-center transition-all
          ${isDragActive ? 'border-teal-400 bg-teal-50' : 'border-gray-200 hover:border-teal-300 hover:bg-teal-50/30'}
          ${isProcessing ? 'opacity-60 cursor-not-allowed' : 'cursor-pointer'}
          ${status === 'done' ? 'border-emerald-300 bg-emerald-50' : ''}
          ${status === 'error' ? 'border-red-200 bg-red-50' : ''}
        `}>
        <input {...getInputProps()} />

        {status === 'done' ? (
          <>
            <CheckCircle size={26} className="text-emerald-500 mx-auto mb-2" />
            <p className="text-sm font-bold text-emerald-700">{recordsFound} values extracted!</p>
            <p className="text-xs text-emerald-500 mt-0.5 truncate">{fileName}</p>
          </>
        ) : status === 'error' ? (
          <>
            <XCircle size={26} className="text-red-400 mx-auto mb-2" />
            <p className="text-sm font-semibold text-red-600 mb-1">Upload failed</p>
            <p className="text-xs text-red-400 leading-relaxed">{errorMsg}</p>
          </>
        ) : isProcessing ? (
          <>
            <Loader size={26} className="text-teal-500 mx-auto mb-2 animate-spin" />
            <p className="text-sm font-semibold text-gray-700">{statusMsg}</p>
            <p className="text-xs text-gray-400 truncate">{fileName}</p>
          </>
        ) : (
          <>
            <Upload size={24} className="text-gray-300 mx-auto mb-2" />
            <p className="text-sm font-semibold text-gray-700 mb-0.5">
              {isDragActive ? 'Drop here' : 'Upload lab report'}
            </p>
            <p className="text-xs text-gray-400">JPG/PNG/PDF · Max 15MB</p>
            <div className="flex items-center justify-center gap-1 mt-1.5 text-[10px] text-teal-600">
              <FileText size={9} /> Thyrocare · SRL · Apollo · Wellwise · Sterling Accuris
            </div>
          </>
        )}
      </div>

      {/* PDF-specific help */}
      {status === 'error' && isPDFError && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
          <div className="flex items-start gap-2">
            <AlertTriangle size={15} className="text-amber-600 mt-0.5 shrink-0" />
            <div>
              <p className="text-xs font-bold text-amber-800 mb-2">PDF not working? Use this quick fix:</p>
              <div className="space-y-2">
                <div className="flex items-start gap-2 bg-white rounded-lg p-2.5 border border-amber-100">
                  <Image size={14} className="text-teal-600 mt-0.5 shrink-0" />
                  <div>
                    <p className="text-xs font-semibold text-gray-800">Option 1 — Convert to image (recommended)</p>
                    <p className="text-xs text-gray-600 mt-0.5">
                      Take a screenshot of the report, or use{' '}
                      <a href="https://pdf2jpg.net" target="_blank" rel="noreferrer" className="text-blue-600 underline font-medium">pdf2jpg.net</a>
                      {' '}→ upload the JPG file
                    </p>
                  </div>
                </div>
                <div className="flex items-start gap-2 bg-white rounded-lg p-2.5 border border-amber-100">
                  <FileText size={14} className="text-purple-600 mt-0.5 shrink-0" />
                  <div>
                    <p className="text-xs font-semibold text-gray-800">Option 2 — Deploy OCR Edge Function</p>
                    <p className="text-xs text-gray-600 mt-0.5">Run these commands in terminal:</p>
                    <code className="text-[10px] bg-gray-100 text-gray-700 block rounded p-2 mt-1 leading-relaxed">
                      supabase functions deploy ocr-report<br/>
                      supabase secrets set GEMINI_API_KEY=AIza...<br/>
                      supabase secrets set GROQ_API_KEY=gsk_...
                    </code>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Generic error retry */}
      {status === 'error' && !isPDFError && (
        <div className="flex items-center gap-3">
          <button onClick={() => { setStatus('idle'); setErrorMsg('') }}
            className="text-xs text-gray-500 hover:text-gray-700 underline">Try again</button>
          <span className="text-xs text-gray-300">|</span>
          <button onClick={() => { setStatus('idle'); setErrorMsg('') }}
            className="text-xs text-teal-600 hover:text-teal-800 font-medium">Upload different file</button>
        </div>
      )}

      {status === 'done' && (
        <button onClick={() => { setStatus('idle'); setFileName(''); setRecordsFound(0) }}
          className="text-xs text-teal-600 hover:text-teal-800 font-medium">
          Upload another report →
        </button>
      )}
    </div>
  )
}
