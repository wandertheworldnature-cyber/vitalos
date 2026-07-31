# App.tsx additions

## New imports:
```tsx
import InsuranceHub from '@/pages/insurance/InsuranceHub'
import HealthBlog from '@/pages/blog/HealthBlog'
import NotificationSettings from '@/pages/settings/NotificationSettings'
```

## New routes (inside <Route element={<ProtectedRoute><AppLayout/></ProtectedRoute>}>):
```tsx
<Route path="/insurance" element={<InsuranceHub/>}/>
<Route path="/health-blog" element={<HealthBlog/>}/>
<Route path="/notification-settings" element={<NotificationSettings/>}/>
```

---

# Sidebar.tsx additions

## New icon imports (add to lucide-react import):
BookOpen, Bell

## New nav items — add to NAV_MAIN array:
```tsx
{ to:'/insurance',              icon:Shield,    label:'Insurance',      badge:'NEW', badgeColor:'#0ea5e9' },
{ to:'/health-blog',            icon:BookOpen,  label:'Health Library', badge:'NEW', badgeColor:'#10b981' },
{ to:'/notification-settings',  icon:Bell,      label:'Notifications',  badge:'NEW', badgeColor:'#8b5cf6' },
```
(Note: Shield icon is already imported for Emergency Card — reuse it)

---

# AppLayout.tsx — add ProfileSwitcher to the top header

If your AppLayout.tsx has a header/topbar area, add:
```tsx
import ProfileSwitcher from '@/components/ProfileSwitcher'

// In the header JSX, near the top:
<ProfileSwitcher />
```

This shows a dropdown to switch between "Me" and family members. Pages can later read `getActiveProfile()` from `@/components/ProfileSwitcher` to filter data by the selected profile — that wiring (making Health Data, Reports etc. actually filter by active profile) is a further step once this UI is confirmed working.
