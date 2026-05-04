import { useState } from 'react'
import { useAuthStore } from '@/store/authStore'
import { Check, Zap, Shield, Crown, Star } from 'lucide-react'

const PLANS = [
  {
    id: 'basic',
    name: 'Basic',
    icon: Shield,
    color: '#6b7280',
    monthlyPrice: 499,
    yearlyPrice: 3999,
    yearlyMonthly: 333,
    savings: 35,
    features: [
      'Health dashboard',
      'Upload & store reports',
      'Basic trend charts',
      'Family members (2)',
      'Manual health entries',
      'AI chat (10/day)',
    ],
    cta: 'Current plan',
    isCurrent: true,
  },
  {
    id: 'pro',
    name: 'Pro',
    icon: Zap,
    color: '#0f6e56',
    monthlyPrice: 999,
    yearlyPrice: 8999,
    yearlyMonthly: 750,
    savings: 25,
    popular: true,
    features: [
      'Everything in Basic',
      'AI health insights',
      'OCR report scanning',
      'Doctor consultations (2/mo)',
      'Family members (5)',
      'Longevity Score',
      'Daily habits tracker',
      'Health timeline',
      'Predictive alerts',
    ],
    cta: 'Upgrade to Pro',
  },
  {
    id: 'premium',
    name: 'Premium',
    icon: Crown,
    color: '#d97706',
    monthlyPrice: 1999,
    yearlyPrice: 12999,
    yearlyMonthly: 1083,
    savings: 46,
    features: [
      'Everything in Pro',
      'Unlimited doctor consults',
      'Annual full-body tests',
      'Priority doctor access',
      'Unlimited family members',
      'WhatsApp alerts',
      'Dedicated health coach',
      'Advanced AI analysis',
    ],
    cta: 'Upgrade to Premium',
  },
]

