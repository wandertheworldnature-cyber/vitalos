// OCR Service
// Images → Groq Vision (llama-4-scout, free, fast, reliable)
// PDFs → PDF.js converts pages to images → Groq Vision
// Gemini is fallback only if Groq fails

import { pdfToImages } from './pdfToImages'

const GROQ_URL = 'https://api.groq.com/openai/v1/chat/completions'
const GROQ_VISION_MODEL = 'meta-llama/llama-4-scout-17b-16e-instruct'

function getGroqKey(): string {
  const k = import.meta.env.VITE_GROQ_API_KEY
  if (!k || k.includes('your-groq-key')) throw new Error('NO_GROQ_KEY')
  return k
}

function getGeminiKey(): string {
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
    test_name: string
    value: number
    unit: string
    reference_min: number | null
    reference_max: number | null
  }>
}

const SYSTEM_PROMPT = `You are an expert at reading Indian lab reports from labs like Thyrocare, SRL, Apollo, AIIMS, Wellwise, Sterling Accuris, Smart Pathology Lab, Metropolis, Tata 1mg, Vijaya Diagnostics.

Extract ALL test results from this lab report image.
Return ONLY valid JSON — absolutely no markdown, no backticks, no explanation text:

{"lab_name":"string","report_date":"YYYY-MM-DD","records":[{"test_name":"string","value":number,"unit":"string","reference_min":number_or_null,"reference_max":number_or_null}]}

Extract every test you can find including:
CBC: Hemoglobin, WBC/TLC, RBC, Platelets, PCV/Hematocrit, MCV, MCH, MCHC, RDW, MPV, Neutrophils, Lymphocytes, Eosinophils, Monocytes, Basophils
Blood Sugar: Fasting Glucose, Post Prandial Glucose, Random Glucose, HbA1c
Lipids: Total Cholesterol, LDL, HDL, VLDL, Triglycerides, Non-HDL Cholesterol
Thyroid: TSH, T3, T4, Free T3, Free T4, Anti-TPO
Kidney: Creatinine, Blood Urea, BUN, eGFR, Uric Acid, Sodium, Potassium, Calcium, Phosphorus, Chloride
Liver: ALT/SGPT, AST/SGOT, ALP, GGT, Total Bilirubin, Direct Bilirubin, Indirect Bilirubin, Total Protein, Albumin, Globulin, A/G Ratio
Vitamins: Vitamin D (25-OH), Vitamin B12, Folate/Folic Acid, Vitamin B9
Iron: Serum Iron, Ferritin, TIBC, Transferrin Saturation
Inflammation: CRP, ESR, Homocysteine
Hormones: Testosterone, Estrogen, Progesterone, LH, FSH, Prolactin, DHEA-S, Cortisol, Insulin
Others: HbsAg, Anti-HCV, HIV, VDRL, Widal, Dengue NS1, Malaria, PSA

Important: Extract the ACTUAL numeric values from the report, including reference ranges if shown.
Return ONLY the JSON object with no other text.`

