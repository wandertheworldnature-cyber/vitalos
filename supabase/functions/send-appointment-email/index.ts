const corsHeaders={
  'Access-Control-Allow-Origin':'*',
  'Access-Control-Allow-Headers':'authorization, x-client-info, apikey, content-type',
}
Deno.serve(async(req)=>{
  if(req.method==='OPTIONS')return new Response('ok',{headers:corsHeaders})
  try{
    const{appointmentId,type}=await req.json()
    const url=Deno.env.get('SUPABASE_URL')!
    const key=Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const resend=Deno.env.get('RESEND_API_KEY')
    const admin=Deno.env.get('ADMIN_EMAIL')||'appireddy.vidusolutions@gmail.com'
    const res=await fetch(`${url}/rest/v1/appointments?id=eq.${appointmentId}&select=*,doctor:doctors(name,specialty,hospital,doctor_email,notify_by_email),profile:profiles(full_name,email)`,
      {headers:{apikey:key,Authorization:`Bearer ${key}`}})
    const[appt]=await res.json()
    if(!appt)throw new Error('not found')
    const pat=appt.profile?.full_name||appt.profile?.email||'Patient'
    const doc=appt.doctor?.name||'Doctor'
    const spec=appt.doctor?.specialty||''
    const hosp=appt.doctor?.hospital||''
    const date=new Date(appt.slot_date).toLocaleDateString('en-IN',{weekday:'long',day:'numeric',month:'long',year:'numeric'})
    const time=(appt.slot_time||'').slice(0,5)
    const link=appt.meeting_link||''
    const ok=type!=='cancelled'
    const subj=ok?`Appointment confirmed — ${doc} on ${date}`:`Appointment cancelled — ${doc}`
    const subjDoc=ok?`New booking: ${pat} — ${date} at ${time}`:`Cancellation: ${pat} — ${date}`
    const subjAdmin=`[VitalOS] ${ok?'Booked':'Cancelled'}: ${pat} ↔ ${doc}`
    const body=(role:'patient'|'doctor'|'admin')=>`<!DOCTYPE html><html><body style="font-family:Inter,Arial,sans-serif;background:#f0fdf8;padding:20px;">
<div style="max-width:560px;margin:0 auto;">
<div style="background:linear-gradient(135deg,#0f6e56,#1d9e75);padding:24px;border-radius:12px 12px 0 0;">
<h2 style="color:white;margin:0;">VitalOS</h2>
<p style="color:#86efcb;margin:4px 0 0;font-size:13px;">Your health operating system</p>
</div>
<div style="background:white;border:1px solid #d1fae5;border-top:none;padding:28px;border-radius:0 0 12px 12px;">
<h3 style="margin-top:0;">${ok?'✅ Appointment Confirmed':'❌ Appointment Cancelled'}</h3>
<p>${role==='patient'?`Hi ${pat}, your consultation has been ${ok?'confirmed':'cancelled'}.`:role==='doctor'?`Hi ${doc}, you have a ${ok?'new booking':'cancellation'} on VitalOS.`:`[ADMIN] ${ok?'New booking':'Cancellation'}: ${pat} ↔ ${doc}`}</p>
<div style="background:${ok?'#f0fdf4':'#fef2f2'};border:1px solid ${ok?'#a7f3d0':'#fecaca'};border-radius:10px;padding:16px;margin:16px 0;">
<table style="width:100%;font-size:14px;border-collapse:collapse;">
<tr><td style="color:#6b7280;padding:5px 0;font-weight:600;width:120px;">Doctor</td><td style="font-weight:700;">${doc}</td></tr>
<tr><td style="color:#6b7280;padding:5px 0;font-weight:600;">Specialty</td><td>${spec}</td></tr>
${hosp?`<tr><td style="color:#6b7280;padding:5px 0;font-weight:600;">Hospital</td><td>${hosp}</td></tr>`:''}
<tr><td style="color:#6b7280;padding:5px 0;font-weight:600;">Patient</td><td style="font-weight:600;">${pat}</td></tr>
<tr><td style="color:#6b7280;padding:5px 0;font-weight:600;">Date</td><td style="font-weight:700;color:#0f6e56;">${date}</td></tr>
<tr><td style="color:#6b7280;padding:5px 0;font-weight:600;">Time</td><td style="font-weight:700;color:#0f6e56;">${time}</td></tr>
<tr><td style="color:#6b7280;padding:5px 0;font-weight:600;">Mode</td><td>📹 Video consultation</td></tr>
</table>
</div>
${ok&&link?`<div style="text-align:center;margin:20px 0;"><a href="${link}" style="background:linear-gradient(135deg,#0f6e56,#1d9e75);color:white;padding:14px 32px;border-radius:10px;text-decoration:none;font-weight:700;font-size:15px;">🎥 Join Video Call</a><p style="color:#9ca3af;font-size:12px;margin-top:8px;">Link: ${link}</p></div>`:''}
<p style="color:#9ca3af;font-size:11px;margin-top:24px;border-top:1px solid #f3f4f6;padding-top:16px;">Sent by VitalOS on behalf of ${doc}. The consultation is conducted by ${doc}.<br/>Support: support@vitalos.in</p>
</div></div></body></html>`
    async function mail(to:string,s:string,h:string){
      if(!resend){console.log('No RESEND_API_KEY, skip:',to);return}
      const r=await fetch('https://api.resend.com/emails',{
        method:'POST',
        headers:{'Content-Type':'application/json',Authorization:`Bearer ${resend}`},
        body:JSON.stringify({from:'VitalOS <onboarding@resend.dev>',to:[to],subject:s,html:h})
      })
      const d=await r.json()
      console.log(to,r.ok?'sent':'failed',JSON.stringify(d).slice(0,100))
    }
    await Promise.allSettled([
      appt.profile?.email?mail(appt.profile.email,subj,body('patient')):null,
      appt.doctor?.doctor_email&&appt.doctor?.notify_by_email!==false?mail(appt.doctor.doctor_email,subjDoc,body('doctor')):null,
      mail(admin,subjAdmin,body('admin')),
    ])
    return new Response(JSON.stringify({ok:true,patient:appt.profile?.email,doctor:appt.doctor?.doctor_email,admin}),
      {headers:{...corsHeaders,'Content-Type':'application/json'}})
  }catch(e){
    console.error(e)
    return new Response(JSON.stringify({error:String(e)}),{status:500,headers:{...corsHeaders,'Content-Type':'application/json'}})
  }
})
