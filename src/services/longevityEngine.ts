// ================================================================
// VitalOS Longevity Score Engine
// Formula: Biomarkers(40%) + Lifestyle(25%) + Trends(15%) + Preventive(10%) + Consistency(10%)
// ================================================================

export interface LongevityBreakdown {
  total: number
  biomarkers: number
  lifestyle: number
  trends: number
  preventive: number
  consistency: number
  biologicalAge: number | null
  interpretation: 'excellent' | 'good' | 'at_risk' | 'high_risk'
  label: string
  color: string
  impactActions: ImpactAction[]
  metricScores: MetricScore[]
}

export interface MetricScore {
  name: string
  value: number
  unit: string
  score: number
  status: 'optimal' | 'borderline' | 'concerning'
}

export interface ImpactAction {
  action: string
  points: number
  category: string
  icon: string
}

interface HealthRecord {
  test_name: string
  value: number
  unit: string
  reference_min?: number | null
  reference_max?: number | null
  recorded_at: string
}

interface LifestyleData {
  steps?: number
  sleepHours?: number
  exerciseDaysPerWeek?: number
  dietQuality?: 'poor' | 'fair' | 'good' | 'excellent'
}

// ── A. Biomarker scoring per metric ──────────────────────────────
function scoreMetric(value: number, min: number, max: number): number {
  if (value >= min && value <= max) return 100
  const deviation = Math.min(Math.abs(value - min), Math.abs(value - max))
  return Math.max(0, 100 - deviation * 8)
}

// Reference ranges for key biomarkers
const BIOMARKER_REFS: Record<string, { min: number; max: number; weight: number; unit: string }> = {
  'hemoglobin':        { min: 12.0, max: 17.5, weight: 1.5, unit: 'g/dL' },
  'fasting glucose':   { min: 70,   max: 99,   weight: 2.0, unit: 'mg/dL' },
  'hba1c':             { min: 4.0,  max: 5.6,  weight: 2.0, unit: '%' },
  'ldl cholesterol':   { min: 0,    max: 130,  weight: 1.5, unit: 'mg/dL' },
  'hdl':               { min: 40,   max: 100,  weight: 1.0, unit: 'mg/dL' },
  'total cholesterol': { min: 0,    max: 200,  weight: 1.2, unit: 'mg/dL' },
  'triglycerides':     { min: 0,    max: 150,  weight: 1.2, unit: 'mg/dL' },
  'tsh':               { min: 0.4,  max: 4.0,  weight: 1.0, unit: 'mIU/L' },
  'vitamin d':         { min: 30,   max: 100,  weight: 1.0, unit: 'ng/mL' },
  'creatinine':        { min: 0.6,  max: 1.2,  weight: 1.0, unit: 'mg/dL' },
  'alt':               { min: 0,    max: 40,   weight: 0.8, unit: 'U/L' },
  'ast':               { min: 0,    max: 40,   weight: 0.8, unit: 'U/L' },
  'uric acid':         { min: 3.5,  max: 7.2,  weight: 0.8, unit: 'mg/dL' },
  'vitamin b12':       { min: 200,  max: 900,  weight: 0.8, unit: 'pg/mL' },
  'crp':               { min: 0,    max: 5,    weight: 1.0, unit: 'mg/L' },
  'ferritin':          { min: 20,   max: 250,  weight: 0.8, unit: 'ng/mL' },
}

function findBiomarkerRef(testName: string) {
  const lower = testName.toLowerCase().trim()
  for (const [key, ref] of Object.entries(BIOMARKER_REFS)) {
    if (lower.includes(key) || key.includes(lower.split(' ')[0])) return { key, ref }
  }
  return null
}

function calcBiomarkerScore(records: HealthRecord[]): { score: number; metricScores: MetricScore[] } {
  if (records.length === 0) return { score: 70, metricScores: [] }

  const metricScores: MetricScore[] = []
  let totalWeight = 0
  let weightedSum = 0

  for (const r of records) {
    const found = findBiomarkerRef(r.test_name)
    if (!found) continue

    const { ref } = found
    const min = r.reference_min ?? ref.min
    const max = r.reference_max ?? ref.max
    const s = scoreMetric(r.value, min, max)
    const deviation = Math.abs(r.value - (min + max) / 2) / ((max - min) / 2)

    metricScores.push({
      name: r.test_name,
      value: r.value,
      unit: r.unit,
      score: Math.round(s),
      status: s >= 85 ? 'optimal' : s >= 60 ? 'borderline' : 'concerning',
    })

    weightedSum += s * ref.weight
    totalWeight += ref.weight
  }

  if (totalWeight === 0) return { score: 70, metricScores: [] }
  return { score: Math.round(weightedSum / totalWeight), metricScores }
}

