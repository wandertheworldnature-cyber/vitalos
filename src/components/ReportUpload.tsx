import { useCallback, useState } from 'react'
import { useDropzone } from 'react-dropzone'
import { Upload, CheckCircle, Loader, XCircle, AlertTriangle } from 'lucide-react'
import { uploadAndScanReport } from '@/services/healthService'
import { useAuthStore } from '@/store/authStore'
import toast from 'react-hot-toast'

interface Props {
  onUploadComplete?: () => void
  familyMemberId?: string
}

type Status = 'idle' | 'uploading' | 'ocr' | 'saving' | 'done' | 'error'

export default function ReportUpload({ onUploadComplete, familyMemberId }: Props) {
  const { user } = useAuthStore()
  const [status, setStatus] = useState<Status>('idle')
  const [statusMsg, setStatusMsg] = useState('')
  const [fileName, setFileName] = useState('')
  const [recordsFound, setRecordsFound] = useState(0)
  const [errorMsg, setErrorMsg] = useState('')

  const onDrop = useCallback(async (acceptedFiles: File[], rejectedFiles: unknown[]) => {
    if (!user) { toast.error('Please sign in first'); return }
    if (rejectedFiles && (rejectedFiles as []).length > 0) {
      toast.error('File too large or wrong type. Use PDF/JPG/PNG under 10MB.')
      return
    }
    if (acceptedFiles.length === 0) return

    const file = acceptedFiles[0]
    setFileName(file.name)
    setStatus('uploading')
    setStatusMsg('Uploading to Supabase storage...')
    setErrorMsg('')

    try {
      const { recordsAdded } = await uploadAndScanReport(
        user.id,
        file,
        familyMemberId,
        (msg) => {
          setStatusMsg(msg)
          if (msg.includes('Gemini') || msg.includes('reading')) setStatus('ocr')
          else if (msg.includes('Saving')) setStatus('saving')
        }
      )
      setRecordsFound(recordsAdded)
      setStatus('done')
      if (recordsAdded > 0) {
        toast.success(`${recordsAdded} test values extracted and saved to your dashboard!`)
      } else {
        toast('Report saved — no test values detected. Try a clearer image.', { icon: '⚠️' })
      }
      onUploadComplete?.()
    } catch (err: unknown) {
      setStatus('error')
      const msg = err instanceof Error ? err.message : 'Upload failed'

      if (msg.includes('VITE_GEMINI_API_KEY')) {
        setErrorMsg('Add VITE_GEMINI_API_KEY to .env — free at aistudio.google.com')
        toast.error('Gemini API key missing')
      } else if (msg.includes('rate limit') || msg.includes('quota') || msg.includes('429')) {
        setErrorMsg('Gemini rate limit hit. Wait 1 minute then try again. (Free tier: 15 req/min)')
        toast.error('Rate limit — wait 1 minute and retry')
      } else if (msg.includes('storage') || msg.includes('bucket')) {
        setErrorMsg('Storage bucket not set up. Run migration 002 in Supabase SQL Editor.')
        toast.error('Storage not configured — run SQL migration 002')
      } else {
        setErrorMsg(msg)
        toast.error(`Failed: ${msg.slice(0, 60)}`)
      }
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
    maxSize: 10 * 1024 * 1024,
    disabled: status === 'uploading' || status === 'ocr' || status === 'saving',
  })

  const isProcessing = ['uploading', 'ocr', 'saving'].includes(status)

  const progressSteps = [
    { key: 'uploading', label: 'Uploading file' },
    { key: 'ocr',       label: 'Gemini AI reading report' },
    { key: 'saving',    label: 'Saving test values' },
    { key: 'done',      label: 'Complete' },
  ]

  return (
    <div className="space-y-3">
      <div
        {...getRootProps()}
        className={`border-2 border-dashed rounded-xl p-6 text-center transition-all
          ${isDragActive ? 'border-teal-400 bg-teal-50' : 'border-gray-200 hover:border-teal-300 hover:bg-gray-50'}
          ${isProcessing ? 'opacity-70 cursor-not-allowed' : 'cursor-pointer'}
          ${status === 'done' ? 'border-teal-300 bg-teal-50' : ''}
          ${status === 'error' ? 'border-red-200 bg-red-50' : ''}
        `}
      >
        <input {...getInputProps()} />

        {status === 'done' ? (
          <>
            <CheckCircle size={28} className="text-teal-500 mx-auto mb-2" />
            <p className="text-sm font-medium text-teal-700">{recordsFound} values extracted!</p>
            <p className="text-xs text-teal-500 mt-0.5">{fileName}</p>
          </>
        ) : status === 'error' ? (
          <>
            <XCircle size={28} className="text-red-400 mx-auto mb-2" />
            <p className="text-sm font-medium text-red-600">Upload failed</p>
            <p className="text-xs text-red-400 mt-0.5 max-w-[280px] mx-auto">{errorMsg}</p>
          </>
        ) : (
          <>
            <Upload size={24} className="text-gray-300 mx-auto mb-2" />
            <p className="text-sm font-medium text-gray-700 mb-0.5">
              {isDragActive ? 'Drop here' : 'Upload lab report'}
            </p>
            <p className="text-xs text-gray-400">PDF or image · Max 10MB</p>
            <p className="text-xs text-gray-400">Thyrocare · SRL · Apollo · Sterling Accuris · Wellwise</p>
            <div className="mt-2 text-[10px] text-teal-600 font-medium">
              Gemini AI auto-extracts all values — free
            </div>
          </>
        )}
      </div>

      {/* Progress steps */}
      {isProcessing && (
        <div className="space-y-1.5">
          {progressSteps.slice(0, 3).map((step) => {
            const isActive = step.key === status
            const isDone = progressSteps.findIndex(s => s.key === status) >
                           progressSteps.findIndex(s => s.key === step.key)
            return (
              <div key={step.key} className="flex items-center gap-2 text-xs">
                {isDone ? (
                  <CheckCircle size={13} className="text-teal-500 shrink-0" />
                ) : isActive ? (
                  <Loader size={13} className="text-amber-500 animate-spin shrink-0" />
                ) : (
                  <div className="w-3 h-3 rounded-full border border-gray-200 shrink-0" />
                )}
                <span className={isActive ? 'text-amber-600 font-medium' : isDone ? 'text-teal-600' : 'text-gray-300'}>
                  {isActive ? statusMsg || step.label : step.label}
                </span>
              </div>
            )
          })}
        </div>
      )}

      {/* Rate limit warning */}
      {status === 'error' && errorMsg.includes('rate limit') && (
        <div className="flex items-start gap-2 bg-amber-50 border border-amber-100 rounded-lg p-3">
          <AlertTriangle size={14} className="text-amber-500 mt-0.5 shrink-0" />
          <div className="text-xs text-amber-700">
            <p className="font-medium mb-0.5">Gemini free tier: 15 requests/minute</p>
            <p>Wait 1 minute, then upload again. For higher limits, add billing to your Google Cloud account.</p>
          </div>
        </div>
      )}

      {/* Actions */}
      <div className="flex gap-2">
        {status === 'done' && (
          <button
            onClick={() => { setStatus('idle'); setFileName(''); setRecordsFound(0) }}
            className="text-xs text-blue-500 hover:text-blue-700 underline"
          >
            Upload another report
          </button>
        )}
        {status === 'error' && (
          <button
            onClick={() => { setStatus('idle'); setErrorMsg('') }}
            className="text-xs text-gray-500 hover:text-gray-700 underline"
          >
            Try again
          </button>
        )}
      </div>
    </div>
  )
}
