// ================================================================
// VitalOS AI Engine — Multi-layer Prompt System
// Modes: INSIGHT | EXPLAIN | PREDICT | ACTION_PLAN
// Output: Structured JSON always
// ================================================================

const GROQ_URL = 'https://api.groq.com/openai/v1/chat/completions'
const MODEL    = 'llama-3.3-70b-versatile'

function getKey() {
  const k = import.meta.env.VITE_GROQ_API_KEY
  if (!k || k.includes('your-groq')) throw new Error('NO_GROQ_KEY')
  return k
}

// ── Layer 1: MASTER SYSTEM PROMPT ────────────────────────────────
const MASTER_SYSTEM_PROMPT = `You are VitalOS AI — a preventive healthcare AI assistant for an Indian health platform.

Your role:
- Analyze user health data over time
- Detect early risk patterns before they become serious
- Explain insights in simple, non-technical language
- Suggest actionable next steps tailored to Indian lifestyle

Rules:
- Do NOT diagnose diseases
- Do NOT create panic or use alarming language
- Always give balanced, calm, supportive explanations
- Highlight TRENDS, not just single values
- Compare with normal ranges AND past data
- Prioritize prevention and lifestyle suggestions
- Reference Indian foods (millets, dal, roti, sabzi), Indian labs (Thyrocare, SRL, Apollo, Wellwise)
- Always mention specific numeric values from the data

Tone: Friendly, calm, supportive. Simple English. Like a doctor who knows you personally.

ALWAYS return valid JSON. No markdown. No backticks. No explanation text outside JSON.`

// ── Layer 2: USER CONTEXT ─────────────────────────────────────────
export interface UserContext {
  age?: number
  gender?: string
  weight?: number
  height?: number
  conditions?: string[]
  lifestyle?: string
  dietType?: 'veg' | 'non-veg' | 'vegan' | 'unknown'
  sleepHours?: number
  activityLevel?: 'sedentary' | 'light' | 'moderate' | 'active' | 'unknown'
  goals?: string[]
  name?: string
}

function buildUserContext(ctx: UserContext): string {
  return `
User Profile:
- Name: ${ctx.name || 'Patient'}
- Age: ${ctx.age || 'Unknown'}
- Gender: ${ctx.gender || 'Unknown'}
- Weight: ${ctx.weight ? `${ctx.weight} kg` : 'Unknown'}
- Height: ${ctx.height ? `${ctx.height} cm` : 'Unknown'}
- Known conditions: ${ctx.conditions?.join(', ') || 'None reported'}
- Diet type: ${ctx.dietType || 'Unknown'}
- Sleep: ${ctx.sleepHours ? `${ctx.sleepHours} hours/night` : 'Unknown'}
- Activity level: ${ctx.activityLevel || 'Unknown'}
- Lifestyle notes: ${ctx.lifestyle || 'Not provided'}

Goals:
${(ctx.goals || ['Improve longevity score', 'Prevent future diseases']).map(g => `- ${g}`).join('\n')}`
}

// ── Layer 3: HEALTH DATA (structured, never raw JSON) ─────────────
export interface HealthRecord {
  test_name: string
  value: number
  unit: string
  reference_min?: number | null
  reference_max?: number | null
  recorded_at?: string
}

export interface TrendPoint { date: string; value: number }

