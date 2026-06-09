'use client'
import { createContext, useContext, useState, useEffect, ReactNode } from 'react'
import { supabase } from '@/lib/supabase'
import type { User } from '@supabase/supabase-js'

// ── Profile cache (stale-while-revalidate) ──
// The app gates almost everything on `profile`/`loading`. Reading the last-known
// profile from localStorage lets profile-dependent UI paint instantly on cold open
// while we revalidate in the background, instead of blocking on a network round-trip.
const PROFILE_CACHE_PREFIX = 'db_profile_'
const readProfileCache = (userId: string): Profile | null => {
  if (typeof window === 'undefined') return null
  try {
    const raw = window.localStorage.getItem(PROFILE_CACHE_PREFIX + userId)
    return raw ? (JSON.parse(raw) as Profile) : null
  } catch { return null }
}
const writeProfileCache = (userId: string, profile: Profile | null) => {
  if (typeof window === 'undefined') return
  try {
    if (profile) window.localStorage.setItem(PROFILE_CACHE_PREFIX + userId, JSON.stringify(profile))
    else window.localStorage.removeItem(PROFILE_CACHE_PREFIX + userId)
  } catch { /* quota / private mode — ignore, revalidation still runs */ }
}

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
  card_dust?: number
  allow_story_dm?: boolean
  avatar_card_template_id?: string
  equipped_card_image_url?: string | null
  reliability_score?: number | null
  reliability_color?: string | null
  status_text?: string | null
}

interface AuthCtx {
  user: User | null
  profile: Profile | null
  loading: boolean
  requestLoginCode: (email: string) => Promise<void>
  verifyLoginCode: (email: string, code: string) => Promise<void>
  requestSignupCode: (email: string, username: string) => Promise<void>
  verifySignupCode: (email: string, code: string) => Promise<void>
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
    supabase.auth.getSession().then(({ data: { session } }: any) => {
      setUser(session?.user ?? null)
      if (session?.user) fetchProfile(session.user.id)
      else setLoading(false)
    }).catch(() => setLoading(false))
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_e: any, session: any) => {
      setUser(session?.user ?? null)
      if (session?.user) fetchProfile(session.user.id)
      else { setProfile(null); setLoading(false) }
    })
    // Hard-Cap: sollte der Profil-Fetch je hängen (Netz/Token), bleibt der
    // Spinner nicht ewig stehen — nach 8 s wird das loading-Gate gelöst.
    const fallback = setTimeout(() => setLoading(false), 8000)
    return () => { subscription.unsubscribe(); clearTimeout(fallback) }
  }, [])

  const fetchProfile = async (userId: string) => {
    // Instant paint from last-known profile, then revalidate over the network.
    const cached = readProfileCache(userId)
    if (cached) {
      setProfile(cached)
      setLoading(false)
    }
    // try/catch/finally: ein Fehler (oder still scheiternder Request) darf den
    // Spinner nicht dauerhaft stehen lassen — loading wird IMMER gelöst. Bei
    // Fehler behalten wir einen vorhandenen Cache (kein Flackern auf leer).
    try {
      const { data } = await supabase.from('profiles').select('*').eq('id', userId).single()
      if (data) {
        setProfile(data)
        writeProfileCache(userId, data)
      } else if (!cached) {
        setProfile(null)
      }
    } catch {
      if (!cached) setProfile(null)
    } finally {
      setLoading(false)
    }
  }

  // 8-stelliger E-Mail-Code statt Passwort. Bei Login darf NUR ein bestehender
  // Account einen Code bekommen (shouldCreateUser:false), bei Signup darf der
  // Account angelegt werden und der Username wandert in user_metadata, damit der
  // handle_new_user-Trigger ihn beim Verify direkt aufnimmt.
  const requestLoginCode = async (email: string) => {
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: { shouldCreateUser: false },
    })
    if (error) throw error
  }

  const verifyLoginCode = async (email: string, code: string) => {
    const { error } = await supabase.auth.verifyOtp({ email, token: code, type: 'email' })
    if (error) throw error
  }

  const requestSignupCode = async (email: string, username: string) => {
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: { shouldCreateUser: true, data: { username } },
    })
    if (error) throw error
  }

  const verifySignupCode = async (email: string, code: string) => {
    const { data, error } = await supabase.auth.verifyOtp({ email, token: code, type: 'email' })
    if (error) throw error
    if (data.user) {
      // Trigger setzt username schon — display_name idempotent nachsetzen, falls
      // der Trigger früher mal ohne username aus metadata gefeuert hat.
      const meta = (data.user.user_metadata as { username?: string } | null) ?? null
      const username = meta?.username
      if (username) {
        await supabase
          .from('profiles')
          .update({ display_name: username })
          .eq('id', data.user.id)
      }
    }
  }

  const signOut = async () => {
    if (user) writeProfileCache(user.id, null)
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
    <AuthContext.Provider value={{ user, profile, loading, requestLoginCode, verifyLoginCode, requestSignupCode, verifySignupCode, signOut, refreshProfile, updateProfile }}>
      {children}
    </AuthContext.Provider>
  )
}

export const useAuth = () => useContext(AuthContext)
