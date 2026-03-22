'use client'
import React, { useState, useEffect, useRef, useCallback } from 'react'
import dynamic from 'next/dynamic'
import { useAuth } from '@/contexts/AuthContext'
import { supabase } from '@/lib/supabase'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import ProfileImage from '@/components/ProfileImage'
import TipGroupInteractionBar from '@/components/tippen/TipGroupInteractionBar'
import TipGroupBetWidget from '@/components/TipGroupBetWidget'
import MiniEventCard, { aggregateFeedEvents } from '@/components/MiniEventCard'
import type { FeedEvent, FeedEventItem } from '@/components/MiniEventCard'
import FeedDealCard from '@/components/feed/FeedDealCard'
import type { StoryGroup } from '@/components/StoryViewer'
import { trackScreenView } from '@/lib/analytics'
import { useLang } from '@/contexts/LanguageContext'

// Heavy components loaded on demand (not needed on first render)
const StoryViewer = dynamic(() => import('@/components/StoryViewer'), { ssr: false })
const CommentSheet = dynamic(() => import('@/components/CommentSheet'), { ssr: false })

/* ─── Helpers ─── */
function timeAgoWithT(dateStr: string, t: (key: string) => string) {
  const diff = Date.now() - new Date(dateStr).getTime()
  const m = Math.floor(diff / 60000)
  if (m < 1) return t('components.timeJustNow')
  if (m < 60) return t('components.timeMinutes').replace('{n}', String(m))
  const h = Math.floor(m / 60)
  if (h < 24) return t('components.timeHours').replace('{n}', String(h))
  const d = Math.floor(h / 24)
  return d === 1 ? t('components.timeDaySingular').replace('{n}', String(d)) : t('components.timeDays').replace('{n}', String(d))
}

/* ─── Skeleton placeholder ─── */
const SkeletonCard = () => (
  <div style={{ background: 'var(--bg-surface)', borderRadius: 16, padding: 16, marginBottom: 12, border: '1px solid var(--border-subtle)' }}>
    <div style={{ display: 'flex', gap: 12, marginBottom: 16 }}>
      <div style={{ width: 44, height: 44, borderRadius: '50%', background: 'var(--bg-surface)' }} />
      <div style={{ flex: 1 }}>
        <div style={{ height: 12, width: '60%', background: 'var(--bg-surface)', borderRadius: 6, marginBottom: 8 }} />
        <div style={{ height: 10, width: '40%', background: 'var(--bg-overlay)', borderRadius: 6 }} />
      </div>
    </div>
    <div style={{ height: 180, background: 'var(--bg-overlay)', borderRadius: 12 }} />
  </div>
)

const SkeletonStory = () => (
  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, flexShrink: 0 }}>
    <div style={{ width: 60, height: 60, borderRadius: '50%', background: 'var(--bg-surface)' }} />
    <div style={{ width: 40, height: 8, background: 'var(--bg-overlay)', borderRadius: 4 }} />
  </div>
)

/* ─── Deal select fields (for Supabase queries) ─── */
const DEAL_SELECT = '*, creator:creator_id(id,username,display_name,level,streak,active_frame,is_founder,avatar_url,equipped_card_image_url), opponent:opponent_id(id,username,display_name,level,streak,active_frame,is_founder,avatar_url,equipped_card_image_url)'