function buildHealthDataPrompt(
  records: HealthRecord[],
  trends?: Record<string, TrendPoint[]>,
  previousInsights?: string[]
): string {
  // Categorize records
  const groups: Record<string, HealthRecord[]> = {
    'Blood Count (CBC)': [],
    'Blood Sugar': [],
    'Lipids': [],
    'Thyroid': [],
    'Kidney Function': [],
    'Liver Function': [],
    'Vitamins & Minerals': [],
    'Inflammation': [],
    'Other': [],
  }

  for (const r of records) {
    const name = r.test_name.toLowerCase()
    if (['hemoglobin','wbc','rbc','platelets','mcv','mch','mchc','rdw','pcv','neutrophil','lymphocyte','eosinophil','monocyte','basophil','tlc'].some(k => name.includes(k))) groups['Blood Count (CBC)'].push(r)
    else if (['glucose','hba1c','insulin','post prandial','fasting'].some(k => name.includes(k))) groups['Blood Sugar'].push(r)
    else if (['cholesterol','ldl','hdl','vldl','triglyceride','non-hdl'].some(k => name.includes(k))) groups['Lipids'].push(r)
    else if (['tsh','t3','t4','thyroid','anti-tpo'].some(k => name.includes(k))) groups['Thyroid'].push(r)
    else if (['creatinine','urea','bun','egfr','uric acid','sodium','potassium','calcium','phosphorus','chloride'].some(k => name.includes(k))) groups['Kidney Function'].push(r)
    else if (['alt','sgpt','ast','sgot','alp','ggt','bilirubin','albumin','globulin','protein'].some(k => name.includes(k))) groups['Liver Function'].push(r)
    else if (['vitamin','b12','folate','iron','ferritin','tibc','zinc','magnesium'].some(k => name.includes(k))) groups['Vitamins & Minerals'].push(r)
    else if (['crp','esr','homocysteine','fibrinogen'].some(k => name.includes(k))) groups['Inflammation'].push(r)
    else groups['Other'].push(r)
  }

  let dataStr = '\nLatest Lab Results:\n'
  for (const [group, recs] of Object.entries(groups)) {
    if (recs.length === 0) continue
    dataStr += `\n${group}:\n`
    for (const r of recs) {
      const isHigh = r.reference_max != null && r.value > r.reference_max
      const isLow  = r.reference_min != null && r.value < r.reference_min
      const status = isHigh ? ' ⚠️ HIGH' : isLow ? ' ⚠️ LOW' : ' ✓ Normal'
      const ref    = r.reference_min != null && r.reference_max != null ? ` (Ref: ${r.reference_min}–${r.reference_max} ${r.unit})` : ''
      dataStr += `- ${r.test_name}: ${r.value} ${r.unit}${ref}${status}\n`
    }
  }

  // Trend data
  if (trends && Object.keys(trends).length > 0) {
    dataStr += '\nTrend Data (last 3 readings):\n'
    for (const [metric, points] of Object.entries(trends)) {
      if (points.length < 2) continue
      const vals = points.slice(-3).map(p => p.value).join(' → ')
      const first = points[points.length - 3]?.value || points[0].value
      const last  = points[points.length - 1].value
      const pct   = ((last - first) / Math.abs(first) * 100).toFixed(1)
      const dir   = last > first ? '📈 Rising' : last < first ? '📉 Declining' : '→ Stable'
      dataStr += `- ${metric}: ${vals} ${r.unit || ''} (${dir}, ${pct}%)\n`
    }
  }

  // Previous insights memory
  if (previousInsights && previousInsights.length > 0) {
    dataStr += '\nPrevious AI Observations (memory):\n'
    previousInsights.slice(0, 3).forEach(i => { dataStr += `- ${i}\n` })
  }

  // Flags summary
  const abnormal = records.filter(r =>
    (r.reference_max != null && r.value > r.reference_max) ||
    (r.reference_min != null && r.value < r.reference_min)
  )
  if (abnormal.length > 0) {
    dataStr += '\nFlags (out of range):\n'
    abnormal.forEach(r => {
      const isHigh = r.reference_max != null && r.value > r.reference_max
      dataStr += `- ${r.test_name}: ${r.value} ${r.unit} — ${isHigh ? 'Above' : 'Below'} normal range\n`
    })
  }

  return dataStr
}

// ── AI Response Types ─────────────────────────────────────────────
export interface AIInsightResponse {
  summary: string
  observations: string[]
  risks: Array<{ signal: string; level: 'low'|'medium'|'high'; metric?: string }>
  actions: Array<{ step: string; category: string; timeframe: string }>
  doctor_advice: string
  severity: 'good'|'info'|'warning'|'critical'
  title: string
}

export interface ExplainResponse {
  what_it_is: string
  why_it_changes: string[]
  your_value_context: string
  when_to_worry: string
  what_you_can_do: string[]
  doctor_advice: string
}

export interface PredictionResponse {
  risks: Array<{
    condition: string
    probability: 'low'|'moderate'|'high'
    timeframe: string
    contributing_factors: string[]
    prevention_steps: string[]
  }>
  positive_outlook: string
  next_test_recommendation: string
}

export interface ActionPlanResponse {
  plan_title: string
  duration: string
  diet: Array<{ day?: string; suggestion: string; reasoning: string }>
  activity: Array<{ suggestion: string; frequency: string; benefit: string }>
  sleep: string[]
  daily_habits: Array<{ habit: string; time: string; impact: string }>
  week_goal: string
  motivation: string
}

