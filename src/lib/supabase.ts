import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL  as string
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string

export const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: {
    persistSession: true,        // store session in localStorage — survives tab close
    autoRefreshToken: true,      // auto-refresh before token expires
    detectSessionInUrl: true,    // handle magic link / OAuth redirects
    storageKey: 'vitalos-auth',  // unique storage key
  },
})
