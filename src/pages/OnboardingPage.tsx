import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuthStore } from '@/store/authStore'
import { supabase } from '@/lib/supabase'
import { Heart, Brain, Sparkles, Watch, Users, Stethoscope, ChevronRight, ChevronLeft, Check, Zap } from 'lucide-react'
import toast from 'react-hot-toast'

interface Step {
  icon: React.ElementType
  color: string
  title: string
  subtitle: string
  features: string[]
}

const STEPS: Step[] = [
  {
    icon: Heart, color: '#0f6e56',
    title: 'Welcome to VitalOS',
    subtitle: 'Your complete health operating system — built for India',
    features: ['AI analyzes your lab reports in seconds', 'Track 30+ health dimensions in one place', 'Preventive care before problems start'],
  },
  {
    icon: Brain, color: '#8b5cf6',
    title: 'AI that knows YOUR body',
    subtitle: 'Not generic advice — insights from your actual data',
    features: ['AI Health Copilot — chat about your health anytime', 'Biomarker correlation engine finds hidden patterns', 'AI Longevity Coach builds your personalized plan'],
  },
  {
    icon: Watch, color: '#3b82f6',
    title: 'Connect your wearables',
    subtitle: 'Sync data from the devices you already use',
    features: ['Health Connect for Android (Samsung, Fitbit, Garmin)', 'Apple Health for iOS (Apple Watch)', 'IoT devices — BP, glucose, ECG monitors'],
  },
  {
    icon: Users, color: '#f59e0b',
    title: 'Care for your whole family',
    subtitle: 'Track health for parents, kids, and elderly relatives',
    features: ['Family health dashboard with shared access', 'Elderly care monitoring and alerts', 'Emergency health card with QR sharing'],
  },
  {
    icon: Stethoscope, color: '#ef4444',
    title: 'Doctors & home healthcare',
    subtitle: 'Book consultations or get care at your doorstep',
    features: ['Video consultations with verified doctors', 'Home lab tests, nursing, physiotherapy', 'Clinical AI helps doctors review your data faster'],
  },
]

export default function OnboardingPage() {
  const navigate = useNavigate()
  const { user, fetchProfile } = useAuthStore()
  const [step, setStep] = useState(0)
  const [completing, setCompleting] = useState(false)

  const current = STEPS[step]
  const Icon = current.icon
  const isLast = step === STEPS.length - 1

  async function complete() {
    if (!user) { navigate('/dashboard'); return }
    setCompleting(true)
    try {
      await supabase.from('profiles').update({ onboarding_completed: true }).eq('id', user.id)
      await fetchProfile(user.id)
      toast.success('Welcome aboard! 🎉')
      navigate('/dashboard')
    } catch {
      navigate('/dashboard')
    } finally { setCompleting(false) }
  }

  function skip() { complete() }

  return (
    <div className="min-h-screen flex flex-col" style={{ background: 'linear-gradient(160deg,#f0fdf8,#ffffff)' }}>
      {/* Progress dots */}
      <div className="flex items-center justify-between px-6 pt-6 shrink-0">
        <div className="flex gap-1.5">
          {STEPS.map((_, i) => (
            <div key={i} className="h-1.5 rounded-full transition-all" style={{ width: i === step ? 24 : 8, background: i <= step ? '#0f6e56' : '#e5e7eb' }} />
          ))}
        </div>
        {!isLast && <button onClick={skip} className="text-xs text-gray-400 font-semibold">Skip</button>}
      </div>

      {/* Content */}
      <div className="flex-1 flex flex-col items-center justify-center px-6 py-8 max-w-md mx-auto w-full">
        <div className="w-20 h-20 rounded-3xl flex items-center justify-center mb-6 shadow-lg" style={{ background: `linear-gradient(135deg,${current.color},${current.color}cc)` }}>
          <Icon size={36} className="text-white" />
        </div>

        <h1 className="text-2xl font-black text-gray-900 text-center mb-2">{current.title}</h1>
        <p className="text-sm text-gray-500 text-center mb-8">{current.subtitle}</p>

        <div className="w-full space-y-3">
          {current.features.map((f, i) => (
            <div key={i} className="flex items-start gap-3 bg-white rounded-xl p-3.5 shadow-sm border border-gray-50">
              <div className="w-5 h-5 rounded-full flex items-center justify-center shrink-0 mt-0.5" style={{ background: `${current.color}20` }}>
                <Check size={11} style={{ color: current.color }} />
              </div>
              <p className="text-sm text-gray-700">{f}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Navigation */}
      <div className="px-6 pb-8 max-w-md mx-auto w-full flex gap-3 shrink-0">
        {step > 0 && (
          <button onClick={() => setStep(s => s - 1)}
            className="flex items-center justify-center gap-1 px-5 py-3.5 rounded-2xl border border-gray-200 text-gray-600 font-semibold">
            <ChevronLeft size={16} />
          </button>
        )}
        <button
          onClick={() => isLast ? complete() : setStep(s => s + 1)}
          disabled={completing}
          className="flex-1 py-3.5 rounded-2xl font-bold text-white flex items-center justify-center gap-2"
          style={{ background: 'linear-gradient(135deg,#0f6e56,#1d9e75)' }}>
          {completing ? 'Setting up...' : isLast ? <><Zap size={16}/>Get started</> : <>Continue<ChevronRight size={16}/></>}
        </button>
      </div>
    </div>
  )
}

