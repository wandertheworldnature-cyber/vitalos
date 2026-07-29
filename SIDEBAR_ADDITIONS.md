# Add these to Sidebar.tsx

## New icon imports (add to the lucide-react import line):
Gift, ShieldCheck

## New nav items — add to NAV_MAIN array:
```tsx
{ to:'/referral',         icon:Gift,        label:'Invite & Earn',   badge:'NEW', badgeColor:'#a855f7' },
{ to:'/family-dashboard', icon:Users,       label:'Family Care',     badge:'NEW', badgeColor:'#10b981' },
{ to:'/privacy',          icon:ShieldCheck, label:'Privacy Center',  badge:'NEW', badgeColor:'#3b82f6' },
```

Place them near /family and /emergency-card since they're related.
