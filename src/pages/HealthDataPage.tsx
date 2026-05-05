import { useEffect, useState } from 'react'
import { useAuthStore } from '@/store/authStore'
import { supabase } from '@/lib/supabase'
import { Plus, Activity, Heart, Moon, Footprints, Dumbbell, Brain, Gauge, Wind, Leaf, Check, X } from 'lucide-react'
import toast from 'react-hot-toast'

type Category = 'vitals'|'fitness'|'mental'|'gut'|'manual'

interface ManualEntry {
  test_name: string; value: string; unit: string; notes: string
}

// Wearable-like metrics (manual input for now, wearable sync in Phase 2)
const METRIC_GROUPS = [
  {
    id: 'vitals' as Category, label: 'Vitals', icon: Heart, color: '#ef4444',
    metrics: [
      { name:'Systolic BP',   unit:'mmHg', placeholder:'120', refMin:90,  refMax:120 },
      { name:'Diastolic BP',  unit:'mmHg', placeholder:'80',  refMin:60,  refMax:80  },
      { name:'Heart Rate',    unit:'bpm',  placeholder:'72',  refMin:60,  refMax:100 },
      { name:'Blood Glucose', unit:'mg/dL',placeholder:'90',  refMin:70,  refMax:99  },
      { name:'Body Weight',   unit:'kg',   placeholder:'70',  refMin:null,refMax:null },
      { name:'Body Temperature',unit:'°F', placeholder:'98.6',refMin:97,  refMax:99  },
      { name:'SpO2',          unit:'%',   placeholder:'98',   refMin:95,  refMax:100 },
    ]
  },
  {
    id: 'fitness' as Category, label: 'Fitness', icon: Dumbbell, color: '#3b82f6',
    metrics: [
      { name:'Daily Steps',       unit:'steps',   placeholder:'8000', refMin:null,refMax:null },
      { name:'Sleep Duration',    unit:'hours',   placeholder:'7.5',  refMin:7,   refMax:9    },
      { name:'Sleep Quality',     unit:'/10',     placeholder:'7',    refMin:6,   refMax:10   },
      { name:'Exercise Duration', unit:'minutes', placeholder:'30',   refMin:null,refMax:null },
      { name:'Calories Burned',   unit:'kcal',    placeholder:'400',  refMin:null,refMax:null },
      { name:'VO2 Max',           unit:'mL/kg/min',placeholder:'35',  refMin:null,refMax:null, badge:'Fitness' },
    ]
  },
  {
    id: 'mental' as Category, label: 'Mental Health', icon: Brain, color: '#8b5cf6',
    metrics: [
      { name:'Stress Level',  unit:'/10', placeholder:'4', refMin:null, refMax:5,  badge:'Mental' },
      { name:'Mood Score',    unit:'/10', placeholder:'7', refMin:6,    refMax:10, badge:'Mental' },
      { name:'Anxiety Level', unit:'/10', placeholder:'3', refMin:null, refMax:4,  badge:'Mental' },
      { name:'Energy Level',  unit:'/10', placeholder:'7', refMin:6,    refMax:10, badge:'Mental' },
      { name:'Focus Score',   unit:'/10', placeholder:'7', refMin:6,    refMax:10, badge:'Mental' },
    ]
  },
  {
    id: 'gut' as Category, label: 'Gut & Nutrition', icon: Leaf, color: '#10b981',
    metrics: [
      { name:'Water Intake',    unit:'glasses', placeholder:'8',  refMin:7,   refMax:null, badge:'Gut' },
      { name:'Fiber Intake',    unit:'grams',   placeholder:'25', refMin:25,  refMax:null, badge:'Gut' },
      { name:'Gut Health Score',unit:'/10',     placeholder:'7',  refMin:6,   refMax:10,   badge:'Gut' },
      { name:'Bowel Regularity',unit:'/10',     placeholder:'8',  refMin:6,   refMax:10,   badge:'Gut' },
    ]
  },
]

const BADGE_COLORS: Record<string,string> = {
  'Fitness':'bg-blue-100 text-blue-700',
  'Mental': 'bg-purple-100 text-purple-700',
  'Gut':    'bg-emerald-100 text-emerald-700',
}

