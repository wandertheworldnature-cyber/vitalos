// VitalOS Push Notifications — Firebase Cloud Messaging
// Setup required: see FIREBASE_SETUP.md for step-by-step account creation

import { initializeApp, FirebaseApp } from 'firebase/app'
import { getMessaging, getToken, onMessage, Messaging } from 'firebase/messaging'
import { supabase } from './supabase'

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
}

const VAPID_KEY = import.meta.env.VITE_FIREBASE_VAPID_KEY

let app: FirebaseApp | null = null
let messaging: Messaging | null = null

function initFirebase() {
  if (!firebaseConfig.apiKey) {
    console.warn('Firebase not configured — push notifications disabled')
    return null
  }
  if (!app) app = initializeApp(firebaseConfig)
  if (!messaging) messaging = getMessaging(app)
  return messaging
}

export async function requestNotificationPermission(userId: string): Promise<boolean> {
  const msg = initFirebase()
  if (!msg) return false

  try {
    const permission = await Notification.requestPermission()
    if (permission !== 'granted') return false

    const token = await getToken(msg, { vapidKey: VAPID_KEY })
    if (!token) return false

    // Save token to Supabase so backend can send notifications to this device
    await supabase.from('push_tokens').upsert({
      user_id: userId, token, platform: 'web',
      updated_at: new Date().toISOString(),
    }, { onConflict: 'user_id,token' })

    return true
  } catch (e) {
    console.error('Notification permission error:', e)
    return false
  }
}

export function listenForMessages(callback: (title: string, body: string) => void) {
  const msg = initFirebase()
  if (!msg) return
  onMessage(msg, (payload) => {
    callback(payload.notification?.title || 'VitalOS', payload.notification?.body || '')
  })
}

export async function disableNotifications(userId: string) {
  await supabase.from('push_tokens').delete().eq('user_id', userId)
}

export function isNotificationSupported(): boolean {
  return 'Notification' in window && 'serviceWorker' in navigator
}

export function getNotificationPermissionStatus(): NotificationPermission | 'unsupported' {
  if (!isNotificationSupported()) return 'unsupported'
  return Notification.permission
}

