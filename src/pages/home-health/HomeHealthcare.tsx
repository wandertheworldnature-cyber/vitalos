import { useState, useEffect } from 'react'
import { useAuthStore } from '@/store/authStore'
import { supabase } from '@/lib/supabase'
import { Home, Stethoscope, FlaskConical, Heart, Activity, Clock, Check, MapPin, Star, ChevronRight } from 'lucide-react'
import toast from 'react-hot-toast'

const SERVICES = [
  { id:'1', type:'lab_test',      title:'Home Lab Test',       desc:'Blood, urine, thyroid — home collection. Reports in 24hrs.',    price:299,  duration:'30 min', rating:4.8, provider:'Thyrocare',    today:true  },
  { id:'2', type:'nurse',         title:'Home Nursing',        desc:'Certified nurses for injections, dressings, IV drip, post-op.', price:699,  duration:'1-4 hrs',rating:4.7, provider:'NurseConnect', today:true  },
  { id:'3', type:'physiotherapy', title:'Physiotherapy',       desc:'Physio for back pain, joint pain, stroke recovery.',            price:899,  duration:'45 min', rating:4.9, provider:'PhysioFirst',  today:false },
  { id:'4', type:'doctor',        title:'Home Doctor Visit',   desc:'MBBS/MD doctors visit your home. Prescription, examination.',   price:1499, duration:'30 min', rating:4.6, provider:'DocOnCall',    today:true  },
  { id:'5', type:'lab_test',      title:'Full Body Checkup',   desc:'68 tests including CBC, LFT, KFT, thyroid, diabetes, vitamins.',price:1999, duration:'30 min', rating:4.9, provider:'SRL',         today:true  },
  { id:'6', type:'physiotherapy', title:'Post-Surgery Rehab',  desc:'Rehab after knee/hip replacement, cardiac surgery, fractures.', price:1499, duration:'60 min', rating:4.9, provider:'RehabPlus',    today:false },
  { id:'7', type:'doctor',        title:'Child Specialist',    desc:'Pediatrician home visit for child illness, vaccinations.',       price:1299, duration:'30 min', rating:4.8, provider:'KidsFirst',    today:true  },
]

const ICONS: Record<string, React.ElementType> = { lab_test:FlaskConical, nurse:Heart, physiotherapy:Activity, doctor:Stethoscope }
const COLORS: Record<string, string> = { lab_test:'#8b5cf6', nurse:'#ef4444', physiotherapy:'#3b82f6', doctor:'#10b981' }
const SLOTS = ['07:00 AM','08:00 AM','09:00 AM','10:00 AM','11:00 AM','12:00 PM','02:00 PM','03:00 PM','04:00 PM','05:00 PM','06:00 PM']

