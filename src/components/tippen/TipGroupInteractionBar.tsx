'use client'
import { useState, useEffect, useCallback } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { useLang } from '@/contexts/LanguageContext'
import { supabase } from '@/lib/supabase'

interface Props {
  groupId: string
  inviteCode?: string
  groupName?: string
}

export default function TipGroupInteractionBar({ groupId, inviteCode, groupName }: Props) {
  const { profile } = useAuth()
  const { t } = useLang()
  const [liked, setLiked] = useState(false)
  const [likeCount, setLikeCount] = useState(0)
  const [commentCount, setCommentCount] = useState(0)
  const [repostCount, setRepostCount] = useState(0)
  const [storyPosted, setStoryPosted] = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)

  const loadData = useCallback(async () => {
    if (!profile) return
    const [likesRes, myLike, commentsRes, repostsRes, myStoryEvent] = await Promise.all([
      supabase.from('tip_group_likes').select('group_id', { count: 'exact', head: true }).eq('group_id', groupId),
      supabase.from('tip_group_likes').select('group_id').eq('group_id', groupId).eq('user_id', profile.id).maybeSingle(),
      supabase.from('tip_group_comments').select('id', { count: 'exact', head: true }).eq('group_id', groupId),
      supabase.from('tip_group_reposts').select('id', { count: 'exact', head: true }).eq('group_id', groupId),
      supabase.from('feed_events').select('id').eq('event_type', 'tip_group_story').eq('user_id', profile.id).eq('metadata->>group_id', groupId).maybeSingle(),
    ])
    setLikeCount(likesRes.count || 0)
    setLiked(!!myLike.data)
    setCommentCount(commentsRes.count || 0)
    setRepostCount(repostsRes.count || 0)
    setStoryPosted(!!myStoryEvent.data)
  }, [groupId, profile])

  useEffect(() => { loadData() }, [loadData])

  const toggleLike = async (e: React.MouseEvent) => {
    e.preventDefault(); e.stopPropagation()
    if (!profile) return
    if (liked) {
      await supabase.from('tip_group_likes').delete().eq('group_id', groupId).eq('user_id', profile.id)
      setLiked(false); setLikeCount(c => Math.max(0, c - 1))
    } else {
      await supabase.from('tip_group_likes').upsert({ group_id: groupId, user_id: profile.id }, { onConflict: 'group_id,user_id' })
      setLiked(true); setLikeCount(c => c + 1)
    }
    if (typeof navigator !== 'undefined' && navigator.vibrate) navigator.vibrate(10)
  }

  const handleRepost = async (e: React.MouseEvent) => {
    e.preventDefault(); e.stopPropagation()
    if (!profile) return
    const { data: existing } = await supabase.from('tip_group_reposts')
      .select('id').eq('group_id', groupId).eq('user_id', profile.id).maybeSingle()
    if (existing) {
      await supabase.from('tip_group_reposts').delete().eq('id', existing.id)
      setRepostCount(c => Math.max(0, c - 1))
    } else {
      await supabase.from('tip_group_reposts').insert({ group_id: groupId, user_id: profile.id })
      setRepostCount(c => c + 1)
    }
    if (typeof navigator !== 'undefined' && navigator.vibrate) navigator.vibrate(10)
  }

  const handleShare = async (e: React.MouseEvent) => {
    e.preventDefault(); e.stopPropagation()
    const text = inviteCode
      ? `${t('components.joinShareText').replace('{code}', inviteCode)}\n${window.location.origin}/app/tippen`
      : `${window.location.origin}/app/tippen/${groupId}`
    try {
      if (navigator.share) {
        await navigator.share({ title: t('components.tipGroupShareTitle'), text })
      } else {
        await navigator.clipboard.writeText(text)
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
        event_type: 'tip_group_story',
        user_id: profile.id,
        metadata: {
          group_id: groupId,
          group_name: groupName || t('tippen.tipGroupFallback'),
          invite_code: inviteCode || null,
        },
      })
      setStoryPosted(true)
      if (typeof navigator !== 'undefined' && navigator.vibrate) navigator.vibrate(10)
    } catch (err) {
      console.error('Story post error:', err)
    }
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
        <div style={{ ...iconBtn, cursor: 'default' }}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--text-secondary)" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
          </svg>
          {commentCount > 0 && <span style={{ ...countStyle, color: 'var(--text-secondary)' }}>{commentCount}</span>}
        </div>

        {/* Repost */}
        <button onClick={handleRepost} style={iconBtn}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--text-secondary)" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <path d="M17 1l4 4-4 4" />
            <path d="M3 11V9a4 4 0 0 1 4-4h14" />
            <path d="M7 23l-4-4 4-4" />
            <path d="M21 13v2a4 4 0 0 1-4 4H3" />
          </svg>
          {repostCount > 0 && <span style={{ ...countStyle, color: 'var(--text-secondary)' }}>{repostCount}</span>}
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
        <button onClick={handleStoryPostClick} style={{ ...iconBtn, opacity: storyPosted ? 0.5 : 1 }}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="10" stroke={storyPosted ? 'var(--gold-primary)' : 'var(--text-secondary)'} strokeDasharray={storyPosted ? undefined : '4 2'} />
            {storyPosted ? (
              <path d="M9 12l2 2 4-4" stroke="var(--gold-primary)" />
            ) : (
              <path d="M12 8v8M8 12h8" stroke="var(--text-secondary)" />
            )}
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
            <p style={{ fontSize: 28, marginBottom: 10 }}>📢</p>
            <h3 style={{
              fontFamily: 'var(--font-display)', fontSize: 15,
              color: 'var(--text-primary)', letterSpacing: 1.5, marginBottom: 8,
            }}>
              {t('components.postAsStory')}
            </h3>
            <p style={{
              fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.5, marginBottom: 24,
            }}>
              {t('components.storyGroupText').replace('{title}', groupName || t('tippen.tipGroupFallback'))}
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
