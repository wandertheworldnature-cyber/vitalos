import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { supabase } from '@/lib/supabase'

interface User {
  id: string
  email: string
  full_name?: string
  plan?: string
  role?: string
}

interface AuthStore {
  user: User | null
  loading: boolean
  setUser: (user: User | null) => void
  fetchProfile: (id: string) => Promise<void>
  signOut: () => Promise<void>
}

export const useAuthStore = create<AuthStore>()(
  persist(
    (set, get) => ({
      user: null,
      loading: false,

      setUser: (user) => set({ user, loading: false }),

      fetchProfile: async (id: string) => {
        try {
          const { data: profile } = await supabase
            .from('profiles')
            .select('id, full_name, email, plan, role')
            .eq('id', id)
            .single()

          const { data: { user: authUser } } = await supabase.auth.getUser()

          if (profile && authUser) {
            set({
              user: {
                id: profile.id,
                email: profile.email || authUser.email || '',
                full_name: profile.full_name,
                plan: profile.plan || 'basic',
                role: profile.role,
              },
              loading: false,
            })
          } else if (authUser) {
            // Profile might not exist yet — use auth data
            set({
              user: {
                id: authUser.id,
                email: authUser.email || '',
                full_name: authUser.user_metadata?.full_name,
                plan: 'basic',
              },
              loading: false,
            })
          } else {
            set({ user: null, loading: false })
          }
        } catch {
          // Don't clear user on network error — keep existing session
          set({ loading: false })
        }
      },

      signOut: async () => {
        await supabase.auth.signOut()
        // Clear localStorage
        localStorage.removeItem('vitalos-user')
        localStorage.removeItem('vitalos-auth')
        set({ user: null, loading: false })
      },
    }),
    {
      name: 'vitalos-user',
      partialize: (state) => ({ user: state.user }), // only persist user object
    }
  )
)
