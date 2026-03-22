'use client'
import React, { useState, useEffect, useRef, useCallback } from 'react'
import ProfileImage from '@/components/ProfileImage'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/contexts/AuthContext'
import { useLang } from '@/contexts/LanguageContext'

/* ─── Types ─── */
export interface StoryDealMedia {
  deal_id: string
  user_id: string
  media_url: string
  media_type: string
}

export interface StoryDeal {
  id: string
  title: string
  stake: string
  status: string
  category?: string
  created_at: string
  media_url?: string
  media_type?: string
  is_public?: boolean
  shared_as_story_at?: string
  winner_id?: string
  creator_id?: string
  opponent_id?: string
  deal_media?: StoryDealMedia[]
  creator: { id?: string; username: string; display_name: string; avatar_url?: string; level?: number; streak?: number; active_frame?: string; is_founder?: boolean; gender?: string; equipped_card_image_url?: string | null } | null
  opponent: { id?: string; username: string; display_name: string; avatar_url?: string; level?: number; streak?: number; active_frame?: string; is_founder?: boolean; gender?: string; equipped_card_image_url?: string | null } | null
  // Tip Group Story fields
  storyType?: 'deal' | 'tip_group'
  tipGroup?: {
    group_id: string
    group_name: string
    invite_code?: string
    league?: string
    member_count?: number
  }
}

export interface StoryGroup {
  userId: string
  username: string
  displayName: string
  avatarUrl?: string
  deals: StoryDeal[]
}

interface Props {
  stories: StoryGroup[]
  initialGroupIndex: number
  onClose: () => void
  onViewed: (dealId: string) => void
}

/* ─── Helpers ─── */
const STATUS_COLORS: Record<string, string> = {
  open: '#FFB800', pending: '#f97316', active: '#4ade80',
  pending_confirmation: '#a78bfa', completed: '#9ca3af',
  cancelled: '#9ca3af', disputed: '#ef4444',
}

/* timeAgo and STATUS_LABELS moved inside component for i18n */

/* ─── Card Placeholder (CSS-only, no static image) ─── */
const StoryCardPlaceholder = ({ dimmed }: { dimmed?: boolean }) => (
  <div style={{
    width: '100%', height: '100%',
    background: 'linear-gradient(135deg, rgba(255,184,0,0.08), rgba(255,184,0,0.02))',
    border: '1px solid rgba(255,184,0,0.15)',
    borderRadius: 8,
    display: 'flex', flexDirection: 'column',
    alignItems: 'center', justifyContent: 'center',
    opacity: dimmed ? 0.4 : 0.7,
  }}>
    <span style={{ fontSize: 22, color: 'rgba(255,184,0,0.4)' }}>{'\u{1F3B4}'}</span>
  </div>
)

const DURATION = 10000 // 10 seconds per story

