// VitalOS — Firebase background notification handler
// Paste your actual Firebase config values below (from Firebase Console → Project Settings)
// These are safe to expose publicly — same as any Firebase web app config.

importScripts('https://www.gstatic.com/firebasejs/10.7.0/firebase-app-compat.js')
importScripts('https://www.gstatic.com/firebasejs/10.7.0/firebase-messaging-compat.js')

firebase.initializeApp({
  apiKey: "AIzaSyBCtYpsV9p6FVK4qC4VoAT0cG3yIfLAYv0",
  authDomain: "vitalos-india.firebaseapp.com",
  projectId: "vitalos-india",
  storageBucket: "vitalos-india.firebasestorage.app",
  messagingSenderId: "249706775672",
  appId: "1:249706775672:web:b98f89d8499f7207a3198d",
})

const messaging = firebase.messaging()

messaging.onBackgroundMessage((payload) => {
  const title = payload.notification?.title || 'VitalOS'
  const options = {
    body: payload.notification?.body || '',
    icon: '/logo.jpeg',
    badge: '/logo.jpeg',
  }
  self.registration.showNotification(title, options)
})
