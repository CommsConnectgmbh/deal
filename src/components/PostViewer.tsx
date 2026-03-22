'use client'
import { useState, useEffect, useCallback, useRef } from 'react'
import { createPortal } from 'react-dom'
import { useAuth } from '@/contexts/AuthContext'
import { supabase } from '@/lib/supabase'
import ProfileImage from '@/components/ProfileImage'

interface Post {
  id: string
  user_id: string
  post_type: string
  media_url: string | null
  media_type: string | null
  caption: string | null
  deal_id: string | null
  is_public: boolean
  created_at: string
}

interface AuthorData {
  id: string
  username: string
  display_name: string | null
  avatar_url: string | null
}

interface CommentUser {
  username: string
  display_name: string | null
  avatar_url: string | null
}

interface CommentData {
  id: string
  content: string
  created_at: string
  user_id: string
  user: CommentUser | null
}

interface Props {
  posts: Post[]
  initialIndex: number
  onClose: () => void
}

const REACTIONS = [
  { key: 'fire', emoji: '\uD83D\uDD25' },
  { key: 'funny', emoji: '\uD83D\uDE02' },
  { key: 'shocked', emoji: '\uD83D\uDE31' },
  { key: 'savage', emoji: '\uD83D\uDC80' },
  { key: 'love', emoji: '\u2764\uFE0F' },
]