export default function StoryViewer({ stories, initialGroupIndex, onClose, onViewed }: Props) {
  const router = useRouter()
  const { profile } = useAuth()
  const { t } = useLang()

  const STATUS_LABELS: Record<string, string> = {
    open: t('components.statusOpen'), pending: t('components.statusInvited'), active: t('components.statusActive'),
    pending_confirmation: t('components.statusConfirmation'), completed: t('components.statusCompleted'),
    cancelled: t('components.statusCancelled'), disputed: t('components.statusDispute'),
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
  const [groupIdx, setGroupIdx] = useState(initialGroupIndex)
  const [dealIdx, setDealIdx] = useState(0)
  const [progress, setProgress] = useState(0)
  const [paused, setPaused] = useState(false)
  const [swipeY, setSwipeY] = useState(0)
  const [storyMessage, setStoryMessage] = useState('')
  const [fullMedia, setFullMedia] = useState<StoryDealMedia | null>(null)

  // Story interaction state
  const [storyLiked, setStoryLiked] = useState(false)
  const [storyLikeCount, setStoryLikeCount] = useState(0)
  const [storyCommentCount, setStoryCommentCount] = useState(0)
  const [showCommentInput, setShowCommentInput] = useState(false)
  const [commentText, setCommentText] = useState('')
  const [ownerAllowsDm, setOwnerAllowsDm] = useState(true)
  const [showCommentList, setShowCommentList] = useState(false)
  const [storyComments, setStoryComments] = useState<any[]>([])
  const [likeBounce, setLikeBounce] = useState(false)
  const [showDmInput, setShowDmInput] = useState(false)

  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const startTimeRef = useRef(Date.now())
  const elapsedRef = useRef(0)
  const touchStartRef = useRef({ x: 0, y: 0 })

  const group = stories[groupIdx]
  const deal = group?.deals[dealIdx]

  // Track view on deal change
  useEffect(() => {
    if (deal) onViewed(deal.id)
  }, [deal?.id])

  // Load story interaction data when deal changes
  const isTipGroup = deal?.storyType === 'tip_group'
  const tipGroupId = deal?.tipGroup?.group_id

  useEffect(() => {
    if (!deal || !profile) return
    const loadInteractions = async () => {
      if (isTipGroup && tipGroupId) {
        const [likesRes, myLike, commentsRes, ownerDm] = await Promise.all([
          supabase.from('tip_group_likes').select('group_id', { count: 'exact', head: true }).eq('group_id', tipGroupId),
          supabase.from('tip_group_likes').select('group_id').eq('group_id', tipGroupId).eq('user_id', profile.id).maybeSingle(),
          supabase.from('tip_group_comments').select('id', { count: 'exact', head: true }).eq('group_id', tipGroupId),
          supabase.from('profiles').select('allow_story_dm').eq('id', group.userId).single(),
        ])
        setStoryLikeCount(likesRes.count || 0)
        setStoryLiked(!!myLike.data)
        setStoryCommentCount(commentsRes.count || 0)
        setOwnerAllowsDm(ownerDm.data?.allow_story_dm !== false)
      } else {
        const [likesRes, myLike, commentsRes, ownerDm] = await Promise.all([
          supabase.from('deal_likes').select('deal_id', { count: 'exact', head: true }).eq('deal_id', deal.id),
          supabase.from('deal_likes').select('deal_id').eq('deal_id', deal.id).eq('user_id', profile.id).maybeSingle(),
          supabase.from('deal_comments').select('id', { count: 'exact', head: true }).eq('deal_id', deal.id),
          supabase.from('profiles').select('allow_story_dm').eq('id', group.userId).single(),
        ])
        setStoryLikeCount(likesRes.count || 0)
        setStoryLiked(!!myLike.data)
        setStoryCommentCount(commentsRes.count || 0)
        setOwnerAllowsDm(ownerDm.data?.allow_story_dm !== false)
      }
    }
    loadInteractions()
    setShowCommentInput(false)
    setShowCommentList(false)
    setShowDmInput(false)
    setCommentText('')
    setStoryMessage('')
  }, [deal?.id, profile?.id, group?.userId])

  const toggleStoryLike = async (e: React.MouseEvent | React.TouchEvent) => {
    e.stopPropagation()
    if (!profile || !deal) return
    setPaused(true)
    if (isTipGroup && tipGroupId) {
      if (storyLiked) {
        await supabase.from('tip_group_likes').delete().eq('group_id', tipGroupId).eq('user_id', profile.id)
        setStoryLiked(false); setStoryLikeCount(c => Math.max(0, c - 1))
      } else {
        await supabase.from('tip_group_likes').upsert({ group_id: tipGroupId, user_id: profile.id }, { onConflict: 'group_id,user_id' })
        setStoryLiked(true); setStoryLikeCount(c => c + 1)
        setLikeBounce(true); setTimeout(() => setLikeBounce(false), 400)
      }
    } else {
      if (storyLiked) {
        await supabase.from('deal_likes').delete().eq('deal_id', deal.id).eq('user_id', profile.id)
        setStoryLiked(false); setStoryLikeCount(c => Math.max(0, c - 1))
      } else {
        await supabase.from('deal_likes').upsert({ deal_id: deal.id, user_id: profile.id }, { onConflict: 'deal_id,user_id' })
        setStoryLiked(true); setStoryLikeCount(c => c + 1)
        setLikeBounce(true); setTimeout(() => setLikeBounce(false), 400)
      }
    }
    if (typeof navigator !== 'undefined' && navigator.vibrate) navigator.vibrate(10)
    setTimeout(() => setPaused(false), 500)
  }

  const openCommentSheet = async (e: React.MouseEvent | React.TouchEvent) => {
    e.stopPropagation()
    setPaused(true)
    setShowCommentList(true)
    if (isTipGroup && tipGroupId) {
      const { data } = await supabase
        .from('tip_group_comments')
        .select('*, user:user_id(username, display_name, avatar_url)')
        .eq('group_id', tipGroupId)
        .order('created_at', { ascending: true })
      setStoryComments(data || [])
    } else {
      const { data } = await supabase
        .from('deal_comments')
        .select('*, user:user_id(username, display_name, avatar_url)')
        .eq('deal_id', deal.id)
        .order('created_at', { ascending: true })
      setStoryComments(data || [])
    }
  }

  const submitComment = async () => {
    if (!commentText.trim() || !profile || !deal) return
    if (isTipGroup && tipGroupId) {
      await supabase.from('tip_group_comments').insert({
        group_id: tipGroupId,
        user_id: profile.id,
        content: commentText.trim(),
      })
      setCommentText('')
      setStoryCommentCount(c => c + 1)
      const { data } = await supabase
        .from('tip_group_comments')
        .select('*, user:user_id(username, display_name, avatar_url)')
        .eq('group_id', tipGroupId)
        .order('created_at', { ascending: true })
      setStoryComments(data || [])
    } else {
      await supabase.from('deal_comments').insert({
        deal_id: deal.id,
        user_id: profile.id,
        content: commentText.trim(),
      })
      setCommentText('')
      setStoryCommentCount(c => c + 1)
      const { data } = await supabase
        .from('deal_comments')
        .select('*, user:user_id(username, display_name, avatar_url)')
        .eq('deal_id', deal.id)
        .order('created_at', { ascending: true })
      setStoryComments(data || [])
    }
  }

  // Auto-advance timer
  const startTimer = useCallback(() => {
    if (timerRef.current) clearInterval(timerRef.current)
    startTimeRef.current = Date.now() - elapsedRef.current
    timerRef.current = setInterval(() => {
      const elapsed = Date.now() - startTimeRef.current
      const pct = Math.min(elapsed / DURATION, 1)
      setProgress(pct)
      if (pct >= 1) {
        goNext()
      }
    }, 50)
  }, [groupIdx, dealIdx, stories.length])

  const pauseTimer = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current)
      timerRef.current = null
    }
    elapsedRef.current = Date.now() - startTimeRef.current
  }, [])

  // Reset + start timer on deal/group change
  useEffect(() => {
    elapsedRef.current = 0
    setProgress(0)
    startTimer()
    return () => { if (timerRef.current) clearInterval(timerRef.current) }
  }, [groupIdx, dealIdx])

  // Pause/resume
  useEffect(() => {
    if (paused) pauseTimer()
    else startTimer()
  }, [paused])

  const goNext = () => {
    if (timerRef.current) clearInterval(timerRef.current)
    elapsedRef.current = 0

    if (!group) { onClose(); return }
    if (dealIdx < group.deals.length - 1) {
      setDealIdx(prev => prev + 1)
    } else if (groupIdx < stories.length - 1) {
      setGroupIdx(prev => prev + 1)
      setDealIdx(0)
    } else {
      // All stories done → just close overlay (preserves home page state)
      onClose()
    }
  }

  const goPrev = () => {
    if (timerRef.current) clearInterval(timerRef.current)
    elapsedRef.current = 0

    if (dealIdx > 0) {
      setDealIdx(prev => prev - 1)
    } else if (groupIdx > 0) {
      setGroupIdx(prev => prev - 1)
      setDealIdx(stories[groupIdx - 1]?.deals.length - 1 || 0)
    }
  }

  const sendStoryMessage = async () => {
    if (!storyMessage.trim() || !group) return
    // Navigate to chat - conversation will be created on the chat page
    const targetUsername = group.username
    router.push(`/app/chat?new=${targetUsername}`)
    onClose()
  }

  // Touch handlers
  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartRef.current = { x: e.touches[0].clientX, y: e.touches[0].clientY }
    setPaused(true)
  }

  const handleTouchMove = (e: React.TouchEvent) => {
    const dy = e.touches[0].clientY - touchStartRef.current.y
    if (dy > 0) setSwipeY(Math.min(dy * 0.6, 200))
  }

  const handleTouchEnd = (e: React.TouchEvent) => {
    setPaused(false)

    // If touch was on a media area, don't navigate — let the media click handler work
    const target = e.target as HTMLElement
    if (target.closest?.('[data-media-area]')) {
      setSwipeY(0)
      return
    }

    const dx = e.changedTouches[0].clientX - touchStartRef.current.x
    const dy = e.changedTouches[0].clientY - touchStartRef.current.y

    // Swipe down to close
    if (swipeY > 80) { onClose(); return }
    setSwipeY(0)

    // Swipe left/right between groups
    if (Math.abs(dx) > 60 && Math.abs(dy) < 40) {
      if (dx < 0 && groupIdx < stories.length - 1) {
        setGroupIdx(prev => prev + 1)
        setDealIdx(0)
      } else if (dx > 0 && groupIdx > 0) {
        setGroupIdx(prev => prev - 1)
        setDealIdx(0)
      }
      return
    }

    // Short tap: left 30% = prev, right 70% = next
    if (Math.abs(dx) < 10 && Math.abs(dy) < 10) {
      const w = window.innerWidth
      const tapX = e.changedTouches[0].clientX
      if (tapX < w * 0.3) goPrev()
      else goNext()
    }
  }

  if (!group || !deal) return null

  const statusColor = STATUS_COLORS[deal.status] || 'var(--gold-primary)'

  return (
    <div
      style={{
        position: 'fixed', inset: 0, zIndex: 200,
        background: 'var(--bg-deepest)',
        transform: `translateY(${swipeY}px)`,
        opacity: swipeY > 0 ? 1 - swipeY / 300 : 1,
        transition: swipeY === 0 ? 'transform 0.2s, opacity 0.2s' : 'none',
      }}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
    >
      {/* Progress bars */}
      <div style={{
        position: 'absolute', top: 0, left: 0, right: 0,
        display: 'flex', gap: 3, padding: '12px 12px 0',
        zIndex: 10,
      }}>
        {group.deals.map((_, i) => (
          <div key={i} style={{
            flex: 1, height: 2, borderRadius: 1,
            background: 'rgba(255,255,255,0.15)', overflow: 'hidden',
          }}>
            <div style={{
              height: '100%', borderRadius: 1,
              background: 'var(--gold-primary)',
              width: i < dealIdx ? '100%' : i === dealIdx ? `${progress * 100}%` : '0%',
              transition: i === dealIdx ? 'none' : 'width 0.2s',
            }} />
          </div>
        ))}
      </div>

      {/* Header */}
      <div style={{
        position: 'absolute', top: 20, left: 0, right: 0,
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '0 16px', zIndex: 10,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <ProfileImage
            size={32}
            avatarUrl={group.avatarUrl}
            name={group.displayName || group.username}
            goldBorder
          />
          <div>
            <p style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>
              {group.displayName || group.username}
            </p>
            <p style={{ fontSize: 10, color: 'var(--text-secondary)' }}>
              {timeAgo(deal.created_at)}
            </p>
          </div>
        </div>
        <button
          onClick={(e) => { e.stopPropagation(); onClose() }}
          onTouchEnd={(e) => { e.preventDefault(); e.stopPropagation(); onClose() }}
          style={{
            width: 32, height: 32, borderRadius: '50%',
            background: 'rgba(255,255,255,0.1)', border: 'none',
            color: 'var(--text-primary)', fontSize: 18, cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            touchAction: 'manipulation',
          }}
        >
          &times;
        </button>
      </div>

      {/* Content - Battle Card / Tip Group Card + Media */}
      <div style={{
        position: 'absolute', inset: 0,
        display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center',
        padding: '70px 12px 120px',
        overflow: 'hidden',
      }}>
        <div style={{ width: '100%', maxWidth: 400 }}>

          {/* ── Tip Group Story Card ── */}
          {isTipGroup && deal.tipGroup ? (
            <div
              style={{
                borderRadius: 16, overflow: 'hidden',
                border: '1px solid var(--border-subtle)',
                boxShadow: '0 4px 24px rgba(0,0,0,0.5)',
                background: '#111',
              }}
            >
              {/* Background banner with tipp-bg.webp */}
              <div style={{
                position: 'relative', width: '100%', aspectRatio: '860 / 482',
                backgroundImage: 'url(/tipp-bg.webp)',
                backgroundSize: 'cover', backgroundPosition: 'center', backgroundRepeat: 'no-repeat',
              }}>
                <div style={{
                  position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.3)',
                  display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                  padding: '20px',
                }}>
                  <p style={{
                    fontFamily: 'var(--font-display)', fontSize: 24, fontWeight: 900,
                    color: '#F0ECE4', letterSpacing: 2, marginBottom: 6,
                    textShadow: '0 2px 8px rgba(0,0,0,0.9), 0 0 20px rgba(0,0,0,0.5)',
                    textAlign: 'center', textTransform: 'uppercase',
                  }}>
                    {deal.tipGroup.group_name}
                  </p>
                  {deal.tipGroup.league && (
                    <p style={{ fontSize: 13, color: '#FFB800', marginBottom: 8, textShadow: '0 1px 6px rgba(0,0,0,0.9)', fontFamily: 'var(--font-display)', letterSpacing: 1 }}>
                      {deal.tipGroup.league}
                    </p>
                  )}
                  <div style={{
                    display: 'inline-flex', alignItems: 'center', gap: 6,
                    padding: '6px 14px', borderRadius: 20,
                    background: 'rgba(255,184,0,0.15)', border: '1px solid rgba(255,184,0,0.4)',
                  }}>
                    <span style={{ fontSize: 11, color: '#FFB800', fontFamily: 'var(--font-display)', letterSpacing: 1, textShadow: '0 1px 4px rgba(0,0,0,0.8)' }}>{t('components.tipGroup')}</span>
                  </div>
                </div>
                {/* Bottom gradient fade */}
                <div style={{
                  position: 'absolute', bottom: 0, left: 0, right: 0, height: '25%',
                  background: 'linear-gradient(to bottom, transparent 0%, #111 100%)',
                  pointerEvents: 'none',
                }} />
              </div>
              {/* Info section */}
              <div style={{ padding: '16px 20px', textAlign: 'center' }}>
                <p style={{ fontSize: 14, color: 'var(--text-secondary)', lineHeight: 1.5, marginBottom: 16 }}>
                  {t('components.tipsInGroup').replace('{name}', group.displayName || group.username)}
                </p>
                {deal.tipGroup.invite_code && (
                  <div style={{
                    display: 'inline-block', padding: '10px 20px', borderRadius: 12,
                    background: 'rgba(255,184,0,0.1)', border: '1px solid rgba(255,184,0,0.25)',
                    fontFamily: 'var(--font-display)', fontSize: 15, letterSpacing: 2.5,
                    color: 'var(--gold-primary)', marginBottom: 16,
                  }}>
                    {deal.tipGroup.invite_code}
                  </div>
                )}
                {deal.tipGroup.member_count != null && (
                  <p style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 12 }}>
                    {deal.tipGroup.member_count} {t('components.members')}
                  </p>
                )}
                <div
                  data-media-area="true"
                  onTouchStart={(e) => e.stopPropagation()}
                  onTouchMove={(e) => e.stopPropagation()}
                  onTouchEnd={(e) => e.stopPropagation()}
                >
                  <button
                    onTouchEnd={(e) => { e.preventDefault(); e.stopPropagation(); router.push(`/app/tippen/${deal.tipGroup!.group_id}`); onClose() }}
                    onClick={(e) => { e.stopPropagation(); router.push(`/app/tippen/${deal.tipGroup!.group_id}`); onClose() }}
                    style={{
                      padding: '14px 40px', borderRadius: 14, border: 'none', cursor: 'pointer',
                      background: 'linear-gradient(135deg, var(--gold-dim), var(--gold-primary))',
                      color: 'var(--text-inverse)', fontFamily: 'var(--font-display)', fontSize: 12,
                      fontWeight: 700, letterSpacing: 2,
                      WebkitTapHighlightColor: 'transparent',
                      touchAction: 'manipulation',
                    }}
                  >
                    {t('components.viewGroup')}
                  </button>
                </div>
              </div>
            </div>
          ) : null}

          {/* ── Deal Card (deals only) — same layout as Home Feed cards ── */}
          {!isTipGroup ? (() => {
            const sc = statusColor
            const isCompleted = deal.status === 'completed'
            const creatorWon = isCompleted && deal.creator_id === (deal as any).winner_id
            const opponentWon = isCompleted && deal.opponent_id === (deal as any).winner_id
            const creatorName = deal.creator?.display_name || deal.creator?.username || '?'
            const opponentName = deal.opponent?.display_name || deal.opponent?.username || null
            const winnerId = (deal as any).winner_id
            const winner = winnerId === deal.creator_id ? deal.creator : deal.opponent

            return (
              <div style={{ position: 'relative', paddingTop: 10 }}>

                {/* ═══ BADGE — oben links ═══ */}
                <div style={{
                  position: 'absolute', top: -4, left: 16, zIndex: 5,
                  padding: '4px 10px 5px',
                  background: `linear-gradient(135deg, ${sc}E8, ${sc}D0)`,
                  color: '#060606', fontFamily: 'var(--font-display)',
                  fontSize: 7, fontWeight: 800, letterSpacing: 1.5,
                  borderRadius: '6px 6px 0 0',
                  boxShadow: `0 -3px 10px ${sc}40`,
                  lineHeight: 1,
                }}>
                  {STATUS_LABELS[deal.status] || deal.status.toUpperCase()}
                </div>

                <div style={{ borderRadius: 14, overflow: 'hidden', background: '#111' }}>

                  {/* ═══ TITLE BAR — zentriert, farbiger Gradient ═══ */}
                  <div style={{
                    width: '100%', padding: '10px 16px', textAlign: 'center',
                    background: `linear-gradient(135deg, ${sc}12, ${sc}06)`,
                  }}>
                    <p style={{
                      fontFamily: 'var(--font-display)', fontSize: 14, fontWeight: 900,
                      color: sc, letterSpacing: 1.5, textTransform: 'uppercase',
                      margin: 0, lineHeight: 1.3,
                      overflow: 'hidden',
                      display: '-webkit-box',
                      WebkitLineClamp: 2,
                      WebkitBoxOrient: 'vertical' as never,
                      textShadow: `0 0 12px ${sc}25`,
                    }}>
                      {deal.title}
                    </p>
                  </div>

                  {/* ═══ MEDIA + BEGEGNUNG LESEZEICHEN ═══ */}
                  <div style={{ position: 'relative' }}>
                    {/* Lesezeichen oben links */}
                    <div style={{
                      position: 'absolute', top: 0, left: 12, zIndex: 2,
                      background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(8px)',
                      padding: '3px 8px', borderRadius: '0 0 6px 6px',
                      fontFamily: 'var(--font-body)', fontSize: 10, fontWeight: 700, color: '#fff',
                      boxShadow: '0 2px 8px rgba(0,0,0,0.4)',
                      display: 'flex', alignItems: 'center', gap: 4,
                    }}>
                      <span>{'\u2694\uFE0F'}</span>
                      <span style={{ color: creatorWon ? '#4ade80' : '#fff' }}>
                        {creatorWon && '\u{1F451} '}{creatorName}
                      </span>
                      {opponentName ? (
                        <>
                          <span style={{ color: 'rgba(255,255,255,0.5)' }}>vs</span>
                          <span style={{ color: opponentWon ? '#4ade80' : '#fff' }}>
                            {opponentWon && '\u{1F451} '}{opponentName}
                          </span>
                        </>
                      ) : (
                        <span style={{ color: '#FFB800' }}>· {t('components.searchingOpponent')}</span>
                      )}
                    </div>

                    {deal.media_url ? (
                      deal.media_type === 'video' ? (
                        <video src={deal.media_url} autoPlay muted loop playsInline
                          style={{ width: '100%', maxHeight: 320, objectFit: 'cover', display: 'block' }} />
                      ) : (
                        <img src={deal.media_url} alt=""
                          style={{ width: '100%', maxHeight: 320, objectFit: 'cover', display: 'block' }} />
                      )
                    ) : (
                      <div style={{ height: 28 }} />
                    )}
                  </div>

                  {/* ═══ EINSATZ — mittig, gerahmt ═══ */}
                  {(deal.stake || winnerId) && (
                    <div style={{
                      padding: '8px 12px',
                      display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4,
                    }}>
                      {deal.stake && (
                        <span style={{
                          fontFamily: 'var(--font-display)', fontSize: 14, fontWeight: 900,
                          color: '#ffffff', letterSpacing: 1,
                          borderRadius: 8, padding: '6px 16px',
                          background: 'rgba(255,255,255,0.06)',
                          textShadow: '0 0 12px rgba(147,197,253,0.15)',
                        }}>
                          {'\uD83C\uDFC6'} {deal.stake}
                        </span>
                      )}
                      {winnerId && winner && (
                        <span style={{ fontSize: 10, color: '#4ade80', fontWeight: 600 }}>
                          {'\u{1F451}'} {winner.display_name || winner.username}
                        </span>
                      )}
                    </div>
                  )}
                </div>

                {/* ═══ CTA BOOKMARK — unten rechts, bündig am Card-Rand ═══ */}
                <div
                  data-media-area="true"
                  onTouchStart={(e) => e.stopPropagation()}
                  onTouchMove={(e) => e.stopPropagation()}
                  onTouchEnd={(e) => e.stopPropagation()}
                  style={{ position: 'relative', height: 0 }}
                >
                  <button
                    onTouchEnd={(e) => { e.preventDefault(); e.stopPropagation(); router.push(`/app/deals/${deal.id}`); onClose() }}
                    onClick={(e) => { e.stopPropagation(); router.push(`/app/deals/${deal.id}`); onClose() }}
                    style={{
                      position: 'absolute', top: 0, right: 16, zIndex: 5,
                      padding: '10px 20px 9px',
                      background: `linear-gradient(135deg, ${sc}E8, ${sc}D0)`,
                      color: '#060606', fontFamily: 'var(--font-display)',
                      fontSize: 11, fontWeight: 800, letterSpacing: 2,
                      border: 'none', cursor: 'pointer',
                      borderRadius: '0 0 8px 8px',
                      boxShadow: `0 4px 16px ${sc}50`,
                      lineHeight: 1,
                      WebkitTapHighlightColor: 'transparent',
                      touchAction: 'manipulation',
                    }}
                  >
                    {t('components.viewDeal')}
                  </button>
                </div>
              </div>
            )
          })() : null}

          {/* Media gallery removed from story — only visible on deal detail page */}
        </div>

        {/* Deal count */}
        <p style={{
          marginTop: 12, fontSize: 10, color: 'var(--text-muted)',
          fontFamily: 'var(--font-display)', letterSpacing: 2,
        }}>
          {dealIdx + 1} / {group.deals.length}
        </p>
      </div>

      {/* Instagram-style bottom bar: message input + action icons */}
      <div
        style={{
          position: 'absolute', bottom: 0, left: 0, right: 0,
          padding: '10px 16px', paddingBottom: 'max(14px, env(safe-area-inset-bottom))',
          background: 'linear-gradient(transparent, rgba(0,0,0,0.85))',
          zIndex: 10,
        }}
        onTouchStart={(e) => e.stopPropagation()}
        onTouchMove={(e) => e.stopPropagation()}
        onTouchEnd={(e) => e.stopPropagation()}
      >
        {/* Comment input row (shown when user taps comment icon) */}
        {showCommentInput && (
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 10 }}>
            <input
              type="text"
              placeholder={t('components.writeComment')}
              value={commentText}
              onChange={(e) => setCommentText(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') submitComment() }}
              onClick={(e) => e.stopPropagation()}
              autoFocus
              style={{
                flex: 1, background: 'rgba(255,255,255,0.1)', border: '1px solid rgba(255,255,255,0.15)',
                borderRadius: 20, padding: '10px 16px',
                color: 'var(--text-primary)', fontSize: 14, outline: 'none',
                fontFamily: 'var(--font-body)',
              }}
            />
            <button
              onClick={(e) => { e.stopPropagation(); submitComment() }}
              disabled={!commentText.trim()}
              style={{
                width: 36, height: 36, borderRadius: '50%',
                background: commentText.trim() ? 'var(--gold-primary)' : 'rgba(255,255,255,0.1)',
                border: 'none', color: commentText.trim() ? 'var(--text-inverse)' : 'var(--text-muted)',
                fontSize: 16, cursor: commentText.trim() ? 'pointer' : 'default',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}
            >
              ➤
            </button>
          </div>
        )}

        {/* Always-visible message input + action icons row (Instagram-style) */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          {/* Message / Comment input (always visible) */}
          {group.userId !== profile?.id ? (
            /* Other user's story: DM input */
            <div style={{ flex: 1, display: 'flex', gap: 8, alignItems: 'center' }}>
              <input
                type="text"
                placeholder={t('components.sendMessage')}
                value={storyMessage}
                onChange={(e) => setStoryMessage(e.target.value)}
                onFocus={() => setPaused(true)}
                onBlur={() => { if (!storyMessage.trim()) setPaused(false) }}
                onKeyDown={(e) => { if (e.key === 'Enter' && storyMessage.trim()) sendStoryMessage() }}
                onClick={(e) => e.stopPropagation()}
                style={{
                  flex: 1, background: 'rgba(255,255,255,0.1)', border: '1px solid rgba(255,255,255,0.2)',
                  borderRadius: 20, padding: '10px 16px',
                  color: '#fff', fontSize: 14, outline: 'none',
                  fontFamily: 'var(--font-body)',
                }}
              />
              {storyMessage.trim() && (
                <button
                  onClick={(e) => { e.stopPropagation(); sendStoryMessage() }}
                  onTouchEnd={(e) => { e.preventDefault(); e.stopPropagation(); sendStoryMessage() }}
                  style={{
                    width: 36, height: 36, borderRadius: '50%', flexShrink: 0,
                    background: 'var(--gold-primary)', border: 'none',
                    color: 'var(--text-inverse)', fontSize: 16, cursor: 'pointer',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}
                >
                  ➤
                </button>
              )}
            </div>
          ) : (
            /* Own story: Comment input */
            <div style={{ flex: 1, display: 'flex', gap: 8, alignItems: 'center' }}>
              <input
                type="text"
                placeholder={t('components.writeComment')}
                value={commentText}
                onChange={(e) => setCommentText(e.target.value)}
                onFocus={() => { setPaused(true); setShowCommentInput(true) }}
                onBlur={() => { if (!commentText.trim()) setPaused(false) }}
                onKeyDown={(e) => { if (e.key === 'Enter' && commentText.trim()) submitComment() }}
                onClick={(e) => e.stopPropagation()}
                style={{
                  flex: 1, background: 'rgba(255,255,255,0.1)', border: '1px solid rgba(255,255,255,0.2)',
                  borderRadius: 20, padding: '10px 16px',
                  color: '#fff', fontSize: 14, outline: 'none',
                  fontFamily: 'var(--font-body)',
                }}
              />
              {commentText.trim() && (
                <button
                  onClick={(e) => { e.stopPropagation(); submitComment() }}
                  onTouchEnd={(e) => { e.preventDefault(); e.stopPropagation(); submitComment() }}
                  style={{
                    width: 36, height: 36, borderRadius: '50%', flexShrink: 0,
                    background: 'var(--gold-primary)', border: 'none',
                    color: 'var(--text-inverse)', fontSize: 16, cursor: 'pointer',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}
                >
                  ➤
                </button>
              )}
            </div>
          )}

          {/* Heart / Like */}
          <button
            onClick={toggleStoryLike}
            onTouchEnd={(e) => { e.preventDefault(); toggleStoryLike(e) }}
            style={{
              background: 'none', border: 'none', cursor: 'pointer',
              display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2,
              padding: 6, transform: likeBounce ? 'scale(1.3)' : 'scale(1)',
              transition: 'transform 0.2s', flexShrink: 0,
              touchAction: 'manipulation',
            }}
          >
            <svg width="26" height="26" viewBox="0 0 24 24"
              fill={storyLiked ? '#ff3040' : 'none'}
              stroke={storyLiked ? '#ff3040' : '#fff'}
              strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"
            >
              <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
            </svg>
            {storyLikeCount > 0 && (
              <span style={{ fontSize: 10, color: storyLiked ? '#ff3040' : '#fff', fontFamily: 'var(--font-display)', fontWeight: 600 }}>
                {storyLikeCount}
              </span>
            )}
          </button>

          {/* Comment */}
          <button
            onClick={(e) => {
              e.stopPropagation()
              setPaused(true)
              openCommentSheet(e)
            }}
            onTouchEnd={(e) => {
              e.preventDefault()
              e.stopPropagation()
              setPaused(true)
              openCommentSheet(e)
            }}
            style={{
              background: 'none', border: 'none', cursor: 'pointer',
              display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2,
              padding: 6, flexShrink: 0,
              touchAction: 'manipulation',
            }}
          >
            <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
            </svg>
            {storyCommentCount > 0 && (
              <span style={{ fontSize: 10, color: '#fff', fontFamily: 'var(--font-display)', fontWeight: 600 }}>
                {storyCommentCount}
              </span>
            )}
          </button>

          {/* Share */}
          <button
            onClick={async (e) => {
              e.stopPropagation()
              if (!deal) return
              const url = isTipGroup && tipGroupId
                ? `${window.location.origin}/app/tippen/${tipGroupId}`
                : `${window.location.origin}/app/deals/${deal.id}`
              const title = isTipGroup ? (deal.tipGroup?.group_name || t('tippen.tipGroupFallback')) : deal.title
              try {
                if (navigator.share) {
                  await navigator.share({ title, url })
                } else {
                  await navigator.clipboard.writeText(url)
                }
              } catch {}
            }}
            onTouchEnd={async (e) => {
              e.preventDefault()
              e.stopPropagation()
              if (!deal) return
              const url = isTipGroup && tipGroupId
                ? `${window.location.origin}/app/tippen/${tipGroupId}`
                : `${window.location.origin}/app/deals/${deal.id}`
              const title = isTipGroup ? (deal.tipGroup?.group_name || t('tippen.tipGroupFallback')) : deal.title
              try {
                if (navigator.share) {
                  await navigator.share({ title, url })
                } else {
                  await navigator.clipboard.writeText(url)
                }
              } catch {}
            }}
            style={{
              background: 'none', border: 'none', cursor: 'pointer',
              display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2,
              padding: 6, flexShrink: 0,
              touchAction: 'manipulation',
            }}
          >
            <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <line x1="22" y1="2" x2="11" y2="13" />
              <polygon points="22 2 15 22 11 13 2 9 22 2" />
            </svg>
          </button>

        </div>

        {/* Swipe indicator */}
        <div style={{ display: 'flex', justifyContent: 'center', marginTop: 8 }}>
          <div style={{ width: 40, height: 4, borderRadius: 2, background: 'rgba(255,255,255,0.15)' }} />
        </div>
      </div>

      {/* Comment list overlay */}
      {showCommentList && (
        <div
          onClick={(e) => { e.stopPropagation(); setShowCommentList(false); setPaused(false) }}
          onTouchStart={(e) => e.stopPropagation()}
          onTouchMove={(e) => e.stopPropagation()}
          onTouchEnd={(e) => e.stopPropagation()}
          style={{
            position: 'fixed', inset: 0, zIndex: 250,
            background: 'rgba(0,0,0,0.85)',
            display: 'flex', alignItems: 'flex-end',
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              width: '100%', maxWidth: 430, margin: '0 auto',
              background: 'var(--bg-surface)', borderRadius: '20px 20px 0 0',
              maxHeight: '60vh', display: 'flex', flexDirection: 'column',
              border: '1px solid var(--border-subtle)',
            }}
          >
            <div style={{ padding: '16px 20px 12px', borderBottom: '1px solid var(--border-subtle)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <h3 style={{ fontFamily: 'var(--font-display)', fontSize: 12, letterSpacing: 2, color: 'var(--text-primary)' }}>{t('components.comments')}</h3>
              <button onClick={() => { setShowCommentList(false); setPaused(false) }} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', fontSize: 18, cursor: 'pointer' }}>&times;</button>
            </div>
            <div style={{ flex: 1, overflowY: 'auto', padding: '12px 20px' }}>
              {storyComments.length === 0 ? (
                <p style={{ textAlign: 'center', color: 'var(--text-muted)', fontSize: 13, padding: '20px 0' }}>{t('components.noCommentsShort')}</p>
              ) : (
                storyComments.map((c: any) => (
                  <div key={c.id} style={{ display: 'flex', gap: 10, marginBottom: 14 }}>
                    <ProfileImage size={28} avatarUrl={c.user?.avatar_url} name={c.user?.display_name || c.user?.username} />
                    <div style={{ flex: 1 }}>
                      <p style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
                        <strong style={{ color: 'var(--text-primary)' }}>{c.user?.display_name || c.user?.username}</strong>
                        <span style={{ marginLeft: 6, fontSize: 10, color: 'var(--text-muted)' }}>{timeAgo(c.created_at)}</span>
                      </p>
                      <p style={{ fontSize: 13, color: 'var(--text-primary)', marginTop: 2, lineHeight: 1.4 }}>{c.content}</p>
                    </div>
                  </div>
                ))
              )}
            </div>
            <div style={{ padding: '12px 20px', paddingBottom: 'max(12px, env(safe-area-inset-bottom))', borderTop: '1px solid var(--border-subtle)', display: 'flex', gap: 8 }}>
              <input
                type="text"
                placeholder={t('components.comment')}
                value={commentText}
                onChange={(e) => setCommentText(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') submitComment() }}
                style={{
                  flex: 1, background: 'var(--bg-elevated)', border: '1px solid var(--border-subtle)',
                  borderRadius: 20, padding: '10px 16px',
                  color: 'var(--text-primary)', fontSize: 14, outline: 'none',
                  fontFamily: 'var(--font-body)',
                }}
              />
              <button
                onClick={submitComment}
                disabled={!commentText.trim()}
                style={{
                  width: 36, height: 36, borderRadius: '50%',
                  background: commentText.trim() ? 'var(--gold-primary)' : 'var(--bg-overlay)',
                  border: 'none', color: commentText.trim() ? 'var(--text-inverse)' : 'var(--text-muted)',
                  fontSize: 16, cursor: commentText.trim() ? 'pointer' : 'default',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}
              >
                ➤
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Full-screen media overlay */}
      {fullMedia && (
        <div
          onClick={() => { setFullMedia(null); setPaused(false) }}
          onTouchStart={(e) => e.stopPropagation()}
          onTouchMove={(e) => e.stopPropagation()}
          onTouchEnd={(e) => e.stopPropagation()}
          style={{
            position: 'fixed', inset: 0, zIndex: 300,
            background: 'rgba(0,0,0,0.95)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}
        >
          <button
            onClick={() => { setFullMedia(null); setPaused(false) }}
            style={{
              position: 'absolute', top: 16, right: 16,
              width: 36, height: 36, borderRadius: '50%',
              background: 'rgba(255,255,255,0.15)', border: 'none',
              color: '#fff', fontSize: 20, cursor: 'pointer', zIndex: 10,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}
          >&times;</button>
          {fullMedia.media_type === 'video' ? (
            <video
              src={fullMedia.media_url}
              controls autoPlay playsInline
              onClick={(e) => e.stopPropagation()}
              style={{ maxWidth: '95%', maxHeight: '85vh', borderRadius: 12, objectFit: 'contain' }}
            />
          ) : (
            <img
              src={fullMedia.media_url}
              alt=""
              onClick={(e) => e.stopPropagation()}
              style={{ maxWidth: '95%', maxHeight: '85vh', borderRadius: 12, objectFit: 'contain' }}
            />
          )}
        </div>
      )}
    </div>
  )
}
