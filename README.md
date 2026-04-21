# VitalOS — Free Dev Stack

> 100% free during development. No credit card needed.

---

## 💰 Cost Breakdown

| Service | What it does | Free tier | Cost |
|---|---|---|---|
| **Google Gemini Flash** | OCR lab reports | 1,500 req/day | ₹0 |
| **Groq (Llama 3.3 70B)** | AI insights + chat | 14,400 req/day | ₹0 |
| **Supabase** | Database + Auth + Storage | 500MB DB, 1GB storage | ₹0 |
| **Razorpay** | Payments | Unlimited test mode | ₹0 |
| **Vercel** | Hosting | 100GB bandwidth | ₹0 |
| **Total** | | | **₹0/month** |

---

## 🚀 Setup (15 minutes)

### Step 1 — Get free API keys

**Groq** (for AI insights + health chat):
1. Go to https://console.groq.com
2. Sign up free → API Keys → Create key
3. Copy key starting with `gsk_`

**Google Gemini** (for OCR of lab reports):
1. Go to https://aistudio.google.com
2. Sign in with Google → Get API Key
3. Copy key starting with `AIza`

**Supabase** (database):
1. Go to https://supabase.com → New project
2. Settings → API → copy URL and anon key

**Razorpay** (payments — test mode):
1. Go to https://dashboard.razorpay.com → Sign up free
2. Settings → API Keys → Generate Test Key
3. Copy Key ID (`rzp_test_...`) and Secret

### Step 2 — Configure .env

```bash
cd vitalos
cp .env.example .env
```

Edit `.env`:
```env
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key

VITE_GEMINI_API_KEY=AIza-your-gemini-key
VITE_GROQ_API_KEY=gsk_your-groq-key

VITE_RAZORPAY_KEY_ID=rzp_test_your-key-id
RAZORPAY_KEY_SECRET=your-secret
```

### Step 3 — Run database migrations

In Supabase SQL Editor, run these files in order:
1. `supabase/migrations/001_initial_schema.sql`
2. `supabase/migrations/002_storage_and_functions.sql`

### Step 4 — Deploy Razorpay Edge Functions only

```bash
npm install -g supabase
supabase login
supabase link --project-ref your-project-ref

# Only these 2 functions need deployment (Gemini/Groq run in browser)
supabase secrets set RAZORPAY_KEY_ID=rzp_test_your-key-id
supabase secrets set RAZORPAY_KEY_SECRET=your-secret
supabase functions deploy razorpay-order
supabase functions deploy razorpay-verify
```

### Step 5 — Install and run

```bash
npm install
npm run dev
```

Open http://localhost:5173 ✅

---

## 🏗️ Architecture (Free Stack)

```
Browser
├── React + TypeScript + Vite
├── Gemini Flash API ──────→ OCR lab report PDFs/images (FREE, 1,500/day)
├── Groq Llama 3.3 API ────→ AI insights + health chat (FREE, 14,400/day)
├── Razorpay.js ───────────→ Payment UI (test mode, FREE)
└── Supabase JS Client ────→ Auth, DB reads/writes, file uploads

Supabase (backend)
├── PostgreSQL ────────────→ All health data, users, appointments
├── Auth ──────────────────→ Email/password login
├── Storage ───────────────→ Lab report PDFs/images
└── Edge Functions (Deno)
    ├── razorpay-order ────→ Create payment order (needs secret key)
    └── razorpay-verify ───→ Verify payment signature (needs secret key)
```

**Key insight:** Gemini and Groq calls happen directly from the browser — no backend/Edge Function needed. This saves both cost and complexity.

---

## 📁 Project Structure

```
vitalos/
├── src/
│   ├── services/
│   │   ├── geminiService.ts    ← OCR via Gemini Flash (FREE)
│   │   ├── groqService.ts      ← AI insights via Groq Llama 3.3 (FREE)
│   │   ├── healthService.ts    ← Supabase + orchestrates Gemini/Groq
│   │   ├── doctorService.ts    ← Doctor booking (Supabase)
│   │   └── razorpayService.ts  ← Payments
│   ├── pages/                  ← 10 full pages
│   ├── components/             ← Reusable UI
│   ├── store/                  ← Zustand auth
│   └── lib/supabase.ts
│
└── supabase/
    ├── migrations/             ← Run these in Supabase SQL Editor
    └── functions/
        ├── razorpay-order/     ← Deploy this
        └── razorpay-verify/    ← Deploy this
```

---

## ⚡ Free Tier Limits (What You Get)

**Groq (Llama 3.3 70B):**
- 14,400 requests/day
- 30 requests/minute
- 6,000 tokens/minute
- At 10 active users making 5 AI calls/day = 50 req/day = well within limits

**Gemini Flash:**
- 1,500 requests/day
- 1M tokens/minute
- At 10 users uploading 5 reports/day = 50 req/day = well within limits

**Supabase:**
- 500MB database (enough for ~1M health records)
- 1GB file storage (enough for ~500 PDF reports)
- 50,000 monthly active users auth

**When to upgrade:**
- Groq: upgrade at ~500 daily active users or switch to paid Groq ($0.05/1M tokens)
- Gemini: stays free very long (generous limits)
- Supabase: upgrade at ~1,000 users or 500MB DB usage (~$25/mo)

---

## 🔒 Security Note

Since Gemini and Groq keys are in `VITE_` env vars, they are exposed in the browser bundle. This is acceptable for dev/testing but for production you should:
1. Move Gemini + Groq calls to Supabase Edge Functions (same pattern as razorpay-order)
2. Store keys as Supabase secrets (not in .env)

For MVP testing with small user base, browser-side keys are fine.

---

## 🚀 Deploy to Production (Free)

```bash
# Build
npm run build

# Deploy to Vercel (free)
npx vercel --prod
# Add env vars in Vercel dashboard
```

---

*Zero cost. Full features. Ready to build.*
