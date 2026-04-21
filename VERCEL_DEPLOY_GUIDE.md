# VitalOS — Deploy to Vercel (Free, 5 minutes)

## Step 1 — Push code to GitHub

Open terminal in your vitalos folder and run:

```bash
git init
git add .
git commit -m "VitalOS MVP - initial deploy"
```

Create a new repo on github.com:
1. Go to github.com → Click "+" → "New repository"
2. Name it "vitalos" → Private → Create
3. Copy the commands shown (they look like):

```bash
git remote add origin https://github.com/YOURUSERNAME/vitalos.git
git branch -M main
git push -u origin main
```

## Step 2 — Deploy on Vercel

1. Go to **vercel.com** → Sign up with GitHub (free)
2. Click **"Add New Project"**
3. Import your **vitalos** repo
4. Vercel auto-detects Vite — no build settings needed
5. Click **"Environment Variables"** and add ALL of these:

| Variable | Value |
|---|---|
| `VITE_SUPABASE_URL` | your supabase project URL |
| `VITE_SUPABASE_ANON_KEY` | your supabase anon key |
| `VITE_GEMINI_API_KEY` | your gemini key |
| `VITE_GROQ_API_KEY` | your groq key |
| `VITE_RAZORPAY_KEY_ID` | rzp_test_... |

6. Click **Deploy**
7. In 2 minutes you get: **https://vitalos.vercel.app** ✅

## Step 3 — Update Supabase allowed URLs

After deploy, add your Vercel URL to Supabase:
1. Supabase Dashboard → Authentication → URL Configuration
2. Add to "Redirect URLs": `https://vitalos.vercel.app/**`
3. Add to "Site URL": `https://vitalos.vercel.app`

## Step 4 — Custom domain (optional, free)

If you have a domain like vitalos.in:
1. Vercel → your project → Settings → Domains
2. Add your domain → Follow DNS instructions
3. Free SSL certificate is auto-provisioned

## Updating the app after deploy

Every time you push code to GitHub, Vercel auto-deploys:
```bash
git add .
git commit -m "update: description of changes"
git push
```
Vercel deploys in ~2 minutes automatically.

## Share with investors

After deploy, share this URL:
**https://vitalos.vercel.app**

For a demo account, create one at the signup page and share:
- Email: demo@vitalos.in
- Password: (set something easy to remember)

