'use client'
import { useEffect, useRef, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { trackStreakClaimed } from '@/lib/analytics'

// Day-cycle rewards (1-indexed)
const CYCLE_REWARDS: Record<number, { coins: number; badge?: string }> = {
  1: { coins: 25 },
  2: { coins: 50 },
  3: { coins: 75 },
  4: { coins: 100 },
  5: { coins: 150, badge: 'Daily Grinder Badge' },
  6: { coins: 150 },
  7: { coins: 250 },
}

interface Props {
  userId: string
}

export default function StreakLoginHandler({ userId }: Props) {
  const ran = useRef(false)
  const [toast, setToast] = useState<{ streak: number; coins: number; badge?: string } | null>(null)

  useEffect(() => {
    if (ran.current || !userId) return
    ran.current = true
    handleLogin()
  }, [userId])

  const handleLogin = async () => {
    const today = new Date().toISOString().split('T')[0]
    const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0]

    // Fetch existing streak row
    const { data: row } = await supabase
      .from('user_login_streaks')
      .select('*')
      .eq('user_id', userId)
      .single()

    let currentStreak = 1
    let longestStreak = 1
    let streakFreezeAvailable = false
    let loginCycleDay = 1
    let totalLogins = 1

    if (row) {
      const lastLogin = row.last_login_date

      // Already logged in today: do nothing
      if (lastLogin === today) return

      currentStreak = row.current_streak || 1
      longestStreak = row.longest_streak || 1
      streakFreezeAvailable = row.streak_freeze_available || false
      loginCycleDay = row.login_cycle_day || 1
      totalLogins = (row.total_logins || 0) + 1

      if (lastLogin === yesterday) {
        // Consecutive day
        currentStreak += 1
        loginCycleDay = ((loginCycleDay) % 7) + 1 // advance 1..7 cycle
      } else {
        // Missed day(s)
        if (streakFreezeAvailable) {
          // Use freeze: streak stays, freeze consumed
          streakFreezeAvailable = false
          loginCycleDay = ((loginCycleDay) % 7) + 1
        } else {
          // Reset
          currentStreak = 1
          loginCycleDay = 1
        }
      }

      if (currentStreak > longestStreak) {
        longestStreak = currentStreak
      }

      await supabase.from('user_login_streaks').update({
        current_streak: currentStreak,
        longest_streak: longestStreak,
        last_login_date: today,
        streak_freeze_available: streakFreezeAvailable,
        login_cycle_day: loginCycleDay,
        total_logins: totalLogins,
      }).eq('user_id', userId)
    } else {
      // First time: insert fresh row
      await supabase.from('user_login_streaks').upsert({
        user_id: userId,
        current_streak: 1,
        longest_streak: 1,
        last_login_date: today,
        streak_freeze_available: false,
        login_cycle_day: 1,
        total_logins: 1,
      }, { onConflict: 'user_id' })
    }

    // Award cycle reward
    const reward = CYCLE_REWARDS[loginCycleDay]
    if (reward) {
      // Grant coins
      await supabase.from('wallet_ledger').insert({
        user_id: userId,
        delta: reward.coins,
        reason: 'login_streak',
        reference_id: `streak_${today}_day${loginCycleDay}`,
      })
      await supabase.rpc('increment_coins', { uid: userId, amount: reward.coins }).then(({ error }) => {
        // Fallback: direct update if RPC doesn't exist
        if (error) {
          supabase.from('profiles')
            .select('coins')
            .eq('id', userId)
            .single()
            .then(({ data }) => {
              if (data) {
                supabase.from('profiles')
                  .update({ coins: (data.coins || 0) + reward.coins })
                  .eq('id', userId)
              }
            })
        }
      })

      // Grant badge cosmetic if applicable
      if (reward.badge) {
        await supabase.from('user_inventory').upsert({
          user_id: userId,
          cosmetic_id: reward.badge,
          source: 'earned',
        }, { onConflict: 'user_id,cosmetic_id' })
      }

      trackStreakClaimed(currentStreak)
      setToast({ streak: currentStreak, coins: reward.coins, badge: reward.badge })
      setTimeout(() => setToast(null), 3500)
    }
  }

  if (!toast) return null

  return (
    <div style={{
      position: 'fixed', top: 80, left: '50%', transform: 'translateX(-50%)',
      zIndex: 9980, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4,
      padding: '12px 24px', borderRadius: 16,
      background: 'linear-gradient(135deg, rgba(255,184,0,0.15), rgba(255,184,0,0.05))',
      border: '1px solid var(--gold-subtle)',
      boxShadow: '0 4px 24px rgba(255,184,0,0.2)',
      animation: 'streakSlideIn 0.4s cubic-bezier(0.34,1.56,0.64,1)',
    }}>
      <span style={{ fontFamily: 'var(--font-display)', fontSize: 13, fontWeight: 700, color: 'var(--gold-primary)', letterSpacing: 1 }}>
        {toast.streak} Tage Streak!
      </span>
      <span style={{ fontFamily: 'var(--font-body)', fontSize: 12, color: 'var(--text-secondary)' }}>
        +{toast.coins} Coins{toast.badge ? ` + ${toast.badge}` : ''}
      </span>
      <style>{`
        @keyframes streakSlideIn {
          0% { opacity: 0; transform: translateX(-50%) translateY(-20px); }
          100% { opacity: 1; transform: translateX(-50%) translateY(0); }
        }
      `}</style>
    </div>
  )
}
