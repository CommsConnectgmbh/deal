'use client'
import React, { useState, useEffect, useRef } from 'react'
import ProfileImage from '@/components/ProfileImage'
import ClickableUsername from '@/components/ClickableUsername'
import { supabase } from '@/lib/supabase'
import { uploadCommentMedia } from '@/lib/mediaUpload'
import { useAuth } from '@/contexts/AuthContext'
import { useLang } from '@/contexts/LanguageContext'

interface Comment {
  id: string
  user_id: string
  content: string
  media_url?: string | null
  created_at: string
  user?: { username: string; display_name: string; avatar_url?: string }
}

interface Props {
  dealId: string
  open: boolean
  onClose: () => void
  onCountChange?: (count: number) => void
}

export default function CommentSheet({ dealId, open, onClose, onCountChange }: Props) {
  const { profile } = useAuth()
  const { t } = useLang()

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
  const [comments, setComments] = useState<Comment[]>([])
  const [text, setText] = useState('')
  const [sending, setSending] = useState(false)
  const [loading, setLoading] = useState(true)
  const [mediaFile, setMediaFile] = useState<File | null>(null)
  const [mediaPreview, setMediaPreview] = useState<string | null>(null)
  const [imgOverlay, setImgOverlay] = useState<string | null>(null)
  const scrollRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (open) {
      loadComments()
      setTimeout(() => inputRef.current?.focus(), 300)
    }
  }, [open, dealId])

  const loadComments = async () => {
    setLoading(true)
    // Single query with JOIN — no separate profiles fetch needed
    const { data } = await supabase
      .from('deal_comments')
      .select('id, user_id, content, media_url, created_at, profiles:user_id(id, username, display_name, avatar_url)')
      .eq('deal_id', dealId)
      .order('created_at', { ascending: true })

    if (data && data.length > 0) {
      setComments(data.map((c: any) => ({
        id: c.id,
        user_id: c.user_id,
        content: c.content,
        media_url: c.media_url,
        created_at: c.created_at,
        user: c.profiles || { username: '?', display_name: '?' },
      })))
    } else {
      setComments([])
    }
    setLoading(false)
    onCountChange?.(data?.length || 0)
    setTimeout(() => scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' }), 100)
  }

  const sendComment = async () => {
    if (!profile || (!text.trim() && !mediaFile) || sending) return
    setSending(true)

    let mediaUrl: string | undefined
    if (mediaFile) {
      try {
        mediaUrl = await uploadCommentMedia(mediaFile, dealId)
      } catch (err) { console.error('Comment media upload error:', err) }
    }

    const { error } = await supabase.from('deal_comments').insert({
      deal_id: dealId,
      user_id: profile.id,
      content: text.trim() || (mediaUrl ? '📷' : ''),
      ...(mediaUrl ? { media_url: mediaUrl } : {}),
    })
    if (!error) {
      setText('')
      setMediaFile(null)
      setMediaPreview(null)
      await loadComments()
    }
    setSending(false)
  }

  const deleteComment = async (id: string) => {
    await supabase.from('deal_comments').delete().eq('id', id)
    setComments(prev => prev.filter(c => c.id !== id))
    onCountChange?.(comments.length - 1)
  }

  const handleFilePick = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0]
    if (!f) return
    e.target.value = ''
    if (!f.type.startsWith('image/')) return
    setMediaFile(f)
    setMediaPreview(URL.createObjectURL(f))
  }

  if (!open) return null

  return (
    <div style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.85)',
      display: 'flex', alignItems: 'flex-end', zIndex: 300,
    }} onClick={onClose}>
      <div style={{
        width: '100%', maxWidth: 430, margin: '0 auto',
        background: 'var(--bg-surface)', borderRadius: '20px 20px 0 0',
        border: '1px solid var(--border-subtle)',
        maxHeight: '70vh', display: 'flex', flexDirection: 'column',
      }} onClick={e => e.stopPropagation()}>

        {/* Header */}
        <div style={{
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          padding: '16px 20px 12px', borderBottom: '1px solid var(--border-subtle)',
        }}>
          <span style={{ fontFamily: 'var(--font-display)', fontSize: 14, color: 'var(--text-primary)', letterSpacing: 2 }}>
            {t('components.comments')} ({comments.length})
          </span>
          <button onClick={onClose} style={{
            background: 'none', border: 'none', color: 'var(--text-muted)', fontSize: 20, cursor: 'pointer', padding: 4,
          }}>✕</button>
        </div>

        {/* Comments list */}
        <div ref={scrollRef} style={{
          flex: 1, overflowY: 'auto', padding: '12px 16px',
          scrollbarWidth: 'none',
        }}>
          {loading ? (
            <div style={{ textAlign: 'center', padding: 30, color: 'var(--text-muted)' }}>{t('components.loading')}</div>
          ) : comments.length === 0 ? (
            <div style={{ textAlign: 'center', padding: 30, color: 'var(--text-muted)', fontSize: 13 }}>
              {t('components.noComments')}
            </div>
          ) : comments.map(c => (
            <div key={c.id} style={{
              display: 'flex', gap: 10, marginBottom: 16,
            }}>
              <div style={{ flexShrink: 0, marginTop: 2 }}>
                <ProfileImage size={32} avatarUrl={c.user?.avatar_url} name={c.user?.display_name || c.user?.username} />
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 3 }}>
                  <ClickableUsername username={c.user?.username || '?'} displayName={c.user?.display_name} fontSize={12} />
                  <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>{timeAgo(c.created_at)}</span>
                  {profile && c.user_id === profile.id && (
                    <button onClick={() => deleteComment(c.id)} style={{
                      background: 'none', border: 'none', color: 'var(--text-muted)', fontSize: 10, cursor: 'pointer', marginLeft: 'auto',
                    }}>{t('components.delete')}</button>
                  )}
                </div>
                <p style={{ fontSize: 13, color: 'var(--text-primary)', lineHeight: 1.4, margin: 0, wordBreak: 'break-word' }}>
                  {c.content}
                </p>
                {c.media_url && (
                  <img
                    src={c.media_url}
                    alt=""
                    loading="lazy"
                    onClick={() => setImgOverlay(c.media_url!)}
                    onError={(e) => { (e.target as HTMLImageElement).style.display = 'none' }}
                    style={{ marginTop: 6, maxWidth: 200, maxHeight: 160, borderRadius: 10, objectFit: 'cover', cursor: 'pointer', display: 'block' }}
                  />
                )}
              </div>
            </div>
          ))}
        </div>

        {/* Media preview strip */}
        {mediaPreview && (
          <div style={{ padding: '8px 16px 0', display: 'flex', alignItems: 'center', gap: 8, borderTop: '1px solid var(--border-subtle)' }}>
            <img src={mediaPreview} alt="" loading="lazy" style={{ width: 48, height: 48, borderRadius: 8, objectFit: 'cover' }} />
            <span style={{ fontSize: 11, color: 'var(--text-secondary)', flex: 1 }}>{t('components.imageAttached')}</span>
            <button onClick={() => { setMediaFile(null); setMediaPreview(null) }} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', fontSize: 16, cursor: 'pointer' }}>✕</button>
          </div>
        )}

        {/* Input */}
        {profile && (
          <div style={{
            display: 'flex', alignItems: 'center', gap: 8,
            padding: '12px 16px', borderTop: mediaPreview ? 'none' : '1px solid var(--border-subtle)',
            paddingBottom: 'max(12px, env(safe-area-inset-bottom))',
          }}>
            <div style={{ flexShrink: 0 }}>
              <ProfileImage size={28} avatarUrl={profile?.avatar_url} name={profile?.display_name || profile?.username} />
            </div>
            <button onClick={() => fileRef.current?.click()} style={{
              background: 'none', border: 'none', fontSize: 18, cursor: 'pointer', padding: 2, color: 'var(--text-secondary)',
              flexShrink: 0,
            }}>📷</button>
            <input ref={fileRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={handleFilePick} />
            <input
              ref={inputRef}
              value={text}
              onChange={e => setText(e.target.value.slice(0, 500))}
              onKeyDown={e => e.key === 'Enter' && sendComment()}
              placeholder={t('components.writeComment')}
              style={{
                flex: 1, background: 'var(--bg-deepest)', border: '1px solid var(--border-subtle)',
                borderRadius: 20, padding: '8px 14px', color: 'var(--text-primary)',
                fontSize: 13, outline: 'none',
              }}
            />
            <button
              onClick={sendComment}
              disabled={(!text.trim() && !mediaFile) || sending}
              style={{
                background: (text.trim() || mediaFile) ? 'var(--gold-primary)' : '#333',
                border: 'none', borderRadius: '50%',
                width: 34, height: 34, cursor: (text.trim() || mediaFile) ? 'pointer' : 'default',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 16, color: 'var(--text-inverse)', fontWeight: 700,
                transition: 'background 0.15s',
                flexShrink: 0,
              }}
            >
              ➤
            </button>
          </div>
        )}
      </div>

      {/* Image Overlay */}
      {imgOverlay && (
        <div onClick={e => { e.stopPropagation(); setImgOverlay(null) }} style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.95)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 400,
          cursor: 'pointer',
        }}>
          <img src={imgOverlay} alt="" style={{ maxWidth: '90vw', maxHeight: '85vh', borderRadius: 12, objectFit: 'contain' }} />
        </div>
      )}
    </div>
  )
}
