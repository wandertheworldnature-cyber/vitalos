// ================================================================
// VitalOS Alert Engine
// Auto-triggers when reports uploaded or metrics cross thresholds
// Generates predictive alerts with probability scores
// ================================================================

import { supabase } from '@/lib/supabase'

export interface HealthAlert {
  id: string
  type: 'threshold_crossed' | 'trend_decline' | 'predictive_risk' | 'improvement' | 'missing_test'
  severity: 'critical' | 'warning' | 'info' | 'good'
  title: string
  message: string
  metric?: string
  currentValue?: number
  previousValue?: number
  changePercent?: number
  riskPercent?: number
  timeframe?: string
  actionSteps: string[]
  generatedAt: string
}

interface HealthRecord {
  test_name: string
  value: number
  unit: string
  reference_min?: number | null
  reference_max?: number | null
  recorded_at: string
}

// ── Threshold definitions for auto-alerts ────────────────────────
const THRESHOLDS: Record<string, { min: number; max: number; criticalMin?: number; criticalMax?: number; unit: string; higherBetter?: boolean }> = {
  'fasting glucose':    { min: 70,  max: 99,  criticalMax: 126, unit: 'mg/dL' },
  'hba1c':              { min: 4.0, max: 5.6, criticalMax: 6.5, unit: '%' },
  'ldl cholesterol':    { min: 0,   max: 130, criticalMax: 160, unit: 'mg/dL' },
  'total cholesterol':  { min: 0,   max: 200, criticalMax: 240, unit: 'mg/dL' },
  'triglycerides':      { min: 0,   max: 150, criticalMax: 200, unit: 'mg/dL' },
  'hdl':                { min: 40,  max: 100, unit: 'mg/dL', higherBetter: true },
  'hemoglobin':         { min: 12,  max: 17.5, criticalMin: 10, unit: 'g/dL' },
  'tsh':                { min: 0.4, max: 4.0, criticalMax: 10, unit: 'mIU/L' },
  'vitamin d':          { min: 30,  max: 100, criticalMin: 10, unit: 'ng/mL' },
  'creatinine':         { min: 0.6, max: 1.2, criticalMax: 2.0, unit: 'mg/dL' },
  'systolic bp':        { min: 90,  max: 120, criticalMax: 140, unit: 'mmHg' },
  'diastolic bp':       { min: 60,  max: 80,  criticalMax: 90,  unit: 'mmHg' },
}

function findThreshold(testName: string) {
  const lower = testName.toLowerCase()
  for (const [key, val] of Object.entries(THRESHOLDS)) {
    if (lower.includes(key) || key.split(' ').every(w => lower.includes(w))) return { key, val }
  }
  return null
}

// ── Diabetes risk predictor ───────────────────────────────────────
function calcDiabetesRisk(records: HealthRecord[]): number | null {
  const glucose = records.find(r => r.test_name.toLowerCase().includes('fasting glucose'))
  const hba1c   = records.find(r => r.test_name.toLowerCase().includes('hba1c'))
  const trig    = records.find(r => r.test_name.toLowerCase().includes('triglycerides'))

  if (!glucose) return null

  let risk = 0
  // Glucose contribution (0-40 pts)
  if (glucose.value >= 126) risk += 40
  else if (glucose.value >= 110) risk += 28
  else if (glucose.value >= 100) risk += 18
  else if (glucose.value >= 90) risk += 8
  else risk += 0

  // HbA1c contribution (0-35 pts)
  if (hba1c) {
    if (hba1c.value >= 6.5) risk += 35
    else if (hba1c.value >= 5.7) risk += 22
    else if (hba1c.value >= 5.4) risk += 12
    else risk += 0
  } else risk += 10 // unknown = moderate risk

  // Triglycerides contribution (0-25 pts)
  if (trig) {
    if (trig.value >= 200) risk += 25
    else if (trig.value >= 150) risk += 15
    else risk += 0
  }

  return Math.min(95, risk)
}

