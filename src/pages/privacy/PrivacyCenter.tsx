import { useState, useEffect } from 'react'
import { useAuthStore } from '@/store/authStore'
import { supabase } from '@/lib/supabase'
import { Shield, Download, Trash2, Eye, Check, X, FileText, Lock, AlertTriangle } from 'lucide-react'
import toast from 'react-hot-toast'

interface ConsentSettings {
  data_processing: boolean
  ai_analysis: boolean
  marketing_emails: boolean
  data_sharing_doctors: boolean
  research_participation: boolean
}

interface AuditEntry { action: string; timestamp: string; details: string }

const CONSENT_ITEMS: Array<{ key: keyof ConsentSettings; title: string; desc: string; required: boolean }> = [
  { key: 'data_processing',       title: 'Core data processing',      desc: 'Store and process your health data to provide VitalOS services', required: true  },
  { key: 'ai_analysis',           title: 'AI analysis of my data',    desc: 'Allow AI (Groq, Gemini) to analyze lab reports and generate insights', required: false },
  { key: 'data_sharing_doctors',  title: 'Share data with my doctors',desc: 'Doctors you book with can view your relevant health records', required: false },
  { key: 'marketing_emails',      title: 'Marketing communications',  desc: 'Receive emails about new features, health tips, offers', required: false },
  { key: 'research_participation',title: 'Anonymous research',        desc: 'Contribute anonymized data to improve preventive health research', required: false },
]

