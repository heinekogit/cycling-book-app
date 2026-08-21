import type { Session } from '@supabase/supabase-js'
import { createContext, use, useEffect, useMemo, useState, type PropsWithChildren } from 'react'
import { supabase } from '@/lib/supabase'

type AuthContextValue = { session: Session | null; isLoading: boolean; signOut: () => Promise<void> }
const AuthContext = createContext<AuthContextValue | null>(null)

export function AuthProvider({ children }: PropsWithChildren) {
  const [session, setSession] = useState<Session | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => { setSession(data.session); setIsLoading(false) })
    const { data } = supabase.auth.onAuthStateChange((_event, nextSession) => { setSession(nextSession); setIsLoading(false) })
    return () => data.subscription.unsubscribe()
  }, [])
  const value = useMemo<AuthContextValue>(() => ({ session, isLoading, signOut: async () => {
    const { error } = await supabase.auth.signOut()
    if (error) throw error
  } }), [isLoading, session])
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const context = use(AuthContext)
  if (!context) throw new Error('useAuth must be used inside AuthProvider')
  return context
}