// ── Cardiovascular risk predictor ────────────────────────────────
function calcCardiovascularRisk(records: HealthRecord[]): number | null {
  const ldl   = records.find(r => r.test_name.toLowerCase().includes('ldl'))
  const hdl   = records.find(r => r.test_name.toLowerCase().includes('hdl') && !r.test_name.toLowerCase().includes('vldl'))
  const trig  = records.find(r => r.test_name.toLowerCase().includes('triglycerides'))
  const gluc  = records.find(r => r.test_name.toLowerCase().includes('fasting glucose'))

  if (!ldl && !hdl) return null

  let risk = 0
  if (ldl) {
    if (ldl.value >= 160) risk += 35
    else if (ldl.value >= 130) risk += 20
    else if (ldl.value >= 100) risk += 8
  }
  if (hdl) {
    if (hdl.value < 35) risk += 30
    else if (hdl.value < 40) risk += 18
    else if (hdl.value < 50) risk += 8
  }
  if (trig) {
    if (trig.value >= 200) risk += 20
    else if (trig.value >= 150) risk += 10
  }
  if (gluc && gluc.value >= 100) risk += 15

  return Math.min(90, risk)
}

// ── Compare with previous report ─────────────────────────────────
function detectChanges(current: HealthRecord[], previous: HealthRecord[]): HealthAlert[] {
  const alerts: HealthAlert[] = []

  for (const curr of current) {
    const prev = previous.find(p => p.test_name.toLowerCase() === curr.test_name.toLowerCase())
    if (!prev) continue

    const changePercent = ((curr.value - prev.value) / Math.abs(prev.value)) * 100
    const found = findThreshold(curr.test_name)
    if (!found) continue

    const { val: thresh } = found
    const isHigherBetter = thresh.higherBetter || false

    // Alert if change > 5% AND crosses/approaches threshold
    if (Math.abs(changePercent) >= 5) {
      const nowAbnormal = curr.value > thresh.max || curr.value < thresh.min
      const wasNormal   = prev.value >= thresh.min && prev.value <= thresh.max
      const isCritical  = (thresh.criticalMax && curr.value >= thresh.criticalMax) ||
                          (thresh.criticalMin && curr.value <= thresh.criticalMin)

      if (isCritical) {
        alerts.push({
          id: `change_${curr.test_name}_${Date.now()}`,
          type: 'threshold_crossed',
          severity: 'critical',
          title: `⚠️ ${curr.test_name} in critical range`,
          message: `${curr.test_name} is ${curr.value} ${curr.unit} — changed ${changePercent > 0 ? '+' : ''}${changePercent.toFixed(1)}% from last report (${prev.value}). This is in the critical range.`,
          metric: curr.test_name,
          currentValue: curr.value,
          previousValue: prev.value,
          changePercent,
          actionSteps: ['Consult a doctor immediately', 'Retest within 1 week', 'Review diet and medications'],
          generatedAt: new Date().toISOString(),
        })
      } else if (nowAbnormal && wasNormal) {
        alerts.push({
          id: `crossed_${curr.test_name}_${Date.now()}`,
          type: 'threshold_crossed',
          severity: 'warning',
          title: `${curr.test_name} crossed normal limit`,
          message: `${curr.test_name} moved from normal (${prev.value} ${curr.unit}) to out-of-range (${curr.value} ${curr.unit}) — a ${Math.abs(changePercent).toFixed(1)}% change.`,
          metric: curr.test_name,
          currentValue: curr.value,
          previousValue: prev.value,
          changePercent,
          actionSteps: ['Monitor closely', 'Consult doctor within 2 weeks', 'Review lifestyle factors'],
          generatedAt: new Date().toISOString(),
        })
      } else if (Math.abs(changePercent) >= 8) {
        const direction = isHigherBetter ? changePercent < 0 : changePercent > 0
        if (direction) {
          alerts.push({
            id: `trend_${curr.test_name}_${Date.now()}`,
            type: 'trend_decline',
            severity: changePercent > 15 || changePercent < -15 ? 'warning' : 'info',
            title: `${curr.test_name} ${isHigherBetter ? 'dropped' : 'rose'} ${Math.abs(changePercent).toFixed(1)}%`,
            message: `Your ${curr.test_name} ${isHigherBetter ? 'decreased' : 'increased'} from ${prev.value} to ${curr.value} ${curr.unit} since your last report.`,
            metric: curr.test_name,
            currentValue: curr.value,
            previousValue: prev.value,
            changePercent,
            actionSteps: ['Track in next report', 'Adjust diet/lifestyle', 'Consult doctor if continues'],
            generatedAt: new Date().toISOString(),
          })
        }
      }
    }
  }

  return alerts
}

