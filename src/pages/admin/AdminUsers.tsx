import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { Search, Shield, Mail, Calendar, Activity } from 'lucide-react'
import toast from 'react-hot-toast'

interface UserRow {
  id: string
  email: string
  full_name: string
  plan: string
  created_at: string
  phone?: string
  gender?: string
  date_of_birth?: string
}

interface UserStats {
  reports: number
  records: number
  appointments: number
}

export default function AdminUsers() {
  const [users, setUsers] = useState<UserRow[]>([])
  const [stats, setStats] = useState<Record<string, UserStats>>({})
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)
  const [selected, setSelected] = useState<UserRow | null>(null)

  useEffect(() => { loadUsers() }, [])

  async function loadUsers() {
    setLoading(true)
    // Use service role via RLS bypass — fetch all profiles
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(500)

    if (error) {
      console.error('Load users error:', error)
      toast.error('Could not load users — check RLS policies')
      setLoading(false)
      return
    }

    const rows = (data || []) as UserRow[]
    setUsers(rows)

    // Load stats for each user in parallel
    const statsMap: Record<string, UserStats> = {}
    await Promise.all(rows.map(async u => {
      const [reports, records, appts] = await Promise.all([
        supabase.from('health_reports').select('id', { count: 'exact', head: true }).eq('user_id', u.id),
        supabase.from('health_records').select('id', { count: 'exact', head: true }).eq('user_id', u.id),
        supabase.from('appointments').select('id', { count: 'exact', head: true }).eq('user_id', u.id),
      ])
      statsMap[u.id] = {
        reports: reports.count || 0,
        records: records.count || 0,
        appointments: appts.count || 0,
      }
    }))
    setStats(statsMap)
    setLoading(false)
  }

  async function changePlan(id: string, plan: string) {
    const { error } = await supabase.from('profiles').update({ plan }).eq('id', id)
    if (error) { toast.error('Update failed — check RLS'); return }
    toast.success(`Plan updated to ${plan}`)
    setUsers(prev => prev.map(u => u.id === id ? { ...u, plan } : u))
    if (selected?.id === id) setSelected(prev => prev ? { ...prev, plan } : null)
  }

  async function makeAdmin(id: string, email: string) {
    if (!confirm(`Make ${email} an admin?`)) return
    const { error } = await supabase.from('admin_users').upsert({ id, email, role: 'admin' })
    if (error) toast.error('Failed — make sure admin_users table exists')
    else toast.success(`${email} is now an admin`)
  }

  const filtered = users.filter(u =>
    !search ||
    u.email?.toLowerCase().includes(search.toLowerCase()) ||
    u.full_name?.toLowerCase().includes(search.toLowerCase())
  )

  const planStyle: Record<string, string> = {
    basic:   'bg-gray-700 text-gray-200',
    pro:     'bg-blue-900 text-blue-200',
    premium: 'bg-amber-900 text-amber-200',
  }

  return (
    <div className="p-6 space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-white">Users</h1>
          <p className="text-sm text-gray-400">{users.length} total registered users</p>
        </div>
        <div className="flex items-center gap-3">
          <button onClick={loadUsers} className="text-xs text-gray-400 hover:text-white border border-gray-700 rounded-lg px-3 py-1.5">
            Refresh
          </button>
          <div className="relative">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
            <input className="bg-gray-800 border border-gray-700 text-white text-sm rounded-lg pl-8 pr-3 py-2 w-56 focus:outline-none focus:border-teal-500"
              placeholder="Search by name or email..."
              value={search} onChange={e => setSearch(e.target.value)} />
          </div>
        </div>
      </div>

      {/* Admin RLS note */}
      {users.length === 0 && !loading && (
        <div className="bg-amber-900/30 border border-amber-700 rounded-xl p-4">
          <p className="text-xs font-bold text-amber-300 mb-1">⚠️ No users showing — RLS fix needed</p>
          <p className="text-xs text-amber-400 mb-2">Run this SQL in Supabase to let admins see all users:</p>
          <pre className="text-xs text-amber-200 bg-black/30 rounded p-2 overflow-x-auto">
{`create policy "Admins view all profiles" on profiles
  for select using (
    auth.uid() in (select id from admin_users)
  );`}
          </pre>
        </div>
      )}

      <div className="grid grid-cols-3 gap-3 mb-2">
        {[
          { label: 'Total users', value: users.length, color: 'text-blue-400' },
          { label: 'Paid (Pro/Premium)', value: users.filter(u => u.plan !== 'basic').length, color: 'text-teal-400' },
          { label: 'Today', value: users.filter(u => u.created_at?.startsWith(new Date().toISOString().split('T')[0])).length, color: 'text-green-400' },
        ].map(c => (
          <div key={c.label} className="bg-gray-900 border border-gray-800 rounded-xl p-3 text-center">
            <p className={`text-2xl font-bold ${c.color}`}>{c.value}</p>
            <p className="text-xs text-gray-500 mt-0.5">{c.label}</p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-5 gap-5">
        {/* User list */}
        <div className="col-span-3 bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
          {loading ? (
            <div className="p-8 text-center text-gray-500 text-sm">Loading users...</div>
          ) : (
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-800">
                  {['User', 'Plan', 'Joined', 'Activity'].map(h => (
                    <th key={h} className="text-left text-xs text-gray-500 font-medium px-4 py-3">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map(u => (
                  <tr key={u.id}
                    onClick={() => setSelected(u)}
                    className={`border-b border-gray-800 last:border-0 cursor-pointer transition-colors ${
                      selected?.id === u.id ? 'bg-teal-900/20' : 'hover:bg-gray-800/50'
                    }`}>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <div className="w-7 h-7 rounded-full bg-teal-800 flex items-center justify-center text-[10px] font-bold text-teal-300 shrink-0">
                          {(u.full_name || u.email || '?').slice(0, 2).toUpperCase()}
                        </div>
                        <div>
                          <p className="text-xs font-medium text-white">{u.full_name || '—'}</p>
                          <p className="text-[10px] text-gray-400 truncate max-w-[160px]">{u.email}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <select value={u.plan || 'basic'}
                        onChange={e => { e.stopPropagation(); changePlan(u.id, e.target.value) }}
                        onClick={e => e.stopPropagation()}
                        className={`text-[10px] px-2 py-1 rounded font-medium border-0 cursor-pointer ${planStyle[u.plan] || planStyle.basic}`}>
                        <option value="basic">Basic</option>
                        <option value="pro">Pro</option>
                        <option value="premium">Premium</option>
                      </select>
                    </td>
                    <td className="px-4 py-3 text-[10px] text-gray-400">
                      {u.created_at ? new Date(u.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: '2-digit' }) : '—'}
                    </td>
                    <td className="px-4 py-3">
                      <div className="text-[10px] text-gray-500 space-y-0.5">
                        <div>{stats[u.id]?.reports ?? '…'} reports</div>
                        <div>{stats[u.id]?.records ?? '…'} records</div>
                      </div>
                    </td>
                  </tr>
                ))}
                {filtered.length === 0 && !loading && (
                  <tr><td colSpan={4} className="text-center py-8 text-gray-500 text-sm">
                    {users.length === 0 ? 'No users yet — check RLS policy above' : 'No users match search'}
                  </td></tr>
                )}
              </tbody>
            </table>
          )}
        </div>

        {/* User detail panel */}
        <div className="col-span-2 bg-gray-900 border border-gray-800 rounded-xl p-5">
          {!selected ? (
            <div className="flex flex-col items-center justify-center h-full text-gray-600 text-sm py-12">
              <Activity size={28} className="mb-2 opacity-40" />
              <p>Click a user to view details</p>
            </div>
          ) : (
            <div>
              <div className="flex items-center gap-3 mb-4 pb-4 border-b border-gray-800">
                <div className="w-12 h-12 rounded-full bg-teal-800 flex items-center justify-center text-teal-300 font-bold">
                  {(selected.full_name || selected.email).slice(0, 2).toUpperCase()}
                </div>
                <div>
                  <p className="text-sm font-semibold text-white">{selected.full_name || 'No name'}</p>
                  <p className="text-xs text-gray-400">{selected.email}</p>
                  <span className={`text-[10px] px-2 py-0.5 rounded mt-1 inline-block font-medium capitalize ${planStyle[selected.plan] || planStyle.basic}`}>
                    {selected.plan} plan
                  </span>
                </div>
              </div>

              <div className="space-y-3 text-xs">
                {[
                  { icon: Calendar, label: 'Joined', val: selected.created_at ? new Date(selected.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' }) : '—' },
                  { icon: Mail, label: 'Email', val: selected.email },
                  { icon: Activity, label: 'Gender', val: selected.gender || 'Not set' },
                  { icon: Activity, label: 'DOB', val: selected.date_of_birth || 'Not set' },
                  { icon: Activity, label: 'Phone', val: selected.phone || 'Not set' },
                ].map(f => (
                  <div key={f.label} className="flex items-center gap-2">
                    <f.icon size={12} className="text-gray-500 shrink-0" />
                    <span className="text-gray-500 w-14 shrink-0">{f.label}</span>
                    <span className="text-gray-200">{f.val}</span>
                  </div>
                ))}
              </div>

              <div className="grid grid-cols-3 gap-2 mt-4">
                {[
                  { label: 'Reports', val: stats[selected.id]?.reports ?? '…' },
                  { label: 'Records', val: stats[selected.id]?.records ?? '…' },
                  { label: 'Appts', val: stats[selected.id]?.appointments ?? '…' },
                ].map(s => (
                  <div key={s.label} className="bg-gray-800 rounded-lg p-2 text-center">
                    <p className="text-base font-bold text-teal-400">{s.val}</p>
                    <p className="text-[10px] text-gray-500">{s.label}</p>
                  </div>
                ))}
              </div>

              <div className="flex gap-2 mt-4">
                <select value={selected.plan}
                  onChange={e => changePlan(selected.id, e.target.value)}
                  className="flex-1 bg-gray-800 border border-gray-700 text-white text-xs rounded-lg px-2 py-1.5">
                  <option value="basic">Basic</option>
                  <option value="pro">Pro</option>
                  <option value="premium">Premium</option>
                </select>
                <button onClick={() => makeAdmin(selected.id, selected.email)}
                  className="flex items-center gap-1 text-xs text-amber-400 border border-amber-800 rounded-lg px-3 py-1.5 hover:bg-amber-900/30">
                  <Shield size={11} /> Admin
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* SQL helper */}
      <details className="bg-gray-900 border border-gray-800 rounded-xl p-4">
        <summary className="text-xs text-gray-500 cursor-pointer hover:text-gray-300">
          Admin RLS policy SQL (run if users not showing)
        </summary>
        <pre className="text-xs text-gray-400 bg-black/30 rounded p-3 mt-3 overflow-x-auto whitespace-pre-wrap">
{`-- Run in Supabase SQL Editor:
drop policy if exists "Admins view all profiles" on profiles;
create policy "Admins view all profiles" on profiles
  for select using (
    auth.uid() in (select id from admin_users)
    OR auth.uid() = id
  );`}
        </pre>
      </details>
    </div>
  )
}
