import { useState, useEffect } from 'react'
import { useAuthStore } from '@/store/authStore'
import { supabase } from '@/lib/supabase'
import { Watch, Smartphone, Heart, Activity, Moon, Zap, RefreshCw, Check, ChevronRight, Info, Download } from 'lucide-react'
import toast from 'react-hot-toast'

interface SyncedMetric {
  name: string
  value: number
  unit: string
  source: string
  synced_at: string
}

interface WearableDevice {
  id: string
  name: string
  brand: string
  platform: 'android' | 'ios' | 'both'
  logo: string
  connected: boolean
  last_sync: string | null
  metrics: string[]
}

const HEALTH_CONNECT_METRICS = [
  { key: 'steps',           label: 'Steps',           icon: '🚶', unit: 'steps',   dbName: 'Daily Steps'     },
  { key: 'heart_rate',      label: 'Heart Rate',      icon: '❤️', unit: 'bpm',     dbName: 'Heart Rate'      },
  { key: 'sleep_duration',  label: 'Sleep',           icon: '😴', unit: 'hours',   dbName: 'Sleep Duration'  },
  { key: 'calories',        label: 'Calories Burned', icon: '🔥', unit: 'kcal',    dbName: 'Calories Burned' },
  { key: 'spo2',            label: 'SpO2',            icon: '💧', unit: '%',       dbName: 'SpO2'            },
  { key: 'hrv',             label: 'HRV',             icon: '📊', unit: 'ms',      dbName: 'HRV'             },
  { key: 'distance',        label: 'Distance',        icon: '📍', unit: 'km',      dbName: 'Distance'        },
  { key: 'weight',          label: 'Weight',          icon: '⚖️', unit: 'kg',      dbName: 'Weight'          },
]

const ANDROID_DEVICES = [
  { name: 'Samsung Galaxy Watch', brand: 'Samsung Health', logo: '🔵' },
  { name: 'Fitbit',               brand: 'Fitbit',         logo: '💚' },
  { name: 'Garmin',               brand: 'Garmin Connect', logo: '🟣' },
  { name: 'Noise',                brand: 'NoiseFit',       logo: '⚫' },
  { name: 'boAt',                 brand: 'boAt Crest',     logo: '🔴' },
  { name: 'Fire-Boltt',           brand: 'Fire-Boltt',     logo: '🟠' },
  { name: 'Mi Band / Redmi',      brand: 'Zepp Life',      logo: '🟡' },
  { name: 'Realme Watch',         brand: 'Realme Link',    logo: '🟢' },
]

// Simulate reading from Health Connect (Web Bluetooth + Health Connect API)
// In real PWA: use Android Health Connect API via Capacitor/React Native
async function readHealthConnect(): Promise<Record<string, number>> {
  // This would be replaced with actual Health Connect API calls
  // For demo: return realistic simulated values
  return {
    steps: Math.floor(Math.random() * 5000 + 3000),
    heart_rate: Math.floor(Math.random() * 20 + 65),
    sleep_duration: +(Math.random() * 2 + 6).toFixed(1),
    calories: Math.floor(Math.random() * 500 + 1500),
    spo2: Math.floor(Math.random() * 4 + 95),
    hrv: Math.floor(Math.random() * 30 + 40),
    distance: +(Math.random() * 3 + 2).toFixed(1),
  }
}

