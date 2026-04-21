import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { Toaster } from 'react-hot-toast'
import { useEffect, useRef } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/store/authStore'

import AppLayout from '@/components/AppLayout'
import ProtectedRoute from '@/components/ProtectedRoute'
import AuthPage from '@/pages/AuthPage'
import OnboardingPage from '@/pages/OnboardingPage'
import Dashboard from '@/pages/Dashboard'
import InsightsPage from '@/pages/InsightsPage'
import TrendsPage from '@/pages/TrendsPage'
import DoctorsPage from '@/pages/DoctorsPage'
import FamilyPage from '@/pages/FamilyPage'
import HealthDataPage from '@/pages/HealthDataPage'
import ReportsPage from '@/pages/ReportsPage'
import SubscriptionPage from '@/pages/SubscriptionPage'
import ConsultationRoom from '@/pages/ConsultationRoom'
import AdminLayout from '@/pages/admin/AdminLayout'
import AdminOverview from '@/pages/admin/AdminOverview'
import AdminUsers from '@/pages/admin/AdminUsers'
import AdminDoctors from '@/pages/admin/AdminDoctors'
import AdminAppointments from '@/pages/admin/AdminAppointments'
import AdminProducts from '@/pages/admin/AdminProducts'
import AdminAnnouncements from '@/pages/admin/AdminAnnouncements'
import AdminAnalytics from '@/pages/admin/AdminAnalytics'

export default function App() {
  const { setUser, fetchProfile } = useAuthStore()
  const bootDone = useRef(false)

  useEffect(() => {
    const timeout = setTimeout(() => {
      if (!bootDone.current) { bootDone.current = true; setUser(null) }
    }, 6000)

    supabase.auth.getSession().then(({ data: { session } }) => {
      bootDone.current = true
      clearTimeout(timeout)
      if (session?.user) fetchProfile(session.user.id)
      else setUser(null)
    }).catch(() => { bootDone.current = true; clearTimeout(timeout); setUser(null) })

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_OUT') setUser(null)
      else if (event === 'TOKEN_REFRESHED' && session?.user) fetchProfile(session.user.id)
    })

    return () => { subscription.unsubscribe(); clearTimeout(timeout) }
  }, [])

  return (
    <BrowserRouter>
      <Toaster position="top-right" toastOptions={{
        style: { fontSize: '13px', borderRadius: '10px', border: '0.5px solid #e5e7eb', boxShadow: '0 4px 12px rgba(0,0,0,0.08)' },
      }} />
      <Routes>
        <Route path="/login"  element={<AuthPage />} />
        <Route path="/signup" element={<AuthPage />} />
        <Route path="/onboarding" element={<ProtectedRoute><OnboardingPage /></ProtectedRoute>} />

        {/* Consultation room — full screen, outside AppLayout */}
        <Route path="/consultation/:roomId" element={<ProtectedRoute><ConsultationRoom /></ProtectedRoute>} />

        <Route element={<ProtectedRoute><AppLayout /></ProtectedRoute>}>
          <Route path="/dashboard"    element={<Dashboard />} />
          <Route path="/health-data"  element={<HealthDataPage />} />
          <Route path="/insights"     element={<InsightsPage />} />
          <Route path="/trends"       element={<TrendsPage />} />
          <Route path="/doctors"      element={<DoctorsPage />} />
          <Route path="/family"       element={<FamilyPage />} />
          <Route path="/reports"      element={<ReportsPage />} />
          <Route path="/subscription" element={<SubscriptionPage />} />
        </Route>

        <Route path="/admin" element={<AdminLayout />}>
          <Route index                    element={<AdminOverview />} />
          <Route path="users"             element={<AdminUsers />} />
          <Route path="doctors"           element={<AdminDoctors />} />
          <Route path="appointments"      element={<AdminAppointments />} />
          <Route path="products"          element={<AdminProducts />} />
          <Route path="announcements"     element={<AdminAnnouncements />} />
          <Route path="analytics"         element={<AdminAnalytics />} />
        </Route>

        <Route path="/"   element={<Navigate to="/dashboard" replace />} />
        <Route path="*"   element={<Navigate to="/dashboard" replace />} />
      </Routes>
    </BrowserRouter>
  )
}
