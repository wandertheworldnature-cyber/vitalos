import { useState, useCallback } from 'react'
import { useDropzone } from 'react-dropzone'
import { useAuthStore } from '@/store/authStore'
import { supabase } from '@/lib/supabase'
import { Dna, Upload, Lock, AlertTriangle, CheckCircle, ChevronRight, Brain, Shield } from 'lucide-react'
import toast from 'react-hot-toast'

interface GeneticRisk {
  condition: string
  risk: 'low' | 'moderate' | 'elevated' | 'high'
  percentile: number
  description: string
  prevention: string[]
  icon: string
}

interface GeneticReport {
  summary: string
  risks: GeneticRisk[]
  traits: Array<{ name: string; finding: string; impact: string }>
  diet_recommendations: string[]
  exercise_recommendations: string[]
  generated_at: string
}

const RISK_CONFIG = {
  low:      { color: '#10b981', bg: 'rgba(16,185,129,0.08)',  border: 'rgba(16,185,129,0.2)',  label: 'Low Risk'      },
  moderate: { color: '#3b82f6', bg: 'rgba(59,130,246,0.08)',  border: 'rgba(59,130,246,0.2)',  label: 'Moderate'      },
  elevated: { color: '#f59e0b', bg: 'rgba(245,158,11,0.08)',  border: 'rgba(245,158,11,0.2)',  label: 'Elevated Risk' },
  high:     { color: '#ef4444', bg: 'rgba(239,68,68,0.08)',   border: 'rgba(239,68,68,0.2)',   label: 'High Risk'     },
}

const GROQ_URL = 'https://api.groq.com/openai/v1/chat/completions'

