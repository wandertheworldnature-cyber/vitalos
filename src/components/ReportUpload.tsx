import { useCallback, useState } from 'react'
import { useDropzone } from 'react-dropzone'
import { Upload, CheckCircle, Loader, XCircle, AlertTriangle, FileText } from 'lucide-react'
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
  const [errorType, setErrorType] = useState<'pdf'|'generic'|null>(null)

  const onDrop = useCallback(async (accepted: File[], rejected: unknown[]) => {
    if (!user) { toast.error('Please sign in'); return }
    if ((rejected as []).length > 0) { toast.error('File too large or unsupported'); return }
    if (!accepted.length) return

    const file = accepted[0]
    setFileName(file.name)
    setStatus('uploading')
    setStatusMsg('Uploading...')
    setErrorType(null)

    try {
      const { recordsAdded } = await uploadAndScanReport(
        user.id, file, familyMemberId,
        (msg) => {
          setStatusMsg(msg)
          if (msg.includes('reading') || msg.includes('Groq') || msg.includes('Gemini') || msg.includes('OCR') || msg.includes('Edge')) setStatus('ocr')
          else if (msg.includes('Saved') || msg.includes('Saving')) setStatus('saving')
        }
      )
      setRecordsFound(recordsAdded)
      setStatus('done')
      toast.success(recordsAdded > 0 ? `✅ ${recordsAdded} test values saved!` : 'Report saved — no values detected')
      onUploadComplete?.()
    } catch (err: unknown) {
      setStatus('error')
      const msg = err instanceof Error ? err.message : 'Upload failed'
      if (msg === 'PDF_OCR_FAILED') {
        setErrorType('pdf')
      } else {
        setErrorType('generic')
        setStatusMsg(msg.split('\n')[0])
        toast.error('Upload failed')
      }
    }
  }, [user, familyMemberId, onUploadComplete])

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { 'application/pdf':['.pdf'], 'image/jpeg':['.jpg','.jpeg'], 'image/png':['.png'], 'image/webp':['.webp'] },
    maxFiles: 1, maxSize: 15*1024*1024,
    disabled: ['uploading','ocr','saving'].includes(status),
  })

  const isProcessing = ['uploading','ocr','saving'].includes(status)

  return (
    <div className="space-y-3">
      <div {...getRootProps()}
        className={`border-2 border-dashed rounded-xl p-5 text-center transition-all
          ${isDragActive ? 'border-teal-400 bg-teal-50' : 'border-gray-200 hover:border-teal-300 hover:bg-teal-50/30'}
          ${isProcessing ? 'opacity-60 cursor-not-allowed' : 'cursor-pointer'}
          ${status==='done' ? 'border-emerald-300 bg-emerald-50' : ''}
          ${status==='error' ? 'border-red-200 bg-red-50' : ''}
        `}>
        <input {...getInputProps()} />
        {status==='done' ? (
          <><CheckCircle size={26} className="text-emerald-500 mx-auto mb-2" />
            <p className="text-sm font-bold text-emerald-700">{recordsFound} values extracted!</p>
            <p className="text-xs text-emerald-500 truncate">{fileName}</p></>
        ) : status==='error' && errorType==='pdf' ? (
          <><XCircle size={26} className="text-red-400 mx-auto mb-2" />
            <p className="text-sm font-bold text-red-600 mb-1">PDF needs conversion first</p>
            <p className="text-xs text-red-400">Screenshots and JPG files work perfectly</p></>
        ) : status==='error' ? (
          <><XCircle size={26} className="text-red-400 mx-auto mb-2" />
            <p className="text-sm font-semibold text-red-600">Upload failed</p>
            <p className="text-xs text-red-400 leading-relaxed">{statusMsg}</p></>
        ) : isProcessing ? (
          <><Loader size={26} className="text-teal-500 mx-auto mb-2 animate-spin" />
            <p className="text-sm font-semibold text-gray-700">{statusMsg}</p>
            <p className="text-xs text-gray-400 truncate">{fileName}</p></>
        ) : (
          <><Upload size={24} className="text-gray-300 mx-auto mb-2" />
            <p className="text-sm font-semibold text-gray-700 mb-0.5">{isDragActive ? 'Drop here' : 'Upload lab report'}</p>
            <p className="text-xs text-gray-400">JPG/PNG preferred · PDF supported · Max 15MB</p>
            <div className="flex items-center justify-center gap-1 mt-1.5 text-[10px] text-teal-600">
              <FileText size={9} /> Thyrocare · SRL · Apollo · Wellwise · Sterling Accuris
            </div></>
        )}
      </div>

      {/* PDF fix guide */}
      {status==='error' && errorType==='pdf' && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
          <div className="flex items-start gap-2">
            <AlertTriangle size={15} className="text-amber-600 mt-0.5 shrink-0" />
            <div className="flex-1">
              <p className="text-xs font-bold text-amber-800 mb-2">Convert PDF to JPG — takes 30 seconds:</p>
              <div className="space-y-2">
                <div className="bg-white rounded-lg p-3 border border-amber-100">
                  <p className="text-xs font-semibold text-gray-800 mb-1">📸 Easiest: Screenshot the report</p>
                  <p className="text-xs text-gray-600">Press <kbd className="bg-gray-100 px-1 rounded text-[10px]">Win+Shift+S</kbd> → drag over the report → upload that PNG</p>
                </div>
                <div className="bg-white rounded-lg p-3 border border-amber-100">
                  <p className="text-xs font-semibold text-gray-800 mb-1">🌐 Online converter</p>
                  <p className="text-xs text-gray-600">Go to{' '}
                    <a href="https://pdf2jpg.net" target="_blank" rel="noreferrer" className="text-blue-600 underline font-medium">pdf2jpg.net</a>
                    {' '}→ upload PDF → download JPG → upload here</p>
                </div>
              </div>
              <button onClick={() => { setStatus('idle'); setErrorType(null) }}
                className="mt-3 text-xs text-teal-600 font-semibold hover:underline">
                ← Try again with converted file
              </button>
            </div>
          </div>
        </div>
      )}

      {status==='done' && (
        <button onClick={() => { setStatus('idle'); setFileName(''); setRecordsFound(0) }}
          className="text-xs text-teal-600 font-medium hover:underline">Upload another →</button>
      )}
      {status==='error' && errorType==='generic' && (
        <button onClick={() => { setStatus('idle'); setErrorType(null) }}
          className="text-xs text-gray-500 hover:text-gray-700 underline">Try again</button>
      )}
    </div>
  )
}
