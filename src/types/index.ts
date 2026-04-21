// ─── User & Auth ───────────────────────────────────────────────
export interface User {
  id: string
  email: string
  full_name: string
  avatar_url?: string
  plan: 'basic' | 'pro' | 'premium'
  created_at: string
}

export interface FamilyMember {
  id: string
  user_id: string
  name: string
  relation: string
  age: number
  gender: 'male' | 'female' | 'other'
  avatar_color: string
  created_at: string
}

// ─── Health Records ─────────────────────────────────────────────
export interface HealthRecord {
  id: string
  user_id: string
  family_member_id?: string
  record_type: 'blood_test' | 'wearable' | 'manual' | 'prescription' | 'scan'
  test_name: string
  value: number
  unit: string
  reference_min?: number
  reference_max?: number
  source: string
  recorded_at: string
  created_at: string
  metadata?: Record<string, unknown>
}

export interface HealthReport {
  id: string
  user_id: string
  family_member_id?: string
  file_name: string
  file_url: string
  file_type: string
  ocr_status: 'pending' | 'processing' | 'done' | 'failed'
  ocr_text?: string
  extracted_records?: HealthRecord[]
  lab_name?: string
  report_date?: string
  created_at: string
}

// ─── AI Insights ────────────────────────────────────────────────
export interface AIInsight {
  id: string
  user_id: string
  family_member_id?: string
  severity: 'critical' | 'warning' | 'info' | 'good'
  title: string
  description: string
  recommendation: string
  risk_reduction?: string
  related_metrics: string[]
  timeframe?: string
  generated_at: string
}

export interface LongevityScore {
  score: number
  change: number
  breakdown: {
    metabolic: number
    cardiovascular: number
    sleep: number
    activity: number
    nutrition: number
  }
  computed_at: string
}

// ─── Doctors & Appointments ─────────────────────────────────────
export interface Doctor {
  id: string
  name: string
  specialty: string
  qualifications: string
  experience_years: number
  rating: number
  review_count: number
  avatar_url?: string
  languages: string[]
  consultation_fee: number
  available_slots: TimeSlot[]
  bio: string
  hospital?: string
}

export interface TimeSlot {
  id: string
  date: string
  time: string
  available: boolean
}

export interface Appointment {
  id: string
  user_id: string
  doctor_id: string
  doctor: Doctor
  slot_date: string
  slot_time: string
  status: 'scheduled' | 'completed' | 'cancelled'
  notes?: string
  meeting_link?: string
  created_at: string
}

// ─── Subscription & Payments ────────────────────────────────────
export interface Plan {
  id: 'basic' | 'pro' | 'premium'
  name: string
  price_monthly: number
  price_yearly: number
  features: string[]
  highlight?: boolean
}

export interface Payment {
  id: string
  user_id: string
  razorpay_order_id: string
  razorpay_payment_id?: string
  amount: number
  currency: string
  plan: string
  status: 'created' | 'paid' | 'failed'
  created_at: string
}

// ─── Chart Data ─────────────────────────────────────────────────
export interface TrendPoint {
  date: string
  value: number
  label?: string
}

export interface MetricCard {
  id: string
  label: string
  value: number | string
  unit?: string
  trend?: number
  trendDir?: 'up' | 'down' | 'stable'
  status: 'normal' | 'warning' | 'critical' | 'good'
  referenceRange?: string
}
