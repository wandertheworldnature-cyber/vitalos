import { supabase } from '@/lib/supabase'
import { generateHealthInsights, computeLongevityScore } from './groqService'
import type { HealthRecord, HealthReport, AIInsight, LongevityScore, FamilyMember } from '@/types'

// ─── Health Records ──────────────────────────────────────────────
export async function getHealthRecords(userId: string, testName?: string, limit = 200): Promise<HealthRecord[]> {
  let q = supabase.from('health_records').select('*').eq('user_id', userId)
    .order('recorded_at', { ascending: true }).limit(limit)
  if (testName) q = q.ilike('test_name', `%${testName}%`)
  const { data, error } = await q
  if (error) throw error
  return (data || []) as HealthRecord[]
}

export async function getLatestMetrics(userId: string): Promise<HealthRecord[]> {
  const records = await getHealthRecords(userId)
  const seen = new Map<string, HealthRecord>()
  for (const r of [...records].reverse()) {
    const key = r.test_name.toLowerCase().trim()
    if (!seen.has(key)) seen.set(key, r)
  }
  return Array.from(seen.values())
}

export async function addHealthRecord(record: Omit<HealthRecord, 'id' | 'created_at'>): Promise<HealthRecord> {
  const { data, error } = await supabase.from('health_records').insert(record).select().single()
  if (error) throw error
  return data as HealthRecord
}

export async function getTrendData(userId: string, testName: string): Promise<{ date: string; value: number }[]> {
  const { data, error } = await supabase
    .from('health_records').select('recorded_at, value')
    .eq('user_id', userId).ilike('test_name', `%${testName}%`)
    .order('recorded_at', { ascending: true })
  if (error) throw error
  return (data || []).map(r => ({ date: r.recorded_at.split('T')[0], value: r.value }))
}

// ─── Reports — server-side OCR via Edge Function ─────────────────
export async function uploadAndScanReport(
  userId: string, file: File, familyMemberId?: string,
  onProgress?: (msg: string) => void
): Promise<{ report: HealthReport; recordsAdded: number }> {

  // 1. Upload to Supabase Storage
  onProgress?.('Uploading to storage...')
  const ext = file.name.split('.').pop()
  const path = `${userId}/${Date.now()}_${file.name.replace(/[^a-z0-9.]/gi, '_')}`

  const { error: uploadError } = await supabase.storage.from('health-reports').upload(path, file)
  if (uploadError) throw new Error(`Storage upload failed: ${uploadError.message}`)

  const { data: { publicUrl } } = supabase.storage.from('health-reports').getPublicUrl(path)

  // 2. Create report record in DB
  const { data: reportData, error: reportError } = await supabase
    .from('health_reports').insert({
      user_id: userId,
      family_member_id: familyMemberId || null,
      file_name: file.name,
      file_url: publicUrl,
      file_type: file.type,
      ocr_status: 'pending',
    }).select().single()

  if (reportError) throw new Error(`DB insert failed: ${reportError.message}`)
  const report = reportData as HealthReport

  // 3. Call OCR Edge Function (server-side — no CSP issues, handles PDFs)
  onProgress?.('AI reading your report (server-side)...')
  try {
    const formData = new FormData()
    formData.append('file', file)
    formData.append('userId', userId)
    formData.append('reportId', report.id)

    const { data: fnData, error: fnError } = await supabase.functions.invoke('ocr-report', {
      body: formData,
    })

    if (fnError) throw new Error(fnError.message)

    const recordsAdded = fnData?.recordsAdded || 0
    onProgress?.(`Saved ${recordsAdded} test values`)

    return { report: { ...report, ocr_status: 'done' }, recordsAdded }
  } catch (err) {
    // Update report as failed
    await supabase.from('health_reports').update({ ocr_status: 'failed' }).eq('id', report.id)
    throw err
  }
}

export async function getReports(userId: string): Promise<HealthReport[]> {
  const { data, error } = await supabase.from('health_reports').select('*')
    .eq('user_id', userId).order('created_at', { ascending: false })
  if (error) throw error
  return (data || []) as HealthReport[]
}

// ─── AI Insights ─────────────────────────────────────────────────
export async function getInsights(userId: string): Promise<AIInsight[]> {
  const { data, error } = await supabase.from('ai_insights').select('*')
    .eq('user_id', userId).order('generated_at', { ascending: false }).limit(20)
  if (error) throw error
  return (data || []) as AIInsight[]
}

export async function generateInsights(userId: string): Promise<AIInsight[]> {
  const records = await getHealthRecords(userId, undefined, 60)
  if (records.length === 0) return []
  const raw = await generateHealthInsights(records)
  if (raw.length === 0) return []
  const toInsert = raw.map(ins => ({ ...ins, user_id: userId, generated_at: new Date().toISOString() }))
  const { data, error } = await supabase.from('ai_insights').insert(toInsert).select()
  if (error) return toInsert as AIInsight[]
  return (data || []) as AIInsight[]
}

// ─── Longevity Score ──────────────────────────────────────────────
export async function getLongevityScore(userId: string): Promise<LongevityScore | null> {
  const { data } = await supabase.from('longevity_scores').select('*')
    .eq('user_id', userId).order('computed_at', { ascending: false }).limit(1).single()
  return data as LongevityScore | null
}

export async function computeAndSaveLongevityScore(userId: string): Promise<LongevityScore | null> {
  const records = await getLatestMetrics(userId)
  if (records.length === 0) return null
  try {
    const result = await computeLongevityScore(records)
    const { data } = await supabase.from('longevity_scores')
      .insert({ user_id: userId, ...result, computed_at: new Date().toISOString() }).select().single()
    return data as LongevityScore
  } catch { return null }
}

// ─── Family Members ───────────────────────────────────────────────
export async function getFamilyMembers(userId: string): Promise<FamilyMember[]> {
  const { data, error } = await supabase.from('family_members').select('*').eq('user_id', userId)
  if (error) throw error
  return (data || []) as FamilyMember[]
}

export async function addFamilyMember(member: Omit<FamilyMember, 'id' | 'created_at'>): Promise<FamilyMember> {
  const { data, error } = await supabase.from('family_members').insert(member).select().single()
  if (error) throw error
  return data as FamilyMember
}