// ── B. Lifestyle score ────────────────────────────────────────────
function calcLifestyleScore(data: LifestyleData): number {
  const scores: number[] = []

  if (data.steps !== undefined) {
    if (data.steps >= 10000) scores.push(100)
    else if (data.steps >= 8000) scores.push(90)
    else if (data.steps >= 6000) scores.push(75)
    else if (data.steps >= 4000) scores.push(55)
    else scores.push(30)
  }

  if (data.sleepHours !== undefined) {
    const s = data.sleepHours
    if (s >= 7 && s <= 8.5) scores.push(100)
    else if ((s >= 6.5 && s < 7) || (s > 8.5 && s <= 9)) scores.push(80)
    else if ((s >= 6 && s < 6.5) || (s > 9 && s <= 10)) scores.push(60)
    else scores.push(35)
  }

  if (data.exerciseDaysPerWeek !== undefined) {
    const d = data.exerciseDaysPerWeek
    if (d >= 4 && d <= 5) scores.push(100)
    else if (d === 3 || d === 6) scores.push(85)
    else if (d === 2) scores.push(65)
    else if (d === 1) scores.push(45)
    else scores.push(20)
  }

  if (data.dietQuality) {
    const dMap = { poor: 20, fair: 50, good: 80, excellent: 100 }
    scores.push(dMap[data.dietQuality])
  }

  if (scores.length === 0) return 65 // default if no lifestyle data
  return Math.round(scores.reduce((a, b) => a + b, 0) / scores.length)
}

// ── C. Trends score ───────────────────────────────────────────────
function calcTrendScore(allRecords: HealthRecord[]): number {
  if (allRecords.length < 2) return 75 // neutral if not enough history

  // Group by test name, look at last 3 values of key metrics
  const byTest = new Map<string, HealthRecord[]>()
  for (const r of allRecords) {
    const k = r.test_name.toLowerCase()
    const arr = byTest.get(k) || []
    arr.push(r)
    byTest.set(k, arr)
  }

  const trendScores: number[] = []

  for (const [, records] of byTest) {
    if (records.length < 2) continue
    const sorted = records.sort((a, b) => new Date(a.recorded_at).getTime() - new Date(b.recorded_at).getTime())
    const last = sorted.slice(-3)

    const found = findBiomarkerRef(last[0].test_name)
    if (!found) continue

    const { ref } = found
    const midpoint = (ref.min + ref.max) / 2

    // Compare first vs last in the window
    const firstVal = last[0].value
    const lastVal = last[last.length - 1].value
    const firstDist = Math.abs(firstVal - midpoint)
    const lastDist  = Math.abs(lastVal - midpoint)

    // If moving toward midpoint = improving
    const isKeyHigherBetter = ['hdl', 'vitamin d', 'vitamin b12', 'hemoglobin', 'ferritin'].some(k => last[0].test_name.toLowerCase().includes(k))

    let trendScore: number
    const change = ((lastVal - firstVal) / Math.max(Math.abs(firstVal), 0.001)) * 100

    if (Math.abs(change) < 3) {
      trendScore = 80 // stable
    } else if (isKeyHigherBetter) {
      // Higher = better for these
      trendScore = change > 5 ? 100 : change > 0 ? 85 : change > -10 ? 60 : 30
    } else {
      // Lower/in-range = better for glucose, cholesterol, etc.
      trendScore = lastDist < firstDist ? 100 : change < 5 ? 80 : change < 15 ? 60 : 30
    }

    trendScores.push(trendScore)
  }

  if (trendScores.length === 0) return 75
  return Math.round(trendScores.reduce((a, b) => a + b, 0) / trendScores.length)
}

// ── D. Preventive score ───────────────────────────────────────────
function calcPreventiveScore(reportCount: number, appointmentCount: number, insightCount: number): number {
  let score = 0

  // Reports uploaded
  if (reportCount >= 6) score += 40
  else if (reportCount >= 3) score += 28
  else if (reportCount >= 1) score += 15
  else score += 0

  // Doctor consultations
  if (appointmentCount >= 3) score += 35
  else if (appointmentCount >= 1) score += 22
  else score += 5

  // Engaged with insights
  if (insightCount >= 5) score += 25
  else if (insightCount >= 1) score += 15
  else score += 0

  return Math.min(100, score)
}

// ── E. Consistency score ──────────────────────────────────────────
function calcConsistencyScore(accountAgedays: number, reportCount: number): number {
  if (accountAgedays === 0) return 60
  // Reports per month ratio
  const monthlyRate = (reportCount / Math.max(accountAgedays, 1)) * 30
  if (monthlyRate >= 2) return 100
  if (monthlyRate >= 1) return 80
  if (monthlyRate >= 0.5) return 65
  if (monthlyRate > 0) return 45
  return 20
}

