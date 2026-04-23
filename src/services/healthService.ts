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
    const key = r.test_name.toLowerCase().trim()
    if (!seen.has(key)) seen.set(key, r)
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

// ─── OCR — tries Edge Function first, falls back to direct Gemini ─
const OCR_PROMPT = `You are an expert at reading Indian lab reports (Thyrocare, SRL, Apollo, AIIMS, Wellwise, Sterling Accuris, Smart Pathology, Metropolis, Tata 1mg, Vijaya Diagnostics).
Extract ALL test results. Return ONLY valid JSON — no markdown, no backticks, no explanation:
{"lab_name":"string","report_date":"YYYY-MM-DD","records":[{"test_name":"string","value":number,"unit":"string","reference_min":number_or_null,"reference_max":number_or_null}]}
Extract every test including: Hemoglobin WBC RBC Platelets MCV MCH MCHC RDW PCV Neutrophils Lymphocytes Eosinophils Monocytes Basophils Fasting Glucose HbA1c Post-Prandial Glucose Total Cholesterol LDL HDL VLDL Triglycerides TSH T3 T4 Free T3 Free T4 Creatinine Urea BUN eGFR Uric Acid ALT AST ALP GGT Bilirubin Total Protein Albumin Vitamin D Vitamin B12 Ferritin Iron TIBC Sodium Potassium Calcium Phosphorus CRP ESR.
Return ONLY the JSON object with actual numeric values.`

async function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve((reader.result as string).split(',')[1])
    reader.onerror = reject
    reader.readAsDataURL(file)
  })
}

function parseOCRResult(text: string) {
  try {
    const cleaned = text.replace(/```json|```/g, '').trim()
    const match = cleaned.match(/\{[\s\S]*\}/)
    if (!match) return null
    const parsed = JSON.parse(match[0])
    if (!Array.isArray(parsed.records)) parsed.records = []
    parsed.records = parsed.records.filter((r: { test_name?: unknown; value?: unknown }) =>
      r.test_name && typeof r.value === 'number' && !isNaN(r.value as number)
    )
    return parsed
  } catch { return null }
}

async function callGeminiDirect(base64: string, mimeType: string, apiKey: string): Promise<string | null> {
  // For PDFs, try gemini-1.5-pro which has better PDF support
  const models = mimeType === 'application/pdf'
    ? ['gemini-1.5-flash', 'gemini-1.5-pro']
    : ['gemini-1.5-flash']

  for (const model of models) {
    try {
      const res = await fetch(
        `https://generativelanguage.googleapis.com/v1/models/${model}:generateContent?key=${apiKey}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{ parts: [
              { inline_data: { mime_type: mimeType, data: base64 } },
              { text: OCR_PROMPT }
            ]}],
            generationConfig: { temperature: 0.1, maxOutputTokens: 4096 }
          })
        }
      )
      if (res.status === 429) { console.warn(`${model} rate limited`); continue }
      if (!res.ok) { console.warn(`${model} error:`, res.status); continue }
      const data = await res.json() as { candidates?: Array<{ content: { parts: Array<{ text: string }> } }> }
      const text = data.candidates?.[0]?.content?.parts?.[0]?.text
      if (text) { console.log(`✓ ${model} OCR succeeded`); return text }
    } catch (e) { console.warn(`${model} exception:`, e) }
  }
  return null
}

async function callGroqVisionDirect(base64: string, mimeType: string, apiKey: string): Promise<string | null> {
  if (mimeType === 'application/pdf') return null // Groq Vision doesn't support PDFs
  try {
    const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` },
      body: JSON.stringify({
        model: 'meta-llama/llama-4-scout-17b-16e-instruct',
        messages: [{ role: 'user', content: [
          { type: 'image_url', image_url: { url: `data:${mimeType};base64,${base64}` } },
          { type: 'text', text: OCR_PROMPT }
        ]}],
        max_tokens: 4096, temperature: 0.1
      })
    })
    if (!res.ok) { console.warn('Groq Vision error:', res.status); return null }
    const data = await res.json() as { choices: Array<{ message: { content: string } }> }
    return data.choices?.[0]?.message?.content || null
  } catch (e) { console.warn('Groq Vision error:', e); return null }
}