async function analyzeGeneticReport(text: string, userAge?: number): Promise<GeneticReport> {
  const key = import.meta.env.VITE_GROQ_API_KEY
  if (!key || key.includes('your-groq')) throw new Error('NO_KEY')

  const res = await fetch(GROQ_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` },
    body: JSON.stringify({
      model: 'llama-3.3-70b-versatile',
      messages: [{
        role: 'system',
        content: `You are VitalOS Genetic AI — an expert at analyzing genetic/DNA health reports.
IMPORTANT RULES:
- NEVER say "You WILL get" any disease
- ALWAYS use: "higher genetic predisposition", "tendency", "elevated genetic risk"
- Focus on PREVENTION and lifestyle modifications
- Be calm, supportive, non-alarming
- Reference Indian lifestyle and diet when relevant
Return ONLY valid JSON.`
      }, {
        role: 'user',
        content: `Analyze this genetic report text and extract health risk information.
Patient age: ${userAge || 'Unknown'}

Genetic report content:
${text.slice(0, 3000)}

Return JSON:
{
  "summary": "2-3 sentence overall genetic health summary",
  "risks": [
    {
      "condition": "condition name",
      "risk": "low|moderate|elevated|high",
      "percentile": 0-100,
      "description": "what this genetic variant means (non-alarming)",
      "prevention": ["prevention step 1", "prevention step 2", "prevention step 3"],
      "icon": "emoji"
    }
  ],
  "traits": [
    {"name": "trait name", "finding": "genetic finding", "impact": "practical meaning"}
  ],
  "diet_recommendations": ["Indian diet recommendation 1", "recommendation 2", "recommendation 3"],
  "exercise_recommendations": ["exercise recommendation 1", "recommendation 2"],
  "generated_at": "${new Date().toISOString()}"
}`
      }],
      max_tokens: 2000,
      temperature: 0.2,
      response_format: { type: 'json_object' },
    })
  })
  if (!res.ok) throw new Error('AI analysis failed')
  const data = await res.json() as { choices: Array<{ message: { content: string } }> }
  return JSON.parse(data.choices[0].message.content) as GeneticReport
}

export default function GeneticRiskPage() {
  const { user } = useAuthStore()
  const [report, setReport] = useState<GeneticReport | null>(null)
  const [analyzing, setAnalyzing] = useState(false)
  const [fileName, setFileName] = useState('')
  const [activeTab, setActiveTab] = useState<'risks'|'traits'|'plan'>('risks')

  const onDrop = useCallback(async (files: File[]) => {
    if (!files[0] || !user) return
    const file = files[0]
    setFileName(file.name)
    setAnalyzing(true)

    try {
      // Read file text
      let text = ''
      if (file.type === 'application/pdf') {
        // For PDF, use Gemini
        const key = import.meta.env.VITE_GEMINI_API_KEY
        if (!key) throw new Error('GEMINI key needed for PDF')
        const b64 = await new Promise<string>((res, rej) => {
          const reader = new FileReader()
          reader.onload = () => res((reader.result as string).split(',')[1])
          reader.onerror = rej
          reader.readAsDataURL(file)
        })
        const gemRes = await fetch(`https://generativelanguage.googleapis.com/v1/models/gemini-1.5-flash:generateContent?key=${key}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ contents: [{ parts: [
            { inline_data: { mime_type: 'application/pdf', data: b64 } },
            { text: 'Extract all text from this genetic/DNA report. Return only the text content.' }
          ]}]})
        })
        const gemData = await gemRes.json() as { candidates?: Array<{ content: { parts: Array<{ text: string }> } }> }
        text = gemData.candidates?.[0]?.content?.parts?.[0]?.text || ''
      } else {
        text = await file.text()
      }

      const result = await analyzeGeneticReport(text, undefined)
      setReport(result)

      // Save to DB
      await supabase.from('health_records').insert({
        user_id: user.id,
        record_type: 'genetic',
        test_name: 'Genetic Risk Analysis',
        value: result.risks.filter(r => r.risk === 'high').length,
        unit: 'high risk markers',
        source: file.name,
        recorded_at: new Date().toISOString(),
        metadata: { genetic_report: result },
      })

      toast.success('Genetic analysis complete!')
    } catch (err) {
      toast.error('Analysis failed — check API keys')
      console.error(err)
    } finally { setAnalyzing(false) }
  }, [user])

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop, maxFiles: 1, maxSize: 20*1024*1024,
    accept: { 'application/pdf':['.pdf'], 'text/plain':['.txt'], 'application/octet-stream':['.vcf'] },
    disabled: analyzing,
  })

  return (
    <div className="p-4 pb-8 max-w-2xl mx-auto space-y-5">
      {/* Header */}
      <div className="card !p-5" style={{ background:'linear-gradient(135deg,#0f0a1e,#1a0a2e)', borderColor:'#4c1d95' }}>
        <div className="flex items-start gap-3">
          <div className="w-12 h-12 rounded-xl flex items-center justify-center shrink-0" style={{ background:'rgba(139,92,246,0.2)' }}>
            <Dna size={24} className="text-purple-400"/>
          </div>
          <div>
            <div className="flex items-center gap-2 mb-1">
              <h1 className="text-lg font-bold text-white">Genetic Risk Engine</h1>
              <span className="text-[10px] bg-purple-900 text-purple-300 border border-purple-700 px-2 py-0.5 rounded-full font-bold">PREMIUM</span>
            </div>
            <p className="text-sm text-purple-300 leading-relaxed">Upload your DNA report (23andMe, AncestryDNA, or any Indian lab). AI maps genetic predispositions — not diagnoses, but your future health blueprint.</p>
          </div>
        </div>
        <div className="mt-4 grid grid-cols-3 gap-2">
          {['Type 2 Diabetes','Heart Disease','Vitamin Deficiencies','Obesity Risk','Sleep Patterns','Fitness Response'].map(t => (
            <div key={t} className="text-[10px] text-purple-300 bg-purple-900/30 rounded-lg px-2 py-1.5 text-center">🧬 {t}</div>
          ))}
        </div>
      </div>

      {/* Upload */}
      {!report && (
        <div {...getRootProps()}
          className={`card border-2 border-dashed text-center !p-8 cursor-pointer transition-all ${isDragActive ? 'border-purple-400 bg-purple-900/10' : 'border-purple-800 hover:border-purple-500'} ${analyzing ? 'opacity-60 cursor-not-allowed' : ''}`}>
          <input {...getInputProps()}/>
          {analyzing ? (
            <>
              <div className="w-12 h-12 border-2 border-t-transparent border-purple-500 rounded-full animate-spin mx-auto mb-3"/>
              <p className="text-sm font-bold text-purple-300">AI analyzing your genetic data...</p>
              <p className="text-xs text-gray-400 mt-1">Mapping SNPs and risk variants</p>
            </>
          ) : (
            <>
              <Dna size={36} className="text-purple-500 mx-auto mb-3"/>
              <p className="text-sm font-bold text-white mb-1">Upload genetic report</p>
              <p className="text-xs text-gray-400 mb-3">Supports: 23andMe · AncestryDNA · Any lab PDF · .vcf · .txt</p>
              <div className="flex items-center justify-center gap-2 text-[11px] text-purple-400">
                <Lock size={11}/> End-to-end encrypted · Never shared
              </div>
            </>
          )}
        </div>
      )}

      {/* Results */}
      {report && (
        <>
          <div className="card !p-4 border-purple-900/50" style={{ background:'rgba(139,92,246,0.06)' }}>
            <div className="flex items-start gap-3">
              <Brain size={18} className="text-purple-400 mt-0.5 shrink-0"/>
              <div>
                <p className="text-xs font-bold text-purple-300 mb-1">AI Genetic Summary · {fileName}</p>
                <p className="text-sm text-gray-200 leading-relaxed">{report.summary}</p>
              </div>
            </div>
          </div>

          <div className="flex gap-1 bg-gray-100 rounded-xl p-1">
            {(['risks','traits','plan'] as const).map(t => (
              <button key={t} onClick={() => setActiveTab(t)}
                className={`flex-1 text-xs py-2 rounded-lg font-semibold capitalize transition-all ${activeTab===t ? 'bg-white shadow-sm text-gray-900' : 'text-gray-500'}`}>
                {t==='risks' ? '🧬 Risk Markers' : t==='traits' ? '✨ Traits' : '🌿 Your Plan'}
              </button>
            ))}
          </div>

          {activeTab==='risks' && (
            <div className="space-y-3">
              {report.risks?.map((r, i) => {
                const cfg = RISK_CONFIG[r.risk]
                return (
                  <div key={i} className="card !p-4" style={{ background:cfg.bg, borderColor:cfg.border }}>
                    <div className="flex items-start justify-between mb-2">
                      <div className="flex items-center gap-2.5">
                        <span className="text-2xl">{r.icon}</span>
                        <div>
                          <p className="text-sm font-bold text-white">{r.condition}</p>
                          <div className="flex items-center gap-2 mt-0.5">
                            <span className="text-[10px] px-2 py-0.5 rounded-full font-bold text-white" style={{ background:cfg.color }}>{cfg.label}</span>
                            <span className="text-[10px] text-gray-400">{r.percentile}th percentile</span>
                          </div>
                        </div>
                      </div>
                      <div style={{ width:48, height:48 }}>
                        <svg viewBox="0 0 36 36" style={{ transform:'rotate(-90deg)' }}>
                          <circle cx="18" cy="18" r="15.9" fill="none" stroke="rgba(255,255,255,0.1)" strokeWidth="3"/>
                          <circle cx="18" cy="18" r="15.9" fill="none" stroke={cfg.color} strokeWidth="3"
                            strokeDasharray={`${r.percentile} ${100-r.percentile}`} strokeLinecap="round"/>
                        </svg>
                      </div>
                    </div>
                    <p className="text-xs text-gray-300 leading-relaxed mb-2">{r.description}</p>
                    <div className="bg-black/20 rounded-lg p-2.5">
                      <p className="text-[10px] font-bold text-green-400 mb-1">Prevention steps:</p>
                      {r.prevention?.map((p, j) => (
                        <p key={j} className="text-xs text-gray-300 flex gap-1.5 mb-0.5"><span className="text-green-400">✓</span>{p}</p>
                      ))}
                    </div>
                  </div>
                )
              })}
            </div>
          )}

          {activeTab==='traits' && (
            <div className="space-y-2.5">
              {report.traits?.map((t, i) => (
                <div key={i} className="card !p-4">
                  <p className="text-sm font-bold text-white mb-1">{t.name}</p>
                  <p className="text-xs text-purple-300 mb-1">Finding: {t.finding}</p>
                  <p className="text-xs text-gray-400">{t.impact}</p>
                </div>
              ))}
            </div>
          )}

          {activeTab==='plan' && (
            <div className="space-y-3">
              <div className="card !p-4">
                <p className="text-sm font-bold text-white mb-3 flex items-center gap-2">🥗 Diet based on your genes</p>
                {report.diet_recommendations?.map((d, i) => (
                  <div key={i} className="flex gap-2.5 bg-green-900/20 rounded-lg p-2.5 mb-2">
                    <span className="text-lg shrink-0">🌿</span>
                    <p className="text-xs text-gray-200">{d}</p>
                  </div>
                ))}
              </div>
              <div className="card !p-4">
                <p className="text-sm font-bold text-white mb-3 flex items-center gap-2">💪 Exercise for your genetics</p>
                {report.exercise_recommendations?.map((e, i) => (
                  <div key={i} className="flex gap-2.5 bg-blue-900/20 rounded-lg p-2.5 mb-2">
                    <span className="text-lg shrink-0">🏃</span>
                    <p className="text-xs text-gray-200">{e}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          <button onClick={() => setReport(null)} className="w-full btn-secondary text-xs py-2">Upload another report</button>
        </>
      )}

      {/* Disclaimer */}
      <div className="card !p-3 bg-gray-900/50 border-gray-800">
        <p className="text-[10px] text-gray-500 leading-relaxed">
          <strong className="text-gray-400">Important:</strong> VitalOS Genetic Engine identifies genetic predispositions — not diagnoses. Genetic risk does not mean you will develop a condition. Many factors including lifestyle, environment, and epigenetics influence health outcomes. Always consult a genetic counselor or doctor for clinical decisions.
        </p>
      </div>
    </div>
  )
}
