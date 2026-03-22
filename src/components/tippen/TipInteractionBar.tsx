'use client'
import { useState, useEffect, useCallback } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { supabase } from '@/lib/supabase'

interface Props {
  questionId: string
  /** Optional: callback to open comment sheet */
  onCommentOpen?: () => void
  /** Optional: callback when story post is triggered */
  onStoryPost?: () => void
  storyPosted?: boolean
}

export default function TipInteractionBar({ questionId, onCommentOpen, onStoryPost, storyPosted }: Props) {
  const { profile } = useAuth()
  const [liked, setLiked] = useState(false)
  const [likeCount, setLikeCount] = useState(0)
  const [commentCount, setCommentCount] = useState(0)

  const loadData = useCallback(async () => {
    if (!profile) return
    const [likesRes, myLike, commentsRes] = await Promise.all([
      supabase.from('tip_likes').select('question_id', { count: 'exact', head: true }).eq('question_id', questionId),
      supabase.from('tip_likes').select('question_id').eq('question_id', questionId).eq('user_id', profile.id).maybeSingle(),
      supabase.from('tip_comments').select('id', { count: 'exact', head: true }).eq('question_id', questionId),
    ])
    setLikeCount(likesRes.count || 0)
    setLiked(!!myLike.data)
    setCommentCount(commentsRes.count || 0)
  }, [questionId, profile])

  useEffect(() => { loadData() }, [loadData])

  const toggleLike = async (e: React.MouseEvent) => {
    e.preventDefault(); e.stopPropagation()
    if (!profile) return
    if (liked) {
      await supabase.from('tip_likes').delete().eq('question_id', questionId).eq('user_id', profile.id)
      setLiked(false); setLikeCount(c => Math.max(0, c - 1))
    } else {
      await supabase.from('tip_likes').upsert({ question_id: questionId, user_id: profile.id }, { onConflict: 'question_id,user_id' })
      setLiked(true); setLikeCount(c => c + 1)
    }
    if (typeof navigator !== 'undefined' && navigator.vibrate) navigator.vibrate(10)
  }

  const handleComment = (e: React.MouseEvent) => {
    e.preventDefault(); e.stopPropagation()
    onCommentOpen?.()
  }

  const handleShare = async (e: React.MouseEvent) => {
    e.preventDefault(); e.stopPropagation()
    const url = `${window.location.origin}/app/tippen`
    try {
      if (navigator.share) {
        await navigator.share({ title: 'DealBuddy Tipp', url })
      } else {
        await navigator.clipboard.writeText(url)
      }
    } catch {}
  }

  const iconBtn: React.CSSProperties = {
    background: 'none', border: 'none', cursor: 'pointer', padding: '4px',
    display: 'flex', alignItems: 'center', gap: 4,
  }
  const countStyle: React.CSSProperties = {
    fontSize: 11, fontFamily: 'var(--font-display)', letterSpacing: 0.5,
  }

  return (
    <div
      onClick={e => { e.preventDefault(); e.stopPropagation() }}
      style={{
        display: 'flex', alignItems: 'center', gap: 6,
        padding: '6px 10px', background: 'rgba(255,255,255,0.02)',
        borderTop: '1px solid var(--border-subtle)',
      }}
    >
      {/* Heart */}
      <button onClick={toggleLike} style={iconBtn}>
        <svg width="18" height="18" viewBox="0 0 24 24" fill={liked ? 'var(--gold-primary)' : 'none'} stroke={liked ? 'var(--gold-primary)' : 'var(--text-secondary)'} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
        </svg>
        {likeCount > 0 && <span style={{ ...countStyle, color: liked ? 'var(--gold-primary)' : 'var(--text-secondary)' }}>{likeCount}</span>}
      </button>

      {/* Comment */}
      <button onClick={handleComment} style={iconBtn}>
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--text-secondary)" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
        </svg>
        {commentCount > 0 && <span style={{ ...countStyle, color: 'var(--text-secondary)' }}>{commentCount}</span>}
      </button>

      {/* Share */}
      <button onClick={handleShare} style={iconBtn}>
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--text-secondary)" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <line x1="22" y1="2" x2="11" y2="13" />
          <polygon points="22 2 15 22 11 13 2 9 22 2" />
        </svg>
      </button>

      {/* Spacer */}
      <div style={{ flex: 1 }} />

      {/* Story Post */}
      {onStoryPost && (
        <button onClick={(e) => { e.preventDefault(); e.stopPropagation(); if (!storyPosted) onStoryPost() }} style={{ ...iconBtn, opacity: storyPosted ? 0.5 : 1 }}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="10" stroke={storyPosted ? 'var(--gold-primary)' : 'var(--text-secondary)'} strokeDasharray={storyPosted ? undefined : '4 2'} />
            {storyPosted ? (
              <path d="M9 12l2 2 4-4" stroke="var(--gold-primary)" />
            ) : (
              <path d="M12 8v8M8 12h8" stroke="var(--text-secondary)" />
            )}
          </svg>
        </button>
      )}

    </div>
  )
}