export default function HomeHealthcare() {
  const { user } = useAuthStore()
  const [filter, setFilter] = useState('all')
  const [selected, setSelected] = useState<typeof SERVICES[0]|null>(null)
  const [bookings, setBookings] = useState<{title:string;date:string;time:string;price:number;status:string}[]>([])
  const [tab, setTab] = useState<'services'|'bookings'>('services')
  const [form, setForm] = useState({ date:'', time:'', address:'', notes:'' })
  const [booking, setBooking] = useState(false)

  useEffect(() => { if (user) load() }, [user])

  async function load() {
    if (!user) return
    const { data } = await supabase.from('health_records').select('test_name,value,recorded_at,metadata')
      .eq('user_id', user.id).eq('record_type','home_service').order('recorded_at',{ascending:false})
    setBookings((data||[]).map((r:Record<string,unknown>)=>({
      title: r.test_name as string, price: r.value as number,
      date: ((r.metadata as Record<string,unknown>)?.scheduled_date as string)||'',
      time: ((r.metadata as Record<string,unknown>)?.scheduled_time as string)||'',
      status: ((r.metadata as Record<string,unknown>)?.status as string)||'scheduled',
    })))
  }

  async function book() {
    if (!user||!selected) return
    if (!form.date||!form.time||!form.address) { toast.error('Fill date, time and address'); return }
    setBooking(true)
    try {
      await supabase.from('health_records').insert({
        user_id:user.id, record_type:'home_service', test_name:selected.title,
        value:selected.price, unit:'₹', source:'manual', recorded_at:new Date().toISOString(),
        metadata:{ service_type:selected.type, provider:selected.provider, scheduled_date:form.date, scheduled_time:form.time, address:form.address, notes:form.notes, status:'scheduled' }
      })
      toast.success(`✅ ${selected.title} booked!`)
      setSelected(null); setForm({date:'',time:'',address:'',notes:''}); load(); setTab('bookings')
    } finally { setBooking(false) }
  }

  const filtered = filter==='all' ? SERVICES : SERVICES.filter(s=>s.type===filter)

  return (
    <div className="p-4 pb-8 max-w-2xl mx-auto space-y-4">
      <div className="card !p-5" style={{background:'linear-gradient(135deg,#0a1628,#1a2a4a)',borderColor:'#1e40af'}}>
        <div className="flex items-start gap-3">
          <div className="w-12 h-12 rounded-xl flex items-center justify-center shrink-0" style={{background:'rgba(59,130,246,0.2)'}}>
            <Home size={24} className="text-blue-400"/>
          </div>
          <div>
            <div className="flex items-center gap-2 mb-1">
              <h1 className="text-lg font-bold text-white">Home Healthcare</h1>
              <span className="text-[10px] bg-blue-900 text-blue-300 border border-blue-700 px-2 py-0.5 rounded-full font-bold">India-first</span>
            </div>
            <p className="text-sm text-blue-300">Book lab tests, nurses, physiotherapists and doctors at your home.</p>
          </div>
        </div>
      </div>

      <div className="flex gap-1 bg-gray-100 rounded-xl p-1">
        {(['services','bookings'] as const).map(t=>(
          <button key={t} onClick={()=>setTab(t)}
            className={`flex-1 text-xs py-2 rounded-lg font-semibold capitalize ${tab===t?'bg-white shadow-sm text-gray-900':'text-gray-500'}`}>
            {t==='services'?'🏥 Services':`📋 My Bookings (${bookings.length})`}
          </button>
        ))}
      </div>

      {tab==='services' && <>
        <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
          {['all','lab_test','nurse','physiotherapy','doctor'].map(f=>(
            <button key={f} onClick={()=>setFilter(f)}
              className={`text-xs px-3 py-1.5 rounded-lg border whitespace-nowrap font-semibold flex-shrink-0 capitalize ${filter===f?'bg-gray-900 text-white border-gray-900':'border-gray-200 text-gray-500'}`}>
              {f==='all'?'All':f.replace('_',' ')}
            </button>
          ))}
        </div>
        <div className="space-y-3">
          {filtered.map(s=>{
            const Icon = ICONS[s.type]||Home
            return (
              <div key={s.id} className="card !p-4">
                <div className="flex items-start gap-3">
                  <div className="w-11 h-11 rounded-xl flex items-center justify-center shrink-0" style={{background:`${COLORS[s.type]}20`}}>
                    <Icon size={18} style={{color:COLORS[s.type]}}/>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-0.5">
                      <p className="text-sm font-bold text-gray-900">{s.title}</p>
                      {s.today&&<span className="text-[9px] bg-emerald-100 text-emerald-700 px-1.5 py-0.5 rounded font-bold">Today</span>}
                    </div>
                    <p className="text-xs text-gray-500 mb-1">{s.desc}</p>
                    <div className="flex items-center gap-3">
                      <span className="text-xs text-gray-400 flex items-center gap-1"><Clock size={10}/>{s.duration}</span>
                      <span className="text-xs text-gray-400 flex items-center gap-1"><Star size={10} className="text-amber-400 fill-amber-400"/>{s.rating}</span>
                      <span className="text-sm font-black text-teal-600 ml-auto">₹{s.price}</span>
                    </div>
                  </div>
                </div>
                <button onClick={()=>setSelected(s)}
                  className="w-full mt-3 py-2 rounded-xl text-xs font-bold text-white flex items-center justify-center gap-1"
                  style={{background:'linear-gradient(135deg,#0f6e56,#1d9e75)'}}>
                  Book at home <ChevronRight size={13}/>
                </button>
              </div>
            )
          })}
        </div>
      </>}

      {tab==='bookings' && <div className="space-y-2">
        {bookings.length===0 ? (
          <div className="card border-dashed border-2 text-center py-10">
            <Home size={28} className="text-gray-200 mx-auto mb-2"/>
            <p className="text-sm text-gray-500 mb-3">No bookings yet</p>
            <button onClick={()=>setTab('services')} className="btn-primary text-xs py-2">Browse services</button>
          </div>
        ) : bookings.map((b,i)=>(
          <div key={i} className="card !p-3.5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-bold text-gray-900">{b.title}</p>
                <p className="text-xs text-gray-400">{b.date} · {b.time}</p>
              </div>
              <div className="text-right">
                <p className="text-sm font-black text-teal-600">₹{b.price}</p>
                <span className="text-[9px] bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded font-bold">{b.status}</span>
              </div>
            </div>
          </div>
        ))}
      </div>}

      {selected && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-end justify-center p-4" onClick={e=>e.target===e.currentTarget&&setSelected(null)}>
          <div className="bg-white rounded-2xl w-full max-w-md p-5 space-y-3 max-h-[85vh] overflow-y-auto">
            <div className="flex items-center justify-between">
              <div>
                <p className="font-black text-gray-900">{selected.title}</p>
                <p className="text-sm text-teal-600 font-bold">₹{selected.price}</p>
              </div>
              <button onClick={()=>setSelected(null)} className="text-gray-400 text-xl">✕</button>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div><label className="text-xs text-gray-500 mb-1 block">Date</label>
                <input type="date" className="input text-sm" min={new Date().toISOString().split('T')[0]} value={form.date} onChange={e=>setForm(p=>({...p,date:e.target.value}))}/></div>
              <div><label className="text-xs text-gray-500 mb-1 block">Time</label>
                <select className="input text-sm" value={form.time} onChange={e=>setForm(p=>({...p,time:e.target.value}))}>
                  <option value="">Select</option>
                  {SLOTS.map(t=><option key={t} value={t}>{t}</option>)}
                </select></div>
            </div>
            <div><label className="text-xs text-gray-500 mb-1 block">Address</label>
              <textarea className="input text-sm h-16 resize-none" placeholder="Full address with landmark..." value={form.address} onChange={e=>setForm(p=>({...p,address:e.target.value}))}/></div>
            <div><label className="text-xs text-gray-500 mb-1 block">Notes (optional)</label>
              <input className="input text-sm" placeholder="Any special requirements..." value={form.notes} onChange={e=>setForm(p=>({...p,notes:e.target.value}))}/></div>
            <button onClick={book} disabled={booking} className="w-full py-3 rounded-xl font-bold text-white flex items-center justify-center gap-2" style={{background:'linear-gradient(135deg,#0f6e56,#1d9e75)'}}>
              <Check size={15}/>{booking?'Booking...':'Confirm booking'}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

