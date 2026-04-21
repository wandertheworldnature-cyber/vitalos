// src/services/geminiService.ts
// PDF OCR: Gemini 1.5 Flash (free, supports PDFs natively)
// Image OCR: Groq Vision - llama-4-scout (free, fast)
// Strategy: Groq for images, Gemini for PDFs

const GROQ_URL = 'https://api.groq.com/openai/v1/chat/completions'

// Use v1 API + stable model name
const GEMINI_MODELS = [
  { id: 'gemini-1.5-flash',       v: 'v1'     },
  { id: 'gemini-1.5-flash-001',   v: 'v1'     },
  { id: 'gemini-1.5-flash-latest',v: 'v1beta' },
  { id: 'gemini-1.0-pro-vision',  v: 'v1beta' },
]

function getGroqKey() {
  const k = import.meta.env.VITE_GROQ_API_KEY
  if (!k || k.includes('your-groq-key')) throw new Error('NO_GROQ_KEY')
  return k
}

function getGeminiKey() {
  const k = import.meta.env.VITE_GEMINI_API_KEY
  if (!k || k.includes('your-gemini-key')) throw new Error('NO_GEMINI_KEY')
  return k
}

async function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve((reader.result as string).split(',')[1])
    reader.onerror = reject
    reader.readAsDataURL(file)
  })
}

export interface ExtractedReport {
  lab_name: string
  report_date: string
  records: Array<{
    test_name: string; value: number; unit: string
    reference_min: number | null; reference_max: number | null
  }>
}

const PROMPT = `You are an expert at reading Indian lab reports (Thyrocare, SRL, Apollo, AIIMS, Wellwise, Sterling Accuris, Smart Pathology Lab, Metropolis, Tata 1mg).
Extract ALL test results. Return ONLY valid JSON — no markdown fences, no explanation:
{"lab_name":"string","report_date":"YYYY-MM-DD","records":[{"test_name":"string","value":number,"unit":"string","reference_min":number_or_null,"reference_max":number_or_null}]}
Common tests: Hemoglobin WBC RBC Platelets MCV MCH MCHC Neutrophils Lymphocytes Eosinophils Monocytes Basophils PCV RDW MPV Fasting Glucose Post-Prandial Glucose HbA1c Total Cholesterol LDL HDL VLDL Triglycerides TSH T3 T4 Free T3 Free T4 Creatinine Urea BUN eGFR Uric Acid ALT AST ALP Total Bilirubin Direct Bilirubin Indirect Bilirubin Vitamin D Vitamin B12 Folate Sodium Potassium Calcium Phosphorus Magnesium CRP ESR Iron Ferritin TIBC Albumin Total Protein Globulin.
Return ONLY the JSON object.`

function parseResult(text: string): ExtractedReport | null {
  try {
    const cleaned = text.replace(/```json|```/g, '').trim()
    // Sometimes model adds text before/after JSON — extract just the JSON object
    const match = cleaned.match(/\{[\s\S]*\}/)
    if (!match) return null
    const parsed = JSON.parse(match[0]) as ExtractedReport
    if (!Array.isArray(parsed.records)) parsed.records = []
    return parsed
  } catch { return null }
}

