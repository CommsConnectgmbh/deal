'use client'
import { useState, useEffect, useCallback } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { useAuth } from '@/contexts/AuthContext'
import { useLang } from '@/contexts/LanguageContext'
import { supabase } from '@/lib/supabase'
import AvatarDisplay, { AvatarConfig } from '@/components/AvatarDisplay'

type FollowStatus = 'none' | 'pending' | 'accepted'
type Modal = null | 'followers' | 'following' | 'options' | 'report'

interface FollowUser {
  id: string; username: string; display_name: string; level: number
}

function timeAgo(iso: string) {
  const d = Date.now() - new Date(iso).getTime()
  const m = Math.floor(d / 60000)
  if (m < 1)  return 'Gerade eben'
  if (m < 60) return `vor ${m}m`
  const h = Math.floor(m / 60)
  if (h < 24) return `vor ${h}h`
  return `vor ${Math.floor(h / 24)}d`
}

export default function PublicProfilePage() {
  const { username } = useParams<{ username: string }>()
  const { profile: me } = useAuth()
  const { lang } = useLang()
  const router = useRouter()

  const [user,         setUser]         = useState<any>(null)
  const [avatarConfig, setAvatarConfig] = useState<AvatarConfig | null>(null)
  const [followStatus, setFollowStatus] = useState<FollowStatus>('none')
  const [theirStatus,  setTheirStatus]  = useState<FollowStatus>('none')
  const [isBlocked,    setIsBlocked]    = useState(false)
  const [activity,     setActivity]     = useState<any[]>([])
  const [modal,        setModal]        = useState<Modal>(null)
  const [modalList,    setModalList]    = useState<FollowUser[]>([])
  const [loading,      setLoading]      = useState(true)
  const [fwLoading,    setFwLoading]    = useState(false)
  const [reportMsg,    setReportMsg]    = useState('')
  const [reportSent,   setReportSent]   = useState(false)

  const fetchUser = useCallback(async () => {
    if (!me) return
    setLoading(true)
    const { data: u } = await supabase.from('profiles').select('*').eq('username', username).single()
    if (!u) { setLoading(false); return }
    if (u.id === me.id) { router.replace('/app/profile'); return }
    setUser(u)
    const [fwd, bwd, blocked, avatarRes, actRes] = await Promise.all([
      supabase.from('follows').select('status').eq('follower_id', me.id).eq('following_id', u.id).single(),
      supabase.from('follows').select('status').eq('follower_id', u.id).eq('following_id', me.id).single(),
      supabase.from('blocked_users').select('blocker_id').eq('blocker_id', me.id).eq('blocked_id', u.id).single(),
      supabase.from('avatar_config').select('*').eq('user_id', u.id).single(),
      supabase.from('deal_actions').select('action, created_at, deal:deal_id(title, winner_id)').eq('user_id', u.id).order('created_at', { ascending: false }).limit(8),
    ])
    setFollowStatus((fwd.data?.status as FollowStatus) || 'none')
    setTheirStatus((bwd.data?.status as FollowStatus) || 'none')
    setIsBlocked(!!blocked.data)
    if (avatarRes.data) setAvatarConfig({ body: avatarRes.data.body, hair: avatarRes.data.hair, outfit: avatarRes.data.outfit, accessory: avatarRes.data.accessory })
    setActivity(actRes.data || [])
    setLoading(false)
  }, [me, username, router])

  useEffect(() => { fetchUser() }, [fetchUser])

  const follow = async () => {
    if (!user || !me) return
    setFwLoading(true)
    const status: FollowStatus = user.is_private ? 'pending' : 'accepted'
    await supabase.from('follows').upsert({ follower_id: me.id, following_id: user.id, status }, { onConflict: 'follower_id,following_id' })
    try {
      await supabase.from('notifications').insert({
        user_id: user.id,
        type: user.is_private ? 'follow_request' : 'follow_accepted',
        title: me.display_name || me.username || '',
        body: user.is_private ? 'möchte dir folgen' : 'folgt dir jetzt',
        reference_id: user.is_private ? me.id : me.username,
      })
    } catch {}
    setFollowStatus(status)
    setFwLoading(false)
  }

  const unfollow = async () => {
    if (!user || !me) return
    setFwLoading(true)
    await supabase.from('follows').delete().eq('follower_id', me.id).eq('following_id', user.id)
    setFollowStatus('none')
    setFwLoading(false)
  }

  const startDM = async () => {
    if (!user || !me) return
    const [p1, p2] = [me.id, user.id].sort()
    const { data } = await supabase
      .from('conversations')
      .upsert({ participant_1: p1, participant_2: p2 }, { onConflict: 'participant_1,participant_2' })
      .select('id').single()
    if (data) router.push(`/app/chat/${data.id}`)
  }

  const blockUser = async () => {
    if (!user || !me) return
    await supabase.from('blocked_users').upsert({ blocker_id: me.id, blocked_id: user.id })
    await supabase.from('follows').delete().or(`and(follower_id.eq.${me.id},following_id.eq.${user.id}),and(follower_id.eq.${user.id},following_id.eq.${me.id})`)
    setIsBlocked(true); setModal(null)
  }

  const sendReport = async () => {
    if (!user || !me || !reportMsg.trim()) return
    await supabase.from('notifications').insert({ user_id: me.id, type: 'report_sent', title: `Report: @${user.username}`, body: reportMsg.slice(0, 200), reference_id: user.id })
    setReportSent(true)
  }

  const openFollowModal = async (type: 'followers' | 'following') => {
    if (!user) return
    setModal(type); setModalList([])
    const srcCol = type === 'followers' ? 'following_id' : 'follower_id'
    const resCol = type === 'followers' ? 'follower_id'  : 'following_id'
    const { data } = await supabase.from('follows').select(resCol).eq(srcCol, user.id).eq('status', 'accepted')
    if (!data?.length) return
    const ids = data.map((f: any) => f[resCol])
    const { data: profiles } = await supabase.from('profiles').select('id, username, display_name, level').in('id', ids)
    setModalList((profiles || []) as FollowUser[])
  }

  if (loading) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100dvh', background: '#060606' }}>
      <div style={{ width: 32, height: 32, border: '2px solid transparent', borderTopColor: '#FFB800', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
      <style>{'@keyframes spin{to{transform:rotate(360deg)}}'}</style>
    </div>
  )
  if (!user) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100dvh', background: '#060606' }}>
      <p style={{ color: 'rgba(240,236,228,0.4)' }}>Nutzer nicht gefunden</p>
    </div>
  )

  const canSeeContent = !user.is_private || followStatus === 'accepted'
  const isMutual      = followStatus === 'accepted' && theirStatus === 'accepted'
  const archetype     = user.primary_archetype || 'founder'
  const initials      = (user.display_name || user.username || 'U').slice(0, 2).toUpperCase()

  return (
    <div style={{ minHeight: '100dvh', background: '#060606', paddingTop: 60, paddingBottom: 60 }}>

      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 16px 16px' }}>
        <button onClick={() => router.back()} style={{ background: 'none', border: 'none', color: 'rgba(240,236,228,0.5)', fontSize: 22, cursor: 'pointer', padding: '0 4px' }}>←</button>
        <span className="font-display" style={{ fontSize: 13, color: 'rgba(240,236,228,0.6)', letterSpacing: 1 }}>@{user.username}</span>
        <button onClick={() => setModal('options')} style={{ background: 'none', border: 'none', color: 'rgba(240,236,228,0.4)', fontSize: 22, cursor: 'pointer', padding: '0 4px' }}>⋯</button>
      </div>

      {isBlocked ? (
        <div style={{ padding: '60px 32px', textAlign: 'center' }}>
          <p style={{ fontSize: 40, marginBottom: 16 }}>🚫</p>
          <p className="font-display" style={{ fontSize: 13, color: 'rgba(240,236,228,0.4)', marginBottom: 20 }}>Du hast diesen Nutzer blockiert.</p>
          <button onClick={async () => { await supabase.from('blocked_users').delete().eq('blocker_id', me!.id).eq('blocked_id', user.id); setIsBlocked(false) }} style={{ padding: '10px 24px', borderRadius: 8, border: '1px solid rgba(255,255,255,0.1)', background: 'transparent', color: 'rgba(240,236,228,0.5)', fontFamily: 'Cinzel, serif', fontSize: 10, cursor: 'pointer' }}>
            ENTBLOCKIEREN
          </button>
        </div>
      ) : (
        <>
          {/* ── Avatar + Name ───────────────────────────────────────────────── */}
          <div style={{ textAlign: 'center', padding: '0 24px 20px' }}>
            <div style={{ display: 'inline-block', marginBottom: 12 }}>
              <AvatarDisplay config={avatarConfig} archetype={archetype} size={88} initials={initials} />
            </div>
            <h2 style={{ fontSize: 20, color: '#f0ece4', fontWeight: 700, marginBottom: 3 }}>
              {user.display_name || user.username}
            </h2>
            <p style={{ fontSize: 13, color: 'rgba(240,236,228,0.4)', marginBottom: 8 }}>@{user.username}</p>
            {user.is_private && (
              <div style={{ display: 'inline-flex', alignItems: 'center', gap: 5, background: 'rgba(255,255,255,0.05)', borderRadius: 20, padding: '3px 12px', marginBottom: 8 }}>
                <span style={{ fontSize: 10 }}>🔒</span>
                <span className="font-display" style={{ fontSize: 8, color: 'rgba(240,236,228,0.4)', letterSpacing: 1 }}>PRIVAT</span>
              </div>
            )}

            {/* ── Follower / Following counts ─────────────────────────────── */}
            <div style={{ display: 'flex', justifyContent: 'center', gap: 32, margin: '12px 0 16px' }}>
              <button onClick={() => openFollowModal('followers')} style={{ background: 'none', border: 'none', cursor: 'pointer', textAlign: 'center', padding: 0 }}>
                <p className="font-display" style={{ fontSize: 20, color: '#FFB800', marginBottom: 2 }}>{user.follower_count ?? 0}</p>
                <p className="font-display" style={{ fontSize: 8, color: 'rgba(240,236,228,0.4)', letterSpacing: 1 }}>FOLLOWER</p>
              </button>
              <div style={{ width: 1, background: 'rgba(255,255,255,0.08)' }} />
              <button onClick={() => openFollowModal('following')} style={{ background: 'none', border: 'none', cursor: 'pointer', textAlign: 'center', padding: 0 }}>
                <p className="font-display" style={{ fontSize: 20, color: '#FFB800', marginBottom: 2 }}>{user.following_count ?? 0}</p>
                <p className="font-display" style={{ fontSize: 8, color: 'rgba(240,236,228,0.4)', letterSpacing: 1 }}>FOLLOWS</p>
              </button>
            </div>

            {/* ── Action buttons ──────────────────────────────────────────── */}
            <div style={{ display: 'flex', gap: 10, justifyContent: 'center' }}>
              {followStatus === 'accepted' ? (
                <button onClick={unfollow} disabled={fwLoading} style={{ padding: '11px 22px', borderRadius: 10, border: '1px solid rgba(255,255,255,0.12)', background: 'transparent', color: 'rgba(240,236,228,0.55)', fontFamily: 'Cinzel, serif', fontSize: 10, letterSpacing: 1, cursor: 'pointer' }}>
                  {fwLoading ? '···' : isMutual ? '👥 FREUNDE' : 'FOLGE ICH'}
                </button>
              ) : followStatus === 'pending' ? (
                <button disabled style={{ padding: '11px 22px', borderRadius: 10, border: '1px solid rgba(255,184,0,0.2)', background: 'rgba(255,184,0,0.06)', color: 'rgba(255,184,0,0.5)', fontFamily: 'Cinzel, serif', fontSize: 10, letterSpacing: 1 }}>
                  ANGEFRAGT ⏳
                </button>
              ) : (
                <button onClick={follow} disabled={fwLoading} style={{ padding: '11px 22px', borderRadius: 10, border: 'none', background: 'linear-gradient(135deg, #CC8800, #FFB800)', color: '#000', fontFamily: 'Cinzel, serif', fontSize: 10, fontWeight: 700, letterSpacing: 1, cursor: 'pointer' }}>
                  {fwLoading ? '···' : theirStatus === 'accepted' ? '+ ZURÜCKFOLGEN' : '+ FOLGEN'}
                </button>
              )}
              {isMutual && (
                <button onClick={startDM} style={{ padding: '11px 16px', borderRadius: 10, border: '1px solid rgba(255,184,0,0.25)', background: 'rgba(255,184,0,0.08)', color: '#FFB800', fontFamily: 'Cinzel, serif', fontSize: 14, cursor: 'pointer' }}>
                  💬
                </button>
              )}
            </div>
            {theirStatus === 'accepted' && followStatus !== 'accepted' && (
              <p style={{ fontSize: 11, color: 'rgba(240,236,228,0.35)', fontFamily: 'Crimson Text, serif', marginTop: 8 }}>Folgt dir</p>
            )}
          </div>

          {/* ── Private gate ────────────────────────────────────────────────── */}
          {!canSeeContent ? (
            <div style={{ margin: '0 24px', textAlign: 'center', padding: '32px 20px', background: '#111', borderRadius: 14, border: '1px solid rgba(255,255,255,0.05)' }}>
              <p style={{ fontSize: 32, marginBottom: 12 }}>🔒</p>
              <p style={{ fontSize: 14, color: 'rgba(240,236,228,0.4)', lineHeight: 1.6, fontFamily: 'Crimson Text, serif' }}>
                {lang === 'de' ? 'Folge diesem Konto, um Inhalte zu sehen.' : 'Follow this account to see their content.'}
              </p>
            </div>
          ) : (
            <>
              {/* Stats */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 8, margin: '0 16px 16px' }}>
                {[{ label: 'Siege', value: user.wins || 0 }, { label: 'Deals', value: user.deals_total || 0 }, { label: 'Level', value: user.level || 1 }].map(s => (
                  <div key={s.label} style={{ background: '#111', borderRadius: 12, border: '1px solid rgba(255,255,255,0.05)', padding: '14px 8px', textAlign: 'center' }}>
                    <p className="font-display" style={{ fontSize: 22, color: '#FFB800', marginBottom: 4 }}>{s.value}</p>
                    <p className="font-display" style={{ fontSize: 8, color: 'rgba(240,236,228,0.4)', letterSpacing: 1 }}>{s.label.toUpperCase()}</p>
                  </div>
                ))}
              </div>

              {/* Activity Feed */}
              {activity.length > 0 && (
                <div style={{ margin: '0 16px 16px' }}>
                  <p className="font-display" style={{ fontSize: 9, letterSpacing: 3, color: 'rgba(240,236,228,0.35)', marginBottom: 10 }}>AKTIVITÄT</p>
                  {activity.slice(0, 6).map((a: any, i: number) => (
                    <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 0', borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                      <span style={{ fontSize: 18, width: 28, textAlign: 'center' }}>
                        {a.action === 'confirm_winner' ? '🏆' : a.action === 'accept' ? '🤝' : '📋'}
                      </span>
                      <div style={{ flex: 1 }}>
                        <p style={{ fontSize: 13, color: '#f0ece4' }}>
                          {a.action === 'confirm_winner' ? 'Deal abgeschlossen' : a.action === 'accept' ? 'Deal angenommen' : 'Deal erstellt'}
                          {a.deal?.title ? ` – ${a.deal.title}` : ''}
                        </p>
                        <p style={{ fontSize: 11, color: 'rgba(240,236,228,0.35)', fontFamily: 'Crimson Text, serif' }}>{timeAgo(a.created_at)}</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}
        </>
      )}

      {/* ── Followers / Following Modal ─────────────────────────────────────── */}
      {(modal === 'followers' || modal === 'following') && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.85)', zIndex: 300, display: 'flex', alignItems: 'flex-end' }} onClick={() => setModal(null)}>
          <div style={{ width: '100%', maxWidth: 430, margin: '0 auto', background: '#111', borderRadius: '20px 20px 0 0', border: '1px solid rgba(255,255,255,0.08)', padding: '20px 20px 48px', maxHeight: '70vh', overflowY: 'auto' }} onClick={e => e.stopPropagation()}>
            <div style={{ width: 36, height: 4, background: 'rgba(255,255,255,0.15)', borderRadius: 2, margin: '0 auto 20px' }} />
            <p className="font-display" style={{ fontSize: 14, color: '#f0ece4', textAlign: 'center', marginBottom: 16, letterSpacing: 1 }}>{modal === 'followers' ? 'FOLLOWER' : 'FOLLOWS'}</p>
            {modalList.length === 0
              ? <p style={{ textAlign: 'center', color: 'rgba(240,236,228,0.3)', fontSize: 13, fontFamily: 'Crimson Text, serif', paddingTop: 20 }}>Niemand hier</p>
              : modalList.map(u => (
                <div key={u.id} onClick={() => { setModal(null); router.push(`/app/profile/${u.username}`) }} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 0', borderBottom: '1px solid rgba(255,255,255,0.05)', cursor: 'pointer' }}>
                  <div style={{ width: 40, height: 40, borderRadius: '50%', background: 'linear-gradient(135deg, #CC8800, #FFB800)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <span className="font-display" style={{ fontSize: 13, color: '#000', fontWeight: 700 }}>{(u.display_name || u.username || 'U').slice(0, 2).toUpperCase()}</span>
                  </div>
                  <div>
                    <p style={{ fontSize: 13, color: '#f0ece4' }}>{u.display_name || u.username}</p>
                    <p style={{ fontSize: 11, color: 'rgba(240,236,228,0.4)' }}>@{u.username} · Lv.{u.level}</p>
                  </div>
                </div>
              ))
            }
          </div>
        </div>
      )}

      {/* ── Options Sheet ───────────────────────────────────────────────────── */}
      {modal === 'options' && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.85)', zIndex: 300, display: 'flex', alignItems: 'flex-end' }} onClick={() => setModal(null)}>
          <div style={{ width: '100%', maxWidth: 430, margin: '0 auto', background: '#111', borderRadius: '20px 20px 0 0', border: '1px solid rgba(255,255,255,0.08)', padding: '20px 20px 48px' }} onClick={e => e.stopPropagation()}>
            <div style={{ width: 36, height: 4, background: 'rgba(255,255,255,0.15)', borderRadius: 2, margin: '0 auto 20px' }} />
            {[
              { label: '🚩 MELDEN',     action: () => { setModal('report') }, color: '#f87171' },
              { label: '🚫 BLOCKIEREN', action: blockUser,                    color: '#f87171' },
            ].map(opt => (
              <button key={opt.label} onClick={opt.action} style={{ width: '100%', padding: '14px', borderRadius: 10, border: '1px solid rgba(255,255,255,0.08)', background: 'transparent', color: opt.color, fontFamily: 'Cinzel, serif', fontSize: 11, letterSpacing: 1, cursor: 'pointer', marginBottom: 8 }}>
                {opt.label}
              </button>
            ))}
            <button onClick={() => setModal(null)} style={{ width: '100%', padding: '14px', borderRadius: 10, border: 'none', background: 'rgba(255,255,255,0.05)', color: 'rgba(240,236,228,0.45)', fontFamily: 'Cinzel, serif', fontSize: 11, letterSpacing: 1, cursor: 'pointer' }}>
              ABBRECHEN
            </button>
          </div>
        </div>
      )}

      {/* ── Report Sheet ────────────────────────────────────────────────────── */}
      {modal === 'report' && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.85)', zIndex: 300, display: 'flex', alignItems: 'flex-end' }} onClick={() => setModal(null)}>
          <div style={{ width: '100%', maxWidth: 430, margin: '0 auto', background: '#111', borderRadius: '20px 20px 0 0', border: '1px solid rgba(255,255,255,0.08)', padding: '20px 20px 48px' }} onClick={e => e.stopPropagation()}>
            <div style={{ width: 36, height: 4, background: 'rgba(255,255,255,0.15)', borderRadius: 2, margin: '0 auto 20px' }} />
            <p className="font-display" style={{ fontSize: 14, color: '#f0ece4', textAlign: 'center', marginBottom: 16 }}>MELDEN</p>
            {reportSent ? (
              <div style={{ textAlign: 'center', padding: '20px 0' }}>
                <p style={{ fontSize: 32, marginBottom: 12 }}>✅</p>
                <p style={{ color: '#4ade80', fontSize: 13 }}>Meldung eingereicht. Danke!</p>
              </div>
            ) : (
              <>
                <textarea value={reportMsg} onChange={e => setReportMsg(e.target.value)} placeholder="Warum meldest du diesen Nutzer?" rows={4} style={{ width: '100%', padding: '12px', background: '#1a1a1a', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 10, color: '#f0ece4', fontSize: 14, fontFamily: 'Crimson Text, serif', outline: 'none', resize: 'none', marginBottom: 12, boxSizing: 'border-box' }} />
                <button onClick={sendReport} disabled={!reportMsg.trim()} style={{ width: '100%', padding: '13px', borderRadius: 10, border: 'none', background: reportMsg.trim() ? 'linear-gradient(135deg, #CC8800, #FFB800)' : 'rgba(255,255,255,0.08)', color: reportMsg.trim() ? '#000' : 'rgba(240,236,228,0.3)', fontFamily: 'Cinzel, serif', fontSize: 11, fontWeight: 700, letterSpacing: 1, cursor: reportMsg.trim() ? 'pointer' : 'default' }}>
                  SENDEN
                </button>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
