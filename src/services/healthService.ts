import { supabase } from '@/lib/supabase'
import { generateHealthInsights, computeLongevityScore } from './groqService'
import type { HealthRecord, HealthReport, AIInsight, LongevityScore, FamilyMember } from '@/types'

// ─── Health Records ──────────────────────────────────────────────
export async function getHealthRecords(userId: string, testName?: string, limit = 200): Promise<HealthRecord[]> {
  let q = supabase.from('health_records').select('*').eq('user_id', userId)
    .order('recorded_at', { ascending: true }).limit(limit)
  if (testName) q = q.ilike('test_name', `%${testName}%`)
  const { data, error } = await q
  if (error) throw error
  return (data || []) as HealthRecord[]
}

export async function getLatestMetrics(userId: string): Promise<HealthRecord[]> {
  const records = await getHealthRecords(userId)
  const seen = new Map<string, HealthRecord>()
  for (const r of [...records].reverse()) {
    if (!seen.has(r.test_name.toLowerCase().trim())) seen.set(r.test_name.toLowerCase().trim(), r)
  }
  return Array.from(seen.values())
}

export async function addHealthRecord(record: Omit<HealthRecord, 'id' | 'created_at'>): Promise<HealthRecord> {
  const { data, error } = await supabase.from('health_records').insert(record).select().single()
  if (error) throw error
  return data as HealthRecord
}

export async function getTrendData(userId: string, testName: string): Promise<{ date: string; value: number }[]> {
  const { data, error } = await supabase
    .from('health_records').select('recorded_at, value')
    .eq('user_id', userId).ilike('test_name', `%${testName}%`)
    .order('recorded_at', { ascending: true })
  if (error) throw error
  return (data || []).map(r => ({ date: r.recorded_at.split('T')[0], value: r.value }))
}

// ─── OCR prompt ──────────────────────────────────────────────────
const OCR_PROMPT = `You are an expert at reading Indian lab reports (Thyrocare, SRL, Apollo, AIIMS, Wellwise, Sterling Accuris, Smart Pathology, Metropolis, Tata 1mg, Vijaya Diagnostics).
Extract ALL test results. Return ONLY valid JSON, no markdown, no backticks:
{"lab_name":"string","report_date":"YYYY-MM-DD","records":[{"test_name":"string","value":number,"unit":"string","reference_min":number_or_null,"reference_max":number_or_null}]}
Extract: Hemoglobin WBC RBC Platelets MCV MCH MCHC RDW PCV Neutrophils Lymphocytes Eosinophils Monocytes Basophils Fasting Glucose HbA1c Post-Prandial Glucose Total Cholesterol LDL HDL VLDL Triglycerides TSH T3 T4 Free T3 Free T4 Creatinine Urea BUN eGFR Uric Acid ALT AST ALP GGT Bilirubin Total Protein Albumin Vitamin D Vitamin B12 Ferritin Iron TIBC Sodium Potassium Calcium Phosphorus CRP ESR.
Return ONLY the JSON.`

function parseOCR(text: string) {
  try {
    const match = text.replace(/```json|```/g, '').trim().match(/\{[\s\S]*\}/)
    if (!match) return null
    const p = JSON.parse(match[0])
    if (!Array.isArray(p.records)) p.records = []
    p.records = p.records.filter((r: { test_name?: unknown; value?: unknown }) =>
      r.test_name && typeof r.value === 'number' && !isNaN(r.value as number))
    return p
  } catch { return null }
}

async function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve((reader.result as string).split(',')[1])
    reader.onerror = reject
    reader.readAsDataURL(file)
  })
}