async function callGroqVision(base64Images: string[], mimeType = 'image/png'): Promise<ExtractedReport | null> {
  try {
    const key = getGroqKey()

    // Send all pages in a single request for better context
    const imageContent = base64Images.map(b64 => ({
      type: 'image_url' as const,
      image_url: { url: `data:${mimeType};base64,${b64}` }
    }))

    const res = await fetch(GROQ_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${key}`
      },
      body: JSON.stringify({
        model: GROQ_VISION_MODEL,
        messages: [{
          role: 'user',
          content: [
            ...imageContent,
            { type: 'text', text: SYSTEM_PROMPT }
          ]
        }],
        max_tokens: 4096,
        temperature: 0.1,
      })
    })

    if (!res.ok) {
      const err = await res.json().catch(() => ({})) as { error?: { message: string } }
      console.error('Groq error:', res.status, err.error?.message)
      return null
    }

    const data = await res.json() as { choices: Array<{ message: { content: string } }> }
    const text = data.choices?.[0]?.message?.content || ''
    return parseJSON(text)
  } catch (err) {
    if (err instanceof Error && err.message === 'NO_GROQ_KEY') return null
    console.error('Groq Vision error:', err)
    return null
  }
}

async function callGemini(file: File): Promise<ExtractedReport | null> {
  try {
    const key = getGeminiKey()
    const b64 = await fileToBase64(file)
    const mime = file.name.endsWith('.pdf') ? 'application/pdf' : file.type

    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1/models/gemini-1.5-flash:generateContent?key=${key}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{
            parts: [
              { inline_data: { mime_type: mime, data: b64 } },
              { text: SYSTEM_PROMPT }
            ]
          }],
          generationConfig: { temperature: 0.1, maxOutputTokens: 4096 }
        })
      }
    )

    if (res.status === 429) {
      console.warn('Gemini rate limited')
      return null
    }
    if (!res.ok) return null

    const data = await res.json() as { candidates?: Array<{ content: { parts: Array<{ text: string }> } }> }
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text || ''
    return parseJSON(text)
  } catch (err) {
    if (err instanceof Error && err.message === 'NO_GEMINI_KEY') return null
    console.error('Gemini error:', err)
    return null
  }
}

function parseJSON(text: string): ExtractedReport | null {
  try {
    // Remove any markdown fences and extract JSON
    const cleaned = text.replace(/```json|```/g, '').trim()
    const match = cleaned.match(/\{[\s\S]*\}/)
    if (!match) return null
    const parsed = JSON.parse(match[0]) as ExtractedReport
    if (!Array.isArray(parsed.records)) parsed.records = []
    // Filter out invalid records
    parsed.records = parsed.records.filter(r =>
      r.test_name && typeof r.value === 'number' && !isNaN(r.value)
    )
    return parsed
  } catch {
    console.error('JSON parse failed:', text.slice(0, 200))
    return null
  }
}

// ── Main export ────────────────────────────────────────────────
export async function extractLabReport(
  file: File,
  onProgress?: (msg: string) => void
): Promise<ExtractedReport> {
  const isPDF = file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf')

  if (isPDF) {
    // Step 1: Convert PDF pages to images
    onProgress?.('Converting PDF pages to images...')
    let pageImages: string[] = []

    try {
      pageImages = await pdfToImages(file)
      onProgress?.(`PDF converted: ${pageImages.length} page(s) extracted`)
    } catch (err) {
      console.error('PDF.js conversion failed:', err)
      // Fallback: try Gemini with raw PDF
      onProgress?.('PDF conversion failed — trying Gemini directly...')
      const gemResult = await callGemini(file)
      if (gemResult && gemResult.records.length > 0) return gemResult
      throw new Error(
        'Could not read this PDF. Please try:\n' +
        '1. Take a clear photo/screenshot of the report\n' +
        '2. Upload as JPG or PNG instead'
      )
    }

    // Step 2: Send images to Groq Vision
    onProgress?.('Groq AI reading your lab report...')
    const groqResult = await callGroqVision(pageImages)
    if (groqResult && groqResult.records.length > 0) {
      console.log(`✓ PDF OCR via Groq: ${groqResult.records.length} records from ${pageImages.length} pages`)
      return groqResult
    }

    // Fallback to Gemini with raw PDF
    onProgress?.('Trying Gemini fallback...')
    const gemResult = await callGemini(file)
    if (gemResult && gemResult.records.length > 0) return gemResult

    throw new Error(
      'Could not extract data from this PDF. The report may be:\n' +
      '• A scanned image at low resolution\n' +
      '• Password protected\n' +
      'Try uploading a photo of the report instead (JPG/PNG).'
    )

  } else {
    // Image file — direct Groq Vision
    onProgress?.('Reading your lab report image...')
    const b64 = await fileToBase64(file)
    const groqResult = await callGroqVision([b64], file.type)

    if (groqResult && groqResult.records.length > 0) {
      console.log(`✓ Image OCR via Groq: ${groqResult.records.length} records`)
      return groqResult
    }

    // Gemini fallback for images
    onProgress?.('Trying Gemini fallback...')
    const gemResult = await callGemini(file)
    if (gemResult && gemResult.records.length > 0) return gemResult

    throw new Error(
      'Could not read this image. Please ensure:\n' +
      '• The image is clear and well-lit\n' +
      '• Text is readable (not blurry)\n' +
      '• VITE_GROQ_API_KEY is set in your .env'
    )
  }
}