export default function HomePage() {
  const { profile } = useAuth()
  const router = useRouter()
  const { t } = useLang()
  const timeAgo = (dateStr: string) => timeAgoWithT(dateStr, t)

  // Feed state (single unified feed — no tabs)
  const [deals, setDeals] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [skeletonTimeout, setSkeletonTimeout] = useState(false)
  const [loadingMore, setLoadingMore] = useState(false)
  const [hasMore, setHasMore] = useState(true)
  const [cursor, setCursor] = useState<string | null>(null)

  // Stories state
  const [storyGroups, setStoryGroups] = useState<StoryGroup[]>([])
  const [viewedDealIds, setViewedDealIds] = useState<Set<string>>(new Set())
  const [storyViewerOpen, setStoryViewerOpen] = useState(false)
  const [storyViewerIndex, setStoryViewerIndex] = useState(0)
  const [storiesLoading, setStoriesLoading] = useState(true)

  // Kept features
  const [dailyAvailable, setDailyAvailable] = useState(false)
  const [spotlight, setSpotlight] = useState<any>(null)
  const [pendingInvites, setPendingInvites] = useState<any[]>([])

  // Comment sheet state
  const [commentDealId, setCommentDealId] = useState<string | null>(null)
  const [commentSheetOpen, setCommentSheetOpen] = useState(false)

  const [feedEvents, setFeedEvents] = useState<any[]>([])
  const [publicTipGroups, setPublicTipGroups] = useState<any[]>([])
  const [feedMedia, setFeedMedia] = useState<Record<string, { deal_id: string; user_id: string; media_url: string; media_type: string }[]>>({})
  const [fullMediaView, setFullMediaView] = useState<{ url: string; type: string } | null>(null)
  const [hiddenFeedIds, setHiddenFeedIds] = useState<Set<string>>(new Set())
  const [menuOpenId, setMenuOpenId] = useState<string | null>(null)

  // Fight Night collapsible cards + community quotes
  const [expandedDeals, setExpandedDeals] = useState<Set<string>>(new Set())
  const [betQuotes, setBetQuotes] = useState<Record<string, { a: number; b: number }>>({})
  const toggleDealExpand = (id: string) => {
    setExpandedDeals(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id); else next.add(id)
      return next
    })
  }

  // Auto-collapse deals when scrolled out of viewport
  const expandedDealsRef = useRef(expandedDeals)
  expandedDealsRef.current = expandedDeals
  useEffect(() => {
    const observer = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (!entry.isIntersecting) {
          const dealId = (entry.target as HTMLElement).dataset.dealCard
          if (dealId && expandedDealsRef.current.has(dealId)) {
            setExpandedDeals(prev => {
              const next = new Set(prev)
              next.delete(dealId)
              return next
            })
          }
        }
      })
    }, { threshold: 0, rootMargin: '-50px 0px' })
    const cards = document.querySelectorAll('[data-deal-card]')
    cards.forEach(el => observer.observe(el))
    return () => observer.disconnect()
  }, [deals, publicTipGroups])

  // Pull-to-refresh
  const [pullDistance, setPullDistance] = useState(0)
  const [refreshing, setRefreshing] = useState(false)
  const touchStartY = useRef(0)
  const scrollRef = useRef<HTMLDivElement>(null)

  // Infinite scroll sentinel
  const sentinelRef = useRef<HTMLDivElement>(null)

  // Follow IDs + Favorite IDs cache
  const [followIds, setFollowIds] = useState<string[]>([])
  const [favoriteIds, setFavoriteIds] = useState<Set<string>>(new Set())

  // Single filter bar: DEALS | CHALLENGES | TIPPRUNDEN | AKTIVITAT
  const [feedTab, setFeedTab] = useState<'alle' | 'herausforderungen' | 'tipprunden' | 'live_tipp'>('alle')
  const [myBets, setMyBets] = useState<any[]>([])
  const [interactionDealIds, setInteractionDealIds] = useState<Set<string>>(new Set())
  // Legacy compat — DEALS/CHALLENGES/INTERAKTIONEN = only deals, TIPPRUNDEN = only tip groups
  const contentTab = feedTab === 'tipprunden' ? 'tipprunden' : 'deals'
  const feedFilter = contentTab

  /* ─── Initial Load ─── */
  useEffect(() => { trackScreenView('home') }, [])

  useEffect(() => {
    if (!profile) return
    const init = async () => {
      // Phase 1: Load follows first (needed by stories + feed scoring)
      const followData = await loadFollowIds()
      // Phase 2: Everything else in parallel
      await Promise.all([
        loadStories(followData),
        loadFeed(true),
        loadExtras(),
        loadFeedEvents(),
        loadPublicTipGroups(),
        loadInteractions(),
      ])
    }
    init()
    // Register service worker with auto-update
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('/sw.js', { updateViaCache: 'none' })
        .then((reg) => {
          // Check for updates every 5 min (60s was too aggressive)
          setInterval(() => reg.update().catch(() => {}), 300000)
        })
        .catch(() => {})

      // Listen for SW update message → reload page
      navigator.serviceWorker.addEventListener('message', (event) => {
        if (event.data?.type === 'SW_UPDATED') {
          window.location.reload()
        }
      })
    }
  }, [profile])

  // Skeleton timeout: show empty state after 3s of loading (was 5s – too slow)
  useEffect(() => {
    if (!loading) { setSkeletonTimeout(false); return }
    const timer = setTimeout(() => setSkeletonTimeout(true), 3000)
    return () => clearTimeout(timer)
  }, [loading])

  /* ─── Data Loading ─── */
  const loadFollowIds = async () => {
    if (!profile) return { ids: [] as string[], favs: new Set<string>() }
    const { data } = await supabase
      .from('follows')
      .select('following_id, is_favorite')
      .eq('follower_id', profile.id)
      .eq('status', 'accepted')
    const ids = data?.map(f => f.following_id) || []
    const favs = new Set<string>()
    for (const f of (data || [])) {
      if (f.is_favorite) favs.add(f.following_id)
    }
    setFollowIds(ids)
    setFavoriteIds(favs)
    return { ids, favs }
  }

  const loadStories = async (followResult?: { ids: string[]; favs: Set<string> }) => {
    if (!profile) return
    setStoriesLoading(true)
    try {
      // Reuse follow data from loadFollowIds (no duplicate query!)
      const fIds = followResult?.ids || followIds
      const fIdSet = new Set(fIds)
      const favSet = followResult?.favs || favoriteIds

      const since24h = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
      const storySelect = 'id, title, stake, status, category, created_at, deadline, media_url, media_type, is_public, shared_as_story_at, winner_id, creator_id, opponent_id, creator:creator_id(id,username,display_name,avatar_url,level,streak,active_frame,is_founder,equipped_card_image_url), opponent:opponent_id(id,username,display_name,avatar_url,level,streak,active_frame,is_founder,equipped_card_image_url)'

      // ── BATCH 1: All independent queries in parallel ──
      const userFilter = fIds.length > 0 ? `creator_id.in.(${fIds.join(',')}),opponent_id.in.(${fIds.join(',')})` : ''

      const batch1: any[] = [
        /* 0 */ supabase.from('deal_media').select('deal_id').eq('user_id', profile.id).gte('created_at', since24h),
        /* 1 */ supabase.from('bets').select(storySelect).not('shared_as_story_at', 'is', null).gte('shared_as_story_at', since24h).or(`creator_id.eq.${profile.id},opponent_id.eq.${profile.id}`).order('shared_as_story_at', { ascending: false }).limit(20),
        /* 2 */ supabase.from('story_views').select('deal_id').eq('user_id', profile.id).gte('viewed_at', since24h),
        /* 3 */ supabase.from('feed_events').select('*, user:user_id(id, username, display_name, avatar_url)').eq('event_type', 'tip_group_story').gte('created_at', since24h).order('created_at', { ascending: false }).limit(20),
      ]
      // Only add followed-user queries if we have follows
      if (fIds.length > 0) {
        batch1.push(
          /* 4 */ supabase.from('bets').select(storySelect).gte('created_at', since24h).in('status', ['open', 'pending', 'active', 'pending_confirmation', 'completed']).or(userFilter).order('created_at', { ascending: false }).limit(50),
          /* 5 */ supabase.from('bets').select(storySelect).gte('shared_as_story_at', since24h).eq('status', 'completed').or(userFilter).order('shared_as_story_at', { ascending: false }).limit(50),
          /* 6 */ supabase.from('feed_events').select('deal_id').eq('event_type', 'deal_media_added').gte('created_at', since24h).in('user_id', fIds),
        )
      }

      const results = await Promise.all(batch1)
      const myMediaEntries = results[0].data || []
      const myStories = results[1].data || []
      const viewedData = results[2].data || []
      const tipStoryEvents = results[3].data || []
      const newDeals = results[4]?.data || []
      const winStories = results[5]?.data || []
      const mediaEvents = results[6]?.data || []

      const vIds = new Set<string>(viewedData.map((v: any) => v.deal_id))
      setViewedDealIds(vIds)

      // ── BATCH 2: Queries that depend on Batch 1 results ──
      const myMediaDealIds = [...new Set(myMediaEntries.map((e: any) => e.deal_id))]
      const mediaDealIds = [...new Set(mediaEvents.map((e: any) => e.deal_id).filter(Boolean))]
      const tipGroupIds = [...new Set(tipStoryEvents.map((e: any) => e.metadata?.group_id).filter(Boolean))]

      const batch2: any[] = []
      const batch2Keys: string[] = []

      if (myMediaDealIds.length > 0) {
        batch2.push(supabase.from('bets').select(storySelect).in('id', myMediaDealIds))
        batch2Keys.push('myMediaDeals')
      }
      if (mediaDealIds.length > 0) {
        batch2.push(supabase.from('bets').select(storySelect).in('id', mediaDealIds))
        batch2Keys.push('mediaDeals')
      }
      if (tipGroupIds.length > 0) {
        batch2.push(
          supabase.from('tip_groups').select('id, name, league, invite_code').in('id', tipGroupIds),
          supabase.from('tip_group_members').select('group_id').in('group_id', tipGroupIds),
        )
        batch2Keys.push('tipGroups', 'tipMembers')
      }

      const results2 = batch2.length > 0 ? await Promise.all(batch2) : []
      const r2: Record<string, any[]> = {}
      batch2Keys.forEach((key, i) => { r2[key] = results2[i]?.data || [] })

      const myMediaDeals = r2['myMediaDeals'] || []
      const mediaDeals = r2['mediaDeals'] || []

      // Handle no-follows case (show own stories only)
      if (fIds.length === 0) {
        const myMerged = new Map<string, any>()
        for (const d of myMediaDeals) myMerged.set(d.id, d)
        for (const d of myStories) myMerged.set(d.id, d)
        const myDealsArr = Array.from(myMerged.values())

        if (myDealsArr.length > 0) {
          const myDealIds = myDealsArr.map((d: any) => d.id)
          const { data: dmData } = await supabase
            .from('deal_media').select('deal_id, user_id, media_url, media_type')
            .in('deal_id', myDealIds).order('created_at', { ascending: false })
          for (const d of myDealsArr) {
            d._deal_media = (dmData || []).filter((m: any) => m.deal_id === d.id)
            if (!d.media_url && d._deal_media.length > 0) {
              d.media_url = d._deal_media[0].media_url
              d.media_type = d._deal_media[0].media_type
            }
          }
          setStoryGroups([{
            userId: profile.id, username: profile.username || '?',
            displayName: profile.display_name || profile.username || '?',
            avatarUrl: profile.avatar_url,
            deals: myDealsArr.map((d: any) => ({
              id: d.id, title: d.title, stake: d.stake, status: d.status,
              category: d.category, created_at: d.created_at,
              media_url: d.media_url, media_type: d.media_type, is_public: d.is_public,
              shared_as_story_at: d.shared_as_story_at, winner_id: d.winner_id,
              creator_id: d.creator_id, opponent_id: d.opponent_id,
              deal_media: d._deal_media || [], creator: d.creator, opponent: d.opponent,
            })),
          }])
        } else {
          setStoryGroups([])
        }
        setStoriesLoading(false)
        return
      }

      // Merge & deduplicate all deal sources
      const mergedMap = new Map<string, any>()
      for (const d of newDeals) mergedMap.set(d.id, d)
      for (const d of winStories) mergedMap.set(d.id, d)
      for (const d of mediaDeals) mergedMap.set(d.id, d)
      for (const d of myMediaDeals) mergedMap.set(d.id, d)
      for (const d of myStories) mergedMap.set(d.id, d)
      const storyDeals = Array.from(mergedMap.values())

      // Fetch deal_media for all story deals
      const storyDealIds = storyDeals.map((d: any) => d.id)
      if (storyDealIds.length > 0) {
        const { data: dealMediaData } = await supabase
          .from('deal_media').select('deal_id, user_id, media_url, media_type')
          .in('deal_id', storyDealIds).order('created_at', { ascending: false })
        const dealMediaMap = new Map<string, any>()
        for (const m of (dealMediaData || [])) {
          if (!dealMediaMap.has(m.deal_id)) dealMediaMap.set(m.deal_id, m)
        }
        for (const d of storyDeals) {
          d._deal_media = (dealMediaData || []).filter((m: any) => m.deal_id === d.id)
          if (!d.media_url && dealMediaMap.has(d.id)) {
            const m = dealMediaMap.get(d.id)
            d.media_url = m.media_url
            d.media_type = m.media_type
          }
        }
      }

      // Build tip group metadata
      let tipGroupMeta: Record<string, { name: string; league?: string; invite_code?: string; member_count: number }> = {}
      if (tipGroupIds.length > 0) {
        const tgData = r2['tipGroups'] || []
        const memberCounts = r2['tipMembers'] || []
        const countMap: Record<string, number> = {}
        for (const m of memberCounts) { countMap[m.group_id] = (countMap[m.group_id] || 0) + 1 }
        for (const tg of tgData) {
          tipGroupMeta[tg.id] = { name: tg.name, league: tg.league, invite_code: tg.invite_code, member_count: countMap[tg.id] || 0 }
        }
      }

      // Group by user
      const groupMap = new Map<string, StoryGroup>()
      const buildDealEntry = (d: any) => ({
        id: d.id, title: d.title, stake: d.stake, status: d.status,
        category: d.category, created_at: d.created_at,
        media_url: d.media_url, media_type: (d as any).media_type,
        is_public: (d as any).is_public, shared_as_story_at: (d as any).shared_as_story_at,
        winner_id: (d as any).winner_id, creator_id: d.creator_id, opponent_id: d.opponent_id,
        deal_media: d._deal_media || [], creator: d.creator as any, opponent: d.opponent as any,
      })

      for (const d of storyDeals) {
        const isMyDeal = d.creator_id === profile.id || d.opponent_id === profile.id

        // Private deals: only show as story for the two participants
        if (d.is_public === false && !isMyDeal) continue

        // Attribute story to BOTH creator AND opponent (not just creator)
        const users = [
          { id: d.creator_id, data: d.creator },
          { id: d.opponent_id, data: d.opponent },
        ].filter(u => u.id && u.id !== profile.id && u.data && fIdSet.has(u.id))
        for (const u of users) {
          if (!groupMap.has(u.id)) {
            groupMap.set(u.id, {
              userId: u.id, username: (u.data as any)?.username || '?',
              displayName: (u.data as any)?.display_name || (u.data as any)?.username || '?',
              avatarUrl: (u.data as any)?.avatar_url, deals: [],
            })
          }
          const existing = groupMap.get(u.id)!
          if (!existing.deals.find(ed => ed.id === d.id)) existing.deals.push(buildDealEntry(d))
        }
        const hasMyMedia = (d._deal_media || []).some((m: any) => m.user_id === profile.id)
        const isMyStory = d.shared_as_story_at && isMyDeal
        if (isMyDeal && (hasMyMedia || isMyStory)) {
          if (!groupMap.has(profile.id)) {
            groupMap.set(profile.id, {
              userId: profile.id, username: profile.username || '?',
              displayName: profile.display_name || profile.username || '?',
              avatarUrl: profile.avatar_url, deals: [],
            })
          }
          const myGroup = groupMap.get(profile.id)!
          if (!myGroup.deals.find(ed => ed.id === d.id)) myGroup.deals.push(buildDealEntry(d))
        }
      }

      // Add tip group stories
      for (const ev of tipStoryEvents) {
        const userId = ev.user_id
        const gId = ev.metadata?.group_id
        if (!gId || !ev.user) continue
        const meta = tipGroupMeta[gId]
        if (!groupMap.has(userId)) {
          groupMap.set(userId, {
            userId, username: ev.user.username || '?',
            displayName: ev.user.display_name || ev.user.username || '?',
            avatarUrl: ev.user.avatar_url, deals: [],
          })
        }
        const storyGroup = groupMap.get(userId)!
        if (!storyGroup.deals.find(d => d.id === ev.id)) {
          storyGroup.deals.push({
            id: ev.id, title: meta?.name || ev.metadata?.group_name || 'Tippgruppe',
            stake: '', status: 'active', created_at: ev.created_at,
            storyType: 'tip_group',
            tipGroup: {
              group_id: gId, group_name: meta?.name || ev.metadata?.group_name || 'Tippgruppe',
              invite_code: meta?.invite_code || ev.metadata?.invite_code,
              league: meta?.league, member_count: meta?.member_count,
            },
            creator: null, opponent: null,
          })
        }
      }

      // Sort: own story first → favorites → unviewed → viewed → by recency
      const groups = Array.from(groupMap.values())
      groups.sort((a, b) => {
        if (a.userId === profile.id) return -1
        if (b.userId === profile.id) return 1
        const aFav = favSet.has(a.userId)
        const bFav = favSet.has(b.userId)
        if (aFav && !bFav) return -1
        if (!aFav && bFav) return 1
        const aHasUnviewed = a.deals.some(d => !vIds.has(d.id))
        const bHasUnviewed = b.deals.some(d => !vIds.has(d.id))
        if (aHasUnviewed && !bHasUnviewed) return -1
        if (!aHasUnviewed && bHasUnviewed) return 1
        return new Date(b.deals[0]?.created_at || 0).getTime() - new Date(a.deals[0]?.created_at || 0).getTime()
      })

      setStoryGroups(groups)
    } catch (_e) {
      // stories load error
    }
    setStoriesLoading(false)
  }

  const loadFeed = async (initial = false) => {
    if (!profile) return
    if (initial) {
      setLoading(true)
      setCursor(null)
      setHasMore(true)
      setDeals([])
    } else {
      setLoadingMore(true)
    }

    try {
      let query = supabase
        .from('bets')
        .select(DEAL_SELECT)
        .in('status', ['open', 'pending', 'active', 'pending_confirmation', 'completed'])
        .order('created_at', { ascending: false })
        .limit(20)

      if (!initial && cursor) {
        query = query.lt('created_at', cursor)
      }

      const { data, error } = await query
      if (error) { setLoading(false); setLoadingMore(false); return }

      let newDeals = data || []

      // Fallback: if 0 results, get ALL deals regardless
      if (initial && newDeals.length === 0) {
        const { data: fallback } = await supabase
          .from('bets')
          .select(DEAL_SELECT)
          .order('created_at', { ascending: false })
          .limit(20)
        newDeals = fallback || []
      }

      // Score deals for unified feed — completed/cancelled/disputed always sink to bottom
      if (initial && newDeals.length > 0) {
        const doneStatuses = new Set(['completed', 'cancelled', 'disputed'])
        newDeals.sort((a: any, b: any) => {
          const aDone = doneStatuses.has(a.status) ? 1 : 0
          const bDone = doneStatuses.has(b.status) ? 1 : 0
          if (aDone !== bDone) return aDone - bDone
          const score = (deal: any) => {
            const ageHours = (Date.now() - new Date(deal.created_at).getTime()) / 3600000
            const recency = Math.max(0, 1 - ageHours / 168) * 0.4
            const isFav = favoriteIds.has(deal.creator_id) || favoriteIds.has(deal.opponent_id) ? 2.0 : 0
            const isFollowed = followIds.includes(deal.creator_id) || followIds.includes(deal.opponent_id) ? 1.0 : 0
            const hasMedia = deal.media_url ? 0.1 : 0
            return isFav + isFollowed + recency + hasMedia
          }
          return score(b) - score(a)
        })
      }

      if (initial) {
        // Separate pending invites
        const invites = newDeals.filter((d: any) =>
          d.status === 'pending' && d.opponent_id === profile.id && d.creator_id !== profile.id
        )
        setPendingInvites(invites)
        setDeals(newDeals.filter((d: any) => !(d.status === 'pending' && d.opponent_id === profile.id && d.creator_id !== profile.id)))
      } else {
        setDeals(prev => [...prev, ...newDeals])
      }

      if (newDeals.length < 20) setHasMore(false)
      if (newDeals.length > 0) {
        setCursor(newDeals[newDeals.length - 1].created_at)
      }

      // Fetch deal_media for feed cards + merge into deals without media_url
      const dealIds = newDeals.map((d: any) => d.id)
      if (dealIds.length > 0) {
        const { data: dmData } = await supabase
          .from('deal_media')
          .select('deal_id, user_id, media_url, media_type')
          .in('deal_id', dealIds)
          .order('created_at', { ascending: false })
        if (dmData && dmData.length > 0) {
          const grouped: Record<string, typeof dmData> = {}
          for (const m of dmData) {
            if (!grouped[m.deal_id]) grouped[m.deal_id] = []
            grouped[m.deal_id].push(m)
          }
          setFeedMedia(prev => ({ ...prev, ...grouped }))
          // Merge first media into deals that have no media_url (e.g. München deal)
          for (const d of newDeals) {
            if (!d.media_url && grouped[d.id] && grouped[d.id].length > 0) {
              d.media_url = grouped[d.id][0].media_url
              d.media_type = grouped[d.id][0].media_type
            }
          }
        }
      }

      // Batch-fetch community bet quotes for all deals
      if (dealIds.length > 0) {
        const { data: betData } = await supabase
          .from('deal_side_bets')
          .select('deal_id, side')
          .in('deal_id', dealIds)
        if (betData && betData.length > 0) {
          const quotes: Record<string, { a: number; b: number }> = {}
          for (const b of betData) {
            if (!quotes[b.deal_id]) quotes[b.deal_id] = { a: 0, b: 0 }
            quotes[b.deal_id][b.side as 'a' | 'b']++
          }
          setBetQuotes(prev => ({ ...prev, ...quotes }))
        }
      }
    } catch (_e) {
      // feed load error
    }
    setLoading(false)
    setLoadingMore(false)
  }

  const loadExtras = async () => {
    if (!profile) return
    const today = new Date().toISOString().slice(0, 10)
    const { data: dailyData } = await supabase
      .from('user_daily_login')
      .select('last_login_date')
      .eq('user_id', profile.id)
      .single()
    setDailyAvailable(!dailyData?.last_login_date || dailyData.last_login_date < today)

    const { data: spotData } = await supabase
      .from('weekly_spotlight')
      .select('*, bets!weekly_spotlight_deal_id_fkey(id, title, creator:creator_id(username))')
      .eq('is_active', true)
      .gte('expires_at', new Date().toISOString())
      .order('featured_at', { ascending: false })
      .limit(1)
    setSpotlight(spotData?.[0] || null)

    // Login streak now shown in top bar (layout.tsx) — no fetch needed here
  }

  const loadFeedEvents = async () => {
    if (!profile) return
    const since24h = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
    const since7d = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()
    // Load regular feed events (24h) + tip_group_story events (7 days, wider window)
    const [regularRes, tipStoryRes] = await Promise.all([
      supabase
        .from('feed_events')
        .select('*, user:user_id(username, display_name, avatar_url)')
        .neq('event_type', 'tip_group_story')
        .gte('created_at', since24h)
        .order('created_at', { ascending: false })
        .limit(30),
      supabase
        .from('feed_events')
        .select('*, user:user_id(username, display_name, avatar_url)')
        .eq('event_type', 'tip_group_story')
        .gte('created_at', since7d)
        .order('created_at', { ascending: false })
        .limit(10),
    ])
    const merged = [...(tipStoryRes.data || []), ...(regularRes.data || [])]
    setFeedEvents(merged)
  }

  const loadPublicTipGroups = async () => {
    if (!profile) return
    const { data } = await supabase
      .from('tip_groups')
      .select('id, name, league, category, stake, invite_code, created_by, created_at, creator:created_by(username, display_name, avatar_url)')
      .eq('is_public', true)
      .eq('status', 'active')
      .order('created_at', { ascending: false })
      .limit(10)
    // Get member counts
    const ids = (data || []).map(g => g.id)
    let memberCounts: Record<string, number> = {}
    if (ids.length > 0) {
      const { data: mc } = await supabase
        .from('tip_group_members')
        .select('group_id')
        .in('group_id', ids)
      for (const m of (mc || [])) {
        memberCounts[m.group_id] = (memberCounts[m.group_id] || 0) + 1
      }
    }
    setPublicTipGroups((data || []).map(g => ({ ...g, member_count: memberCounts[g.id] || 0 })))
  }

  const loadInteractions = async () => {
    if (!profile) return
    const ids = new Set<string>()
    // 1. Own deals (creator or opponent)
    const { data: ownDeals } = await supabase.from('bets')
      .select('id')
      .or(`creator_id.eq.${profile.id},opponent_id.eq.${profile.id}`)
    if (ownDeals) ownDeals.forEach((d: any) => ids.add(d.id))
    // 2. Liked deals
    const { data: liked } = await supabase.from('deal_likes')
      .select('deal_id')
      .eq('user_id', profile.id)
    if (liked) liked.forEach((d: any) => ids.add(d.deal_id))
    // 3. Commented deals
    const { data: commented } = await supabase.from('deal_comments')
      .select('deal_id')
      .eq('user_id', profile.id)
    if (commented) commented.forEach((d: any) => ids.add(d.deal_id))
    // 4. Reposted deals
    const { data: reposted } = await supabase.from('deal_reposts')
      .select('original_deal_id')
      .eq('user_id', profile.id)
    if (reposted) reposted.forEach((d: any) => ids.add(d.original_deal_id))
    // 5. Side-betted deals
    const { data: sideBets } = await supabase.from('deal_side_bets')
      .select('deal_id, side, status, coins_awarded, created_at')
      .eq('user_id', profile.id)
      .order('created_at', { ascending: false })
    if (sideBets) {
      sideBets.forEach((d: any) => ids.add(d.deal_id))
      // Merge with deal info for Live Tipp tab
      const betDealIds = sideBets.map((b: any) => b.deal_id)
      if (betDealIds.length > 0) {
        const { data: betDeals } = await supabase.from('bets')
          .select('id, title, status, stake, creator_id, opponent_id, confirmed_winner_id, winner_id, creator:creator_id(username, display_name, avatar_url), opponent:opponent_id(username, display_name, avatar_url)')
          .in('id', betDealIds)
        const dealMap: Record<string, any> = {}
        if (betDeals) betDeals.forEach((d: any) => { dealMap[d.id] = d })
        setMyBets(sideBets.map((b: any) => ({ ...b, deal: dealMap[b.deal_id] || null })).filter((b: any) => b.deal))
      }
    }
    setInteractionDealIds(ids)
  }

  /* ─── Infinite Scroll ─── */
  useEffect(() => {
    if (!sentinelRef.current || !hasMore || loading) return
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && !loadingMore && hasMore) {
          loadFeed(false)
        }
      },
      { rootMargin: '200px' }
    )
    observer.observe(sentinelRef.current)
    return () => observer.disconnect()
  }, [hasMore, loadingMore, cursor, loading])

  /* ─── Pull to Refresh ─── */
  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartY.current = e.touches[0].clientY
  }

  const handleTouchMove = (e: React.TouchEvent) => {
    const scrollEl = scrollRef.current?.parentElement
    if (!scrollEl || scrollEl.scrollTop > 5) return
    const dy = e.touches[0].clientY - touchStartY.current
    if (dy > 0 && !refreshing) {
      setPullDistance(Math.min(dy * 0.4, 100))
    }
  }

  const handleTouchEnd = async () => {
    if (pullDistance > 50 && !refreshing) {
      setRefreshing(true)
      setPullDistance(60)
      const fd = await loadFollowIds()
      await Promise.all([loadStories(fd), loadFeed(true), loadExtras()])
      setRefreshing(false)
    }
    setPullDistance(0)
  }

  /* ─── Story View Tracking ─── */
  const handleStoryViewed = useCallback(async (dealId: string) => {
    if (!profile) return
    setViewedDealIds(prev => new Set(prev).add(dealId))
    try {
      await supabase.from('story_views').upsert(
        { user_id: profile.id, deal_id: dealId, viewed_at: new Date().toISOString() },
        { onConflict: 'user_id,deal_id' }
      )
    } catch {}
  }, [profile])

  const openStory = (index: number) => {
    setStoryViewerIndex(index)
    setStoryViewerOpen(true)
  }

  /* ─── Render ─── */
  return (
    <div
      ref={scrollRef}
      style={{ minHeight: '100dvh', background: 'var(--bg-deepest)' }}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
    >

      {/* ── Pull-to-Refresh indicator ── */}
      {(pullDistance > 0 || refreshing) && (
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          height: pullDistance > 0 ? pullDistance : 50, overflow: 'hidden',
          transition: pullDistance === 0 ? 'height 0.3s' : 'none',
        }}>
          <div style={{
            width: 24, height: 24,
            border: '2px solid transparent', borderTopColor: 'var(--gold-primary)', borderRadius: '50%',
            animation: refreshing ? 'spin 0.8s linear infinite' : 'none',
            opacity: pullDistance > 30 || refreshing ? 1 : pullDistance / 30,
            transform: `rotate(${pullDistance * 3}deg)`,
          }} />
        </div>
      )}

      {/* ── Stories Bar (followed users only, clean circles) ── */}
      <div style={{
        overflowX: 'auto', display: 'flex', gap: 14, padding: '12px 16px',
        borderBottom: '1px solid var(--border-subtle)',
        WebkitOverflowScrolling: 'touch',
        scrollbarWidth: 'none',
      }}>
        {/* My Story — always show avatar like Instagram */}
        {(() => {
          const myStoryIdx = storyGroups.findIndex(g => g.userId === profile?.id)
          const hasMyStory = myStoryIdx >= 0
          return (
            <div
              onClick={() => hasMyStory ? openStory(myStoryIdx) : router.push('/app/deals/create')}
              style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, cursor: 'pointer', flexShrink: 0 }}
            >
              <div style={{ position: 'relative' }}>
                <div style={{
                  width: 66, height: 66, borderRadius: '50%',
                  background: hasMyStory
                    ? 'linear-gradient(135deg, #FFB800, #FF8C00, #FFB800)'
                    : 'transparent',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  padding: hasMyStory ? 3 : 0,
                }}>
                  <div style={{
                    width: hasMyStory ? 60 : 64, height: hasMyStory ? 60 : 64,
                    borderRadius: '50%',
                    border: hasMyStory ? '2px solid var(--bg-deepest)' : '2px solid rgba(255,255,255,0.15)',
                    overflow: 'hidden',
                  }}>
                    <ProfileImage
                      size={hasMyStory ? 56 : 60}
                      avatarUrl={profile?.avatar_url}
                      name={profile?.display_name || profile?.username}
                    />
                  </div>
                </div>
                {/* + icon when no stories (like Instagram) */}
                {!hasMyStory && (
                  <div style={{
                    position: 'absolute', bottom: 0, right: 0,
                    width: 20, height: 20, borderRadius: '50%',
                    background: 'var(--gold-primary)', border: '2px solid var(--bg-deepest)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}>
                    <span style={{ fontSize: 13, fontWeight: 700, color: '#000', lineHeight: 1 }}>+</span>
                  </div>
                )}
              </div>
              <p style={{
                fontFamily: 'var(--font-display)', fontSize: 8,
                color: 'var(--text-primary)',
                maxWidth: 64, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                textAlign: 'center',
              }}>
                {t('home.myStory')}
              </p>
            </div>
          )
        })()}

        {storiesLoading ? (
          <>
            <SkeletonStory /><SkeletonStory /><SkeletonStory /><SkeletonStory />
          </>
        ) : (
          storyGroups.filter(g => g.userId !== profile?.id).map((group) => {
            const realIdx = storyGroups.findIndex(sg => sg.userId === group.userId)
            const hasUnviewed = group.deals.some(d => !viewedDealIds.has(d.id))
            return (
              <div
                key={group.userId}
                onClick={() => openStory(realIdx)}
                style={{
                  display: 'flex', flexDirection: 'column', alignItems: 'center',
                  gap: 6, cursor: 'pointer', flexShrink: 0,
                }}
              >
                <div style={{ position: 'relative' }}>
                  <div style={{
                    width: 68, height: 68, borderRadius: '50%',
                    background: hasUnviewed
                      ? 'linear-gradient(135deg, #FFB800, #FF6B00, #FFB800)'
                      : 'transparent',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    padding: hasUnviewed ? 3 : 0,
                    boxShadow: hasUnviewed ? '0 0 12px rgba(255,184,0,0.4)' : 'none',
                  }}>
                    <div style={{
                      width: hasUnviewed ? 62 : 64,
                      height: hasUnviewed ? 62 : 64,
                      borderRadius: '50%',
                      border: hasUnviewed ? '2px solid var(--bg-deepest)' : '2px solid rgba(255,255,255,0.15)',
                      overflow: 'hidden',
                    }}>
                      <ProfileImage
                        size={hasUnviewed ? 58 : 60}
                        avatarUrl={group.avatarUrl}
                        name={group.displayName || group.username}
                      />
                    </div>
                  </div>
                </div>
                <p style={{
                  fontFamily: 'var(--font-display)', fontSize: 8,
                  color: hasUnviewed ? 'var(--text-primary)' : 'var(--text-muted)',
                  maxWidth: 64, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                  textAlign: 'center',
                  fontWeight: hasUnviewed ? 700 : 400,
                }}>
                  {group.displayName || group.username}
                </p>
              </div>
            )
          })
        )}
      </div>

      {/* ═══ QUICK ACTIONS — Prioritized action-first continue-zone ═══ */}
      {profile && !loading && (() => {
        const actionItems: { id: string; title: string; sub: string; label: string; color: string; href: string; prio: number }[] = []

        // Prio 100: Ergebnis melden (active/pending_confirmation + ich bin Teilnehmer)
        deals.forEach((d: any) => {
          if ((d.status === 'active' || d.status === 'pending_confirmation') && (d.creator_id === profile.id || d.opponent_id === profile.id)) {
            const vsUser = d.creator_id === profile.id ? d.opponent?.username : d.creator?.username
            actionItems.push({
              id: d.id,
              title: t('home.resultFor').replace('{title}', d.title),
              sub: `vs @${vsUser || '?'}`,
              label: d.status === 'pending_confirmation' ? t('home.confirm') : t('home.report'),
              color: '#4ade80', href: `/app/deals/${d.id}`, prio: 100,
            })
          }
        })

        // Prio 95: Einladung annehmen
        pendingInvites.forEach((inv: any) => {
          const inviterName = inv.creator?.display_name || inv.creator?.username || '?'
          actionItems.push({
            id: inv.id,
            title: t('home.acceptChallenge').replace('{username}', inv.creator?.username || '?'),
            sub: `\u201E${inv.title}\u201C`,
            label: t('home.acceptLabel'), color: '#f97316', href: `/app/deals/${inv.id}`, prio: 95,
          })
        })

        // Prio 80: Gegner gesucht (eigene offene Deals ohne Opponent)
        deals.forEach((d: any) => {
          if (d.status === 'open' && d.creator_id === profile.id && !d.opponent_id) {
            actionItems.push({
              id: d.id,
              title: t('home.findOpponent').replace('{title}', d.title),
              sub: t('home.noOpponentYet'),
              label: t('home.shareLabel'), color: '#FFB800', href: `/app/deals/${d.id}`, prio: 80,
            })
          }
        })

        // Prio 75: Revanche starten (completed + ich habe verloren)
        deals.forEach((d: any) => {
          if (d.status === 'completed' && d.confirmed_winner_id && d.confirmed_winner_id !== profile.id &&
              (d.creator_id === profile.id || d.opponent_id === profile.id)) {
            const rival = d.creator_id === profile.id ? d.opponent?.username : d.creator?.username
            actionItems.push({
              id: `rematch-${d.id}`,
              title: t('home.startRematch').replace('{username}', rival || '?'),
              sub: t('home.youLostDeal').replace('{title}', d.title),
              label: t('home.rematch'), color: '#f97316', href: `/app/deals/${d.id}`, prio: 75,
            })
          }
        })

        // Sortieren (höhere prio zuerst) + Max 3
        actionItems.sort((a, b) => b.prio - a.prio)
        const items = actionItems.slice(0, 3)

        // Fallback: Neue Challenge starten
        if (items.length === 0) {
          return (
            <div style={{ padding: '6px 16px 4px' }}>
              <button onClick={() => router.push('/app/deals/create')} style={{
                display: 'flex', alignItems: 'center', gap: 8, padding: '10px 14px',
                background: 'rgba(255,184,0,0.06)', border: '1px solid rgba(255,184,0,0.2)',
                borderRadius: 10, cursor: 'pointer', textAlign: 'left', width: '100%',
              }}>
                <span style={{ fontSize: 16, flexShrink: 0 }}>{'\uD83E\uDD4A'}</span>
                <div style={{ flex: 1 }}>
                  <p style={{ fontFamily: 'var(--font-display)', fontSize: 11, fontWeight: 800, color: 'var(--gold-primary)', letterSpacing: 0.5, margin: 0, textTransform: 'uppercase' }}>
                    {t('home.newChallenge')}
                  </p>
                  <p style={{ fontSize: 9, color: 'rgba(255,255,255,0.5)', margin: '2px 0 0' }}>
                    {t('home.challengeSomeone')}
                  </p>
                </div>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--gold-primary)" strokeWidth="2.5" strokeLinecap="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
              </button>
            </div>
          )
        }

        return (
          <div style={{ padding: '6px 16px 4px', display: 'flex', flexDirection: 'column', gap: 5 }}>
            <p style={{ fontFamily: 'var(--font-display)', fontSize: 7, letterSpacing: 3, color: 'var(--gold-primary)', margin: 0 }}>
              {t('home.continueNow')}
            </p>
            {items.map((item) => (
              <button key={`action-${item.id}`} onClick={() => router.push(item.href)} style={{
                display: 'flex', alignItems: 'center', gap: 8, padding: '7px 10px',
                background: `${item.color}0A`, border: `1px solid ${item.color}33`,
                borderRadius: 10, cursor: 'pointer', textAlign: 'left', width: '100%',
              }}>
                <span style={{
                  width: 6, height: 6, borderRadius: '50%', flexShrink: 0,
                  background: item.color, boxShadow: `0 0 5px ${item.color}80`,
                }} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={{
                    fontFamily: 'var(--font-display)', fontSize: 11, fontWeight: 800,
                    color: 'var(--text-primary)', textTransform: 'uppercase' as const,
                    letterSpacing: 0.5, margin: 0,
                    overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                  }}>
                    {item.title}
                  </p>
                  <p style={{ fontSize: 9, color: item.color, margin: '1px 0 0' }}>
                    {item.sub}
                  </p>
                </div>
                <span style={{
                  fontSize: 8, padding: '3px 8px', borderRadius: 6, flexShrink: 0,
                  fontFamily: 'var(--font-display)', fontWeight: 700, letterSpacing: 1,
                  background: `${item.color}20`, color: item.color,
                }}>
                  {item.label}
                </span>
              </button>
            ))}
          </div>
        )
      })()}

      {/* ═══ MOTIVATIONAL BANNER — dynamic stats → story ═══ */}
      {profile && !loading && deals.length > 0 && (() => {
        const myDeals = deals.filter((d: any) => d.creator_id === profile.id || d.opponent_id === profile.id)
        const wins = myDeals.filter((d: any) => d.status === 'completed' && d.confirmed_winner_id === profile.id).length
        const losses = myDeals.filter((d: any) => d.status === 'completed' && d.confirmed_winner_id && d.confirmed_winner_id !== profile.id).length
        const activeCount = myDeals.filter((d: any) => d.status === 'active').length
        const level = profile.level || 1
        const streak = profile.streak || 0

        // Pick the most motivational message
        let msg = ''
        let icon = ''
        let color = '#FFB800'
        if (streak >= 3) {
          msg = t('home.streakMsg').replace('{n}', String(streak)); icon = '\uD83D\uDD25'; color = '#EF4444'
        } else if (wins > 0 && losses === 0) {
          msg = t('home.perfectRecord').replace('{wins}', String(wins)); icon = '\u{1F4AA}'; color = '#22C55E'
        } else if (activeCount > 0) {
          msg = t('home.activeDuels').replace('{n}', String(activeCount)); icon = '\u26A1'; color = '#4ade80'
        } else if (wins > 0) {
          const needed = (level * 3) - wins
          if (needed > 0) {
            msg = t('home.winsToLevel').replace('{n}', String(needed)).replace('{level}', String(level + 1)); icon = '\uD83C\uDFAF'; color = '#FFB800'
          } else {
            msg = t('home.keepGoing').replace('{w}', String(wins)).replace('{l}', String(losses)); icon = '\uD83C\uDFC6'; color = '#FFB800'
          }
        } else if (myDeals.length > 0) {
          msg = t('home.firstDuelWaiting'); icon = '\uD83E\uDD4A'; color = '#f97316'
        }
        if (!msg) return null
        return (
          <div style={{
            margin: '0 16px 4px', padding: '8px 14px', borderRadius: 10,
            background: `${color}08`, border: `1px solid ${color}18`,
            display: 'flex', alignItems: 'center', gap: 8,
          }}>
            <span style={{ fontSize: 16 }}>{icon}</span>
            <p style={{
              margin: 0, fontSize: 11, fontFamily: 'var(--font-body)',
              color, fontWeight: 600, lineHeight: 1.3,
            }}>
              {msg}
            </p>
          </div>
        )
      })()}

      {/* ═══ SINGLE FILTER BAR — viral-style scrollable chips ═══ */}
      <div style={{
        display: 'flex', gap: 6, padding: '10px 16px',
        background: 'var(--bg-deepest)',
        position: 'sticky', top: 68, zIndex: 30,
        borderBottom: '1px solid var(--border-subtle)',
        overflowX: 'auto', scrollbarWidth: 'none',
        WebkitOverflowScrolling: 'touch',
      }}>
        {([
          { key: 'alle', label: t('home.filters.alle'), color: 'var(--gold-primary)' },
          { key: 'herausforderungen', label: t('home.filters.herausforderungen'), color: '#f97316' },
          { key: 'tipprunden', label: t('home.filters.tipprunden'), color: '#a78bfa' },
          { key: 'live_tipp', label: t('home.filters.live_tipp'), color: '#4ade80' },
        ] as const).map(tab => {
          const isActive = feedTab === tab.key
          return (
            <button
              key={tab.key}
              onClick={() => setFeedTab(tab.key)}
              style={{
                padding: '6px 14px', borderRadius: 20, cursor: 'pointer',
                background: isActive ? `${tab.color}18` : 'transparent',
                border: isActive ? `1.5px solid ${tab.color}55` : '1px solid var(--border-subtle)',
                color: isActive ? tab.color : 'var(--text-muted)',
                fontFamily: 'var(--font-display)', fontSize: 10, fontWeight: 700,
                letterSpacing: 1.2, transition: 'all .2s',
                whiteSpace: 'nowrap', flexShrink: 0,
              }}
            >
              {tab.label}
            </button>
          )
        })}
      </div>

      {/* ── Deal Feed ── */}
      <div style={{ padding: '12px 16px 32px' }}>
        {loading ? (
          skeletonTimeout ? (
            <div style={{ textAlign: 'center', padding: '48px 24px' }}>
              <div style={{ fontSize: 48, marginBottom: 16, opacity: 0.5 }}>{'🤝'}</div>
              <p className="font-display" style={{ fontSize: 16, color: 'var(--text-primary)', marginBottom: 8 }}>{t('home.noDealsFound')}</p>
              <p style={{ color: 'var(--text-secondary)', fontSize: 13, lineHeight: 1.6 }}>{t('home.reloadOrCreate')}</p>
            </div>
          ) : (
            <div>
              <SkeletonCard /><SkeletonCard /><SkeletonCard />
            </div>
          )
        ) : deals.length === 0 && pendingInvites.length === 0 ? (
          <div style={{ padding: '24px 16px' }}>
            {/* Hero CTA */}
            <div style={{ textAlign: 'center', marginBottom: 28 }}>
              <div style={{ fontSize: 56, marginBottom: 16 }}>{'🤝'}</div>
              <p className="font-display" style={{ fontSize: 18, color: 'var(--text-primary)', marginBottom: 8 }}>
                {t('home.noDealsYet')}
              </p>
              <p style={{ color: 'var(--text-secondary)', fontSize: 14, lineHeight: 1.6, marginBottom: 20 }}>
                {t('home.challengeFriend')}
              </p>
              <Link href="/app/deals/create" style={{ textDecoration: 'none' }}>
                <button style={{
                  padding: '14px 32px', borderRadius: 12, border: 'none', cursor: 'pointer',
                  background: 'linear-gradient(135deg, var(--gold-dim), var(--gold-primary))',
                  color: 'var(--text-inverse)', fontFamily: 'var(--font-display)', fontSize: 11,
                  fontWeight: 700, letterSpacing: 3,
                }}>
                  {t('home.createDeal')}
                </button>
              </Link>
            </div>

            {/* Trending Categories */}
            <p style={{ fontFamily: 'var(--font-display)', fontSize: 8, letterSpacing: 3, color: 'var(--gold-primary)', marginBottom: 12 }}>
              {t('home.popularIdeas')}
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 24 }}>
              {[
                { icon: '\uD83C\uDFC3', title: t('home.fitnessChallenge'), sub: t('home.fitnessSub'), color: '#22C55E' },
                { icon: '\uD83C\uDFAF', title: t('home.prediction'), sub: t('home.predictionSub'), color: '#3B82F6' },
                { icon: '\uD83D\uDCDA', title: t('home.learnChallenge'), sub: t('home.learnSub'), color: '#A855F7' },
                { icon: '\u26A1', title: t('home.speedChallenge'), sub: t('home.speedSub'), color: '#F59E0B' },
              ].map((cat, i) => (
                <button
                  key={i}
                  onClick={() => router.push(`/app/deals/create`)}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 14,
                    padding: '14px 16px', borderRadius: 14, cursor: 'pointer',
                    background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)',
                    textAlign: 'left',
                  }}
                >
                  <div style={{
                    width: 44, height: 44, borderRadius: 12,
                    background: `${cat.color}12`, display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 22, flexShrink: 0,
                  }}>
                    {cat.icon}
                  </div>
                  <div style={{ flex: 1 }}>
                    <p style={{ fontFamily: 'var(--font-display)', fontSize: 13, fontWeight: 700, color: 'var(--text-primary)', letterSpacing: 0.5 }}>{cat.title}</p>
                    <p style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>{cat.sub}</p>
                  </div>
                  <span style={{ fontSize: 14, color: cat.color, flexShrink: 0 }}>›</span>
                </button>
              ))}
            </div>

            {/* Quick actions for new users */}
            <p style={{ fontFamily: 'var(--font-display)', fontSize: 8, letterSpacing: 3, color: 'var(--gold-primary)', marginBottom: 12 }}>
              {t('home.discoverLabel')}
            </p>
            <div style={{ display: 'flex', gap: 8 }}>
              {[
                { icon: '\uD83C\uDFC6', label: t('home.leaderboard'), href: '/app/leaderboard' },
                { icon: '\uD83C\uDFB4', label: t('home.battleCard'), href: '/app/avatar-card/create' },
                { icon: '\uD83D\uDC65', label: t('home.friends'), href: '/app/discover' },
                { icon: '\uD83D\uDED2', label: t('home.shop'), href: '/app/shop' },
              ].map((a, i) => (
                <button
                  key={i}
                  onClick={() => router.push(a.href)}
                  style={{
                    flex: 1, padding: '14px 6px', borderRadius: 14, cursor: 'pointer',
                    background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)',
                    display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6,
                  }}
                >
                  <span style={{ fontSize: 22 }}>{a.icon}</span>
                  <span style={{ fontSize: 9, color: 'var(--text-muted)', fontFamily: 'var(--font-display)', letterSpacing: 0.5 }}>{a.label}</span>
                </button>
              ))}
            </div>
          </div>
        ) : (
          <div>
            {/* ── Public Tip Group Feed Cards (on ALLE or TIPPRUNDEN tab) ── */}
            {/* Empty state for TIPPRUNDEN tab */}
            {contentTab === 'tipprunden' && publicTipGroups.filter(tg => !hiddenFeedIds.has(`tg-${tg.id}`)).length === 0 && (
              <div style={{ textAlign: 'center', padding: '48px 24px' }}>
                <div style={{ fontSize: 48, marginBottom: 16, opacity: 0.5 }}>{'\u{1F3C6}'}</div>
                <p style={{ fontFamily: 'var(--font-display)', fontSize: 14, color: 'var(--text-primary)', marginBottom: 8, letterSpacing: 1 }}>{t('home.noTipGroups')}</p>
                <p style={{ color: 'var(--text-secondary)', fontSize: 13, lineHeight: 1.6, marginBottom: 20 }}>
                  {t('home.createOrJoinTip')}
                </p>
                <button onClick={() => router.push('/app/tippen')} style={{
                  padding: '12px 28px', borderRadius: 12, border: 'none', cursor: 'pointer',
                  background: 'linear-gradient(135deg, var(--gold-dim), var(--gold-primary))',
                  color: 'var(--text-inverse)', fontFamily: 'var(--font-display)', fontSize: 11,
                  fontWeight: 700, letterSpacing: 2,
                }}>
                  {t('home.discoverTipGroups')}
                </button>
              </div>
            )}
            {contentTab === 'tipprunden' && publicTipGroups.filter(tg => !hiddenFeedIds.has(`tg-${tg.id}`)).map((tg) => {
              const isTgExpanded = expandedDeals.has(`tg-${tg.id}`)
              const tgBadgeLabel = tg.category === 'custom' ? t('home.challengeLabel') : t('home.tipGroup')
              // Activity Tag — dynamic label for liveliness
              const tgActivityTag = tg.member_count >= 8
                ? { text: t('home.tippingWith').replace('{n}', String(tg.member_count)), color: '#4ade80' }
                : tg.category === 'custom'
                  ? { text: t('home.tipsOpen'), color: '#a78bfa' }
                  : { text: t('home.joinNow'), color: '#60a5fa' }
              return (
              <div key={`ptg-${tg.id}`} data-deal-card={`tg-${tg.id}`} style={{ marginBottom: 6 }}>
                <div style={{
                  borderRadius: 12, overflow: 'hidden',
                  border: '1px solid rgba(255,255,255,0.04)', background: 'rgba(17,17,17,0.85)',
                }}>

                  {/* ═══ COLLAPSED HEADER — Community-Style (compact) ═══ */}
                  <div
                    onClick={() => toggleDealExpand(`tg-${tg.id}`)}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 8,
                      padding: '8px 10px', cursor: 'pointer',
                      borderBottom: isTgExpanded ? '1px solid rgba(255,255,255,0.04)' : 'none',
                    }}
                  >
                    {/* Status dot — smaller */}
                    <span style={{
                      width: 6, height: 6, borderRadius: '50%', flexShrink: 0,
                      background: '#4ade80',
                      boxShadow: '0 0 4px rgba(74,222,128,0.4)',
                    }} />

                    {/* Main info block — 3 rows (compact) */}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      {/* Row 1: Title */}
                      <p style={{
                        fontFamily: 'var(--font-display)', fontSize: 11, fontWeight: 800,
                        color: '#F0ECE4', letterSpacing: 0.6, lineHeight: 1.25,
                        margin: 0,
                        overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                      }}>
                        {tg.name}
                      </p>
                      {/* Row 2: Members — gold */}
                      <div style={{
                        display: 'flex', alignItems: 'center', gap: 5, margin: '2px 0 0',
                        overflow: 'hidden',
                      }}>
                        <span style={{
                          fontSize: 10, fontWeight: 700, color: 'var(--gold-primary)',
                          fontFamily: 'var(--font-display)', whiteSpace: 'nowrap',
                          letterSpacing: 0.5, opacity: 0.85,
                        }}>
                          {'\uD83D\uDC65'} {tg.member_count} {t('home.members')}
                        </span>
                        {tg.league && (
                          <>
                            <span style={{ fontSize: 8, color: 'var(--text-muted)', opacity: 0.3 }}>{'\u00B7'}</span>
                            <span style={{
                              fontSize: 9, color: 'var(--gold-primary)', fontFamily: 'var(--font-display)',
                              fontWeight: 600, whiteSpace: 'nowrap', opacity: 0.6,
                            }}>
                              {tg.league}
                            </span>
                          </>
                        )}
                      </div>
                      {/* Row 3: Stake chip + Activity Tag */}
                      <div style={{
                        display: 'flex', alignItems: 'center', gap: 5, margin: '2px 0 0',
                      }}>
                        {tg.stake && (
                          <span style={{
                            fontSize: 8, color: 'rgba(255,255,255,0.6)', fontWeight: 600,
                            fontFamily: 'var(--font-body)', whiteSpace: 'nowrap',
                            padding: '1px 7px', borderRadius: 5,
                            background: 'rgba(255,184,0,0.06)',
                            border: '1px solid rgba(255,184,0,0.12)',
                          }}>
                            {'\uD83C\uDFAF'} {tg.stake}
                          </span>
                        )}
                        {/* Activity Tag — pulse dot + text */}
                        <span style={{
                          display: 'inline-flex', alignItems: 'center',
                          fontSize: 8, color: tgActivityTag.color, fontWeight: 700,
                          fontFamily: 'var(--font-display)', whiteSpace: 'nowrap',
                          padding: '1px 7px', borderRadius: 5, letterSpacing: 0.3,
                          background: `${tgActivityTag.color}0C`,
                          border: `1px solid ${tgActivityTag.color}20`,
                        }}>
                          {tgActivityTag.text}
                        </span>
                      </div>
                    </div>

                    {/* Status badge */}
                    <span style={{
                      fontSize: 6, padding: '2px 6px', borderRadius: 4, flexShrink: 0,
                      fontFamily: 'var(--font-display)', fontWeight: 700, letterSpacing: 1,
                      color: '#4ade80', border: '1px solid rgba(74,222,128,0.2)',
                      background: 'rgba(74,222,128,0.06)',
                    }}>
                      {tgBadgeLabel}
                    </span>

                    {/* Chevron */}
                    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="var(--text-muted)" strokeWidth="2" strokeLinecap="round"
                      style={{ flexShrink: 0, transition: 'transform 0.25s', transform: isTgExpanded ? 'rotate(180deg)' : 'rotate(0deg)' }}>
                      <polyline points="6 9 12 15 18 9" />
                    </svg>
                  </div>

                  {/* ═══ EXPANDED: Hero Banner — animated ═══ */}
                  <div style={{
                    display: 'grid',
                    gridTemplateRows: isTgExpanded ? '1fr' : '0fr',
                    opacity: isTgExpanded ? 1 : 0,
                    transition: 'grid-template-rows 0.3s ease, opacity 0.25s ease',
                  }}>
                    <div style={{ overflow: 'hidden' }}>
                      {/* Creator info mini header */}
                      <div style={{ display: 'flex', alignItems: 'center', padding: '8px 14px', gap: 8, borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                        <div onClick={(e) => { e.stopPropagation(); if (tg.creator?.username) router.push(`/app/profile/${tg.creator.username}`) }} style={{ cursor: 'pointer' }}>
                          <ProfileImage size={24} avatarUrl={tg.creator?.avatar_url} name={tg.creator?.display_name || tg.creator?.username} goldBorder />
                        </div>
                        <span onClick={(e) => { e.stopPropagation(); if (tg.creator?.username) router.push(`/app/profile/${tg.creator.username}`) }}
                          style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-primary)', cursor: 'pointer' }}>
                          {tg.creator?.display_name || tg.creator?.username || '?'}
                        </span>
                        <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>{'\u00B7'} {timeAgo(tg.created_at)}</span>
                        <div style={{ flex: 1 }} />
                        <div style={{ position: 'relative' }}>
                          <button onClick={(e) => { e.stopPropagation(); setMenuOpenId(menuOpenId === `tg-${tg.id}` ? null : `tg-${tg.id}`) }}
                            style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '2px 4px', display: 'flex', alignItems: 'center', gap: 3 }}>
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="var(--text-muted)" strokeWidth="2" strokeLinecap="round"><circle cx="12" cy="5" r="1"/><circle cx="12" cy="12" r="1"/><circle cx="12" cy="19" r="1"/></svg>
                          </button>
                          {menuOpenId === `tg-${tg.id}` && (
                            <div style={{ position: 'absolute', top: '100%', right: 0, zIndex: 50, background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)', borderRadius: 12, padding: '4px 0', minWidth: 160, boxShadow: '0 8px 24px rgba(0,0,0,0.5)' }}>
                              <button onClick={(e) => { e.stopPropagation(); setHiddenFeedIds(prev => new Set(prev).add(`tg-${tg.id}`)); setMenuOpenId(null) }}
                                style={{ display: 'flex', alignItems: 'center', gap: 8, width: '100%', padding: '10px 14px', background: 'none', border: 'none', color: 'var(--text-secondary)', fontSize: 13, cursor: 'pointer', fontFamily: 'var(--font-body)' }}>
                                Ausblenden
                              </button>
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Hero Banner */}
                      <div onClick={() => router.push(`/app/tippen/${tg.id}`)} style={{
                        position: 'relative', width: '100%', aspectRatio: '860 / 482',
                        backgroundImage: 'url(/tipp-bg.webp)',
                        backgroundSize: 'cover', backgroundPosition: 'center', backgroundRepeat: 'no-repeat',
                        cursor: 'pointer',
                      }}>
                        <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.35)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '20px' }}>
                          {tg.league && (
                            <p style={{ fontSize: 13, color: '#FFB800', marginBottom: 4, textShadow: '0 1px 6px rgba(0,0,0,0.9)', fontFamily: 'var(--font-display)', letterSpacing: 1 }}>{tg.league}</p>
                          )}
                          <p style={{ fontSize: 12, color: '#ccc', marginBottom: 0, textShadow: '0 1px 4px rgba(0,0,0,0.9)' }}>
                            {tg.member_count} {t('home.members')}
                          </p>
                        </div>
                        <div style={{
                          position: 'absolute', bottom: 0, left: 0, right: 0, height: '25%',
                          background: 'linear-gradient(to bottom, transparent 0%, #111 100%)',
                          pointerEvents: 'none',
                        }} />
                      </div>
                    </div>
                  </div>

                  {/* ═══ ALWAYS VISIBLE: Join + Interaction + Tipps ═══ */}
                  <button onClick={() => router.push(`/app/tippen/${tg.id}`)}
                    style={{
                      width: '100%', padding: '8px 0',
                      background: 'linear-gradient(135deg, rgba(180,140,0,0.35), rgba(255,184,0,0.25))',
                      color: 'var(--gold-primary)', fontFamily: 'var(--font-display)',
                      fontSize: 9, fontWeight: 700, letterSpacing: 2, border: 'none', cursor: 'pointer',
                      borderTop: '1px solid rgba(255,184,0,0.1)',
                    }}>
                    {t('home.join')}
                  </button>
                  <TipGroupBetWidget groupId={tg.id} />
                  <TipGroupInteractionBar groupId={tg.id} inviteCode={tg.invite_code} groupName={tg.name} />

                </div>
              </div>
              )
            })}
            {/* ── DEALS + EVENTS UNIFIED TIMELINE (hide on TIPPRUNDEN tab) ── */}
            {feedTab !== 'tipprunden' && (() => {
              // ═══ LIVE TIPP TAB → show user's placed side bets ═══
              if (feedTab === 'live_tipp') {
                if (myBets.length === 0) return [(
                  <div key="empty-bets" style={{ textAlign: 'center', padding: '32px 24px' }}>
                    <p style={{ fontSize: 32, marginBottom: 8, opacity: 0.4 }}>{'\uD83C\uDFB2'}</p>
                    <p style={{ fontFamily: 'var(--font-display)', fontSize: 11, color: 'var(--text-muted)', letterSpacing: 1 }}>
                      {t('home.noLiveTips')}
                    </p>
                    <p style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4, opacity: 0.6 }}>
                      {t('home.placeTipHint')}
                    </p>
                  </div>
                )]
                return myBets.map((bet: any) => {
                  const d = bet.deal
                  const creatorName = d.creator?.display_name || d.creator?.username || '?'
                  const opponentName = d.opponent?.display_name || d.opponent?.username || '?'
                  const tippedName = bet.side === 'a' ? creatorName : opponentName
                  const winnerId = d.confirmed_winner_id || d.winner_id
                  const isWinner = winnerId && ((bet.side === 'a' && winnerId === d.creator_id) || (bet.side === 'b' && winnerId === d.opponent_id))
                  const isLoser = winnerId && !isWinner
                  const statusColor = bet.status === 'won' || isWinner ? '#4ade80' : bet.status === 'lost' || isLoser ? '#ef4444' : '#FFB800'
                  const statusLabel = bet.status === 'won' || isWinner ? t('home.statusWon') : bet.status === 'lost' || isLoser ? t('home.statusLost') : t('home.statusOpen')
                  return (
                    <div key={bet.deal_id}
                      onClick={() => router.push(`/app/deals/${d.id}`)}
                      style={{
                        marginBottom: 12, borderRadius: 12, overflow: 'hidden',
                        border: `1px solid ${statusColor}25`, background: '#111',
                        cursor: 'pointer',
                      }}>
                      {/* Titel */}
                      <div style={{
                        padding: '10px 14px 6px',
                        background: `linear-gradient(135deg, ${statusColor}08, transparent)`,
                      }}>
                        <p style={{
                          fontFamily: 'var(--font-display)', fontSize: 13, fontWeight: 900,
                          color: statusColor, letterSpacing: 1, textTransform: 'uppercase',
                          margin: 0, lineHeight: 1.3,
                          overflow: 'hidden', display: '-webkit-box',
                          WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' as never,
                        }}>
                          {d.title}
                        </p>
                      </div>
                      {/* Begegnung */}
                      <div style={{ padding: '4px 14px', display: 'flex', alignItems: 'center', gap: 4 }}>
                        <span style={{ fontSize: 10 }}>{'\u2694\uFE0F'}</span>
                        <span style={{ fontFamily: 'var(--font-body)', fontSize: 11, fontWeight: 600, color: 'rgba(255,255,255,0.7)' }}>
                          {creatorName} <span style={{ color: 'rgba(255,255,255,0.4)' }}>vs</span> {opponentName}
                        </span>
                      </div>
                      {/* Tipp + Status */}
                      <div style={{
                        padding: '6px 14px 10px',
                        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                      }}>
                        <span style={{
                          fontFamily: 'var(--font-display)', fontSize: 12, fontWeight: 800,
                          color: statusColor, letterSpacing: 0.5,
                          border: `1px solid ${statusColor}30`, borderRadius: 6,
                          padding: '3px 10px', background: `${statusColor}08`,
                        }}>
                          {'\uD83C\uDFAF'} {t('home.yourTip')} {tippedName}
                        </span>
                        <span style={{
                          fontFamily: 'var(--font-display)', fontSize: 8, fontWeight: 700,
                          color: statusColor, letterSpacing: 1.5,
                        }}>
                          {statusLabel}
                        </span>
                      </div>
                    </div>
                  )
                })
              }

              // ═══ DEALS & CHALLENGES TABS ═══
              let filteredDeals = deals
              if (feedTab === 'herausforderungen') {
                filteredDeals = deals.filter((d: any) =>
                  d.creator_id !== profile?.id &&
                  d.opponent_id !== profile?.id &&
                  ['active', 'open', 'pending'].includes(d.status)
                )
              }

              if (filteredDeals.length === 0 && feedTab !== 'alle') {
                return [(
                  <div key="empty-filter" style={{ textAlign: 'center', padding: '32px 24px' }}>
                    <p style={{ fontSize: 32, marginBottom: 8, opacity: 0.4 }}>{'\uD83D\uDD25'}</p>
                    <p style={{ fontFamily: 'var(--font-display)', fontSize: 11, color: 'var(--text-muted)', letterSpacing: 1 }}>
                      {t('home.noChallenges')}
                    </p>
                  </div>
                )]
              }

              // Build event-activity map: deal_id → newest event timestamp
              const dealLastActivity = new Map<string, number>()
              if (feedEvents.length > 0) {
                (feedEvents as FeedEvent[]).forEach((ev: any) => {
                  const did = ev.deal_id || ev.metadata?.deal_id
                  if (!did) return
                  const t = new Date(ev.created_at).getTime()
                  const cur = dealLastActivity.get(did) || 0
                  if (t > cur) dealLastActivity.set(did, t)
                })
              }

              const getPriority = (deal: any) => {
                const isMine = deal.creator_id === profile?.id || deal.opponent_id === profile?.id
                if (deal.status === 'pending' && deal.opponent_id === profile?.id) return 0
                if ((deal.status === 'active' || deal.status === 'pending_confirmation') && isMine) return 0
                if (deal.status === 'open' && !deal.opponent_id && deal.creator_id === profile?.id) return 0
                if (deal.status === 'active') return 1
                if (deal.status === 'open' || deal.status === 'pending') return 2
                return 3
              }

              const getActivityDate = (deal: any) => {
                const eventTime = dealLastActivity.get(deal.id) || 0
                const createdTime = new Date(deal.created_at).getTime()
                return Math.max(eventTime, createdTime)
              }

              // Sort deals by priority then activity
              const sortedDeals = [...filteredDeals]
                .filter((d: any) => !hiddenFeedIds.has(d.id))
                .sort((a: any, b: any) => {
                  const pa = getPriority(a)
                  const pb = getPriority(b)
                  if (pa !== pb) return pa - pb
                  return getActivityDate(b) - getActivityDate(a)
                })

              // No MiniEventCards in feed — all notifications go to the bell only
              const aggregatedEvents: FeedEventItem[] = []

              const items: React.ReactNode[] = []
              let dealCardCount = 0
              let eventIdx = 0

              sortedDeals.forEach((deal: any) => {
                // ═══ RENDER DEAL via FeedDealCard dispatcher ═══
                items.push(
                  <FeedDealCard
                    key={deal.id}
                    deal={deal}
                    expanded={expandedDeals.has(deal.id)}
                    onToggleExpand={() => toggleDealExpand(deal.id)}
                    feedEvents={feedEvents}
                    feedMedia={feedMedia}
                    betQuotes={betQuotes}
                    onCommentOpen={(id: string) => { setCommentDealId(id); setCommentSheetOpen(true) }}
                    userId={profile?.id || ''}
                    onHide={(id: string) => setHiddenFeedIds(prev => new Set(prev).add(id))}
                  />
                )
                dealCardCount++

                // ── Inject MiniEventCards after every 3rd deal ──
                if (dealCardCount % 3 === 0 && eventIdx < aggregatedEvents.length) {
                  const batch = aggregatedEvents.slice(eventIdx, eventIdx + 2)
                  if (batch.length > 0) {
                    items.push(
                      <div key={`event-stream-${eventIdx}`} style={{ padding: '4px 0', marginBottom: 8 }}>
                        {batch.map((evt: FeedEventItem) => (
                          <div key={evt.id} style={{ marginBottom: 4 }}>
                            <MiniEventCard event={evt} />
                          </div>
                        ))}
                      </div>
                    )
                    eventIdx += batch.length
                  }
                }
              })
              return items
            })()}

            {hasMore && (
              <div ref={sentinelRef} style={{ padding: 20, textAlign: 'center' }}>
                {loadingMore && (
                  <div style={{
                    width: 24, height: 24, margin: '0 auto',
                    border: '2px solid transparent', borderTopColor: 'var(--gold-primary)',
                    borderRadius: '50%', animation: 'spin 0.8s linear infinite',
                  }} />
                )}
              </div>
            )}

            {!hasMore && deals.length > 0 && (
              <div style={{ textAlign: 'center', padding: '20px 0 8px' }}>
                <p style={{
                  fontFamily: 'var(--font-display)', fontSize: 9, letterSpacing: 2,
                  color: 'var(--text-muted)',
                }}>
                  {t('home.thatsAll')}
                </p>
              </div>
            )}
          </div>
        )}
      </div>

      {/* ── Full-screen media overlay (feed) ── */}
      {fullMediaView && (
        <div onClick={() => setFullMediaView(null)} style={{ position: 'fixed', inset: 0, zIndex: 200, background: 'rgba(0,0,0,0.95)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <button onClick={() => setFullMediaView(null)} style={{ position: 'absolute', top: 16, right: 16, width: 36, height: 36, borderRadius: '50%', background: 'rgba(255,255,255,0.15)', border: 'none', color: '#fff', fontSize: 20, cursor: 'pointer', zIndex: 10, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>&times;</button>
          {fullMediaView.type === 'video' ? (
            <video src={fullMediaView.url} controls autoPlay playsInline onClick={(e) => e.stopPropagation()} style={{ maxWidth: '95%', maxHeight: '85vh', borderRadius: 12, objectFit: 'contain' }} />
          ) : (
            <img src={fullMediaView.url} alt="" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '95%', maxHeight: '85vh', borderRadius: 12, objectFit: 'contain' }} />
          )}
        </div>
      )}

      {/* ── Story Viewer (no onReact) ── */}
      {storyViewerOpen && storyGroups.length > 0 && (
        <StoryViewer
          stories={storyGroups}
          initialGroupIndex={storyViewerIndex}
          onClose={() => setStoryViewerOpen(false)}
          onViewed={handleStoryViewed}
        />
      )}

      {/* ── Comment Sheet ── */}
      {commentDealId && (
        <CommentSheet
          dealId={commentDealId}
          open={commentSheetOpen}
          onClose={() => { setCommentSheetOpen(false); setCommentDealId(null) }}
        />
      )}
    </div>
  )
}
