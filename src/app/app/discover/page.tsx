'use client'
import { useState, useEffect, useRef, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/contexts/AuthContext'
import { useLang } from '@/contexts/LanguageContext'
import { supabase } from '@/lib/supabase'
import AvatarDisplay, { AvatarConfig } from '@/components/AvatarDisplay'

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
  avatarConfig?: AvatarConfig | null
  primary_archetype?: string
}

export default function DiscoverPage() {
  const { profile } = useAuth()
  const { lang } = useLang()
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
          .select('id, username, display_name, level, wins, deals_total, is_private, follower_count, following_count, primary_archetype')
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
            .sort((a, b) => (b.mutualCount || 0) - (a.mutualCount || 0))
        }
      }
    }

    // Fallback: top active players
    if (suggestedUsers.length < 5) {
      const { data: topUsers } = await supabase
        .from('profiles')
        .select('id, username, display_name, level, wins, deals_total, is_private, follower_count, following_count, primary_archetype')
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

    // Load avatar configs
    if (suggestedUsers.length > 0) {
      const { data: configs } = await supabase
        .from('avatar_config')
        .select('user_id, body, hair, outfit, accessory')
        .in('user_id', suggestedUsers.map(u => u.id))

      const configMap: Record<string, AvatarConfig> = {}
      for (const c of (configs || [])) {
        configMap[c.user_id] = { body: c.body, hair: c.hair, outfit: c.outfit, accessory: c.accessory }
      }
      suggestedUsers = suggestedUsers.map(u => ({ ...u, avatarConfig: configMap[u.id] || null }))
    }

    setSuggestions(suggestedUsers)
  }

  const search = async (q: string) => {
    if (!q.trim()) { setResults([]); return }
    setSearching(true)
    const { data } = await supabase
      .from('profiles')
      .select('id, username, display_name, level, wins, deals_total, is_private, follower_count, following_count, primary_archetype')
      .or(`username.ilike.%${q}%,display_name.ilike.%${q}%`)
      .neq('id', profile!.id)
      .limit(20)

    if (data) {
      const ids = data.map((u: any) => u.id)
      const [followRes, configRes] = await Promise.all([
        supabase.from('follows').select('following_id, status').eq('follower_id', profile!.id).in('following_id', ids),
        supabase.from('avatar_config').select('user_id, body, hair, outfit, accessory').in('user_id', ids),
      ])

      const followMap: Record<string, string> = {}
      for (const f of (followRes.data || [])) followMap[f.following_id] = f.status

      const configMap: Record<string, AvatarConfig> = {}
      for (const c of (configRes.data || [])) {
        configMap[c.user_id] = { body: c.body, hair: c.hair, outfit: c.outfit, accessory: c.accessory }
      }

      setResults(data.map((u: any) => ({
        ...u,
        followStatus: (followMap[u.id] as any) || 'none',
        mutualCount: 0,
        avatarConfig: configMap[u.id] || null,
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
    const status = isPrivate ? 'pending' : 'accepted'
    await supabase.from('follows').upsert({
      follower_id: profile.id,
      following_id: userId,
      status,
    }, { onConflict: 'follower_id,following_id' })

    // Notify the target user
    await supabase.from('notifications').insert({
      user_id: userId,
      type: isPrivate ? 'follow_request' : 'follow_accepted',
      title: isPrivate
        ? (lang === 'de' ? 'Neue Follower-Anfrage' : 'New Follow Request')
        : (lang === 'de' ? 'Neuer Follower' : 'New Follower'),
      body: `@${profile.username} ${isPrivate ? (lang === 'de' ? 'möchte dir folgen' : 'wants to follow you') : (lang === 'de' ? 'folgt dir jetzt' : 'is now following you')}`,
      reference_id: profile.id,
    })

    const update = (list: UserResult[]) =>
      list.map(u => u.id === userId ? { ...u, followStatus: status as any } : u)
    setResults(update)
    setSuggestions(update)
    setFollowLoading(null)
  }

  const unfollow = async (userId: string) => {
    if (!profile) return
    setFollowLoading(userId)
    await supabase.from('follows').delete()
      .eq('follower_id', profile.id)
      .eq('following_id', userId)
    const update = (list: UserResult[]) =>
      list.map(u => u.id === userId ? { ...u, followStatus: 'none' as any } : u)
    setResults(update)
    setSuggestions(update)
    setFollowLoading(null)
  }

  const handleShare = async () => {
    const shareUrl = `https://app.deal-buddy.app/join?ref=${profile?.username}`
    const shareText = lang === 'de'
      ? `Komm zu DealBuddy – das Spiel für Deal-Profis! 🤝 ${shareUrl}`
      : `Join me on DealBuddy – the game for deal makers! 🤝 ${shareUrl}`

    if (navigator.share) {
      try {
        await navigator.share({ title: 'DealBuddy', text: shareText, url: shareUrl })
        return
      } catch {}
    }
    try {
      await navigator.clipboard.writeText(shareUrl)
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
          style={{ padding: '8px 14px', borderRadius: 8, border: '1px solid rgba(255,255,255,0.1)', background: 'transparent', color: 'rgba(240,236,228,0.4)', fontFamily: 'Cinzel, serif', fontSize: 9, letterSpacing: 1, cursor: 'pointer' }}
        >
          {loading ? '···' : lang === 'de' ? 'ENTFOLGEN' : 'UNFOLLOW'}
        </button>
      )
    }
    if (user.followStatus === 'pending') {
      return (
        <button
          disabled
          style={{ padding: '8px 14px', borderRadius: 8, border: '1px solid rgba(255,184,0,0.2)', background: 'rgba(255,184,0,0.06)', color: 'rgba(255,184,0,0.5)', fontFamily: 'Cinzel, serif', fontSize: 9, letterSpacing: 1 }}
        >
          {lang === 'de' ? 'ANGEFRAGT' : 'PENDING'}
        </button>
      )
    }
    return (
      <button
        onClick={() => follow(user.id, user.is_private)}
        disabled={loading}
        style={{ padding: '8px 14px', borderRadius: 8, border: 'none', background: 'linear-gradient(135deg, #CC8800, #FFB800)', color: '#000', fontFamily: 'Cinzel, serif', fontSize: 9, fontWeight: 700, letterSpacing: 1, cursor: 'pointer' }}
      >
        {loading ? '···' : lang === 'de' ? 'FOLGEN' : 'FOLLOW'}
      </button>
    )
  }

  const UserCard = ({ user }: { user: UserResult }) => (
    <div style={{ background: '#111', borderRadius: 12, border: '1px solid rgba(255,255,255,0.06)', padding: '14px 16px', display: 'flex', alignItems: 'center', gap: 12, marginBottom: 10 }}>
      <div
        onClick={() => router.push(`/app/profile/${user.username}`)}
        style={{ flexShrink: 0, cursor: 'pointer' }}
      >
        <AvatarDisplay
          config={user.avatarConfig || null}
          archetype={user.primary_archetype || 'founder'}
          size={44}
          initials={(user.display_name || user.username || 'U').slice(0, 2).toUpperCase()}
        />
      </div>
      <div style={{ flex: 1, minWidth: 0, cursor: 'pointer' }} onClick={() => router.push(`/app/profile/${user.username}`)}>
        <p style={{ fontSize: 14, color: '#f0ece4', fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {user.display_name || user.username}
        </p>
        <p style={{ fontSize: 11, color: 'rgba(240,236,228,0.4)', marginTop: 1 }}>
          @{user.username} · Lv.{user.level}
          {(user.mutualCount || 0) > 0 && (
            <span style={{ color: '#FFB800', marginLeft: 6 }}>· {user.mutualCount} {lang === 'de' ? 'gem.' : 'mutual'}</span>
          )}
        </p>
        <p style={{ fontSize: 10, color: 'rgba(240,236,228,0.25)', marginTop: 1 }}>
          {user.follower_count || 0} {lang === 'de' ? 'Follower' : 'followers'}
        </p>
      </div>
      <FollowButton user={user} />
    </div>
  )

  const displayList = query.trim() ? results : suggestions

  return (
    <div style={{ minHeight: '100dvh', background: '#060606', paddingTop: 60, paddingBottom: 100 }}>

      {/* Share toast */}
      {shareToast && (
        <div style={{ position: 'fixed', top: 80, left: '50%', transform: 'translateX(-50%)', background: 'linear-gradient(135deg, #CC8800, #FFB800)', borderRadius: 12, padding: '10px 20px', zIndex: 300, whiteSpace: 'nowrap', boxShadow: '0 8px 24px rgba(255,184,0,0.3)' }}>
          <span style={{ fontFamily: 'Cinzel, serif', fontSize: 12, color: '#000', fontWeight: 700 }}>
            {lang === 'de' ? '🔗 Link kopiert!' : '🔗 Link copied!'}
          </span>
        </div>
      )}

      {/* Header */}
      <div style={{ padding: '0 20px 16px', display: 'flex', alignItems: 'center', gap: 12 }}>
        <button onClick={() => router.back()} style={{ background: 'none', border: 'none', color: 'rgba(240,236,228,0.5)', cursor: 'pointer', fontSize: 20, padding: 0 }}>←</button>
        <h1 className="font-display" style={{ fontSize: 20, color: '#f0ece4', flex: 1 }}>
          {lang === 'de' ? 'ENTDECKEN' : 'DISCOVER'}
        </h1>
        {/* Share / Invite button */}
        <button
          onClick={handleShare}
          style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '7px 14px', borderRadius: 20, background: 'rgba(255,184,0,0.08)', border: '1px solid rgba(255,184,0,0.25)', color: '#FFB800', fontFamily: 'Cinzel, serif', fontSize: 9, letterSpacing: 1, cursor: 'pointer' }}
        >
          📨 {lang === 'de' ? 'EINLADEN' : 'INVITE'}
        </button>
      </div>

      {/* Search bar */}
      <div style={{ margin: '0 16px 20px', position: 'relative' }}>
        <span style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', fontSize: 16, color: 'rgba(240,236,228,0.3)' }}>🔍</span>
        <input
          value={query}
          onChange={e => handleQuery(e.target.value)}
          placeholder={lang === 'de' ? 'Nutzer suchen…' : 'Search users…'}
          style={{ width: '100%', padding: '13px 16px 13px 42px', background: '#111', border: '1px solid rgba(255,184,0,0.15)', borderRadius: 12, color: '#f0ece4', fontSize: 15, fontFamily: 'Crimson Text, serif', outline: 'none', boxSizing: 'border-box' }}
        />
        {searching && (
          <span style={{ position: 'absolute', right: 14, top: '50%', transform: 'translateY(-50%)', fontSize: 12, color: 'rgba(240,236,228,0.4)' }}>···</span>
        )}
      </div>

      <div style={{ padding: '0 16px' }}>
        {!query.trim() && (
          <p style={{ fontFamily: 'Cinzel, serif', fontSize: 9, letterSpacing: 3, color: 'rgba(240,236,228,0.4)', marginBottom: 12 }}>
            {lang === 'de' ? 'VORSCHLÄGE' : 'SUGGESTED'}
          </p>
        )}
        {query.trim() && results.length === 0 && !searching && (
          <div style={{ textAlign: 'center', padding: '40px 20px' }}>
            <p style={{ fontSize: 32, marginBottom: 12 }}>🔍</p>
            <p style={{ fontSize: 14, color: 'rgba(240,236,228,0.4)' }}>
              {lang === 'de' ? 'Keine Nutzer gefunden.' : 'No users found.'}
            </p>
          </div>
        )}
        {suggestions.length === 0 && !query.trim() && (
          <div style={{ textAlign: 'center', padding: '40px 20px' }}>
            <p style={{ fontSize: 32, marginBottom: 12 }}>👋</p>
            <p style={{ fontSize: 14, color: 'rgba(240,236,228,0.4)', marginBottom: 16 }}>
              {lang === 'de' ? 'Lade Freunde ein und entdecke neue Rivalen!' : 'Invite friends and discover new rivals!'}
            </p>
            <button
              onClick={handleShare}
              style={{ padding: '12px 28px', borderRadius: 20, background: 'linear-gradient(135deg, #CC8800, #FFB800)', border: 'none', color: '#000', fontFamily: 'Cinzel, serif', fontSize: 10, fontWeight: 700, letterSpacing: 1, cursor: 'pointer' }}
            >
              📨 {lang === 'de' ? 'FREUNDE EINLADEN' : 'INVITE FRIENDS'}
            </button>
          </div>
        )}
        {displayList.map(user => <UserCard key={user.id} user={user} />)}
      </div>
    </div>
  )
}