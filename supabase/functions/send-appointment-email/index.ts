import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const RESEND_KEY = Deno.env.get('RESEND_API_KEY') || ''
const SUPA_URL   = Deno.env.get('SUPABASE_URL') || ''
const SUPA_KEY   = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || ''

serve(async (req) => {
  const cors = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  }
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })

  try {
    const body = await req.json()
    const { appointmentId, type = 'confirmed' } = body

    console.log('Processing appointment:', appointmentId, type)

    const db = createClient(SUPA_URL, SUPA_KEY)

    // Step 1: Get appointment
    const { data: appt, error: apptErr } = await db
      .from('appointments')
      .select('id, slot_date, slot_time, notes, meeting_link, user_id, doctor_id')
      .eq('id', appointmentId)
      .single()

    if (apptErr || !appt) {
      console.error('Appointment error:', apptErr)
      return new Response(JSON.stringify({ error: 'Appointment not found', details: apptErr }), {
        status: 404, headers: { ...cors, 'Content-Type': 'application/json' }
      })
    }

    // Step 2: Get doctor
    const { data: doctor } = await db
      .from('doctors')
      .select('name, specialty, hospital, doctor_email')
      .eq('id', appt.doctor_id)
      .single()

    // Step 3: Get patient profile
    const { data: patient } = await db
      .from('profiles')
      .select('full_name, email')
      .eq('id', appt.user_id)
      .single()

    console.log('Doctor:', doctor?.name, doctor?.doctor_email)
    console.log('Patient:', patient?.full_name, patient?.email)

    if (!patient?.email) {
      return new Response(JSON.stringify({ error: 'No patient email found', user_id: appt.user_id }), {
        status: 400, headers: { ...cors, 'Content-Type': 'application/json' }
      })
    }

    // Build consultation link
    const roomId = appt.meeting_link?.split('VitalOS-')[1] || ''
    const consultationLink = roomId
      ? `https://vitalos-six.vercel.app/consultation/${roomId}`
      : (appt.meeting_link || '')

    const dateStr = new Date(appt.slot_date + 'T00:00:00').toLocaleDateString('en-IN', {
      weekday: 'long', day: 'numeric', month: 'long', year: 'numeric'
    })

    const isConfirmed = type === 'confirmed'

    const buildHtml = (name: string, forDoctor: boolean) => `<!DOCTYPE html>
<html><head><meta charset="utf-8"/></head>
<body style="margin:0;padding:0;background:#f0fdf8;font-family:Arial,sans-serif;">
<div style="max-width:560px;margin:32px auto;background:#fff;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.08);">
  <div style="background:linear-gradient(135deg,#0f6e56,#1d9e75);padding:28px 32px;text-align:center;">
    <div style="font-size:22px;font-weight:800;color:#fff;">❤️ VitalOS</div>
    <div style="color:rgba(255,255,255,0.7);font-size:12px;margin-top:4px;">Your Health Operating System</div>
  </div>
  <div style="padding:32px;">
    <h1 style="font-size:20px;font-weight:800;color:#0f2a1e;margin:0 0 8px;">
      ${isConfirmed ? '✅ Consultation Confirmed' : '❌ Appointment Cancelled'}
    </h1>
    <p style="color:#6b7280;font-size:14px;margin:0 0 24px;">
      Hi ${name}, ${isConfirmed
        ? forDoctor ? 'you have a new patient consultation.' : 'your appointment is confirmed.'
        : 'this appointment has been cancelled.'}
    </p>
    <div style="background:#f0fdf8;border:1px solid #a7f3d0;border-radius:12px;padding:20px;margin-bottom:24px;">
      <table style="width:100%;border-collapse:collapse;">
        <tr><td style="padding:8px 0;border-bottom:1px solid #d1fae5;color:#6b7280;font-size:13px;width:100px;">Doctor</td>
            <td style="padding:8px 0;border-bottom:1px solid #d1fae5;font-weight:700;color:#0f2a1e;">Dr. ${doctor?.name}</td></tr>
        <tr><td style="padding:8px 0;border-bottom:1px solid #d1fae5;color:#6b7280;font-size:13px;">Specialty</td>
            <td style="padding:8px 0;border-bottom:1px solid #d1fae5;color:#374151;">${doctor?.specialty}</td></tr>
        ${doctor?.hospital ? `<tr><td style="padding:8px 0;border-bottom:1px solid #d1fae5;color:#6b7280;font-size:13px;">Hospital</td>
            <td style="padding:8px 0;border-bottom:1px solid #d1fae5;color:#374151;">${doctor.hospital}</td></tr>` : ''}
        <tr><td style="padding:8px 0;border-bottom:1px solid #d1fae5;color:#6b7280;font-size:13px;">Patient</td>
            <td style="padding:8px 0;border-bottom:1px solid #d1fae5;color:#374151;">${patient.full_name}</td></tr>
        <tr><td style="padding:8px 0;border-bottom:1px solid #d1fae5;color:#6b7280;font-size:13px;">Date</td>
            <td style="padding:8px 0;border-bottom:1px solid #d1fae5;font-weight:700;color:#0f6e56;">${dateStr}</td></tr>
        <tr><td style="padding:8px 0;border-bottom:1px solid #d1fae5;color:#6b7280;font-size:13px;">Time</td>
            <td style="padding:8px 0;border-bottom:1px solid #d1fae5;font-weight:700;color:#0f6e56;">${appt.slot_time?.slice(0,5)}</td></tr>
        <tr><td style="padding:8px 0;color:#6b7280;font-size:13px;">Mode</td>
            <td style="padding:8px 0;color:#374151;">📹 Video consultation</td></tr>
      </table>
    </div>
    ${isConfirmed && consultationLink ? `
    <div style="text-align:center;margin-bottom:24px;">
      <a href="${consultationLink}" style="display:inline-block;background:linear-gradient(135deg,#0f6e56,#1d9e75);color:#fff;text-decoration:none;padding:14px 36px;border-radius:50px;font-weight:700;font-size:15px;">
        🎥 Join Video Consultation
      </a>
      <p style="color:#9ca3af;font-size:11px;margin-top:12px;">${consultationLink}</p>
    </div>` : ''}
    <p style="color:#9ca3af;font-size:12px;text-align:center;">Questions? <a href="mailto:info@VitalOS.App" style="color:#0f6e56;">info@VitalOS.App</a></p>
  </div>
  <div style="background:#f0fdf8;padding:16px 32px;text-align:center;border-top:1px solid #d1fae5;">
    <p style="color:#9ca3af;font-size:11px;margin:0;">© 2026 VitalOS · vitalos-six.vercel.app</p>
  </div>
</div></body></html>`

    const results = []

    // Send to patient
    const patientRes = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${RESEND_KEY}` },
      body: JSON.stringify({
        from: 'VitalOS <onboarding@resend.dev>',
        to: [patient.email],
        subject: isConfirmed
          ? `✅ Confirmed: Dr. ${doctor?.name} · ${dateStr} · ${appt.slot_time?.slice(0,5)}`
          : `❌ Cancelled: Dr. ${doctor?.name} appointment`,
        html: buildHtml(patient.full_name, false),
      })
    })
    const patientResult = await patientRes.json()
    console.log('Patient email result:', JSON.stringify(patientResult))
    results.push({ to: patient.email, result: patientResult })

    // Send to doctor if they have email
    if (doctor?.doctor_email) {
      const doctorRes = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${RESEND_KEY}` },
        body: JSON.stringify({
          from: 'VitalOS <onboarding@resend.dev>',
          to: [doctor.doctor_email],
          subject: isConfirmed
            ? `📅 New patient: ${patient.full_name} · ${dateStr} · ${appt.slot_time?.slice(0,5)}`
            : `❌ Cancelled: ${patient.full_name}`,
          html: buildHtml(doctor.name, true),
        })
      })
      const doctorResult = await doctorRes.json()
      console.log('Doctor email result:', JSON.stringify(doctorResult))
      results.push({ to: doctor.doctor_email, result: doctorResult })
    }

    return new Response(JSON.stringify({ success: true, results }), {
      headers: { ...cors, 'Content-Type': 'application/json' }
    })

  } catch (e) {
    console.error('Function crashed:', e)
    return new Response(JSON.stringify({ error: String(e) }), {
      status: 500, headers: { ...cors, 'Content-Type': 'application/json' }
    })
  }
})
