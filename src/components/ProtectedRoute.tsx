import { Navigate } from 'react-router-dom'
import { useAuthStore } from '@/store/authStore'

export default function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuthStore()

  // While checking auth, show nothing (prevents flash redirect)
  if (loading) {
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
