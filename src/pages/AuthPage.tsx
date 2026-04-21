import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Heart, AlertCircle, CheckCircle } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/store/authStore'
import type { User } from '@/types'
import toast from 'react-hot-toast'

const FEATURES = [
  'AI analysis of lab reports in seconds',
  'Early warning system for diabetes, heart disease',
  'Whole-family health monitoring',
  'Doctor consultations built-in',
]

export default function AuthPage() {
  const navigate = useNavigate()
  const { setUser } = useAuthStore()
  const [mode, setMode] = useState<'login' | 'signup'>('login')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [awaitingConfirm, setAwaitingConfirm] = useState(false)
  const [form, setForm] = useState({ email: '', password: '', fullName: '' })

  // ── Shared: upsert profile and set in store ─────────────────────
  async function finalizeAuth(userId: string, email: string, fullName: string) {
    // Upsert profile row
    const { data: profile } = await supabase
      .from('profiles')
      .upsert({ id: userId, email, full_name: fullName, plan: 'basic' }, { onConflict: 'id' })
      .select().single()

    // Set user in store so ProtectedRoute immediately allows navigation
    setUser((profile || { id: userId, email, full_name: fullName, plan: 'basic', created_at: new Date().toISOString() }) as User)
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setLoading(true)

    try {
      if (mode === 'login') {
        // ── LOGIN ────────────────────────────────────────────────
        const { data, error: err } = await supabase.auth.signInWithPassword({
          email: form.email.trim(),
          password: form.password,
        })
        if (err) throw err
        if (!data.user) throw new Error('Login failed — no user returned')

        const fullName = (data.user.user_metadata?.full_name as string) || form.email.split('@')[0]
        await finalizeAuth(data.user.id, data.user.email!, fullName)

        // Check if admin
        const { data: adminRow } = await supabase
          .from('admin_users').select('id').eq('id', data.user.id).single()

        navigate(adminRow ? '/admin' : '/dashboard', { replace: true })

      } else {
        // ── SIGN UP ──────────────────────────────────────────────
        const { data, error: err } = await supabase.auth.signUp({
          email: form.email.trim(),
          password: form.password,
          options: { data: { full_name: form.fullName.trim() } },
        })
        if (err) throw err

        if (data.session && data.user) {
          // Email confirm is OFF → session exists immediately
          await finalizeAuth(data.user.id, data.user.email!, form.fullName.trim() || form.email.split('@')[0])
          toast.success('Account created! Setting up your health profile...')
          navigate('/onboarding', { replace: true })
        } else {
          // Email confirm is ON → show instructions
          setAwaitingConfirm(true)
        }
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Something went wrong'
      if (msg.toLowerCase().includes('email not confirmed')) {
        setError('EMAIL_NOT_CONFIRMED')
      } else if (msg.toLowerCase().includes('invalid login') || msg.toLowerCase().includes('invalid credentials')) {
        setError('Wrong email or password.')
      } else if (msg.toLowerCase().includes('already registered')) {
        setError('Email already registered — try signing in.')
      } else {
        setError(msg)
      }
    } finally {
      setLoading(false)
    }
  }

  // Awaiting email confirmation screen
  if (awaitingConfirm) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-8 max-w-md w-full text-center">
          <div className="w-14 h-14 bg-teal-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <CheckCircle size={28} className="text-teal-500" />
          </div>
          <h2 className="text-xl font-semibold text-gray-900 mb-2">Check your email</h2>
          <p className="text-gray-500 text-sm mb-6">
            Confirmation sent to <span className="font-semibold text-gray-800">{form.email}</span>
          </p>
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-left mb-5">
            <p className="text-xs font-bold text-amber-800 mb-1.5">⚡ Skip confirmation for dev/testing:</p>
            <ol className="text-xs text-amber-700 space-y-1 list-decimal list-inside">
              <li>Supabase Dashboard → Authentication → Providers</li>
              <li>Email → turn <strong>OFF</strong> "Confirm email"</li>
              <li>Come back and sign up again — goes straight to onboarding</li>
            </ol>
          </div>
          <button
            onClick={() => { setAwaitingConfirm(false); setMode('login') }}
            className="w-full py-2.5 text-white rounded-xl font-semibold text-sm"
            style={{ background: '#0f6e56' }}
          >
            Back to sign in
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex">
      {/* Left panel */}
      <div className="hidden lg:flex w-1/2 flex-col justify-between p-12"
        style={{ background: 'linear-gradient(135deg, #0f6e56 0%, #063d30 100%)' }}>
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl flex items-center justify-center border border-white/30"
            style={{ background: 'rgba(255,255,255,0.15)' }}>
            <Heart size={18} className="text-white" />
          </div>
          <span className="text-xl font-bold text-white tracking-wide">VitalOS</span>
        </div>
        <div>
          <h1 className="text-4xl font-bold text-white leading-tight mb-5">
            Your personal<br />health operating<br />system
          </h1>
          <p className="text-base leading-relaxed mb-8" style={{ color: '#86efcb' }}>
            Detect diseases before they start. AI-powered insights,
            longevity tracking, and preventive care — built for India.
          </p>
          <div className="space-y-3">
            {FEATURES.map(f => (
              <div key={f} className="flex items-center gap-3">
                <div className="w-5 h-5 rounded-full flex items-center justify-center shrink-0"
                  style={{ background: 'rgba(255,255,255,0.2)', border: '1px solid rgba(255,255,255,0.35)' }}>
                  <Heart size={9} className="text-white" />
                </div>
                <span className="text-sm font-semibold text-white">{f}</span>
              </div>
            ))}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-green-400" />
          <span className="text-xs font-semibold" style={{ color: '#6ee7b7' }}>
            Trusted by 10,000+ families across India
          </span>
        </div>
      </div>

      {/* Right panel */}
      <div className="flex-1 flex items-center justify-center p-8 bg-gray-50">
        <div className="w-full max-w-md">
          <div className="lg:hidden flex items-center gap-2 mb-8">
            <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: '#0f6e56' }}>
              <Heart size={16} className="text-white" />
            </div>
            <span className="text-lg font-bold text-gray-900">VitalOS</span>
          </div>

          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-8">
            <h2 className="text-2xl font-bold text-gray-900 mb-1">
              {mode === 'login' ? 'Welcome back' : 'Create account'}
            </h2>
            <p className="text-gray-400 text-sm mb-6">
              {mode === 'login' ? 'Sign in to your health dashboard' : 'Start your health journey — free'}
            </p>

            {/* Email not confirmed */}
            {error === 'EMAIL_NOT_CONFIRMED' && (
              <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 mb-4">
                <div className="flex items-start gap-2">
                  <AlertCircle size={15} className="text-amber-600 mt-0.5 shrink-0" />
                  <div>
                    <p className="text-xs font-bold text-amber-800 mb-1">Email not confirmed yet</p>
                    <ol className="text-xs text-amber-700 space-y-0.5 list-decimal list-inside">
                      <li>Supabase Dashboard → Authentication → Providers</li>
                      <li>Email → turn <strong>OFF</strong> "Confirm email"</li>
                      <li>Try signing in again</li>
                    </ol>
                  </div>
                </div>
              </div>
            )}

            {/* Generic error */}
            {error && error !== 'EMAIL_NOT_CONFIRMED' && (
              <div className="bg-red-50 border border-red-100 rounded-lg px-3 py-2.5 mb-4 flex items-center gap-2">
                <AlertCircle size={14} className="text-red-500 shrink-0" />
                <p className="text-xs text-red-700">{error}</p>
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              {mode === 'signup' && (
                <div>
                  <label className="text-xs font-semibold text-gray-600 mb-1.5 block">Full name</label>
                  <input type="text" className="input" placeholder="Ravi Kumar"
                    value={form.fullName} onChange={e => setForm(f => ({ ...f, fullName: e.target.value }))} required />
                </div>
              )}
              <div>
                <label className="text-xs font-semibold text-gray-600 mb-1.5 block">Email address</label>
                <input type="email" className="input" placeholder="ravi@example.com"
                  value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} required />
              </div>
              <div>
                <label className="text-xs font-semibold text-gray-600 mb-1.5 block">Password</label>
                <input type="password" className="input" placeholder="Min 8 characters"
                  value={form.password} onChange={e => setForm(f => ({ ...f, password: e.target.value }))}
                  required minLength={8} />
              </div>
              <button type="submit" disabled={loading}
                className="w-full py-3 text-white rounded-xl font-bold text-sm transition-all disabled:opacity-60"
                style={{ background: '#0f6e56' }}>
                {loading
                  ? (mode === 'login' ? 'Signing in...' : 'Creating account...')
                  : (mode === 'login' ? 'Sign in' : 'Create free account')}
              </button>
            </form>

            <p className="text-center text-sm text-gray-400 mt-5">
              {mode === 'login' ? "Don't have an account? " : 'Already have an account? '}
              <button onClick={() => { setMode(m => m === 'login' ? 'signup' : 'login'); setError('') }}
                className="font-bold hover:underline" style={{ color: '#0f6e56' }}>
                {mode === 'login' ? 'Sign up free' : 'Sign in'}
              </button>
            </p>
          </div>

          <p className="text-xs text-gray-400 text-center mt-4 px-4">
            Your health data is encrypted and never sold. Compliant with India's DPDP Act.
          </p>
        </div>
      </div>
    </div>
  )
}
