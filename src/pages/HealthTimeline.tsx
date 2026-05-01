import { useEffect, useState } from 'react'
import { useAuthStore } from '@/store/authStore'
import { supabase } from '@/lib/supabase'
import { Activity, FileText, Stethoscope, Heart, TrendingUp, TrendingDown, Minus, Plus, X } from 'lucide-react'

interface TimelineEvent {
  id: string
  date: string
  type: 'report' | 'appointment' | 'reading' | 'milestone' | 'lifestyle'
  title: string
  description: string
  icon: string
  color: string
  data?: Record<string, unknown>
  metrics?: Array<{ name: string; value: number; unit: string; status: 'good'|'warning'|'critical' }>
}

interface CustomEvent { date: string; title: string; description: string; type: string }

export default function HealthTimeline() {
  const { user } = useAuthStore()
  const [events, setEvents] = useState<TimelineEvent[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<'all'|'report'|'appointment'|'reading'|'lifestyle'>('all')
  const [showAdd, setShowAdd] = useState(false)
  const [addForm, setAddForm] = useState<CustomEvent>({ date: new Date().toISOString().split('T')[0], title: '', description: '', type: 'lifestyle' })
  const [expanded, setExpanded] = useState<string | null>(null)

  useEffect(() => { if (user) loadTimeline() }, [user])

  async function loadTimeline() {
    if (!user) return
    setLoading(true)

    const [reports, appointments, readings] = await Promise.all([
      supabase.from('health_reports').select('*').eq('user_id', user.id).eq('ocr_status', 'done').order('created_at', { ascending: false }),
      supabase.from('appointments').select('*, doctor:doctors(name,specialty)').eq('user_id', user.id).order('slot_date', { ascending: false }),
      supabase.from('health_records').select('*').eq('user_id', user.id).order('recorded_at', { ascending: false }).limit(100),
    ])

    const timeline: TimelineEvent[] = []

    // Reports
    for (const r of (reports.data || [])) {
      const extracted = r.extracted_data as { records?: Array<{ test_name: string; value: number; unit: string; reference_min?: number; reference_max?: number }> } | null
      const metrics = (extracted?.records || []).slice(0, 6).map(m => ({
        name: m.test_name,
        value: m.value,
        unit: m.unit,
        status: (m.reference_max && m.value > m.reference_max * 1.1) || (m.reference_min && m.value < m.reference_min * 0.9)
          ? 'critical' : (m.reference_max && m.value > m.reference_max) || (m.reference_min && m.value < m.reference_min)
          ? 'warning' : 'good' as 'good'|'warning'|'critical'
      }))

      timeline.push({
        id: r.id,
        date: r.created_at,
        type: 'report',
        title: `Lab report — ${r.lab_name || 'Unknown lab'}`,
        description: `${extracted?.records?.length || 0} test values extracted`,
        icon: '🔬',
        color: '#8b5cf6',
        metrics,
      })
    }

    // Appointments
    for (const a of (appointments.data || [])) {
      timeline.push({
        id: a.id,
        date: a.slot_date + 'T' + (a.slot_time || '00:00:00'),
        type: 'appointment',
        title: `Consultation — ${(a.doctor as { name?: string })?.name || 'Doctor'}`,
        description: `${(a.doctor as { specialty?: string })?.specialty || ''} · Status: ${a.status}${a.notes ? ` · "${a.notes}"` : ''}`,
        icon: '🩺',
        color: '#0f6e56',
      })
    }

    // Group readings by date
    const readingsByDate = new Map<string, typeof readings.data>()
    for (const r of (readings.data || [])) {
      const d = r.recorded_at.split('T')[0]
      const arr = readingsByDate.get(d) || []
      arr.push(r)
      readingsByDate.set(d, arr)
    }
    for (const [date, recs] of readingsByDate) {
      if (!recs || recs.length === 0) continue
      timeline.push({
        id: `reading_${date}`,
        date: date + 'T12:00:00',
        type: 'reading',
        title: `${recs.length} health reading${recs.length > 1 ? 's' : ''} recorded`,
        description: recs.slice(0, 3).map(r => `${r.test_name}: ${r.value} ${r.unit}`).join(' · '),
        icon: '📊',
        color: '#3b82f6',
        metrics: recs.slice(0, 4).map(r => ({
          name: r.test_name, value: r.value, unit: r.unit,
          status: (r.reference_max && r.value > r.reference_max) ? 'warning' : 'good' as 'good'|'warning'|'critical'
        }))
      })
    }

    // Sort by date descending
    timeline.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
    setEvents(timeline)
    setLoading(false)
  }

  async function addCustomEvent() {
    if (!user || !addForm.title || !addForm.date) return
    const ev: TimelineEvent = {
      id: `custom_${Date.now()}`,
      date: addForm.date + 'T12:00:00',
      type: 'lifestyle',
      title: addForm.title,
      description: addForm.description,
      icon: addForm.type === 'lifestyle' ? '🏃' : addForm.type === 'milestone' ? '🏆' : '📝',
      color: addForm.type === 'lifestyle' ? '#10b981' : '#f59e0b',
    }
    setEvents(prev => [...prev, ev].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()))
    setAddForm({ date: new Date().toISOString().split('T')[0], title: '', description: '', type: 'lifestyle' })
    setShowAdd(false)
  }

  const filtered = filter === 'all' ? events : events.filter(e => e.type === filter)

  // Group by month
  const byMonth = new Map<string, TimelineEvent[]>()
  for (const e of filtered) {
    const key = new Date(e.date).toLocaleDateString('en-IN', { month: 'long', year: 'numeric' })
    const arr = byMonth.get(key) || []
    arr.push(e)
    byMonth.set(key, arr)
  }

  const statusColor = { good: '#10b981', warning: '#f59e0b', critical: '#ef4444' }
  const typeIcons = { report: FileText, appointment: Stethoscope, reading: Activity, lifestyle: Heart, milestone: TrendingUp }

  return (
    <div className="p-6 max-w-3xl space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-900 flex items-center gap-2">
            <Activity size={20} className="text-teal-600" /> Health Timeline
          </h1>
          <p className="text-xs text-gray-400 mt-0.5">Your complete health journey in chronological order</p>
        </div>
        <button onClick={() => setShowAdd(s => !s)} className="btn-primary text-xs py-2 flex items-center gap-1.5">
          <Plus size={13} /> Add event
        </button>
      </div>

      {/* Add event form */}
      {showAdd && (
        <div className="card border-teal-200" style={{ background: 'linear-gradient(135deg,#f0fdf8,#ecfdf5)' }}>
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-bold text-gray-800">Add custom event</h3>
            <button onClick={() => setShowAdd(false)}><X size={15} className="text-gray-400" /></button>
          </div>
          <div className="grid grid-cols-3 gap-3 mb-3">
            <div>
              <label className="text-xs text-gray-500 mb-1 block">Date</label>
              <input type="date" className="input text-sm" value={addForm.date}
                onChange={e => setAddForm(f => ({ ...f, date: e.target.value }))} />
            </div>
            <div>
              <label className="text-xs text-gray-500 mb-1 block">Type</label>
              <select className="input text-sm" value={addForm.type}
                onChange={e => setAddForm(f => ({ ...f, type: e.target.value }))}>
                <option value="lifestyle">Lifestyle change</option>
                <option value="milestone">Milestone</option>
                <option value="symptom">Symptom noted</option>
              </select>
            </div>
            <div>
              <label className="text-xs text-gray-500 mb-1 block">Title</label>
              <input className="input text-sm" placeholder="Started gym, quit smoking..." value={addForm.title}
                onChange={e => setAddForm(f => ({ ...f, title: e.target.value }))} />
            </div>
          </div>
          <div className="mb-3">
            <label className="text-xs text-gray-500 mb-1 block">Description (optional)</label>
            <input className="input text-sm" placeholder="More details..." value={addForm.description}
              onChange={e => setAddForm(f => ({ ...f, description: e.target.value }))} />
          </div>
          <button onClick={addCustomEvent} className="btn-primary text-xs py-2">Add to timeline</button>
        </div>
      )}

      {/* Filters */}
      <div className="flex gap-2 flex-wrap">
        {(['all','report','appointment','reading','lifestyle'] as const).map(f => (
          <button key={f} onClick={() => setFilter(f)}
            className={`text-xs px-3 py-1.5 rounded-full border capitalize transition-colors ${
              filter === f ? 'text-white border-transparent' : 'border-gray-200 text-gray-500 hover:border-teal-200'
            }`}
            style={filter === f ? { background: 'linear-gradient(135deg,#0f6e56,#1d9e75)' } : {}}>
            {f === 'all' ? `All (${events.length})` : f}
          </button>
        ))}
      </div>

      {/* Timeline */}
      {loading ? (
        <div className="space-y-4">
          {[1,2,3].map(i => <div key={i} className="card h-20 animate-pulse bg-gray-100" />)}
        </div>
      ) : filtered.length === 0 ? (
        <div className="card border-dashed border-2 text-center py-12">
          <Activity size={32} className="text-gray-200 mx-auto mb-3" />
          <p className="text-gray-400 text-sm">No events yet</p>
          <p className="text-xs text-gray-300 mt-1">Upload reports or book appointments to build your timeline</p>
        </div>
      ) : (
        Array.from(byMonth.entries()).map(([month, monthEvents]) => (
          <div key={month}>
            <p className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-3 flex items-center gap-2">
              <span className="h-px flex-1 bg-gray-200" /> {month} <span className="h-px flex-1 bg-gray-200" />
            </p>
            <div className="relative">
              {/* Timeline line */}
              <div className="absolute left-5 top-0 bottom-0 w-0.5 bg-gray-200" />
              <div className="space-y-3">
                {monthEvents.map(ev => {
                  const isOpen = expanded === ev.id
                  return (
                    <div key={ev.id} className="relative pl-12">
                      {/* Dot */}
                      <div className="absolute left-3 top-4 w-5 h-5 rounded-full flex items-center justify-center text-white text-[10px] z-10 shadow-sm"
                        style={{ background: ev.color }}>
                        {ev.icon}
                      </div>
                      <div className={`card cursor-pointer transition-all hover:shadow-md ${isOpen ? 'ring-1 ring-teal-200' : ''}`}
                        onClick={() => setExpanded(isOpen ? null : ev.id)}>
                        <div className="flex items-start justify-between">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-0.5">
                              <p className="text-sm font-semibold text-gray-900 truncate">{ev.title}</p>
                              {ev.metrics && ev.metrics.some(m => m.status === 'critical') && (
                                <span className="text-[10px] bg-red-100 text-red-700 px-1.5 py-0.5 rounded-full shrink-0">⚠ Alert</span>
                              )}
                            </div>
                            <p className="text-xs text-gray-500 truncate">{ev.description}</p>
                            <p className="text-[10px] text-gray-400 mt-1">
                              {new Date(ev.date).toLocaleDateString('en-IN', { weekday:'short', day:'numeric', month:'short', year:'numeric' })}
                            </p>
                          </div>
                          <span className="text-[10px] capitalize px-2 py-1 rounded-lg ml-2 shrink-0 font-medium"
                            style={{ background: ev.color + '20', color: ev.color }}>
                            {ev.type}
                          </span>
                        </div>

                        {/* Expanded metrics */}
                        {isOpen && ev.metrics && ev.metrics.length > 0 && (
                          <div className="mt-3 pt-3 border-t border-gray-100">
                            <p className="text-[10px] font-semibold text-gray-500 mb-2">Test results from this report:</p>
                            <div className="grid grid-cols-3 gap-2">
                              {ev.metrics.map(m => (
                                <div key={m.name} className="bg-gray-50 rounded-lg p-2">
                                  <p className="text-[10px] text-gray-400 truncate">{m.name}</p>
                                  <div className="flex items-baseline gap-0.5">
                                    <span className="text-sm font-bold" style={{ color: statusColor[m.status] }}>{m.value}</span>
                                    <span className="text-[9px] text-gray-400">{m.unit}</span>
                                  </div>
                                  <div className="w-full h-1 bg-gray-200 rounded-full mt-1 overflow-hidden">
                                    <div className="h-full rounded-full" style={{ width: m.status === 'good' ? '100%' : m.status === 'warning' ? '60%' : '30%', background: statusColor[m.status] }} />
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          </div>
        ))
      )}
    </div>
  )
}
