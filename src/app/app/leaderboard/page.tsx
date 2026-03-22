'use client'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/contexts/AuthContext'
import { supabase } from '@/lib/supabase'
import ProfileImage from '@/components/ProfileImage'
import Link from 'next/link'
import { useLang } from '@/contexts/LanguageContext'

type Period = 'week' | 'season' | 'alltime'
type Category = 'level' | 'streak' | 'wins' | 'deals' | 'tipper' | 'recruiter'
type Scope = 'all' | 'friends'

const CAT_EMOJI: Record<Category, string> = {
  level:'🏆', streak:'🔥', wins:'⚔️', deals:'⚡',
  tipper:'⚽', recruiter:'👥',
}
const CAT_KEYS: Record<Category, string> = {
  level:'leaderboard.level', streak:'leaderboard.streak', wins:'leaderboard.wins', deals:'leaderboard.deals',
  tipper:'leaderboard.tipper', recruiter:'leaderboard.recruiter',
}
const VIEW_KEYS: Record<Period, string> = {
  week:'leaderboard.week', season:'leaderboard.season', alltime:'leaderboard.alltime',
}
const ARCHETYPE_ICONS: Record<string, string> = {
  'Stratege': '🧠', 'Zerstörer': '💀', 'Showmaster': '🎭',
  'Survivor': '🛡️', 'Allrounder': '⚔️', 'Newcomer': '🌱',
}

interface LBEntry {
  id: string
  username: string
  display_name: string
  avatar_url?: string
  level: number
  streak: number
  wins: number
  deals_total: number
  active_frame: string
  is_founder: boolean
  primary_archetype: string
  tip_points?: number
  referral_count?: number
}

interface PrevRanks { [userId: string]: number }

