const GROQ_URL = 'https://api.groq.com/openai/v1/chat/completions'
const MODEL = 'llama-3.3-70b-versatile'

function getKey() {
  const k = import.meta.env.VITE_GROQ_API_KEY
  if (!k || k.includes('your-groq')) throw new Error('VITE_GROQ_API_KEY not set')
  return k
}

const VITALOS_SYSTEM_PROMPT = `You are a preventive healthcare AI assistant for an app called VitalOS.

Your role:
- Analyze user health data over time
- Detect early risk patterns
- Explain insights in simple, non-technical language
- Suggest actionable next steps

Rules:
- Do NOT diagnose diseases
- Do NOT create panic
- Always give balanced, calm explanations
- Highlight trends, not just single values
- Compare with normal ranges and past data
- Prioritize prevention and lifestyle suggestions

Output format (STRICT) for health analysis:
1. Summary (1-2 lines)
2. Key Observations (bullets)
3. Risk Signals (if any)
4. Recommended Actions (clear steps)
5. When to Consult a Doctor (if needed)

Tone:
- Friendly, calm, supportive
- Simple English (Indian users)
- No jargon unless explained

Always mention specific values from the data when available.
Reference Indian foods, labs (Thyrocare, SRL, Apollo), and lifestyle habits when relevant.`

export async function generateHealthInsights(records: Array<{
  test_name: string; value: number; unit: string
  reference_min?: number | null; reference_max?: number | null; recorded_at: string
}>): Promise<Array<{
  severity: 'critical'|'warning'|'info'|'good'
  title: string; description: string; recommendation: string
  risk_reduction?: string; related_metrics?: string[]; timeframe?: string
}>> {
  const key = getKey()
  const recStr = records.map(r => {
    const status = r.reference_max && r.value > r.reference_max ? 'HIGH'
      : r.reference_min && r.value < r.reference_min ? 'LOW' : 'NORMAL'
    return `${r.test_name}: ${r.value} ${r.unit} [${status}]${r.reference_min != null ? ` (normal: ${r.reference_min}-${r.reference_max})` : ''}`
  }).join('\n')

  const res = await fetch(GROQ_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` },
    body: JSON.stringify({
      model: MODEL,
      messages: [
        { role: 'system', content: VITALOS_SYSTEM_PROMPT },
        { role: 'user', content: `Analyze these lab results and generate 4-6 health insights as JSON. Focus on trends and prevention.\n\nLab results:\n${recStr}\n\nReturn ONLY valid JSON array, no markdown:\n[{"severity":"critical|warning|info|good","title":"string","description":"2-3 sentences mentioning specific values and trends","recommendation":"specific Indian-relevant action steps","risk_reduction":"e.g. -30% diabetes risk","related_metrics":["string"],"timeframe":"e.g. 3 months"}]` }
      ],
      max_tokens: 2000,
      temperature: 0.3,
    })
  })

  if (!res.ok) throw new Error(`Groq API error: ${res.status}`)
  const data = await res.json() as { choices: Array<{ message: { content: string } }> }
  const text = data.choices?.[0]?.message?.content || ''
  const cleaned = text.replace(/```json|```/g, '').trim()
  const match = cleaned.match(/\[[\s\S]*\]/)
  if (!match) return []
  const parsed = JSON.parse(match[0])
  return parsed.filter((i: { title?: unknown; description?: unknown }) => i.title && i.description)
}

export async function chatWithHealthAI(
  message: string,
  history: Array<{ role: 'user'|'assistant'; content: string }>,
  healthContext: string
): Promise<string> {
  const key = getKey()
  const res = await fetch(GROQ_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` },
    body: JSON.stringify({
      model: MODEL,
      messages: [
        { role: 'system', content: `${VITALOS_SYSTEM_PROMPT}\n\nPATIENT DATA:\n${healthContext || 'No lab data yet — advise user to upload reports'}` },
        ...history.slice(-10),
        { role: 'user', content: message }
      ],
      max_tokens: 500,
      temperature: 0.7,
    })
  })
  if (!res.ok) throw new Error(`Groq API error: ${res.status}`)
  const data = await res.json() as { choices: Array<{ message: { content: string } }> }
  return data.choices?.[0]?.message?.content || 'I had trouble responding. Please try again.'
}

export async function computeLongevityScore(records: Array<{
  test_name: string; value: number; unit: string
  reference_min?: number | null; reference_max?: number | null
}>): Promise<{ score: number; change: number; breakdown: Record<string, number> }> {
  const normal = records.filter(r => {
    if (r.reference_max && r.value > r.reference_max) return false
    if (r.reference_min && r.value < r.reference_min) return false
    return true
  }).length
  const score = records.length > 0 ? Math.round((normal / records.length) * 40 + 55) : 65
  const s = Math.min(95, Math.max(30, score))
  return { score: s, change: 2, breakdown: { metabolic: s-5, cardiovascular: s-8, sleep: s+5, activity: s, nutrition: s-3 } }
}
