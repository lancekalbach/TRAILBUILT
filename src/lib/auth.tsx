import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import type { Session } from '@supabase/supabase-js'
import type { UserProfile, UserRole } from '../types'
import { isSupabaseConfigured, supabase, type ProfileRow } from './supabase'

type AuthContextValue = {
  configured: boolean
  session: Session | null
  profile: UserProfile | null
  loading: boolean
  isCrew: boolean
  isAdmin: boolean
  signIn: (email: string, password: string) => Promise<void>
  signUp: (email: string, password: string, displayName: string) => Promise<string | null>
  signOut: () => Promise<void>
}

const AuthContext = createContext<AuthContextValue | null>(null)

function rowToProfile(row: ProfileRow): UserProfile {
  return {
    id: row.id,
    email: row.email,
    displayName: row.display_name,
    role: row.role,
  }
}

async function fetchProfile(userId: string): Promise<UserProfile | null> {
  const { data, error } = await supabase.from('profiles').select('*').eq('id', userId).maybeSingle()
  if (error) throw error
  return data ? rowToProfile(data) : null
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null)
  const [profile, setProfile] = useState<UserProfile | null>(null)
  const [loading, setLoading] = useState(isSupabaseConfigured)

  const refreshProfile = useCallback(async (userId: string | undefined) => {
    if (!userId) {
      setProfile(null)
      return
    }
    const next = await fetchProfile(userId)
    setProfile(next)
  }, [])

  useEffect(() => {
    if (!isSupabaseConfigured) {
      setLoading(false)
      return
    }

    let cancelled = false

    void supabase.auth.getSession().then(({ data }) => {
      if (cancelled) return
      setSession(data.session)
      void refreshProfile(data.session?.user.id)
        .catch(() => {
          if (!cancelled) setProfile(null)
        })
        .finally(() => {
          if (!cancelled) setLoading(false)
        })
    })

    const { data: subscription } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession)
      void refreshProfile(nextSession?.user.id).catch(() => setProfile(null))
    })

    return () => {
      cancelled = true
      subscription.subscription.unsubscribe()
    }
  }, [refreshProfile])

  const signIn = useCallback(async (email: string, password: string) => {
    if (!isSupabaseConfigured) throw new Error('Supabase is not configured yet.')
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) throw error
  }, [])

  const signUp = useCallback(async (email: string, password: string, displayName: string) => {
    if (!isSupabaseConfigured) throw new Error('Supabase is not configured yet.')
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { display_name: displayName.trim() || undefined },
      },
    })
    if (error) throw error
    if (!data.session) {
      return 'Check your email to confirm your account, then sign in.'
    }
    return null
  }, [])

  const signOut = useCallback(async () => {
    if (!isSupabaseConfigured) return
    const { error } = await supabase.auth.signOut()
    if (error) throw error
  }, [])

  const role: UserRole | null = profile?.role ?? null
  const value = useMemo<AuthContextValue>(
    () => ({
      configured: isSupabaseConfigured,
      session,
      profile,
      loading,
      isCrew: role === 'crew' || role === 'admin',
      isAdmin: role === 'admin',
      signIn,
      signUp,
      signOut,
    }),
    [session, profile, loading, role, signIn, signUp, signOut],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
