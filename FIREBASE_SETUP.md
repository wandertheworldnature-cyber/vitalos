# Firebase Push Notifications — Setup Guide

## Step 1: Create Firebase project (5 min)
1. Go to https://console.firebase.google.com
2. Click "Add project" → name it "VitalOS" → disable Google Analytics (optional) → Create
3. Once created, click the Web icon (</>) to add a web app
4. Register app name "VitalOS Web" → copy the firebaseConfig values shown

## Step 2: Enable Cloud Messaging
1. In Firebase Console → Project Settings (gear icon) → Cloud Messaging tab
2. Under "Web configuration" → click "Generate key pair" — this gives you the VAPID key
3. Copy that VAPID key

## Step 3: Add environment variables to Vercel
Go to Vercel → VitalOS project → Settings → Environment Variables → add these (apply to both dev and production):

```
VITE_FIREBASE_API_KEY=<from firebaseConfig>
VITE_FIREBASE_AUTH_DOMAIN=<from firebaseConfig>
VITE_FIREBASE_PROJECT_ID=<from firebaseConfig>
VITE_FIREBASE_STORAGE_BUCKET=<from firebaseConfig>
VITE_FIREBASE_SENDER_ID=<from firebaseConfig>
VITE_FIREBASE_APP_ID=<from firebaseConfig>
VITE_FIREBASE_VAPID_KEY=<from Cloud Messaging tab>
```

## Step 4: Install the Firebase SDK
```powershell
npm install firebase
```

## Step 5: Create the service worker for background notifications
Create `public/firebase-messaging-sw.js`:

```js
importScripts('https://www.gstatic.com/firebasejs/10.7.0/firebase-app-compat.js')
importScripts('https://www.gstatic.com/firebasejs/10.7.0/firebase-messaging-compat.js')

firebase.initializeApp({
  apiKey: "PASTE_YOUR_API_KEY",
  authDomain: "PASTE_YOUR_AUTH_DOMAIN",
  projectId: "PASTE_YOUR_PROJECT_ID",
  storageBucket: "PASTE_YOUR_STORAGE_BUCKET",
  messagingSenderId: "PASTE_YOUR_SENDER_ID",
  appId: "PASTE_YOUR_APP_ID",
})

const messaging = firebase.messaging()

messaging.onBackgroundMessage((payload) => {
  self.registration.showNotification(payload.notification.title, {
    body: payload.notification.body,
    icon: '/logo.jpeg',
  })
})
```

Note: this file can't use import.meta.env (it's a plain service worker), so paste actual values directly — they're safe to expose publicly, same as any Firebase web config.

## Step 6: Database setup — run in Supabase SQL Editor
```sql
CREATE TABLE IF NOT EXISTS push_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  token TEXT NOT NULL,
  platform TEXT DEFAULT 'web',
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id, token)
);

ALTER TABLE push_tokens ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage their own push tokens" ON push_tokens FOR ALL USING (auth.uid() = user_id);

ALTER TABLE profiles ADD COLUMN IF NOT EXISTS notification_prefs JSONB DEFAULT '{"habit_reminders":true,"appointment_reminders":true,"challenge_nudges":true,"health_alerts":true,"weekly_summary":true}'::jsonb;
```

## Step 7: Sending notifications (backend)
Actually SENDING notifications requires a server-side call (Firebase Admin SDK) since it needs your service account credentials — this can't run in the browser for security reasons. 

This needs a Supabase Edge Function that:
1. Runs on a schedule (Supabase Cron or pg_cron) to check for due reminders
2. Uses Firebase Admin SDK to send to each user's token

This is a follow-up build once the frontend piece is confirmed working — let me know when Steps 1-6 are done and I'll build the sending edge function.

## What works after Steps 1-6:
- Users can enable/disable notifications in the app
- Their device token gets saved to Supabase
- The permission UI and preferences are fully functional
- Actually triggering scheduled sends is the next phase
