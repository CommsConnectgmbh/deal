'use client'
import { useState, useEffect } from 'react'
import Link from 'next/link'
import AvatarDisplay, { StreakFlame } from '@/components/AvatarDisplay'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/contexts/AuthContext'
import { useLang } from '@/contexts/LanguageContext'

const STATUS_COLORS: Record<string, string> = {
  open:                 '#FFB800',
  pending:              '#f97316',
  active:               '#4ade80',
  pending_confirmation: '#a78bfa',
  completed:            '#60a5fa',
  cancelled:            '#f87171',
  disputed:             '#ef4444',
}
const REACTION_EMOJIS = { fire:'🔥', funny:'😂', shocked:'😱', savage:'💀' }

interface AvatarCfg { skin_tone?:string; hair?:string; top?:string; bottom?:string; shoes?:string; accessory?:string; headwear?:string|null; background?:string; body?:string; outfit?:string }
interface ReactionCounts { fire:number; funny:number; shocked:number; savage:number }

interface Deal {
  id: string
  title: string
  stake: string
  status: string
  category?: string
  is_public?: boolean
  created_at: string
  creator_id: string
  opponent_id?: string
  confirmed_winner_id?: string
  creator: { username:string; display_name:string; level?:number; streak?:number } | null
  opponent: { username:string; display_name:string; level?:number; streak?:number } | null
}

interface Props {
  deal: Deal
  compact?: boolean
  showReactions?: boolean
  creatorAvatar?: AvatarCfg | null
  opponentAvatar?: AvatarCfg | null
  onReact?: (dealId:string, reaction:string) => void
  myReaction?: string | null
}

