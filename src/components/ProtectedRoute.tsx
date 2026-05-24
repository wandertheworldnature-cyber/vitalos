import { Navigate } from 'react-router-dom'
import { useAuthStore } from '@/store/authStore'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'

export default function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, loading, fetchProfile, setUser } = useAuthStore()
  const [checking, setChecking] = useState(!user) // skip check if already have user

  useEffect(() => {
    // If we already have user from localStorage, don't show spinner
    if (user) { setChecking(false); return }

    // Otherwise check Supabase session
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user) {
        fetchProfile(session.user.id).finally(() => setChecking(false))
      } else {
        setUser(null)
        setChecking(false)
      }
    }).catch(() => { setUser(null); setChecking(false) })
  }, [])

  if (checking) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="flex flex-col items-center gap-3">
          <div className="w-10 h-10 border-2 border-t-transparent border-teal-500 rounded-full animate-spin"/>
          <p className="text-sm text-gray-400">Loading VitalOS...</p>
        </div>
      </div>
    )
  }

  if (!user) return <Navigate to="/login" replace/>
  return <>{children}</>
}
