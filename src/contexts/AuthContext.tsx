'use client'
import { createContext, useContext, useState, useEffect, ReactNode } from 'react'
import { supabase } from '@/lib/supabase'
import type { User } from '@supabase/supabase-js'

interface Profile {
  id: string
  username: string
  display_name: string
  bio?: string
  avatar_url?: string
  level: number
  xp: number
  coins: number
  wins: number
  losses: number
  deals_total: number
  streak: number
  primary_archetype: string
  active_frame: string
  active_badge?: string
  active_title?: string
  active_card?: string
  active_victory_animation?: string
  is_founder: boolean
  battle_pass_premium: boolean
  battle_pass_level: number
  reputation_score: number
  is_private?: boolean
  deleted_at?: string | null
  invite_code?: string
  referred_by?: string | null
  onboarding_completed?: boolean
}

interface AuthCtx {
  user: User | null
  profile: Profile | null
  loading: boolean
  signIn: (email: string, password: string) => Promise<void>
  signUp: (email: string, password: string, username: string) => Promise<void>
  signOut: () => Promise<void>
  refreshProfile: () => Promise<void>
  updateProfile: (updates: Partial<Profile>) => Promise<void>
}

const AuthContext = createContext<AuthCtx>({} as AuthCtx)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [profile, setProfile] = useState<Profile | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null)
      if (session?.user) fetchProfile(session.user.id)
      else setLoading(false)
    })
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_e, session) => {
      setUser(session?.user ?? null)
      if (session?.user) fetchProfile(session.user.id)
      else { setProfile(null); setLoading(false) }
    })
    return () => subscription.unsubscribe()
  }, [])

  const fetchProfile = async (userId: string) => {
    const { data } = await supabase.from('profiles').select('*').eq('id', userId).single()
    setProfile(data)
    setLoading(false)
  }

  const signIn = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) throw error
  }

  const signUp = async (email: string, password: string, username: string) => {
    // Pass username in metadata so the handle_new_user trigger picks it up immediately
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { username } },
    })
    if (error) throw error
    // Ensure display_name is set (trigger already sets username, but update is idempotent)
    if (data.user) {
      await supabase
        .from('profiles')
        .update({ display_name: username })
        .eq('id', data.user.id)
    }
  }

  const signOut = async () => {
    await supabase.auth.signOut()
  }

  const refreshProfile = async () => {
    if (user) await fetchProfile(user.id)
  }

  const updateProfile = async (updates: Partial<Profile>) => {
    if (!user) return
    await supabase.from('profiles').update(updates).eq('id', user.id)
    await fetchProfile(user.id)
  }

  return (
    <AuthContext.Provider value={{ user, profile, loading, signIn, signUp, signOut, refreshProfile, updateProfile }}>
      {children}
    </AuthContext.Provider>
  )
}

export const useAuth = () => useContext(AuthContext)