async function ocrViaGroq(base64: string, mime: string): Promise<string | null> {
  const key = import.meta.env.VITE_GROQ_API_KEY
  if (!key || key.includes('your-groq')) return null
  if (mime === 'application/pdf') return null // Groq doesn't support PDFs

  try {
    const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` },
      body: JSON.stringify({
        model: 'meta-llama/llama-4-scout-17b-16e-instruct',
        messages: [{ role: 'user', content: [
          { type: 'image_url', image_url: { url: `data:${mime};base64,${base64}` } },
          { type: 'text', text: OCR_PROMPT }
        ]}],
        max_tokens: 4096, temperature: 0.1
      })
    })
    if (!res.ok) return null
    const d = await res.json() as { choices: Array<{ message: { content: string } }> }
    return d.choices?.[0]?.message?.content || null
  } catch { return null }
}

async function ocrViaGemini(base64: string, mime: string): Promise<string | null> {
  const key = import.meta.env.VITE_GEMINI_API_KEY
  if (!key || key.includes('your-gemini')) return null

  for (const model of ['gemini-1.5-flash', 'gemini-1.5-pro']) {
    try {
      const res = await fetch(
        `https://generativelanguage.googleapis.com/v1/models/${model}:generateContent?key=${key}`,
        { method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ contents: [{ parts: [
            { inline_data: { mime_type: mime, data: base64 } },
            { text: OCR_PROMPT }
          ]}], generationConfig: { temperature: 0.1, maxOutputTokens: 4096 } })
        }
      )
      if (res.status === 429) { await new Promise(r => setTimeout(r, 30000)); continue }
      if (!res.ok) continue
      const d = await res.json() as { candidates?: Array<{ content: { parts: Array<{ text: string }> } }> }
      const t = d.candidates?.[0]?.content?.parts?.[0]?.text
      if (t) return t
    } catch { continue }
  }
  return null
}

async function saveRecordsToDb(userId: string, reportId: string, extracted: { lab_name?: string; report_date?: string; records: Array<{ test_name: string; value: number; unit: string; reference_min?: number | null; reference_max?: number | null }> }, familyMemberId?: string): Promise<number> {
  if (!extracted.records.length) return 0
  const records = extracted.records.map(r => ({
    user_id: userId,
    family_member_id: familyMemberId || null,
    record_type: 'blood_test' as const,
    test_name: r.test_name,
    value: r.value,
    unit: r.unit,
    reference_min: r.reference_min ?? null,
    reference_max: r.reference_max ?? null,
    source: extracted.lab_name || 'Lab report',
    recorded_at: extracted.report_date ? new Date(extracted.report_date).toISOString() : new Date().toISOString(),
    metadata: { report_id: reportId },
  }))
  const { error } = await supabase.from('health_records').insert(records)
  return error ? 0 : records.length
}

