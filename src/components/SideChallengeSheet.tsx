'use client'
import React, { useState, useEffect } from 'react'
import ProfileImage from '@/components/ProfileImage'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/contexts/AuthContext'
import { useLang } from '@/contexts/LanguageContext'

interface SideChallenge {
  id: string
  user_id: string
  side: 'a' | 'b'
  stake: string
  status: string
  coins_awarded: number
  created_at: string
  user?: { username: string }
}

interface Props {
  dealId: string
  open: boolean
  onClose: () => void
  creatorName: string
  opponentName: string
  creatorAvatarUrl?: string | null
  opponentAvatarUrl?: string | null
  /** Pass deal status for resolution display */
  dealStatus?: string
  /** Winner ID for resolution display */
  winnerId?: string | null
  creatorId?: string
  opponentId?: string
}

export default function SideChallengeSheet({
  dealId, open, onClose,
  creatorName, opponentName,
  creatorAvatarUrl, opponentAvatarUrl,
  dealStatus, winnerId, creatorId, opponentId,
}: Props) {
  const { profile } = useAuth()
  const { t } = useLang()
  const [sideChallenges, setSideChallenges] = useState<SideChallenge[]>([])
  const [selectedSide, setSelectedSide] = useState<'a' | 'b' | null>(null)
  const [stake, setStake] = useState('')
  const [sending, setSending] = useState(false)
  const [loading, setLoading] = useState(true)
  const [myChallenge, setMyChallenge] = useState<SideChallenge | null>(null)

  useEffect(() => {
    if (open) loadSideChallenges()
  }, [open, dealId])

  const loadSideChallenges = async () => {
    setLoading(true)
    const { data } = await supabase
      .from('deal_side_challenges')
      .select('id, user_id, side, stake, status, coins_awarded, created_at')
      .eq('deal_id', dealId)
      .order('created_at', { ascending: false })

    if (data && data.length > 0) {
      const userIds = [...new Set(data.map((b: any) => b.user_id))]
      const { data: profiles } = await supabase.from('profiles').select('id, username').in('id', userIds)
      const profileMap = new Map((profiles || []).map((p: any) => [p.id, p]))

      const enriched = data.map((b: any) => ({
        ...b,
        user: profileMap.get(b.user_id) || { username: '?' },
      }))
      setSideChallenges(enriched)

      if (profile) {
        const mine = enriched.find((b: any) => b.user_id === profile.id)
        setMyChallenge(mine || null)
        if (mine) {
          setSelectedSide(mine.side)
          setStake(mine.stake)
        }
      }
    } else {
      setSideChallenges([])
      setMyChallenge(null)
    }
    setLoading(false)
  }

  const placeChallenge = async () => {
    if (!profile || !selectedSide || !stake.trim() || sending) return
    setSending(true)
    const { error } = await supabase.from('deal_side_challenges').upsert({
      deal_id: dealId,
      user_id: profile.id,
      side: selectedSide,
      stake: stake.trim(),
    }, { onConflict: 'deal_id,user_id' })
    if (!error) {
      await loadSideChallenges()
      setStake('')
      setSelectedSide(null)
    }
    setSending(false)
  }

  if (!open) return null

  const sideACount = sideChallenges.filter(b => b.side === 'a').length
  const sideBCount = sideChallenges.filter(b => b.side === 'b').length
  const isResolved = dealStatus === 'completed' && winnerId
  const winningSide: 'a' | 'b' | null = isResolved ? (winnerId === creatorId ? 'a' : 'b') : null
  const canPredict = !myChallenge && (dealStatus === 'active' || dealStatus === 'open' || dealStatus === 'pending')

  return (
    <div style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.85)',
      display: 'flex', alignItems: 'flex-end', zIndex: 300,
    }} onClick={onClose}>
      <div style={{
        width: '100%', maxWidth: 430, margin: '0 auto',
        background: 'var(--bg-surface)', borderRadius: '20px 20px 0 0',
        border: '1px solid var(--border-subtle)',
        maxHeight: '80vh', display: 'flex', flexDirection: 'column',
      }} onClick={e => e.stopPropagation()}>

        {/* Header */}
        <div style={{
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          padding: '16px 20px 12px', borderBottom: '1px solid var(--border-subtle)',
        }}>
          <span style={{ fontFamily: 'var(--font-display)', fontSize: 14, color: 'var(--text-primary)', letterSpacing: 2 }}>
            {t('components.sideChallenges')}
          </span>
          <button onClick={onClose} style={{
            background: 'none', border: 'none', color: 'var(--text-muted)', fontSize: 20, cursor: 'pointer',
          }}>✕</button>
        </div>

        <div style={{ flex: 1, overflowY: 'auto', padding: '16px 20px', scrollbarWidth: 'none' }}>
          {/* Resolution banner */}
          {isResolved && (
            <div style={{ padding: 14, background: 'rgba(255,184,0,0.06)', borderRadius: 12, border: '1px solid rgba(255,184,0,0.2)', marginBottom: 16, textAlign: 'center' }}>
              <p style={{ fontSize: 16, marginBottom: 4 }}>👑</p>
              <p style={{ fontFamily: 'var(--font-display)', fontSize: 12, color: 'var(--gold-primary)', letterSpacing: 1 }}>
                @{winningSide === 'a' ? creatorName : opponentName} {t('components.hasWon')}
              </p>
            </div>
          )}

          {/* Coin reward banner */}
          {!isResolved && (
            <div style={{
              background: 'linear-gradient(135deg, rgba(245,158,11,0.08), rgba(245,158,11,0.02))',
              border: '1px solid rgba(245,158,11,0.25)', borderRadius: 12,
              padding: '12px 16px', marginBottom: 16, textAlign: 'center',
            }}>
              <p style={{ fontFamily: 'var(--font-display)', fontSize: 13, color: 'var(--gold-primary)', letterSpacing: 1, margin: 0 }}>
                {t('components.coinsOnCorrectChallenge')}
              </p>
              <p style={{ fontSize: 11, color: 'var(--text-muted)', margin: '4px 0 0' }}>
                {t('components.tipOnWinnerEarnCoins')}
              </p>
            </div>
          )}

          {/* Side Selection */}
          {canPredict && (
            <>
              <p style={{ fontSize: 14, color: 'var(--text-secondary)', marginBottom: 12, textAlign: 'center' }}>{t('components.whoWins')}</p>
              <div style={{ display: 'flex', gap: 12, marginBottom: 20 }}>
                {/* Side A */}
                <button onClick={() => setSelectedSide('a')} style={{
                  flex: 1, padding: 16, borderRadius: 12, cursor: 'pointer',
                  background: selectedSide === 'a' ? 'rgba(245,158,11,0.1)' : 'var(--bg-deepest)',
                  border: selectedSide === 'a' ? '2px solid rgba(245,158,11,0.5)' : '2px solid var(--border-subtle)',
                  display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8,
                }}>
                  <ProfileImage size={48} avatarUrl={creatorAvatarUrl} name={creatorName} />
                  <span style={{ fontSize: 12, fontWeight: 600, color: selectedSide === 'a' ? 'var(--gold-primary)' : '#9CA3AF' }}>
                    @{creatorName}
                  </span>
                  <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>{sideACount} {t('components.challenges')}</span>
                </button>

                {/* Side B */}
                <button onClick={() => setSelectedSide('b')} style={{
                  flex: 1, padding: 16, borderRadius: 12, cursor: 'pointer',
                  background: selectedSide === 'b' ? 'rgba(59,130,246,0.1)' : 'var(--bg-deepest)',
                  border: selectedSide === 'b' ? '2px solid rgba(59,130,246,0.5)' : '2px solid var(--border-subtle)',
                  display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8,
                }}>
                  <ProfileImage size={48} avatarUrl={opponentAvatarUrl} name={opponentName} />
                  <span style={{ fontSize: 12, fontWeight: 600, color: selectedSide === 'b' ? '#3B82F6' : '#9CA3AF' }}>
                    @{opponentName}
                  </span>
                  <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>{sideBCount} {t('components.challenges')}</span>
                </button>
              </div>

              {/* Stake input */}
              {selectedSide && (
                <>
                  <p style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 6 }}>{t('components.yourStake')}</p>
                  <input
                    value={stake}
                    onChange={e => setStake(e.target.value.slice(0, 200))}
                    placeholder={t('components.stakePlaceholder')}
                    style={{
                      width: '100%', background: 'var(--bg-deepest)', border: '1px solid var(--border-subtle)',
                      borderRadius: 10, padding: '10px 14px', color: 'var(--text-primary)', fontSize: 13, outline: 'none',
                      marginBottom: 12,
                    }}
                  />
                  <button
                    onClick={placeChallenge}
                    disabled={!stake.trim() || sending}
                    style={{
                      width: '100%', padding: 14, borderRadius: 12, border: 'none', cursor: 'pointer',
                      background: stake.trim() ? 'linear-gradient(135deg, var(--gold-dim), var(--gold-primary))' : 'var(--border-subtle)',
                      color: stake.trim() ? 'var(--text-inverse)' : 'var(--text-muted)',
                      fontFamily: 'var(--font-display)', fontSize: 12, fontWeight: 700, letterSpacing: 2,
                      marginBottom: 20,
                    }}
                  >
                    {sending ? t('components.placing') : t('components.placeChallenge')}
                  </button>
                </>
              )}
            </>
          )}

          {myChallenge && (
            <div style={{
              background: myChallenge.status === 'won' ? 'rgba(34,197,94,0.06)' : myChallenge.status === 'lost' ? 'rgba(239,68,68,0.06)' : 'rgba(245,158,11,0.06)',
              border: `1px solid ${myChallenge.status === 'won' ? 'rgba(34,197,94,0.3)' : myChallenge.status === 'lost' ? 'rgba(239,68,68,0.2)' : 'rgba(245,158,11,0.2)'}`,
              borderRadius: 12, padding: 16, marginBottom: 16, textAlign: 'center',
            }}>
              {myChallenge.status === 'won' ? (
                <>
                  <p style={{ fontSize: 13, color: '#22C55E', marginBottom: 4, fontWeight: 700 }}>{t('components.won')}</p>
                  <p style={{ fontSize: 14, color: '#22C55E', fontWeight: 700 }}>+{myChallenge.coins_awarded || 25} Coins 🪙</p>
                </>
              ) : myChallenge.status === 'lost' ? (
                <>
                  <p style={{ fontSize: 13, color: '#EF4444', marginBottom: 4, fontWeight: 700 }}>{t('components.lost')}</p>
                  <p style={{ fontSize: 12, color: 'var(--text-muted)' }}>{t('components.tipWrongShort').replace('{name}', myChallenge.side === 'a' ? creatorName : opponentName)}</p>
                </>
              ) : (
                <>
                  <p style={{ fontSize: 13, color: 'var(--gold-primary)', marginBottom: 4 }}>{t('components.yourChallenge')}</p>
                  <p style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
                    {t('components.youChallengeOn')} <span style={{ color: 'var(--gold-primary)', fontWeight: 600 }}>@{myChallenge.side === 'a' ? creatorName : opponentName}</span>
                  </p>
                  <p style={{ fontSize: 12, color: 'var(--text-primary)', marginTop: 4 }}>{t('components.stake')}: {myChallenge.stake}</p>
                  <p style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>{t('components.coinsOnCorrectTip')}</p>
                </>
              )}
            </div>
          )}

          {/* Existing side bets */}
          {sideChallenges.length > 0 && (
            <>
              <p style={{ fontSize: 12, color: 'var(--text-muted)', letterSpacing: 1, marginBottom: 8, fontFamily: 'var(--font-display)' }}>
                {t('components.currentSideChallenges')} ({sideChallenges.length})
              </p>
              {sideChallenges.map(b => (
                <div key={b.id} style={{
                  display: 'flex', alignItems: 'center', gap: 8,
                  padding: '8px 0', borderBottom: '1px solid var(--bg-elevated)',
                }}>
                  <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
                    @{b.user?.username}
                  </span>
                  <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>{t('components.challengesOn')}</span>
                  <span style={{
                    fontSize: 12, fontWeight: 600,
                    color: b.side === 'a' ? 'var(--gold-primary)' : '#3B82F6',
                  }}>
                    @{b.side === 'a' ? creatorName : opponentName}
                  </span>
                  <span style={{ fontSize: 11, color: 'var(--text-primary)', marginLeft: 'auto' }}>{b.stake}</span>
                  {isResolved && winningSide && (
                    <span style={{
                      fontSize: 9, padding: '2px 6px', borderRadius: 6, marginLeft: 6,
                      background: b.side === winningSide ? 'rgba(74,222,128,0.15)' : 'rgba(248,113,113,0.1)',
                      color: b.side === winningSide ? '#4ade80' : '#f87171',
                      fontWeight: 700, letterSpacing: 1,
                    }}>
                      {b.side === winningSide ? '✅ +25🪙' : '✗'}
                    </span>
                  )}
                </div>
              ))}
            </>
          )}

          {!loading && sideChallenges.length === 0 && myChallenge === null && (
            <p style={{ textAlign: 'center', color: 'var(--text-muted)', fontSize: 13, padding: 16 }}>
              {t('components.noSideChallengesYet')}
            </p>
          )}
        </div>
      </div>
    </div>
  )
}
