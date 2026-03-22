'use client'
import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/contexts/AuthContext'
import { useLang } from '@/contexts/LanguageContext'
import { supabase } from '@/lib/supabase'
import ProfileImage from '@/components/ProfileImage'

export default function RivalsPage() {
  const { profile } = useAuth()
  const { t, lang } = useLang()
  const router = useRouter()

  const [rivalries,   setRivalries]   = useState<any[]>([])
  const [suggested,   setSuggested]   = useState<any[]>([])
  const [addOpen,     setAddOpen]     = useState(false)
  const [search,      setSearch]      = useState('')
  const [searchRes,   setSearchRes]   = useState<any[]>([])
  const [tab,         setTab]         = useState<'rivals' | 'suggested'>('rivals')
  const [loading,     setLoading]     = useState(true)

  const fetchData = useCallback(async () => {
    if (!profile) return
    setLoading(true)

    // 1. My rivalries
    const { data: rivData } = await supabase
      .from('rivalries')
      .select('*, rival:rival_id(id, username, display_name, level, avatar_url)')
      .eq('user_id', profile.id)
      .order('rivalry_intensity', { ascending: false })
    setRivalries(rivData || [])

    // 2. Suggested rivals: friends-of-friends who are NOT already my rivals
    const { data: following } = await supabase
      .from('follows')
      .select('following_id')
      .eq('follower_id', profile.id)
      .eq('status', 'accepted')
    const myFollowingIds = (following || []).map((f: any) => f.following_id)

    const existingRivalIds = new Set((rivData || []).map((r: any) => r.rival_id))
    existingRivalIds.add(profile.id)

    if (myFollowingIds.length > 0) {
      // People my friends follow (2nd degree connections)
      const { data: friendsFollowing } = await supabase
        .from('follows')
        .select('following_id, follower_id')
        .in('follower_id', myFollowingIds)
        .eq('status', 'accepted')
        .not('following_id', 'in', `(${[...existingRivalIds, ...myFollowingIds].join(',')})`)

      if (friendsFollowing?.length) {
        // Count mutual connections (how many of my friends follow them)
        const countMap: Record<string, number> = {}
        const whoFollows: Record<string, string[]> = {}
        for (const f of friendsFollowing) {
          if (!existingRivalIds.has(f.following_id)) {
            countMap[f.following_id] = (countMap[f.following_id] || 0) + 1
            whoFollows[f.following_id] = whoFollows[f.following_id] || []
            whoFollows[f.following_id].push(f.follower_id)
          }
        }
        const topIds = Object.entries(countMap)
          .sort((a, b) => b[1] - a[1])
          .slice(0, 8)
          .map(([id]) => id)

        if (topIds.length > 0) {
          const { data: sugProfiles } = await supabase
            .from('profiles')
            .select('id, username, display_name, level, wins, deals_total, avatar_url')
            .in('id', topIds)
          if (sugProfiles) {
            setSuggested(sugProfiles.map((p: any) => ({
              ...p,
              mutualCount: countMap[p.id] || 0,
            })))
          }
        }
      } else {
        // Fallback: active players by deals_total
        const { data: fallback } = await supabase
          .from('profiles')
          .select('id, username, display_name, level, wins, deals_total, avatar_url')
          .not('id', 'in', `(${[...existingRivalIds].join(',')})`)
          .order('deals_total', { ascending: false })
          .limit(8)
        setSuggested((fallback || []).map((p: any) => ({ ...p, mutualCount: 0 })))
      }
    } else {
      // No friends yet: show top active players
      const { data: fallback } = await supabase
        .from('profiles')
        .select('id, username, display_name, level, wins, deals_total, avatar_url')
        .neq('id', profile.id)
        .order('deals_total', { ascending: false })
        .limit(8)
      setSuggested((fallback || []).map((p: any) => ({ ...p, mutualCount: 0 })))
    }
    setLoading(false)
  }, [profile])

  useEffect(() => { fetchData() }, [fetchData])

  const searchUsers = async (q: string) => {
    if (!q.trim()) { setSearchRes([]); return }
    const { data } = await supabase
      .from('profiles')
      .select('id, username, display_name, level, avatar_url')
      .ilike('username', `%${q}%`)
      .neq('id', profile!.id)
      .limit(6)
    setSearchRes(data || [])
  }

  const addRival = async (rivalId: string) => {
    await supabase.from('rivalries').upsert(
      { user_id: profile!.id, rival_id: rivalId, rivalry_intensity: 0, wins: 0, losses: 0 },
      { onConflict: 'user_id,rival_id' }
    )
    setAddOpen(false); setSearch(''); setSearchRes([])
    fetchData()
  }

  const isAlreadyRival = (uid: string) => rivalries.some((r: any) => r.rival_id === uid)
  const initials = (u: any) => (u?.display_name || u?.username || 'U').slice(0, 2).toUpperCase()

  return (
    <div style={{ minHeight: '100dvh', background: 'var(--bg-base)', paddingTop: 60, paddingBottom: 100 }}>

      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0 20px 20px' }}>
        <h1 className="font-display" style={{ fontSize: 26, color: 'var(--text-primary)' }}>{t('rivals.title')}</h1>
        <button
          onClick={() => setAddOpen(true)}
          style={{ padding: '10px 16px', borderRadius: 10, border: '1px solid var(--gold-glow)', background: 'transparent', color: 'var(--gold-primary)', fontFamily: 'var(--font-display)', fontSize: 9, letterSpacing: 1, cursor: 'pointer' }}
        >
          + {(t('rivals.addFriend') || 'Rival').toUpperCase()}
        </button>
      </div>

      {/* Tab switcher */}
      <div style={{ display: 'flex', margin: '0 16px 20px', background: 'var(--bg-surface)', borderRadius: 10, padding: 4, gap: 2 }}>
        {(['rivals', 'suggested'] as const).map(t2 => (
          <button
            key={t2}
            onClick={() => setTab(t2)}
            style={{
              flex: 1, padding: '9px 4px', borderRadius: 7, border: tab === t2 ? '1px solid rgba(255,184,0,0.25)' : '1px solid transparent',
              background: tab === t2 ? 'var(--gold-subtle)' : 'transparent',
              color: tab === t2 ? 'var(--gold-primary)' : 'var(--text-muted)',
              fontFamily: 'var(--font-display)', fontSize: 9, letterSpacing: 0.5, cursor: 'pointer',
            }}
          >
            {t2 === 'rivals' ? (lang === 'de' ? 'MEINE RIVALEN' : 'MY RIVALS') : (lang === 'de' ? 'VORSCHLÄGE' : 'SUGGESTED')}
          </button>
        ))}
      </div>

      <div style={{ padding: '0 16px 100px' }}>

        {/* ── My Rivals Tab ─────────────────────────────────────────────────── */}
        {tab === 'rivals' && (
          loading ? (
            <div style={{ display: 'flex', justifyContent: 'center', paddingTop: 40 }}>
              <div style={{ width: 28, height: 28, border: '2px solid transparent', borderTopColor: 'var(--gold-primary)', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
              <style>{'@keyframes spin{to{transform:rotate(360deg)}}'}</style>
            </div>
          ) : rivalries.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '60px 0' }}>
              <div style={{ fontSize: 52, marginBottom: 16 }}>⚡</div>
              <p className="font-display" style={{ fontSize: 16, color: 'var(--text-secondary)', marginBottom: 8 }}>{t('rivals.noRivals')}</p>
              <p style={{ fontSize: 13, color: 'var(--text-muted)', lineHeight: 1.6, fontFamily: 'Crimson Text, serif', maxWidth: 260, margin: '0 auto 20px' }}>
                {t('rivals.noRivalsText')}
              </p>
              <button onClick={() => setTab('suggested')} style={{ padding: '10px 24px', borderRadius: 10, border: 'none', background: 'linear-gradient(135deg, var(--gold-dim), var(--gold-primary))', color: 'var(--text-inverse)', fontFamily: 'var(--font-display)', fontSize: 10, fontWeight: 700, letterSpacing: 1, cursor: 'pointer' }}>
                VORSCHLÄGE SEHEN
              </button>
            </div>
          ) : rivalries.map((r: any) => {
            const intensity = r.rivalry_intensity || 0
            const isHeated  = intensity >= 50
            return (
              <div key={r.id} style={{ background: 'var(--bg-surface)', borderRadius: 14, border: `1px solid ${isHeated ? 'rgba(255,184,0,0.25)' : 'var(--border-subtle)'}`, padding: '16px', marginBottom: 10 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
                  <ProfileImage
                    size={48}
                    avatarUrl={r.rival?.avatar_url}
                    name={r.rival?.username}
                    onClick={() => router.push(`/app/profile/${r.rival?.username}`)}
                  />
                  <div style={{ flex: 1, cursor: 'pointer' }} onClick={() => router.push(`/app/profile/${r.rival?.username}`)}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span className="font-display" style={{ fontSize: 13, color: 'var(--text-primary)' }}>@{r.rival?.username}</span>
                      {isHeated && <span style={{ fontSize: 11 }}>🔥</span>}
                    </div>
                    <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>Level {r.rival?.level || 1}</span>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <span className="font-display" style={{ fontSize: 14, color: 'var(--status-active)' }}>{r.wins || 0}W</span>
                    <span style={{ fontSize: 13, color: 'var(--text-muted)', margin: '0 4px' }}>/</span>
                    <span className="font-display" style={{ fontSize: 14, color: 'var(--status-error)' }}>{r.losses || 0}L</span>
                  </div>
                </div>
                {/* Intensity bar */}
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                    <span className="font-display" style={{ fontSize: 8, letterSpacing: 1, color: 'var(--text-muted)' }}>INTENSITÄT</span>
                    <span className="font-display" style={{ fontSize: 8, color: isHeated ? 'var(--gold-primary)' : 'var(--text-muted)' }}>{intensity}/100</span>
                  </div>
                  <div style={{ height: 3, background: 'var(--border-subtle)', borderRadius: 2, overflow: 'hidden' }}>
                    <div style={{ height: '100%', width: `${intensity}%`, background: isHeated ? 'linear-gradient(90deg, var(--gold-dim), var(--gold-primary))' : 'var(--status-info)', borderRadius: 2, transition: 'width 0.5s' }} />
                  </div>
                </div>
              </div>
            )
          })
        )}

        {/* ── Suggested Rivals Tab ───────────────────────────────────────────── */}
        {tab === 'suggested' && (
          loading ? (
            <div style={{ display: 'flex', justifyContent: 'center', paddingTop: 40 }}>
              <div style={{ width: 28, height: 28, border: '2px solid transparent', borderTopColor: 'var(--gold-primary)', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
              <style>{'@keyframes spin{to{transform:rotate(360deg)}}'}</style>
            </div>
          ) : (
            <>
              <p style={{ fontSize: 13, color: 'var(--text-muted)', fontFamily: 'Crimson Text, serif', marginBottom: 16 }}>
                {lang === 'de' ? 'Basierend auf deinem Netzwerk & aktiven Spielern' : 'Based on your network & active players'}
              </p>
              {suggested.map((u: any) => (
                <div key={u.id} style={{ background: 'var(--bg-surface)', borderRadius: 14, border: '1px solid var(--border-subtle)', padding: '14px 16px', marginBottom: 10, display: 'flex', alignItems: 'center', gap: 12 }}>
                  <ProfileImage
                    size={46}
                    avatarUrl={u.avatar_url}
                    name={u.username}
                    onClick={() => router.push(`/app/profile/${u.username}`)}
                  />
                  <div style={{ flex: 1, minWidth: 0, cursor: 'pointer' }} onClick={() => router.push(`/app/profile/${u.username}`)}>
                    <p style={{ fontSize: 13, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {u.display_name || u.username}
                    </p>
                    <p style={{ fontSize: 11, color: 'var(--text-secondary)' }}>
                      @{u.username} · Lv.{u.level} · {u.wins || 0}W
                      {u.mutualCount > 0 && ` · ${u.mutualCount} gem. Freunde`}
                    </p>
                  </div>
                  <button
                    onClick={() => isAlreadyRival(u.id) ? null : addRival(u.id)}
                    disabled={isAlreadyRival(u.id)}
                    style={{
                      padding: '8px 14px', borderRadius: 8, cursor: isAlreadyRival(u.id) ? 'default' : 'pointer',
                      border: isAlreadyRival(u.id) ? '1px solid rgba(74,222,128,0.25)' : 'none',
                      background: isAlreadyRival(u.id) ? 'transparent' : 'linear-gradient(135deg, var(--gold-dim), var(--gold-primary))',
                      color: isAlreadyRival(u.id) ? 'var(--status-active)' : 'var(--text-inverse)',
                      fontFamily: 'var(--font-display)', fontSize: 9, fontWeight: 700, letterSpacing: 1, flexShrink: 0,
                    }}
                  >
                    {isAlreadyRival(u.id) ? '✓ RIVAL' : '+ RIVAL'}
                  </button>
                </div>
              ))}
            </>
          )
        )}
      </div>

      {/* ── Add Rival Sheet ────────────────────────────────────────────────── */}
      {addOpen && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.85)', display: 'flex', alignItems: 'flex-end', zIndex: 200 }} onClick={() => setAddOpen(false)}>
          <div style={{ width: '100%', maxWidth: 430, margin: '0 auto', background: 'var(--bg-surface)', borderRadius: '20px 20px 0 0', border: '1px solid rgba(255,184,0,0.15)', padding: '24px 20px 48px' }} onClick={e => e.stopPropagation()}>
            <div style={{ width: 36, height: 4, background: 'rgba(255,255,255,0.15)', borderRadius: 2, margin: '0 auto 20px' }} />
            <h3 className="font-display" style={{ fontSize: 16, color: 'var(--gold-primary)', textAlign: 'center', marginBottom: 16 }}>RIVAL HINZUFÜGEN</h3>
            <input
              value={search}
              onChange={e => { setSearch(e.target.value); searchUsers(e.target.value) }}
              placeholder={t('rivals.searchPlaceholder')}
              style={{ width: '100%', padding: '13px 16px', background: 'var(--bg-elevated)', border: '1px solid rgba(255,184,0,0.15)', borderRadius: 10, color: 'var(--text-primary)', fontSize: 15, outline: 'none', marginBottom: 12, boxSizing: 'border-box' }}
              autoFocus
            />
            {searchRes.map((u: any) => (
              <div key={u.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 0', borderBottom: '1px solid var(--border-subtle)' }}>
                <div>
                  <p style={{ color: 'var(--text-primary)', fontSize: 14 }}>{u.display_name || u.username}</p>
                  <p style={{ color: 'var(--text-secondary)', fontSize: 12 }}>@{u.username} · Lv.{u.level}</p>
                </div>
                <button
                  onClick={() => addRival(u.id)}
                  disabled={isAlreadyRival(u.id)}
                  style={{ padding: '8px 14px', borderRadius: 8, border: 'none', cursor: isAlreadyRival(u.id) ? 'default' : 'pointer', background: isAlreadyRival(u.id) ? 'rgba(74,222,128,0.1)' : 'linear-gradient(135deg, var(--gold-dim), var(--gold-primary))', color: isAlreadyRival(u.id) ? 'var(--status-active)' : 'var(--text-inverse)', fontFamily: 'var(--font-display)', fontSize: 9, fontWeight: 700, letterSpacing: 1 }}
                >
                  {isAlreadyRival(u.id) ? '✓ RIVAL' : '+ RIVAL'}
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
