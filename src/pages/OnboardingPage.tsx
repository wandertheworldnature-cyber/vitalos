import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Heart, ArrowRight, ArrowLeft, Check } from 'lucide-react'
import { useAuthStore } from '@/store/authStore'
import { supabase } from '@/lib/supabase'
import { addFamilyMember } from '@/services/healthService'
import toast from 'react-hot-toast'

const HEALTH_GOALS = [
  'Prevent diabetes', 'Improve heart health', 'Manage weight',
  'Better sleep', 'Reduce stress', 'Monitor thyroid',
  'Track family health', 'Longevity & aging well',
]

const CONDITIONS = [
  'None', 'Pre-diabetes', 'Type 2 Diabetes', 'Hypertension',
  'Thyroid disorder', 'High cholesterol', 'Heart disease', 'PCOS',
]

const WEARABLES = ['None', 'Apple Watch', 'Fitbit', 'Garmin', 'Mi Band', 'Samsung Galaxy Watch', 'Other']

export default function OnboardingPage() {
  const { user, fetchProfile } = useAuthStore()
  const navigate = useNavigate()
  const [step, setStep] = useState(1)
  const [saving, setSaving] = useState(false)
  const totalSteps = 5

  const [form, setForm] = useState({
    fullName: user?.full_name || '',
    dob: '',
    gender: '',
    phone: '',
    goals: [] as string[],
    conditions: [] as string[],
    wearable: '',
    familyName: '',
    familyRelation: '',
    familyAge: '',
  })

  function toggleArray(key: 'goals' | 'conditions', val: string) {
    setForm(f => ({
      ...f,
      [key]: f[key].includes(val) ? f[key].filter(v => v !== val) : [...f[key], val],
    }))
  }

  async function handleFinish() {
    if (!user) return
    setSaving(true)
    try {
      // Update profile
      await supabase.from('profiles').update({
        full_name: form.fullName,
        date_of_birth: form.dob,
        gender: form.gender,
        phone: form.phone,
      }).eq('id', user.id)

      // Add family member if provided
      if (form.familyName && form.familyRelation) {
        await addFamilyMember({
          user_id: user.id,
          name: form.familyName,
          relation: form.familyRelation,
          age: parseInt(form.familyAge) || 0,
          gender: 'other',
          avatar_color: '#9FE1CB',
        })
      }

      await fetchProfile(user.id)
      toast.success('Welcome to VitalOS!')
      navigate('/dashboard')
    } catch {
      toast.error('Setup failed — you can update this in settings')
      navigate('/dashboard')
    } finally {
      setSaving(false)
    }
  }

  const steps = [
    { num: 1, label: 'Basic info' },
    { num: 2, label: 'Health goals' },
    { num: 3, label: 'Medical history' },
    { num: 4, label: 'Wearables' },
    { num: 5, label: 'Family' },
  ]

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="w-full max-w-lg">
        {/* Logo */}
        <div className="flex items-center justify-center gap-2 mb-8">
          <div className="w-9 h-9 rounded-xl bg-teal-400 flex items-center justify-center">
            <Heart size={18} className="text-white" />
          </div>
          <span className="text-xl font-medium text-gray-900">VitalOS</span>
        </div>

        {/* Progress */}
        <div className="flex items-center gap-2 mb-8">
          {steps.map((s, i) => (
            <div key={s.num} className="flex items-center flex-1">
              <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-medium transition-colors shrink-0 ${
                step > s.num ? 'bg-teal-500 text-white' :
                step === s.num ? 'bg-gray-900 text-white' :
                'bg-gray-200 text-gray-400'
              }`}>
                {step > s.num ? <Check size={12} /> : s.num}
              </div>
              {i < steps.length - 1 && (
                <div className={`flex-1 h-0.5 mx-1 ${step > s.num ? 'bg-teal-400' : 'bg-gray-200'}`} />
              )}
            </div>
          ))}
        </div>

        <div className="card">
          {step === 1 && (
            <div className="space-y-4">
              <h2 className="text-lg font-medium text-gray-900">Tell us about yourself</h2>
              <div>
                <label className="text-xs text-gray-500 mb-1 block">Full name</label>
                <input className="input" value={form.fullName} onChange={e => setForm(f => ({ ...f, fullName: e.target.value }))} placeholder="Ravi Kumar" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-gray-500 mb-1 block">Date of birth</label>
                  <input type="date" className="input" value={form.dob} onChange={e => setForm(f => ({ ...f, dob: e.target.value }))} />
                </div>
                <div>
                  <label className="text-xs text-gray-500 mb-1 block">Gender</label>
                  <select className="input" value={form.gender} onChange={e => setForm(f => ({ ...f, gender: e.target.value }))}>
                    <option value="">Select</option>
                    <option value="male">Male</option>
                    <option value="female">Female</option>
                    <option value="other">Other</option>
                  </select>
                </div>
              </div>
              <div>
                <label className="text-xs text-gray-500 mb-1 block">Phone (for appointment reminders)</label>
                <input className="input" value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} placeholder="+91 98765 43210" />
              </div>
            </div>
          )}

          {step === 2 && (
            <div className="space-y-4">
              <h2 className="text-lg font-medium text-gray-900">What are your health goals?</h2>
              <p className="text-sm text-gray-400">Select all that apply — we'll personalize your insights.</p>
              <div className="grid grid-cols-2 gap-2">
                {HEALTH_GOALS.map(g => (
                  <button
                    key={g}
                    onClick={() => toggleArray('goals', g)}
                    className={`text-sm text-left px-3 py-2.5 rounded-lg border transition-colors ${
                      form.goals.includes(g)
                        ? 'bg-teal-50 border-teal-400 text-teal-700'
                        : 'border-gray-200 text-gray-600 hover:border-gray-300'
                    }`}
                  >
                    {form.goals.includes(g) && <Check size={12} className="inline mr-1.5 text-teal-500" />}
                    {g}
                  </button>
                ))}
              </div>
            </div>
          )}

          {step === 3 && (
            <div className="space-y-4">
              <h2 className="text-lg font-medium text-gray-900">Any existing conditions?</h2>
              <p className="text-sm text-gray-400">This helps our AI give more relevant insights.</p>
              <div className="grid grid-cols-2 gap-2">
                {CONDITIONS.map(c => (
                  <button
                    key={c}
                    onClick={() => toggleArray('conditions', c)}
                    className={`text-sm text-left px-3 py-2.5 rounded-lg border transition-colors ${
                      form.conditions.includes(c)
                        ? 'bg-teal-50 border-teal-400 text-teal-700'
                        : 'border-gray-200 text-gray-600 hover:border-gray-300'
                    }`}
                  >
                    {form.conditions.includes(c) && <Check size={12} className="inline mr-1.5 text-teal-500" />}
                    {c}
                  </button>
                ))}
              </div>
            </div>
          )}

          {step === 4 && (
            <div className="space-y-4">
              <h2 className="text-lg font-medium text-gray-900">Do you use a wearable?</h2>
              <p className="text-sm text-gray-400">We can automatically sync steps, heart rate, and sleep data.</p>
              <div className="grid grid-cols-2 gap-2">
                {WEARABLES.map(w => (
                  <button
                    key={w}
                    onClick={() => setForm(f => ({ ...f, wearable: w }))}
                    className={`text-sm text-left px-3 py-2.5 rounded-lg border transition-colors ${
                      form.wearable === w
                        ? 'bg-teal-50 border-teal-400 text-teal-700'
                        : 'border-gray-200 text-gray-600 hover:border-gray-300'
                    }`}
                  >
                    {form.wearable === w && <Check size={12} className="inline mr-1.5 text-teal-500" />}
                    {w}
                  </button>
                ))}
              </div>
              {form.wearable && form.wearable !== 'None' && (
                <div className="bg-blue-50 rounded-lg p-3">
                  <p className="text-xs text-blue-700 font-medium">Integration note</p>
                  <p className="text-xs text-blue-600 mt-1">
                    {form.wearable} sync can be configured in Settings after setup. You'll need to authorize access in the {form.wearable} app.
                  </p>
                </div>
              )}
            </div>
          )}

          {step === 5 && (
            <div className="space-y-4">
              <h2 className="text-lg font-medium text-gray-900">Add a family member</h2>
              <p className="text-sm text-gray-400">VitalOS tracks whole-family health. Add more anytime.</p>
              <div>
                <label className="text-xs text-gray-500 mb-1 block">Name</label>
                <input className="input" value={form.familyName} onChange={e => setForm(f => ({ ...f, familyName: e.target.value }))} placeholder="Father / Mother / Spouse..." />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-gray-500 mb-1 block">Relation</label>
                  <select className="input" value={form.familyRelation} onChange={e => setForm(f => ({ ...f, familyRelation: e.target.value }))}>
                    <option value="">Select</option>
                    {['Father', 'Mother', 'Spouse', 'Child', 'Sibling', 'Grandparent'].map(r => (
                      <option key={r} value={r.toLowerCase()}>{r}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-xs text-gray-500 mb-1 block">Age</label>
                  <input type="number" className="input" value={form.familyAge} onChange={e => setForm(f => ({ ...f, familyAge: e.target.value }))} placeholder="62" />
                </div>
              </div>
              <p className="text-xs text-gray-400">
                Or skip — you can add family members anytime from the Family section.
              </p>
            </div>
          )}

          {/* Nav buttons */}
          <div className="flex items-center justify-between mt-6 pt-4 border-t border-gray-100">
            <button
              onClick={() => setStep(s => s - 1)}
              disabled={step === 1}
              className="btn-secondary flex items-center gap-2 disabled:opacity-40"
            >
              <ArrowLeft size={14} /> Back
            </button>

            {step < totalSteps ? (
              <button
                onClick={() => setStep(s => s + 1)}
                className="btn-primary flex items-center gap-2"
              >
                Continue <ArrowRight size={14} />
              </button>
            ) : (
              <button
                onClick={handleFinish}
                disabled={saving}
                className="btn-primary flex items-center gap-2"
              >
                {saving ? 'Setting up...' : 'Enter VitalOS'} <ArrowRight size={14} />
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