export async function uploadAndScanReport(
  userId: string, file: File, familyMemberId?: string,
  onProgress?: (msg: string) => void
): Promise<{ report: HealthReport; recordsAdded: number }> {

  // 1. Upload file to Supabase Storage
  onProgress?.('Uploading to storage...')
  const safeName = file.name.replace(/[^a-z0-9._-]/gi, '_')
  const path = `${userId}/${Date.now()}_${safeName}`

  const { error: uploadError } = await supabase.storage.from('health-reports').upload(path, file)
  if (uploadError) throw new Error(`Storage failed: ${uploadError.message}. Run SQL migration 002 if bucket missing.`)

  const { data: { publicUrl } } = supabase.storage.from('health-reports').getPublicUrl(path)

  // 2. Create report DB record
  const { data: reportData, error: reportError } = await supabase
    .from('health_reports').insert({
      user_id: userId,
      family_member_id: familyMemberId || null,
      file_name: file.name,
      file_url: publicUrl,
      file_type: file.type,
      ocr_status: 'processing',
    }).select().single()
  if (reportError) throw new Error(`DB insert failed: ${reportError.message}`)
  const report = reportData as HealthReport

  // 3. Try Edge Function first (server-side, best for PDFs)
  onProgress?.('Sending to AI for analysis...')
  let recordsAdded = 0
  let edgeFnWorked = false

  try {
    const formData = new FormData()
    formData.append('file', file)
    formData.append('userId', userId)
    formData.append('reportId', report.id)

    const { data: fnData, error: fnError } = await supabase.functions.invoke('ocr-report', {
      body: formData,
    })

    if (!fnError && fnData?.success) {
      recordsAdded = fnData.recordsAdded || 0
      edgeFnWorked = true
      onProgress?.(`Saved ${recordsAdded} test values`)
    }
  } catch {
    console.log('Edge function not available — using direct API fallback')
  }

  // 4. Fallback: direct browser API calls (works without deploying Edge Function)
  if (!edgeFnWorked) {
    onProgress?.('AI reading your report directly...')

    const geminiKey = import.meta.env.VITE_GEMINI_API_KEY
    const groqKey   = import.meta.env.VITE_GROQ_API_KEY

    const isPDF = file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf')
    const base64 = await fileToBase64(file)
    const mimeType = isPDF ? 'application/pdf' : (file.type || 'image/jpeg')

    let ocrText: string | null = null

    if (isPDF) {
      // PDFs: Gemini only (Groq Vision doesn't support PDFs)
      onProgress?.('Gemini AI reading PDF...')
      if (geminiKey && !geminiKey.includes('your-gemini-key')) {
        ocrText = await callGeminiDirect(base64, mimeType, geminiKey)
      }

      if (!ocrText) {
        // Last resort: update DB as failed and give clear instructions
        await supabase.from('health_reports').update({ ocr_status: 'failed' }).eq('id', report.id)
        throw new Error(
          'PDF OCR requires the Edge Function to be deployed.\n\n' +
          'QUICK FIX: Convert your PDF to a JPG image (screenshot or pdf2jpg.net) and upload that instead.\n\n' +
          'OR deploy the Edge Function:\n' +
          'supabase functions deploy ocr-report\n' +
          'supabase secrets set GEMINI_API_KEY=your-key GROQ_API_KEY=your-key'
        )
      }
    } else {
      // Images: Try Groq Vision first (faster), then Gemini
      onProgress?.('Groq AI reading your report...')
      if (groqKey && !groqKey.includes('your-groq-key')) {
        ocrText = await callGroqVisionDirect(base64, mimeType, groqKey)
      }
      if (!ocrText && geminiKey && !geminiKey.includes('your-gemini-key')) {
        onProgress?.('Trying Gemini fallback...')
        ocrText = await callGeminiDirect(base64, mimeType, geminiKey)
      }
      if (!ocrText) {
        await supabase.from('health_reports').update({ ocr_status: 'failed' }).eq('id', report.id)
        throw new Error('OCR failed. Check VITE_GROQ_API_KEY and VITE_GEMINI_API_KEY in Vercel environment variables.')
      }
    }

    const extracted = parseOCRResult(ocrText)
    if (!extracted || extracted.records.length === 0) {
      await supabase.from('health_reports').update({ ocr_status: 'done', extracted_data: { records: [] } }).eq('id', report.id)
      return { report: { ...report, ocr_status: 'done' }, recordsAdded: 0 }
    }

    // Save records to DB
    const records = extracted.records.map((r: { test_name: string; value: number; unit: string; reference_min?: number | null; reference_max?: number | null }) => ({
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
      metadata: { report_id: report.id },
    }))

    const { error: recErr } = await supabase.from('health_records').insert(records)
    if (!recErr) recordsAdded = records.length

    await supabase.from('health_reports').update({
      ocr_status: 'done',
      extracted_data: extracted,
      lab_name: extracted.lab_name || null,
      report_date: extracted.report_date || null,
    }).eq('id', report.id)

    onProgress?.(`Saved ${recordsAdded} test values`)
  }

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

// ─── Longevity Score ──────────────────────────────────────────────
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

// ─── Family Members ───────────────────────────────────────────────
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
