import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { Plus, Trash2, X, Check, Bell } from 'lucide-react'
import toast from 'react-hot-toast'

interface Ann {
  id: string
  title: string
  message: string
  type: string
  target_plan: string
  is_active: boolean
  expires_at: string | null
}

const EMPTY = { title: '', message: '', type: 'info', target_plan: 'all', is_active: true, expires_at: '' }
const typeColors: Record<string, string> = {
  info: 'bg-blue-900 text-blue-300', warning: 'bg-amber-900 text-amber-300',
  success: 'bg-green-900 text-green-300', promo: 'bg-purple-900 text-purple-300',
}

export default function AdminAnnouncements() {
  const [anns, setAnns] = useState<Ann[]>([])
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState(EMPTY)
  const [saving, setSaving] = useState(false)

  useEffect(() => { load() }, [])
  async function load() {
    const { data } = await supabase.from('announcements').select('*').order('created_at', { ascending: false })
    setAnns((data || []) as Ann[])
  }

  async function handleSave() {
    if (!form.title || !form.message) { toast.error('Title and message required'); return }
    setSaving(true)
    try {
      await supabase.from('announcements').insert({ ...form, expires_at: form.expires_at || null })
      toast.success('Announcement created')
      setShowForm(false)
      setForm(EMPTY)
      load()
    } catch { toast.error('Failed to create') }
    finally { setSaving(false) }
  }

  async function toggleActive(id: string, current: boolean) {
    await supabase.from('announcements').update({ is_active: !current }).eq('id', id)
    load()
  }

  async function del(id: string) {
    if (!confirm('Delete this announcement?')) return
    await supabase.from('announcements').delete().eq('id', id)
    load()
  }

  return (
    <div className="p-6 space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-white">Announcements</h1>
          <p className="text-sm text-gray-400">Banners and notifications shown in the app</p>
        </div>
        <button onClick={() => setShowForm(true)} className="flex items-center gap-2 bg-teal-600 hover:bg-teal-700 text-white text-sm px-4 py-2 rounded-lg">
          <Plus size={14} /> New announcement
        </button>
      </div>

      <div className="space-y-3">
        {anns.map(a => (
          <div key={a.id} className="bg-gray-900 border border-gray-800 rounded-xl p-4 flex items-start justify-between">
            <div className="flex gap-3">
              <Bell size={16} className="text-gray-400 mt-0.5 shrink-0" />
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <p className="text-sm font-medium text-white">{a.title}</p>
                  <span className={`text-[10px] px-2 py-0.5 rounded capitalize ${typeColors[a.type]}`}>{a.type}</span>
                  <span className="text-[10px] text-gray-500">→ {a.target_plan} users</span>
                  {!a.is_active && <span className="text-[10px] text-gray-600">(hidden)</span>}
                </div>
                <p className="text-xs text-gray-400">{a.message}</p>
                {a.expires_at && <p className="text-[10px] text-gray-500 mt-1">Expires: {new Date(a.expires_at).toLocaleDateString('en-IN')}</p>}
              </div>
            </div>
            <div className="flex gap-2 shrink-0">
              <button onClick={() => toggleActive(a.id, a.is_active)}
                className="text-xs text-gray-400 hover:text-white border border-gray-700 rounded px-2 py-1">
                {a.is_active ? 'Hide' : 'Show'}
              </button>
              <button onClick={() => del(a.id)} className="p-1.5 text-gray-400 hover:text-red-400 border border-gray-700 rounded">
                <Trash2 size={12} />
              </button>
            </div>
          </div>
        ))}
        {anns.length === 0 && (
          <div className="bg-gray-900 border border-gray-800 rounded-xl p-8 text-center text-gray-500 text-sm">
            No announcements yet
          </div>
        )}
      </div>

      {showForm && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
          <div className="bg-gray-900 border border-gray-700 rounded-2xl p-6 w-full max-w-md">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-base font-semibold text-white">New announcement</h2>
              <button onClick={() => setShowForm(false)}><X size={18} className="text-gray-400" /></button>
            </div>
            <div className="space-y-3">
              <div>
                <label className="text-xs text-gray-400 mb-1 block">Title</label>
                <input className="w-full bg-gray-800 border border-gray-700 text-white text-sm rounded-lg px-3 py-2 focus:outline-none focus:border-teal-500"
                  value={form.title} onChange={e => setForm(p => ({ ...p, title: e.target.value }))} placeholder="New feature available!" />
              </div>
              <div>
                <label className="text-xs text-gray-400 mb-1 block">Message</label>
                <textarea className="w-full bg-gray-800 border border-gray-700 text-white text-sm rounded-lg px-3 py-2 h-20 resize-none focus:outline-none focus:border-teal-500"
                  value={form.message} onChange={e => setForm(p => ({ ...p, message: e.target.value }))} placeholder="Describe the announcement..." />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-gray-400 mb-1 block">Type</label>
                  <select className="w-full bg-gray-800 border border-gray-700 text-white text-sm rounded-lg px-3 py-2"
                    value={form.type} onChange={e => setForm(p => ({ ...p, type: e.target.value }))}>
                    {['info','warning','success','promo'].map(t => <option key={t} value={t} className="capitalize">{t}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-xs text-gray-400 mb-1 block">Target users</label>
                  <select className="w-full bg-gray-800 border border-gray-700 text-white text-sm rounded-lg px-3 py-2"
                    value={form.target_plan} onChange={e => setForm(p => ({ ...p, target_plan: e.target.value }))}>
                    {['all','basic','pro','premium'].map(t => <option key={t} value={t} className="capitalize">{t}</option>)}
                  </select>
                </div>
              </div>
              <div>
                <label className="text-xs text-gray-400 mb-1 block">Expires on (optional)</label>
                <input type="date" className="w-full bg-gray-800 border border-gray-700 text-white text-sm rounded-lg px-3 py-2"
                  value={form.expires_at} onChange={e => setForm(p => ({ ...p, expires_at: e.target.value }))} />
              </div>
            </div>
            <div className="flex gap-3 mt-5">
              <button onClick={handleSave} disabled={saving} className="flex-1 bg-teal-600 hover:bg-teal-700 text-white text-sm py-2.5 rounded-lg font-medium flex items-center justify-center gap-2">
                <Check size={14} /> {saving ? 'Publishing...' : 'Publish'}
              </button>
              <button onClick={() => setShowForm(false)} className="px-4 text-sm text-gray-400 border border-gray-700 rounded-lg hover:bg-gray-800">Cancel</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
