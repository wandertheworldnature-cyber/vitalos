import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { Plus, Edit2, Trash2, X, Check, ExternalLink } from 'lucide-react'
import toast from 'react-hot-toast'

interface Product {
  id: string
  name: string
  category: string
  brand: string
  description: string
  price: number
  affiliate_url: string
  image_url: string
  is_active: boolean
}

const EMPTY: Omit<Product, 'id'> = {
  name: '', category: 'wearable', brand: '', description: '',
  price: 0, affiliate_url: '', image_url: '', is_active: true,
}

const CATEGORIES = ['wearable', 'supplement', 'device', 'test_kit', 'other']

export default function AdminProducts() {
  const [products, setProducts] = useState<Product[]>([])
  const [showForm, setShowForm] = useState(false)
  const [editing, setEditing] = useState<Product | null>(null)
  const [form, setForm] = useState<Omit<Product, 'id'>>(EMPTY)
  const [saving, setSaving] = useState(false)

  useEffect(() => { loadProducts() }, [])

  async function loadProducts() {
    const { data } = await supabase.from('health_products').select('*').order('name')
    setProducts((data || []) as Product[])
  }

  function openAdd() { setForm(EMPTY); setEditing(null); setShowForm(true) }
  function openEdit(p: Product) { setForm({ ...p }); setEditing(p); setShowForm(true) }

  async function handleSave() {
    if (!form.name || !form.category) { toast.error('Name and category required'); return }
    setSaving(true)
    try {
      if (editing) {
        await supabase.from('health_products').update(form).eq('id', editing.id)
        toast.success('Product updated')
      } else {
        await supabase.from('health_products').insert(form)
        toast.success('Product added')
      }
      setShowForm(false)
      loadProducts()
    } catch { toast.error('Save failed') }
    finally { setSaving(false) }
  }

  async function handleDelete(id: string) {
    if (!confirm('Delete this product?')) return
    await supabase.from('health_products').delete().eq('id', id)
    toast.success('Product deleted')
    loadProducts()
  }

  const catColors: Record<string, string> = {
    wearable: 'bg-blue-900 text-blue-300',
    supplement: 'bg-green-900 text-green-300',
    device: 'bg-purple-900 text-purple-300',
    test_kit: 'bg-amber-900 text-amber-300',
    other: 'bg-gray-800 text-gray-300',
  }

  return (
    <div className="p-6 space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-white">Health products & devices</h1>
          <p className="text-sm text-gray-400">{products.length} products</p>
        </div>
        <button onClick={openAdd} className="flex items-center gap-2 bg-teal-600 hover:bg-teal-700 text-white text-sm px-4 py-2 rounded-lg">
          <Plus size={14} /> Add product
        </button>
      </div>

      <div className="grid grid-cols-2 gap-3">
        {products.map(p => (
          <div key={p.id} className="bg-gray-900 border border-gray-800 rounded-xl p-4">
            <div className="flex items-start justify-between mb-2">
              <div>
                <div className="flex items-center gap-2 mb-0.5">
                  <p className="text-sm font-medium text-white">{p.name}</p>
                  {!p.is_active && <span className="text-[10px] text-gray-500">(hidden)</span>}
                </div>
                <p className="text-xs text-gray-400">{p.brand}</p>
              </div>
              <span className={`text-[10px] px-2 py-0.5 rounded-full capitalize ${catColors[p.category]}`}>{p.category}</span>
            </div>
            <p className="text-xs text-gray-500 mb-3 line-clamp-2">{p.description}</p>
            <div className="flex items-center justify-between">
              <p className="text-sm font-semibold text-teal-400">₹{p.price.toLocaleString('en-IN')}</p>
              <div className="flex gap-2">
                {p.affiliate_url && (
                  <a href={p.affiliate_url} target="_blank" rel="noreferrer" className="p-1.5 text-gray-400 hover:text-teal-400 border border-gray-700 rounded">
                    <ExternalLink size={12} />
                  </a>
                )}
                <button onClick={() => openEdit(p)} className="p-1.5 text-gray-400 hover:text-blue-400 border border-gray-700 rounded">
                  <Edit2 size={12} />
                </button>
                <button onClick={() => handleDelete(p.id)} className="p-1.5 text-gray-400 hover:text-red-400 border border-gray-700 rounded">
                  <Trash2 size={12} />
                </button>
              </div>
            </div>
          </div>
        ))}
        {products.length === 0 && (
          <div className="col-span-2 bg-gray-900 border border-gray-800 rounded-xl p-8 text-center text-gray-500 text-sm">
            No products yet. Add wearables, supplements, or test kits.
          </div>
        )}
      </div>

      {showForm && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
          <div className="bg-gray-900 border border-gray-700 rounded-2xl p-6 w-full max-w-md max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-base font-semibold text-white">{editing ? 'Edit product' : 'Add product'}</h2>
              <button onClick={() => setShowForm(false)}><X size={18} className="text-gray-400" /></button>
            </div>
            <div className="space-y-3">
              {[
                { label: 'Product name', key: 'name', placeholder: 'Apple Watch Series 9' },
                { label: 'Brand', key: 'brand', placeholder: 'Apple' },
                { label: 'Description', key: 'description', placeholder: 'Heart rate, ECG, SpO2 monitoring...' },
                { label: 'Affiliate / Buy link', key: 'affiliate_url', placeholder: 'https://amzn.in/...' },
                { label: 'Image URL', key: 'image_url', placeholder: 'https://...' },
              ].map(f => (
                <div key={f.key}>
                  <label className="text-xs text-gray-400 mb-1 block">{f.label}</label>
                  <input className="w-full bg-gray-800 border border-gray-700 text-white text-sm rounded-lg px-3 py-2 focus:outline-none focus:border-teal-500"
                    value={(form as Record<string, unknown>)[f.key] as string}
                    onChange={e => setForm(p => ({ ...p, [f.key]: e.target.value }))}
                    placeholder={f.placeholder} />
                </div>
              ))}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-gray-400 mb-1 block">Category</label>
                  <select className="w-full bg-gray-800 border border-gray-700 text-white text-sm rounded-lg px-3 py-2"
                    value={form.category} onChange={e => setForm(p => ({ ...p, category: e.target.value }))}>
                    {CATEGORIES.map(c => <option key={c} value={c} className="capitalize">{c}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-xs text-gray-400 mb-1 block">Price (₹)</label>
                  <input type="number" className="w-full bg-gray-800 border border-gray-700 text-white text-sm rounded-lg px-3 py-2"
                    value={form.price} onChange={e => setForm(p => ({ ...p, price: +e.target.value }))} />
                </div>
              </div>
              <div className="flex items-center gap-2">
                <input type="checkbox" id="pactive" checked={form.is_active} onChange={e => setForm(p => ({ ...p, is_active: e.target.checked }))} className="accent-teal-500" />
                <label htmlFor="pactive" className="text-xs text-gray-400">Visible to users</label>
              </div>
            </div>
            <div className="flex gap-3 mt-5">
              <button onClick={handleSave} disabled={saving} className="flex-1 bg-teal-600 hover:bg-teal-700 text-white text-sm py-2.5 rounded-lg font-medium flex items-center justify-center gap-2 disabled:opacity-60">
                <Check size={14} /> {saving ? 'Saving...' : (editing ? 'Update' : 'Add product')}
              </button>
              <button onClick={() => setShowForm(false)} className="px-4 text-sm text-gray-400 border border-gray-700 rounded-lg hover:bg-gray-800">Cancel</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
