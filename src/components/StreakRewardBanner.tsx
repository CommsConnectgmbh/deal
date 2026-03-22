'use client'
import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'

interface StreakRewardBannerProps {
  currentStreak: number
  userId: string
}

interface StreakMilestone {
  streak_count: number
  reward_name: string
  reward_icon: string
  reward_amount?: string
}

const FALLBACK_MILESTONES: StreakMilestone[] = [
  { streak_count: 3, reward_name: 'Bronze Pack', reward_icon: '🎴' },
  { streak_count: 5, reward_name: '500 Coins', reward_icon: '🪙', reward_amount: '500 Coins' },
  { streak_count: 7, reward_name: 'Silver Pack', reward_icon: '🎴' },
  { streak_count: 10, reward_name: '1000 Coins + Gold Pack', reward_icon: '🪙🎴', reward_amount: '1000 Coins + Gold Pack' },
  { streak_count: 15, reward_name: 'Prestige Pack', reward_icon: '✨' },
]

export default function StreakRewardBanner({ currentStreak, userId }: StreakRewardBannerProps) {
  const [nextMilestone, setNextMilestone] = useState<StreakMilestone | null>(null)
  const [maxedOut, setMaxedOut] = useState(false)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!userId) return

    const load = async () => {
      try {
        const { data, error } = await supabase
          .from('streak_rewards')
          .select('streak_count, reward_name, reward_icon, reward_amount')
          .gt('streak_count', currentStreak)
          .order('streak_count', { ascending: true })
          .limit(1)

        if (!error && data && data.length > 0) {
          setNextMilestone(data[0] as StreakMilestone)
          setMaxedOut(false)
        } else {
          // Use fallback milestones
          const fallback = FALLBACK_MILESTONES.find(m => m.streak_count > currentStreak)
          if (fallback) {
            setNextMilestone(fallback)
            setMaxedOut(false)
          } else {
            setNextMilestone(null)
            setMaxedOut(true)
          }
        }
      } catch {
        const fallback = FALLBACK_MILESTONES.find(m => m.streak_count > currentStreak)
        if (fallback) {
          setNextMilestone(fallback)
          setMaxedOut(false)
        } else {
          setNextMilestone(null)
          setMaxedOut(true)
        }
      } finally {
        setLoading(false)
      }
    }

    load()
  }, [currentStreak, userId])

  if (loading) return null

  // Determine the previous milestone for progress dots
  const milestoneThresholds = FALLBACK_MILESTONES.map(m => m.streak_count)
  const prevMilestone = [...milestoneThresholds].reverse().find(t => t <= currentStreak) || 0
  const targetMilestone = nextMilestone?.streak_count || prevMilestone
  const totalDots = Math.min(targetMilestone - prevMilestone, 10)
  const filledDots = Math.min(currentStreak - prevMilestone, totalDots)

  return (
    <div
      style={{
        width: '100%',
        display: 'flex',
        alignItems: 'center',
        padding: '14px 16px',
        background: 'linear-gradient(135deg, var(--bg-deepest) 0%, var(--bg-surface) 60%, rgba(255, 184, 0, 0.06) 100%)',
        border: '1px solid var(--gold-dim, rgba(255, 184, 0, 0.25))',
        borderRadius: 'var(--radius-lg, 14px)',
        gap: 14,
        position: 'relative',
        overflow: 'hidden',
        cursor: 'pointer',
      }}
    >
      {/* Subtle gold shimmer overlay */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          background: 'linear-gradient(90deg, transparent 0%, rgba(255, 184, 0, 0.03) 50%, transparent 100%)',
          pointerEvents: 'none',
        }}
      />

      {/* Left: Streak counter */}
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          minWidth: 52,
          flexShrink: 0,
          position: 'relative',
          zIndex: 1,
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 2,
          }}
        >
          <span style={{ fontSize: 22 }}>{'🔥'}</span>
          <span
            style={{
              fontSize: 26,
              fontWeight: 800,
              color: 'var(--gold-primary, #FFB800)',
              fontFamily: 'var(--font-display, Cinzel, serif)',
              lineHeight: 1,
            }}
          >
            {currentStreak}
          </span>
        </div>
        <span
          style={{
            fontSize: 9,
            fontWeight: 600,
            color: 'var(--text-muted, #888)',
            textTransform: 'uppercase',
            letterSpacing: 1.5,
            marginTop: 2,
            fontFamily: 'var(--font-body, sans-serif)',
          }}
        >
          Streak
        </span>
      </div>

      {/* Divider */}
      <div
        style={{
          width: 1,
          height: 40,
          background: 'var(--border-subtle, rgba(255,255,255,0.08))',
          flexShrink: 0,
        }}
      />

      {/* Center/Right: Milestone info */}
      <div
        style={{
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          gap: 4,
          minWidth: 0,
          position: 'relative',
          zIndex: 1,
        }}
      >
        {maxedOut ? (
          <>
            <span
              style={{
                fontSize: 11,
                color: 'var(--gold-primary, #FFB800)',
                fontWeight: 700,
                textTransform: 'uppercase',
                letterSpacing: 0.5,
              }}
            >
              {'✨'} Alle Meilensteine erreicht!
            </span>
            <span
              style={{
                fontSize: 13,
                color: 'var(--text-muted, #888)',
                fontFamily: 'var(--font-body, sans-serif)',
              }}
            >
              Du bist ein wahrer Champion.
            </span>
          </>
        ) : (
          <>
            <span
              style={{
                fontSize: 10,
                color: 'var(--text-muted, #888)',
                fontFamily: 'var(--font-body, sans-serif)',
                letterSpacing: 0.3,
              }}
            >
              Nächster Meilenstein:
            </span>
            <span
              style={{
                fontSize: 14,
                fontWeight: 700,
                color: 'var(--text-primary, #fff)',
                fontFamily: 'var(--font-body, sans-serif)',
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
              }}
            >
              {nextMilestone?.streak_count}er Streak Bonus
            </span>
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 4,
              }}
            >
              <span style={{ fontSize: 13 }}>{nextMilestone?.reward_icon}</span>
              <span
                style={{
                  fontSize: 12,
                  color: 'var(--gold-primary, #FFB800)',
                  fontWeight: 600,
                  fontFamily: 'var(--font-body, sans-serif)',
                }}
              >
                {nextMilestone?.reward_amount || nextMilestone?.reward_name}
              </span>
            </div>

            {/* Progress dots */}
            {totalDots > 0 && (
              <div
                style={{
                  display: 'flex',
                  gap: 4,
                  marginTop: 2,
                }}
              >
                {Array.from({ length: totalDots }).map((_, i) => (
                  <div
                    key={i}
                    style={{
                      width: 6,
                      height: 6,
                      borderRadius: '50%',
                      background:
                        i < filledDots
                          ? 'var(--gold-primary, #FFB800)'
                          : 'var(--border-subtle, rgba(255,255,255,0.12))',
                      transition: 'background 0.3s ease',
                    }}
                  />
                ))}
              </div>
            )}
          </>
        )}
      </div>

      {/* Far right: Chevron */}
      <div
        style={{
          flexShrink: 0,
          display: 'flex',
          alignItems: 'center',
          position: 'relative',
          zIndex: 1,
        }}
      >
        <svg
          width={18}
          height={18}
          viewBox="0 0 24 24"
          fill="none"
          stroke="var(--text-muted, #888)"
          strokeWidth={2}
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <polyline points="9 18 15 12 9 6" />
        </svg>
      </div>
    </div>
  )
}
