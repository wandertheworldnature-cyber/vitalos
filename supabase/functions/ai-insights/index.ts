// supabase/functions/ai-insights/index.ts
// Deploy: supabase functions deploy ai-insights
import "https://deno.land/x/xhr@0.1.0/mod.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { healthRecords, userId } = await req.json()
    const anthropicKey = Deno.env.get('ANTHROPIC_API_KEY')

    if (!anthropicKey) throw new Error('ANTHROPIC_API_KEY not set')

    // Build health summary for Claude
    const summary = healthRecords
      .slice(-50) // last 50 records
      .map((r: Record<string, unknown>) =>
        `${r.test_name}: ${r.value} ${r.unit} (ref: ${r.reference_min ?? '?'}-${r.reference_max ?? '?'}) on ${r.recorded_at}`
      )
      .join('\n')

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': anthropicKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 2000,
        system: `You are VitalOS, an AI health analyst for an Indian preventive health platform.
Analyze the provided health records and return ONLY a JSON array of insights.
Each insight must have: severity (critical/warning/info/good), title, description, recommendation, risk_reduction (optional), related_metrics (array), timeframe (optional).
Be specific, cite actual values, give actionable Indian-context advice (diet, lifestyle).
Keep descriptions under 100 words. Return valid JSON only, no markdown.`,
        messages: [{
          role: 'user',
          content: `Analyze these health records and return 4-6 insights as a JSON array:\n\n${summary}`
        }]
      })
    })

    const data = await response.json()
    const content = data.content[0].text

    let insights
    try {
      insights = JSON.parse(content.replace(/```json|```/g, '').trim())
    } catch {
      insights = []
    }

    // Store insights in Supabase
    const supabaseUrl = Deno.env.get('SUPABASE_URL')
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
    const authHeader = req.headers.get('Authorization')

    if (supabaseUrl && supabaseKey && insights.length > 0) {
      await fetch(`${supabaseUrl}/rest/v1/ai_insights`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'apikey': supabaseKey,
          'Authorization': `Bearer ${supabaseKey}`,
        },
        body: JSON.stringify(
          insights.map((ins: Record<string, unknown>) => ({
            ...ins,
            user_id: userId,
            generated_at: new Date().toISOString(),
          }))
        )
      })
    }

    return new Response(JSON.stringify({ insights }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (error) {
    return new Response(JSON.stringify({ error: String(error) }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
