'use client'
import { useState, useEffect, useCallback } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { supabase } from '@/lib/supabase'
import DealBadge from '@/components/feed/DealBadge'
import { type BadgeType } from '@/lib/deal-feed-types'
import { useLang } from '@/contexts/LanguageContext'

interface Props {
  dealId: string
  dealTitle?: string
  dealStatus?: string
  onCommentOpen: () => void
  badge?: BadgeType
  badgePulse?: boolean
}

export default function InteractionBar({ dealId, dealTitle, dealStatus, onCommentOpen, badge, badgePulse }: Props) {
  // Alle Actions immer zeigen — einheitliches Battle Board
  const fullActions = true
  const { profile } = useAuth()
  const { t } = useLang()
  const [liked, setLiked] = useState(false)
  const [likeCount, setLikeCount] = useState(0)
  const [commentCount, setCommentCount] = useState(0)
  const [repostCount, setRepostCount] = useState(0)
  const [storyPosted, setStoryPosted] = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)
  const [bookmarked, setBookmarked] = useState(false)

  const loadData = useCallback(async () => {
    if (!profile) return
    const [likesRes, myLike, commentsRes, repostsRes, myRepost, myStoryEvent, myBookmark] = await Promise.all([
      supabase.from('deal_likes').select('deal_id', { count: 'exact', head: true }).eq('deal_id', dealId),
      supabase.from('deal_likes').select('deal_id').eq('deal_id', dealId).eq('user_id', profile.id).maybeSingle(),
      supabase.from('deal_comments').select('id', { count: 'exact', head: true }).eq('deal_id', dealId),
      supabase.from('deal_reposts').select('original_deal_id', { count: 'exact', head: true }).eq('original_deal_id', dealId),
      supabase.from('deal_reposts').select('original_deal_id').eq('original_deal_id', dealId).eq('user_id', profile.id).maybeSingle(),
      supabase.from('feed_events').select('id').eq('event_type', 'deal_story').eq('user_id', profile.id).eq('metadata->>deal_id', dealId).maybeSingle(),
      supabase.from('user_bookmarks').select('id').eq('user_id', profile.id).eq('item_type', 'deal').eq('item_id', dealId).maybeSingle(),
    ])
    setLikeCount(likesRes.count || 0)
    setLiked(!!myLike.data)
    setCommentCount(commentsRes.count || 0)
    setRepostCount(repostsRes.count || 0)
    setStoryPosted(!!myStoryEvent.data)
    setBookmarked(!!myBookmark.data)
  }, [dealId, profile])

  useEffect(() => { loadData() }, [loadData])

  const toggleLike = async (e: React.MouseEvent) => {
    e.preventDefault(); e.stopPropagation()
    if (!profile) return
    if (liked) {
      await supabase.from('deal_likes').delete().eq('deal_id', dealId).eq('user_id', profile.id)
      setLiked(false); setLikeCount(c => Math.max(0, c - 1))
    } else {
      await supabase.from('deal_likes').upsert({ deal_id: dealId, user_id: profile.id }, { onConflict: 'deal_id,user_id' })
      setLiked(true); setLikeCount(c => c + 1)
    }
    if (typeof navigator !== 'undefined' && navigator.vibrate) navigator.vibrate(10)
  }

  const handleComment = (e: React.MouseEvent) => {
    e.preventDefault(); e.stopPropagation()
    onCommentOpen()
  }

  const handleRepost = async (e: React.MouseEvent) => {
    e.preventDefault(); e.stopPropagation()
    if (!profile) return
    const { data: existing } = await supabase.from('deal_reposts')
      .select('id').eq('original_deal_id', dealId).eq('user_id', profile.id).maybeSingle()
    if (existing) {
      await supabase.from('deal_reposts').delete().eq('id', existing.id)
      setRepostCount(c => Math.max(0, c - 1))
    } else {
      await supabase.from('deal_reposts').insert({ original_deal_id: dealId, user_id: profile.id })
      setRepostCount(c => c + 1)
    }
    if (typeof navigator !== 'undefined' && navigator.vibrate) navigator.vibrate(10)
  }

  const handleShare = async (e: React.MouseEvent) => {
    e.preventDefault(); e.stopPropagation()
    const url = `https://app.deal-buddy.app/deal/${dealId}`
    try {
      if (navigator.share) {
        await navigator.share({ title: 'DealBuddy Deal', url })
      } else {
        await navigator.clipboard.writeText(url)
      }
    } catch {}
  }

  const handleStoryPostClick = (e: React.MouseEvent) => {
    e.preventDefault(); e.stopPropagation()
    if (storyPosted) return
    setShowConfirm(true)
  }

  const confirmStoryPost = async () => {
    setShowConfirm(false)
    if (!profile || storyPosted) return
    try {
      await supabase.from('feed_events').insert({
        event_type: 'deal_story',
        user_id: profile.id,
        metadata: {
          deal_id: dealId,
          deal_title: dealTitle || 'Deal',
        },
      })
      setStoryPosted(true)
      if (typeof navigator !== 'undefined' && navigator.vibrate) navigator.vibrate(10)
    } catch (err) {
      console.error('Story post error:', err)
    }
  }

  const toggleBookmark = async (e: React.MouseEvent) => {
    e.preventDefault(); e.stopPropagation()
    if (!profile) return
    if (bookmarked) {
      await supabase.from('user_bookmarks').delete()
        .eq('user_id', profile.id).eq('item_type', 'deal').eq('item_id', dealId)
      setBookmarked(false)
    } else {
      await supabase.from('user_bookmarks').insert({ user_id: profile.id, item_type: 'deal', item_id: dealId })
      setBookmarked(true)
    }
    if (typeof navigator !== 'undefined' && navigator.vibrate) navigator.vibrate(10)
  }

  const iconBtn: React.CSSProperties = {
    background: 'none', border: 'none', cursor: 'pointer', padding: '4px',
    display: 'flex', alignItems: 'center', gap: 4,
  }
  const countStyle: React.CSSProperties = {
    fontSize: 11, fontFamily: 'var(--font-display)', letterSpacing: 0.5,
  }

  return (
    <>
      <div
        onClick={e => { e.preventDefault(); e.stopPropagation() }}
        style={{
          display: 'flex', alignItems: 'center', gap: 4,
          padding: '6px 10px', background: 'rgba(255,255,255,0.02)',
          borderTop: '1px solid var(--border-subtle)',
        }}
      >
        {/* Flame — nur bei aktiven Battles */}
        {fullActions && (
          <button onClick={toggleLike} style={iconBtn}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill={liked ? 'var(--gold-primary)' : 'none'} stroke={liked ? 'var(--gold-primary)' : 'var(--text-secondary)'} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 22c-4.97 0-8-3.58-8-7.5 0-3.07 2.17-5.66 3.8-7.32.47-.48 1.2-.15 1.22.52.04 1.52.62 3.18 1.98 4.1.35-.85.6-2.05.6-3.3 0-1.1-.16-2.23-.52-3.27-.23-.67.33-1.4 1.02-1.23 3.24.8 6.9 4.3 6.9 9C19 18.42 16.97 22 12 22z" />
            </svg>
            {likeCount > 0 && <span style={{ ...countStyle, color: liked ? 'var(--gold-primary)' : 'var(--text-secondary)' }}>{likeCount}</span>}
          </button>
        )}

        {/* Comment — nur bei aktiven Battles */}
        {fullActions && (
          <button onClick={handleComment} style={iconBtn}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--text-secondary)" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
            </svg>
            {commentCount > 0 && <span style={{ ...countStyle, color: 'var(--text-secondary)' }}>{commentCount}</span>}
          </button>
        )}

        {/* Repost — nur bei aktiven Battles */}
        {fullActions && (
          <button onClick={handleRepost} style={iconBtn}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--text-secondary)" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <path d="M17 1l4 4-4 4" />
              <path d="M3 11V9a4 4 0 0 1 4-4h14" />
              <path d="M7 23l-4-4 4-4" />
              <path d="M21 13v2a4 4 0 0 1-4 4H3" />
            </svg>
            {repostCount > 0 && <span style={{ ...countStyle, color: 'var(--text-secondary)' }}>{repostCount}</span>}
          </button>
        )}

        {/* Share — immer sichtbar */}
        <button onClick={handleShare} style={iconBtn}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--text-secondary)" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <line x1="22" y1="2" x2="11" y2="13" />
            <polygon points="22 2 15 22 11 13 2 9 22 2" />
          </svg>
        </button>

        {/* Spacer */}
        <div style={{ flex: 1 }} />

        {/* Story Post — nur bei aktiven Battles */}
        {fullActions && <button onClick={handleStoryPostClick} style={{ ...iconBtn, opacity: storyPosted ? 0.5 : 1 }}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="10" stroke={storyPosted ? 'var(--gold-primary)' : 'var(--text-secondary)'} strokeDasharray={storyPosted ? undefined : '4 2'} />
            {storyPosted ? (
              <path d="M9 12l2 2 4-4" stroke="var(--gold-primary)" />
            ) : (
              <path d="M12 8v8M8 12h8" stroke="var(--text-secondary)" />
            )}
          </svg>
        </button>}

        {/* Bookmark */}
        <button onClick={toggleBookmark} style={iconBtn}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill={bookmarked ? 'var(--gold-primary)' : 'none'} stroke={bookmarked ? 'var(--gold-primary)' : 'var(--text-secondary)'} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z" />
          </svg>
        </button>

      </div>

      {/* Story Post Confirmation Modal */}
      {showConfirm && (
        <div
          onClick={(e) => { e.preventDefault(); e.stopPropagation(); setShowConfirm(false) }}
          style={{
            position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.85)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 200,
          }}
        >
          <div
            onClick={e => e.stopPropagation()}
            style={{
              width: '85%', maxWidth: 340, background: 'var(--bg-surface)',
              borderRadius: 20, border: '1px solid var(--border-subtle)',
              padding: '28px 24px', textAlign: 'center',
            }}
          >
            <p style={{ fontSize: 28, marginBottom: 10 }}>{'\uD83D\uDCE2'}</p>
            <h3 style={{
              fontFamily: 'var(--font-display)', fontSize: 15,
              color: 'var(--text-primary)', letterSpacing: 1.5, marginBottom: 8,
            }}>
              {t('components.postAsStory')}
            </h3>
            <p style={{
              fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.5, marginBottom: 24,
            }}>
              {t('components.storyDealText').replace('{title}', dealTitle || 'Deal')}
            </p>
            <div style={{ display: 'flex', gap: 10 }}>
              <button
                onClick={(e) => { e.stopPropagation(); setShowConfirm(false) }}
                style={{
                  flex: 1, padding: 14, borderRadius: 12,
                  border: '1px solid var(--border-subtle)', background: 'transparent',
                  color: 'var(--text-secondary)', fontFamily: 'var(--font-display)',
                  fontSize: 11, letterSpacing: 1.5, cursor: 'pointer',
                }}
              >
                {t('components.no')}
              </button>
              <button
                onClick={(e) => { e.stopPropagation(); confirmStoryPost() }}
                style={{
                  flex: 1, padding: 14, borderRadius: 12, border: 'none',
                  background: 'linear-gradient(135deg, var(--gold-dim), var(--gold-primary))',
                  color: 'var(--text-inverse)', fontFamily: 'var(--font-display)',
                  fontSize: 11, fontWeight: 700, letterSpacing: 1.5, cursor: 'pointer',
                }}
              >
                {t('components.yesPost')}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
