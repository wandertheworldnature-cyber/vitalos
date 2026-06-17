import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'

const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY') || ''

serve(async (req) => {
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  }
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    const { 
      patient_email, patient_name, doctor_name, doctor_specialty,
      hospital, slot_date, slot_time, room_id, mode 
    } = await req.json()

    // Generate VitalOS consultation link (not Jitsi)
    const consultationLink = `https://vitalos-six.vercel.app/consultation/${room_id}`
    
    const dateStr = new Date(slot_date + 'T00:00:00').toLocaleDateString('en-IN', {
      weekday: 'long', day: 'numeric', month: 'long', year: 'numeric'
    })

    const html = `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"/></head>
<body style="margin:0;padding:0;background:#f0fdf8;font-family:'Helvetica Neue',Arial,sans-serif;">
  <div style="max-width:560px;margin:40px auto;background:#fff;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.08);">
    
    <!-- Header -->
    <div style="background:linear-gradient(135deg,#0f6e56,#1d9e75);padding:32px;text-align:center;">
      <div style="display:inline-flex;align-items:center;gap:10px;margin-bottom:8px;">
        <div style="width:36px;height:36px;background:rgba(255,255,255,0.2);border-radius:10px;display:inline-flex;align-items:center;justify-content:center;">❤️</div>
        <span style="font-size:20px;font-weight:800;color:#fff;letter-spacing:-0.5px;">VitalOS</span>
      </div>
      <p style="color:rgba(255,255,255,0.7);font-size:13px;margin:0;">Your Health Operating System</p>
    </div>

    <!-- Body -->
    <div style="padding:32px;">
      <h1 style="font-size:22px;font-weight:800;color:#0f2a1e;margin:0 0 8px;">Consultation Confirmed ✅</h1>
      <p style="color:#6b7280;font-size:15px;margin:0 0 28px;">Hi ${patient_name}, your appointment has been booked successfully.</p>

      <!-- Details card -->
      <div style="background:#f0fdf8;border:1px solid #a7f3d0;border-radius:12px;padding:20px;margin-bottom:24px;">
        <table style="width:100%;border-collapse:collapse;">
          <tr><td style="padding:8px 0;border-bottom:1px solid #d1fae5;color:#6b7280;font-size:13px;width:120px;">Doctor</td>
              <td style="padding:8px 0;border-bottom:1px solid #d1fae5;font-weight:700;color:#0f2a1e;font-size:14px;">Dr. ${doctor_name}</td></tr>
          <tr><td style="padding:8px 0;border-bottom:1px solid #d1fae5;color:#6b7280;font-size:13px;">Specialty</td>
              <td style="padding:8px 0;border-bottom:1px solid #d1fae5;color:#374151;font-size:14px;">${doctor_specialty}</td></tr>
          <tr><td style="padding:8px 0;border-bottom:1px solid #d1fae5;color:#6b7280;font-size:13px;">Hospital</td>
              <td style="padding:8px 0;border-bottom:1px solid #d1fae5;color:#374151;font-size:14px;">${hospital || 'VitalOS Clinic'}</td></tr>
          <tr><td style="padding:8px 0;border-bottom:1px solid #d1fae5;color:#6b7280;font-size:13px;">Patient</td>
              <td style="padding:8px 0;border-bottom:1px solid #d1fae5;color:#374151;font-size:14px;">${patient_name}</td></tr>
          <tr><td style="padding:8px 0;border-bottom:1px solid #d1fae5;color:#6b7280;font-size:13px;">Date</td>
              <td style="padding:8px 0;border-bottom:1px solid #d1fae5;font-weight:700;color:#0f6e56;font-size:14px;">${dateStr}</td></tr>
          <tr><td style="padding:8px 0;border-bottom:1px solid #d1fae5;color:#6b7280;font-size:13px;">Time</td>
              <td style="padding:8px 0;border-bottom:1px solid #d1fae5;font-weight:700;color:#0f6e56;font-size:14px;">${slot_time}</td></tr>
          <tr><td style="padding:8px 0;color:#6b7280;font-size:13px;">Mode</td>
              <td style="padding:8px 0;color:#374151;font-size:14px;">${mode === 'video' ? '📹 Video consultation' : '🏥 In-person visit'}</td></tr>
        </table>
      </div>

      ${mode === 'video' ? `
      <!-- Video call button -->
      <div style="text-align:center;margin-bottom:24px;">
        <p style="color:#374151;font-size:14px;margin-bottom:16px;">At your appointment time, click below to join:</p>
        <a href="${consultationLink}" 
           style="display:inline-block;background:linear-gradient(135deg,#0f6e56,#1d9e75);color:#fff;text-decoration:none;padding:14px 32px;border-radius:50px;font-weight:700;font-size:15px;letter-spacing:0.3px;">
          🎥 Join Video Consultation
        </a>
        <p style="color:#9ca3af;font-size:12px;margin-top:12px;">Or copy this link: <span style="color:#0f6e56;">${consultationLink}</span></p>
      </div>
      ` : ''}

      <!-- Tips -->
      <div style="background:#fffbeb;border:1px solid #fde68a;border-radius:10px;padding:16px;margin-bottom:24px;">
        <p style="font-weight:700;color:#92400e;font-size:13px;margin:0 0 8px;">📋 Before your appointment</p>
        <ul style="margin:0;padding-left:18px;color:#78350f;font-size:13px;line-height:1.8;">
          <li>Keep your latest lab reports handy</li>
          <li>Note down any symptoms or questions</li>
          ${mode === 'video' ? '<li>Test your camera and microphone beforehand</li><li>Find a quiet, well-lit space</li>' : '<li>Carry your ID and insurance card</li>'}
        </ul>
      </div>

      <p style="color:#9ca3af;font-size:12px;text-align:center;margin:0;">
        Need to reschedule? Contact us at <a href="mailto:info@VitalOS.App" style="color:#0f6e56;">info@VitalOS.App</a>
      </p>
    </div>

    <!-- Footer -->
    <div style="background:#f0fdf8;padding:20px 32px;text-align:center;border-top:1px solid #d1fae5;">
      <p style="color:#9ca3af;font-size:11px;margin:0;">
        © 2026 VitalOS · Your Health Operating System · 
        <a href="https://vitalos-six.vercel.app" style="color:#0f6e56;">vitalos-six.vercel.app</a>
      </p>
    </div>
  </div>
</body>
</html>`

    // Send via Resend
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${RESEND_API_KEY}` },
      body: JSON.stringify({
        from: 'VitalOS <info@VitalOS.App>',
        to: [patient_email],
        subject: `✅ Appointment confirmed — Dr. ${doctor_name} on ${dateStr}`,
        html,
      })
    })

    const result = await res.json()
    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e) }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }
})