// ─── Main upload function ─────────────────────────────────────────
export async function uploadAndScanReport(
  userId: string, file: File, familyMemberId?: string,
  onProgress?: (msg: string) => void
): Promise<{ report: HealthReport; recordsAdded: number }> {

  onProgress?.('Uploading to storage...')
  const safeName = file.name.replace(/[^a-z0-9._-]/gi, '_')
  const path = `${userId}/${Date.now()}_${safeName}`

  const { error: uploadError } = await supabase.storage.from('health-reports').upload(path, file)
  if (uploadError) throw new Error(`Storage failed: ${uploadError.message}`)

  const { data: { publicUrl } } = supabase.storage.from('health-reports').getPublicUrl(path)

  const { data: reportData, error: rErr } = await supabase.from('health_reports').insert({
    user_id: userId, family_member_id: familyMemberId || null,
    file_name: file.name, file_url: publicUrl, file_type: file.type, ocr_status: 'processing',
  }).select().single()
  if (rErr) throw new Error(`DB error: ${rErr.message}`)
  const report = reportData as HealthReport

  const isPDF = file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf')
  const mime  = isPDF ? 'application/pdf' : (file.type || 'image/jpeg')
  let recordsAdded = 0

  // ── Strategy 1: Edge Function (best — handles PDFs server-side) ──
  onProgress?.('Sending to Edge Function OCR...')
  try {
    const fd = new FormData()
    fd.append('file', file)
    fd.append('userId', userId)
    fd.append('reportId', report.id)

    // Call edge function with explicit headers for FormData
    const { data: { session } } = await supabase.auth.getSession()
    const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
    const anonKey    = import.meta.env.VITE_SUPABASE_ANON_KEY

    const res = await fetch(`${supabaseUrl}/functions/v1/ocr-report`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${session?.access_token || anonKey}`,
        apikey: anonKey,
        // Do NOT set Content-Type — browser sets it with boundary for FormData
      },
      body: fd,
    })

    if (res.ok) {
      const fnData = await res.json() as { success: boolean; recordsAdded: number }
      if (fnData.success) {
        recordsAdded = fnData.recordsAdded || 0
        onProgress?.(`Saved ${recordsAdded} test values via Edge Function`)
        return { report: { ...report, ocr_status: 'done' }, recordsAdded }
      }
    } else {
      const errText = await res.text()
      console.warn('Edge function response:', res.status, errText.slice(0, 200))
    }
  } catch (e) {
    console.warn('Edge function call failed:', e)
  }

  // ── Strategy 2: Direct browser API (works for images, Gemini for PDFs) ──
  onProgress?.(isPDF ? 'Gemini reading PDF directly...' : 'Groq reading image...')
  const base64 = await fileToBase64(file)
  let ocrText: string | null = null

  if (isPDF) {
    ocrText = await ocrViaGemini(base64, mime)
  } else {
    ocrText = await ocrViaGroq(base64, mime)
    if (!ocrText) ocrText = await ocrViaGemini(base64, mime)
  }

  if (!ocrText) {
    await supabase.from('health_reports').update({ ocr_status: 'failed' }).eq('id', report.id)
    if (isPDF) {
      throw new Error('PDF_OCR_FAILED')
    }
    throw new Error('OCR failed. Check API keys in Vercel environment variables.')
  }

  const extracted = parseOCR(ocrText)
  if (extracted && extracted.records.length > 0) {
    recordsAdded = await saveRecordsToDb(userId, report.id, extracted, familyMemberId)
    await supabase.from('health_reports').update({
      ocr_status: 'done', extracted_data: extracted,
      lab_name: extracted.lab_name || null,
      report_date: extracted.report_date || null,
    }).eq('id', report.id)
  } else {
    await supabase.from('health_reports').update({ ocr_status: 'done', extracted_data: { records: [] } }).eq('id', report.id)
  }

  onProgress?.(`Saved ${recordsAdded} test values`)
  return { report: { ...report, ocr_status: 'done' }, recordsAdded }
}

export async function getReports(userId: string): Promise<HealthReport[]> {
  const { data, error } = await supabase.from('health_reports').select('*')
    .eq('user_id', userId).order('created_at', { ascending: false })
  if (error) throw error
  return (data || []) as HealthReport[]
}

// ─── AI Insights ─────────────────────────────────────────────────
export async function getInsights(userId: string): Promise<AIInsight[]> {
  const { data, error } = await supabase.from('ai_insights').select('*')
    .eq('user_id', userId).order('generated_at', { ascending: false }).limit(20)
  if (error) throw error
  return (data || []) as AIInsight[]
}

export async function generateInsights(userId: string): Promise<AIInsight[]> {
  const records = await getHealthRecords(userId, undefined, 60)
  if (records.length === 0) return []
  const raw = await generateHealthInsights(records)
  if (raw.length === 0) return []
  const toInsert = raw.map(ins => ({ ...ins, user_id: userId, generated_at: new Date().toISOString() }))
  const { data, error } = await supabase.from('ai_insights').insert(toInsert).select()
  if (error) return toInsert as AIInsight[]
  return (data || []) as AIInsight[]
}

export async function getLongevityScore(userId: string): Promise<LongevityScore | null> {
  const { data } = await supabase.from('longevity_scores').select('*')
    .eq('user_id', userId).order('computed_at', { ascending: false }).limit(1).single()
  return data as LongevityScore | null
}

export async function computeAndSaveLongevityScore(userId: string): Promise<LongevityScore | null> {
  const records = await getLatestMetrics(userId)
  if (records.length === 0) return null
  try {
    const result = await computeLongevityScore(records)
    const { data } = await supabase.from('longevity_scores')
      .insert({ user_id: userId, ...result, computed_at: new Date().toISOString() }).select().single()
    return data as LongevityScore
  } catch { return null }
}

export async function getFamilyMembers(userId: string): Promise<FamilyMember[]> {
  const { data, error } = await supabase.from('family_members').select('*').eq('user_id', userId)
  if (error) throw error
  return (data || []) as FamilyMember[]
}

export async function addFamilyMember(member: Omit<FamilyMember, 'id' | 'created_at'>): Promise<FamilyMember> {
  const { data, error } = await supabase.from('family_members').insert(member).select().single()
  if (error) throw error
  return data as FamilyMember
}
