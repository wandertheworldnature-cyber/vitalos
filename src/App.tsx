import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { Toaster } from 'react-hot-toast'
import { useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/store/authStore'
import AppLayout from '@/components/AppLayout'
import ProtectedRoute from '@/components/ProtectedRoute'
import AuthPage from '@/pages/AuthPage'
import OnboardingPage from '@/pages/OnboardingPage'
import ConsultationRoom from '@/pages/ConsultationRoom'
import DoctorLoginPage from '@/pages/doctor/DoctorLoginPage'
import Dashboard from '@/pages/Dashboard'
import LongevityPage from '@/pages/LongevityPage'
import HabitsPage from '@/pages/HabitsPage'
import HealthTimeline from '@/pages/HealthTimeline'
import InsightsPage from '@/pages/InsightsPage'
import TrendsPage from '@/pages/TrendsPage'
import DoctorsPage from '@/pages/DoctorsPage'
import FamilyPage from '@/pages/FamilyPage'
import HealthDataPage from '@/pages/HealthDataPage'
import ReportsPage from '@/pages/ReportsPage'
import SubscriptionPage from '@/pages/SubscriptionPage'
import ProfilePage from '@/pages/ProfilePage'
import WearableSyncPage from '@/pages/WearableSyncPage'
import DigitalHealthRecords from '@/pages/health/DigitalHealthRecords'
import EmergencyCard from '@/pages/health/EmergencyCard'
import MentalHealthOS from '@/pages/mental/MentalHealthOS'
import BiomarkerAnalytics from '@/pages/health/BiomarkerAnalytics'
import AIHealthCopilot from '@/pages/ai/AIHealthCopilot'
import FitnessEcosystem from '@/pages/fitness/FitnessEcosystem'
import CorrelationEngine from '@/pages/ai/CorrelationEngine'
import AdvancedHub from '@/pages/advanced/AdvancedHub'
import GeneticRiskPage from '@/pages/advanced/GeneticRiskPage'
import StressScorePage from '@/pages/advanced/StressScorePage'
import VO2MaxPage from '@/pages/advanced/VO2MaxPage'
import GutHealthPage from '@/pages/advanced/GutHealthPage'
import IntelligenceHub from '@/pages/intelligence/IntelligenceHub'
import RecoveryScorePage from '@/pages/intelligence/RecoveryScorePage'
import BiologicalAgePage from '@/pages/intelligence/BiologicalAgePage'
import NutritionAIPage from '@/pages/intelligence/NutritionAIPage'
import SleepIntelligencePage from '@/pages/intelligence/SleepIntelligencePage'
import HealthMemoryPage from '@/pages/intelligence/HealthMemoryPage'
import DigitalTwinPage from '@/pages/intelligence/DigitalTwinPage'
import AdminLayout from '@/pages/admin/AdminLayout'
import AdminOverview from '@/pages/admin/AdminOverview'
import AdminUsers from '@/pages/admin/AdminUsers'
import AdminDoctors from '@/pages/admin/AdminDoctors'
import AdminAppointments from '@/pages/admin/AdminAppointments'
import AdminProducts from '@/pages/admin/AdminProducts'
import AdminAnnouncements from '@/pages/admin/AdminAnnouncements'
import AdminAnalytics from '@/pages/admin/AdminAnalytics'
import DoctorLayout from '@/pages/doctor/DoctorLayout'
import DoctorOverview from '@/pages/doctor/DoctorOverview'
import DoctorAppointments from '@/pages/doctor/DoctorAppointments'
import DoctorPatients from '@/pages/doctor/DoctorPatients'
import DoctorConsultations from '@/pages/doctor/DoctorConsultations'

export default function App() {
  const { fetchProfile, setUser } = useAuthStore()
  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_OUT') setUser(null)
      else if (event === 'SIGNED_IN' && session?.user) fetchProfile(session.user.id)
      else if (event === 'TOKEN_REFRESHED' && session?.user) fetchProfile(session.user.id)
    })
    return () => subscription.unsubscribe()
  }, [])

  return (
    <BrowserRouter>
      <Toaster position="top-right" toastOptions={{ style: { fontSize: '13px', borderRadius: '10px', border: '0.5px solid #e5e7eb' } }} />
      <Routes>
        <Route path="/login" element={<AuthPage />} />
        <Route path="/signup" element={<AuthPage />} />
        <Route path="/doctor/login" element={<DoctorLoginPage />} />
        <Route path="/onboarding" element={<ProtectedRoute><OnboardingPage /></ProtectedRoute>} />
        <Route path="/consultation/:roomId" element={<ConsultationRoom />} />

        <Route element={<ProtectedRoute><AppLayout /></ProtectedRoute>}>
          <Route path="/dashboard"                   element={<Dashboard />} />
          <Route path="/longevity"                   element={<LongevityPage />} />
          <Route path="/habits"                      element={<HabitsPage />} />
          <Route path="/timeline"                    element={<HealthTimeline />} />
          <Route path="/health-data"                 element={<HealthDataPage />} />
          <Route path="/insights"                    element={<InsightsPage />} />
          <Route path="/trends"                      element={<TrendsPage />} />
          <Route path="/wearables"                   element={<WearableSyncPage />} />
          <Route path="/health-records"              element={<DigitalHealthRecords />} />
          <Route path="/emergency-card"              element={<EmergencyCard />} />
          <Route path="/mental-health"               element={<MentalHealthOS />} />
          <Route path="/biomarkers"                  element={<BiomarkerAnalytics />} />
          <Route path="/ai-copilot"                  element={<AIHealthCopilot />} />
          <Route path="/fitness"                     element={<FitnessEcosystem />} />
          <Route path="/correlations"                element={<CorrelationEngine />} />
          <Route path="/doctors"                     element={<DoctorsPage />} />
          <Route path="/family"                      element={<FamilyPage />} />
          <Route path="/reports"                     element={<ReportsPage />} />
          <Route path="/subscription"                element={<SubscriptionPage />} />
          <Route path="/profile"                     element={<ProfilePage />} />
          <Route path="/advanced"                    element={<AdvancedHub />} />
          <Route path="/advanced/genetic"            element={<GeneticRiskPage />} />
          <Route path="/advanced/stress"             element={<StressScorePage />} />
          <Route path="/advanced/vo2max"             element={<VO2MaxPage />} />
          <Route path="/advanced/gut"                element={<GutHealthPage />} />
          <Route path="/intelligence"                element={<IntelligenceHub />} />
          <Route path="/intelligence/recovery"       element={<RecoveryScorePage />} />
          <Route path="/intelligence/biological-age" element={<BiologicalAgePage />} />
          <Route path="/intelligence/nutrition"      element={<NutritionAIPage />} />
          <Route path="/intelligence/sleep"          element={<SleepIntelligencePage />} />
          <Route path="/intelligence/memory"         element={<HealthMemoryPage />} />
          <Route path="/intelligence/digital-twin"   element={<DigitalTwinPage />} />
        </Route>

        <Route path="/admin" element={<AdminLayout />}>
          <Route index element={<AdminOverview />} />
          <Route path="users" element={<AdminUsers />} />
          <Route path="doctors" element={<AdminDoctors />} />
          <Route path="appointments" element={<AdminAppointments />} />
          <Route path="products" element={<AdminProducts />} />
          <Route path="announcements" element={<AdminAnnouncements />} />
          <Route path="analytics" element={<AdminAnalytics />} />
        </Route>

        <Route path="/doctor" element={<DoctorLayout />}>
          <Route index element={<DoctorOverview />} />
          <Route path="appointments" element={<DoctorAppointments />} />
          <Route path="patients" element={<DoctorPatients />} />
          <Route path="consultations" element={<DoctorConsultations />} />
        </Route>

        <Route path="/" element={<Navigate to="/dashboard" replace />} />
      </Routes>
    </BrowserRouter>
  )
}
