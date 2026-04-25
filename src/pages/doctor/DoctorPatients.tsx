import { useEffect, useState } from 'react'
import { useOutletContext } from 'react-router-dom'
import { supabase } from '@/lib/supabase'
import { User, Activity, TrendingUp, Calendar } from 'lucide-react'

interface DoctorProfile { id: string }
interface Patient {
  user_id: string
  full_name: string
  email: string
  phone?: string
  plan: string
  totalVisits: number
  lastVisit: string
  nextVisit?: string
  notes: string[]
}

export default function DoctorPatients() {
  const { doctor } = useOutletContext<{ doctor: DoctorProfile }>()
  const [patients, setPatients] = useState<Patient[]>([])
  const [selected, setSelected] = useState<Patient | null>(null)
  const [patientRecords, setPatientRecords] = useState<Array<{ test_name: string; value: number; unit: string; recorded_at: string }>>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')

  useEffect(() => { if (doctor) load() }, [doctor])

  async function load() {
    setLoading(true)
    // Get all appointments for this doctor with patient profiles
    const { data } = await supabase
      .from('appointments')
      .select('user_id, slot_date, slot_time, status, notes, profile:profiles(full_name,email,phone,plan)')
      .eq('doctor_id', doctor.id)
      .order('slot_date', { ascending: false })

    if (!data) { setLoading(false); return }

    // Group by patient
    const map = new Map<string, Patient>()
    const today = new Date().toISOString().split('T')[0]

    for (const appt of data as unknown as Array<{ user_id: string; slot_date: string; slot_time: string; status: string; notes: string; profile: { full_name: string; email: string; phone?: string; plan: string } }>) {
      const existing = map.get(appt.user_id)
      if (existing) {
        existing.totalVisits++
        if (appt.slot_date < existing.lastVisit) existing.lastVisit = appt.slot_date
        if (appt.slot_date >= today && appt.status === 'scheduled') existing.nextVisit = appt.slot_date + ' ' + appt.slot_time
        if (appt.notes) existing.notes.push(appt.notes)
      } else {
        map.set(appt.user_id, {
          user_id: appt.user_id,
          full_name: appt.profile?.full_name || 'Unknown',
          email: appt.profile?.email || '',
          phone: appt.profile?.phone,
          plan: appt.profile?.plan || 'basic',
          totalVisits: 1,
          lastVisit: appt.slot_date,
          nextVisit: appt.slot_date >= today && appt.status === 'scheduled' ? appt.slot_date + ' ' + appt.slot_time : undefined,
          notes: appt.notes ? [appt.notes] : [],
        })
      }
    }
    setPatients(Array.from(map.values()))
    setLoading(false)
  }

  async function loadPatientHealth(userId: string) {
    const { data } = await supabase
      .from('health_records')
      .select('test_name, value, unit, recorded_at')
      .eq('user_id', userId)
      .order('recorded_at', { ascending: false })
      .limit(20)
    setPatientRecords((data || []) as Array<{ test_name: string; value: number; unit: string; recorded_at: string }>)
  }

  const filtered = patients.filter(p =>
    !search || p.full_name.toLowerCase().includes(search.toLowerCase()) ||
    p.email.toLowerCase().includes(search.toLowerCase())
  )

  const planBadge: Record<string, string> = {
    basic:   'bg-gray-700 text-gray-300',
    pro:     'bg-blue-900 text-blue-300',
    premium: 'bg-amber-900 text-amber-300',
  }

  return (
    <div className="p-6 space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-white">My patients</h1>
          <p className="text-sm text-gray-400">{patients.length} unique patients</p>
        </div>
        <input
          className="bg-gray-800 border border-gray-700 text-white text-sm rounded-lg px-3 py-2 w-48 focus:outline-none focus:border-teal-500"
          placeholder="Search patients..."
          value={search} onChange={e => setSearch(e.target.value)}
        />
      </div>

      <div className="grid grid-cols-5 gap-5">
        {/* Patient list */}
        <div className="col-span-2 space-y-2">
          {loading ? (
            <div className="space-y-2">
              {[1,2,3].map(i => <div key={i} className="bg-gray-900 rounded-xl h-16 animate-pulse" />)}
            </div>
          ) : filtered.length === 0 ? (
            <div className="bg-gray-900 border border-gray-800 rounded-xl p-8 text-center">
              <User size={28} className="text-gray-700 mx-auto mb-2" />
              <p className="text-gray-500 text-sm">No patients yet</p>
            </div>
          ) : (
            filtered.map(p => (
              <button key={p.user_id} onClick={() => { setSelected(p); loadPatientHealth(p.user_id) }}
                className={`w-full text-left bg-gray-900 border rounded-xl p-3 transition-colors ${selected?.user_id===p.user_id ? 'border-teal-600 bg-teal-900/10' : 'border-gray-800 hover:border-gray-600'}`}>
                <div className="flex items-center gap-2.5">
                  <div className="w-9 h-9 rounded-full bg-teal-800 flex items-center justify-center text-teal-300 text-xs font-bold shrink-0">
                    {p.full_name.slice(0,2).toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-medium text-white truncate">{p.full_name}</p>
                      <span className={`text-[9px] px-1.5 py-0.5 rounded capitalize shrink-0 ${planBadge[p.plan]||planBadge.basic}`}>{p.plan}</span>
                    </div>
                    <p className="text-[10px] text-gray-400 truncate">{p.email}</p>
                    <div className="flex items-center gap-3 mt-0.5">
                      <span className="text-[10px] text-gray-500">{p.totalVisits} visit{p.totalVisits!==1?'s':''}</span>
                      {p.nextVisit && <span className="text-[10px] text-teal-500">Next: {p.nextVisit.split(' ')[0]}</span>}
                    </div>
                  </div>
                </div>
              </button>
            ))
          )}
        </div>

        {/* Patient detail */}
        <div className="col-span-3 bg-gray-900 border border-gray-800 rounded-xl p-5">
          {!selected ? (
            <div className="flex flex-col items-center justify-center h-full text-gray-600 py-16">
              <User size={36} className="mb-3 opacity-30" />
              <p className="text-sm">Select a patient to view details</p>
            </div>
          ) : (
            <div className="space-y-4">
              {/* Header */}
              <div className="flex items-start gap-3 pb-4 border-b border-gray-800">
                <div className="w-14 h-14 rounded-full bg-teal-800 flex items-center justify-center text-teal-300 text-xl font-bold">
                  {selected.full_name.slice(0,2).toUpperCase()}
                </div>
                <div>
                  <h2 className="text-base font-semibold text-white">{selected.full_name}</h2>
                  <p className="text-xs text-gray-400">{selected.email}</p>
                  {selected.phone && <p className="text-xs text-gray-500">📱 {selected.phone}</p>}
                  <div className="flex items-center gap-3 mt-1">
                    <span className={`text-[10px] px-2 py-0.5 rounded font-medium capitalize ${planBadge[selected.plan]||planBadge.basic}`}>{selected.plan} plan</span>
                    <span className="text-[10px] text-gray-500">{selected.totalVisits} consultation{selected.totalVisits!==1?'s':''}</span>
                  </div>
                </div>
              </div>

              {/* Visit notes */}
              {selected.notes.length > 0 && (
                <div>
                  <h3 className="text-xs font-semibold text-gray-400 mb-2 flex items-center gap-1.5">
                    <Calendar size={12} /> Consultation notes
                  </h3>
                  <div className="space-y-1.5 max-h-24 overflow-y-auto">
                    {selected.notes.map((note, i) => (
                      <p key={i} className="text-xs text-gray-300 bg-gray-800 rounded-lg px-3 py-2 italic">"{note}"</p>
                    ))}
                  </div>
                </div>
              )}

              {/* Health records */}
              <div>
                <h3 className="text-xs font-semibold text-gray-400 mb-2 flex items-center gap-1.5">
                  <Activity size={12} /> Recent lab values
                  <span className="text-[10px] text-gray-600 font-normal">(from uploaded reports)</span>
                </h3>
                {patientRecords.length === 0 ? (
                  <p className="text-xs text-gray-600 py-3">No lab records uploaded by this patient yet</p>
                ) : (
                  <div className="grid grid-cols-2 gap-2 max-h-48 overflow-y-auto">
                    {patientRecords.map((r, i) => (
                      <div key={i} className="bg-gray-800 rounded-lg p-2.5">
                        <p className="text-[10px] text-gray-400 truncate">{r.test_name}</p>
                        <div className="flex items-baseline gap-1">
                          <span className="text-sm font-bold text-white">{r.value}</span>
                          <span className="text-[10px] text-gray-500">{r.unit}</span>
                        </div>
                        <p className="text-[9px] text-gray-600">{new Date(r.recorded_at).toLocaleDateString('en-IN')}</p>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Next appointment */}
              {selected.nextVisit && (
                <div className="bg-teal-900/20 border border-teal-800 rounded-xl p-3">
                  <p className="text-xs font-semibold text-teal-400 flex items-center gap-1.5">
                    <TrendingUp size={12} /> Next appointment
                  </p>
                  <p className="text-sm text-white mt-0.5">
                    {new Date(selected.nextVisit.split(' ')[0]+'T00:00:00').toLocaleDateString('en-IN',{weekday:'long',day:'numeric',month:'long'})} at {selected.nextVisit.split(' ')[1]?.slice(0,5)}
                  </p>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