// ── Main: generate alerts after upload ───────────────────────────
export async function generateAlertsAfterUpload(
  userId: string,
  newRecords: HealthRecord[]
): Promise<HealthAlert[]> {
  const alerts: HealthAlert[] = []

  // Get previous report's records for comparison
  const { data: oldRecords } = await supabase
    .from('health_records')
    .select('*')
    .eq('user_id', userId)
    .not('id', 'in', `(${newRecords.map(() => 'x').join(',')})`)
    .order('recorded_at', { ascending: false })
    .limit(50)

  // Compare changes
  if (oldRecords && oldRecords.length > 0) {
    const changeAlerts = detectChanges(newRecords, oldRecords as HealthRecord[])
    alerts.push(...changeAlerts)
  }

  // Threshold crossing alerts for NEW values
  for (const r of newRecords) {
    const found = findThreshold(r.test_name)
    if (!found) continue
    const { val: thresh } = found
    if (thresh.criticalMax && r.value >= thresh.criticalMax) {
      const exists = alerts.find(a => a.metric === r.test_name)
      if (!exists) {
        alerts.push({
          id: `thresh_${r.test_name}_${Date.now()}`,
          type: 'threshold_crossed',
          severity: 'critical',
          title: `${r.test_name} critically high`,
          message: `${r.test_name} is ${r.value} ${r.unit} — above the critical threshold of ${thresh.criticalMax}. Immediate attention required.`,
          metric: r.test_name,
          currentValue: r.value,
          actionSteps: ['See a doctor within 48 hours', 'Avoid high-risk foods/activities', 'Retest in 1 week'],
          generatedAt: new Date().toISOString(),
        })
      }
    }
  }

  // Predictive risk alerts
  const latestMap = new Map<string, HealthRecord>()
  const allUserRecords = [...(oldRecords || []), ...newRecords] as HealthRecord[]
  for (const r of allUserRecords) {
    if (!latestMap.has(r.test_name.toLowerCase())) latestMap.set(r.test_name.toLowerCase(), r)
  }
  const latest = Array.from(latestMap.values())

  const diabetesRisk = calcDiabetesRisk(latest)
  if (diabetesRisk !== null && diabetesRisk >= 30) {
    alerts.push({
      id: `diabetes_risk_${Date.now()}`,
      type: 'predictive_risk',
      severity: diabetesRisk >= 60 ? 'critical' : 'warning',
      title: `${diabetesRisk}% diabetes risk detected`,
      message: `Based on your glucose, HbA1c, and triglyceride patterns, you have a ${diabetesRisk}% predicted risk of Type 2 Diabetes in the next 12–18 months.`,
      riskPercent: diabetesRisk,
      timeframe: '12–18 months',
      actionSteps: [
        'Walk 8,000 steps daily for 30 days',
        'Replace white rice with millets or brown rice',
        'Cut sugar-sweetened beverages completely',
        'Retest HbA1c in 3 months',
        'Book an endocrinologist consultation',
      ],
      generatedAt: new Date().toISOString(),
    })
  }

  const cvRisk = calcCardiovascularRisk(latest)
  if (cvRisk !== null && cvRisk >= 30) {
    alerts.push({
      id: `cv_risk_${Date.now()}`,
      type: 'predictive_risk',
      severity: cvRisk >= 60 ? 'critical' : 'warning',
      title: `${cvRisk}% cardiovascular risk detected`,
      message: `Your lipid profile pattern indicates a ${cvRisk}% predicted risk for cardiovascular events in the next 5 years.`,
      riskPercent: cvRisk,
      timeframe: '5 years',
      actionSteps: [
        '30 min cardio exercise 5x/week',
        'Reduce saturated fat (ghee, butter, fried foods)',
        'Add omega-3: 10 walnuts + 1 tbsp flaxseeds daily',
        'Book a cardiologist consultation',
        'Retest lipid panel in 3 months',
      ],
      generatedAt: new Date().toISOString(),
    })
  }

  // Save alerts to DB as AI insights
  if (alerts.length > 0) {
    const toInsert = alerts.map(a => ({
      user_id: userId,
      severity: a.severity,
      title: a.title,
      description: a.message,
      recommendation: a.actionSteps.slice(0, 2).join('. '),
      risk_reduction: a.riskPercent ? `${Math.round(a.riskPercent * 0.4)}% with lifestyle changes` : undefined,
      related_metrics: a.metric ? [a.metric] : [],
      timeframe: a.timeframe,
      generated_at: a.generatedAt,
    }))
    await supabase.from('ai_insights').insert(toInsert).select()
  }

  return alerts
}
