'use client'
import { useEffect, useState, useMemo } from 'react'
import { supabase } from '@/lib/supabase'
import ProfileImage from '@/components/ProfileImage'
import { useLang } from '@/contexts/LanguageContext'

type Participant = {
  id: string
  username?: string | null
  display_name?: string | null
  avatar_url?: string | null
}

type Sample = {
  id: string
  deal_id: string
  user_id: string
  metric: string
  value: number
  source: string
  sampled_at: string
}

interface Props {
  dealId: string
  metric: string
  metricLabel: string
  unit?: string
  creator: Participant
  opponent: Participant
  currentUserId: string | null
  isParticipant: boolean
}

const STEP_KEYWORDS = [
  'schritt', 'step', 'walk', 'lauf', 'gehen', 'spazier',
]

export function detectStepChallenge(title?: string | null): boolean {
  if (!title) return false
  const lower = title.toLowerCase()
  return STEP_KEYWORDS.some(k => lower.includes(k))
}

export default function LiveMetricTracker({
  dealId, metric, metricLabel, unit,
  creator, opponent, currentUserId, isParticipant,
}: Props) {
  const { t } = useLang()
  const [samples, setSamples] = useState<Record<string, Sample>>({})
  const [loading, setLoading] = useState(true)
  const [inputOpen, setInputOpen] = useState(false)
  const [inputValue, setInputValue] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Initial fetch: latest sample per user.
  useEffect(() => {
    let cancelled = false
    ;(async () => {
      const { data } = await supabase
        .from('deal_metric_samples')
        .select('*')
        .eq('deal_id', dealId)
        .eq('metric', metric)
        .order('sampled_at', { ascending: false })
      if (cancelled) return
      const latest: Record<string, Sample> = {}
      for (const s of (data || []) as Sample[]) {
        if (!latest[s.user_id]) latest[s.user_id] = s
      }
      setSamples(latest)
      setLoading(false)
    })()
    return () => { cancelled = true }
  }, [dealId, metric])

  // Realtime: new inserts update the per-user latest if newer.
  useEffect(() => {
    const ch = supabase
      .channel(`deal_metric_${dealId}`)
      .on('postgres_changes', {
        event: 'INSERT', schema: 'public', table: 'deal_metric_samples',
        filter: `deal_id=eq.${dealId}`,
      }, (payload: any) => {
        const s = payload.new as Sample
        if (s.metric !== metric) return
        setSamples(prev => {
          const existing = prev[s.user_id]
          if (existing && new Date(existing.sampled_at) >= new Date(s.sampled_at)) return prev
          return { ...prev, [s.user_id]: s }
        })
      })
      .subscribe()
    return () => { supabase.removeChannel(ch) }
  }, [dealId, metric])

  const creatorVal = samples[creator.id]?.value ?? null
  const opponentVal = samples[opponent.id]?.value ?? null
  const both = creatorVal != null && opponentVal != null
  const max = Math.max(creatorVal ?? 0, opponentVal ?? 0, 1)
  const leader = useMemo(() => {
    if (creatorVal == null || opponentVal == null) return null
    if (creatorVal === opponentVal) return 'tie'
    return creatorVal > opponentVal ? creator.id : opponent.id
  }, [creatorVal, opponentVal, creator.id, opponent.id])

  const handleSubmit = async () => {
    if (!currentUserId) return
    const num = Number(inputValue.replace(/[.,]/g, ''))
    if (!Number.isFinite(num) || num < 0) {
      setError(t('liveTracker.invalidValue'))
      return
    }
    const existing = samples[currentUserId]?.value ?? -1
    if (num < existing) {
      setError(t('liveTracker.mustBeHigher'))
      return
    }
    setSubmitting(true)
    setError(null)
    const { error: insErr } = await supabase.from('deal_metric_samples').insert({
      deal_id: dealId,
      user_id: currentUserId,
      metric,
      value: num,
      source: 'manual',
    })
    setSubmitting(false)
    if (insErr) {
      setError(insErr.message)
      return
    }
    setInputValue('')
    setInputOpen(false)
  }

  const fmt = (n: number | null) => n == null ? '—' : n.toLocaleString('de-DE')
  const pct = (n: number | null) => n == null ? 0 : Math.round((n / max) * 100)

  const ColumnSide = ({ user, value, isLeader }: { user: Participant, value: number | null, isLeader: boolean }) => (
    <div style={{ flex: 1, minWidth: 0, textAlign: 'center' }}>
      <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 6 }}>
        <ProfileImage
          size={36}
          avatarUrl={user.avatar_url}
          name={user.display_name || user.username || ''}
          goldBorder={isLeader}
        />
      </div>
      <p style={{
        fontSize: 11, color: 'var(--text-muted)', marginBottom: 2,
        overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
      }}>
        @{user.username}
      </p>
      <p className="font-display" style={{
        fontSize: 22, fontWeight: 700,
        color: isLeader ? 'var(--gold-primary)' : 'var(--text-primary)',
        letterSpacing: 0.5, lineHeight: 1.1,
      }}>
        {fmt(value)}
      </p>
      {unit && <p style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 2 }}>{unit}</p>}
    </div>
  )

  return (
    <div style={{
      margin: '8px 16px 0',
      padding: 14,
      background: 'var(--bg-surface)',
      border: '1px solid var(--border-subtle)',
      borderRadius: 14,
    }}>
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12,
      }}>
        <p className="font-display" style={{ fontSize: 9, letterSpacing: 2, color: 'var(--gold-primary)' }}>
          {'🔴'} {t('liveTracker.live')} · {metricLabel}
        </p>
        {both && leader === 'tie' && (
          <p className="font-display" style={{ fontSize: 9, letterSpacing: 1.5, color: 'var(--text-muted)' }}>
            {t('liveTracker.tied')}
          </p>
        )}
      </div>

      {loading ? (
        <p style={{ textAlign: 'center', fontSize: 12, color: 'var(--text-muted)', padding: '12px 0' }}>
          {t('liveTracker.loading')}
        </p>
      ) : (
        <>
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12, marginBottom: 12 }}>
            <ColumnSide user={creator} value={creatorVal} isLeader={leader === creator.id} />
            <div style={{
              alignSelf: 'center', fontFamily: 'var(--font-display)', fontSize: 11,
              color: 'var(--text-muted)', letterSpacing: 1.5,
            }}>VS</div>
            <ColumnSide user={opponent} value={opponentVal} isLeader={leader === opponent.id} />
          </div>

          {/* Progress bars */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 12 }}>
            {[
              { user: creator, value: creatorVal },
              { user: opponent, value: opponentVal },
            ].map(({ user, value }) => (
              <div key={user.id} style={{
                height: 6, borderRadius: 3,
                background: 'var(--bg-overlay)', overflow: 'hidden',
              }}>
                <div style={{
                  width: `${pct(value)}%`, height: '100%',
                  background: leader === user.id
                    ? 'linear-gradient(90deg, var(--gold-dim), var(--gold-primary))'
                    : 'var(--text-muted)',
                  transition: 'width 600ms ease',
                }} />
              </div>
            ))}
          </div>

          {/* Self-update */}
          {isParticipant && currentUserId && (
            inputOpen ? (
              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <input
                  type="number"
                  inputMode="numeric"
                  autoFocus
                  value={inputValue}
                  onChange={e => { setInputValue(e.target.value); setError(null) }}
                  placeholder={t('liveTracker.placeholder').replace('{metric}', metricLabel.toLowerCase())}
                  min={samples[currentUserId]?.value ?? 0}
                  style={{
                    flex: 1, padding: '10px 12px', borderRadius: 8,
                    border: '1px solid var(--border-subtle)', background: 'var(--bg-elevated)',
                    color: 'var(--text-primary)', fontSize: 14, outline: 'none',
                  }}
                />
                <button
                  onClick={handleSubmit}
                  disabled={submitting || !inputValue}
                  style={{
                    padding: '10px 16px', borderRadius: 8, border: 'none', cursor: 'pointer',
                    background: 'linear-gradient(135deg, var(--gold-dim), var(--gold-primary))',
                    color: 'var(--text-inverse)', fontFamily: 'var(--font-display)', fontSize: 10,
                    letterSpacing: 1, opacity: submitting || !inputValue ? 0.5 : 1,
                  }}
                >
                  {submitting ? '…' : t('liveTracker.save')}
                </button>
                <button
                  onClick={() => { setInputOpen(false); setInputValue(''); setError(null) }}
                  style={{
                    padding: '10px 12px', borderRadius: 8, cursor: 'pointer',
                    background: 'transparent', color: 'var(--text-muted)',
                    border: '1px solid var(--border-subtle)', fontSize: 12,
                  }}
                >
                  ✕
                </button>
              </div>
            ) : (
              <button
                onClick={() => {
                  setInputOpen(true)
                  setInputValue(String(samples[currentUserId]?.value ?? ''))
                }}
                style={{
                  width: '100%', padding: '10px', borderRadius: 8, cursor: 'pointer',
                  background: 'var(--bg-elevated)', color: 'var(--text-primary)',
                  border: '1px solid var(--border-subtle)', fontFamily: 'var(--font-display)',
                  fontSize: 10, letterSpacing: 1.5,
                }}
              >
                {samples[currentUserId]
                  ? t('liveTracker.updateMyValue').replace('{metric}', metricLabel)
                  : t('liveTracker.enterMyValue').replace('{metric}', metricLabel)}
              </button>
            )
          )}

          {error && (
            <p style={{ fontSize: 11, color: 'var(--status-error)', marginTop: 8, textAlign: 'center' }}>
              {error}
            </p>
          )}

          <p style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 10, textAlign: 'center', lineHeight: 1.5 }}>
            {t('liveTracker.hint')}
          </p>
        </>
      )}
    </div>
  )
}
