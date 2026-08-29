import { useState, useEffect } from 'react'
import { useAuthStore } from '@/store/authStore'
import { supabase } from '@/lib/supabase'
import { Wifi, Activity, Heart, Zap, Plus, Check, RefreshCw, TrendingUp, AlertTriangle } from 'lucide-react'
import toast from 'react-hot-toast'

interface IoTDevice {
  id: string; name: string; type: string; icon: string
  brand: string; connected: boolean; lastReading: string; lastValue: string; color: string
}

interface IoTReading { metric: string; value: number; unit: string; device: string; timestamp: string }

const DEVICES: IoTDevice[] = [
  { id:'bp',      name:'BP Monitor',        type:'blood_pressure', icon:'🩺', brand:'Omron / Dr. Morepen', connected:false, lastReading:'--',   lastValue:'-- mmHg',   color:'#ef4444' },
  { id:'glucose', name:'Glucose Monitor',   type:'glucose',        icon:'🩸', brand:'Accu-Check / OneTouch',connected:false, lastReading:'--',   lastValue:'-- mg/dL',  color:'#f59e0b' },
  { id:'scale',   name:'Smart Scale',       type:'weight',         icon:'⚖️', brand:'Fitbit / Xiaomi',     connected:false, lastReading:'--',   lastValue:'-- kg',     color:'#3b82f6' },
  { id:'ecg',     name:'ECG Device',        type:'ecg',            icon:'💓', brand:'AliveCor / Wellue',   connected:false, lastReading:'--',   lastValue:'-- bpm',    color:'#8b5cf6' },
  { id:'oximeter',name:'Pulse Oximeter',    type:'spo2',           icon:'🫁', brand:'Dr. Trust / Contec',  connected:false, lastReading:'--',   lastValue:'-- %',      color:'#06b6d4' },
  { id:'thermo',  name:'Smart Thermometer', type:'temperature',    icon:'🌡️', brand:'iHealth / Braun',     connected:false, lastReading:'--',   lastValue:'-- °F',     color:'#10b981' },
]

const MANUAL_METRICS = [
  { key:'systolic',    label:'Systolic BP',   unit:'mmHg', min:60,  max:200, icon:'🩺', ref:'90-120' },
  { key:'diastolic',   label:'Diastolic BP',  unit:'mmHg', min:40,  max:130, icon:'🩺', ref:'60-80'  },
  { key:'glucose_pp',  label:'Post-meal Glucose',unit:'mg/dL',min:70,max:300, icon:'🩸', ref:'<140'  },
  { key:'glucose_fast',label:'Fasting Glucose',  unit:'mg/dL',min:60,max:200, icon:'🩸', ref:'70-99' },
  { key:'spo2',        label:'SpO2',          unit:'%',    min:90,  max:100, icon:'🫁', ref:'95-100' },
  { key:'temp',        label:'Temperature',   unit:'°F',   min:95,  max:105, icon:'🌡️', ref:'97-99'  },
  { key:'weight',      label:'Body Weight',   unit:'kg',   min:30,  max:200, icon:'⚖️', ref:'BMI<25' },
  { key:'heart_rate',  label:'Heart Rate',    unit:'bpm',  min:40,  max:200, icon:'💓', ref:'60-100' },
]

