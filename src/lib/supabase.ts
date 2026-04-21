import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseAnonKey) {
  console.warn('Missing Supabase env vars — using demo mode')
}

export const supabase = createClient(
  supabaseUrl || 'https://hdoxnnzjzdejuxletqew.supabase.co',
  supabaseAnonKey || 'demo-key',
  {
    auth: {
      autoRefreshToken: true,
      persistSession: true,
    },
  }
)

// Helper to get current user
export const getCurrentUser = async () => {
  const { data: { user }, error } = await supabase.auth.getUser()
  if (error) throw error
  return user
}
