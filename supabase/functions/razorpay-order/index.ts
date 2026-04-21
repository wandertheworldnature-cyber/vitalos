// supabase/functions/razorpay-order/index.ts
// Deploy: supabase functions deploy razorpay-order
// Creates a Razorpay order and returns order_id to frontend

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { plan, billingCycle, userId } = await req.json()
    const keyId = Deno.env.get('RAZORPAY_KEY_ID')!
    const keySecret = Deno.env.get('RAZORPAY_KEY_SECRET')!
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

    const PRICES: Record<string, Record<string, number>> = {
      basic:   { monthly: 49900,  yearly: 399900  }, // paise
      pro:     { monthly: 99900,  yearly: 899900  },
      premium: { monthly: 199900, yearly: 1299900 },
    }

    const amount = PRICES[plan]?.[billingCycle] || 49900
    const currency = 'INR'

    // Create Razorpay order
    const auth = btoa(`${keyId}:${keySecret}`)
    const orderRes = await fetch('https://api.razorpay.com/v1/orders', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Basic ${auth}`,
      },
      body: JSON.stringify({
        amount,
        currency,
        receipt: `vitalos_${Date.now()}`,
        notes: { plan, billingCycle, userId },
      })
    })

    const order = await orderRes.json()
    if (!orderRes.ok) throw new Error(order.error?.description || 'Razorpay error')

    // Store payment record in Supabase
    await fetch(`${supabaseUrl}/rest/v1/payments`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': supabaseKey,
        'Authorization': `Bearer ${supabaseKey}`,
      },
      body: JSON.stringify({
        user_id: userId,
        razorpay_order_id: order.id,
        amount,
        currency,
        plan,
        billing_cycle: billingCycle,
        status: 'created',
      })
    })

    return new Response(JSON.stringify({ orderId: order.id, amount, currency }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (error) {
    return new Response(JSON.stringify({ error: String(error) }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
