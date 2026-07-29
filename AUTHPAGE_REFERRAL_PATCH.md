# Patch AuthPage.tsx to capture referral codes

In src/pages/AuthPage.tsx, add this near the top (after imports):

```tsx
import { useSearchParams } from 'react-router-dom'

// Inside the component:
const [searchParams] = useSearchParams()
const refCode = searchParams.get('ref')
```

In the signup handler, where you insert the new profile, add referred_by:

```tsx
await supabase.from('profiles').upsert({
  id: data.user.id, 
  email: email.trim().toLowerCase(),
  full_name: name.trim(), 
  plan: 'basic',
  referred_by: refCode || null,   // ADD THIS LINE
})
```

If refCode exists, show a small banner above the form:

```tsx
{refCode && (
  <div className="bg-purple-50 border border-purple-100 rounded-xl p-3 mb-4 text-center">
    <p className="text-xs text-purple-700">🎁 You were invited! Sign up to get bonus points.</p>
  </div>
)}
```
