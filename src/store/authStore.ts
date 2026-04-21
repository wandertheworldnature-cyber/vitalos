import { create } from 'zustand'
import { supabase } from '@/lib/supabase'
import type { User } from '@/types'

interface AuthState {
  user: User | null
  loading: boolean
  setUser: (user: User | null) => void
  signOut: () => Promise<void>
  fetchProfile: (userId: string) => Promise<void>
  refreshUser: () => Promise<void>
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  loading: true,

  setUser: (user) => set({ user, loading: false }),

  signOut: async () => {
    await supabase.auth.signOut()
    set({ user: null, loading: false })
  },

  refreshUser: async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    const { data } = await supabase.from('profiles').select('*').eq('id', user.id).single()
    if (data) set({ user: data as User })
  },

  fetchProfile: async (userId: string) => {
    try {
      // Try fetching existing profile
      const { data } = await supabase
        .from('profiles').select('*').eq('id', userId).single()

      if (data) {
        set({ user: data as User, loading: false })
        return
      }

      // Profile row missing — create it from auth metadata
      const { data: authData } = await supabase.auth.getUser()
      const email = authData?.user?.email || ''
      const fullName = (authData?.user?.user_metadata?.full_name as string) || ''

      const { data: upserted } = await supabase
        .from('profiles')
        .upsert({ id: userId, email, full_name: fullName, plan: 'basic' }, { onConflict: 'id' })
        .select().single()

      set({
        user: (upserted || {
          id: userId, email,
          full_name: fullName || email.split('@')[0],
          plan: 'basic',
          created_at: new Date().toISOString(),
        }) as User,
        loading: false,
      })
    } catch (err) {
      console.error('fetchProfile error:', err)
      set({ loading: false })
    }
  },
}))
