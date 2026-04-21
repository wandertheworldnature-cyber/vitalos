import { Navigate, useLocation } from 'react-router-dom'
import { useAuthStore } from '@/store/authStore'

export default function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuthStore()
  const location = useLocation()

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="w-10 h-10 border-2 rounded-full animate-spin mx-auto mb-3"
            style={{ borderColor: '#0f6e56', borderTopColor: 'transparent' }} />
          <p className="text-sm text-gray-500">Loading VitalOS...</p>
        </div>
      </div>
    )
  }

  if (!user) {
    // Preserve the intended destination so we can redirect back after login
    return <Navigate to="/login" state={{ from: location }} replace />
  }

  return <>{children}</>
}
