'use client'
import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/contexts/AuthContext'
import { useLang } from '@/contexts/LanguageContext'
// ProfileImage removed — avatars removed from deals

interface Props {
  dealId: string
  creatorId: string
  opponentId?: string | null
  creatorName: string
  opponentName: string
  dealStatus: string
  winnerId?: string | null
  creatorAvatarUrl?: string | null
  opponentAvatarUrl?: string | null
}

export default function DealBetWidget({
  dealId, creatorId, opponentId, creatorName, opponentName, dealStatus, winnerId,
  creatorAvatarUrl, opponentAvatarUrl,
}: Props) {
  const { profile } = useAuth()
  const { t } = useLang()
  const [myBet, setMyBet] = useState<{ side: string; status: string; coins_awarded: number } | null>(null)
  const [betCounts, setBetCounts] = useState({ a: 0, b: 0 })
  const [saving, setSaving] = useState(false)
  const [loaded, setLoaded] = useState(false)
  const [justPicked, setJustPicked] = useState<'a' | 'b' | null>(null)

  const show = !!opponentId && ['active', 'completed'].includes(dealStatus)

  useEffect(() => {
    if (!show || !profile) return
    const load = async () => {
      const { data: myData } = await supabase
        .from('deal_side_bets')
        .select('side, status, coins_awarded')
        .eq('deal_id', dealId)
        .eq('user_id', profile.id)
        .maybeSingle()
      if (myData) setMyBet(myData)
      const { count: countA } = await supabase
        .from('deal_side_bets')
        .select('*', { count: 'exact', head: true })
        .eq('deal_id', dealId).eq('side', 'a')
      const { count: countB } = await supabase
        .from('deal_side_bets')
        .select('*', { count: 'exact', head: true })
        .eq('deal_id', dealId).eq('side', 'b')
      setBetCounts({ a: countA || 0, b: countB || 0 })
      setLoaded(true)
    }
    load()
  }, [show, dealId, profile])

  if (!show || !loaded) return null

  const isParticipant = profile?.id === creatorId || profile?.id === opponentId
  const isCompleted = dealStatus === 'completed' && winnerId
  const winningSide = winnerId === creatorId ? 'a' : 'b'
  const totalBets = betCounts.a + betCounts.b
  const pctA = totalBets > 0 ? Math.round((betCounts.a / totalBets) * 100) : 50
  const pctB = totalBets > 0 ? 100 - pctA : 50

  const placeBet = async (side: 'a' | 'b') => {
    if (!profile || isParticipant || myBet || saving || dealStatus === 'completed') return
    setSaving(true)
    setJustPicked(side)
    const { error } = await supabase.from('deal_side_bets').upsert({
      deal_id: dealId, user_id: profile.id, side, stake: '25 Coins',
    }, { onConflict: 'deal_id,user_id' })
    if (!error) {
      setMyBet({ side, status: 'open', coins_awarded: 0 })
      setBetCounts(prev => ({ ...prev, [side]: prev[side] + 1 }))
      // Feed event: side_bet_placed
      supabase.from('feed_events').insert({
        event_type: 'side_bet_placed',
        user_id: profile.id,
        deal_id: dealId,
        metadata: { side, title: side === 'a' ? creatorName : opponentName },
      }).then(() => {})
    }
    setSaving(false)
  }

  const colorA = '#FFB800'
  const colorB = '#3B82F6'

  const myPickSide = myBet?.side || null
  const showResult = isCompleted && myBet
  const iWon = showResult && myBet?.status === 'won'
  const iLost = showResult && myBet?.status === 'lost'
  const canBet = !myBet && !isParticipant && dealStatus === 'active'

  const nameA = creatorName.length > 10 ? creatorName.slice(0, 10) + '\u2026' : creatorName
  const nameB = opponentName.length > 10 ? opponentName.slice(0, 10) + '\u2026' : opponentName

  // Loser dezent ausfaden
  const opacityA = isCompleted && winningSide !== 'a' ? 0.35
    : totalBets > 0 && pctA < pctB ? 0.7 : 1
  const opacityB = isCompleted && winningSide !== 'b' ? 0.35
    : totalBets > 0 && pctB < pctA ? 0.7 : 1

  // Bar gradient position: pctA bestimmt wo Gold aufhört und Blau anfängt
  const barGradientPos = pctA

  return (
    <div onClick={(e) => e.stopPropagation()} style={{
      padding: '10px 10px 9px',
      background: 'linear-gradient(180deg, rgba(255,184,0,0.11) 0%, rgba(59,130,246,0.07) 100%)',
      borderTop: '1px solid var(--border-subtle)',
      borderBottom: '1px solid var(--border-subtle)',
      position: 'relative',
    }}>

      {/* ─── Header — natürlich, bündig mit Herz ─── */}
      <div style={{
        display: 'flex', alignItems: 'center',
        marginBottom: 5, paddingLeft: 4,
      }}>
        <span style={{
          fontFamily: 'var(--font-body)', fontSize: 10, fontWeight: 600,
          color: iWon ? '#22C55E' : iLost ? '#EF4444' : 'var(--gold-primary)',
        }}>
          {iWon ? t('components.correctTip')
            : iLost ? t('components.wrongTip')
            : t('components.tipAndWin')}
        </span>
      </div>

      {/* ─── Segmented Control — bündig mit Herz ─── */}
      <div style={{ position: 'relative', borderRadius: 10, overflow: 'hidden' }}>

        {/* Tendency fade */}
        <div style={{
          position: 'absolute', inset: 0,
          background: `linear-gradient(90deg, ${colorA}10 0%, transparent ${barGradientPos}%, transparent ${barGradientPos}%, ${colorB}10 100%)`,
          transition: 'background 0.8s ease',
          pointerEvents: 'none',
        }} />

        {/* Sliding highlight pill (nach Tipp) */}
        {(myPickSide || justPicked) && !isCompleted && (
          <div style={{
            position: 'absolute', top: 0, bottom: 0,
            width: '50%',
            left: (myPickSide || justPicked) === 'a' ? '0%' : '50%',
            background: `linear-gradient(${(myPickSide || justPicked) === 'a' ? '90deg' : '270deg'}, ${(myPickSide || justPicked) === 'a' ? colorA : colorB}15, transparent)`,
            transition: 'left 0.5s cubic-bezier(0.34, 1.56, 0.64, 1)',
            pointerEvents: 'none',
          }} />
        )}

        {/* Zwei Hälften */}
        <div style={{ display: 'flex', alignItems: 'center', position: 'relative', zIndex: 1 }}>

          {/* LEFT: Creator */}
          <div
            onClick={canBet ? (e) => { e.preventDefault(); e.stopPropagation(); placeBet('a') } : undefined}
            style={{
              flex: 1, display: 'flex', alignItems: 'center', gap: 5,
              padding: '5px 0',
              cursor: canBet ? 'pointer' : 'default',
              opacity: opacityA,
              transition: 'opacity 0.4s ease',
            }}
          >
            <span style={{
              fontSize: 11, fontWeight: 700, color: myPickSide === 'a' ? colorA : 'var(--text-primary)',
              fontFamily: 'var(--font-display)', whiteSpace: 'nowrap',
              letterSpacing: 0.3, flex: 1, minWidth: 0,
              overflow: 'hidden', textOverflow: 'ellipsis',
            }}>
              {nameA}
            </span>
            {betCounts.a > 0 && (
              <span style={{
                fontSize: 9, fontWeight: 600, color: 'var(--text-muted)',
                fontFamily: 'var(--font-body)', flexShrink: 0,
              }}>
                {betCounts.a}
              </span>
            )}
          </div>

          {/* Spacer between sides */}
          <div style={{ width: 8, flexShrink: 0 }} />

          {/* RIGHT: Opponent */}
          <div
            onClick={canBet ? (e) => { e.preventDefault(); e.stopPropagation(); placeBet('b') } : undefined}
            style={{
              flex: 1, display: 'flex', alignItems: 'center', gap: 5,
              padding: '5px 0',
              cursor: canBet ? 'pointer' : 'default',
              opacity: opacityB,
              transition: 'opacity 0.4s ease',
              flexDirection: 'row-reverse',
            }}
          >
            <span style={{
              fontSize: 11, fontWeight: 700, color: myPickSide === 'b' ? colorB : 'var(--text-primary)',
              fontFamily: 'var(--font-display)', whiteSpace: 'nowrap',
              letterSpacing: 0.3, flex: 1, minWidth: 0,
              overflow: 'hidden', textOverflow: 'ellipsis',
              textAlign: 'right',
            }}>
              {nameB}
            </span>
            {betCounts.b > 0 && (
              <span style={{
                fontSize: 9, fontWeight: 600, color: 'var(--text-muted)',
                fontFamily: 'var(--font-body)', flexShrink: 0,
              }}>
                {betCounts.b}
              </span>
            )}
          </div>
        </div>

      </div>

      {/* ─── Tug-of-War Bar with sliding VS ─── */}
      <div style={{ marginTop: 5, display: 'flex', alignItems: 'center', gap: 4 }}>
        {/* Left percentage */}
        <span style={{
          fontSize: 9, fontWeight: 900, color: colorA,
          fontFamily: 'var(--font-display)', lineHeight: 1, minWidth: 26, textAlign: 'right',
        }}>
          {pctA}%
        </span>
        {/* Bar + VS marker */}
        <div style={{
          flex: 1, height: 6, borderRadius: 3,
          background: 'rgba(255,255,255,0.06)',
          position: 'relative',
        }}>
          {/* Gold side */}
          <div style={{
            position: 'absolute', left: 0, top: 0, bottom: 0,
            width: `${pctA}%`,
            background: `linear-gradient(90deg, ${colorA}90, ${colorA})`,
            borderRadius: '3px 0 0 3px',
            transition: 'width 0.6s cubic-bezier(0.34, 1.56, 0.64, 1)',
            boxShadow: pctA >= pctB ? `0 0 6px ${colorA}50` : 'none',
          }} />
          {/* Blue side */}
          <div style={{
            position: 'absolute', right: 0, top: 0, bottom: 0,
            width: `${pctB}%`,
            background: `linear-gradient(90deg, ${colorB}, ${colorB}90)`,
            borderRadius: '0 3px 3px 0',
            transition: 'width 0.6s cubic-bezier(0.34, 1.56, 0.64, 1)',
            boxShadow: pctB > pctA ? `0 0 6px ${colorB}50` : 'none',
          }} />
          {/* ── VS Marker — slides on bar ── */}
          <div style={{
            position: 'absolute',
            left: `${pctA}%`, top: '50%',
            transform: 'translate(-50%, -50%)',
            transition: 'left 0.6s cubic-bezier(0.34, 1.56, 0.64, 1)',
            zIndex: 3,
          }}>
            <div style={{
              width: 20, height: 20, borderRadius: '50%',
              background: pctA > pctB
                ? `radial-gradient(circle, ${colorA}30, rgba(6,6,6,0.95))`
                : pctB > pctA
                  ? `radial-gradient(circle, ${colorB}30, rgba(6,6,6,0.95))`
                  : 'radial-gradient(circle, rgba(255,255,255,0.08), rgba(6,6,6,0.95))',
              border: `1.5px solid ${pctA > pctB ? colorA + '60' : pctB > pctA ? colorB + '60' : 'rgba(255,255,255,0.15)'}`,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              boxShadow: `0 0 10px ${pctA > pctB ? colorA + '35' : pctB > pctA ? colorB + '35' : 'rgba(255,255,255,0.05)'}`,
              animation: totalBets > 0 ? 'vs-marker-pulse 2s ease-in-out infinite' : 'none',
            }}>
              <span style={{
                fontSize: 6, fontWeight: 900, letterSpacing: 0.5, lineHeight: 1,
                fontFamily: 'var(--font-display)',
                color: pctA > pctB ? colorA : pctB > pctA ? colorB : 'rgba(240,236,228,0.4)',
              }}>VS</span>
            </div>
          </div>
        </div>
        {/* Right percentage */}
        <span style={{
          fontSize: 9, fontWeight: 900, color: colorB,
          fontFamily: 'var(--font-display)', lineHeight: 1, minWidth: 26,
        }}>
          {pctB}%
        </span>
      </div>

      <style>{`
        @keyframes vs-marker-pulse {
          0%, 100% { box-shadow: 0 0 8px currentColor; transform: scale(1); }
          50% { box-shadow: 0 0 14px currentColor; transform: scale(1.1); }
        }
      `}</style>

      {/* Dein Tipp */}
      {myPickSide && !isCompleted && (
        <div style={{ marginTop: 3 }}>
          <span style={{
            fontSize: 7, fontFamily: 'var(--font-display)', letterSpacing: 1,
            color: myPickSide === 'a' ? colorA : colorB,
          }}>
            {'\uD83C\uDFAF'} {t('components.yourTipOn')}: @{myPickSide === 'a' ? nameA : nameB} {'\u00B7'} 25 {'\uD83E\uDE99'}
          </span>
        </div>
      )}

    </div>
  )
}
