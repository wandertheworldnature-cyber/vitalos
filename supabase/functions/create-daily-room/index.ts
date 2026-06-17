import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'

const DAILY_API_KEY = Deno.env.get('DAILY_API_KEY') || ''
const DAILY_DOMAIN = Deno.env.get('DAILY_DOMAIN') || 'vitalos'

serve(async (req) => {
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  }
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    const { roomId } = await req.json()
    const roomName = `VitalOS-${roomId.replace(/[^a-zA-Z0-9]/g, '').slice(0, 20)}`

    // First check if room already exists
    const checkRes = await fetch(`https://api.daily.co/v1/rooms/${roomName}`, {
      headers: { Authorization: `Bearer ${DAILY_API_KEY}` }
    })

    if (checkRes.ok) {
      const room = await checkRes.json()
      return new Response(JSON.stringify({ url: room.url, name: room.name }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    // Create new room
    const createRes = await fetch('https://api.daily.co/v1/rooms', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${DAILY_API_KEY}` },
      body: JSON.stringify({
        name: roomName,
        privacy: 'public',
        properties: {
          enable_prejoin_ui: false,
          enable_knocking: false,
          start_video_off: false,
          start_audio_off: false,
          exp: Math.floor(Date.now() / 1000) + 86400 * 30, // 30 days
        }
      })
    })

    const room = await createRes.json()
    return new Response(JSON.stringify({ url: room.url, name: room.name }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e) }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }
})
