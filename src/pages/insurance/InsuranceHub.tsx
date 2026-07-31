import { useState, useEffect } from 'react'
import { useAuthStore } from '@/store/authStore'
import { supabase } from '@/lib/supabase'
import { Shield, FileText, Upload, Plus, Check, X, Calendar, AlertCircle, ChevronRight, Building } from 'lucide-react'
import toast from 'react-hot-toast'

interface Policy {
  id: string
  provider: string
  policy_number: string
  policy_type: string
  sum_insured: number
  premium: number
  start_date: string
  end_date: string
  status: 'active' | 'expired' | 'expiring_soon'
}

interface Claim {
  id: string
  policy_id: string
  claim_number: string
  amount: number
  status: 'submitted' | 'processing' | 'approved' | 'rejected'
  hospital: string
  date_of_service: string
  description: string
}

const INSURERS = ['Star Health', 'HDFC Ergo', 'ICICI Lombard', 'Niva Bupa', 'Care Health', 'Aditya Birla', 'Tata AIG', 'Other']
const POLICY_TYPES = ['Individual Health', 'Family Floater', 'Critical Illness', 'Senior Citizen', 'Group/Corporate', 'Top-up']

export default function InsuranceHub() {
  const { user } = useAuthStore()
  const [policies, setPolicies] = useState<Policy[]>([])
  const [claims, setClaims] = useState<Claim[]>([])
  const [tab, setTab] = useState<'policies' | 'claims' | 'add-policy' | 'file-claim'>('policies')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  const [policyForm, setPolicyForm] = useState({
    provider: '', policy_number: '', policy_type: 'Individual Health',
    sum_insured: '', premium: '', start_date: '', end_date: '',
  })
  const [claimForm, setClaimForm] = useState({
    policy_id: '', claim_number: '', amount: '', hospital: '', date_of_service: '', description: '',
  })

  useEffect(() => { if (user) load() }, [user])

  async function load() {
    if (!user) return
    setLoading(true)
    const [pol, cla] = await Promise.all([
      supabase.from('insurance_policies').select('*').eq('user_id', user.id).order('created_at', { ascending: false }),
      supabase.from('insurance_claims').select('*').eq('user_id', user.id).order('created_at', { ascending: false }),
    ])
    const today = new Date()
    setPolicies((pol.data || []).map((p: Record<string,unknown>) => {
      const endDate = new Date(p.end_date as string)
      const daysLeft = Math.floor((endDate.getTime() - today.getTime()) / 86400000)
      const status: Policy['status'] = daysLeft < 0 ? 'expired' : daysLeft < 30 ? 'expiring_soon' : 'active'
      return { ...p, status } as Policy
    }))
    setClaims((cla.data || []) as Claim[])
    setLoading(false)
  }

  async function savePolicy() {
    if (!user) return
    if (!policyForm.provider || !policyForm.policy_number || !policyForm.start_date || !policyForm.end_date) {
      toast.error('Fill all required fields'); return
    }
    setSaving(true)
    try {
      const { error } = await supabase.from('insurance_policies').insert({
        user_id: user.id, provider: policyForm.provider, policy_number: policyForm.policy_number,
        policy_type: policyForm.policy_type,
        sum_insured: parseFloat(policyForm.sum_insured) || 0,
        premium: parseFloat(policyForm.premium) || 0,
        start_date: policyForm.start_date, end_date: policyForm.end_date,
      })
      if (error) throw error
      toast.success('Policy added!')
      setPolicyForm({ provider: '', policy_number: '', policy_type: 'Individual Health', sum_insured: '', premium: '', start_date: '', end_date: '' })
      setTab('policies'); load()
    } catch (e) { console.error(e); toast.error('Failed to add policy — check insurance_policies table exists') }
    finally { setSaving(false) }
  }

  async function fileClaim() {
    if (!user) return
    if (!claimForm.policy_id || !claimForm.amount || !claimForm.hospital) { toast.error('Fill required fields'); return }
    setSaving(true)
    try {
      const { error } = await supabase.from('insurance_claims').insert({
        user_id: user.id, policy_id: claimForm.policy_id,
        claim_number: claimForm.claim_number || `CLM-${Date.now().toString().slice(-8)}`,
        amount: parseFloat(claimForm.amount), hospital: claimForm.hospital,
        date_of_service: claimForm.date_of_service || new Date().toISOString().split('T')[0],
        description: claimForm.description, status: 'submitted',
      })
      if (error) throw error
      toast.success('Claim filed! We\'ll track its status.')
      setClaimForm({ policy_id: '', claim_number: '', amount: '', hospital: '', date_of_service: '', description: '' })
      setTab('claims'); load()
    } catch (e) { console.error(e); toast.error('Failed to file claim — check insurance_claims table exists') }
    finally { setSaving(false) }
  }

  const STATUS_COLOR: Record<string, string> = {
    active: 'bg-emerald-100 text-emerald-700', expiring_soon: 'bg-amber-100 text-amber-700', expired: 'bg-red-100 text-red-700',
    submitted: 'bg-blue-100 text-blue-700', processing: 'bg-amber-100 text-amber-700', approved: 'bg-emerald-100 text-emerald-700', rejected: 'bg-red-100 text-red-700',
  }

  return (
    <div className="p-4 pb-8 max-w-2xl mx-auto space-y-4">
      <div className="card !p-5" style={{ background: 'linear-gradient(135deg,#0c1a2e,#1a2a3a)', borderColor: '#0ea5e9' }}>
        <div className="flex items-start gap-3">
          <div className="w-12 h-12 rounded-xl flex items-center justify-center shrink-0" style={{ background: 'rgba(14,165,233,0.15)' }}>
            <Shield size={24} className="text-sky-400" />
          </div>
          <div>
            <div className="flex items-center gap-2 mb-1">
              <h1 className="text-lg font-bold text-white">Insurance Hub</h1>
              <span className="text-[10px] bg-sky-900 text-sky-300 border border-sky-700 px-2 py-0.5 rounded-full font-bold">NEW</span>
            </div>
            <p className="text-sm text-sky-300">Store policies, track expiry, file claims, and manage documents — all in one place.</p>
          </div>
        </div>
        <div className="mt-4 grid grid-cols-3 gap-2">
          {[['Policies', policies.length], ['Active claims', claims.filter(c => c.status !== 'approved' && c.status !== 'rejected').length], ['Expiring soon', policies.filter(p => p.status === 'expiring_soon').length]].map(([l, v]) => (
            <div key={String(l)} className="bg-white/10 rounded-lg p-2 text-center">
              <div className="text-lg font-black text-white">{v}</div>
              <div className="text-[9px] text-sky-300">{l}</div>
            </div>
          ))}
        </div>
      </div>

      {policies.some(p => p.status === 'expiring_soon') && (
        <div className="card !p-4 bg-amber-50 border-amber-100">
          <p className="text-xs font-bold text-amber-700 mb-1 flex items-center gap-1.5"><AlertCircle size={12} />Policy renewal needed</p>
          <p className="text-xs text-amber-600">{policies.filter(p => p.status === 'expiring_soon').map(p => p.provider).join(', ')} expiring within 30 days.</p>
        </div>
      )}

      <div className="flex gap-1 bg-gray-100 rounded-xl p-1">
        {(['policies', 'claims'] as const).map(t => (
          <button key={t} onClick={() => setTab(t)}
            className={`flex-1 text-xs py-2 rounded-lg font-semibold capitalize ${tab === t ? 'bg-white shadow-sm text-gray-900' : 'text-gray-500'}`}>
            {t === 'policies' ? `🛡️ Policies (${policies.length})` : `📋 Claims (${claims.length})`}
          </button>
        ))}
      </div>

      {tab === 'policies' && (
        <>
          <button onClick={() => setTab('add-policy')}
            className="w-full py-3 rounded-xl border-2 border-dashed border-gray-200 text-gray-500 text-sm font-semibold flex items-center justify-center gap-2 hover:border-sky-300 hover:text-sky-600">
            <Plus size={16} /> Add insurance policy
          </button>
          {loading ? <div className="space-y-2">{[1,2].map(i => <div key={i} className="card h-24 animate-pulse bg-gray-50" />)}</div>
          : policies.length === 0 ? (
            <div className="card border-dashed border-2 text-center py-12">
              <Shield size={32} className="text-gray-200 mx-auto mb-3" />
              <p className="text-sm font-semibold text-gray-600 mb-1">No policies added yet</p>
              <p className="text-xs text-gray-400">Add your health insurance to track claims and renewals</p>
            </div>
          ) : (
            <div className="space-y-3">
              {policies.map(p => (
                <div key={p.id} className="card !p-4">
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex items-center gap-2.5">
                      <div className="w-10 h-10 rounded-xl bg-sky-50 flex items-center justify-center shrink-0">
                        <Building size={18} className="text-sky-600" />
                      </div>
                      <div>
                        <p className="text-sm font-bold text-gray-900">{p.provider}</p>
                        <p className="text-xs text-gray-400">{p.policy_type} · {p.policy_number}</p>
                      </div>
                    </div>
                    <span className={`text-[9px] px-1.5 py-0.5 rounded font-bold capitalize shrink-0 ${STATUS_COLOR[p.status]}`}>{p.status.replace('_',' ')}</span>
                  </div>
                  <div className="grid grid-cols-2 gap-2 mt-3">
                    <div className="bg-gray-50 rounded-lg p-2">
                      <p className="text-[10px] text-gray-400">Sum insured</p>
                      <p className="text-sm font-bold text-gray-800">₹{p.sum_insured?.toLocaleString('en-IN')}</p>
                    </div>
                    <div className="bg-gray-50 rounded-lg p-2">
                      <p className="text-[10px] text-gray-400">Valid till</p>
                      <p className="text-sm font-bold text-gray-800">{new Date(p.end_date).toLocaleDateString('en-IN', { day:'numeric', month:'short', year:'numeric' })}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {tab === 'add-policy' && (
        <div className="card !p-5 space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-sm font-bold text-gray-800">Add insurance policy</p>
            <button onClick={() => setTab('policies')}><X size={16} className="text-gray-400" /></button>
          </div>
          <select className="input text-sm" value={policyForm.provider} onChange={e => setPolicyForm(p => ({ ...p, provider: e.target.value }))}>
            <option value="">Select insurer</option>
            {INSURERS.map(i => <option key={i} value={i}>{i}</option>)}
          </select>
          <input className="input text-sm" placeholder="Policy number" value={policyForm.policy_number} onChange={e => setPolicyForm(p => ({ ...p, policy_number: e.target.value }))} />
          <select className="input text-sm" value={policyForm.policy_type} onChange={e => setPolicyForm(p => ({ ...p, policy_type: e.target.value }))}>
            {POLICY_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
          </select>
          <div className="grid grid-cols-2 gap-2">
            <input type="number" className="input text-sm" placeholder="Sum insured (₹)" value={policyForm.sum_insured} onChange={e => setPolicyForm(p => ({ ...p, sum_insured: e.target.value }))} />
            <input type="number" className="input text-sm" placeholder="Annual premium (₹)" value={policyForm.premium} onChange={e => setPolicyForm(p => ({ ...p, premium: e.target.value }))} />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div><label className="text-xs text-gray-500 mb-1 block">Start date</label>
              <input type="date" className="input text-sm" value={policyForm.start_date} onChange={e => setPolicyForm(p => ({ ...p, start_date: e.target.value }))} /></div>
            <div><label className="text-xs text-gray-500 mb-1 block">End date</label>
              <input type="date" className="input text-sm" value={policyForm.end_date} onChange={e => setPolicyForm(p => ({ ...p, end_date: e.target.value }))} /></div>
          </div>
          <button onClick={savePolicy} disabled={saving} className="btn-primary w-full py-2.5 flex items-center justify-center gap-2">
            <Check size={14} />{saving ? 'Saving...' : 'Save policy'}
          </button>
        </div>
      )}

      {tab === 'claims' && (
        <>
          {policies.length > 0 && (
            <button onClick={() => setTab('file-claim')}
              className="w-full py-3 rounded-xl border-2 border-dashed border-gray-200 text-gray-500 text-sm font-semibold flex items-center justify-center gap-2 hover:border-sky-300 hover:text-sky-600">
              <Plus size={16} /> File a new claim
            </button>
          )}
          {claims.length === 0 ? (
            <div className="card border-dashed border-2 text-center py-12">
              <FileText size={32} className="text-gray-200 mx-auto mb-3" />
              <p className="text-sm font-semibold text-gray-600 mb-1">No claims filed yet</p>
              <p className="text-xs text-gray-400">{policies.length === 0 ? 'Add a policy first' : 'File a claim to track its status here'}</p>
            </div>
          ) : (
            <div className="space-y-3">
              {claims.map(c => (
                <div key={c.id} className="card !p-4">
                  <div className="flex items-start justify-between mb-2">
                    <div>
                      <p className="text-sm font-bold text-gray-900">{c.hospital}</p>
                      <p className="text-xs text-gray-400">{c.claim_number} · {new Date(c.date_of_service).toLocaleDateString('en-IN')}</p>
                    </div>
                    <span className={`text-[9px] px-1.5 py-0.5 rounded font-bold capitalize shrink-0 ${STATUS_COLOR[c.status]}`}>{c.status}</span>
                  </div>
                  <p className="text-lg font-black text-sky-600">₹{c.amount?.toLocaleString('en-IN')}</p>
                  {c.description && <p className="text-xs text-gray-500 mt-1">{c.description}</p>}
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {tab === 'file-claim' && (
        <div className="card !p-5 space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-sm font-bold text-gray-800">File insurance claim</p>
            <button onClick={() => setTab('claims')}><X size={16} className="text-gray-400" /></button>
          </div>
          <select className="input text-sm" value={claimForm.policy_id} onChange={e => setClaimForm(p => ({ ...p, policy_id: e.target.value }))}>
            <option value="">Select policy</option>
            {policies.map(p => <option key={p.id} value={p.id}>{p.provider} — {p.policy_number}</option>)}
          </select>
          <input className="input text-sm" placeholder="Hospital / clinic name" value={claimForm.hospital} onChange={e => setClaimForm(p => ({ ...p, hospital: e.target.value }))} />
          <div className="grid grid-cols-2 gap-2">
            <input type="number" className="input text-sm" placeholder="Claim amount (₹)" value={claimForm.amount} onChange={e => setClaimForm(p => ({ ...p, amount: e.target.value }))} />
            <input type="date" className="input text-sm" value={claimForm.date_of_service} onChange={e => setClaimForm(p => ({ ...p, date_of_service: e.target.value }))} />
          </div>
          <textarea className="input text-sm h-16 resize-none" placeholder="Brief description of treatment..." value={claimForm.description} onChange={e => setClaimForm(p => ({ ...p, description: e.target.value }))} />
          <button onClick={fileClaim} disabled={saving} className="btn-primary w-full py-2.5 flex items-center justify-center gap-2">
            <Check size={14} />{saving ? 'Filing...' : 'File claim'}
          </button>
        </div>
      )}
    </div>
  )
}
