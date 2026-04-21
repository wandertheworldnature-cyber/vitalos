import { useState } from 'react'
import { Check, Zap, AlertCircle } from 'lucide-react'
import { useAuthStore } from '@/store/authStore'
import { PLANS, openRazorpay } from '@/services/razorpayService'
import toast from 'react-hot-toast'

export default function SubscriptionPage() {
  const { user } = useAuthStore()
  const [billing, setBilling] = useState<'monthly' | 'yearly'>('monthly')
  const [loading, setLoading] = useState<string | null>(null)
  const [razorpayError, setRazorpayError] = useState(false)

  async function handleSubscribe(planId: string) {
    if (!user) { toast.error('Please sign in first'); return }
    if (user.plan === planId) { toast('You are already on this plan'); return }

    setLoading(planId)
    setRazorpayError(false)
    try {
      await openRazorpay({
        plan: planId,
        billingCycle: billing,
        userId: user.id,
        userName: user.full_name,
        userEmail: user.email,
        onSuccess: (paymentId) => {
          toast.success(`Payment successful! Upgraded to ${planId.charAt(0).toUpperCase() + planId.slice(1)} plan.`)
          toast(`Payment ID: ${paymentId.slice(0, 16)}...`, { icon: '🧾' })
          // Refresh page to show new plan
          setTimeout(() => window.location.reload(), 1500)
        },
        onFailure: () => {
          toast.error('Payment cancelled')
          setLoading(null)
        },
      })
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : ''
      if (msg === 'RAZORPAY_NOT_CONFIGURED') {
        setRazorpayError(true)
        toast.error('Add VITE_RAZORPAY_KEY_ID to your .env file')
      } else {
        toast.error(`Payment error: ${msg}`)
      }
      setLoading(null)
    }
  }

  const savings = (plan: typeof PLANS[0]) =>
    Math.round(((plan.price_monthly * 12 - plan.price_yearly) / (plan.price_monthly * 12)) * 100)

  return (
    <div className="p-6 max-w-4xl">
      <div className="text-center mb-8">
        <h1 className="text-2xl font-semibold text-gray-900 mb-2">Choose your plan</h1>
        <p className="text-gray-500 text-sm">Prevent diseases before they start. Cancel anytime.</p>

        {/* Razorpay config warning */}
        {razorpayError && (
          <div className="mt-4 bg-amber-50 border border-amber-200 rounded-xl p-4 text-left max-w-lg mx-auto">
            <div className="flex gap-2">
              <AlertCircle size={16} className="text-amber-600 mt-0.5 shrink-0" />
              <div>
                <p className="text-xs font-bold text-amber-800 mb-1">Razorpay not configured</p>
                <ol className="text-xs text-amber-700 space-y-0.5 list-decimal list-inside">
                  <li>Go to <strong>dashboard.razorpay.com</strong> → Sign up free</li>
                  <li>Settings → API Keys → Generate Test Key</li>
                  <li>Add to your <strong>.env</strong> file: <code className="bg-amber-100 px-1 rounded">VITE_RAZORPAY_KEY_ID=rzp_test_xxx</code></li>
                  <li>Restart the dev server (<code className="bg-amber-100 px-1 rounded">npm run dev</code>)</li>
                </ol>
              </div>
            </div>
          </div>
        )}

        {/* Billing toggle */}
        <div className="flex items-center justify-center gap-3 mt-5">
          <span className={`text-sm ${billing === 'monthly' ? 'text-gray-900 font-medium' : 'text-gray-400'}`}>Monthly</span>
          <button
            onClick={() => setBilling(b => b === 'monthly' ? 'yearly' : 'monthly')}
            className={`relative w-12 h-6 rounded-full transition-colors ${billing === 'yearly' ? 'bg-teal-500' : 'bg-gray-200'}`}
          >
            <div className={`absolute top-1 w-4 h-4 bg-white rounded-full shadow transition-transform ${billing === 'yearly' ? 'translate-x-7' : 'translate-x-1'}`} />
          </button>
          <span className={`text-sm ${billing === 'yearly' ? 'text-gray-900 font-medium' : 'text-gray-400'}`}>
            Yearly <span className="ml-1 text-xs text-teal-600 font-medium">Save up to 35%</span>
          </span>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-5">
        {PLANS.map(plan => {
          const price = billing === 'monthly' ? plan.price_monthly : plan.price_yearly
          const isCurrent = user?.plan === plan.id
          const isLoading = loading === plan.id

          return (
            <div key={plan.id} className={`card relative flex flex-col ${plan.highlight ? 'border-teal-400 ring-1 ring-teal-200' : ''}`}>
              {plan.highlight && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                  <span className="bg-teal-500 text-white text-[10px] font-semibold px-3 py-1 rounded-full flex items-center gap-1">
                    <Zap size={10} /> Most popular
                  </span>
                </div>
              )}
              {isCurrent && (
                <div className="absolute top-3 right-3">
                  <span className="badge-green">Current plan</span>
                </div>
              )}
              <div className="mb-5">
                <h2 className="text-base font-semibold text-gray-900 mb-1">{plan.name}</h2>
                <div className="flex items-baseline gap-1">
                  <span className="text-3xl font-bold text-gray-900">₹{price.toLocaleString('en-IN')}</span>
                  <span className="text-sm text-gray-400">/{billing === 'monthly' ? 'mo' : 'yr'}</span>
                </div>
                {billing === 'yearly' && (
                  <p className="text-xs text-teal-600 font-medium mt-1">Save {savings(plan)}% vs monthly</p>
                )}
                {billing === 'monthly' && (
                  <p className="text-xs text-gray-400 mt-1">₹{plan.price_yearly.toLocaleString('en-IN')}/yr billed annually</p>
                )}
              </div>

              <ul className="space-y-2.5 flex-1 mb-6">
                {plan.features.map(f => (
                  <li key={f} className="flex items-start gap-2 text-sm text-gray-600">
                    <Check size={14} className="text-teal-500 mt-0.5 shrink-0" />
                    {f}
                  </li>
                ))}
              </ul>

              <button
                onClick={() => handleSubscribe(plan.id)}
                disabled={isCurrent || isLoading}
                className={`w-full py-2.5 rounded-lg text-sm font-semibold transition-colors ${
                  isCurrent ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                  : plan.highlight ? 'bg-teal-500 text-white hover:bg-teal-600'
                  : 'border border-gray-200 text-gray-700 hover:bg-gray-50'
                }`}
              >
                {isLoading ? 'Opening payment...' : isCurrent ? 'Current plan' : `Get ${plan.name}`}
              </button>
            </div>
          )
        })}
      </div>

      <div className="mt-8 grid grid-cols-3 gap-4 text-center">
        {[
          { icon: '🔒', title: 'Secure payments', desc: 'Razorpay PCI-DSS compliant' },
          { icon: '🏥', title: 'HIPAA-grade privacy', desc: 'Your health data stays yours' },
          { icon: '↩️', title: 'Cancel anytime', desc: 'No lock-in, no hidden fees' },
        ].map(t => (
          <div key={t.title} className="card text-center">
            <div className="text-2xl mb-2">{t.icon}</div>
            <p className="text-xs font-semibold text-gray-900">{t.title}</p>
            <p className="text-xs text-gray-400">{t.desc}</p>
          </div>
        ))}
      </div>

      <div className="mt-8">
        <h2 className="text-base font-semibold text-gray-900 mb-4">Frequently asked</h2>
        <div className="space-y-3">
          {[
            { q: 'Can I upgrade later?', a: 'Yes — upgrade or downgrade anytime. Prorated billing handled automatically.' },
            { q: 'Is my health data safe?', a: "All data encrypted at rest. We follow India's DPDP Act 2023. We never sell your data." },
            { q: 'Which labs are integrated?', a: 'Thyrocare, SRL, Apollo Diagnostics, Metropolis, Sterling Accuris. More added quarterly.' },
            { q: 'Are doctor consultations included?', a: 'Pro includes 2 consults/month. Premium is unlimited. Basic can purchase at ₹499/consult.' },
          ].map(faq => (
            <details key={faq.q} className="card cursor-pointer">
              <summary className="text-sm font-medium text-gray-800 list-none flex items-center justify-between">
                {faq.q} <span className="text-gray-400 text-lg">+</span>
              </summary>
              <p className="text-xs text-gray-500 mt-3 leading-relaxed">{faq.a}</p>
            </details>
          ))}
        </div>
      </div>
    </div>
  )
}
