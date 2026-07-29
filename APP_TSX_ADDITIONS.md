# Add these imports and routes to App.tsx

## New imports (add near other page imports):
```tsx
import ReferralProgram from '@/pages/referral/ReferralProgram'
import FamilyDashboard from '@/pages/family/FamilyDashboard'
import PrivacyCenter from '@/pages/privacy/PrivacyCenter'
```

## New routes (add inside the <Route element={<ProtectedRoute><AppLayout/></ProtectedRoute>}> block):
```tsx
<Route path="/referral" element={<ReferralProgram/>}/>
<Route path="/family-dashboard" element={<FamilyDashboard/>}/>
<Route path="/privacy" element={<PrivacyCenter/>}/>
```

Note: OnboardingPage.tsx was already replaced with the new file — no import change needed since it uses the same path `@/pages/OnboardingPage`.
