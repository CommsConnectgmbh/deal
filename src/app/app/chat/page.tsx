'use client'
import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/contexts/AuthContext'
import { supabase } from '@/lib/supabase'

interface ConvoRow {
  id: string
  other: { id: string; username: string; display_name: string; level: number }
  last_message_preview: string | null
  last_message_at: string
  unread: number
}

function timeAgo(iso: string, lang = 'de'): string {
  const diff = Date.now() - new Date(iso).getTime()
  const m = Math.floor(diff / 60000)
  if (m < 1)   return lang === 'de' ? 'Jetzt'      : 'Now'
  if (m < 60)  return `${m}m`
  const h = Math.floor(m / 60)
  if (h < 24)  return `${h}h`
  return `${Math.floor(h / 24)}d`
}

export default function ChatInboxPage() {
  const { profile } = useAuth()
  const router = useRouter()
  const [convos, setConvos] = useState<ConvoRow[]>([])
  const [loading, setLoading] = useState(true)

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
    const { data: others } = await supabase
      .from('profiles')
      .select('id, username, display_name, level')
      .in('id', uniqueOther)

    const otherMap: Record<string, any> = {}
    for (const o of (others || [])) otherMap[o.id] = o

    setConvos(data.map((c: any) => {
      const otherId = c.participant_1 === profile.id ? c.participant_2 : c.participant_1
      const isP1    = c.participant_1 === profile.id
      return {
        id: c.id,
        other: otherMap[otherId] || { id: otherId, username: '?', display_name: '?', level: 1 },
        last_message_preview: c.last_message_preview,
        last_message_at: c.last_message_at,
        unread: isP1 ? (c.unread_1 || 0) : (c.unread_2 || 0),
      }
    }))
    setLoading(false)
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

  const initials = (u: any) =>
    (u.display_name || u.username || 'U').slice(0, 2).toUpperCase()

  return (
    <div style={{ minHeight: '100dvh', background: '#060606', paddingTop: 60, paddingBottom: 100 }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '0 20px 20px' }}>
        <button onClick={() => router.back()} style={{ background: 'none', border: 'none', color: 'rgba(240,236,228,0.5)', fontSize: 20, cursor: 'pointer', padding: 0 }}>←</button>
        <h1 className="font-display" style={{ fontSize: 22, color: '#f0ece4', letterSpacing: 1 }}>NACHRICHTEN</h1>
      </div>

      {loading ? (
        <div style={{ display: 'flex', justifyContent: 'center', paddingTop: 60 }}>
          <div style={{ width: 28, height: 28, border: '2px solid transparent', borderTopColor: '#FFB800', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
          <style>{'@keyframes spin{to{transform:rotate(360deg)}}'}</style>
        </div>
      ) : convos.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '80px 32px' }}>
          <div style={{ fontSize: 52, marginBottom: 16 }}>💬</div>
          <p className="font-display" style={{ fontSize: 16, color: 'rgba(240,236,228,0.4)', marginBottom: 8 }}>KEINE NACHRICHTEN</p>
          <p style={{ fontSize: 13, color: 'rgba(240,236,228,0.25)', lineHeight: 1.6, fontFamily: 'Crimson Text, serif' }}>
            Besuche ein Profil und tippe auf "Nachricht" um ein Gespräch zu starten.
          </p>
        </div>
      ) : (
        <div style={{ padding: '0 16px' }}>
          {convos.map(c => (
            <div
              key={c.id}
              onClick={() => router.push(`/app/chat/${c.id}`)}
              style={{
                display: 'flex', alignItems: 'center', gap: 12,
                padding: '14px 16px', borderRadius: 14, marginBottom: 8,
                background: c.unread > 0 ? 'rgba(255,184,0,0.06)' : '#111',
                border: c.unread > 0 ? '1px solid rgba(255,184,0,0.15)' : '1px solid rgba(255,255,255,0.05)',
                cursor: 'pointer',
              }}
            >
              {/* Avatar */}
              <div style={{
                width: 48, height: 48, borderRadius: '50%', flexShrink: 0,
                background: 'linear-gradient(135deg, #CC8800, #FFB800)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                position: 'relative',
              }}>
                <span className="font-display" style={{ fontSize: 16, color: '#000', fontWeight: 700 }}>
                  {initials(c.other)}
                </span>
                {c.unread > 0 && (
                  <div style={{
                    position: 'absolute', top: -2, right: -2,
                    width: 18, height: 18, borderRadius: '50%',
                    background: '#FFB800', border: '2px solid #060606',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}>
                    <span style={{ fontSize: 9, fontWeight: 700, color: '#000', fontFamily: 'Cinzel, serif' }}>
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
                    color: c.unread > 0 ? '#f0ece4' : 'rgba(240,236,228,0.8)',
                    overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                  }}>
                    {c.other.display_name || c.other.username}
                  </span>
                  <span style={{ fontSize: 11, color: 'rgba(240,236,228,0.3)', flexShrink: 0, marginLeft: 8 }}>
                    {timeAgo(c.last_message_at)}
                  </span>
                </div>
                <p style={{
                  fontSize: 12, color: c.unread > 0 ? 'rgba(240,236,228,0.6)' : 'rgba(240,236,228,0.35)',
                  overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                  fontFamily: 'Crimson Text, serif',
                }}>
                  {c.last_message_preview || '…'}
                </p>
              </div>

              {/* Chevron */}
              <span style={{ color: 'rgba(240,236,228,0.2)', fontSize: 16, flexShrink: 0 }}>›</span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}