export default function HealthDataPage() {
  const { user } = useAuthStore()
  const [activeCategory, setActiveCategory] = useState<Category>('vitals')
  const [values, setValues] = useState<Record<string,string>>({})
  const [saving, setSaving] = useState(false)
  const [recentRecords, setRecentRecords] = useState<Array<{test_name:string;value:number;unit:string;recorded_at:string}>>([])
  const [manualEntry, setManualEntry] = useState<ManualEntry>({ test_name:'', value:'', unit:'', notes:'' })
  const [showManual, setShowManual] = useState(false)

  useEffect(() => { if (user) loadRecent() }, [user])

  async function loadRecent() {
    if (!user) return
    const { data } = await supabase.from('health_records').select('test_name,value,unit,recorded_at')
      .eq('user_id', user.id).order('recorded_at',{ascending:false}).limit(20)
    setRecentRecords(data||[])
  }

  async function saveReadings() {
    if (!user) return
    const group = METRIC_GROUPS.find(g => g.id === activeCategory)
    if (!group) return

    const toSave = group.metrics
      .filter(m => values[m.name] && values[m.name].trim())
      .map(m => ({
        user_id: user.id,
        record_type: activeCategory,
        test_name: m.name,
        value: parseFloat(values[m.name]),
        unit: m.unit,
        reference_min: m.refMin ?? null,
        reference_max: m.refMax ?? null,
        source: 'manual',
        recorded_at: new Date().toISOString(),
        metadata: {},
      }))

    if (toSave.length === 0) { toast.error('Enter at least one value'); return }
    setSaving(true)
    try {
      const { error } = await supabase.from('health_records').insert(toSave)
      if (error) throw error
      toast.success(`${toSave.length} reading${toSave.length>1?'s':''} saved!`)
      setValues({})
      loadRecent()
    } catch (e) {
      toast.error('Save failed: ' + (e instanceof Error ? e.message : 'try again'))
    } finally { setSaving(false) }
  }

  async function saveManualEntry() {
    if (!user || !manualEntry.test_name || !manualEntry.value) {
      toast.error('Test name and value are required')
      return
    }
    setSaving(true)
    try {
      await supabase.from('health_records').insert({
        user_id: user.id,
        record_type: 'custom',
        test_name: manualEntry.test_name,
        value: parseFloat(manualEntry.value),
        unit: manualEntry.unit,
        source: 'manual',
        recorded_at: new Date().toISOString(),
        metadata: { notes: manualEntry.notes },
      })
      toast.success('Entry saved!')
      setManualEntry({ test_name:'', value:'', unit:'', notes:'' })
      setShowManual(false)
      loadRecent()
    } catch (e) {
      toast.error('Save failed')
    } finally { setSaving(false) }
  }

  const activeGroup = METRIC_GROUPS.find(g => g.id === activeCategory)!

  return (
    <div className="p-4 pb-8 max-w-2xl mx-auto space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-bold text-gray-900 flex items-center gap-2">
            <Activity size={18} className="text-teal-600"/> Health data
          </h1>
          <p className="text-xs text-gray-400">Log vitals, fitness, mental health & more</p>
        </div>
        <button onClick={() => setShowManual(s => !s)}
          className="flex items-center gap-1.5 btn-secondary text-xs py-2">
          <Plus size={12}/> Custom
        </button>
      </div>

      {/* Custom entry form */}
      {showManual && (
        <div className="card border-teal-200 !p-4" style={{background:'linear-gradient(135deg,#f0fdf8,#ecfdf5)'}}>
          <div className="flex items-center justify-between mb-3">
            <p className="text-sm font-bold text-gray-800">Add custom reading</p>
            <button onClick={() => setShowManual(false)}><X size={15} className="text-gray-400"/></button>
          </div>
          <div className="grid grid-cols-2 gap-2 mb-2">
            <div className="col-span-2">
              <label className="text-xs text-gray-500 mb-1 block">Test name *</label>
              <input className="input text-sm" placeholder="e.g. Fasting Glucose, HbA1c..."
                value={manualEntry.test_name} onChange={e => setManualEntry(p=>({...p,test_name:e.target.value}))}/>
            </div>
            <div>
              <label className="text-xs text-gray-500 mb-1 block">Value *</label>
              <input type="number" className="input text-sm" placeholder="98"
                value={manualEntry.value} onChange={e => setManualEntry(p=>({...p,value:e.target.value}))}/>
            </div>
            <div>
              <label className="text-xs text-gray-500 mb-1 block">Unit</label>
              <input className="input text-sm" placeholder="mg/dL"
                value={manualEntry.unit} onChange={e => setManualEntry(p=>({...p,unit:e.target.value}))}/>
            </div>
            <div className="col-span-2">
              <label className="text-xs text-gray-500 mb-1 block">Notes (optional)</label>
              <input className="input text-sm" placeholder="e.g. fasting, post-meal..."
                value={manualEntry.notes} onChange={e => setManualEntry(p=>({...p,notes:e.target.value}))}/>
            </div>
          </div>
          <button onClick={saveManualEntry} disabled={saving} className="btn-primary w-full text-xs py-2">
            {saving?'Saving...':'Save entry'}
          </button>
        </div>
      )}

      {/* Category tabs */}
      <div className="flex gap-1.5 overflow-x-auto pb-0.5">
        {METRIC_GROUPS.map(g => (
          <button key={g.id} onClick={() => setActiveCategory(g.id)}
            className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold shrink-0 border transition-all ${
              activeCategory===g.id?'text-white border-transparent':'border-gray-200 text-gray-500 bg-white'
            }`}
            style={activeCategory===g.id?{background:`linear-gradient(135deg,${g.color}dd,${g.color})`}:{}}>
            <g.icon size={13}/>{g.label}
          </button>
        ))}
      </div>

      {/* Metric inputs */}
      <div className="card !p-4">
        <div className="flex items-center gap-2 mb-4">
          <div className="w-8 h-8 rounded-lg flex items-center justify-center"
            style={{background:`${activeGroup.color}20`}}>
            <activeGroup.icon size={16} style={{color:activeGroup.color}}/>
          </div>
          <div>
            <p className="text-sm font-bold text-gray-900">{activeGroup.label}</p>
            <p className="text-[10px] text-gray-400">Enter today's readings</p>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2.5 mb-4">
          {activeGroup.metrics.map(m => {
            const val = parseFloat(values[m.name]||'')
            const isHigh = m.refMax != null && !isNaN(val) && val > m.refMax
            const isLow  = m.refMin != null && !isNaN(val) && val < m.refMin
            const statusColor = isHigh||isLow ? '#ef4444' : (!isNaN(val) && val > 0) ? '#10b981' : undefined
            return (
              <div key={m.name}>
                <div className="flex items-center gap-1 mb-1">
                  <label className="text-[11px] font-medium text-gray-600">{m.name}</label>
                  {m.badge && <span className={`text-[9px] px-1.5 py-0.5 rounded font-bold ${BADGE_COLORS[m.badge]||''}`}>{m.badge}</span>}
                </div>
                <div className="relative">
                  <input type="number" step="any"
                    className="input text-sm !py-2 pr-12"
                    placeholder={m.placeholder}
                    value={values[m.name]||''}
                    onChange={e => setValues(p=>({...p,[m.name]:e.target.value}))}
                    style={statusColor?{borderColor:statusColor}:{}}/>
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] text-gray-400">{m.unit}</span>
                </div>
                {(isHigh||isLow) && (
                  <p className="text-[10px] text-red-500 mt-0.5">{isHigh?`↑ High (max ${m.refMax})`:`↓ Low (min ${m.refMin})`}</p>
                )}
              </div>
            )
          })}
        </div>

        <button onClick={saveReadings} disabled={saving}
          className="btn-primary w-full py-2.5 flex items-center justify-center gap-2">
          <Check size={14}/>{saving?'Saving...':'Save readings'}
        </button>
      </div>

      {/* Phase 2 — Wearable sync teaser */}
      <div className="card !p-4 border-dashed border-2 border-gray-200">
        <p className="text-xs font-bold text-gray-700 mb-2 flex items-center gap-2">
          <Gauge size={14} className="text-gray-400"/> Wearable sync <span className="text-[9px] bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded font-bold">COMING SOON</span>
        </p>
        <div className="grid grid-cols-3 gap-2">
          {[
            {name:'Apple Watch',  icon:'⌚', status:'Q3 2026'},
            {name:'Google Fit',   icon:'📱', status:'Q3 2026'},
            {name:'Samsung Health',icon:'⌚',status:'Q4 2026'},
          ].map(w => (
            <div key={w.name} className="bg-gray-50 rounded-lg p-2 text-center">
              <p className="text-xl mb-1">{w.icon}</p>
              <p className="text-[10px] font-semibold text-gray-600">{w.name}</p>
              <p className="text-[9px] text-gray-400">{w.status}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Recent readings */}
      {recentRecords.length > 0 && (
        <div className="card !p-4">
          <p className="text-sm font-bold text-gray-800 mb-3">Recent readings</p>
          <div className="space-y-2 max-h-48 overflow-y-auto">
            {recentRecords.map((r,i) => (
              <div key={i} className="flex items-center justify-between text-xs bg-gray-50 rounded-lg px-3 py-2">
                <div>
                  <p className="font-medium text-gray-800">{r.test_name}</p>
                  <p className="text-gray-400">{new Date(r.recorded_at).toLocaleDateString('en-IN',{day:'numeric',month:'short',hour:'2-digit',minute:'2-digit'})}</p>
                </div>
                <span className="font-bold text-gray-900">{r.value} {r.unit}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
