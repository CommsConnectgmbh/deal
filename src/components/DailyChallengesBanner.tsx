'use client'
import { useState, useEffect } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { supabase } from '@/lib/supabase'
import { useRouter } from 'next/navigation'

export default function DailyChallengesBanner() {
  const { profile } = useAuth()
  const router = useRouter()
  const [total, setTotal] = useState(0)
  const [completed, setCompleted] = useState(0)
  const [claimable, setClaimable] = useState(0)

  useEffect(() => {
    if (!profile) return
    const today = new Date().toISOString().split('T')[0]
    const load = async () => {
      const [chRes, prRes] = await Promise.all([
        supabase.from('daily_challenges').select('id').eq('day_date', today),
        supabase.from('user_daily_progress').select('challenge_id, completed, claimed').eq('user_id', profile.id),
      ])
      const challengeIds = new Set(chRes.data?.map((c: any) => c.id) || [])
      const relevant = prRes.data?.filter((p: any) => challengeIds.has(p.challenge_id)) || []
      setTotal(chRes.data?.length || 0)
      setCompleted(relevant.filter((p: any) => p.completed).length)
      setClaimable(relevant.filter((p: any) => p.completed && !p.claimed).length)
    }
    load()
  }, [profile])

  if (total === 0) return null

  return (
    <button
      onClick={() => router.push('/app/challenges')}
      style={{
        width: '100%', display: 'flex', alignItems: 'center',
        justifyContent: 'space-between', padding: '10px 16px',
        background: 'var(--bg-surface)', border: 'none',
        borderBottom: '1px solid var(--border-subtle)',
        cursor: 'pointer', minHeight: 44,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <span style={{ fontSize: 16 }}>{'🎯'}</span>
        <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
          Challenges: <strong style={{ color: 'var(--text-primary)' }}>{completed}/{total}</strong> erledigt
        </span>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        {claimable > 0 && (
          <span style={{
            minWidth: 20, height: 20, borderRadius: 10,
            background: 'var(--gold-primary)', color: 'var(--text-inverse)',
            fontSize: 10, fontWeight: 700, display: 'flex',
            alignItems: 'center', justifyContent: 'center', padding: '0 6px',
          }}>{claimable}</span>
        )}
        <span style={{ fontSize: 14, color: 'var(--text-muted)' }}>{'›'}</span>
      </div>
    </button>
  )
}
