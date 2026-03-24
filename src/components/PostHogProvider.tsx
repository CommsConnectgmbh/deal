'use client'
import { useEffect } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { initAnalytics, identifyUser, resetUser } from '@/lib/analytics'

export default function PostHogProvider({ children }: { children: React.ReactNode }) {
  const { user, profile } = useAuth()

  useEffect(() => {
    const timer = setTimeout(() => {
      initAnalytics()
    }, 3000)
    return () => clearTimeout(timer)
  }, [])

  useEffect(() => {
    if (user && profile) {
      identifyUser(user.id, {
        username: profile.username,
        level: profile.level,
        is_founder: profile.is_founder,
        primary_archetype: profile.primary_archetype,
        battle_pass_premium: profile.battle_pass_premium,
      })
    } else if (!user) {
      resetUser()
    }
  }, [user, profile])

  return <>{children}</>
}
