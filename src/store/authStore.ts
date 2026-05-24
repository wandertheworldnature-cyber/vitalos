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
    (set) => ({
      user: null,
      loading: true,

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
          } else {
            set({ user: null, loading: false })
          }
        } catch {
          set({ user: null, loading: false })
        }
      },

      signOut: async () => {
        await supabase.auth.signOut()
        set({ user: null, loading: false })
      },
    }),
    {
      name: 'vitalos-user',        // localStorage key
      partialize: (state) => ({    // only persist user, not loading
        user: state.user,
      }),
    }
  )
)
