import { useCallback, useState } from 'react'
import { useDropzone } from 'react-dropzone'
import { Upload, CheckCircle, Loader, XCircle, AlertTriangle, FileText } from 'lucide-react'
import { uploadAndScanReport } from '@/services/healthService'
import { useAuthStore } from '@/store/authStore'
import toast from 'react-hot-toast'

interface Props { onUploadComplete?: () => void; familyMemberId?: string }
type Status = 'idle'|'uploading'|'converting'|'ocr'|'saving'|'done'|'error'

const STEPS: { key: Status; label: string }[] = [
  { key: 'uploading',  label: 'Uploading file' },
  { key: 'converting', label: 'Converting PDF to images' },
  { key: 'ocr',        label: 'AI reading the report' },
  { key: 'saving',     label: 'Saving test values' },
  { key: 'done',       label: 'Complete' },
]

export default function ReportUpload({ onUploadComplete, familyMemberId }: Props) {
  const { user } = useAuthStore()
  const [status, setStatus] = useState<Status>('idle')
  const [statusMsg, setStatusMsg] = useState('')
  const [fileName, setFileName] = useState('')
  const [recordsFound, setRecordsFound] = useState(0)
  const [errorMsg, setErrorMsg] = useState('')

  const onDrop = useCallback(async (acceptedFiles: File[], rejected: unknown[]) => {
    if (!user) { toast.error('Please sign in first'); return }
    if ((rejected as []).length > 0) { toast.error('File too large or unsupported format'); return }
    if (acceptedFiles.length === 0) return

    const file = acceptedFiles[0]
    setFileName(file.name)
    setStatus('uploading')
    setStatusMsg('Uploading to cloud storage...')
    setErrorMsg('')

    try {
      const { recordsAdded } = await uploadAndScanReport(
        user.id, file, familyMemberId,
        (msg) => {
          setStatusMsg(msg)
          if (msg.includes('Converting') || msg.includes('PDF')) setStatus('converting')
          else if (msg.includes('reading') || msg.includes('Groq') || msg.includes('AI') || msg.includes('Gemini')) setStatus('ocr')
          else if (msg.includes('Saving') || msg.includes('saving')) setStatus('saving')
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
      if (msg.includes('VITE_GROQ')) setErrorMsg('Add VITE_GROQ_API_KEY to .env — free at console.groq.com')
      else if (msg.includes('rate limit') || msg.includes('429')) setErrorMsg('Rate limit hit — wait 1 minute and retry')
      else if (msg.includes('storage') || msg.includes('bucket')) setErrorMsg('Storage not set up — run SQL migration 002')
      else setErrorMsg(msg.split('\n')[0])
      toast.error('Upload failed — see error below')
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
    disabled: ['uploading','converting','ocr','saving'].includes(status),
  })

  const isProcessing = ['uploading','converting','ocr','saving'].includes(status)
  const currentStepIdx = STEPS.findIndex(s => s.key === status)

  return (
    <div className="space-y-3">
      {/* Drop zone */}
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
            <p className="text-sm font-semibold text-red-600">Upload failed</p>
            <p className="text-xs text-red-400 mt-1 max-w-[260px] mx-auto leading-relaxed">{errorMsg}</p>
          </>
        ) : isProcessing ? (
          <>
            <Loader size={26} className="text-teal-500 mx-auto mb-2 animate-spin" />
            <p className="text-sm font-semibold text-gray-700">{statusMsg}</p>
            <p className="text-xs text-gray-400 mt-0.5 truncate">{fileName}</p>
          </>
        ) : (
          <>
            <Upload size={24} className="text-gray-300 mx-auto mb-2" />
            <p className="text-sm font-semibold text-gray-700 mb-0.5">
              {isDragActive ? 'Drop here' : 'Upload lab report'}
            </p>
            <p className="text-xs text-gray-400">PDF · JPG · PNG · Max 15MB</p>
            <div className="flex items-center justify-center gap-1 mt-2 text-[10px] text-teal-600 font-medium">
              <FileText size={10} />
              <span>Thyrocare · SRL · Apollo · Wellwise · Sterling Accuris</span>
            </div>
          </>
        )}
      </div>

      {/* Step progress */}
      {isProcessing && (
        <div className="space-y-1.5">
          {STEPS.slice(0, 4).map((step, idx) => {
            const isDone = idx < currentStepIdx
            const isActive = step.key === status
            return (
              <div key={step.key} className="flex items-center gap-2 text-xs">
                {isDone ? <CheckCircle size={13} className="text-teal-500 shrink-0" />
                  : isActive ? <Loader size={13} className="text-amber-500 animate-spin shrink-0" />
                  : <div className="w-3 h-3 rounded-full border border-gray-200 shrink-0" />}
                <span className={isDone ? 'text-teal-600' : isActive ? 'text-amber-600 font-semibold' : 'text-gray-300'}>
                  {isActive ? statusMsg : step.label}
                </span>
              </div>
            )
          })}
        </div>
      )}

      {/* Rate limit warning */}
      {status === 'error' && errorMsg.includes('rate') && (
        <div className="flex items-start gap-2 bg-amber-50 border border-amber-100 rounded-lg p-3">
          <AlertTriangle size={14} className="text-amber-500 mt-0.5 shrink-0" />
          <p className="text-xs text-amber-700">Gemini free tier: 15 req/min. Wait 1 minute then retry.</p>
        </div>
      )}

      {/* Actions */}
      <div className="flex gap-3">
        {status === 'done' && (
          <button onClick={() => { setStatus('idle'); setFileName(''); setRecordsFound(0) }}
            className="text-xs text-teal-600 hover:underline font-medium">
            Upload another →
          </button>
        )}
        {status === 'error' && (
          <button onClick={() => { setStatus('idle'); setErrorMsg('') }}
            className="text-xs text-gray-500 hover:text-gray-700 underline">
            Try again
          </button>
        )}
      </div>
    </div>
  )
}