export default function SubscriptionPage() {
  const { user } = useAuthStore()
  const [yearly, setYearly] = useState(false)
  const currentPlan = user?.plan || 'basic'

  function handleUpgrade(planId: string) {
    if (planId === currentPlan) return
    alert(`Razorpay payment for ${planId} plan — integrate your Razorpay key to enable payments.`)
  }

  return (
    <div className="p-4 pb-8 max-w-lg mx-auto space-y-5">
      {/* Header */}
      <div className="text-center pt-2">
        <h1 className="text-xl font-bold text-gray-900">Choose your plan</h1>
        <p className="text-sm text-gray-500 mt-1">Prevent diseases before they start. Cancel anytime.</p>
      </div>

      {/* Toggle */}
      <div className="flex items-center justify-center gap-3">
        <span className={`text-sm font-semibold ${!yearly ? 'text-gray-900' : 'text-gray-400'}`}>Monthly</span>
        <button onClick={() => setYearly(y => !y)}
          className="relative w-12 h-6 rounded-full transition-colors"
          style={{ background: yearly ? 'linear-gradient(135deg,#0f6e56,#1d9e75)' : '#d1d5db' }}>
          <div className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow-sm transition-transform ${yearly ? 'translate-x-6' : 'translate-x-0.5'}`} />
        </button>
        <span className={`text-sm font-semibold ${yearly ? 'text-gray-900' : 'text-gray-400'}`}>
          Yearly{' '}
          <span className="text-teal-600 font-bold">Save up to 46%</span>
        </span>
      </div>

      {/* Plan cards — stacked on mobile */}
      <div className="space-y-3">
        {PLANS.map(plan => {
          const Icon = plan.icon
          const isCurrent = currentPlan === plan.id
          const price = yearly ? plan.yearlyMonthly : plan.monthlyPrice

          return (
            <div key={plan.id}
              className={`card !p-5 relative transition-all ${
                plan.popular
                  ? 'ring-2 border-transparent'
                  : isCurrent ? 'border-gray-300' : ''
              }`}
              style={plan.popular ? { ringColor: plan.color, borderColor: plan.color } : {}}>

              {/* Most popular badge */}
              {plan.popular && (
                <div className="absolute -top-3.5 left-1/2 -translate-x-1/2 px-4 py-1 rounded-full text-xs font-bold text-white flex items-center gap-1"
                  style={{ background: 'linear-gradient(135deg,#0f6e56,#1d9e75)' }}>
                  <Star size={10} fill="white" /> Most popular
                </div>
              )}

              {/* Plan header */}
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl flex items-center justify-center"
                    style={{ background: `${plan.color}15` }}>
                    <Icon size={20} style={{ color: plan.color }} />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h2 className="text-base font-bold text-gray-900">{plan.name}</h2>
                      {isCurrent && (
                        <span className="text-[10px] bg-teal-50 text-teal-700 border border-teal-200 px-2 py-0.5 rounded-full font-bold">
                          Current
                        </span>
                      )}
                    </div>
                    <div className="flex items-baseline gap-1 mt-0.5">
                      <span className="text-2xl font-black text-gray-900">₹{price.toLocaleString()}</span>
                      <span className="text-xs text-gray-400">/mo</span>
                    </div>
                    {yearly && (
                      <p className="text-[10px] text-gray-400">
                        ₹{plan.yearlyPrice.toLocaleString()}/yr billed annually · Save {plan.savings}%
                      </p>
                    )}
                  </div>
                </div>
              </div>

              {/* Features */}
              <div className="space-y-2 mb-4">
                {plan.features.map(f => (
                  <div key={f} className="flex items-start gap-2.5">
                    <div className="w-4 h-4 rounded-full flex items-center justify-center shrink-0 mt-0.5"
                      style={{ background: `${plan.color}20` }}>
                      <Check size={10} style={{ color: plan.color }} strokeWidth={3} />
                    </div>
                    <span className="text-xs text-gray-600 leading-relaxed">{f}</span>
                  </div>
                ))}
              </div>

              {/* CTA */}
              <button
                onClick={() => handleUpgrade(plan.id)}
                disabled={isCurrent}
                className={`w-full py-3 rounded-xl text-sm font-bold transition-all ${
                  isCurrent
                    ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                    : 'text-white'
                }`}
                style={!isCurrent ? {
                  background: `linear-gradient(135deg, ${plan.color}, ${plan.color}cc)`,
                  boxShadow: `0 4px 12px ${plan.color}40`
                } : {}}>
                {isCurrent ? 'Current plan' : plan.cta}
              </button>
            </div>
          )
        })}
      </div>

      {/* Trust badges */}
      <div className="card !p-4 text-center space-y-2">
        <p className="text-xs font-bold text-gray-700">Why upgrade?</p>
        <div className="grid grid-cols-2 gap-2">
          {[
            { e: '🔒', t: 'Cancel anytime' },
            { e: '🇮🇳', t: 'Made for India' },
            { e: '🔬', t: 'Thyrocare · SRL · Apollo' },
            { e: '🤖', t: 'Groq AI — Free tier' },
          ].map(b => (
            <div key={b.t} className="bg-gray-50 rounded-lg px-3 py-2">
              <span className="text-base">{b.e}</span>
              <p className="text-[10px] text-gray-500 mt-0.5">{b.t}</p>
            </div>
          ))}
        </div>
      </div>

      {/* FAQ */}
      <div className="space-y-2">
        {[
          { q: 'Can I change plans later?', a: 'Yes, upgrade or downgrade anytime. Changes take effect immediately.' },
          { q: 'Is my health data safe?', a: 'Yes. Data is encrypted and stored securely on Supabase. We never sell your data.' },
          { q: 'How does AI analysis work?', a: 'We use Groq (Llama 3.3) to analyze your lab values and generate personalized insights — completely free on our end.' },
        ].map(faq => (
          <div key={faq.q} className="card !p-4">
            <p className="text-xs font-bold text-gray-800 mb-1">{faq.q}</p>
            <p className="text-xs text-gray-500 leading-relaxed">{faq.a}</p>
          </div>
        ))}
      </div>
    </div>
  )
}
