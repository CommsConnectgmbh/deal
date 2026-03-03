'use client'
import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/contexts/AuthContext'
import { useLang } from '@/contexts/LanguageContext'
import { supabase } from '@/lib/supabase'

interface UserResult {
  id: string
  username: string
  display_name: string
  level: number
  wins: number
  deals_total: number
  is_private: boolean
  followStatus: 'none' | 'pending' | 'accepted'
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
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    if (profile) fetchSuggestions()
  }, [profile])

  const fetchSuggestions = async () => {
    // Get active users that the current user doesn't follow yet
    const { data: followingData } = await supabase
      .from('follows')
      .select('following_id')
      .eq('follower_id', profile!.id)

    const followingIds = (followingData || []).map((f: any) => f.following_id)
    followingIds.push(profile!.id)

    const { data } = await supabase
      .from('profiles')
      .select('id, username, display_name, level, wins, deals_total, is_private')
      .not('id', 'in', `(${followingIds.join(',')})`)
      .order('deals_total', { ascending: false })
      .limit(10)

    if (data) {
      setSuggestions(data.map((u: any) => ({ ...u, followStatus: 'none' })))
    }
  }

  const search = async (q: string) => {
    if (!q.trim()) { setResults([]); return }
    setSearching(true)
    const { data } = await supabase
      .from('profiles')
      .select('id, username, display_name, level, wins, deals_total, is_private')
      .ilike('username', `%${q}%`)
      .neq('id', profile!.id)
      .limit(20)

    if (data) {
      // Check follow status for each result
      const ids = data.map((u: any) => u.id)
      const { data: followData } = await supabase
        .from('follows')
        .select('following_id, status')
        .eq('follower_id', profile!.id)
        .in('following_id', ids)

      const followMap: Record<string, string> = {}
      for (const f of (followData || [])) {
        followMap[f.following_id] = f.status
      }

      setResults(data.map((u: any) => ({
        ...u,
        followStatus: (followMap[u.id] as any) || 'none'
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
    setFollowLoading(userId)
    const status = isPrivate ? 'pending' : 'accepted'
    await supabase.from('follows').upsert({
      follower_id: profile!.id,
      following_id: userId,
      status
    }, { onConflict: 'follower_id,following_id' })

    const update = (list: UserResult[]) =>
      list.map(u => u.id === userId ? { ...u, followStatus: status as any } : u)
    setResults(update)
    setSuggestions(update)
    setFollowLoading(null)
  }

  const unfollow = async (userId: string) => {
    setFollowLoading(userId)
    await supabase.from('follows')
      .delete()
      .eq('follower_id', profile!.id)
      .eq('following_id', userId)
    const update = (list: UserResult[]) =>
      list.map(u => u.id === userId ? { ...u, followStatus: 'none' as any } : u)
    setResults(update)
    setSuggestions(update)
    setFollowLoading(null)
  }

  const FollowButton = ({ user }: { user: UserResult }) => {
    const loading = followLoading === user.id
    if (user.followStatus === 'accepted') {
      return (
        <button onClick={() => unfollow(user.id)} disabled={loading} style={{ padding:'8px 14px', borderRadius:8, border:'1px solid rgba(255,255,255,0.1)', background:'transparent', color:'rgba(240,236,228,0.4)', fontFamily:'Cinzel, serif', fontSize:9, letterSpacing:1, cursor:'pointer' }}>
          {loading ? '...' : t('profile.unfollow').toUpperCase()}
        </button>
      )
    }
    if (user.followStatus === 'pending') {
      return (
        <button disabled style={{ padding:'8px 14px', borderRadius:8, border:'1px solid rgba(255,184,0,0.2)', background:'rgba(255,184,0,0.06)', color:'rgba(255,184,0,0.5)', fontFamily:'Cinzel, serif', fontSize:9, letterSpacing:1 }}>
          {t('profile.followPending').toUpperCase()}
        </button>
      )
    }
    return (
      <button onClick={() => follow(user.id, user.is_private)} disabled={loading} style={{ padding:'8px 14px', borderRadius:8, border:'none', background:'linear-gradient(135deg, #CC8800, #FFB800)', color:'#000', fontFamily:'Cinzel, serif', fontSize:9, fontWeight:700, letterSpacing:1, cursor:'pointer' }}>
        {loading ? '...' : t('profile.follow').toUpperCase()}
      </button>
    )
  }

  const UserCard = ({ user }: { user: UserResult }) => (
    <div style={{ background:'#111', borderRadius:12, border:'1px solid rgba(255,255,255,0.06)', padding:'14px 16px', display:'flex', alignItems:'center', gap:12, marginBottom:10 }}>
      <div
        onClick={() => router.push(`/app/profile/${user.username}`)}
        style={{ width:44, height:44, borderRadius:'50%', background:'linear-gradient(135deg, #CC8800, #FFB800)', display:'flex', alignItems:'center', justifyContent:'center', cursor:'pointer', flexShrink:0 }}
      >
        <span className='font-display' style={{ fontSize:14, color:'#000', fontWeight:700 }}>
          {(user.username || 'U').slice(0,2).toUpperCase()}
        </span>
      </div>
      <div style={{ flex:1, minWidth:0, cursor:'pointer' }} onClick={() => router.push(`/app/profile/${user.username}`)}>
        <p style={{ fontSize:14, color:'#f0ece4', fontWeight:600, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
          {user.display_name || user.username}
        </p>
        <p style={{ fontSize:12, color:'rgba(240,236,228,0.4)' }}>
          @{user.username} · Lv.{user.level} · {user.wins} {lang === 'de' ? 'Siege' : 'wins'}
        </p>
      </div>
      <FollowButton user={user} />
    </div>
  )

  const displayList = query.trim() ? results : suggestions

  return (
    <div style={{ minHeight:'100dvh', background:'#060606', paddingTop:60, paddingBottom:100 }}>
      <div style={{ padding:'0 20px 16px', display:'flex', alignItems:'center', gap:12 }}>
        <button onClick={() => router.back()} style={{ background:'none', border:'none', color:'rgba(240,236,228,0.5)', cursor:'pointer', fontSize:20, padding:0 }}>←</button>
        <h1 className='font-display' style={{ fontSize:20, color:'#f0ece4' }}>{t('discover.title')}</h1>
      </div>

      {/* Search */}
      <div style={{ margin:'0 16px 20px', position:'relative' }}>
        <span style={{ position:'absolute', left:14, top:'50%', transform:'translateY(-50%)', fontSize:16, color:'rgba(240,236,228,0.3)' }}>🔍</span>
        <input
          value={query}
          onChange={e => handleQuery(e.target.value)}
          placeholder={t('discover.search')}
          style={{ width:'100%', padding:'13px 16px 13px 42px', background:'#111', border:'1px solid rgba(255,184,0,0.15)', borderRadius:12, color:'#f0ece4', fontSize:15, fontFamily:'Crimson Text, serif', outline:'none', boxSizing:'border-box' }}
        />
        {searching && (
          <span style={{ position:'absolute', right:14, top:'50%', transform:'translateY(-50%)', fontSize:12, color:'rgba(240,236,228,0.4)' }}>...</span>
        )}
      </div>

      <div style={{ padding:'0 16px' }}>
        {!query.trim() && (
          <p style={{ fontFamily:'Cinzel, serif', fontSize:9, letterSpacing:3, color:'rgba(240,236,228,0.4)', marginBottom:12 }}>
            {t('discover.suggestions').toUpperCase()}
          </p>
        )}
        {query.trim() && results.length === 0 && !searching && (
          <div style={{ textAlign:'center', padding:'40px 20px' }}>
            <p style={{ fontSize:14, color:'rgba(240,236,228,0.4)' }}>{t('discover.noResultsText')}</p>
          </div>
        )}
        {displayList.map(user => <UserCard key={user.id} user={user} />)}
      </div>
    </div>
  )
}
