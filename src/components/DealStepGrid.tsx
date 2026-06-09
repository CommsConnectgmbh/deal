'use client'
import { useEffect, useState, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import ProfileImage from '@/components/ProfileImage'

type Participant = {
  id: string
  username?: string | null
  display_name?: string | null
  avatar_url?: string | null
}

type StepRow = { user_id: string; step_index: number }

interface Props {
  dealId: string
  targetSteps: number
  creator: Participant
  opponent: Participant | null
  performerId?: string | null
  currentUserId: string | null
}

export default function DealStepGrid({
  dealId, targetSteps, creator, opponent, performerId, currentUserId,
}: Props) {
  const [done, setDone] = useState<Record<string, Set<number>>>({})
  const [busy, setBusy] = useState<string | null>(null)

  const setDoneFor = useCallback((userId: string, fn: (prev: Set<number>) => Set<number>) => {
    setDone(prev => ({ ...prev, [userId]: fn(prev[userId] ?? new Set<number>()) }))
  }, [])

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      const { data } = await supabase
        .from('deal_progress_steps')
        .select('user_id, step_index')
        .eq('deal_id', dealId)
      if (cancelled) return
      const map: Record<string, Set<number>> = {}
      for (const r of (data || []) as StepRow[]) {
        if (!map[r.user_id]) map[r.user_id] = new Set()
        map[r.user_id].add(r.step_index)
      }
      setDone(map)
    })()
    return () => { cancelled = true }
  }, [dealId])

  useEffect(() => {
    const ch = supabase
      .channel(`deal_steps_${dealId}`)
      .on('postgres_changes', {
        event: '*', schema: 'public', table: 'deal_progress_steps',
        filter: `deal_id=eq.${dealId}`,
      }, (payload: any) => {
        const row = (payload.new || payload.old) as StepRow
        if (!row) return
        if (payload.eventType === 'INSERT') {
          setDoneFor(row.user_id, prev => { const n = new Set(prev); n.add(row.step_index); return n })
        } else if (payload.eventType === 'DELETE') {
          setDoneFor(row.user_id, prev => { const n = new Set(prev); n.delete(row.step_index); return n })
        }
      })
      .subscribe()
    return () => { supabase.removeChannel(ch) }
  }, [dealId, setDoneFor])

  const handleToggle = async (userId: string, step: number) => {
    if (userId !== currentUserId) return
    if (performerId && userId !== performerId) return
    const key = `${userId}:${step}`
    if (busy) return
    setBusy(key)
    const wasDone = done[userId]?.has(step) ?? false
    setDoneFor(userId, prev => {
      const n = new Set(prev)
      if (wasDone) n.delete(step); else n.add(step)
      return n
    })
    const { error } = await supabase.rpc('toggle_deal_step', {
      p_deal_id: dealId,
      p_step_index: step,
    })
    if (error) {
      // Rollback
      setDoneFor(userId, prev => {
        const n = new Set(prev)
        if (wasDone) n.add(step); else n.delete(step)
        return n
      })
    }
    setBusy(null)
  }

  const indices = Array.from({ length: targetSteps }, (_, i) => i + 1)
  const all = [creator, opponent].filter(Boolean) as Participant[]
  const rows = performerId ? all.filter(p => p.id === performerId) : all

  return (
    <div style={{
      padding: 14, borderRadius: 14,
      background: 'var(--bg-elevated)',
      border: '1px solid var(--border-subtle)',
      marginBottom: 12,
    }}>
      <p style={{
        fontFamily: 'var(--font-display)', fontSize: 10, letterSpacing: 2,
        color: 'var(--text-muted)', marginBottom: 10, textAlign: 'center',
      }}>
        FORTSCHRITT · {targetSteps} SCHRITTE
      </p>

      {rows.map(p => {
        const set = done[p.id] ?? new Set<number>()
        const completedCount = set.size
        const isMe = p.id === currentUserId
        return (
          <div key={p.id} style={{ marginBottom: 12 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
              <ProfileImage size={24} avatarUrl={p.avatar_url} name={p.display_name || p.username || '?'} />
              <span style={{
                fontFamily: 'var(--font-display)', fontSize: 12, fontWeight: 700,
                color: 'var(--text-primary)', letterSpacing: 0.5, flex: 1,
              }}>
                @{p.username}{isMe ? ' (Du)' : ''}
              </span>
              <span style={{
                fontFamily: 'var(--font-display)', fontSize: 13, fontWeight: 800,
                color: completedCount === targetSteps ? 'var(--gold-primary)' : 'var(--text-secondary)',
              }}>
                {completedCount} / {targetSteps}
              </span>
            </div>

            <div style={{
              display: 'grid',
              gridTemplateColumns: `repeat(${Math.min(targetSteps, 10)}, 1fr)`,
              gap: 6,
            }}>
              {indices.map(i => {
                const isDone = set.has(i)
                const clickable = isMe
                return (
                  <button
                    key={i}
                    onClick={() => clickable && handleToggle(p.id, i)}
                    disabled={!clickable || busy === `${p.id}:${i}`}
                    style={{
                      aspectRatio: '1 / 1',
                      borderRadius: 8,
                      border: isDone
                        ? '1.5px solid var(--gold-primary)'
                        : '1.5px solid var(--border-subtle)',
                      background: isDone ? 'var(--gold-primary)' : 'transparent',
                      color: isDone ? 'var(--text-inverse)' : 'var(--text-muted)',
                      fontFamily: 'var(--font-display)', fontSize: 12, fontWeight: 700,
                      cursor: clickable ? 'pointer' : 'default',
                      transition: 'all 0.15s',
                      opacity: clickable || isDone ? 1 : 0.55,
                      padding: 0,
                    }}
                  >
                    {isDone ? '✓' : i}
                  </button>
                )
              })}
            </div>
          </div>
        )
      })}

      {currentUserId && (
        <p style={{
          fontSize: 11, color: 'var(--text-muted)', textAlign: 'center', marginTop: 4,
        }}>
          Tippe deine Kästchen, um Schritte abzuhaken — der andere sieht es sofort.
        </p>
      )}
    </div>
  )
}
