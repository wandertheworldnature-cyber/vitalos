// src/services/healthService.ts
// All AI calls now use FREE services:
//   OCR → Gemini Flash (free tier, aistudio.google.com)
//   Insights → Groq Llama 3.3 (free tier, console.groq.com)
// No Supabase Edge Functions needed — runs entirely in browser

import { supabase } from '@/lib/supabase'
import { extractLabReport } from './geminiService'
import { generateHealthInsights, computeLongevityScore } from './groqService'
import type { HealthRecord, HealthReport, AIInsight, LongevityScore, FamilyMember } from '@/types'

// ─── Health Records ─────────────────────────────────────────────

export async function getHealthRecords(
  userId: string,
  testName?: string,
  limit = 100
): Promise<HealthRecord[]> {
  let query = supabase
    .from('health_records')
    .select('*')
    .eq('user_id', userId)
    .order('recorded_at', { ascending: true })
    .limit(limit)

  if (testName) query = query.ilike('test_name', `%${testName}%`)

  const { data, error } = await query
  if (error) throw error
  return (data || []) as HealthRecord[]
}

export async function getLatestMetrics(userId: string): Promise<HealthRecord[]> {
  const records = await getHealthRecords(userId, undefined, 200)
  const seen = new Map<string, HealthRecord>()
  for (const r of [...records].reverse()) {
    if (!seen.has(r.test_name.toLowerCase())) seen.set(r.test_name.toLowerCase(), r)
  }
  return Array.from(seen.values())
}

export async function addHealthRecord(
  record: Omit<HealthRecord, 'id' | 'created_at'>
): Promise<HealthRecord> {
  const { data, error } = await supabase
    .from('health_records')
    .insert(record)
    .select()
    .single()
  if (error) throw error
  return data as HealthRecord
}

export async function getTrendData(
  userId: string,
  testName: string
): Promise<{ date: string; value: number }[]> {
  const { data, error } = await supabase
    .from('health_records')
    .select('recorded_at, value')
    .eq('user_id', userId)
    .ilike('test_name', `%${testName}%`)
    .order('recorded_at', { ascending: true })

  if (error) throw error
  return (data || []).map(r => ({
    date: r.recorded_at.split('T')[0],
    value: r.value,
  }))
}

// ─── Reports (Gemini OCR — fully client-side, no Edge Function) ──

export async function uploadAndScanReport(
  userId: string,
  file: File,
  familyMemberId?: string,
  onProgress?: (status: string) => void
): Promise<{ report: HealthReport; recordsAdded: number }> {

  onProgress?.('Uploading file...')
  const ext = file.name.split('.').pop()
  const path = `${userId}/${Date.now()}.${ext}`

  const { error: uploadError } = await supabase.storage
    .from('health-reports')
    .upload(path, file)
  if (uploadError) throw uploadError

  const { data: { publicUrl } } = supabase.storage
    .from('health-reports')
    .getPublicUrl(path)

  const { data: reportData, error: reportError } = await supabase
    .from('health_reports')
    .insert({
      user_id: userId,
      family_member_id: familyMemberId || null,
      file_name: file.name,
      file_url: publicUrl,
      file_type: file.type,
      ocr_status: 'processing',
    })
    .select()
    .single()

  if (reportError) throw reportError
  const report = reportData as HealthReport

  onProgress?.('Gemini AI reading your report...')
  let extracted = { lab_name: 'Unknown', report_date: new Date().toISOString().split('T')[0], records: [] as Array<{ test_name: string; value: number; unit: string; reference_min: number | null; reference_max: number | null }> }

  try {
    extracted = await extractLabReport(file)
  } catch (ocrErr) {
    await supabase.from('health_reports').update({ ocr_status: 'failed' }).eq('id', report.id)
    throw ocrErr
  }

  onProgress?.(`Saving ${extracted.records.length} test results...`)
  let recordsAdded = 0

  if (extracted.records.length > 0) {
    const records = extracted.records.map(r => ({
      user_id: userId,
      family_member_id: familyMemberId || null,
      record_type: 'blood_test' as const,
      test_name: r.test_name,
      value: r.value,
      unit: r.unit,
      reference_min: r.reference_min,
      reference_max: r.reference_max,
      source: extracted.lab_name || 'Lab report',
      recorded_at: extracted.report_date
        ? new Date(extracted.report_date).toISOString()
        : new Date().toISOString(),
      metadata: { report_id: report.id },
    }))

    const { error: recError } = await supabase.from('health_records').insert(records)
    if (!recError) recordsAdded = records.length
  }

  await supabase.from('health_reports').update({
    ocr_status: 'done',
    extracted_data: extracted,
    lab_name: extracted.lab_name,
    report_date: extracted.report_date || null,
  }).eq('id', report.id)

  return { report: { ...report, ocr_status: 'done' }, recordsAdded }
}

export async function getReports(userId: string): Promise<HealthReport[]> {
  const { data, error } = await supabase
    .from('health_reports')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
  if (error) throw error
  return (data || []) as HealthReport[]
}

// ─── AI Insights (Groq — browser, no Edge Function) ─────────────

export async function getInsights(userId: string): Promise<AIInsight[]> {
  const { data, error } = await supabase
    .from('ai_insights')
    .select('*')
    .eq('user_id', userId)
    .order('generated_at', { ascending: false })
    .limit(20)
  if (error) throw error
  return (data || []) as AIInsight[]
}

export async function generateInsights(userId: string): Promise<AIInsight[]> {
  const records = await getHealthRecords(userId, undefined, 60)
  if (records.length === 0) return []

  const rawInsights = await generateHealthInsights(records)
  if (rawInsights.length === 0) return []

  const toInsert = rawInsights.map(ins => ({
    ...ins,
    user_id: userId,
    generated_at: new Date().toISOString(),
  }))

  const { data, error } = await supabase.from('ai_insights').insert(toInsert).select()
  if (error) return toInsert as AIInsight[]
  return (data || []) as AIInsight[]
}

// ─── Longevity Score ─────────────────────────────────────────────

export async function getLongevityScore(userId: string): Promise<LongevityScore | null> {
  const { data, error } = await supabase
    .from('longevity_scores')
    .select('*')
    .eq('user_id', userId)
    .order('computed_at', { ascending: false })
    .limit(1)
    .single()
  if (error) return null
  return data as LongevityScore
}

export async function computeAndSaveLongevityScore(userId: string): Promise<LongevityScore | null> {
  const records = await getLatestMetrics(userId)
  if (records.length === 0) return null
  try {
    const result = await computeLongevityScore(records)
    const { data, error } = await supabase
      .from('longevity_scores')
      .insert({ user_id: userId, ...result, computed_at: new Date().toISOString() })
      .select()
      .single()
    if (error) throw error
    return data as LongevityScore
  } catch (err) {
    console.error('Score error:', err)
    return null
  }
}

// ─── Family Members ──────────────────────────────────────────────

export async function getFamilyMembers(userId: string): Promise<FamilyMember[]> {
  const { data, error } = await supabase
    .from('family_members')
    .select('*')
    .eq('user_id', userId)
  if (error) throw error
  return (data || []) as FamilyMember[]
}

export async function addFamilyMember(
  member: Omit<FamilyMember, 'id' | 'created_at'>
): Promise<FamilyMember> {
  const { data, error } = await supabase
    .from('family_members')
    .insert(member)
    .select()
    .single()
  if (error) throw error
  return data as FamilyMember
}