// ── Layer 4: MODE-BASED INSTRUCTIONS ─────────────────────────────

function insightModePrompt(): string {
  return `
Task: INSIGHT MODE
Analyze the health data and generate preventive insights.
Focus on trends, early warning signals, and actionable prevention.

Return JSON:
{
  "title": "brief insight title",
  "summary": "1-2 lines overview of overall health",
  "observations": ["bullet point observations, mention specific values"],
  "risks": [{"signal": "description", "level": "low|medium|high", "metric": "test name"}],
  "actions": [{"step": "specific action", "category": "diet|exercise|lifestyle|medical", "timeframe": "today|1 week|1 month"}],
  "doctor_advice": "when and which specialist to see, or 'No immediate consultation needed'",
  "severity": "good|info|warning|critical"
}`
}

function explainModePrompt(metric: string): string {
  return `
Task: EXPLAIN MODE
The user asked about: "${metric}"
Explain this health metric in simple terms.

Return JSON:
{
  "what_it_is": "simple explanation of what this metric measures",
  "why_it_changes": ["reason 1", "reason 2", "reason 3"],
  "your_value_context": "personalized explanation of their specific value",
  "when_to_worry": "clear guidance on concerning levels",
  "what_you_can_do": ["action 1", "action 2", "action 3"],
  "doctor_advice": "when to consult and which specialist"
}`
}

function predictModePrompt(): string {
  return `
Task: PREDICTION MODE
Based on trends and current values, estimate potential future health risks.
Use probability language. Never be certain. Focus on prevention.

Return JSON:
{
  "risks": [
    {
      "condition": "condition name",
      "probability": "low|moderate|high",
      "timeframe": "estimated timeframe e.g. 12-18 months",
      "contributing_factors": ["factor 1", "factor 2"],
      "prevention_steps": ["step 1", "step 2", "step 3"]
    }
  ],
  "positive_outlook": "encouraging message about what's going well",
  "next_test_recommendation": "which tests to recheck and when"
}`
}

function actionPlanModePrompt(days: number = 7): string {
  return `
Task: ACTION PLAN MODE
Create a practical ${days}-day health improvement plan based on the data.
Make it realistic for Indian lifestyle. Include specific Indian foods.

Return JSON:
{
  "plan_title": "catchy plan name",
  "duration": "${days} days",
  "diet": [
    {"suggestion": "specific food/meal suggestion", "reasoning": "why this helps"}
  ],
  "activity": [
    {"suggestion": "exercise or activity", "frequency": "daily|3x/week etc", "benefit": "specific benefit"}
  ],
  "sleep": ["sleep habit 1", "sleep habit 2"],
  "daily_habits": [
    {"habit": "specific habit", "time": "morning|afternoon|evening|night", "impact": "health impact"}
  ],
  "week_goal": "one measurable goal for this week",
  "motivation": "personalized motivational message"
}`
}

