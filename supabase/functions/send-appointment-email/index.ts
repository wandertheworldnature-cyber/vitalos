import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY') || ''
const SUPABASE_URL = Deno.env.get('SUPABASE_URL') || ''
const SUPABASE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || ''

serve(async (req) => {
  const cors = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  }
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })

  try {
    const { appointmentId, type = 'confirmed' } = await req.json()
    const db = createClient(SUPABASE_URL, SUPABASE_KEY)

    // Fetch appointment with doctor and patient info
    const { data: appt, error } = await db
      .from('appointments')
      .select(`
        id, slot_date, slot_time, notes, meeting_link, status,
        doctor:doctors(name, specialty, hospital, doctor_email),
        patient:profiles!appointments_user_id_fkey(full_name, email)
      `)
      .eq('id', appointmentId)
      .single()

    if (error || !appt) {
      console.error('Appointment fetch error:', error)
      return new Response(JSON.stringify({ error: 'Appointment not found', details: error }), {
        status: 404, headers: { ...cors, 'Content-Type': 'application/json' }
      })
    }

    const doctor  = appt.doctor  as { name:string; specialty:string; hospital?:string; doctor_email?:string }
    const patient = appt.patient as { full_name:string; email:string }

    // Generate consultation URL
    const roomId = appt.meeting_link?.split('VitalOS-')[1] || appointmentId.slice(0,7)
    const clean  = roomId.replace(/[^a-zA-Z0-9]/g,'').toLowerCase()
    const jitsiUrl = `https://meet.jit.si/vitalos${clean}`
    const consultUrl = `https://vitalos-six.vercel.app/consultation/${roomId}`

    const dateStr = new Date(appt.slot_date + 'T00:00:00').toLocaleDateString('en-IN', {
      weekday:'long', day:'numeric', month:'long', year:'numeric'
    })
    const isConfirmed = type === 'confirmed'

    // ─── Build email HTML ─────────────────────────────────────────
    const buildHTML = (recipientName: string, isDoctor: boolean) => `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/></head>
<body style="margin:0;padding:0;background:#f0fdf8;font-family:'Helvetica Neue',Arial,sans-serif;">
<div style="max-width:560px;margin:32px auto;background:#fff;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.08);">

  <div style="background:linear-gradient(135deg,#0f6e56,#1d9e75);padding:28px 32px;text-align:center;">
    <div style="font-size:22px;font-weight:800;color:#fff;letter-spacing:-0.5px;">❤️ VitalOS</div>
    <div style="color:rgba(255,255,255,0.7);font-size:12px;margin-top:4px;letter-spacing:1px;text-transform:uppercase;">Your Health Operating System</div>
  </div>

  <div style="padding:32px;">
    <h1 style="font-size:21px;font-weight:800;color:#0f2a1e;margin:0 0 8px;">
      ${isConfirmed ? '✅ Consultation Confirmed' : '❌ Appointment Cancelled'}
    </h1>
    <p style="color:#6b7280;font-size:15px;margin:0 0 24px;">
      Hi ${recipientName}, ${isConfirmed
        ? isDoctor
          ? 'you have a new patient appointment.'
          : 'your appointment has been booked successfully.'
        : 'this appointment has been cancelled.'}
    </p>

    <div style="background:#f0fdf8;border:1px solid #a7f3d0;border-radius:12px;padding:20px;margin-bottom:24px;">
      <table style="width:100%;border-collapse:collapse;">
        <tr><td style="padding:8px 0;border-bottom:1px solid #d1fae5;color:#6b7280;font-size:13px;width:100px;">Doctor</td>
            <td style="padding:8px 0;border-bottom:1px solid #d1fae5;font-weight:700;color:#0f2a1e;font-size:14px;">Dr. ${doctor.name}</td></tr>
        <tr><td style="padding:8px 0;border-bottom:1px solid #d1fae5;color:#6b7280;font-size:13px;">Specialty</td>
            <td style="padding:8px 0;border-bottom:1px solid #d1fae5;color:#374151;font-size:14px;">${doctor.specialty}</td></tr>
        ${doctor.hospital ? `<tr><td style="padding:8px 0;border-bottom:1px solid #d1fae5;color:#6b7280;font-size:13px;">Hospital</td>
            <td style="padding:8px 0;border-bottom:1px solid #d1fae5;color:#374151;font-size:14px;">${doctor.hospital}</td></tr>` : ''}
        <tr><td style="padding:8px 0;border-bottom:1px solid #d1fae5;color:#6b7280;font-size:13px;">Patient</td>
            <td style="padding:8px 0;border-bottom:1px solid #d1fae5;color:#374151;font-size:14px;">${patient.full_name}</td></tr>
        <tr><td style="padding:8px 0;border-bottom:1px solid #d1fae5;color:#6b7280;font-size:13px;">Date</td>
            <td style="padding:8px 0;border-bottom:1px solid #d1fae5;font-weight:700;color:#0f6e56;font-size:14px;">${dateStr}</td></tr>
        <tr><td style="padding:8px 0;border-bottom:1px solid #d1fae5;color:#6b7280;font-size:13px;">Time</td>
            <td style="padding:8px 0;border-bottom:1px solid #d1fae5;font-weight:700;color:#0f6e56;font-size:14px;">${appt.slot_time?.slice(0,5)}</td></tr>
        <tr><td style="padding:8px 0;color:#6b7280;font-size:13px;">Mode</td>
            <td style="padding:8px 0;color:#374151;font-size:14px;">📹 Video consultation</td></tr>
      </table>
    </div>

    ${isConfirmed ? `
    <div style="text-align:center;margin-bottom:24px;">
      <p style="color:#374151;font-size:14px;margin-bottom:16px;">
        ${isDoctor ? 'To join the consultation at the scheduled time:' : 'At your appointment time, click below to join:'}
      </p>
      <a href="${consultUrl}"
         style="display:inline-block;background:linear-gradient(135deg,#0f6e56,#1d9e75);color:#fff;text-decoration:none;padding:14px 36px;border-radius:50px;font-weight:700;font-size:15px;">
        🎥 Join Video Consultation
      </a>
      <p style="color:#9ca3af;font-size:11px;margin-top:12px;">
        Direct link: <a href="${jitsiUrl}" style="color:#0f6e56;">${jitsiUrl}</a>
      </p>
    </div>

    <div style="background:#fffbeb;border:1px solid #fde68a;border-radius:10px;padding:16px;margin-bottom:20px;">
      <p style="font-weight:700;color:#92400e;font-size:13px;margin:0 0 8px;">
        ${isDoctor ? '📋 For the doctor' : '📋 Before your consultation'}
      </p>
      <ul style="margin:0;padding-left:18px;color:#78350f;font-size:13px;line-height:2;">
        ${isDoctor ? `
        <li>Patient will open the meeting first — they become host</li>
        <li>Click the link above to join their room directly</li>
        <li>No login required — just open in any browser</li>
        ` : `
        <li>Open the meeting first — you become host automatically</li>
        <li>Keep your latest lab reports handy</li>
        <li>Test your camera and microphone beforehand</li>
        <li>Find a quiet, well-lit place</li>
        `}
      </ul>
    </div>
    ` : `
    <div style="background:#fef2f2;border:1px solid #fecaca;border-radius:10px;padding:16px;margin-bottom:20px;text-align:center;">
      <p style="color:#991b1b;font-size:14px;margin:0;">This appointment has been cancelled. The slot is now available for rebooking.</p>
    </div>
    `}

    <p style="color:#9ca3af;font-size:12px;text-align:center;margin:0;">
      Questions? <a href="mailto:info@VitalOS.App" style="color:#0f6e56;">info@VitalOS.App</a>
    </p>
  </div>

  <div style="background:#f0fdf8;padding:16px 32px;text-align:center;border-top:1px solid #d1fae5;">
    <p style="color:#9ca3af;font-size:11px;margin:0;">© 2026 VitalOS · <a href="https://vitalos-six.vercel.app" style="color:#0f6e56;">vitalos-six.vercel.app</a></p>
  </div>
</div>
</body>
</html>`

    const emails = []

    // Send to patient
    if (patient?.email) {
      emails.push(fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${RESEND_API_KEY}` },
        body: JSON.stringify({
          from: 'VitalOS <info@VitalOS.App>',
          to: [patient.email],
          subject: isConfirmed
            ? `✅ Confirmed: Dr. ${doctor.name} on ${dateStr} at ${appt.slot_time?.slice(0,5)}`
            : `❌ Cancelled: Dr. ${doctor.name} appointment`,
          html: buildHTML(patient.full_name, false),
        })
      }))
    }

    // Send to doctor
    if (doctor?.doctor_email) {
      emails.push(fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${RESEND_API_KEY}` },
        body: JSON.stringify({
          from: 'VitalOS <info@VitalOS.App>',
          to: [doctor.doctor_email],
          subject: isConfirmed
            ? `📅 New patient: ${patient.full_name} on ${dateStr} at ${appt.slot_time?.slice(0,5)}`
            : `❌ Cancelled: ${patient.full_name} appointment`,
          html: buildHTML(doctor.name, true),
        })
      }))
    }

    const results = await Promise.allSettled(emails)
    const sent = results.filter(r => r.status === 'fulfilled').length

    return new Response(
      JSON.stringify({ success: true, sent, patient_email: patient?.email, doctor_email: doctor?.doctor_email }),
      { headers: { ...cors, 'Content-Type': 'application/json' } }
    )

  } catch (e) {
    console.error('Email function error:', e)
    return new Response(JSON.stringify({ error: String(e) }), {
      status: 500, headers: { ...cors, 'Content-Type': 'application/json' }
    })
  }
})