// ── Impact Actions ────────────────────────────────────────────────
function generateImpactActions(breakdown: Omit<LongevityBreakdown, 'impactActions' | 'biologicalAge' | 'interpretation' | 'label' | 'color'>, metricScores: MetricScore[]): ImpactAction[] {
  const actions: ImpactAction[] = []

  // Biomarker-specific actions
  for (const m of metricScores) {
    if (m.status === 'concerning') {
      if (m.name.toLowerCase().includes('glucose') || m.name.toLowerCase().includes('hba1c')) {
        actions.push({ action: 'Walk 8,000 steps daily for 30 days', points: 6, category: 'biomarkers', icon: '🚶' })
        actions.push({ action: 'Replace white rice with millets/oats', points: 4, category: 'lifestyle', icon: '🥗' })
      }
      if (m.name.toLowerCase().includes('vitamin d')) {
        actions.push({ action: '15 min direct sunlight daily (10am–2pm)', points: 5, category: 'biomarkers', icon: '☀️' })
      }
      if (m.name.toLowerCase().includes('cholesterol') || m.name.toLowerCase().includes('ldl')) {
        actions.push({ action: '30 min cardio 5x/week', points: 5, category: 'lifestyle', icon: '🏃' })
        actions.push({ action: 'Add 1 tbsp flaxseeds + 10 walnuts daily', points: 3, category: 'lifestyle', icon: '🌰' })
      }
      if (m.name.toLowerCase().includes('hemoglobin')) {
        actions.push({ action: 'Add iron-rich foods: spinach, legumes, liver', points: 4, category: 'biomarkers', icon: '🥬' })
      }
    }
  }

  // Lifestyle actions
  if (breakdown.lifestyle < 70) {
    actions.push({ action: 'Sleep 7–8 hours consistently', points: 4, category: 'lifestyle', icon: '😴' })
    actions.push({ action: 'Exercise 4–5 days per week', points: 4, category: 'lifestyle', icon: '💪' })
  }

  // Trend actions
  if (breakdown.trends < 70) {
    actions.push({ action: 'Upload a new lab report this month', points: 5, category: 'trends', icon: '📋' })
    actions.push({ action: 'Follow your AI action plan for 30 days', points: 6, category: 'trends', icon: '🎯' })
  }

  // Preventive actions
  if (breakdown.preventive < 60) {
    actions.push({ action: 'Book a preventive doctor consultation', points: 5, category: 'preventive', icon: '🩺' })
    actions.push({ action: 'Upload your full body check-up report', points: 4, category: 'preventive', icon: '🔬' })
  }

  // Deduplicate and sort by impact
  const seen = new Set<string>()
  const unique = actions.filter(a => { if (seen.has(a.action)) return false; seen.add(a.action); return true })
  return unique.sort((a, b) => b.points - a.points).slice(0, 6)
}

// ── Main compute function ─────────────────────────────────────────
export function computeLongevityScore(params: {
  latestRecords: HealthRecord[]
  allRecords: HealthRecord[]
  lifestyle: LifestyleData
  reportCount: number
  appointmentCount: number
  insightCount: number
  accountAgedays: number
  userAge?: number
}): LongevityBreakdown {
  const { latestRecords, allRecords, lifestyle, reportCount, appointmentCount, insightCount, accountAgedays, userAge } = params

  const { score: biomarkers, metricScores } = calcBiomarkerScore(latestRecords)
  const ls = calcLifestyleScore(lifestyle)
  const trends = calcTrendScore(allRecords)
  const preventive = calcPreventiveScore(reportCount, appointmentCount, insightCount)
  const consistency = calcConsistencyScore(accountAgedays, reportCount)

  const total = Math.round(
    biomarkers  * 0.40 +
    ls          * 0.25 +
    trends      * 0.15 +
    preventive  * 0.10 +
    consistency * 0.10
  )

  // Biological age
  let biologicalAge: number | null = null
  if (userAge && userAge > 0) {
    biologicalAge = Math.round(userAge - ((total - 50) / 5))
    biologicalAge = Math.max(biologicalAge, userAge - 15) // cap at 15 years younger
    biologicalAge = Math.min(biologicalAge, userAge + 15) // cap at 15 years older
  }

  const interpretation = total >= 85 ? 'excellent' : total >= 70 ? 'good' : total >= 50 ? 'at_risk' : 'high_risk'
  const labelMap = { excellent: 'Excellent 🟢', good: 'Good 🟡', at_risk: 'At Risk 🟠', high_risk: 'High Risk 🔴' }
  const colorMap = { excellent: '#10b981', good: '#f59e0b', at_risk: '#f97316', high_risk: '#ef4444' }

  const partial = { total, biomarkers, lifestyle: ls, trends, preventive, consistency }
  const impactActions = generateImpactActions(partial, metricScores)

  return {
    ...partial,
    biologicalAge,
    interpretation,
    label: labelMap[interpretation],
    color: colorMap[interpretation],
    impactActions,
    metricScores,
  }
}
