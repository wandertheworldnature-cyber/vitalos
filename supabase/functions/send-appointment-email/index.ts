const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  try {
    const { appointmentId, type } = await req.json()
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const resendKey = Deno.env.get('re_b7Y1QTRs_5RyGfqyhsdzWxFCFUvqNLcuH')

    const res = await fetch(
      `${supabaseUrl}/rest/v1/appointments?id=eq.${appointmentId}&select=*,doctor:doctors(*),profile:profiles(*)`,
      { headers: { apikey: supabaseKey, Authorization: `Bearer ${supabaseKey}` } }
    )
    const [appt] = await res.json()
    if (!appt) throw new Error('Appointment not found')

    const patientEmail = appt.profile.email
    const patientName = appt.profile.full_name || patientEmail
    const doctorName = appt.doctor.name
    const specialty = appt.doctor.specialty
    const date = new Date(appt.slot_date).toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
    const time = appt.slot_time
    const meetLink = appt.meeting_link

    const subject = type === 'cancelled'
      ? `Appointment cancelled — ${doctorName}`
      : `Appointment confirmed — ${doctorName} on ${date}`

    const html = `<div style="font-family:Inter,sans-serif;max-width:520px;margin:0 auto;">
  <div style="background:#0f6e56;padding:20px 24px;border-radius:12px 12px 0 0;">
    <h2 style="color:white;margin:0;">VitalOS</h2>
    <p style="color:#86efcb;margin:4px 0 0;font-size:13px;">Your health operating system</p>
  </div>
  <div style="background:#fff;border:1px solid #e5e7eb;border-top:none;padding:24px;border-radius:0 0 12px 12px;">
    <h3 style="color:#1a1a1a;margin-top:0;">${type === 'cancelled' ? 'Appointment cancelled' : '✅ Appointment confirmed!'}</h3>
    <p style="color:#4b5563;">Hi ${patientName},</p>
    <div style="background:#f0fdf4;border:1px solid #bbf7d0;border-radius:10px;padding:16px;margin:16px 0;">
      <table style="width:100%;font-size:14px;">
        <tr><td style="color:#6b7280;width:100px;">Doctor</td><td style="font-weight:500;">${doctorName}</td></tr>
        <tr><td style="color:#6b7280;">Specialty</td><td>${specialty}</td></tr>
        <tr><td style="color:#6b7280;">Date</td><td>${date}</td></tr>
        <tr><td style="color:#6b7280;">Time</td><td style="font-weight:500;">${time}</td></tr>
      </table>
    </div>
    ${meetLink && type !== 'cancelled' ? `<a href="${meetLink}" style="display:inline-block;background:#0f6e56;color:white;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:600;">Join video call</a>` : ''}
    <p style="color:#9ca3af;font-size:12px;margin-top:20px;">Sent by VitalOS on behalf of ${doctorName}. The consultation is conducted by ${doctorName}. VitalOS is the platform facilitating the booking.</p>
  </div>
</div>`

    if (resendKey) {
      await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${resendKey}` },
        body: JSON.stringify({ from: 'VitalOS Appointments <appointments@vitalos.in>', to: [patientEmail], subject, html }),
      })
    }

    return new Response(JSON.stringify({ success: true, sent_to: patientEmail }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (err) {
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
