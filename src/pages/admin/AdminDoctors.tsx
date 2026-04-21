import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { Plus, Edit2, Trash2, X, Check } from 'lucide-react'
import toast from 'react-hot-toast'

interface Doctor {
  id: string; name: string; specialty: string; qualifications: string
  experience_years: number; rating: number; consultation_fee: number
  hospital: string; languages: string[]; bio: string; is_active: boolean
}

const EMPTY: Omit<Doctor, 'id'> = {
  name: '', specialty: '', qualifications: '', experience_years: 5,
  rating: 4.5, consultation_fee: 699, hospital: '', languages: ['English', 'Hindi'],
  bio: '', is_active: true,
}

// Comprehensive specialty list
const PRESET_SPECIALTIES = [
  'Preventive Medicine', 'General Physician', 'Internal Medicine',
  'Cardiologist', 'Interventional Cardiologist',
  'Endocrinologist', 'Diabetologist',
  'Neurologist', 'Neurosurgeon',
  'Orthopedic Surgeon', 'Spine Specialist',
  'Dermatologist', 'Cosmetologist',
  'Gynecologist & Obstetrician', 'Fertility Specialist',
  'Pediatrician', 'Neonatologist',
  'Psychiatrist', 'Psychologist',
  'Ophthalmologist', 'ENT Specialist',
  'Gastroenterologist', 'Hepatologist',
  'Pulmonologist', 'Chest Physician',
  'Nephrologist', 'Urologist',
  'Oncologist', 'Surgical Oncologist',
  'Rheumatologist', 'Immunologist',
  'Hematologist', 'Transfusion Medicine',
  'Nutritionist & Dietitian', 'Lifestyle Medicine',
  'Physiotherapist', 'Sports Medicine',
  'Dentist', 'Oral & Maxillofacial Surgeon',
  'Plastic Surgeon', 'Reconstructive Surgeon',
  'Anesthesiologist', 'Pain Management',
  'Emergency Medicine', 'Critical Care',
  'Ayurvedic Physician', 'Homeopathic Physician',
  'Other (specify below)',
]

