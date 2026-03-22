'use client'
import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/contexts/AuthContext'
import { supabase } from '@/lib/supabase'
import ProfileImage from '@/components/ProfileImage'

interface ConvoRow {
  id: string
  other: { id: string; username: string; display_name: string; level: number; avatar_url?: string }
  last_message_preview: string | null
  last_message_at: string
  unread: number
  isOnline: boolean
}

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const m = Math.floor(diff / 60000)
  if (m < 1)  return 'Jetzt'
  if (m < 60) return `${m}m`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}h`
  return `${Math.floor(h / 24)}d`
}

export default function ChatInboxPage() {
  const { profile } = useAuth()
  const router = useRouter()
  const [convos, setConvos] = useState<ConvoRow[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [userResults, setUserResults] = useState<{id: string; username: string; display_name: string; level: number; avatar_url?: string}[]>([])

  const fetchConvos = useCallback(async () => {
    if (!profile) return
    const { data } = await supabase
      .from('conversations')
      .select('id, participant_1, participant_2, last_message_preview, last_message_at, unread_1, unread_2')
      .or(`participant_1.eq.${profile.id},participant_2.eq.${profile.id}`)
      .order('last_message_at', { ascending: false })

    if (!data) { setLoading(false); return }

    const otherIds = data.map((c: any) =>
      c.participant_1 === profile.id ? c.participant_2 : c.participant_1
    )
    const uniqueOther = [...new Set(otherIds)]

    const [profilesRes, presenceRes] = await Promise.all([
      supabase.from('profiles').select('id, username, display_name, level, avatar_url').in('id', uniqueOther),
      supabase.from('user_presence').select('user_id, is_online').in('user_id', uniqueOther),
    ])

    const otherMap: Record<string, any> = {}
    for (const o of (profilesRes.data || [])) otherMap[o.id] = o

    const presenceMap: Record<string, boolean> = {}
    for (const p of (presenceRes.data || [])) presenceMap[p.user_id] = p.is_online

    setConvos(data.map((c: any) => {
      const otherId = c.participant_1 === profile.id ? c.participant_2 : c.participant_1
      const isP1 = c.participant_1 === profile.id
      return {
        id: c.id,
        other: otherMap[otherId] || { id: otherId, username: '?', display_name: '?', level: 1 },
        last_message_preview: c.last_message_preview,
        last_message_at: c.last_message_at,
        unread: isP1 ? (c.unread_1 || 0) : (c.unread_2 || 0),
        isOnline: presenceMap[otherId] || false,
      }
    }))
    setLoading(false)
  }, [profile])

  const searchUsers = useCallback(async (q: string) => {
    if (!q.trim() || !profile) { setUserResults([]); return }
    const { data } = await supabase
      .from('profiles')
      .select('id, username, display_name, level, avatar_url')
      .or(`username.ilike.%${q}%,display_name.ilike.%${q}%`)
      .neq('id', profile.id)
      .limit(8)
    setUserResults(data || [])
  }, [profile])

  useEffect(() => { fetchConvos() }, [fetchConvos])

  // Realtime: new message → refresh list
  useEffect(() => {
    if (!profile) return
    const ch = supabase
      .channel('inbox_realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'conversations' }, fetchConvos)
      .subscribe()
    return () => { supabase.removeChannel(ch) }
  }, [profile, fetchConvos])

  return (
    <div style={{ minHeight: '100dvh', background: 'var(--bg-base)', paddingTop: 60, paddingBottom: 100 }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 20px 20px' }}>
        <h1 className="font-display" style={{ fontSize: 22, color: 'var(--text-primary)', letterSpacing: 1 }}>NACHRICHTEN</h1>
        <button
          onClick={() => router.push('/app/discover')}
          style={{
            width: 36, height: 36, borderRadius: 10,
            background: 'var(--gold-subtle)', border: '1px solid var(--gold-glow)',
            cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 16, color: 'var(--gold-primary)',
          }}
        >
          {'\u{270F}\u{FE0F}'}
        </button>
      </div>

      {/* Search */}
      <div style={{ padding: '0 16px 12px' }}>
        <input
          type="text"
          placeholder="🔍 Suchen..."
          value={search}
          onChange={(e) => { setSearch(e.target.value); searchUsers(e.target.value) }}
          style={{
            width: '100%', padding: '10px 16px', background: 'var(--bg-elevated)',
            border: '1px solid var(--border-subtle)', borderRadius: 12,
            color: 'var(--text-primary)', fontSize: 14, outline: 'none',
            fontFamily: 'var(--font-body)', boxSizing: 'border-box',
          }}
        />
      </div>

      {/* Online users from conversations */}
      {!search && convos.filter(c => c.isOnline).length > 0 && (
        <div style={{ padding: '0 16px 16px' }}>
          <p style={{ fontFamily: 'var(--font-display)', fontSize: 9, letterSpacing: 2, color: 'var(--text-muted)', marginBottom: 8 }}>ONLINE</p>
          <div style={{ display: 'flex', gap: 14, overflowX: 'auto', paddingBottom: 4, WebkitOverflowScrolling: 'touch' as any, scrollbarWidth: 'none' as any }}>
            {convos.filter(c => c.isOnline).map(c => (
              <div
                key={`online-${c.id}`}
                onClick={() => router.push(`/app/chat/${c.id}`)}
                style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, flexShrink: 0, cursor: 'pointer' }}
              >
                <ProfileImage
                  size={48}
                  avatarUrl={c.other.avatar_url}
                  name={c.other.username}
                  online={true}
                />
                <span style={{ fontSize: 10, color: 'var(--text-secondary)', maxWidth: 56, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', textAlign: 'center' }}>
                  {c.other.display_name?.split(' ')[0] || c.other.username}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {loading ? (
        <div style={{ display: 'flex', justifyContent: 'center', paddingTop: 60 }}>
          <div style={{ width: 28, height: 28, border: '2px solid transparent', borderTopColor: 'var(--gold-primary)', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
          <style>{'@keyframes spin{to{transform:rotate(360deg)}}'}</style>
        </div>
      ) : convos.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '80px 32px' }}>
          <div style={{ fontSize: 52, marginBottom: 16 }}>💬</div>
          <p className="font-display" style={{ fontSize: 16, color: 'var(--text-secondary)', marginBottom: 8 }}>KEINE NACHRICHTEN</p>
          <p style={{ fontSize: 13, color: 'var(--text-muted)', lineHeight: 1.6, fontFamily: 'Crimson Text, serif' }}>
            Besuche ein Profil und tippe auf &quot;Nachricht&quot; um ein Gespräch zu starten.
          </p>
        </div>
      ) : (
        <div style={{ padding: '0 16px' }}>
          {convos.filter(c => !search || c.other?.username?.toLowerCase().includes(search.toLowerCase()) || c.other?.display_name?.toLowerCase().includes(search.toLowerCase())).map(c => (
            <div
              key={c.id}
              onClick={() => router.push(`/app/chat/${c.id}`)}
              style={{
                display: 'flex', alignItems: 'center', gap: 12,
                padding: '14px 16px', borderRadius: 14, marginBottom: 8,
                background: c.unread > 0 ? 'var(--gold-subtle)' : 'var(--bg-surface)',
                border: c.unread > 0 ? '1px solid var(--gold-glow)' : '1px solid var(--border-subtle)',
                cursor: 'pointer',
              }}
            >
              {/* Avatar with online indicator */}
              <div style={{ position: 'relative', flexShrink: 0 }}>
                <ProfileImage
                  size={48}
                  avatarUrl={c.other.avatar_url}
                  name={c.other.username}
                  online={c.isOnline}
                />
                {c.unread > 0 && (
                  <div style={{
                    position: 'absolute', top: -2, right: -2,
                    width: 18, height: 18, borderRadius: '50%',
                    background: 'var(--gold-primary)', border: '2px solid var(--bg-base)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}>
                    <span style={{ fontSize: 9, fontWeight: 700, color: 'var(--text-inverse)', fontFamily: 'var(--font-display)' }}>
                      {c.unread > 9 ? '9+' : c.unread}
                    </span>
                  </div>
                )}
              </div>

              {/* Text */}
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 3 }}>
                  <span style={{
                    fontSize: 14, fontWeight: c.unread > 0 ? 700 : 400,
                    color: c.unread > 0 ? 'var(--text-primary)' : 'var(--text-primary)',
                    overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                  }}>
                    {c.other.display_name || c.other.username}
                  </span>
                  <span style={{ fontSize: 11, color: 'var(--text-muted)', flexShrink: 0, marginLeft: 8 }}>
                    {timeAgo(c.last_message_at)}
                  </span>
                </div>
                <p style={{
                  fontSize: 12, color: c.unread > 0 ? 'var(--text-secondary)' : 'var(--text-muted)',
                  overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                  fontFamily: 'Crimson Text, serif',
                }}>
                  {c.last_message_preview || '…'}
                </p>
              </div>

              {/* Chevron */}
              <span style={{ color: 'var(--text-muted)', fontSize: 16, flexShrink: 0 }}>›</span>
            </div>
          ))}
        </div>
      )}

      {/* User search results (for starting new conversations) */}
      {search.trim() && userResults.length > 0 && (
        <div style={{ padding: '8px 16px' }}>
          <p style={{ fontFamily: 'var(--font-display)', fontSize: 9, letterSpacing: 2, color: 'var(--text-muted)', marginBottom: 8 }}>NUTZER</p>
          {userResults
            .filter(u => !convos.some(c => c.other.id === u.id))
            .map(u => (
              <div
                key={u.id}
                onClick={() => router.push(`/app/profile/${u.username}`)}
                style={{
                  display: 'flex', alignItems: 'center', gap: 12,
                  padding: '12px 16px', borderRadius: 12, marginBottom: 8,
                  background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)',
                  cursor: 'pointer',
                }}
              >
                <ProfileImage size={40} avatarUrl={u.avatar_url} name={u.username} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {u.display_name || u.username}
                  </p>
                  <p style={{ fontSize: 11, color: 'var(--text-muted)' }}>@{u.username} {'\u00B7'} Lv.{u.level}</p>
                </div>
                <span style={{ fontFamily: 'var(--font-display)', fontSize: 9, color: 'var(--gold-primary)', letterSpacing: 1 }}>NACHRICHT</span>
              </div>
            ))}
        </div>
      )}
    </div>
  )
}
