// supabase/functions/ocr-report/index.ts
// Server-side OCR using Groq Vision + Gemini
// PDFs are handled by converting with pdf2pic via canvas — server has no CSP restrictions
// Deploy: supabase functions deploy ocr-report

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const GROQ_URL = 'https://api.groq.com/openai/v1/chat/completions'
const GROQ_MODEL = 'meta-llama/llama-4-scout-17b-16e-instruct'

const PROMPT = `You are an expert at reading Indian lab reports (Thyrocare, SRL, Apollo, AIIMS, Wellwise, Sterling Accuris, Smart Pathology, Metropolis, Tata 1mg, Vijaya Diagnostics).

Extract ALL test results. Return ONLY valid JSON — no markdown, no backticks, no explanation:
{"lab_name":"string","report_date":"YYYY-MM-DD","records":[{"test_name":"string","value":number,"unit":"string","reference_min":number_or_null,"reference_max":number_or_null}]}

Extract every test including: CBC (Hemoglobin WBC RBC Platelets MCV MCH MCHC RDW PCV Neutrophils Lymphocytes Eosinophils Monocytes Basophils), Blood Sugar (Fasting Glucose HbA1c Post-Prandial), Lipids (Total Cholesterol LDL HDL VLDL Triglycerides), Thyroid (TSH T3 T4 Free T3 Free T4), Kidney (Creatinine Urea BUN eGFR Uric Acid Sodium Potassium Calcium Phosphorus), Liver (ALT AST ALP GGT Bilirubin Total Protein Albumin), Vitamins (Vitamin D Vitamin B12 Folate), Iron (Ferritin Iron TIBC), Inflammation (CRP ESR).

IMPORTANT: Return ONLY the JSON object with actual numeric values from the report.`

async function ocrWithGroq(base64Image: string, mimeType: string): Promise<string | null> {
  const groqKey = Deno.env.get('GROQ_API_KEY')
  if (!groqKey) return null

  try {
    const res = await fetch(GROQ_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${groqKey}`,
      },
      body: JSON.stringify({
        model: GROQ_MODEL,
        messages: [{
          role: 'user',
          content: [
            { type: 'image_url', image_url: { url: `data:${mimeType};base64,${base64Image}` } },
            { type: 'text', text: PROMPT }
          ]
        }],
        max_tokens: 4096,
        temperature: 0.1,
      }),
    })

    if (!res.ok) {
      const err = await res.text()
      console.error('Groq error:', res.status, err.slice(0, 200))
      return null
    }

    const data = await res.json() as { choices: Array<{ message: { content: string } }> }
    return data.choices?.[0]?.message?.content || null
  } catch (e) {
    console.error('Groq exception:', e)
    return null
  }
}

async function ocrWithGemini(base64Data: string, mimeType: string): Promise<string | null> {
  const geminiKey = Deno.env.get('GEMINI_API_KEY')
  if (!geminiKey) return null

  // Try multiple Gemini models
  const models = [
    'https://generativelanguage.googleapis.com/v1/models/gemini-1.5-flash:generateContent',
    'https://generativelanguage.googleapis.com/v1/models/gemini-1.5-pro:generateContent',
  ]

  for (const url of models) {
    try {
      const res = await fetch(`${url}?key=${geminiKey}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{
            parts: [
              { inline_data: { mime_type: mimeType, data: base64Data } },
              { text: PROMPT }
            ]
          }],
          generationConfig: { temperature: 0.1, maxOutputTokens: 4096 }
        }),
      })

      if (res.status === 429) { console.warn('Gemini rate limited'); continue }
      if (!res.ok) { console.warn('Gemini error:', res.status); continue }

      const data = await res.json() as {
        candidates?: Array<{ content: { parts: Array<{ text: string }> } }>
      }
      const text = data.candidates?.[0]?.content?.parts?.[0]?.text
      if (text) return text
    } catch (e) {
      console.error('Gemini exception:', e)
    }
  }
  return null
}