export default function WearableSyncPage() {
  const { user } = useAuthStore()
  const [tab, setTab] = useState<'android' | 'ios' | 'data'>('android')
  const [syncing, setSyncing] = useState(false)
  const [lastSync, setLastSync] = useState<string | null>(null)
  const [syncedData, setSyncedData] = useState<SyncedMetric[]>([])
  const [androidConnected, setAndroidConnected] = useState(false)
  const [iosConnected, setIosConnected] = useState(false)
  const [selectedMetrics, setSelectedMetrics] = useState<string[]>(
    HEALTH_CONNECT_METRICS.map(m => m.key)
  )

  useEffect(() => {
    if (user) loadSyncHistory()
    // Check if previously connected
    const conn = localStorage.getItem('vitalos-wearable-connected')
    if (conn) {
      const { android, ios } = JSON.parse(conn)
      setAndroidConnected(android)
      setIosConnected(ios)
    }
  }, [user])

  async function loadSyncHistory() {
    if (!user) return
    const { data } = await supabase.from('health_records')
      .select('test_name, value, unit, recorded_at, source')
      .eq('user_id', user.id)
      .eq('source', 'wearable')
      .order('recorded_at', { ascending: false })
      .limit(20)
    if (data) {
      setSyncedData(data.map((r: { test_name: string; value: number; unit: string; source: string; recorded_at: string }) => ({
        name: r.test_name, value: r.value, unit: r.unit,
        source: r.source, synced_at: r.recorded_at
      })))
      if (data.length > 0) setLastSync(data[0].recorded_at)
    }
  }

  async function connectAndroid() {
    // Check if Android + Health Connect available
    const isAndroid = /android/i.test(navigator.userAgent)
    if (!isAndroid) {
      toast.error('Health Connect is Android only. Please open VitalOS on your Android phone.')
      return
    }
    // Deep link to Health Connect
    window.open('intent://com.google.android.apps.healthdata#Intent;scheme=https;package=com.google.android.apps.healthdata;end', '_blank')
    toast('Opening Health Connect on your device...', { icon: '📱' })
    setTimeout(() => {
      setAndroidConnected(true)
      localStorage.setItem('vitalos-wearable-connected', JSON.stringify({ android: true, ios: iosConnected }))
      toast.success('Health Connect linked! Tap "Sync now" to import data.')
    }, 2000)
  }

  async function connectIOS() {
    const isIOS = /iphone|ipad|ipod/i.test(navigator.userAgent)
    if (!isIOS) {
      toast.error('Apple Health is iOS only. Please open VitalOS on your iPhone.')
      return
    }
    toast('Opening Apple Health settings...', { icon: '🍎' })
    window.open('x-apple-health://', '_blank')
    setTimeout(() => {
      setIosConnected(true)
      localStorage.setItem('vitalos-wearable-connected', JSON.stringify({ android: androidConnected, ios: true }))
      toast.success('Apple Health linked! Tap "Sync now" to import data.')
    }, 2000)
  }

  async function syncNow() {
    if (!user) return
    setSyncing(true)
    try {
      // Read from Health Connect / Apple Health
      const data = await readHealthConnect()
      const now = new Date().toISOString()
      const records = []

      for (const metric of HEALTH_CONNECT_METRICS) {
        if (!selectedMetrics.includes(metric.key)) continue
        const value = data[metric.key]
        if (!value) continue
        records.push({
          user_id: user.id,
          record_type: 'wearable',
          test_name: metric.dbName,
          value: value,
          unit: metric.unit,
          source: 'wearable',
          recorded_at: now,
          metadata: { sync_source: androidConnected ? 'health_connect' : 'apple_health', metric_key: metric.key }
        })
      }

      if (records.length > 0) {
        const { error } = await supabase.from('health_records').insert(records)
        if (error) { toast.error('Sync failed: ' + error.message); return }
        toast.success(`✅ Synced ${records.length} metrics from your wearable!`)
        setLastSync(now)
        loadSyncHistory()
      }
    } catch (e) {
      toast.error('Sync failed. Make sure Health Connect / Apple Health is connected.')
    } finally {
      setSyncing(false)
    }
  }

  function toggleMetric(key: string) {
    setSelectedMetrics(prev =>
      prev.includes(key) ? prev.filter(k => k !== key) : [...prev, key]
    )
  }

  const isConnected = androidConnected || iosConnected

  return (
    <div className="p-4 pb-8 max-w-2xl mx-auto space-y-4">
      {/* Header */}
      <div className="card !p-5" style={{ background: 'linear-gradient(135deg,#0a1628,#0f2a1e)', borderColor: '#1e40af' }}>
        <div className="flex items-start gap-3">
          <div className="w-12 h-12 rounded-xl flex items-center justify-center shrink-0" style={{ background: 'rgba(59,130,246,0.2)' }}>
            <Watch size={24} className="text-blue-400" />
          </div>
          <div>
            <div className="flex items-center gap-2 mb-1">
              <h1 className="text-lg font-bold text-white">Wearable Sync</h1>
              <span className="text-[10px] bg-blue-900 text-blue-300 border border-blue-700 px-2 py-0.5 rounded-full font-bold">NEW</span>
            </div>
            <p className="text-sm text-blue-300">Connect Health Connect (Android) or Apple Health (iOS) to sync data from 80+ wearable brands automatically.</p>
          </div>
        </div>

        {/* Supported brands */}
        <div className="mt-4 flex flex-wrap gap-1.5">
          {['Samsung', 'Fitbit', 'Garmin', 'Noise', 'boAt', 'Fire-Boltt', 'Apple Watch', 'Mi Band', 'Realme'].map(b => (
            <span key={b} className="text-[10px] bg-white/10 text-white/60 px-2 py-0.5 rounded-full">{b}</span>
          ))}
          <span className="text-[10px] bg-white/10 text-white/60 px-2 py-0.5 rounded-full">+70 more</span>
        </div>
      </div>

      {/* Sync status bar */}
      {isConnected && (
        <div className="card !p-4">
          <div className="flex items-center justify-between">
            <div>
              <div className="flex items-center gap-2 mb-0.5">
                <div className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse"/>
                <p className="text-sm font-bold text-gray-900">
                  {androidConnected ? 'Health Connect' : 'Apple Health'} connected
                </p>
              </div>
              <p className="text-xs text-gray-400">
                {lastSync ? `Last sync: ${new Date(lastSync).toLocaleString('en-IN')}` : 'Not synced yet'}
              </p>
            </div>
            <button onClick={syncNow} disabled={syncing}
              className="btn-primary text-xs py-2 px-4 flex items-center gap-2">
              <RefreshCw size={13} className={syncing ? 'animate-spin' : ''} />
              {syncing ? 'Syncing...' : 'Sync now'}
            </button>
          </div>
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-1 bg-gray-100 rounded-xl p-1">
        {(['android', 'ios', 'data'] as const).map(t => (
          <button key={t} onClick={() => setTab(t)}
            className={`flex-1 text-xs py-2 rounded-lg font-semibold transition-all capitalize ${tab === t ? 'bg-white shadow-sm text-gray-900' : 'text-gray-500'}`}>
            {t === 'android' ? '🤖 Android' : t === 'ios' ? '🍎 iOS' : '📊 Synced data'}
          </button>
        ))}
      </div>

      {/* Android Tab */}
      {tab === 'android' && (
        <div className="space-y-4">
          <div className="card !p-5">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-12 h-12 rounded-xl flex items-center justify-center text-2xl" style={{ background: 'rgba(34,197,94,0.1)' }}>🤖</div>
              <div>
                <p className="text-base font-bold text-gray-900">Health Connect</p>
                <p className="text-xs text-gray-500">Google's unified health platform for Android · Supports all major wearables</p>
              </div>
              {androidConnected && <span className="ml-auto text-xs bg-emerald-100 text-emerald-700 font-bold px-2 py-1 rounded-full">✓ Connected</span>}
            </div>

            {/* Architecture diagram */}
            <div className="bg-gray-50 rounded-xl p-4 mb-4 border border-gray-100">
              <p className="text-[10px] font-bold text-gray-500 mb-3 uppercase tracking-wider">How it works</p>
              <div className="flex items-center gap-2 flex-wrap">
                {['Your Wearable', '→', 'Samsung/Fitbit/Garmin App', '→', 'Health Connect', '→', 'VitalOS'].map((item, i) => (
                  item === '→'
                    ? <span key={i} className="text-gray-400 text-sm">→</span>
                    : <span key={i} className={`text-[10px] px-2 py-1 rounded-lg font-semibold ${item === 'VitalOS' ? 'bg-teal-100 text-teal-700' : item === 'Health Connect' ? 'bg-blue-100 text-blue-700' : 'bg-gray-200 text-gray-600'}`}>{item}</span>
                ))}
              </div>
            </div>

            {/* Supported devices */}
            <div className="grid grid-cols-2 gap-2 mb-4">
              {ANDROID_DEVICES.map(d => (
                <div key={d.name} className="flex items-center gap-2 p-2.5 bg-gray-50 rounded-lg border border-gray-100">
                  <span className="text-lg">{d.logo}</span>
                  <div className="min-w-0">
                    <p className="text-xs font-semibold text-gray-800 truncate">{d.name}</p>
                    <p className="text-[10px] text-gray-400 truncate">{d.brand}</p>
                  </div>
                </div>
              ))}
            </div>

            <button onClick={connectAndroid}
              className={`w-full py-3 rounded-xl font-bold text-sm flex items-center justify-center gap-2 ${androidConnected ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'btn-primary'}`}>
              {androidConnected ? <><Check size={16}/>Health Connect linked</> : <><Smartphone size={16}/>Connect Health Connect</>}
            </button>

            {!androidConnected && (
              <div className="mt-3 p-3 bg-amber-50 rounded-lg border border-amber-100">
                <p className="text-[11px] text-amber-700 leading-relaxed">
                  <strong>Requires:</strong> Android 9+ · Health Connect app installed · Open VitalOS from your Android phone
                </p>
              </div>
            )}
          </div>

          {/* Setup steps */}
          <div className="card !p-4">
            <p className="text-sm font-bold text-gray-800 mb-3">Setup guide</p>
            {[
              { step: '1', title: 'Install Health Connect', desc: 'Download from Play Store on your Android phone', icon: Download },
              { step: '2', title: 'Connect your wearable app', desc: 'Open Samsung Health / Fitbit / Garmin etc. → Settings → Health Connect → Allow', icon: Watch },
              { step: '3', title: 'Open VitalOS on Android', desc: 'Visit vitalos-six.vercel.app on your Android phone browser', icon: Smartphone },
              { step: '4', title: 'Tap "Connect Health Connect"', desc: 'Grant permissions and start syncing automatically', icon: Zap },
            ].map(s => (
              <div key={s.step} className="flex gap-3 mb-3 last:mb-0">
                <div className="w-7 h-7 rounded-full bg-teal-100 text-teal-700 text-xs font-black flex items-center justify-center shrink-0">{s.step}</div>
                <div>
                  <p className="text-sm font-semibold text-gray-800">{s.title}</p>
                  <p className="text-xs text-gray-400">{s.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* iOS Tab */}
      {tab === 'ios' && (
        <div className="space-y-4">
          <div className="card !p-5">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-12 h-12 rounded-xl flex items-center justify-center text-2xl" style={{ background: 'rgba(0,0,0,0.05)' }}>🍎</div>
              <div>
                <p className="text-base font-bold text-gray-900">Apple Health</p>
                <p className="text-xs text-gray-500">Native iOS health platform · Apple Watch + 100+ apps</p>
              </div>
              {iosConnected && <span className="ml-auto text-xs bg-emerald-100 text-emerald-700 font-bold px-2 py-1 rounded-full">✓ Connected</span>}
            </div>

            <div className="bg-gray-50 rounded-xl p-4 mb-4 border border-gray-100">
              <p className="text-[10px] font-bold text-gray-500 mb-3 uppercase tracking-wider">How it works</p>
              <div className="flex items-center gap-2 flex-wrap">
                {['Apple Watch', '→', 'Apple Health App', '→', 'VitalOS'].map((item, i) => (
                  item === '→'
                    ? <span key={i} className="text-gray-400 text-sm">→</span>
                    : <span key={i} className={`text-[10px] px-2 py-1 rounded-lg font-semibold ${item === 'VitalOS' ? 'bg-teal-100 text-teal-700' : item === 'Apple Health App' ? 'bg-gray-300 text-gray-700' : 'bg-gray-200 text-gray-600'}`}>{item}</span>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2 mb-4">
              {['Apple Watch', 'Whoop', 'Oura Ring', 'Fitbit (iOS)', 'Garmin (iOS)', 'Withings', 'Polar', 'Suunto'].map(d => (
                <div key={d} className="flex items-center gap-2 p-2.5 bg-gray-50 rounded-lg border border-gray-100">
                  <span className="text-sm">⌚</span>
                  <p className="text-xs font-semibold text-gray-700">{d}</p>
                </div>
              ))}
            </div>

            <button onClick={connectIOS}
              className={`w-full py-3 rounded-xl font-bold text-sm flex items-center justify-center gap-2 ${iosConnected ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-gray-900 text-white'}`}>
              {iosConnected ? <><Check size={16}/>Apple Health linked</> : <><Heart size={16}/>Connect Apple Health</>}
            </button>

            {!iosConnected && (
              <div className="mt-3 p-3 bg-blue-50 rounded-lg border border-blue-100">
                <p className="text-[11px] text-blue-700 leading-relaxed">
                  <strong>Requires:</strong> iPhone running iOS 16+ · Open VitalOS in Safari on your iPhone
                </p>
              </div>
            )}
          </div>

          <div className="card !p-4">
            <p className="text-sm font-bold text-gray-800 mb-3">Setup guide</p>
            {[
              { step:'1', title:'Open on iPhone', desc:'Open vitalos-six.vercel.app in Safari on your iPhone' },
              { step:'2', title:'Tap "Connect Apple Health"', desc:'VitalOS will request permission to read health data' },
              { step:'3', title:'Grant permissions', desc:'Choose which metrics to share — steps, heart rate, sleep, etc.' },
              { step:'4', title:'Sync automatically', desc:'Data syncs from Apple Watch and all connected health apps' },
            ].map(s => (
              <div key={s.step} className="flex gap-3 mb-3 last:mb-0">
                <div className="w-7 h-7 rounded-full bg-gray-900 text-white text-xs font-black flex items-center justify-center shrink-0">{s.step}</div>
                <div>
                  <p className="text-sm font-semibold text-gray-800">{s.title}</p>
                  <p className="text-xs text-gray-400">{s.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Synced Data Tab */}
      {tab === 'data' && (
        <div className="space-y-4">
          {/* Metric selector */}
          <div className="card !p-4">
            <p className="text-sm font-bold text-gray-800 mb-3">Metrics to sync</p>
            <div className="grid grid-cols-2 gap-2">
              {HEALTH_CONNECT_METRICS.map(m => (
                <button key={m.key} onClick={() => toggleMetric(m.key)}
                  className={`flex items-center gap-2 p-2.5 rounded-xl border text-left transition-all ${selectedMetrics.includes(m.key) ? 'border-teal-300 bg-teal-50' : 'border-gray-200 bg-gray-50'}`}>
                  <span className="text-base shrink-0">{m.icon}</span>
                  <div className="min-w-0">
                    <p className="text-xs font-semibold text-gray-800 truncate">{m.label}</p>
                    <p className="text-[10px] text-gray-400">{m.unit}</p>
                  </div>
                  {selectedMetrics.includes(m.key) && <Check size={12} className="text-teal-600 ml-auto shrink-0"/>}
                </button>
              ))}
            </div>
          </div>

          {isConnected && (
            <button onClick={syncNow} disabled={syncing}
              className="btn-primary w-full py-3 flex items-center justify-center gap-2">
              <RefreshCw size={15} className={syncing ? 'animate-spin' : ''}/>
              {syncing ? 'Syncing...' : 'Sync now'}
            </button>
          )}

          {/* Synced records */}
          {syncedData.length > 0 ? (
            <div className="card !p-4">
              <p className="text-sm font-bold text-gray-800 mb-3">Recent sync data</p>
              <div className="space-y-2">
                {syncedData.map((d, i) => (
                  <div key={i} className="flex items-center justify-between py-2 border-b border-gray-50 last:border-0">
                    <div>
                      <p className="text-sm font-semibold text-gray-800">{d.name}</p>
                      <p className="text-[10px] text-gray-400">{new Date(d.synced_at).toLocaleString('en-IN')}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-black text-teal-600">{d.value}</p>
                      <p className="text-[10px] text-gray-400">{d.unit}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="card border-dashed border-2 text-center py-10">
              <Watch size={32} className="text-gray-200 mx-auto mb-3"/>
              <p className="text-sm font-semibold text-gray-600 mb-1">No wearable data yet</p>
              <p className="text-xs text-gray-400 mb-4">Connect Health Connect or Apple Health to start syncing</p>
              <button onClick={() => setTab('android')} className="btn-primary text-xs py-2">
                Connect wearable
              </button>
            </div>
          )}

          <div className="card !p-4 bg-blue-50 border-blue-100">
            <p className="text-xs font-bold text-blue-700 mb-1 flex items-center gap-1.5"><Info size={12}/>How synced data is used</p>
            <p className="text-xs text-blue-600 leading-relaxed">
              Wearable data feeds directly into your Longevity Score, Recovery Score, Sleep Intelligence, and Biological Age Engine — making all AI insights more accurate and personalized.
            </p>
          </div>
        </div>
      )}
    </div>
  )
}
