import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/store/authStore'
import { Eye, EyeOff, Heart } from 'lucide-react'
import toast from 'react-hot-toast'

export default function AuthPage() {
  const navigate = useNavigate()
  const { fetchProfile, user } = useAuthStore()
  const [isLogin, setIsLogin] = useState(true)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [name, setName] = useState('')
  const [loading, setLoading] = useState(false)
  const [showPass, setShowPass] = useState(false)

  useEffect(() => {
    if (user) navigate('/dashboard', { replace: true })
  }, [user, navigate])

  async function handleAuth(e: React.FormEvent) {
    e.preventDefault()
    if (!email.trim() || !password.trim()) { toast.error('Please enter email and password'); return }
    if (password.length < 8) { toast.error('Password must be at least 8 characters'); return }
    setLoading(true)
    try {
      if (isLogin) {
        const { data, error } = await supabase.auth.signInWithPassword({
          email: email.trim().toLowerCase(), password,
        })
        if (error) {
          if (error.message.includes('Invalid login credentials')) toast.error('Wrong email or password. Try again.')
          else if (error.message.includes('Email not confirmed')) toast.error('Please confirm your email first.')
          else toast.error(error.message)
          setLoading(false); return
        }
        if (data.user) {
          await fetchProfile(data.user.id)
          toast.success('Welcome back!')
          navigate('/dashboard', { replace: true })
        }
      } else {
        if (!name.trim()) { toast.error('Please enter your full name'); setLoading(false); return }
        const { data, error } = await supabase.auth.signUp({
          email: email.trim().toLowerCase(), password,
          options: { data: { full_name: name.trim() } }
        })
        if (error) { toast.error(error.message); setLoading(false); return }
        if (data.user) {
          await supabase.from('profiles').upsert({
            id: data.user.id, email: email.trim().toLowerCase(),
            full_name: name.trim(), plan: 'basic',
          })
          if (data.session) {
            await fetchProfile(data.user.id)
            toast.success('Account created! Welcome to VitalOS!')
            navigate('/onboarding', { replace: true })
          } else {
            toast.success('Check your email to confirm your account.')
            setIsLogin(true)
          }
        }
      }
    } catch (err) {
      toast.error('Something went wrong. Try again.')
    } finally { setLoading(false) }
  }

  function switchMode() {
    setIsLogin(l => !l)
    setEmail(''); setPassword(''); setName('')
  }

  return (
    <div className="min-h-screen flex" style={{ background:'#f0fdf8' }}>
      {/* Left — branding */}
      <div className="hidden md:flex flex-1 flex-col justify-between p-12"
        style={{ background:'linear-gradient(135deg,#0f6e56 0%,#0a5a46 60%,#063d2f 100%)' }}>
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl flex items-center justify-center bg-white/20">
            <Heart size={20} className="text-white" fill="white"/>
          </div>
          <span className="text-xl font-bold text-white">VitalOS</span>
        </div>
        <div>
          <h1 className="text-4xl font-black text-white leading-tight mb-4">
            Your personal<br/>health operating<br/>system
          </h1>
          <p className="text-emerald-200 text-lg mb-8">
            Detect diseases before they start. AI-powered insights, longevity tracking, and preventive care — built for India.
          </p>
          <div className="space-y-3">
            {[
              'AI analysis of lab reports in seconds',
              'Early warning system for diabetes, heart disease',
              'Whole-family health monitoring',
              'Doctor consultations built-in',
            ].map(f => (
              <div key={f} className="flex items-center gap-3 text-emerald-100">
                <div className="w-5 h-5 rounded-full border-2 border-emerald-400 flex items-center justify-center shrink-0">
                  <div className="w-2 h-2 bg-emerald-400 rounded-full"/>
                </div>
                <span className="text-sm font-medium">{f}</span>
              </div>
            ))}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 bg-emerald-400 rounded-full animate-pulse"/>
          <span className="text-emerald-300 text-sm">India's preventive health platform</span>
        </div>
      </div>

      {/* Right — form */}
      <div className="flex-1 flex items-center justify-center p-6 md:p-12">
        <div className="w-full max-w-sm">
          {/* Mobile logo */}
          <div className="flex items-center gap-2 mb-8 md:hidden">
            <div className="w-9 h-9 rounded-xl flex items-center justify-center"
              style={{ background:'linear-gradient(135deg,#0f6e56,#1d9e75)' }}>
              <Heart size={16} className="text-white" fill="white"/>
            </div>
            <span className="text-lg font-bold text-gray-900">VitalOS</span>
          </div>

          <h2 className="text-2xl font-black text-gray-900 mb-1">
            {isLogin ? 'Welcome back' : 'Create account'}
          </h2>
          <p className="text-sm text-gray-500 mb-6">
            {isLogin ? 'Sign in to your health dashboard' : 'Start your health journey today'}
          </p>

          <form onSubmit={handleAuth} className="space-y-4">
            {!isLogin && (
              <div>
                <label className="text-xs font-semibold text-gray-600 mb-1.5 block">Full name</label>
                <input type="text" className="input" placeholder="Enter your full name"
                  value={name} onChange={e => setName(e.target.value)} required autoFocus/>
              </div>
            )}
            <div>
              <label className="text-xs font-semibold text-gray-600 mb-1.5 block">Email address</label>
              <input type="email" className="input" placeholder="Enter your email"
                value={email} onChange={e => setEmail(e.target.value)} required
                autoComplete="email" autoFocus={isLogin}/>
            </div>
            <div>
              <label className="text-xs font-semibold text-gray-600 mb-1.5 block">Password</label>
              <div className="relative">
                <input type={showPass ? 'text' : 'password'} className="input pr-10"
                  placeholder="Enter your password (min 8 characters)"
                  value={password} onChange={e => setPassword(e.target.value)} required
                  autoComplete={isLogin ? 'current-password' : 'new-password'}/>
                <button type="button" onClick={() => setShowPass(s => !s)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                  {showPass ? <EyeOff size={16}/> : <Eye size={16}/>}
                </button>
              </div>
            </div>

            <button type="submit" disabled={loading}
              className="btn-primary w-full py-3 text-base font-bold mt-2 flex items-center justify-center gap-2">
              {loading ? (
                <><div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"/>
                {isLogin ? 'Signing in...' : 'Creating account...'}</>
              ) : (
                isLogin ? 'Sign in' : 'Create account'
              )}
            </button>
          </form>

          <p className="text-sm text-center text-gray-500 mt-4">
            {isLogin ? "Don't have an account? " : "Already have an account? "}
            <button onClick={switchMode} className="text-teal-600 font-bold hover:underline">
              {isLogin ? 'Sign up free' : 'Sign in'}
            </button>
          </p>

          <p className="text-xs text-center text-gray-400 mt-6 leading-relaxed">
            Your health data is encrypted and never sold.<br/>Compliant with India's DPDP Act.
          </p>
        </div>
      </div>
    </div>
  )
}
