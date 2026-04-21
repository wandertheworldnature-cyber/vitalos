// supabase/functions/ocr-report/index.ts
// Deploy: supabase functions deploy ocr-report
// Uses Google Document AI for OCR, then Claude to extract structured data

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { reportId, fileUrl, userId } = await req.json()
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const anthropicKey = Deno.env.get('ANTHROPIC_API_KEY')!
    const gcpProjectId = Deno.env.get('GOOGLE_PROJECT_ID')
    const gcpProcessorId = Deno.env.get('GOOGLE_PROCESSOR_ID')

    // Update status to processing
    await fetch(`${supabaseUrl}/rest/v1/health_reports?id=eq.${reportId}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        'apikey': supabaseKey,
        'Authorization': `Bearer ${supabaseKey}`,
      },
      body: JSON.stringify({ ocr_status: 'processing' })
    })

    // Fetch the file
    const fileRes = await fetch(fileUrl)
    const fileBuffer = await fileRes.arrayBuffer()
    const base64File = btoa(String.fromCharCode(...new Uint8Array(fileBuffer)))

    let ocrText = ''

    // Try Google Document AI
    if (gcpProjectId && gcpProcessorId) {
      const gcpToken = Deno.env.get('GCP_ACCESS_TOKEN') // Set via service account
      if (gcpToken) {
        const docAiUrl = `https://documentai.googleapis.com/v1/projects/${gcpProjectId}/locations/us/processors/${gcpProcessorId}:process`
        const docAiRes = await fetch(docAiUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${gcpToken}`,
          },
          body: JSON.stringify({
            rawDocument: { content: base64File, mimeType: 'application/pdf' }
          })
        })
        const docAiData = await docAiRes.json()
        ocrText = docAiData?.document?.text || ''
      }
    }

    // Fallback: use Claude's vision to extract text from image/PDF
    if (!ocrText) {
      const claudeRes = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': anthropicKey,
          'anthropic-version': '2023-06-01',
        },
        body: JSON.stringify({
          model: 'claude-sonnet-4-20250514',
          max_tokens: 3000,
          messages: [{
            role: 'user',
            content: [
              {
                type: 'document',
                source: { type: 'base64', media_type: 'application/pdf', data: base64File }
              },
              {
                type: 'text',
                text: 'Extract all text from this lab report. Return the raw text only.'
              }
            ]
          }]
        })
      })
      const claudeData = await claudeRes.json()
      ocrText = claudeData.content?.[0]?.text || ''
    }

    // Now use Claude to extract structured health records from the text
    const extractRes = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': anthropicKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 2000,
        system: `Extract health test results from lab report text. Return ONLY a JSON object with:
- lab_name: string (lab/hospital name)
- report_date: string (YYYY-MM-DD format, guess if unclear)
- records: array of { test_name, value (number), unit, reference_min (number or null), reference_max (number or null) }
Common tests: CBC, Hemoglobin, WBC, Platelets, Fasting Glucose, HbA1c, Total Cholesterol, LDL, HDL, Triglycerides, TSH, T3, T4, Creatinine, Urea, ALT, AST, Bilirubin, Vitamin D, B12.
Return valid JSON only.`,
        messages: [{
          role: 'user',
          content: `Extract structured data from this lab report:\n\n${ocrText.slice(0, 4000)}`
        }]
      })
    })

    const extractData = await extractRes.json()
    const extractedText = extractData.content?.[0]?.text || '{}'
    let parsed: { lab_name?: string; report_date?: string; records?: Record<string, unknown>[] } = {}
    try {
      parsed = JSON.parse(extractedText.replace(/```json|```/g, '').trim())
    } catch (_) {
      parsed = { records: [] }
    }

    // Update report with OCR results
    await fetch(`${supabaseUrl}/rest/v1/health_reports?id=eq.${reportId}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        'apikey': supabaseKey,
        'Authorization': `Bearer ${supabaseKey}`,
      },
      body: JSON.stringify({
        ocr_status: 'done',
        ocr_text: ocrText,
        extracted_data: parsed,
        lab_name: parsed.lab_name,
        report_date: parsed.report_date,
      })
    })

    // Insert extracted records into health_records table
    if (parsed.records && parsed.records.length > 0) {
      const records = parsed.records.map((r: Record<string, unknown>) => ({
        user_id: userId,
        record_type: 'blood_test',
        test_name: r.test_name,
        value: r.value,
        unit: r.unit,
        reference_min: r.reference_min,
        reference_max: r.reference_max,
        source: parsed.lab_name || 'Lab report',
        recorded_at: parsed.report_date
          ? new Date(parsed.report_date as string).toISOString()
          : new Date().toISOString(),
        metadata: { report_id: reportId }
      }))

      await fetch(`${supabaseUrl}/rest/v1/health_records`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'apikey': supabaseKey,
          'Authorization': `Bearer ${supabaseKey}`,
        },
        body: JSON.stringify(records)
      })
    }

    return new Response(JSON.stringify({ success: true, extracted: parsed }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (error) {
    console.error('OCR error:', error)
    return new Response(JSON.stringify({ error: String(error) }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