export default function DealCard({
  deal, compact = false, showReactions = true,
  creatorAvatar, opponentAvatar,
  onReact, myReaction,
}: Props) {
  const { profile } = useAuth()
  const { t } = useLang()

  const STATUS_LABELS: Record<string, string> = {
    open:                 t('components.statusOpen'),
    pending:              t('components.statusInvited'),
    active:               t('components.statusActive'),
    pending_confirmation: t('components.statusConfirmation'),
    completed:            t('components.statusCompleted'),
    cancelled:            t('components.statusCancelled'),
    disputed:             t('components.statusDispute'),
  }

  function timeAgo(dateStr: string) {
    const diff = Date.now() - new Date(dateStr).getTime()
    const m = Math.floor(diff / 60000)
    if (m < 1) return t('components.timeJustNow')
    if (m < 60) return t('components.timeMinutes').replace('{n}', String(m))
    const h = Math.floor(m / 60)
    if (h < 24) return t('components.timeHours').replace('{n}', String(h))
    const d = Math.floor(h / 24)
    return d === 1 ? t('components.timeDaySingular').replace('{n}', String(d)) : t('components.timeDays').replace('{n}', String(d))
  }

  const [reactions, setReactions] = useState<ReactionCounts>({ fire:0, funny:0, shocked:0, savage:0 })
  const [myRx, setMyRx] = useState<string | null>(myReaction || null)
  const [rxLoaded, setRxLoaded] = useState(false)

  useEffect(() => {
    if (showReactions && deal.status !== 'cancelled') loadReactions()
  }, [deal.id, showReactions])

  const loadReactions = async () => {
    const { data } = await supabase
      .from('deal_reactions')
      .select('reaction, user_id')
      .eq('deal_id', deal.id)
    if (!data) return
    const counts = { fire:0, funny:0, shocked:0, savage:0 }
    let mine: string | null = null
    data.forEach((r: any) => {
      counts[r.reaction as keyof typeof counts]++
      if (profile && r.user_id === profile.id) mine = r.reaction
    })
    setReactions(counts)
    setMyRx(mine)
    setRxLoaded(true)
  }

  const toggleReaction = async (rx: string) => {
    if (!profile) return
    if (myRx === rx) {
      // Remove reaction
      await supabase.from('deal_reactions').delete().eq('deal_id', deal.id).eq('user_id', profile.id)
      setReactions(prev => ({ ...prev, [rx]: Math.max(0, prev[rx as keyof typeof prev] - 1) }))
      setMyRx(null)
    } else {
      // Replace reaction
      if (myRx) {
        await supabase.from('deal_reactions').delete().eq('deal_id', deal.id).eq('user_id', profile.id)
        setReactions(prev => ({ ...prev, [myRx]: Math.max(0, prev[myRx as keyof typeof prev] - 1) }))
      }
      await supabase.from('deal_reactions').upsert({ deal_id: deal.id, user_id: profile.id, reaction: rx }, { onConflict: 'deal_id,user_id' })
      setReactions(prev => ({ ...prev, [rx]: prev[rx as keyof typeof prev] + 1 }))
      setMyRx(rx)
    }
    onReact?.(deal.id, rx)
  }

  const sc  = STATUS_COLORS[deal.status]  || '#888'
  const isWon = deal.status === 'completed' && deal.confirmed_winner_id
  const creatorWon = isWon && deal.confirmed_winner_id === deal.creator_id
  const opponentWon = isWon && deal.confirmed_winner_id === deal.opponent_id

  const avatarSize = compact ? 42 : 56

  return (
    <Link href={`/app/deals/${deal.id}`} style={{ textDecoration:'none', display:'block' }}>
      <div style={{
        background: 'var(--bg-surface)',
        borderRadius: 16,
        border: '1px solid var(--border-subtle)',
        overflow: 'hidden',
        boxShadow: 'var(--shadow-sm)',
        transition: 'transform 0.15s, box-shadow 0.15s',
        cursor: 'pointer',
        marginBottom: 0,
      }}
        onMouseEnter={e => { (e.currentTarget as HTMLElement).style.transform = 'scale(1.015)' }}
        onMouseLeave={e => { (e.currentTarget as HTMLElement).style.transform = 'scale(1)' }}
      >

        <div style={{ padding: compact ? '12px 14px' : '16px 16px 12px' }}>
          {/* VS Row */}
          <div style={{ display:'flex', alignItems:'center', gap: compact ? 8 : 12, marginBottom: compact ? 10 : 14 }}>

            {/* Creator */}
            <div style={{ flex:1, display:'flex', flexDirection:'column', alignItems:'center', gap:4, opacity: opponentWon ? 0.45 : 1 }}>
              <div style={{ position:'relative' }}>
                <AvatarDisplay config={creatorAvatar || undefined} archetype="founder" size={avatarSize} streak={deal.creator?.streak || 0} />
                {creatorWon && (
                  <div style={{ position:'absolute', top:-8, left:'50%', transform:'translateX(-50%)', fontSize:18, filter:'drop-shadow(0 0 6px #FFB800)' }}>👑</div>
                )}
              </div>
              <span style={{ fontSize:10, color:'var(--text-secondary)', fontWeight:600 }}>@{deal.creator?.username || '?'}</span>
              {!compact && <span style={{ fontSize:9, color:'var(--text-muted)' }}>Lv.{deal.creator?.level || 1}</span>}
            </div>

            {/* VS + Category + Status */}
            <div style={{ display:'flex', flexDirection:'column', alignItems:'center', gap:4, flexShrink:0 }}>
              <span style={{
                fontFamily:'Cinzel,serif', fontSize: compact ? 18 : 22, fontWeight:900,
                color:'var(--gold-primary)', letterSpacing:2,
              }}>VS</span>
              <div style={{
                background:`${sc}14`, border:`1px solid ${sc}33`, borderRadius:8,
                padding:'2px 8px', fontSize:9, fontWeight:700, color:sc,
                fontFamily:'Cinzel,serif', letterSpacing:0.8,
              }}>{STATUS_LABELS[deal.status] || deal.status.toUpperCase()}</div>
            </div>

            {/* Opponent */}
            <div style={{ flex:1, display:'flex', flexDirection:'column', alignItems:'center', gap:4, opacity: creatorWon ? 0.45 : 1 }}>
              <div style={{ position:'relative' }}>
                {deal.opponent ? (
                  <>
                    <AvatarDisplay config={opponentAvatar || undefined} archetype="duelist" size={avatarSize} streak={deal.opponent?.streak || 0} />
                    {opponentWon && (
                      <div style={{ position:'absolute', top:-8, left:'50%', transform:'translateX(-50%)', fontSize:18, filter:'drop-shadow(0 0 6px #FFB800)' }}>👑</div>
                    )}
                  </>
                ) : (
                  <div style={{
                    width:avatarSize, height:avatarSize, borderRadius:'50%',
                    border:'2px dashed var(--border-subtle)', background:'var(--bg-surface)',
                    display:'flex', alignItems:'center', justifyContent:'center',
                    color:'var(--text-muted)', fontSize:20,
                  }}>?</div>
                )}
              </div>
              <span style={{ fontSize:10, color:'var(--text-secondary)', fontWeight:600 }}>
                {deal.opponent ? `@${deal.opponent.username}` : t('components.statusOpen')}
              </span>
              {!compact && <span style={{ fontSize:9, color:'var(--text-muted)' }}>Lv.{deal.opponent?.level || '?'}</span>}
            </div>
          </div>

          {/* Deal Title */}
          <div style={{
            textAlign:'center', fontSize: compact ? 13 : 15, fontWeight:700, color:'var(--text-primary)',
            marginBottom: compact ? 8 : 10, lineHeight:1.3,
            padding:'0 8px',
          }}>
            "{deal.title}"
          </div>

          {/* Stake */}
          {deal.stake && (
            <div style={{ textAlign:'center', marginBottom: compact ? 6 : 8 }}>
              <span style={{ fontSize: compact ? 12 : 13, color:'var(--gold-primary)', fontWeight:600 }}>
                {t('components.stakeLabel')}: {deal.stake}
              </span>
            </div>
          )}

          {/* Footer */}
          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center' }}>
            <span style={{ fontSize:11, color:'var(--text-muted)' }}>⏱ {timeAgo(deal.created_at)}</span>
            {deal.is_public && <span style={{ fontSize:10, color:'var(--text-muted)' }}>🌐 {t('components.public')}</span>}
          </div>
        </div>

        {/* Reactions */}
        {showReactions && !compact && deal.status !== 'cancelled' && (
          <div
            style={{ borderTop:'1px solid var(--border-subtle)', padding:'8px 16px', display:'flex', gap:8 }}
            onClick={e => e.preventDefault()}
          >
            {(Object.entries(REACTION_EMOJIS) as [string, string][]).map(([key, emoji]) => {
              const count = reactions[key as keyof typeof reactions]
              const isMine = myRx === key
              return (
                <button
                  key={key}
                  onClick={() => toggleReaction(key)}
                  style={{
                    background: isMine ? 'var(--gold-subtle)' : 'transparent',
                    border: isMine ? '1px solid var(--gold-glow)' : '1px solid var(--border-subtle)',
                    borderRadius: 20, padding:'4px 10px', cursor:'pointer',
                    fontSize:12, color: isMine ? 'var(--gold-primary)' : 'var(--text-secondary)',
                    display:'flex', alignItems:'center', gap:4,
                    transition:'all 0.15s',
                  }}
                >
                  {emoji} {count > 0 && <span style={{ fontSize:11 }}>{count}</span>}
                </button>
              )
            })}
          </div>
        )}
      </div>
    </Link>
  )
}
