import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '@/lib/supabase'
import { Heart, Mail, Lock, Eye, EyeOff, Stethoscope } from 'lucide-react'
import toast from 'react-hot-toast'

export default function DoctorLoginPage() {
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPass, setShowPass] = useState(false)
  const [loading, setLoading] = useState(false)
  const [mode, setMode] = useState<'login'|'forgot'>('login')
  const [resetSent, setResetSent] = useState(false)

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault()
    if (!email || !password) { toast.error('Enter email and password'); return }
    setLoading(true)
    try {
      // First check if this email exists as a doctor_email in doctors table
      const { data: doctorData } = await supabase
        .from('doctors')
        .select('id, name, specialty, is_active')
        .eq('doctor_email', email.trim().toLowerCase())
        .single()

      if (!doctorData) {
        toast.error('No doctor account found with this email. Contact your admin.')
        setLoading(false)
        return
      }

      if (!doctorData.is_active) {
        toast.error('Your doctor account is inactive. Contact admin.')
        setLoading(false)
        return
      }

      // Sign in with Supabase auth
      const { error } = await supabase.auth.signInWithPassword({
        email: email.trim().toLowerCase(),
        password,
      })

      if (error) {
        if (error.message.includes('Invalid login credentials')) {
          toast.error('Wrong password. Use "Forgot password" to reset.')
        } else {
          toast.error(error.message)
        }
        setLoading(false)
        return
      }

      toast.success(`Welcome, Dr. ${doctorData.name}!`)
      navigate('/doctor')
    } catch {
      toast.error('Login failed. Try again.')
    } finally {
      setLoading(false)
    }
  }

  async function handleForgotPassword(e: React.FormEvent) {
    e.preventDefault()
    if (!email) { toast.error('Enter your email'); return }
    setLoading(true)
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/doctor`,
    })
    if (error) toast.error(error.message)
    else { setResetSent(true); toast.success('Password reset link sent!') }
    setLoading(false)
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4"
      style={{ background: 'linear-gradient(135deg,#f0fdf8 0%,#ecfdf5 50%,#d1fae5 100%)' }}>
      <div className="w-full max-w-sm">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-lg"
            style={{ background: 'linear-gradient(135deg,#0f6e56,#1d9e75)' }}>
            <Stethoscope size={28} className="text-white"/>
          </div>
          <h1 className="text-2xl font-black text-gray-900">VitalOS</h1>
          <p className="text-sm text-teal-600 font-semibold mt-1">Doctor Portal</p>
        </div>

        <div className="card !p-6">
          {mode === 'login' ? (
            <>
              <h2 className="text-lg font-bold text-gray-900 mb-1">Doctor sign in</h2>
              <p className="text-xs text-gray-400 mb-5">Use the email registered by your admin</p>

              <form onSubmit={handleLogin} className="space-y-4">
                <div>
                  <label className="text-xs font-medium text-gray-600 mb-1.5 block">Email address</label>
                  <div className="relative">
                    <Mail size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"/>
                    <input type="email" className="input pl-9" placeholder="doctor@hospital.com"
                      value={email} onChange={e => setEmail(e.target.value)} required/>
                  </div>
                </div>

                <div>
                  <label className="text-xs font-medium text-gray-600 mb-1.5 block">Password</label>
                  <div className="relative">
                    <Lock size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"/>
                    <input type={showPass ? 'text' : 'password'} className="input pl-9 pr-10"
                      placeholder="Your password" value={password}
                      onChange={e => setPassword(e.target.value)} required/>
                    <button type="button" onClick={() => setShowPass(s => !s)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                      {showPass ? <EyeOff size={15}/> : <Eye size={15}/>}
                    </button>
                  </div>
                </div>

                <button type="submit" disabled={loading} className="btn-primary w-full py-3 text-sm">
                  {loading ? 'Signing in...' : 'Sign in to Doctor Portal'}
                </button>
              </form>

              <button onClick={() => setMode('forgot')}
                className="w-full text-center text-xs text-teal-600 hover:text-teal-800 mt-4 font-medium">
                Forgot password?
              </button>

              <div className="mt-5 pt-4 border-t border-gray-100">
                <p className="text-[11px] text-gray-400 text-center leading-relaxed">
                  Don't have an account? Ask your VitalOS admin to register your email in the Doctors section.
                </p>
              </div>
            </>
          ) : (
            <>
              <h2 className="text-lg font-bold text-gray-900 mb-1">Reset password</h2>
              <p className="text-xs text-gray-400 mb-5">We'll send a reset link to your email</p>

              {resetSent ? (
                <div className="text-center py-4">
                  <div className="text-4xl mb-3">📧</div>
                  <p className="text-sm font-semibold text-gray-800 mb-2">Check your email!</p>
                  <p className="text-xs text-gray-400 mb-4">Password reset link sent to {email}</p>
                  <button onClick={() => { setMode('login'); setResetSent(false) }} className="btn-primary text-xs py-2 px-4">
                    Back to login
                  </button>
                </div>
              ) : (
                <form onSubmit={handleForgotPassword} className="space-y-4">
                  <div>
                    <label className="text-xs font-medium text-gray-600 mb-1.5 block">Email address</label>
                    <div className="relative">
                      <Mail size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"/>
                      <input type="email" className="input pl-9" placeholder="doctor@hospital.com"
                        value={email} onChange={e => setEmail(e.target.value)} required/>
                    </div>
                  </div>
                  <button type="submit" disabled={loading} className="btn-primary w-full py-3 text-sm">
                    {loading ? 'Sending...' : 'Send reset link'}
                  </button>
                  <button type="button" onClick={() => setMode('login')}
                    className="w-full text-center text-xs text-gray-500 hover:text-gray-700 font-medium">
                    ← Back to login
                  </button>
                </form>
              )}
            </>
          )}
        </div>

        <p className="text-center text-[11px] text-gray-400 mt-4">
          <a href="/dashboard" className="text-teal-600 hover:underline">← Go to patient app</a>
        </p>
      </div>
    </div>
  )
}
