'use client'
import { useState, useEffect, useRef, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/contexts/AuthContext'
import { useLang } from '@/contexts/LanguageContext'
import { supabase } from '@/lib/supabase'
import ProfileImage from '@/components/ProfileImage'
import CommentSheet from '@/components/CommentSheet'
import { trackScreenView, track } from '@/lib/analytics'

/* ─── Types ─── */
interface BlitzVideo {
  id: string
  title: string
  stake: string | null
  status: string
  media_url: string
  created_at: string
  creator: { username: string; display_name: string; avatar_url: string | null } | null
  opponent: { username: string; display_name: string; avatar_url: string | null } | null
}

/* ─── Status color map ─── */
const STATUS_COLORS: Record<string, string> = {
  open: '#FFB800', pending: '#f97316', active: '#4ade80',
  pending_confirmation: '#a78bfa', completed: '#60a5fa',
  cancelled: '#f87171', disputed: '#ef4444',
}

export default function BlitzPage() {
  const { profile } = useAuth()
  const { t } = useLang()
  const router = useRouter()

  const [videos, setVideos] = useState<BlitzVideo[]>([])
  const [loading, setLoading] = useState(true)
  const [currentIndex, setCurrentIndex] = useState(0)
  const [isMuted, setIsMuted] = useState(true)

  // Social interaction state
  const [likedDeals, setLikedDeals] = useState<Record<string, boolean>>({})
  const [likeCounts, setLikeCounts] = useState<Record<string, number>>({})
  const [commentCounts, setCommentCounts] = useState<Record<string, number>>({})
  const [repostCounts, setRepostCounts] = useState<Record<string, number>>({})
  const [commentOpen, setCommentOpen] = useState(false)
  const [commentDealId, setCommentDealId] = useState<string | null>(null)

  // Refs
  const videoRefs = useRef<(HTMLVideoElement | null)[]>([])
  const touchStartY = useRef(0)
  const touchStartX = useRef(0)
  const touchStartTime = useRef(0)
  const isSwiping = useRef(false)
  const swipeOffset = useRef(0)
  const containerRef = useRef<HTMLDivElement>(null)
  const wheelCooldown = useRef(false)
  const lastTouchTime = useRef(0)

  /* ─── Track page view ─── */
  useEffect(() => { trackScreenView('blitz') }, [])

  /* ─── Load videos ─── */
  useEffect(() => {
    async function loadVideos() {
      setLoading(true)
      const { data } = await supabase
        .from('challenges')
        .select('id, title, stake, status, media_url, media_type, created_at, creator:creator_id(username, display_name, avatar_url), opponent:opponent_id(username, display_name, avatar_url)')
        .eq('media_type', 'video')
        .not('media_url', 'is', null)
        .order('created_at', { ascending: false })
        .limit(50)

      if (data) {
        setVideos(data as unknown as BlitzVideo[])
      }
      setLoading(false)
    }
    loadVideos()
  }, [])

  /* ─── Load social data for current video ─── */
  const loadSocialData = useCallback(async (dealId: string) => {
    if (!profile || !dealId) return
    const [likesRes, myLike, commentsRes, repostsRes] = await Promise.all([
      supabase.from('deal_likes').select('deal_id', { count: 'exact', head: true }).eq('deal_id', dealId),
      supabase.from('deal_likes').select('deal_id').eq('deal_id', dealId).eq('user_id', profile.id).maybeSingle(),
      supabase.from('deal_comments').select('id', { count: 'exact', head: true }).eq('deal_id', dealId),
      supabase.from('deal_reposts').select('original_deal_id', { count: 'exact', head: true }).eq('original_deal_id', dealId),
    ])
    setLikeCounts(prev => ({ ...prev, [dealId]: likesRes.count || 0 }))
    setLikedDeals(prev => ({ ...prev, [dealId]: !!myLike.data }))
    setCommentCounts(prev => ({ ...prev, [dealId]: commentsRes.count || 0 }))
    setRepostCounts(prev => ({ ...prev, [dealId]: repostsRes.count || 0 }))
  }, [profile])

  useEffect(() => {
    if (videos[currentIndex]) loadSocialData(videos[currentIndex].id)
  }, [currentIndex, videos, loadSocialData])

  const toggleLike = async (e: React.MouseEvent, dealId: string) => {
    e.stopPropagation()
    if (!profile) return
    const isLiked = likedDeals[dealId]
    if (isLiked) {
      await supabase.from('deal_likes').delete().eq('deal_id', dealId).eq('user_id', profile.id)
      setLikedDeals(prev => ({ ...prev, [dealId]: false }))
      setLikeCounts(prev => ({ ...prev, [dealId]: Math.max(0, (prev[dealId] || 0) - 1) }))
    } else {
      await supabase.from('deal_likes').upsert({ deal_id: dealId, user_id: profile.id }, { onConflict: 'deal_id,user_id' })
      setLikedDeals(prev => ({ ...prev, [dealId]: true }))
      setLikeCounts(prev => ({ ...prev, [dealId]: (prev[dealId] || 0) + 1 }))
    }
    if (typeof navigator !== 'undefined' && navigator.vibrate) navigator.vibrate(10)
  }

  const handleRepost = async (e: React.MouseEvent, dealId: string) => {
    e.stopPropagation()
    if (!profile) return
    const { data: existing } = await supabase.from('deal_reposts')
      .select('id').eq('original_deal_id', dealId).eq('user_id', profile.id).maybeSingle()
    if (existing) {
      await supabase.from('deal_reposts').delete().eq('id', existing.id)
      setRepostCounts(prev => ({ ...prev, [dealId]: Math.max(0, (prev[dealId] || 0) - 1) }))
    } else {
      await supabase.from('deal_reposts').insert({ original_deal_id: dealId, user_id: profile.id })
      setRepostCounts(prev => ({ ...prev, [dealId]: (prev[dealId] || 0) + 1 }))
    }
    if (typeof navigator !== 'undefined' && navigator.vibrate) navigator.vibrate(10)
  }

  const handleShare = async (e: React.MouseEvent, dealId: string, title: string) => {
    e.stopPropagation()
    const url = `https://app.deal-buddy.app/deal/${dealId}`
    try {
      if (navigator.share) {
        await navigator.share({ title, url })
      } else {
        await navigator.clipboard.writeText(url)
      }
    } catch {}
  }

  const openComments = (e: React.MouseEvent, dealId: string) => {
    e.stopPropagation()
    setCommentDealId(dealId)
    setCommentOpen(true)
    // Pause video when comments open
    const vid = videoRefs.current[currentIndex]
    if (vid) vid.pause()
  }

  /* ─── Autoplay/Pause logic ─── */
  useEffect(() => {
    videoRefs.current.forEach((video, idx) => {
      if (!video) return
      if (idx === currentIndex) {
        video.currentTime = 0
        track('blitz_video_viewed', { video_id: videos[idx]?.id })
        // Always start muted for autoplay, then apply user mute preference
        video.muted = true
        const playPromise = video.play()
        if (playPromise) {
          playPromise.then(() => {
            // Once playing, apply mute preference
            if (video) video.muted = isMuted
          }).catch(() => { /* iOS autoplay blocked */ })
        }
      } else {
        video.pause()
      }
    })
  }, [currentIndex, isMuted])

  /* ─── Touch handlers ─── */
  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    touchStartY.current = e.touches[0].clientY
    touchStartX.current = e.touches[0].clientX
    touchStartTime.current = Date.now()
    isSwiping.current = false
    swipeOffset.current = 0
  }, [])

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    const deltaY = e.touches[0].clientY - touchStartY.current
    const deltaX = e.touches[0].clientX - touchStartX.current

    // Only process vertical swipes (ignore horizontal)
    if (Math.abs(deltaY) > Math.abs(deltaX) && Math.abs(deltaY) > 10) {
      isSwiping.current = true
      swipeOffset.current = deltaY

      // Apply live transform during swipe
      if (containerRef.current) {
        const base = -currentIndex * window.innerHeight
        containerRef.current.style.transition = 'none'
        containerRef.current.style.transform = `translateY(${base + deltaY}px)`
      }
    }
  }, [currentIndex])

  const handleTouchEnd = useCallback(() => {
    lastTouchTime.current = Date.now()
    const deltaY = touchStartY.current - (touchStartY.current - swipeOffset.current)
    const duration = Date.now() - touchStartTime.current
    const totalMovement = Math.abs(swipeOffset.current)
    const totalXMovement = Math.abs(touchStartX.current - touchStartX.current) // already 0

    // Snap back with transition
    if (containerRef.current) {
      containerRef.current.style.transition = 'transform 0.35s cubic-bezier(0.25, 0.46, 0.45, 0.94)'
    }

    if (isSwiping.current && totalMovement > 50) {
      // Swipe detected
      if (swipeOffset.current < -50 && currentIndex < videos.length - 1) {
        // Swipe up → next
        setCurrentIndex(prev => prev + 1)
      } else if (swipeOffset.current > 50 && currentIndex > 0) {
        // Swipe down → previous
        setCurrentIndex(prev => prev - 1)
      } else {
        // Snap back
        if (containerRef.current) {
          containerRef.current.style.transform = `translateY(-${currentIndex * window.innerHeight}px)`
        }
      }
    } else if (totalMovement < 10 && duration < 300) {
      // Tap → open deal
      if (videos[currentIndex]) {
        router.push(`/app/deals/${videos[currentIndex].id}`)
      }
    } else {
      // Snap back
      if (containerRef.current) {
        containerRef.current.style.transform = `translateY(-${currentIndex * window.innerHeight}px)`
      }
    }

    isSwiping.current = false
    swipeOffset.current = 0
  }, [currentIndex, videos, router])

  /* ─── Update transform when currentIndex changes ─── */
  useEffect(() => {
    if (containerRef.current) {
      containerRef.current.style.transition = 'transform 0.35s cubic-bezier(0.25, 0.46, 0.45, 0.94)'
      containerRef.current.style.transform = `translateY(-${currentIndex * window.innerHeight}px)`
    }
  }, [currentIndex])

  /* ─── Desktop navigation: wheel (non-passive so we can preventDefault) + keyboard ─── */
  useEffect(() => {
    const el = containerRef.current?.parentElement
    if (!el) return

    const onWheel = (e: WheelEvent) => {
      e.preventDefault()
      if (wheelCooldown.current) return
      if (Math.abs(e.deltaY) < 20) return
      wheelCooldown.current = true
      setTimeout(() => { wheelCooldown.current = false }, 450)
      if (e.deltaY > 0) {
        setCurrentIndex(prev => Math.min(prev + 1, videos.length - 1))
      } else {
        setCurrentIndex(prev => Math.max(prev - 1, 0))
      }
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'ArrowDown' || e.key === 'PageDown' || e.key === 'j') {
        e.preventDefault()
        setCurrentIndex(prev => Math.min(prev + 1, videos.length - 1))
      } else if (e.key === 'ArrowUp' || e.key === 'PageUp' || e.key === 'k') {
        e.preventDefault()
        setCurrentIndex(prev => Math.max(prev - 1, 0))
      }
    }

    el.addEventListener('wheel', onWheel, { passive: false })
    window.addEventListener('keydown', onKey)
    return () => {
      el.removeEventListener('wheel', onWheel)
      window.removeEventListener('keydown', onKey)
    }
  }, [videos.length])

  const handleClick = useCallback(() => {
    // Skip synthesized click after touch (mobile handleTouchEnd already handled the tap)
    if (Date.now() - lastTouchTime.current < 500) return
    if (videos[currentIndex]) router.push(`/app/deals/${videos[currentIndex].id}`)
  }, [videos, currentIndex, router])

  const toggleMute = useCallback((e: React.MouseEvent) => {
    e.stopPropagation()
    setIsMuted(prev => !prev)
  }, [])

  const goBack = useCallback((e: React.MouseEvent) => {
    e.stopPropagation()
    router.push('/app/home')
  }, [router])

  /* ─── RENDER ─── */
  return (
    <div className="blitz-fullscreen">

      {/* ═══ TOP CONTROLS ═══ */}
      <div style={{
        position: 'absolute', top: 0, left: 0, right: 0,
        zIndex: 210, display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        padding: `calc(env(safe-area-inset-top, 12px) + 12px) 16px 12px`,
      }}>
        {/* Back */}
        <button onClick={goBack} style={{
          width: 40, height: 40, borderRadius: '50%',
          background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(10px)',
          border: '1px solid rgba(255,255,255,0.1)',
          cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
          color: '#fff', fontSize: 18,
        }}>
          {'\u2715'}
        </button>

        {/* Title */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ fontSize: 16 }}>{'\u26A1'}</span>
          <span style={{
            fontFamily: 'var(--font-display)', fontSize: 14, fontWeight: 700,
            color: '#fff', letterSpacing: 2,
          }}>
            BLITZ
          </span>
        </div>

        {/* Mute toggle */}
        <button onClick={toggleMute} style={{
          width: 40, height: 40, borderRadius: '50%',
          background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(10px)',
          border: '1px solid rgba(255,255,255,0.1)',
          cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
          color: '#fff', fontSize: 18,
        }}>
          {isMuted ? '\u{1F507}' : '\u{1F50A}'}
        </button>
      </div>

      {/* ═══ LOADING ═══ */}
      {loading && (
        <div style={{
          position: 'absolute', inset: 0,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <div style={{
            width: 32, height: 32,
            border: '2px solid transparent', borderTopColor: '#FFB800',
            borderRadius: '50%', animation: 'spin 0.8s linear infinite',
          }} />
        </div>
      )}

      {/* ═══ EMPTY STATE ═══ */}
      {!loading && videos.length === 0 && (
        <div style={{
          position: 'absolute', inset: 0,
          display: 'flex', flexDirection: 'column',
          alignItems: 'center', justifyContent: 'center',
          padding: '0 32px',
        }}>
          <span style={{ fontSize: 56, marginBottom: 16 }}>{'\u26A1'}</span>
          <p style={{
            fontFamily: 'var(--font-display)', fontSize: 16, fontWeight: 700,
            color: '#fff', letterSpacing: 2, textAlign: 'center',
          }}>
            {t('blitz.noVideos')}
          </p>
          <p style={{
            fontFamily: 'var(--font-body)', fontSize: 13,
            color: 'rgba(255,255,255,0.5)', marginTop: 8, textAlign: 'center',
            lineHeight: 1.5,
          }}>
            {t('blitz.noVideosDesc')}
          </p>
          <button onClick={() => router.push('/app/deals/create')} style={{
            marginTop: 24, padding: '12px 24px', borderRadius: 12,
            background: 'linear-gradient(135deg, rgba(255,184,0,0.2), rgba(255,184,0,0.1))',
            border: '1px solid rgba(255,184,0,0.3)',
            color: '#FFB800', fontFamily: 'var(--font-display)',
            fontSize: 12, fontWeight: 700, letterSpacing: 1.5,
            cursor: 'pointer',
          }}>
            {t('challenges.createChallenge')}
          </button>
        </div>
      )}

      {/* ═══ VIDEO FEED ═══ */}
      {!loading && videos.length > 0 && (
        <>
          <div
            ref={containerRef}
            onTouchStart={handleTouchStart}
            onTouchMove={handleTouchMove}
            onTouchEnd={handleTouchEnd}
            onClick={handleClick}
            style={{
              width: '100%',
              height: `${videos.length * 100}vh`,
              display: 'flex', flexDirection: 'column',
              cursor: 'pointer',
            }}
          >
            {videos.map((video, idx) => (
              <div key={video.id} style={{
                width: '100%', height: '100vh',
                position: 'relative', flexShrink: 0,
                overflow: 'hidden',
              }}>
                {/* Video element */}
                <video
                  ref={el => { videoRefs.current[idx] = el }}
                  src={video.media_url}
                  autoPlay={idx === currentIndex}
                  muted
                  playsInline
                  loop
                  preload={Math.abs(idx - currentIndex) <= 1 ? 'auto' : 'none'}
                  style={{
                    width: '100%', height: '100%',
                    objectFit: 'cover',
                  }}
                />

                {/* ═══ BOTTOM OVERLAY — Deal Info ═══ */}
                <div style={{
                  position: 'absolute', bottom: 0, left: 0, right: 0,
                  padding: '80px 16px 32px',
                  background: 'linear-gradient(to top, rgba(0,0,0,0.85) 0%, rgba(0,0,0,0.4) 60%, transparent 100%)',
                  pointerEvents: 'none',
                }}>
                  {/* Status pill */}
                  <div style={{ marginBottom: 10 }}>
                    <span style={{
                      fontSize: 8, fontFamily: 'var(--font-display)', fontWeight: 700,
                      letterSpacing: 1.5, textTransform: 'uppercase' as const,
                      padding: '3px 8px', borderRadius: 4,
                      color: STATUS_COLORS[video.status] || '#888',
                      background: `${STATUS_COLORS[video.status] || '#888'}20`,
                      border: `1px solid ${STATUS_COLORS[video.status] || '#888'}40`,
                    }}>
                      {video.status === 'active' ? '\u26A1 LIVE DUEL' :
                       video.status === 'open' ? t('deals.statusOpen') :
                       video.status === 'completed' ? t('deals.statusCompleted') :
                       video.status.toUpperCase()}
                    </span>
                  </div>

                  {/* Deal title */}
                  <p style={{
                    fontFamily: 'var(--font-display)', fontSize: 18, fontWeight: 900,
                    color: '#fff', textShadow: '0 2px 8px rgba(0,0,0,0.8)',
                    margin: '0 0 6px', lineHeight: 1.3,
                    textTransform: 'uppercase' as const, letterSpacing: 1,
                  }}>
                    {video.title}
                  </p>

                  {/* Participants */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                    {video.creator && (
                      <ProfileImage
                        size={22}
                        avatarUrl={video.creator.avatar_url}
                        name={video.creator.display_name || video.creator.username}
                      />
                    )}
                    <p style={{
                      fontFamily: 'var(--font-body)', fontSize: 13,
                      color: 'rgba(255,255,255,0.85)',
                      textShadow: '0 1px 4px rgba(0,0,0,0.6)',
                      margin: 0,
                    }}>
                      <span style={{ fontWeight: 700 }}>@{video.creator?.username || '?'}</span>
                      {video.opponent ? (
                        <> vs <span style={{ fontWeight: 700 }}>@{video.opponent.username}</span></>
                      ) : (
                        <span style={{ color: '#FFB800' }}> {'\u00B7'} {t('deals.searchingOpponent')}</span>
                      )}
                    </p>
                  </div>

                  {/* Stake */}
                  {video.stake && (
                    <p style={{
                      fontFamily: 'var(--font-body)', fontSize: 12,
                      color: '#FFB800',
                      textShadow: '0 1px 4px rgba(0,0,0,0.6)',
                      margin: '0 0 10px',
                    }}>
                      {'\uD83D\uDD25'} {t('blitz.stake')} {video.stake}
                    </p>
                  )}

                  {/* Tap hint */}
                  <p style={{
                    fontFamily: 'var(--font-body)', fontSize: 10,
                    color: 'rgba(255,255,255,0.4)', margin: 0,
                    letterSpacing: 0.5,
                  }}>
                    {t('blitz.tapToOpen')}
                  </p>
                </div>

                {/* ═══ RIGHT SIDE — Social Interaction Bar (vertical) ═══ */}
                <div style={{
                  position: 'absolute', right: 12, bottom: 140,
                  display: 'flex', flexDirection: 'column', gap: 20,
                  alignItems: 'center',
                  pointerEvents: 'auto',
                }}>
                  {/* Like/Fire */}
                  <button onClick={(e) => toggleLike(e, video.id)} style={{
                    background: 'none', border: 'none', cursor: 'pointer',
                    display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2,
                    padding: 0,
                  }}>
                    <div style={{
                      width: 46, height: 46, borderRadius: '50%',
                      background: likedDeals[video.id] ? 'rgba(255,184,0,0.2)' : 'rgba(0,0,0,0.4)',
                      backdropFilter: 'blur(8px)',
                      border: likedDeals[video.id] ? '1px solid rgba(255,184,0,0.4)' : '1px solid rgba(255,255,255,0.15)',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      transition: 'all 0.2s',
                    }}>
                      <svg width="22" height="22" viewBox="0 0 24 24" fill={likedDeals[video.id] ? '#FFB800' : 'none'} stroke={likedDeals[video.id] ? '#FFB800' : '#fff'} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M12 22c-4.97 0-8-3.58-8-7.5 0-3.07 2.17-5.66 3.8-7.32.47-.48 1.2-.15 1.22.52.04 1.52.62 3.18 1.98 4.1.35-.85.6-2.05.6-3.3 0-1.1-.16-2.23-.52-3.27-.23-.67.33-1.4 1.02-1.23 3.24.8 6.9 4.3 6.9 9C19 18.42 16.97 22 12 22z" />
                      </svg>
                    </div>
                    <span style={{ fontSize: 11, fontFamily: 'var(--font-display)', color: likedDeals[video.id] ? '#FFB800' : 'rgba(255,255,255,0.8)', fontWeight: 700 }}>
                      {likeCounts[video.id] || 0}
                    </span>
                  </button>

                  {/* Comment */}
                  <button onClick={(e) => openComments(e, video.id)} style={{
                    background: 'none', border: 'none', cursor: 'pointer',
                    display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2,
                    padding: 0,
                  }}>
                    <div style={{
                      width: 46, height: 46, borderRadius: '50%',
                      background: 'rgba(0,0,0,0.4)', backdropFilter: 'blur(8px)',
                      border: '1px solid rgba(255,255,255,0.15)',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                    }}>
                      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#4ade80" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
                      </svg>
                    </div>
                    <span style={{ fontSize: 11, fontFamily: 'var(--font-display)', color: 'rgba(255,255,255,0.8)', fontWeight: 700 }}>
                      {commentCounts[video.id] || 0}
                    </span>
                  </button>

                  {/* Repost */}
                  <button onClick={(e) => handleRepost(e, video.id)} style={{
                    background: 'none', border: 'none', cursor: 'pointer',
                    display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2,
                    padding: 0,
                  }}>
                    <div style={{
                      width: 46, height: 46, borderRadius: '50%',
                      background: 'rgba(0,0,0,0.4)', backdropFilter: 'blur(8px)',
                      border: '1px solid rgba(255,255,255,0.15)',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                    }}>
                      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#a78bfa" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M17 1l4 4-4 4" />
                        <path d="M3 11V9a4 4 0 0 1 4-4h14" />
                        <path d="M7 23l-4-4 4-4" />
                        <path d="M21 13v2a4 4 0 0 1-4 4H3" />
                      </svg>
                    </div>
                    <span style={{ fontSize: 11, fontFamily: 'var(--font-display)', color: 'rgba(255,255,255,0.8)', fontWeight: 700 }}>
                      {repostCounts[video.id] || 0}
                    </span>
                  </button>

                  {/* Share */}
                  <button onClick={(e) => handleShare(e, video.id, video.title)} style={{
                    background: 'none', border: 'none', cursor: 'pointer',
                    display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2,
                    padding: 0,
                  }}>
                    <div style={{
                      width: 46, height: 46, borderRadius: '50%',
                      background: 'rgba(0,0,0,0.4)', backdropFilter: 'blur(8px)',
                      border: '1px solid rgba(255,255,255,0.15)',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                    }}>
                      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#60a5fa" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                        <line x1="22" y1="2" x2="11" y2="13" />
                        <polygon points="22 2 15 22 11 13 2 9 22 2" />
                      </svg>
                    </div>
                  </button>

                  {/* Creator avatar (tap to go to profile) */}
                  {video.creator && (
                    <button onClick={(e) => { e.stopPropagation(); router.push(`/app/profile/${video.creator!.username}`) }} style={{
                      background: 'none', border: 'none', cursor: 'pointer', padding: 0,
                    }}>
                      <div style={{
                        width: 46, height: 46, borderRadius: '50%',
                        border: '2px solid #FFB800',
                        overflow: 'hidden',
                      }}>
                        <ProfileImage
                          size={42}
                          avatarUrl={video.creator.avatar_url}
                          name={video.creator.display_name || video.creator.username}
                        />
                      </div>
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>

          {/* ═══ PROGRESS DOTS ═══ */}
          {videos.length > 1 && videos.length <= 20 && (
            <div style={{
              position: 'absolute', right: 6, top: '50%', transform: 'translateY(-50%)',
              zIndex: 210, display: 'flex', flexDirection: 'column', gap: 4,
            }}>
              {videos.map((_, idx) => (
                <div key={idx} style={{
                  width: idx === currentIndex ? 4 : 3,
                  height: idx === currentIndex ? 12 : 6,
                  borderRadius: 2,
                  background: idx === currentIndex ? '#FFB800' : 'rgba(255,255,255,0.3)',
                  transition: 'all 0.25s',
                }} />
              ))}
            </div>
          )}

          {/* ═══ COUNTER ═══ */}
          <div style={{
            position: 'absolute', bottom: 8, left: '50%', transform: 'translateX(-50%)',
            zIndex: 210,
          }}>
            <span style={{
              fontFamily: 'var(--font-display)', fontSize: 10, fontWeight: 700,
              color: 'rgba(255,255,255,0.4)', letterSpacing: 1,
            }}>
              {currentIndex + 1} / {videos.length}
            </span>
          </div>
        </>
      )}

      {/* Comment Sheet */}
      {commentDealId && (
        <CommentSheet
          dealId={commentDealId}
          open={commentOpen}
          onClose={() => {
            setCommentOpen(false)
            setCommentDealId(null)
            // Resume video
            const vid = videoRefs.current[currentIndex]
            if (vid) vid.play().catch(() => {})
          }}
          onCountChange={(count) => {
            setCommentCounts(prev => ({ ...prev, [commentDealId]: count }))
          }}
        />
      )}
    </div>
  )
}
