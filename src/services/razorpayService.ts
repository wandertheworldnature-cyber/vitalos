// src/services/razorpayService.ts
// Razorpay TEST MODE — no backend needed for dev/testing
// Uses Razorpay's test key directly from the browser
// For production: move order creation to Supabase Edge Function

import { supabase } from '@/lib/supabase'

declare global {
  interface Window {
    Razorpay: new (options: RazorpayOptions) => RazorpayInstance
  }
}

interface RazorpayOptions {
  key: string; amount: number; currency: string; name: string
  description: string; handler: (r: RazorpayResponse) => void
  prefill?: { name?: string; email?: string }
  theme?: { color?: string }; modal?: { ondismiss?: () => void }
  // In test mode without an order_id, Razorpay still works for demo
  order_id?: string
}
interface RazorpayInstance { open: () => void }
interface RazorpayResponse {
  razorpay_order_id?: string
  razorpay_payment_id: string
  razorpay_signature?: string
}

export const PLANS = [
  {
    id: 'basic' as const, name: 'Basic',
    price_monthly: 499, price_yearly: 3999,
    features: ['Health dashboard','Upload & store reports','Basic trend charts','Family members (2)','Manual health entries'],
  },
  {
    id: 'pro' as const, name: 'Pro',
    price_monthly: 999, price_yearly: 8999, highlight: true,
    features: ['Everything in Basic','AI health insights','OCR report scanning','Doctor consultations (2/mo)','Family members (5)','Risk predictions','Personalized action plans'],
  },
  {
    id: 'premium' as const, name: 'Premium',
    price_monthly: 1999, price_yearly: 12999,
    features: ['Everything in Pro','Annual full-body tests','Unlimited doctor consults','Priority doctor access','Unlimited family members','Longevity score tracking','Dedicated health coach'],
  },
]

function getRazorpayKey(): string {
  const key = import.meta.env.VITE_RAZORPAY_KEY_ID
  if (!key || key.includes('your-key-id') || !key.startsWith('rzp_')) {
    throw new Error('RAZORPAY_NOT_CONFIGURED')
  }
  return key
}

function loadRazorpayScript(): Promise<boolean> {
  return new Promise(resolve => {
    if (window.Razorpay) { resolve(true); return }
    const script = document.createElement('script')
    script.src = 'https://checkout.razorpay.com/v1/checkout.js'
    script.onload = () => resolve(true)
    script.onerror = () => resolve(false)
    document.body.appendChild(script)
  })
}

export async function openRazorpay(options: {
  plan: string; billingCycle: 'monthly' | 'yearly'
  userId: string; userName?: string; userEmail?: string
  onSuccess: (paymentId: string) => void
  onFailure: () => void
}) {
  const key = getRazorpayKey()
  const loaded = await loadRazorpayScript()
  if (!loaded) throw new Error('Could not load Razorpay checkout')

  const planData = PLANS.find(p => p.id === options.plan)
  if (!planData) throw new Error('Invalid plan')

  const amount = (options.billingCycle === 'monthly'
    ? planData.price_monthly
    : planData.price_yearly) * 100 // paise

  // In test mode, we can open Razorpay without a server-generated order_id
  // This works for demos. For production, generate order_id from your backend.
  const rzp = new window.Razorpay({
    key,
    amount,
    currency: 'INR',
    name: 'VitalOS',
    description: `${planData.name} Plan — ${options.billingCycle}`,
    prefill: { name: options.userName, email: options.userEmail },
    theme: { color: '#0f6e56' },
    handler: async (response) => {
      // Payment successful — update user plan in Supabase
      try {
        await supabase.from('profiles')
          .update({ plan: options.plan })
          .eq('id', options.userId)

        // Log the payment
        await supabase.from('payments').insert({
          user_id: options.userId,
          razorpay_payment_id: response.razorpay_payment_id,
          razorpay_order_id: response.razorpay_order_id || 'test_mode',
          amount,
          currency: 'INR',
          plan: options.plan,
          billing_cycle: options.billingCycle,
          status: 'paid',
        }).select()

        options.onSuccess(response.razorpay_payment_id)
      } catch (err) {
        console.error('Post-payment update error:', err)
        options.onSuccess(response.razorpay_payment_id) // still succeed
      }
    },
    modal: { ondismiss: options.onFailure },
  })
  rzp.open()
}