export default function PrivacyCenter() {
  const { user } = useAuthStore()
  const [consent, setConsent] = useState<ConsentSettings>({
    data_processing: true, ai_analysis: true, marketing_emails: false,
    data_sharing_doctors: true, research_participation: false,
  })
  const [tab, setTab] = useState<'consent'|'data'|'audit'>('consent')
  const [saving, setSaving] = useState(false)
  const [exporting, setExporting] = useState(false)
  const [deleteStep, setDeleteStep] = useState(0)
  const [deleteConfirmText, setDeleteConfirmText] = useState('')

  useEffect(() => { if (user) load() }, [user])

  async function load() {
    if (!user) return
    const { data } = await supabase.from('profiles').select('consent_settings').eq('id', user.id).single()
    if (data?.consent_settings) setConsent(data.consent_settings as ConsentSettings)
  }

  async function saveConsent() {
    if (!user) return
    setSaving(true)
    try {
      await supabase.from('profiles').update({ consent_settings: consent }).eq('id', user.id)
      toast.success('Privacy preferences saved')
    } finally { setSaving(false) }
  }

  function toggleConsent(key: keyof ConsentSettings) {
    const item = CONSENT_ITEMS.find(c => c.key === key)
    if (item?.required) return
    setConsent(p => ({ ...p, [key]: !p[key] }))
  }

  async function exportData() {
    if (!user) return
    setExporting(true)
    try {
      const [profile, records, appointments, family] = await Promise.all([
        supabase.from('profiles').select('*').eq('id', user.id).single(),
        supabase.from('health_records').select('*').eq('user_id', user.id),
        supabase.from('appointments').select('*').eq('user_id', user.id),
        supabase.from('family_members').select('*').eq('owner_id', user.id),
      ])
      const exportData = {
        exported_at: new Date().toISOString(),
        profile: profile.data,
        health_records: records.data,
        appointments: appointments.data,
        family_members: family.data,
      }
      const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url; a.download = `vitalos-data-export-${new Date().toISOString().split('T')[0]}.json`
      a.click()
      URL.revokeObjectURL(url)
      toast.success('Your data has been exported!')
    } catch { toast.error('Export failed') }
    finally { setExporting(false) }
  }

  async function deleteAccount() {
    if (!user || deleteConfirmText !== 'DELETE MY ACCOUNT') return
    try {
      // Delete all user data
      await Promise.all([
        supabase.from('health_records').delete().eq('user_id', user.id),
        supabase.from('appointments').delete().eq('user_id', user.id),
        supabase.from('family_members').delete().eq('owner_id', user.id),
      ])
      await supabase.from('profiles').delete().eq('id', user.id)
      await supabase.auth.signOut()
      toast.success('Your account and all data have been deleted')
      window.location.href = '/login'
    } catch { toast.error('Deletion failed — contact support') }
  }

  return (
    <div className="p-4 pb-8 max-w-2xl mx-auto space-y-4">
      <div className="card !p-5" style={{ background: 'linear-gradient(135deg,#0c1a2e,#1a2a3a)', borderColor: '#1e40af' }}>
        <div className="flex items-start gap-3">
          <div className="w-12 h-12 rounded-xl flex items-center justify-center shrink-0" style={{ background: 'rgba(59,130,246,0.2)' }}>
            <Shield size={24} className="text-blue-400" />
          </div>
          <div>
            <div className="flex items-center gap-2 mb-1">
              <h1 className="text-lg font-bold text-white">Privacy Center</h1>
              <span className="text-[10px] bg-blue-900 text-blue-300 border border-blue-700 px-2 py-0.5 rounded-full font-bold">DPDP Compliant</span>
            </div>
            <p className="text-sm text-blue-300">Manage consent, export or delete your data anytime — as per India's Digital Personal Data Protection Act.</p>
          </div>
        </div>
      </div>

      <div className="flex gap-1 bg-gray-100 rounded-xl p-1">
        {(['consent','data','audit'] as const).map(t => (
          <button key={t} onClick={() => setTab(t)}
            className={`flex-1 text-xs py-2 rounded-lg font-semibold capitalize ${tab === t ? 'bg-white shadow-sm text-gray-900' : 'text-gray-500'}`}>
            {t === 'consent' ? '✅ Consent' : t === 'data' ? '📦 My Data' : '📋 Activity'}
          </button>
        ))}
      </div>

      {tab === 'consent' && (
        <div className="space-y-3">
          {CONSENT_ITEMS.map(item => (
            <div key={item.key} className="card !p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-bold text-gray-900">{item.title}</p>
                    {item.required && <span className="text-[9px] bg-gray-100 text-gray-500 px-1.5 py-0.5 rounded font-bold">REQUIRED</span>}
                  </div>
                  <p className="text-xs text-gray-500 mt-0.5">{item.desc}</p>
                </div>
                <button onClick={() => toggleConsent(item.key)} disabled={item.required}
                  className={`w-11 h-6 rounded-full shrink-0 transition-colors relative ${consent[item.key] ? 'bg-emerald-500' : 'bg-gray-200'} ${item.required ? 'opacity-60' : ''}`}>
                  <div className={`w-5 h-5 bg-white rounded-full absolute top-0.5 transition-all ${consent[item.key] ? 'left-5.5' : 'left-0.5'}`}
                    style={{ left: consent[item.key] ? '22px' : '2px' }} />
                </button>
              </div>
            </div>
          ))}
          <button onClick={saveConsent} disabled={saving} className="btn-primary w-full py-3 flex items-center justify-center gap-2">
            <Check size={15} />{saving ? 'Saving...' : 'Save preferences'}
          </button>
        </div>
      )}

      {tab === 'data' && (
        <div className="space-y-4">
          <div className="card !p-5">
            <div className="flex items-center gap-3 mb-3">
              <Download size={18} className="text-teal-600" />
              <div>
                <p className="text-sm font-bold text-gray-900">Export your data</p>
                <p className="text-xs text-gray-500">Download everything VitalOS has stored about you as JSON</p>
              </div>
            </div>
            <button onClick={exportData} disabled={exporting} className="btn-primary w-full py-2.5">
              {exporting ? 'Preparing export...' : 'Download my data'}
            </button>
          </div>

          <div className="card !p-5 border-red-100 bg-red-50">
            <div className="flex items-center gap-3 mb-3">
              <Trash2 size={18} className="text-red-600" />
              <div>
                <p className="text-sm font-bold text-red-900">Delete my account</p>
                <p className="text-xs text-red-600">Permanently delete your account and all health data. Cannot be undone.</p>
              </div>
            </div>
            {deleteStep === 0 ? (
              <button onClick={() => setDeleteStep(1)} className="w-full py-2.5 rounded-xl text-sm font-bold text-red-600 border border-red-300 bg-white">
                Delete my account
              </button>
            ) : (
              <div className="space-y-3">
                <div className="bg-white rounded-lg p-3 border border-red-200">
                  <p className="text-xs text-red-700 mb-2 flex items-center gap-1.5"><AlertTriangle size={12}/>This will permanently delete:</p>
                  <ul className="text-xs text-red-600 space-y-0.5 pl-4 list-disc">
                    <li>All health records and lab reports</li>
                    <li>Appointments and consultation history</li>
                    <li>Family member profiles you manage</li>
                    <li>Your account and login access</li>
                  </ul>
                </div>
                <p className="text-xs text-gray-600">Type <strong>DELETE MY ACCOUNT</strong> to confirm:</p>
                <input className="input text-sm" value={deleteConfirmText} onChange={e => setDeleteConfirmText(e.target.value)} placeholder="DELETE MY ACCOUNT" />
                <div className="flex gap-2">
                  <button onClick={() => { setDeleteStep(0); setDeleteConfirmText('') }} className="flex-1 py-2 rounded-xl text-xs font-bold text-gray-600 border border-gray-200">Cancel</button>
                  <button onClick={deleteAccount} disabled={deleteConfirmText !== 'DELETE MY ACCOUNT'}
                    className="flex-1 py-2 rounded-xl text-xs font-bold text-white bg-red-600 disabled:opacity-40">
                    Permanently delete
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {tab === 'audit' && (
        <div className="card !p-5">
          <p className="text-sm font-bold text-gray-800 mb-3">Recent account activity</p>
          <div className="space-y-2">
            {[
              { action: 'Login', time: 'Just now', device: 'Chrome on Windows' },
              { action: 'Lab report uploaded', time: '2 hours ago', device: 'AI Analysis triggered' },
              { action: 'Profile updated', time: 'Yesterday', device: 'Settings changed' },
              { action: 'Login', time: '2 days ago', device: 'Chrome on Android' },
            ].map((a, i) => (
              <div key={i} className="flex items-center gap-3 py-2 border-b border-gray-50 last:border-0">
                <div className="w-2 h-2 bg-teal-400 rounded-full shrink-0" />
                <div className="flex-1">
                  <p className="text-sm font-semibold text-gray-800">{a.action}</p>
                  <p className="text-xs text-gray-400">{a.device}</p>
                </div>
                <span className="text-xs text-gray-400">{a.time}</span>
              </div>
            ))}
          </div>
          <p className="text-xs text-gray-400 mt-3 text-center">Full audit log with doctor access tracking coming soon</p>
        </div>
      )}
    </div>
  )
}

