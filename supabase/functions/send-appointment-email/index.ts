// Sends emails to: Patient + Doctor (private) + Admin
// Free email via Resend (resend.com — 3,000/month free)
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
    const resendKey = Deno.env.get('RESEND_API_KEY')
    const adminEmail = Deno.env.get('ADMIN_EMAIL') || 'appireddy.vidusolutions@gmail.com'

    // Fetch appointment with doctor private fields
    const res = await fetch(
      `${supabaseUrl}/rest/v1/appointments?id=eq.${appointmentId}&select=*,doctor:doctors(name,specialty,qualifications,hospital,doctor_email,doctor_phone,notify_by_email,notify_by_whatsapp),profile:profiles(full_name,email,phone)`,
      { headers: { apikey: supabaseKey, Authorization: `Bearer ${supabaseKey}` } }
    )
    const [appt] = await res.json()
    if (!appt) throw new Error('Appointment not found')

    const patientName  = appt.profile?.full_name || appt.profile?.email
    const patientEmail = appt.profile?.email
    const doctorName   = appt.doctor?.name
    const doctorEmail  = appt.doctor?.doctor_email  // private field
    const specialty    = appt.doctor?.specialty
    const hospital     = appt.doctor?.hospital
    const dateStr = new Date(appt.slot_date).toLocaleDateString('en-IN', { weekday:'long',day:'numeric',month:'long',year:'numeric' })
    const time    = appt.slot_time?.slice(0, 5)
    const meetLink = appt.meeting_link
    const isConfirmed = type !== 'cancelled'

    function buildHtml(recipient: 'patient'|'doctor'|'admin') {
      const intro = recipient === 'patient'
        ? `Hi ${patientName}, your consultation has been ${isConfirmed ? 'confirmed' : 'cancelled'}.`
        : recipient === 'doctor'
        ? `Hi ${doctorName}, you have a new ${isConfirmed ? 'appointment booking' : 'appointment cancellation'} on VitalOS.`
        : `[ADMIN COPY] Appointment ${isConfirmed ? 'booked' : 'cancelled'} — ${patientName} with ${doctorName}`

      return `<div style="font-family:Inter,Arial,sans-serif;max-width:560px;margin:0 auto;">
  <div style="background:linear-gradient(135deg,#0f6e56,#1d9e75);padding:20px 28px;border-radius:12px 12px 0 0;">
    <h2 style="color:white;margin:0;font-size:20px;">VitalOS</h2>
    <p style="color:#86efcb;margin:4px 0 0;font-size:13px;">Your health operating system</p>
  </div>
  <div style="background:#fff;border:1px solid #e5e7eb;border-top:none;padding:28px;border-radius:0 0 12px 12px;">
    <h3 style="color:#1a1a1a;margin-top:0;">${isConfirmed ? '✅ Appointment Confirmed' : '❌ Appointment Cancelled'}</h3>
    <p style="color:#4b5563;font-size:14px;">${intro}</p>
    <div style="background:${isConfirmed?'#f0fdf4':'#fef2f2'};border:1px solid ${isConfirmed?'#bbf7d0':'#fecaca'};border-radius:10px;padding:16px;margin:16px 0;">
      <table style="width:100%;font-size:14px;border-collapse:collapse;">
        <tr><td style="color:#6b7280;padding:5px 0;width:130px;font-weight:500;">Doctor</td><td style="color:#1a1a1a;font-weight:600;">${doctorName}</td></tr>
        <tr><td style="color:#6b7280;padding:5px 0;">Specialty</td><td>${specialty}</td></tr>
        ${hospital ? `<tr><td style="color:#6b7280;padding:5px 0;">Hospital</td><td>${hospital}</td></tr>` : ''}
        <tr><td style="color:#6b7280;padding:5px 0;">Patient</td><td style="font-weight:500;">${patientName}</td></tr>
        <tr><td style="color:#6b7280;padding:5px 0;">Date</td><td style="font-weight:600;color:#0f6e56;">${dateStr}</td></tr>
        <tr><td style="color:#6b7280;padding:5px 0;">Time</td><td style="font-weight:600;color:#0f6e56;">${time}</td></tr>
        <tr><td style="color:#6b7280;padding:5px 0;">Mode</td><td>Video consultation</td></tr>
      </table>
    </div>
    ${isConfirmed && meetLink ? `
    <div style="text-align:center;margin:20px 0;">
      <a href="${meetLink}" style="display:inline-block;background:linear-gradient(135deg,#0f6e56,#1d9e75);color:white;padding:14px 32px;border-radius:10px;text-decoration:none;font-weight:700;font-size:15px;">
        🎥 Join Video Call
      </a>
      <p style="color:#9ca3af;font-size:12px;margin-top:8px;">Link: ${meetLink}</p>
    </div>
    <div style="background:#fefce8;border:1px solid #fde68a;border-radius:8px;padding:12px;margin-top:16px;">
      <p style="color:#92400e;font-size:13px;margin:0;"><strong>Before joining:</strong> Keep your recent lab reports and list of symptoms ready for the consultation.</p>
    </div>` : ''}
    <p style="color:#9ca3af;font-size:12px;margin-top:24px;border-top:1px solid #f3f4f6;padding-top:16px;">
      This email is sent by <strong>VitalOS</strong> (vitalos.in) on behalf of ${doctorName}.<br/>
      The consultation is conducted by ${doctorName}. VitalOS is the platform facilitating this booking.<br/>
      For support: support@vitalos.in
    </p>
  </div>
</div>`
    }

    async function sendEmail(to: string, subject: string, html: string) {
      if (!resendKey) { console.log('No RESEND_API_KEY — email not sent to:', to); return }
      const r = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${resendKey}` },
        body: JSON.stringify({ from: 'VitalOS <appointments@vitalos.in>', to: [to], subject, html }),
      })
      const d = await r.json()
      if (!r.ok) console.error('Resend error:', d)
      else console.log('Email sent to:', to)
    }

    const subjectPatient = isConfirmed ? `Appointment confirmed — ${doctorName} on ${dateStr}` : `Appointment cancelled — ${doctorName}`
    const subjectDoctor  = isConfirmed ? `New booking: ${patientName} on ${dateStr} at ${time}` : `Cancellation: ${patientName} on ${dateStr}`
    const subjectAdmin   = `[VitalOS] ${isConfirmed?'New':'Cancelled'} appointment: ${patientName} ↔ ${doctorName}`

    // Send to all 3 recipients in parallel
    await Promise.all([
      patientEmail ? sendEmail(patientEmail, subjectPatient, buildHtml('patient')) : null,
      doctorEmail && appt.doctor?.notify_by_email ? sendEmail(doctorEmail, subjectDoctor, buildHtml('doctor')) : null,
      sendEmail(adminEmail, subjectAdmin, buildHtml('admin')),
    ])

    return new Response(JSON.stringify({ success: true, sentTo: { patient: patientEmail, doctor: doctorEmail || 'not set', admin: adminEmail } }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (error) {
    console.error('Email function error:', error)
    return new Response(JSON.stringify({ error: String(error) }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
