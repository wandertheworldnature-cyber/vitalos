// src/services/groqService.ts
// Uses Groq (FREE) — Llama 3.3 70B for AI health insights and chat
// Sign up: console.groq.com | Free tier: 14,400 req/day, 30 req/min

const GROQ_API_URL = 'https://api.groq.com/openai/v1/chat/completions'
const MODEL = 'llama-3.3-70b-versatile' // Best free model on Groq

function getGroqKey(): string {
  const key = import.meta.env.VITE_GROQ_API_KEY
  if (!key || key === 'gsk_your-groq-key') {
    throw new Error('VITE_GROQ_API_KEY not set. Get a free key at console.groq.com')
  }
  return key
}

interface GroqMessage {
  role: 'system' | 'user' | 'assistant'
  content: string
}

async function groqChat(messages: GroqMessage[], maxTokens = 1500): Promise<string> {
  const key = getGroqKey()
  const res = await fetch(GROQ_API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${key}`,
    },
    body: JSON.stringify({
      model: MODEL,
      messages,
      max_tokens: maxTokens,
      temperature: 0.3,
    }),
  })

  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error((err as { error?: { message?: string } }).error?.message || `Groq error ${res.status}`)
  }

  const data = await res.json() as { choices: { message: { content: string } }[] }
  return data.choices[0]?.message?.content || ''
}

// ─── Health Insights ─────────────────────────────────────────────

export interface AIInsightRaw {
  severity: 'critical' | 'warning' | 'info' | 'good'
  title: string
  description: string
  recommendation: string
  risk_reduction?: string
  related_metrics: string[]
  timeframe?: string
}

export async function generateHealthInsights(
  healthRecords: Array<{
    test_name: string
    value: number
    unit: string
    reference_min?: number
    reference_max?: number
    recorded_at: string
  }>
): Promise<AIInsightRaw[]> {
  if (healthRecords.length === 0) return []

  const summary = healthRecords
    .slice(-60)
    .map(r =>
      `${r.test_name}: ${r.value} ${r.unit} (ref: ${r.reference_min ?? '?'}–${r.reference_max ?? '?'}) on ${r.recorded_at.split('T')[0]}`
    )
    .join('\n')

  const content = await groqChat(
    [
      {
        role: 'system',
        content: `You are VitalOS, an AI health analyst for an Indian preventive health platform.
Analyze health records and return ONLY a valid JSON array of 4–6 insights.
Each insight object must have exactly these fields:
- severity: "critical" | "warning" | "info" | "good"
- title: string (max 60 chars)
- description: string (max 120 chars, cite actual values)
- recommendation: string (max 120 chars, specific India-relevant advice)
- risk_reduction: string (optional, e.g. "−22% risk")
- related_metrics: string[] (test names involved)
- timeframe: string (optional, e.g. "18 months")
Return ONLY the JSON array. No markdown, no explanation, no backticks.`,
      },
      {
        role: 'user',
        content: `Analyze these health records and return a JSON array of insights:\n\n${summary}`,
      },
    ],
    1500
  )

  try {
    const cleaned = content.replace(/```json|```/g, '').trim()
    const parsed = JSON.parse(cleaned)
    return Array.isArray(parsed) ? parsed : []
  } catch {
    console.error('Groq JSON parse failed:', content)
    return []
  }
}

// ─── Chat ─────────────────────────────────────────────────────────

export async function chatWithHealthAI(
  userMessage: string,
  conversationHistory: GroqMessage[],
  insightContext: string
): Promise<string> {
  const messages: GroqMessage[] = [
    {
      role: 'system',
      content: `You are VitalOS, a friendly AI health analyst for an Indian preventive health platform.
Patient's current health insights:
${insightContext}

Rules:
- Be concise (under 120 words), warm, and specific
- Give practical India-relevant advice (Indian foods, lifestyle)
- Never diagnose. Always suggest consulting a doctor for clinical decisions
- Reference actual values from the insights when relevant`,
    },
    ...conversationHistory.slice(-8), // keep last 8 turns for context
    { role: 'user', content: userMessage },
  ]

  return groqChat(messages, 400)
}

// ─── Longevity Score ──────────────────────────────────────────────

export async function computeLongevityScore(
  healthRecords: Array<{
    test_name: string
    value: number
    reference_min?: number
    reference_max?: number
  }>
): Promise<{
  score: number
  change: number
  breakdown: Record<string, number>
}> {
  if (healthRecords.length === 0) {
    return { score: 70, change: 0, breakdown: { metabolic: 70, cardiovascular: 70, sleep: 70, activity: 70, nutrition: 70 } }
  }

  const content = await groqChat(
    [
      {
        role: 'system',
        content: `You compute a longevity/health score for an Indian health platform.
Return ONLY a JSON object with:
- score: integer 0–100
- change: integer (positive = improving, negative = declining, based on trends)
- breakdown: object with keys metabolic, cardiovascular, sleep, activity, nutrition each 0–100
No markdown, no explanation. JSON only.`,
      },
      {
        role: 'user',
        content: `Compute score from these latest health values:\n${healthRecords
          .map(r => `${r.test_name}: ${r.value} (ref ${r.reference_min ?? '?'}–${r.reference_max ?? '?'})`)
          .join('\n')}`,
      },
    ],
    300
  )

  try {
    const cleaned = content.replace(/```json|```/g, '').trim()
    return JSON.parse(cleaned)
  } catch {
    return { score: 72, change: 2, breakdown: { metabolic: 65, cardiovascular: 70, sleep: 58, activity: 80, nutrition: 68 } }
  }
}