export default function IoTIntegration() {
  const { user } = useAuthStore()
  const [devices, setDevices] = useState<IoTDevice[]>(DEVICES)
  const [readings, setReadings] = useState<IoTReading[]>([])
  const [tab, setTab] = useState<'devices'|'manual'|'history'>('devices')
  const [manualForm, setManualForm] = useState<Record<string,string>>({})
  const [saving, setSaving] = useState(false)
  const [connecting, setConnecting] = useState<string|null>(null)

  useEffect(() => { if (user) loadReadings() }, [user])

  async function loadReadings() {
    if (!user) return
    const { data } = await supabase.from('health_records')
      .select('test_name,value,unit,recorded_at,metadata')
      .eq('user_id', user.id).eq('source', 'iot')
      .order('recorded_at', { ascending: false }).limit(30)
    setReadings((data||[]).map((r:Record<string,unknown>)=>({
      metric: r.test_name as string, value: r.value as number,
      unit: r.unit as string,
      device: ((r.metadata as Record<string,unknown>)?.device as string)||'Manual',
      timestamp: r.recorded_at as string,
    })))
  }

  async function connectDevice(device: IoTDevice) {
    setConnecting(device.id)
    await new Promise(r=>setTimeout(r,1500))
    setDevices(prev=>prev.map(d=>d.id===device.id?{...d,connected:true,lastReading:'Just now',lastValue:'Reading...'}:d))
    toast.success(`${device.name} connected! Manual entry available.`)
    setConnecting(null)
    setTab('manual')
  }

  async function saveManualReadings() {
    if (!user) return
    const entries = Object.entries(manualForm).filter(([,v])=>v!=='')
    if (entries.length===0) { toast.error('Enter at least one reading'); return }
    setSaving(true)
    try {
      const metric = MANUAL_METRICS.find(m=>m.key===entries[0][0])
      const records = entries.map(([key,val])=>{
        const m = MANUAL_METRICS.find(x=>x.key===key)!
        return {
          user_id: user.id, record_type:'vitals', test_name:m.label,
          value:parseFloat(val), unit:m.unit, source:'iot',
          recorded_at: new Date().toISOString(),
          metadata:{ device:'Manual/IoT', metric_key:key }
        }
      })
      await supabase.from('health_records').insert(records)
      toast.success(`✅ ${records.length} readings saved!`)
      setManualForm({})
      loadReadings(); setTab('history')
    } finally { setSaving(false) }
  }

  return (
    <div className="p-4 pb-8 max-w-2xl mx-auto space-y-4">
      <div className="card !p-5" style={{ background:'linear-gradient(135deg,#0c1a2e,#0a2a1e)', borderColor:'#065f46' }}>
        <div className="flex items-start gap-3">
          <div className="w-12 h-12 rounded-xl flex items-center justify-center shrink-0" style={{ background:'rgba(16,185,129,0.2)' }}>
            <Wifi size={24} className="text-emerald-400"/>
          </div>
          <div>
            <div className="flex items-center gap-2 mb-1">
              <h1 className="text-lg font-bold text-white">IoT Health Devices</h1>
              <span className="text-[10px] bg-emerald-900 text-emerald-300 border border-emerald-700 px-2 py-0.5 rounded-full font-bold">Smart Home Health</span>
            </div>
            <p className="text-sm text-emerald-300">Connect BP machines, glucose monitors, smart scales, ECG devices for continuous health data stream.</p>
          </div>
        </div>
        <div className="mt-4 grid grid-cols-3 gap-2">
          {[['Devices','6'],['Connected',devices.filter(d=>d.connected).length.toString()],['Readings today',readings.filter(r=>r.timestamp.startsWith(new Date().toISOString().split('T')[0])).length.toString()]].map(([l,v])=>(
            <div key={l} className="bg-white/10 rounded-lg p-2 text-center">
              <div className="text-lg font-black text-white">{v}</div>
              <div className="text-[9px] text-emerald-300">{l}</div>
            </div>
          ))}
        </div>
      </div>

      <div className="flex gap-1 bg-gray-100 rounded-xl p-1">
        {(['devices','manual','history'] as const).map(t=>(
          <button key={t} onClick={()=>setTab(t)}
            className={`flex-1 text-xs py-2 rounded-lg font-semibold transition-all ${tab===t?'bg-white shadow-sm text-gray-900':'text-gray-500'}`}>
            {t==='devices'?'📡 Devices':t==='manual'?'✏️ Log reading':'📊 History'}
          </button>
        ))}
      </div>

      {tab==='devices' && (
        <div className="space-y-3">
          <div className="card !p-4 bg-blue-50 border-blue-100">
            <p className="text-xs font-bold text-blue-700 mb-1">📱 How IoT integration works</p>
            <p className="text-xs text-blue-600 leading-relaxed">Most home devices don't have direct API access. Connect your device, read the measurement, then log it here manually. VitalOS tracks trends and alerts you to abnormal readings automatically.</p>
          </div>
          {devices.map(d=>(
            <div key={d.id} className="card !p-4">
              <div className="flex items-center gap-3">
                <span className="text-2xl shrink-0">{d.icon}</span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-bold text-gray-900">{d.name}</p>
                    {d.connected && <span className="text-[9px] bg-emerald-100 text-emerald-700 px-1.5 py-0.5 rounded font-bold">✓ Ready</span>}
                  </div>
                  <p className="text-xs text-gray-400">{d.brand}</p>
                  {d.connected && <p className="text-xs text-gray-500 mt-0.5">Last: {d.lastReading} · {d.lastValue}</p>}
                </div>
                <button
                  onClick={()=>d.connected?setTab('manual'):connectDevice(d)}
                  disabled={connecting===d.id}
                  className={`text-xs font-bold px-3 py-1.5 rounded-lg shrink-0 flex items-center gap-1 ${d.connected?'bg-emerald-100 text-emerald-700':'btn-primary'}`}>
                  {connecting===d.id?<><RefreshCw size={11} className="animate-spin"/>Connecting...</>:d.connected?<><Check size={11}/>Log reading</>:<><Plus size={11}/>Connect</>}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {tab==='manual' && (
        <div className="card !p-4 space-y-4">
          <p className="text-sm font-bold text-gray-800">Log device readings</p>
          <div className="grid grid-cols-2 gap-3">
            {MANUAL_METRICS.map(m=>(
              <div key={m.key}>
                <label className="text-xs text-gray-500 mb-1 block">{m.icon} {m.label} <span className="text-gray-300">({m.ref})</span></label>
                <div className="flex items-center gap-1">
                  <input type="number" className="input text-sm flex-1" placeholder={`0 ${m.unit}`}
                    value={manualForm[m.key]||''} onChange={e=>setManualForm(p=>({...p,[m.key]:e.target.value}))}/>
                  <span className="text-[10px] text-gray-400 shrink-0">{m.unit}</span>
                </div>
              </div>
            ))}
          </div>
          <button onClick={saveManualReadings} disabled={saving} className="btn-primary w-full py-3 flex items-center justify-center gap-2">
            <Check size={15}/>{saving?'Saving...':'Save readings'}
          </button>
        </div>
      )}

      {tab==='history' && (
        <div className="space-y-2">
          {readings.length===0 ? (
            <div className="card border-dashed border-2 text-center py-10">
              <Activity size={28} className="text-gray-200 mx-auto mb-2"/>
              <p className="text-sm text-gray-500 mb-3">No IoT readings yet</p>
              <button onClick={()=>setTab('manual')} className="btn-primary text-xs py-2">Log first reading</button>
            </div>
          ) : readings.map((r,i)=>(
            <div key={i} className="card !p-3.5">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-bold text-gray-900">{r.metric}</p>
                  <p className="text-xs text-gray-400">{r.device} · {new Date(r.timestamp).toLocaleString('en-IN')}</p>
                </div>
                <div className="text-right">
                  <p className="text-lg font-black text-teal-600">{r.value}</p>
                  <p className="text-[10px] text-gray-400">{r.unit}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