// ── Groq Vision for IMAGES (jpg/png) ─────────────────────────────
async function ocrImageWithGroq(file: File): Promise<ExtractedReport | null> {
  try {
    const key = getGroqKey()
    const b64 = await fileToBase64(file)
    const mime = file.type || 'image/jpeg'

    const res = await fetch(GROQ_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` },
      body: JSON.stringify({
        model: 'meta-llama/llama-4-scout-17b-16e-instruct',
        messages: [{ role: 'user', content: [
          { type: 'image_url', image_url: { url: `data:${mime};base64,${b64}` } },
          { type: 'text', text: PROMPT },
        ]}],
        max_tokens: 2048,
        temperature: 0.1,
      }),
    })

    if (!res.ok) { console.warn('Groq vision error:', res.status); return null }
    const data = await res.json() as { choices: Array<{ message: { content: string } }> }
    const result = parseResult(data.choices?.[0]?.message?.content || '')
    if (result) console.log(`✓ Groq Vision: ${result.records.length} records`)
    return result
  } catch (err) {
    if (err instanceof Error && err.message === 'NO_GROQ_KEY') return null
    console.warn('Groq OCR failed:', err)
    return null
  }
}

// ── Gemini for PDFs (and image fallback) ─────────────────────────
async function ocrWithGemini(file: File): Promise<ExtractedReport | null> {
  let key: string
  try { key = getGeminiKey() } catch { return null }

  const b64 = await fileToBase64(file)
  const mime = file.name.toLowerCase().endsWith('.pdf') ? 'application/pdf' : (file.type || 'image/jpeg')

  for (const model of GEMINI_MODELS) {
    try {
      const url = `https://generativelanguage.googleapis.com/${model.v}/models/${model.id}:generateContent?key=${key}`
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [
            { inline_data: { mime_type: mime, data: b64 } },
            { text: PROMPT },
          ]}],
          generationConfig: { temperature: 0.1, maxOutputTokens: 2048 },
        }),
      })

      if (res.status === 429) {
        console.warn(`Gemini rate limit on ${model.id} — waiting 20s...`)
        await new Promise(r => setTimeout(r, 20000))
        // retry once
        const r2 = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{ parts: [
              { inline_data: { mime_type: mime, data: b64 } },
              { text: PROMPT },
            ]}],
            generationConfig: { temperature: 0.1, maxOutputTokens: 2048 },
          }),
        })
        if (!r2.ok) continue
        const d2 = await r2.json() as { candidates?: Array<{ content: { parts: Array<{ text: string }> } }> }
        const result2 = parseResult(d2.candidates?.[0]?.content?.parts?.[0]?.text || '')
        if (result2) { console.log(`✓ Gemini ${model.id} (retry): ${result2.records.length} records`); return result2 }
        continue
      }

      if (res.status === 400 || res.status === 404) { console.warn(`Model ${model.id} not available`); continue }
      if (!res.ok) continue

      const data = await res.json() as { candidates?: Array<{ content: { parts: Array<{ text: string }> } }>, error?: { message: string } }
      if (data.error) { console.warn(`${model.id} error:`, data.error.message); continue }

      const result = parseResult(data.candidates?.[0]?.content?.parts?.[0]?.text || '')
      if (result) { console.log(`✓ Gemini ${model.id}: ${result.records.length} records`); return result }
    } catch (err) {
      console.warn(`${model.id} exception:`, err)
    }
  }
  return null
}

// ── Main export ───────────────────────────────────────────────────
export async function extractLabReport(file: File): Promise<ExtractedReport> {
  const isPDF = file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf')

  if (isPDF) {
    // PDFs: Try Gemini first (native PDF support), then inform user
    console.log('PDF detected → trying Gemini...')
    const gemResult = await ocrWithGemini(file)
    if (gemResult) return gemResult

    throw new Error(
      'PDF OCR failed. Quick fix: Convert your PDF to a JPG image and upload that instead.\n' +
      'Use any free online tool like "pdf2jpg.net" or take a screenshot of the report.'
    )
  } else {
    // Images: Try Groq first (fast, free), then Gemini fallback
    console.log('Image detected → trying Groq Vision...')
    const groqResult = await ocrImageWithGroq(file)
    if (groqResult) return groqResult

    console.log('Groq failed → trying Gemini...')
    const gemResult = await ocrWithGemini(file)
    if (gemResult) return gemResult

    throw new Error(
      'Could not extract data from this image. Please ensure:\n' +
      '• The image is clear and well-lit\n' +
      '• The report text is readable\n' +
      '• VITE_GROQ_API_KEY and VITE_GEMINI_API_KEY are set in .env'
    )
  }
}
