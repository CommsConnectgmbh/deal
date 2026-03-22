'use client'
import { useState, useEffect, useRef, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/contexts/AuthContext'
import { useLang } from '@/contexts/LanguageContext'
import { supabase } from '@/lib/supabase'
import ProfileImage from '@/components/ProfileImage'
import { triggerPush } from '@/lib/sendPushNotification'
import { trackFollowUser, trackUnfollowUser, trackShareClicked, trackInviteSent, trackScreenView } from '@/lib/analytics'

interface UserResult {
  id: string
  username: string
  display_name: string
  level: number
  wins: number
  deals_total: number
  is_private: boolean
  follower_count: number
  following_count: number
  followStatus: 'none' | 'pending' | 'accepted'
  mutualCount?: number
  avatar_url?: string | null
  primary_archetype?: string
}

export default function DiscoverPage() {
  const { profile } = useAuth()
  const { t, lang } = useLang()
  const router = useRouter()
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<UserResult[]>([])
  const [suggestions, setSuggestions] = useState<UserResult[]>([])
  const [searching, setSearching] = useState(false)
  const [followLoading, setFollowLoading] = useState<string | null>(null)
  const [shareToast, setShareToast] = useState(false)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const showShareToast = useCallback(() => {
    setShareToast(true)
    setTimeout(() => setShareToast(false), 2500)
  }, [])

  useEffect(() => { trackScreenView('discover') }, [])

  useEffect(() => {
    if (profile) fetchSuggestions()
  }, [profile])

  const fetchSuggestions = async () => {
    if (!profile) return

    // 1. Get my following list
    const { data: followingData } = await supabase
      .from('follows')
      .select('following_id')
      .eq('follower_id', profile.id)
      .eq('status', 'accepted')

    const followingIds: string[] = (followingData || []).map((f: any) => f.following_id)
    const excludeIds = [...followingIds, profile.id]

    let suggestedUsers: UserResult[] = []

    if (followingIds.length > 0) {
      // 2. Get people my friends follow (2nd-degree connections)
      const { data: friendsFollowing } = await supabase
        .from('follows')
        .select('following_id')
        .in('follower_id', followingIds)
        .eq('status', 'accepted')
        .not('following_id', 'in', `(${excludeIds.join(",")})`)

      // 3. Count mutual connections
      const mutualMap: Record<string, number> = {}
      for (const r of (friendsFollowing || [])) {
        mutualMap[r.following_id] = (mutualMap[r.following_id] || 0) + 1
      }

      const candidateIds = Object.keys(mutualMap)
      if (candidateIds.length > 0) {
        const { data: profiles } = await supabase
          .from('profiles')
          .select('id, username, display_name, level, wins, deals_total, is_private, follower_count, following_count, primary_archetype, avatar_url')
          .in('id', candidateIds)
          .limit(15)

        if (profiles) {
          // Get pending follow statuses for these candidates
          const { data: myFollows } = await supabase
            .from('follows')
            .select('following_id, status')
            .eq('follower_id', profile.id)
            .in('following_id', profiles.map((p: any) => p.id))

          const followMap: Record<string, string> = {}
          for (const f of (myFollows || [])) followMap[f.following_id] = f.status

          suggestedUsers = profiles
            .map((u: any) => ({
              ...u,
              followStatus: (followMap[u.id] as any) || 'none',
              mutualCount: mutualMap[u.id] || 0,
            }))
            .sort((a: any, b: any) => (b.mutualCount || 0) - (a.mutualCount || 0))
        }
      }
    }

    // Fallback: top active players
    if (suggestedUsers.length < 5) {
      const { data: topUsers } = await supabase
        .from('profiles')
        .select('id, username, display_name, level, wins, deals_total, is_private, follower_count, following_count, primary_archetype, avatar_url')
        .not('id', 'in', `(${excludeIds.join(",")})`)
        .order('deals_total', { ascending: false })
        .limit(10)

      if (topUsers) {
        const existingIds = new Set(suggestedUsers.map(u => u.id))
        const extras = topUsers
          .filter((u: any) => !existingIds.has(u.id))
          .map((u: any) => ({ ...u, followStatus: 'none' as const, mutualCount: 0 }))
        suggestedUsers = [...suggestedUsers, ...extras].slice(0, 12)
      }
    }

    setSuggestions(suggestedUsers)
  }

  const search = async (q: string) => {
    if (!q.trim()) { setResults([]); return }
    setSearching(true)
    const { data } = await supabase
      .from('profiles')
      .select('id, username, display_name, level, wins, deals_total, is_private, follower_count, following_count, primary_archetype, avatar_url')
      .or(`username.ilike.%${q}%,display_name.ilike.%${q}%`)
      .neq('id', profile!.id)
      .limit(20)

    if (data) {
      const ids = data.map((u: any) => u.id)
      const { data: followRes } = await supabase
        .from('follows')
        .select('following_id, status')
        .eq('follower_id', profile!.id)
        .in('following_id', ids)

      const followMap: Record<string, string> = {}
      for (const f of (followRes || [])) followMap[f.following_id] = f.status

      setResults(data.map((u: any) => ({
        ...u,
        followStatus: (followMap[u.id] as any) || 'none',
        mutualCount: 0,
      })))
    }
    setSearching(false)
  }

  const handleQuery = (q: string) => {
    setQuery(q)
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => search(q), 400)
  }

  const follow = async (userId: string, isPrivate: boolean) => {
    if (!profile) return
    setFollowLoading(userId)
    try {
      const status = isPrivate ? 'pending' : 'accepted'
      const { error: followError } = await supabase.from('follows').upsert({
        follower_id: profile.id,
        following_id: userId,
        status,
      }, { onConflict: 'follower_id,following_id' })

      if (followError) {
        console.error('Follow error:', followError)
        setFollowLoading(null)
        return
      }

      trackFollowUser(userId)

      // Notify the target user (non-blocking)
      supabase.from('notifications').insert({
        user_id: userId,
        type: isPrivate ? 'follow_request' : 'follow_accepted',
        title: isPrivate ? t('discover.followRequest') : t('discover.newFollower'),
        body: `@${profile.username} ${isPrivate ? t('discover.wantsToFollow') : t('discover.nowFollowing')}`,
        reference_id: profile.id,
      }).then(() => {})

      // Push (non-blocking)
      triggerPush(userId, `👥 ${t('discover.newFollower')}`, `@${profile.username} ${t('discover.nowFollowing')}`, `/app/profile/${profile.username}`)

      const update = (list: UserResult[]) =>
        list.map(u => u.id === userId ? { ...u, followStatus: status as any } : u)
      setResults(update)
      setSuggestions(update)
    } catch (err) {
      console.error('Follow failed:', err)
    } finally {
      setFollowLoading(null)
    }
  }

  const unfollow = async (userId: string) => {
    if (!profile) return
    setFollowLoading(userId)
    await supabase.from('follows').delete()
      .eq('follower_id', profile.id)
      .eq('following_id', userId)
    trackUnfollowUser(userId)
    const update = (list: UserResult[]) =>
      list.map(u => u.id === userId ? { ...u, followStatus: 'none' as any } : u)
    setResults(update)
    setSuggestions(update)
    setFollowLoading(null)
  }

  const handleShare = async () => {
    const shareUrl = `https://app.deal-buddy.app/join?ref=${profile?.username}`
    const shareText = `${t('discover.inviteText')} 🤝 ${shareUrl}`

    if (navigator.share) {
      try {
        await navigator.share({ title: 'DealBuddy', text: shareText, url: shareUrl })
        trackInviteSent('native_share')
        trackShareClicked('invite', 'native_share')
        return
      } catch {}
    }
    try {
      await navigator.clipboard.writeText(shareUrl)
      trackInviteSent('copy_link')
      trackShareClicked('invite', 'copy_link')
      showShareToast()
    } catch {}
  }

  const FollowButton = ({ user }: { user: UserResult }) => {
    const loading = followLoading === user.id
    if (user.followStatus === 'accepted') {
      return (
        <button
          onClick={() => unfollow(user.id)}
          disabled={loading}
          style={{ padding: '8px 14px', borderRadius: 8, border: '1px solid var(--border-subtle)', background: 'transparent', color: 'var(--text-secondary)', fontFamily: 'var(--font-display)', fontSize: 9, letterSpacing: 1, cursor: 'pointer' }}
        >
          {loading ? '···' : t('discover.unfollow')}
        </button>
      )
    }
    if (user.followStatus === 'pending') {
      return (
        <button
          disabled
          style={{ padding: '8px 14px', borderRadius: 8, border: '1px solid rgba(255,184,0,0.2)', background: 'var(--gold-subtle)', color: 'rgba(255,184,0,0.5)', fontFamily: 'var(--font-display)', fontSize: 9, letterSpacing: 1 }}
        >
          {t('discover.pending')}
        </button>
      )
    }
    return (
      <button
        onClick={() => follow(user.id, user.is_private)}
        disabled={loading}
        style={{ padding: '8px 14px', borderRadius: 8, border: 'none', background: 'linear-gradient(135deg, var(--gold-dim), var(--gold-primary))', color: 'var(--text-inverse)', fontFamily: 'var(--font-display)', fontSize: 9, fontWeight: 700, letterSpacing: 1, cursor: 'pointer' }}
      >
        {loading ? '···' : t('discover.follow')}
      </button>
    )
  }

  const UserCard = ({ user }: { user: UserResult }) => (
    <div style={{ background: 'var(--bg-surface)', borderRadius: 12, border: '1px solid var(--border-subtle)', padding: '14px 16px', display: 'flex', alignItems: 'center', gap: 12, marginBottom: 10 }}>
      <ProfileImage
        size={44}
        avatarUrl={user.avatar_url}
        name={user.username}
        onClick={() => router.push(`/app/profile/${user.username}`)}
      />
      <div style={{ flex: 1, minWidth: 0, cursor: 'pointer' }} onClick={() => router.push(`/app/profile/${user.username}`)}>
        <p style={{ fontSize: 14, color: 'var(--text-primary)', fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {user.display_name || user.username}
        </p>
        <p style={{ fontSize: 11, color: 'var(--text-secondary)', marginTop: 1 }}>
          @{user.username} · Lv.{user.level}
          {(user.mutualCount || 0) > 0 && (
            <span style={{ color: 'var(--gold-primary)', marginLeft: 6 }}>· {user.mutualCount} {t('discover.mutual')}</span>
          )}
        </p>
        <p style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 1 }}>
          {user.follower_count || 0} {t('discover.followers')}
        </p>
      </div>
      <FollowButton user={user} />
    </div>
  )

  const displayList = query.trim() ? results : suggestions

  return (
    <div style={{ minHeight: '100dvh', background: 'var(--bg-base)', paddingTop: 60, paddingBottom: 100 }}>

      {/* Share toast */}
      {shareToast && (
        <div style={{ position: 'fixed', top: 80, left: '50%', transform: 'translateX(-50%)', background: 'linear-gradient(135deg, var(--gold-dim), var(--gold-primary))', borderRadius: 12, padding: '10px 20px', zIndex: 300, whiteSpace: 'nowrap', boxShadow: '0 8px 24px rgba(255,184,0,0.3)' }}>
          <span style={{ fontFamily: 'var(--font-display)', fontSize: 12, color: 'var(--text-inverse)', fontWeight: 700 }}>
            🔗 {t('discover.linkCopied')}
          </span>
        </div>
      )}

      {/* Header */}
      <div style={{ padding: '0 20px 16px', display: 'flex', alignItems: 'center', gap: 12 }}>
        <button onClick={() => router.back()} style={{ background: 'none', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer', fontSize: 20, padding: 0 }}>←</button>
        <h1 className="font-display" style={{ fontSize: 20, color: 'var(--text-primary)', flex: 1 }}>
          {t('discover.title').toUpperCase()}
        </h1>
        {/* Share / Invite button */}
        <button
          onClick={handleShare}
          style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '7px 14px', borderRadius: 20, background: 'var(--gold-subtle)', border: '1px solid rgba(255,184,0,0.25)', color: 'var(--gold-primary)', fontFamily: 'var(--font-display)', fontSize: 9, letterSpacing: 1, cursor: 'pointer' }}
        >
          📨 {t('discover.inviteFriends').split(' ')[0]}
        </button>
      </div>

      {/* Search bar */}
      <div style={{ margin: '0 16px 20px', position: 'relative' }}>
        <span style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', fontSize: 16, color: 'var(--text-muted)' }}>🔍</span>
        <input
          value={query}
          onChange={e => handleQuery(e.target.value)}
          placeholder={t('discover.search')}
          style={{ width: '100%', padding: '13px 16px 13px 42px', background: 'var(--bg-surface)', border: '1px solid rgba(255,184,0,0.15)', borderRadius: 12, color: 'var(--text-primary)', fontSize: 15, fontFamily: 'Crimson Text, serif', outline: 'none', boxSizing: 'border-box' }}
        />
        {searching && (
          <span style={{ position: 'absolute', right: 14, top: '50%', transform: 'translateY(-50%)', fontSize: 12, color: 'var(--text-secondary)' }}>···</span>
        )}
      </div>

      <div style={{ padding: '0 16px' }}>
        {!query.trim() && (
          <p style={{ fontFamily: 'var(--font-display)', fontSize: 9, letterSpacing: 3, color: 'var(--text-secondary)', marginBottom: 12 }}>
            {t('discover.suggested')}
          </p>
        )}
        {query.trim() && results.length === 0 && !searching && (
          <div style={{ textAlign: 'center', padding: '40px 20px' }}>
            <p style={{ fontSize: 32, marginBottom: 12 }}>🔍</p>
            <p style={{ fontSize: 14, color: 'var(--text-secondary)' }}>
              {t('discover.noUsersFound')}
            </p>
          </div>
        )}
        {suggestions.length === 0 && !query.trim() && (
          <div style={{ textAlign: 'center', padding: '40px 20px' }}>
            <p style={{ fontSize: 32, marginBottom: 12 }}>👋</p>
            <p style={{ fontSize: 14, color: 'var(--text-secondary)', marginBottom: 16 }}>
              {t('discover.inviteDesc')}
            </p>
            <button
              onClick={handleShare}
              style={{ padding: '12px 28px', borderRadius: 20, background: 'linear-gradient(135deg, var(--gold-dim), var(--gold-primary))', border: 'none', color: 'var(--text-inverse)', fontFamily: 'var(--font-display)', fontSize: 10, fontWeight: 700, letterSpacing: 1, cursor: 'pointer' }}
            >
              📨 {t('discover.inviteFriends')}
            </button>
          </div>
        )}
        {displayList.map(user => <UserCard key={user.id} user={user} />)}
      </div>
    </div>
  )
}