// ── CORE AI CALL ───────────────────────────────────────────────────
async function callGroq(systemPrompt: string, userPrompt: string): Promise<string> {
  const key = getKey()
  const res = await fetch(GROQ_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` },
    body: JSON.stringify({
      model: MODEL,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user',   content: userPrompt   }
      ],
      max_tokens: 2000,
      temperature: 0.3,
      response_format: { type: 'json_object' },
    })
  })
  if (!res.ok) {
    const err = await res.text()
    throw new Error(`Groq API ${res.status}: ${err.slice(0, 100)}`)
  }
  const data = await res.json() as { choices: Array<{ message: { content: string } }> }
  return data.choices?.[0]?.message?.content || '{}'
}

function parseJSON<T>(text: string): T {
  try {
    const cleaned = text.replace(/```json|```/g, '').trim()
    // Handle both direct JSON and JSON wrapped in an object
    const parsed = JSON.parse(cleaned)
    // If response has a wrapper key, unwrap it
    const keys = Object.keys(parsed)
    if (keys.length === 1 && typeof parsed[keys[0]] === 'object') {
      return parsed[keys[0]] as T
    }
    return parsed as T
  } catch {
    console.error('JSON parse failed:', text.slice(0, 200))
    throw new Error('AI response could not be parsed')
  }
}

// ── PUBLIC API ─────────────────────────────────────────────────────

// Generate structured insights
export async function generateInsightMode(
  records: HealthRecord[],
  userCtx: UserContext,
  trends?: Record<string, TrendPoint[]>,
  previousInsights?: string[]
): Promise<AIInsightResponse[]> {
  const system = MASTER_SYSTEM_PROMPT
  const user   = `${buildUserContext(userCtx)}\n${buildHealthDataPrompt(records, trends, previousInsights)}\n${insightModePrompt()}\n\nGenerate 4-5 insights as a JSON array: {"insights": [...]}`

  const raw = await callGroq(system, user)
  const parsed = parseJSON<{ insights?: AIInsightResponse[] } | AIInsightResponse[]>(raw)
  const insights = Array.isArray(parsed) ? parsed : (parsed as { insights?: AIInsightResponse[] }).insights || []
  return insights.filter(i => i.title && i.summary)
}

// Explain a specific metric
export async function explainMetric(
  metric: string,
  value: number,
  unit: string,
  refMin?: number,
  refMax?: number,
  userCtx?: UserContext
): Promise<ExplainResponse> {
  const records: HealthRecord[] = [{ test_name: metric, value, unit, reference_min: refMin, reference_max: refMax }]
  const system = MASTER_SYSTEM_PROMPT
  const user   = `${userCtx ? buildUserContext(userCtx) : ''}\n${buildHealthDataPrompt(records)}\n${explainModePrompt(metric)}`

  const raw = await callGroq(system, user)
  return parseJSON<ExplainResponse>(raw)
}

// Predict future risks
export async function predictRisks(
  records: HealthRecord[],
  userCtx: UserContext,
  trends?: Record<string, TrendPoint[]>
): Promise<PredictionResponse> {
  const system = MASTER_SYSTEM_PROMPT
  const user   = `${buildUserContext(userCtx)}\n${buildHealthDataPrompt(records, trends)}\n${predictModePrompt()}`

  const raw = await callGroq(system, user)
  return parseJSON<PredictionResponse>(raw)
}

// Generate action plan
export async function generateActionPlan(
  records: HealthRecord[],
  userCtx: UserContext,
  days: number = 7
): Promise<ActionPlanResponse> {
  const system = MASTER_SYSTEM_PROMPT
  const user   = `${buildUserContext(userCtx)}\n${buildHealthDataPrompt(records)}\n${actionPlanModePrompt(days)}`

  const raw = await callGroq(system, user)
  return parseJSON<ActionPlanResponse>(raw)
}

// Conversational chat (context-aware)
export async function chatWithVitalOS(
  message: string,
  history: Array<{ role: 'user'|'assistant'; content: string }>,
  records: HealthRecord[],
  userCtx: UserContext
): Promise<string> {
  const key = getKey()

  // Auto-detect mode from message
  let modeInstruction = ''
  const msg = message.toLowerCase()
  if (msg.includes('predict') || msg.includes('risk') || msg.includes('chance') || msg.includes('will i')) {
    modeInstruction = '\n[Use PREDICTION MODE thinking — probability language, preventive focus]'
  } else if (msg.includes('plan') || msg.includes('what should i do') || msg.includes('improve')) {
    modeInstruction = '\n[Use ACTION PLAN MODE thinking — practical, specific, Indian lifestyle]'
  } else if (msg.includes('explain') || msg.includes('what is') || msg.includes('why is') || msg.includes('what does')) {
    modeInstruction = '\n[Use EXPLAIN MODE — simple terms, specific values, practical advice]'
  } else {
    modeInstruction = '\n[Use INSIGHT MODE — trends, patterns, prevention]'
  }

  const systemPrompt = `${MASTER_SYSTEM_PROMPT}

${buildUserContext(userCtx)}

${records.length > 0 ? buildHealthDataPrompt(records) : 'No lab data available yet.'}

${modeInstruction}

For conversational responses, reply in plain text (not JSON). Be concise (under 200 words). Be personalized and warm.`

  const res = await fetch(GROQ_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` },
    body: JSON.stringify({
      model: MODEL,
      messages: [
        { role: 'system', content: systemPrompt },
        ...history.slice(-10),
        { role: 'user', content: message }
      ],
      max_tokens: 500,
      temperature: 0.7,
    })
  })

  if (!res.ok) throw new Error(`Groq ${res.status}`)
  const data = await res.json() as { choices: Array<{ message: { content: string } }> }
  return data.choices?.[0]?.message?.content || 'I had trouble responding. Please try again.'
}