export default function AdminDoctors() {
  const [doctors, setDoctors] = useState<Doctor[]>([])
  const [showForm, setShowForm] = useState(false)
  const [editing, setEditing] = useState<Doctor | null>(null)
  const [form, setForm] = useState<Omit<Doctor, 'id'>>(EMPTY)
  const [saving, setSaving] = useState(false)
  const [customSpecialty, setCustomSpecialty] = useState('')
  const [langInput, setLangInput] = useState('')

  useEffect(() => { loadDoctors() }, [])

  async function loadDoctors() {
    const { data } = await supabase.from('doctors').select('*').order('name')
    setDoctors((data || []) as Doctor[])
  }

  function openAdd() {
    setForm(EMPTY); setEditing(null)
    setCustomSpecialty(''); setLangInput('')
    setShowForm(true)
  }

  function openEdit(d: Doctor) {
    setForm({ ...d }); setEditing(d)
    setCustomSpecialty(PRESET_SPECIALTIES.includes(d.specialty) ? '' : d.specialty)
    setLangInput('')
    setShowForm(true)
  }

  function getEffectiveSpecialty() {
    if (form.specialty === 'Other (specify below)') return customSpecialty
    return form.specialty
  }

  async function handleSave() {
    const specialty = getEffectiveSpecialty()
    if (!form.name || !specialty) { toast.error('Name and specialty required'); return }
    setSaving(true)
    try {
      const payload = { ...form, specialty }
      if (editing) {
        const { error } = await supabase.from('doctors').update(payload).eq('id', editing.id)
        if (error) throw error
        toast.success('Doctor updated')
      } else {
        const { error } = await supabase.from('doctors').insert(payload)
        if (error) throw error
        toast.success('Doctor added')
      }
      setShowForm(false)
      loadDoctors()
    } catch (e: unknown) {
      toast.error('Save failed — ' + (e instanceof Error ? e.message : 'check console'))
    } finally { setSaving(false) }
  }

  async function handleDelete(id: string, name: string) {
    if (!confirm(`Delete ${name}?`)) return
    await supabase.from('doctors').delete().eq('id', id)
    toast.success('Doctor removed')
    loadDoctors()
  }

  async function toggleActive(d: Doctor) {
    await supabase.from('doctors').update({ is_active: !d.is_active }).eq('id', d.id)
    loadDoctors()
  }

  function addLanguage() {
    if (!langInput.trim()) return
    setForm(p => ({ ...p, languages: [...(p.languages || []), langInput.trim()] }))
    setLangInput('')
  }

  function removeLanguage(lang: string) {
    setForm(p => ({ ...p, languages: p.languages.filter(l => l !== lang) }))
  }

  return (
    <div className="p-6 space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-white">Doctors</h1>
          <p className="text-sm text-gray-400">{doctors.length} doctors registered</p>
        </div>
        <button onClick={openAdd}
          className="flex items-center gap-2 bg-teal-600 hover:bg-teal-700 text-white text-sm px-4 py-2 rounded-lg transition-colors">
          <Plus size={14} /> Add doctor
        </button>
      </div>

      <div className="space-y-3">
        {doctors.map(d => (
          <div key={d.id} className="bg-gray-900 border border-gray-800 rounded-xl p-4 flex items-start justify-between">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-full bg-teal-800 flex items-center justify-center text-teal-300 text-sm font-bold shrink-0">
                {d.name.split(' ').slice(-1)[0].slice(0, 2).toUpperCase()}
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <p className="text-sm font-medium text-white">{d.name}</p>
                  <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${d.is_active ? 'bg-green-900 text-green-400' : 'bg-gray-800 text-gray-500'}`}>
                    {d.is_active ? 'Active' : 'Hidden'}
                  </span>
                </div>
                <p className="text-xs text-gray-400">{d.specialty} · {d.hospital}</p>
                <p className="text-xs text-gray-500">{d.qualifications} · {d.experience_years} yrs · ⭐{d.rating} · ₹{d.consultation_fee}</p>
                <p className="text-[10px] text-gray-600 mt-0.5">{(d.languages || []).join(', ')}</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button onClick={() => toggleActive(d)}
                className="text-xs text-gray-400 hover:text-white px-2 py-1 rounded border border-gray-700 hover:border-gray-500">
                {d.is_active ? 'Hide' : 'Show'}
              </button>
              <button onClick={() => openEdit(d)}
                className="p-1.5 text-gray-400 hover:text-blue-400 rounded border border-gray-700 hover:border-blue-700">
                <Edit2 size={13} />
              </button>
              <button onClick={() => handleDelete(d.id, d.name)}
                className="p-1.5 text-gray-400 hover:text-red-400 rounded border border-gray-700 hover:border-red-700">
                <Trash2 size={13} />
              </button>
            </div>
          </div>
        ))}
        {doctors.length === 0 && (
          <div className="bg-gray-900 border border-gray-800 rounded-xl p-8 text-center text-gray-500 text-sm">
            No doctors yet. Click "Add doctor" to get started.
          </div>
        )}
      </div>

      {showForm && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4 overflow-y-auto">
          <div className="bg-gray-900 border border-gray-700 rounded-2xl p-6 w-full max-w-lg my-4">
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-base font-semibold text-white">{editing ? 'Edit doctor' : 'Add doctor'}</h2>
              <button onClick={() => setShowForm(false)}><X size={18} className="text-gray-400" /></button>
            </div>

            <div className="space-y-3 max-h-[70vh] overflow-y-auto pr-1">
              {/* Full name */}
              <div>
                <label className="text-xs text-gray-400 mb-1 block">Full name *</label>
                <input className="w-full bg-gray-800 border border-gray-700 text-white text-sm rounded-lg px-3 py-2 focus:outline-none focus:border-teal-500"
                  value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))}
                  placeholder="Dr. Priya Sharma" />
              </div>

              {/* Specialty */}
              <div>
                <label className="text-xs text-gray-400 mb-1 block">Specialty *</label>
                <select className="w-full bg-gray-800 border border-gray-700 text-white text-sm rounded-lg px-3 py-2 focus:outline-none focus:border-teal-500"
                  value={form.specialty} onChange={e => setForm(p => ({ ...p, specialty: e.target.value }))}>
                  <option value="">Select specialty...</option>
                  {PRESET_SPECIALTIES.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>

              {/* Custom specialty input when "Other" is selected */}
              {form.specialty === 'Other (specify below)' && (
                <div>
                  <label className="text-xs text-gray-400 mb-1 block">Enter custom specialty *</label>
                  <input className="w-full bg-gray-800 border border-teal-600 text-white text-sm rounded-lg px-3 py-2 focus:outline-none focus:border-teal-500"
                    value={customSpecialty}
                    onChange={e => setCustomSpecialty(e.target.value)}
                    placeholder="e.g. Functional Medicine, Integrative Oncology..." />
                </div>
              )}

              {/* Qualifications */}
              <div>
                <label className="text-xs text-gray-400 mb-1 block">Qualifications</label>
                <input className="w-full bg-gray-800 border border-gray-700 text-white text-sm rounded-lg px-3 py-2 focus:outline-none focus:border-teal-500"
                  value={form.qualifications}
                  onChange={e => setForm(p => ({ ...p, qualifications: e.target.value }))}
                  placeholder="MBBS, MD (Preventive Medicine), DNB" />
              </div>

              {/* Hospital */}
              <div>
                <label className="text-xs text-gray-400 mb-1 block">Hospital / Clinic</label>
                <input className="w-full bg-gray-800 border border-gray-700 text-white text-sm rounded-lg px-3 py-2 focus:outline-none focus:border-teal-500"
                  value={form.hospital}
                  onChange={e => setForm(p => ({ ...p, hospital: e.target.value }))}
                  placeholder="Apollo Hospitals, Chennai" />
              </div>

              {/* Bio */}
              <div>
                <label className="text-xs text-gray-400 mb-1 block">Bio</label>
                <textarea className="w-full bg-gray-800 border border-gray-700 text-white text-sm rounded-lg px-3 py-2 h-16 resize-none focus:outline-none focus:border-teal-500"
                  value={form.bio}
                  onChange={e => setForm(p => ({ ...p, bio: e.target.value }))}
                  placeholder="Brief description of expertise and experience..." />
              </div>

              {/* Numbers row */}
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="text-xs text-gray-400 mb-1 block">Exp (years)</label>
                  <input type="number" className="w-full bg-gray-800 border border-gray-700 text-white text-sm rounded-lg px-3 py-2"
                    value={form.experience_years}
                    onChange={e => setForm(p => ({ ...p, experience_years: +e.target.value }))} />
                </div>
                <div>
                  <label className="text-xs text-gray-400 mb-1 block">Rating (1-5)</label>
                  <input type="number" step="0.1" min="1" max="5" className="w-full bg-gray-800 border border-gray-700 text-white text-sm rounded-lg px-3 py-2"
                    value={form.rating}
                    onChange={e => setForm(p => ({ ...p, rating: +e.target.value }))} />
                </div>
                <div>
                  <label className="text-xs text-gray-400 mb-1 block">Fee (₹)</label>
                  <input type="number" className="w-full bg-gray-800 border border-gray-700 text-white text-sm rounded-lg px-3 py-2"
                    value={form.consultation_fee}
                    onChange={e => setForm(p => ({ ...p, consultation_fee: +e.target.value }))} />
                </div>
              </div>

              {/* Languages */}
              <div>
                <label className="text-xs text-gray-400 mb-1 block">Languages spoken</label>
                <div className="flex gap-2 mb-2">
                  <input className="flex-1 bg-gray-800 border border-gray-700 text-white text-sm rounded-lg px-3 py-2"
                    value={langInput} onChange={e => setLangInput(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && addLanguage()}
                    placeholder="Add language (press Enter)" />
                  <button onClick={addLanguage} className="bg-teal-700 text-white text-xs px-3 rounded-lg">Add</button>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {(form.languages || []).map(l => (
                    <span key={l} className="flex items-center gap-1 bg-gray-700 text-gray-300 text-xs px-2 py-0.5 rounded-full">
                      {l}
                      <button onClick={() => removeLanguage(l)} className="text-gray-500 hover:text-red-400">×</button>
                    </span>
                  ))}
                </div>
              </div>

              <div className="flex items-center gap-2">
                <input type="checkbox" id="active" checked={form.is_active}
                  onChange={e => setForm(p => ({ ...p, is_active: e.target.checked }))}
                  className="accent-teal-500" />
                <label htmlFor="active" className="text-xs text-gray-400">Visible to users in doctor listing</label>
              </div>
            </div>

            <div className="flex gap-3 mt-5 pt-4 border-t border-gray-800">
              <button onClick={handleSave} disabled={saving}
                className="flex-1 bg-teal-600 hover:bg-teal-700 text-white text-sm py-2.5 rounded-lg font-medium flex items-center justify-center gap-2 disabled:opacity-60">
                <Check size={14} /> {saving ? 'Saving...' : (editing ? 'Update doctor' : 'Add doctor')}
              </button>
              <button onClick={() => setShowForm(false)}
                className="px-4 text-sm text-gray-400 border border-gray-700 rounded-lg hover:bg-gray-800">
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