function parseExtractedText(text: string) {
  try {
    const cleaned = text.replace(/```json|```/g, '').trim()
    const match = cleaned.match(/\{[\s\S]*\}/)
    if (!match) return null
    const parsed = JSON.parse(match[0])
    if (!Array.isArray(parsed.records)) parsed.records = []
    parsed.records = parsed.records.filter((r: { test_name?: unknown; value?: unknown }) =>
      r.test_name && typeof r.value === 'number' && !isNaN(r.value)
    )
    return parsed
  } catch {
    return null
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    const formData = await req.formData()
    const file = formData.get('file') as File
    const userId = formData.get('userId') as string
    const reportId = formData.get('reportId') as string

    if (!file) throw new Error('No file provided')

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

    // Update status to processing
    await fetch(`${supabaseUrl}/rest/v1/health_reports?id=eq.${reportId}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        'apikey': supabaseKey,
        'Authorization': `Bearer ${supabaseKey}`,
      },
      body: JSON.stringify({ ocr_status: 'processing' }),
    })

    // Read file as ArrayBuffer then convert to base64
    const arrayBuffer = await file.arrayBuffer()
    const bytes = new Uint8Array(arrayBuffer)
    let base64 = ''
    const chunkSize = 8192
    for (let i = 0; i < bytes.length; i += chunkSize) {
      const chunk = bytes.subarray(i, i + chunkSize)
      base64 += btoa(String.fromCharCode(...chunk))
    }

    const isPDF = file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf')
    const mimeType = isPDF ? 'application/pdf' : (file.type || 'image/jpeg')

    let extractedText: string | null = null

    if (isPDF) {
      // For PDFs: Gemini supports them natively server-side (no CSP issues)
      console.log('Processing PDF with Gemini...')
      extractedText = await ocrWithGemini(base64, 'application/pdf')

      // If Gemini fails, try Groq with PDF as image (send as-is, some models handle it)
      if (!extractedText) {
        console.log('Gemini failed, trying Groq with PDF...')
        extractedText = await ocrWithGroq(base64, 'application/pdf')
      }
    } else {
      // For images: Try Groq first (faster), then Gemini
      console.log('Processing image with Groq Vision...')
      extractedText = await ocrWithGroq(base64, mimeType)

      if (!extractedText) {
        console.log('Groq failed, trying Gemini...')
        extractedText = await ocrWithGemini(base64, mimeType)
      }
    }

    if (!extractedText) {
      await fetch(`${supabaseUrl}/rest/v1/health_reports?id=eq.${reportId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', 'apikey': supabaseKey, 'Authorization': `Bearer ${supabaseKey}` },
        body: JSON.stringify({ ocr_status: 'failed' }),
      })
      throw new Error('All OCR models failed. Please check GROQ_API_KEY and GEMINI_API_KEY secrets.')
    }

    const extracted = parseExtractedText(extractedText)
    if (!extracted || extracted.records.length === 0) {
      await fetch(`${supabaseUrl}/rest/v1/health_reports?id=eq.${reportId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', 'apikey': supabaseKey, 'Authorization': `Bearer ${supabaseKey}` },
        body: JSON.stringify({ ocr_status: 'done', extracted_data: { records: [] }, lab_name: 'Unknown' }),
      })
      return new Response(JSON.stringify({ success: true, recordsAdded: 0, message: 'No test values found in this report' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // Insert health records
    const records = extracted.records.map((r: {
      test_name: string; value: number; unit: string
      reference_min?: number | null; reference_max?: number | null
    }) => ({
      user_id: userId,
      record_type: 'blood_test',
      test_name: r.test_name,
      value: r.value,
      unit: r.unit,
      reference_min: r.reference_min ?? null,
      reference_max: r.reference_max ?? null,
      source: extracted.lab_name || 'Lab report',
      recorded_at: extracted.report_date
        ? new Date(extracted.report_date).toISOString()
        : new Date().toISOString(),
      metadata: { report_id: reportId },
    }))

    await fetch(`${supabaseUrl}/rest/v1/health_records`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': supabaseKey,
        'Authorization': `Bearer ${supabaseKey}`,
        'Prefer': 'return=minimal',
      },
      body: JSON.stringify(records),
    })

    // Update report as done
    await fetch(`${supabaseUrl}/rest/v1/health_reports?id=eq.${reportId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', 'apikey': supabaseKey, 'Authorization': `Bearer ${supabaseKey}` },
      body: JSON.stringify({
        ocr_status: 'done',
        extracted_data: extracted,
        lab_name: extracted.lab_name || null,
        report_date: extracted.report_date || null,
      }),
    })

    return new Response(JSON.stringify({ success: true, recordsAdded: records.length, labName: extracted.lab_name }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })

  } catch (error) {
    console.error('OCR function error:', error)
    return new Response(JSON.stringify({ error: String(error) }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