export default function LeaderboardPage() {
  const { profile } = useAuth()
  const router = useRouter()
  const { t } = useLang()
  const [period,   setPeriod]   = useState<Period>('week')
  const [category, setCategory] = useState<Category>('level')
  const [scope,    setScope]    = useState<Scope>('all')
  const [entries,  setEntries]  = useState<LBEntry[]>([])
  const [myRank,   setMyRank]   = useState<number | null>(null)
  const [loading,  setLoading]  = useState(false)
  const [prevRanks, setPrevRanks] = useState<PrevRanks>({})
  const [followIds, setFollowIds] = useState<string[]>([])

  // Load followed users once
  useEffect(() => {
    if (!profile) return
    supabase.from('follows').select('following_id').eq('follower_id', profile.id)
      .then(({ data }) => {
        const ids = (data || []).map((f: any) => f.following_id)
        setFollowIds(ids)
      })
  }, [profile?.id])

  useEffect(() => { fetchLeaderboard() }, [category, period, scope, followIds])

  const fetchLeaderboard = async () => {
    setLoading(true)
    const col: Record<string, string> = { level:'level', streak:'streak', wins:'wins', deals:'deals_total' }
    const storageKey = `lb_ranks_${category}_${period}_${scope}`

    // Load previous ranks
    try {
      const stored = localStorage.getItem(storageKey)
      if (stored) setPrevRanks(JSON.parse(stored))
    } catch { setPrevRanks({}) }

    let d: LBEntry[] = []

    if (category === 'tipper') {
      // Query tip_group_members, aggregate total_points per user, join profile data
      const { data: tipData } = await supabase
        .rpc('leaderboard_tipper', { lim: 50 })
      if (tipData && tipData.length > 0) {
        // If RPC exists, use it
        d = tipData
      } else {
        // Fallback: direct query
        const { data: members } = await supabase
          .from('tip_group_members')
          .select('user_id, total_points')
          .order('total_points', { ascending: false })
          .limit(50)
        if (members && members.length > 0) {
          const userIds = members.map((m: any) => m.user_id)
          const friendIds = scope === 'friends' && profile ? [...followIds, profile.id] : null
          const filteredIds = friendIds ? userIds.filter((id: string) => friendIds.includes(id)) : userIds
          if (filteredIds.length > 0) {
            const { data: profiles } = await supabase
              .from('profiles')
              .select('id,username,display_name,avatar_url,level,streak,wins,deals_total,active_frame,is_founder,primary_archetype')
              .in('id', filteredIds)
            const pointsMap: Record<string, number> = {}
            members.forEach((m: any) => { pointsMap[m.user_id] = (pointsMap[m.user_id] || 0) + (m.total_points || 0) })
            d = (profiles || []).map((p: any) => ({ ...p, tip_points: pointsMap[p.id] || 0 }))
            d.sort((a, b) => (b.tip_points || 0) - (a.tip_points || 0))
          }
        }
      }
    } else if (category === 'recruiter') {
      // Query referrals, count per referrer, join profile data
      const { data: refData } = await supabase
        .rpc('leaderboard_recruiter', { lim: 50 })
      if (refData && refData.length > 0) {
        d = refData
      } else {
        // Fallback: query profiles with referred_by to count referrals
        const { data: refs } = await supabase
          .from('profiles')
          .select('referred_by')
          .not('referred_by', 'is', null)
        if (refs && refs.length > 0) {
          const countMap: Record<string, number> = {}
          refs.forEach((r: any) => { if (r.referred_by) countMap[r.referred_by] = (countMap[r.referred_by] || 0) + 1 })
          const referrerIds = Object.keys(countMap).slice(0, 50)
          const friendIds = scope === 'friends' && profile ? [...followIds, profile.id] : null
          const filteredIds = friendIds ? referrerIds.filter(id => friendIds.includes(id)) : referrerIds
          if (filteredIds.length > 0) {
            const { data: profiles } = await supabase
              .from('profiles')
              .select('id,username,display_name,avatar_url,level,streak,wins,deals_total,active_frame,is_founder,primary_archetype')
              .in('id', filteredIds)
            d = (profiles || []).map((p: any) => ({ ...p, referral_count: countMap[p.id] || 0 }))
            d.sort((a, b) => (b.referral_count || 0) - (a.referral_count || 0))
          }
        }
      }
    } else {
      // Standard profile-based categories
      let query = supabase
        .from('profiles')
        .select('id,username,display_name,avatar_url,level,streak,wins,deals_total,active_frame,is_founder,primary_archetype')
        .order(col[category], { ascending: false })
        .limit(50)

      // Friends filter
      if (scope === 'friends' && profile) {
        const friendIds = [...followIds, profile.id]
        if (friendIds.length > 0) {
          query = query.in('id', friendIds)
        }
      }

      const { data } = await query
      d = data || []
    }

    setEntries(d)

    const idx = d.findIndex((e: LBEntry) => e.id === profile?.id)
    setMyRank(idx >= 0 ? idx + 1 : null)

    // Save current ranks for next visit
    try {
      const newRanks: PrevRanks = {}
      d.forEach((e: LBEntry, i: number) => { newRanks[e.id] = i + 1 })
      localStorage.setItem(storageKey, JSON.stringify(newRanks))
    } catch {}

    setLoading(false)
  }

  const getScore = (e: LBEntry) => {
    if (category === 'level')     return `Lv. ${e.level}`
    if (category === 'streak')    return `${e.streak}`
    if (category === 'wins')      return `${e.wins} ${t('leaderboard.winsUnit')}`
    if (category === 'tipper')    return `${e.tip_points || 0} Pts`
    if (category === 'recruiter') return `${e.referral_count || 0} Refs`
    return `${e.deals_total} Deals`
  }

  const getRankChange = (userId: string, currentRank: number) => {
    const prev = prevRanks[userId]
    if (!prev) return null
    const diff = prev - currentRank
    if (diff > 0) return { dir: 'up' as const, n: diff }
    if (diff < 0) return { dir: 'down' as const, n: Math.abs(diff) }
    return null
  }

  const RankArrow = ({ userId, rank }: { userId: string; rank: number }) => {
    const change = getRankChange(userId, rank)
    if (!change) return null
    return (
      <span style={{
        fontSize: 9, fontWeight: 700, marginLeft: 3,
        color: change.dir === 'up' ? 'var(--status-active)' : 'var(--status-error)',
      }}>
        {change.dir === 'up' ? `▲${change.n}` : `▼${change.n}`}
      </span>
    )
  }

  const archetypeIcon = (arch?: string) => {
    if (!arch) return ''
    return ARCHETYPE_ICONS[arch] || ''
  }

  return (
    <div style={{ minHeight:'100dvh', background:'var(--bg-base)', color:'var(--text-primary)', paddingBottom:100 }}>
      {/* Header */}
      <div style={{ padding:'56px 20px 16px', display:'flex', alignItems:'center', gap:12 }}>
        <button onClick={() => router.back()} style={{ background:'none', border:'none', color:'var(--text-muted)', cursor:'pointer', fontSize:22 }}>‹</button>
        <h1 style={{ fontFamily:'var(--font-display)', fontSize:22, color:'var(--text-primary)', fontWeight:700, flex:1 }}>{t('leaderboard.title')}</h1>
      </div>

      {/* Scope Toggle: ALLE / FREUNDE */}
      <div style={{ display:'flex', margin:'0 16px 10px', background:'var(--bg-surface)', borderRadius:10, padding:3 }}>
        {(['all', 'friends'] as Scope[]).map(s => (
          <button key={s} onClick={() => setScope(s)}
            style={{
              flex:1, padding:'7px', borderRadius:8,
              border: scope===s ? '1px solid var(--border-subtle)' : 'none',
              background: scope===s ? 'var(--gold-subtle)' : 'transparent',
              color: scope===s ? 'var(--gold-primary)' : 'var(--text-muted)',
              fontFamily:'var(--font-display)', fontSize:10, letterSpacing:1.5, cursor:'pointer',
            }}>
            {s === 'all' ? t('leaderboard.all') : t('leaderboard.friends')}
          </button>
        ))}
      </div>

      {/* Period Tabs */}
      <div style={{ display:'flex', margin:'0 16px 12px', background:'var(--bg-surface)', borderRadius:10, padding:4 }}>
        {(Object.keys(VIEW_KEYS) as Period[]).map(p => (
          <button key={p} onClick={() => setPeriod(p)}
            style={{ flex:1, padding:'8px', borderRadius:8, border: period===p ? '1px solid var(--border-subtle)' : 'none', background: period===p ? 'var(--gold-subtle)' : 'transparent', color: period===p ? 'var(--gold-primary)' : 'var(--text-muted)', fontFamily:'var(--font-display)', fontSize:10, letterSpacing:1, cursor:'pointer' }}>
            {t(VIEW_KEYS[p])}
          </button>
        ))}
      </div>

      {/* Category Tabs */}
      <div style={{ display:'flex', gap:6, padding:'0 16px 16px', overflowX:'auto', scrollbarWidth:'none' }}>
        {(Object.keys(CAT_KEYS) as Category[]).map(c => (
          <button key={c} onClick={() => setCategory(c)}
            style={{ flexShrink:0, padding:'6px 14px', borderRadius:20, border: category===c ? '1.5px solid var(--gold-primary)' : '1px solid var(--bg-elevated)', background: category===c ? 'var(--gold-subtle)' : 'var(--bg-surface)', color: category===c ? 'var(--gold-primary)' : 'var(--text-muted)', fontSize:11, fontFamily:'var(--font-display)', cursor:'pointer', whiteSpace:'nowrap' }}>
            {CAT_EMOJI[c]} {t(CAT_KEYS[c])}
          </button>
        ))}
      </div>

      {/* My Rank Banner */}
      {myRank && (
        <div style={{ margin:'0 16px 16px', padding:'12px 16px', background:'var(--gold-subtle)', borderRadius:12, border:'1px solid var(--border-subtle)' }}>
          <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom: myRank > 1 ? 8 : 0 }}>
            <span style={{ fontSize:13, color:'var(--text-muted)' }}>{t('leaderboard.yourPosition')}</span>
            <span style={{ fontFamily:'var(--font-display)', fontSize:16, color:'var(--gold-primary)', fontWeight:700 }}>
              #{myRank}
              {profile && <RankArrow userId={profile.id} rank={myRank} />}
            </span>
          </div>
          {/* Distance to next rank */}
          {myRank > 1 && entries.length >= myRank && (() => {
            const myEntry = entries[myRank - 1]
            const nextEntry = entries[myRank - 2]
            if (!myEntry || !nextEntry) return null
            const myScore = category === 'level' ? myEntry.level : category === 'streak' ? myEntry.streak : category === 'wins' ? myEntry.wins : category === 'tipper' ? (myEntry.tip_points || 0) : category === 'recruiter' ? (myEntry.referral_count || 0) : myEntry.deals_total
            const nextScore = category === 'level' ? nextEntry.level : category === 'streak' ? nextEntry.streak : category === 'wins' ? nextEntry.wins : category === 'tipper' ? (nextEntry.tip_points || 0) : category === 'recruiter' ? (nextEntry.referral_count || 0) : nextEntry.deals_total
            const diff = nextScore - myScore
            if (diff <= 0) return null
            const unit = category === 'level' ? 'Level' : category === 'streak' ? t('leaderboard.daysUnit') : category === 'wins' ? t('leaderboard.winsUnit') : category === 'tipper' ? t('leaderboard.pointsUnit') : category === 'recruiter' ? 'Refs' : 'Deals'
            return (
              <div style={{ display:'flex', alignItems:'center', gap:8, paddingTop:8, borderTop:'1px solid rgba(255,184,0,0.1)' }}>
                <span style={{ fontSize:11, color:'var(--text-muted)' }}>{t('leaderboard.stillNeeded')} <strong style={{ color:'var(--gold-primary)' }}>{diff} {unit}</strong> {t('leaderboard.until')} #{myRank - 1}</span>
                <div style={{ flex:1, height:4, borderRadius:2, background:'rgba(255,255,255,0.06)', overflow:'hidden' }}>
                  <div style={{ height:'100%', borderRadius:2, background:'var(--gold-primary)', width:`${Math.min(100, (myScore / nextScore) * 100)}%`, transition:'width 0.5s ease' }} />
                </div>
              </div>
            )
          })()}
        </div>
      )}

      {/* Top 3 Podium */}
      {entries.length >= 3 && !loading && (
        <div style={{ display:'flex', alignItems:'flex-end', justifyContent:'center', gap:8, padding:'0 16px 20px' }}>
          {/* 2nd */}
          <Link href={`/app/profile/${entries[1].username}`} style={{ textDecoration:'none', textAlign:'center', flex:1 }}>
            <ProfileImage size={52} avatarUrl={entries[1].avatar_url} name={entries[1].username} borderColor="#C0C0C0" />
            <p style={{ fontSize:11, fontFamily:'var(--font-display)', color:'#C0C0C0', marginTop:6 }}>
              #{2}<RankArrow userId={entries[1].id} rank={2} />
            </p>
            <p style={{ fontSize:12, color:'var(--text-primary)', fontWeight:600 }}>
              {archetypeIcon(entries[1].primary_archetype)} @{entries[1].username}
            </p>
            <p style={{ fontSize:11, color:'var(--text-muted)' }}>{getScore(entries[1])}</p>
            <div style={{ height:60, background:'#C0C0C015', borderRadius:'8px 8px 0 0', border:'1px solid #C0C0C030', marginTop:8 }} />
          </Link>
          {/* 1st */}
          <Link href={`/app/profile/${entries[0].username}`} style={{ textDecoration:'none', textAlign:'center', flex:1.2 }}>
            <div style={{ fontSize:10, color:'var(--gold-primary)', fontFamily:'var(--font-display)', letterSpacing:1, marginBottom:4 }}>{t('leaderboard.champion')}</div>
            <div style={{ position:'relative', display:'inline-block' }}>
              <ProfileImage size={64} avatarUrl={entries[0].avatar_url} name={entries[0].username} borderColor="var(--gold-primary)" />
              <span style={{ position:'absolute', top:-8, right:-4, fontSize:18 }}>👑</span>
            </div>
            <p style={{ fontSize:11, fontFamily:'var(--font-display)', color:'var(--gold-primary)', marginTop:6 }}>
              #{1}<RankArrow userId={entries[0].id} rank={1} />
            </p>
            <p style={{ fontSize:13, color:'var(--text-primary)', fontWeight:700 }}>
              {archetypeIcon(entries[0].primary_archetype)} @{entries[0].username}
            </p>
            <p style={{ fontSize:12, color:'var(--gold-primary)' }}>{getScore(entries[0])}</p>
            <div style={{ height:80, background:'#FFB80015', borderRadius:'8px 8px 0 0', border:'1px solid #FFB80030', marginTop:8 }} />
          </Link>
          {/* 3rd */}
          <Link href={`/app/profile/${entries[2].username}`} style={{ textDecoration:'none', textAlign:'center', flex:1 }}>
            <ProfileImage size={52} avatarUrl={entries[2].avatar_url} name={entries[2].username} borderColor="#CD7F32" />
            <p style={{ fontSize:11, fontFamily:'var(--font-display)', color:'#CD7F32', marginTop:6 }}>
              #{3}<RankArrow userId={entries[2].id} rank={3} />
            </p>
            <p style={{ fontSize:12, color:'var(--text-primary)', fontWeight:600 }}>
              {archetypeIcon(entries[2].primary_archetype)} @{entries[2].username}
            </p>
            <p style={{ fontSize:11, color:'var(--text-muted)' }}>{getScore(entries[2])}</p>
            <div style={{ height:44, background:'#CD7F3215', borderRadius:'8px 8px 0 0', border:'1px solid #CD7F3230', marginTop:8 }} />
          </Link>
        </div>
      )}

      {/* Empty state for friends */}
      {!loading && scope === 'friends' && entries.length === 0 && (
        <div style={{ textAlign:'center', padding:'40px 20px', color:'var(--text-muted)' }}>
          <p style={{ fontSize:24, marginBottom:8 }}>👥</p>
          <p style={{ fontSize:14, marginBottom:4 }}>{t('leaderboard.noFriends')}</p>
          <p style={{ fontSize:12 }}>{t('leaderboard.noFriendsSub')}</p>
        </div>
      )}

      {/* Rest of list */}
      <div style={{ padding:'0 16px', display:'flex', flexDirection:'column', gap:8 }}>
        {loading ? (
          <p style={{ textAlign:'center', color:'var(--text-muted)', padding:40 }}>{t('leaderboard.loading')}</p>
        ) : entries.slice(3).map((e, i) => {
          const rank  = i + 4
          const isMe  = e.id === profile?.id
          const change = getRankChange(e.id, rank)
          return (
            <Link key={e.id} href={`/app/profile/${e.username}`} style={{ textDecoration:'none' }}>
              <div style={{
                display:'flex', alignItems:'center', gap:12, padding:'12px 16px',
                background: isMe ? 'var(--gold-subtle)' : 'var(--bg-surface)',
                borderRadius:12, border: isMe ? '1px solid var(--gold-glow)' : '1px solid var(--bg-elevated)',
              }}>
                <div style={{ width:28, textAlign:'center', flexShrink:0 }}>
                  <span style={{ fontFamily:'var(--font-display)', fontSize:14, color: isMe ? 'var(--gold-primary)' : 'var(--text-muted)' }}>#{rank}</span>
                  {change && (
                    <div style={{
                      fontSize: 8, fontWeight: 700, marginTop: 1,
                      color: change.dir === 'up' ? 'var(--status-active)' : 'var(--status-error)',
                    }}>
                      {change.dir === 'up' ? `▲${change.n}` : `▼${change.n}`}
                    </div>
                  )}
                </div>
                <ProfileImage size={36} avatarUrl={e.avatar_url} name={e.username} />
                <div style={{ flex:1, minWidth:0 }}>
                  <p style={{ fontSize:13, fontWeight:700, color: isMe ? 'var(--gold-primary)' : 'var(--text-primary)', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
                    {archetypeIcon(e.primary_archetype)} {e.display_name || e.username}
                  </p>
                  <p style={{ fontSize:11, color:'var(--text-muted)' }}>@{e.username} {e.is_founder && '· 👑 Founder'}</p>
                </div>
                <div style={{ textAlign:'right', flexShrink:0 }}>
                  <p style={{ fontFamily:'var(--font-display)', fontSize:14, color:'var(--gold-primary)', fontWeight:700 }}>{getScore(e)}</p>
                </div>
              </div>
            </Link>
          )
        })}
      </div>
    </div>
  )
}