export default function PostViewer({ posts, initialIndex, onClose }: Props) {
  const { profile } = useAuth()
  const [index, setIndex] = useState(initialIndex)
  const [author, setAuthor] = useState<AuthorData | null>(null)
  const [reactions, setReactions] = useState<Record<string, number>>({})
  const [myReaction, setMyReaction] = useState<string | null>(null)
  const [comments, setComments] = useState<CommentData[]>([])
  const [commentText, setCommentText] = useState('')
  const [showComments, setShowComments] = useState(false)
  const [commentCount, setCommentCount] = useState(0)
  const [mounted, setMounted] = useState(false)
  const touchStartX = useRef(0)

  useEffect(() => { setMounted(true) }, [])

  const post = posts[index]

  const loadPostData = useCallback(async () => {
    if (!post) return
    // Load author
    const { data: authorData } = await supabase
      .from('profiles')
      .select('id, username, display_name, avatar_url')
      .eq('id', post.user_id)
      .single()
    setAuthor(authorData as AuthorData | null)

    // Load reactions
    const { data: rxns } = await supabase
      .from('post_reactions')
      .select('reaction, user_id')
      .eq('post_id', post.id)
    const counts: Record<string, number> = {}
    let mine: string | null = null
    for (const r of (rxns || [])) {
      counts[r.reaction] = (counts[r.reaction] || 0) + 1
      if (r.user_id === profile?.id) mine = r.reaction
    }
    setReactions(counts)
    setMyReaction(mine)

    // Load comment count
    const { count } = await supabase
      .from('post_comments')
      .select('id', { count: 'exact', head: true })
      .eq('post_id', post.id)
    setCommentCount(count || 0)
  }, [post, profile])

  useEffect(() => { loadPostData() }, [loadPostData])

  const loadComments = useCallback(async () => {
    if (!post) return
    const { data } = await supabase
      .from('post_comments')
      .select('id, content, created_at, user_id')
      .eq('post_id', post.id)
      .order('created_at', { ascending: true })
      .limit(50)

    if (!data || data.length === 0) {
      setComments([])
      return
    }

    // Load user profiles for comments
    const userIds = [...new Set(data.map((c: any) => c.user_id))]
    const { data: profiles } = await supabase
      .from('profiles')
      .select('id, username, display_name, avatar_url')
      .in('id', userIds)

    const profileMap: Record<string, CommentUser> = {}
    for (const p of (profiles || [])) {
      profileMap[p.id] = { username: p.username, display_name: p.display_name, avatar_url: p.avatar_url }
    }

    setComments(data.map((c: any) => ({
      ...c,
      user: profileMap[c.user_id] || null,
    })))
  }, [post])

  useEffect(() => { if (showComments) loadComments() }, [showComments, index, loadComments])

  const toggleReaction = async (key: string) => {
    if (!profile || !post) return
    if (myReaction === key) {
      await supabase.from('post_reactions').delete().eq('post_id', post.id).eq('user_id', profile.id)
      setMyReaction(null)
      setReactions(prev => ({ ...prev, [key]: Math.max(0, (prev[key] || 0) - 1) }))
    } else {
      if (myReaction) {
        setReactions(prev => ({ ...prev, [myReaction!]: Math.max(0, (prev[myReaction!] || 0) - 1) }))
      }
      await supabase.from('post_reactions').upsert({
        post_id: post.id, user_id: profile.id, reaction: key,
      }, { onConflict: 'post_id,user_id' })
      setMyReaction(key)
      setReactions(prev => ({ ...prev, [key]: (prev[key] || 0) + 1 }))
    }
    if (typeof navigator !== 'undefined' && navigator.vibrate) navigator.vibrate(10)
  }

  const submitComment = async () => {
    if (!profile || !post || !commentText.trim()) return
    await supabase.from('post_comments').insert({
      post_id: post.id, user_id: profile.id, content: commentText.trim(),
    })
    setCommentText('')
    setCommentCount(c => c + 1)
    loadComments()
  }

  const deletePost = async () => {
    if (!post || !profile || post.user_id !== profile.id) return
    if (!confirm('Post wirklich l\u00F6schen?')) return
    await supabase.from('profile_posts').delete().eq('id', post.id)
    onClose()
  }

  const handleTouchStart = (e: React.TouchEvent) => { touchStartX.current = e.touches[0].clientX }
  const handleTouchEnd = (e: React.TouchEvent) => {
    const diff = e.changedTouches[0].clientX - touchStartX.current
    if (Math.abs(diff) > 60) {
      if (diff < 0 && index < posts.length - 1) setIndex(i => i + 1)
      if (diff > 0 && index > 0) setIndex(i => i - 1)
    }
  }

  const timeAgo = (date: string) => {
    const mins = Math.floor((Date.now() - new Date(date).getTime()) / 60000)
    if (mins < 60) return `vor ${mins}m`
    const hours = Math.floor(mins / 60)
    if (hours < 24) return `vor ${hours}h`
    const days = Math.floor(hours / 24)
    return `vor ${days}d`
  }

  if (!post || !mounted) return null

  const content = (
    <div style={{ position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh', zIndex: 99998, background: 'var(--bg-base)', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
    <div style={{ width: '100%', maxWidth: 430, height: '100%', display: 'flex', flexDirection: 'column' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 16px', borderBottom: '1px solid var(--border-subtle)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-primary)', fontSize: 20, padding: 0 }}>{'\u2190'}</button>
          {author && <ProfileImage size={32} avatarUrl={author.avatar_url} name={author.display_name || author.username} />}
          <div>
            <p style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>{author?.display_name || author?.username || '...'}</p>
            <p style={{ fontSize: 10, color: 'var(--text-muted)' }}>{timeAgo(post.created_at)}</p>
          </div>
        </div>
        {profile?.id === post.user_id && (
          <button onClick={deletePost} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', fontSize: 12, fontFamily: 'var(--font-display)', letterSpacing: 1 }}>L{'\u00D6'}SCHEN</button>
        )}
      </div>

      {/* Media */}
      <div
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
        style={{ flex: 1, overflow: 'auto' }}
      >
        {post.media_url && post.media_type === 'video' ? (
          <video src={post.media_url} controls playsInline style={{ width: '100%', maxHeight: 400, objectFit: 'contain', background: '#000' }} />
        ) : post.media_url ? (
          <img src={post.media_url} alt="" style={{ width: '100%', maxHeight: 400, objectFit: 'contain', background: '#000' }} />
        ) : post.post_type === 'deal' ? (
          <div style={{ padding: 16, display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 200, background: 'var(--bg-surface)' }}>
            <div style={{ padding: 24, borderRadius: 16, border: '1px solid var(--gold-primary)', background: 'rgba(245,158,11,0.05)', textAlign: 'center' }}>
              <span style={{ fontSize: 32 }}>{'\u2694\uFE0F'}</span>
              <p className="font-display" style={{ fontSize: 14, color: 'var(--gold-primary)', marginTop: 8 }}>DEAL POST</p>
            </div>
          </div>
        ) : null}

        {/* Caption */}
        {post.caption && (
          <div style={{ padding: '12px 16px' }}>
            <p style={{ fontSize: 14, color: 'var(--text-primary)', lineHeight: 1.5 }}>{post.caption}</p>
          </div>
        )}

        {/* Reactions */}
        <div style={{ display: 'flex', gap: 6, padding: '8px 16px', flexWrap: 'wrap' }}>
          {REACTIONS.map(r => {
            const count = reactions[r.key] || 0
            const isActive = myReaction === r.key
            return (
              <button key={r.key} onClick={() => toggleReaction(r.key)} style={{
                display: 'flex', alignItems: 'center', gap: 5,
                padding: '6px 12px', borderRadius: 999,
                background: isActive ? 'var(--gold-subtle)' : 'transparent',
                border: `1px solid ${isActive ? 'var(--gold-glow)' : 'var(--border-default)'}`,
                cursor: 'pointer', fontSize: 14,
              }}>
                <span>{r.emoji}</span>
                {count > 0 && <span style={{ fontSize: 11, color: isActive ? 'var(--gold-primary)' : 'var(--text-muted)', fontFamily: 'var(--font-display)' }}>{count}</span>}
              </button>
            )
          })}
        </div>

        {/* Comments toggle */}
        <button onClick={() => { setShowComments(!showComments); if (!showComments) loadComments() }} style={{
          padding: '10px 16px', background: 'none', border: 'none', cursor: 'pointer',
          color: 'var(--text-muted)', fontSize: 12, fontFamily: 'var(--font-display)', letterSpacing: 1,
        }}>
          {'\uD83D\uDCAC'} {commentCount} KOMMENTARE {showComments ? '\u25B2' : '\u25BC'}
        </button>

        {/* Comments list */}
        {showComments && (
          <div style={{ padding: '0 16px 16px' }}>
            {comments.map(c => (
              <div key={c.id} style={{ display: 'flex', gap: 10, marginBottom: 12 }}>
                <ProfileImage size={28} avatarUrl={c.user?.avatar_url} name={c.user?.username} />
                <div>
                  <p style={{ fontSize: 12 }}>
                    <strong style={{ color: 'var(--text-primary)' }}>{c.user?.display_name || c.user?.username}</strong>
                    <span style={{ color: 'var(--text-muted)', marginLeft: 6, fontSize: 10 }}>{timeAgo(c.created_at)}</span>
                  </p>
                  <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginTop: 2 }}>{c.content}</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Comment Input */}
      <div style={{
        display: 'flex', gap: 8, padding: '10px 16px',
        paddingBottom: 'max(10px, env(safe-area-inset-bottom))',
        borderTop: '1px solid var(--border-subtle)', background: 'var(--bg-deepest)',
      }}>
        <input
          value={commentText}
          onChange={e => setCommentText(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') submitComment() }}
          placeholder="Kommentar schreiben..."
          style={{
            flex: 1, padding: '10px 14px', borderRadius: 20,
            background: 'var(--bg-surface)', border: '1px solid var(--border-default)',
            color: 'var(--text-primary)', fontSize: 13, outline: 'none',
          }}
        />
        <button onClick={submitComment} disabled={!commentText.trim()} style={{
          width: 40, height: 40, borderRadius: 20, border: 'none',
          background: commentText.trim() ? 'var(--gold-primary)' : 'var(--bg-surface)',
          color: commentText.trim() ? 'var(--text-inverse)' : 'var(--text-muted)',
          cursor: commentText.trim() ? 'pointer' : 'default', fontSize: 16,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>{'\u27A4'}</button>
      </div>
    </div>
    </div>
  )

  return createPortal(content, document.body)
}
