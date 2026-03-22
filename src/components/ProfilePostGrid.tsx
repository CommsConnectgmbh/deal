'use client'
import { useState, useEffect, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import PostViewer from '@/components/PostViewer'
import { useLang } from '@/contexts/LanguageContext'

interface ProfilePost {
  id: string
  user_id: string
  post_type: 'photo' | 'video' | 'deal'
  media_url: string | null
  media_type: string | null
  thumbnail_url: string | null
  caption: string | null
  deal_id: string | null
  is_public: boolean
  created_at: string
}

interface Props {
  userId: string
  isOwnProfile: boolean
  onCreatePost?: () => void
}

export default function ProfilePostGrid({ userId, isOwnProfile, onCreatePost }: Props) {
  const { t } = useLang()
  const [posts, setPosts] = useState<ProfilePost[]>([])
  const [loading, setLoading] = useState(true)
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid')
  const [selectedPostIndex, setSelectedPostIndex] = useState<number | null>(null)

  const loadPosts = useCallback(async () => {
    const { data } = await supabase
      .from('profile_posts')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(50)
    setPosts(data || [])
    setLoading(false)
  }, [userId])

  useEffect(() => { loadPosts() }, [loadPosts])

  if (loading) {
    return (
      <div style={{ padding: '24px 16px' }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 2 }}>
          {[1,2,3,4,5,6].map(i => (
            <div key={i} style={{ aspectRatio: '1', background: 'var(--bg-overlay)', borderRadius: 4, animation: 'pulse 1.5s ease-in-out infinite' }} />
          ))}
        </div>
      </div>
    )
  }

  if (posts.length === 0) {
    if (!isOwnProfile) return null
    return (
      <div style={{ textAlign: 'center', padding: '40px 24px' }}>
        <div style={{ fontSize: 40, marginBottom: 12, opacity: 0.4 }}>{'\uD83D\uDCF7'}</div>
        <p className="font-display" style={{ fontSize: 14, color: 'var(--text-primary)', marginBottom: 6 }}>
          NOCH KEINE BEITR{'\u00C4'}GE
        </p>
        <p style={{ color: 'var(--text-muted)', fontSize: 12, marginBottom: 20 }}>
          {t('components.shareFirstMoment')}
        </p>
        {isOwnProfile && onCreatePost && (
          <button onClick={onCreatePost} style={{
            padding: '12px 28px', borderRadius: 10, border: 'none',
            background: 'var(--gold-primary)', color: 'var(--text-inverse)',
            fontFamily: 'var(--font-display)', fontSize: 11, fontWeight: 700,
            letterSpacing: 1, cursor: 'pointer',
          }}>{'+ BEITRAG ERSTELLEN'}</button>
        )}
      </div>
    )
  }

  const getPostIcon = (post: ProfilePost) => {
    if (post.post_type === 'video') return '\u25B6\uFE0F'
    if (post.post_type === 'deal') return '\u2694\uFE0F'
    return null
  }

  const getPostThumb = (post: ProfilePost) => {
    if (post.thumbnail_url) return post.thumbnail_url
    if (post.media_url) return post.media_url
    return null
  }

  return (
    <div style={{ padding: '0 0 24px' }}>
      {/* Section Header + Toggle */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '16px 16px 12px',
      }}>
        <p className="font-display" style={{ fontSize: 10, letterSpacing: 3, color: 'var(--text-muted)' }}>
          BEITR{'\u00C4'}GE ({posts.length})
        </p>
        <div style={{ display: 'flex', gap: 4 }}>
          <button onClick={() => setViewMode('grid')} style={{
            width: 32, height: 32, borderRadius: 6, border: 'none', cursor: 'pointer',
            background: viewMode === 'grid' ? 'var(--gold-subtle)' : 'transparent',
            color: viewMode === 'grid' ? 'var(--gold-primary)' : 'var(--text-muted)',
            fontSize: 14, display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
              <rect x="0" y="0" width="4.5" height="4.5" rx="1"/><rect x="5.75" y="0" width="4.5" height="4.5" rx="1"/>
              <rect x="11.5" y="0" width="4.5" height="4.5" rx="1"/><rect x="0" y="5.75" width="4.5" height="4.5" rx="1"/>
              <rect x="5.75" y="5.75" width="4.5" height="4.5" rx="1"/><rect x="11.5" y="5.75" width="4.5" height="4.5" rx="1"/>
              <rect x="0" y="11.5" width="4.5" height="4.5" rx="1"/><rect x="5.75" y="11.5" width="4.5" height="4.5" rx="1"/>
              <rect x="11.5" y="11.5" width="4.5" height="4.5" rx="1"/>
            </svg>
          </button>
          <button onClick={() => setViewMode('list')} style={{
            width: 32, height: 32, borderRadius: 6, border: 'none', cursor: 'pointer',
            background: viewMode === 'list' ? 'var(--gold-subtle)' : 'transparent',
            color: viewMode === 'list' ? 'var(--gold-primary)' : 'var(--text-muted)',
            fontSize: 14, display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
              <rect x="0" y="0" width="16" height="4.5" rx="1"/><rect x="0" y="5.75" width="16" height="4.5" rx="1"/>
              <rect x="0" y="11.5" width="16" height="4.5" rx="1"/>
            </svg>
          </button>
        </div>
      </div>

      {/* Grid View */}
      {viewMode === 'grid' ? (
        <div style={{
          display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 2,
          padding: '0 2px',
        }}>
          {posts.map((post, i) => {
            const thumb = getPostThumb(post)
            const icon = getPostIcon(post)
            return (
              <div
                key={post.id}
                onClick={() => setSelectedPostIndex(i)}
                style={{
                  aspectRatio: '1', position: 'relative', cursor: 'pointer',
                  background: 'var(--bg-overlay)', overflow: 'hidden', borderRadius: 2,
                  border: post.post_type === 'deal' ? '1px solid rgba(245,158,11,0.3)' : 'none',
                }}
              >
                {thumb ? (
                  <img src={thumb} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} loading="lazy" />
                ) : (
                  <div style={{
                    width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center',
                    background: post.post_type === 'deal' ? 'rgba(245,158,11,0.08)' : 'var(--bg-surface)',
                  }}>
                    <span style={{ fontSize: 24, opacity: 0.5 }}>{post.post_type === 'deal' ? '\u2694\uFE0F' : '\uD83D\uDCF7'}</span>
                  </div>
                )}
                {icon && (
                  <div style={{
                    position: 'absolute', top: 4, right: 4,
                    width: 22, height: 22, borderRadius: 4,
                    background: 'rgba(0,0,0,0.6)', display: 'flex',
                    alignItems: 'center', justifyContent: 'center',
                    fontSize: 11,
                  }}>{icon}</div>
                )}
              </div>
            )
          })}
        </div>
      ) : (
        /* List View */
        <div style={{ padding: '0 16px', display: 'flex', flexDirection: 'column', gap: 12 }}>
          {posts.map((post, i) => {
            const thumb = getPostThumb(post)
            return (
              <div
                key={post.id}
                onClick={() => setSelectedPostIndex(i)}
                style={{
                  display: 'flex', gap: 12, padding: 12,
                  background: 'var(--bg-surface)', borderRadius: 12,
                  border: '1px solid var(--border-subtle)', cursor: 'pointer',
                }}
              >
                <div style={{
                  width: 80, height: 80, borderRadius: 8, overflow: 'hidden', flexShrink: 0,
                  background: 'var(--bg-overlay)',
                }}>
                  {thumb ? (
                    <img src={thumb} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} loading="lazy" />
                  ) : (
                    <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <span style={{ fontSize: 24, opacity: 0.4 }}>{post.post_type === 'deal' ? '\u2694\uFE0F' : '\uD83D\uDCF7'}</span>
                    </div>
                  )}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 4, fontFamily: 'var(--font-display)', letterSpacing: 1 }}>
                    {post.post_type === 'deal' ? 'DEAL' : post.post_type === 'video' ? 'VIDEO' : 'FOTO'}
                  </p>
                  {post.caption && (
                    <p style={{ fontSize: 13, color: 'var(--text-primary)', lineHeight: 1.4, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {post.caption}
                    </p>
                  )}
                  <p style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>
                    {new Date(post.created_at).toLocaleDateString('de-DE', { day: 'numeric', month: 'short' })}
                  </p>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Post Viewer */}
      {selectedPostIndex !== null && (
        <PostViewer
          posts={posts}
          initialIndex={selectedPostIndex}
          onClose={() => { setSelectedPostIndex(null); loadPosts() }}
        />
      )}
    </div>
  )
}
