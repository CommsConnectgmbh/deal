'use client'
import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/contexts/AuthContext'
import { supabase } from '@/lib/supabase'

interface Notif {
  id: string
  type: string
  title: string
  body: string | null
  reference_id: string | null
  read: boolean
  created_at: string
}

const TYPE_ICON: Record<string, string> = {
  follow_request:  '🤝',
  follow_accepted: '✅',
  new_message:     '💬',
  deal_request:    '🤝',
  deal_update:     '📋',
  level_up:        '⬆️',
  default:         '🔔',
}

const TYPE_COLOR: Record<string, string> = {
  follow_request:  '#60A5FA',
  follow_accepted: '#4ade80',
  new_message:     '#FFB800',
  deal_request:    '#FB923C',
  deal_update:     '#A78BFA',
  level_up:        '#FFB800',
  default:         '#9CA3AF',
}

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const m = Math.floor(diff / 60000)
  if (m < 1)   return 'Jetzt'
  if (m < 60)  return `${m}m`
  const h = Math.floor(m / 60)
  if (h < 24)  return `${h}h`
  return `${Math.floor(h / 24)}d`
}

export default function NotificationsPage() {
  const { profile } = useAuth()
  const router = useRouter()
  const [notifs, setNotifs] = useState<Notif[]>([])
  const [loading, setLoading] = useState(true)

  const fetchNotifs = useCallback(async () => {
    if (!profile) return
    const { data } = await supabase
      .from('notifications')
      .select('*')
      .eq('user_id', profile.id)
      .order('created_at', { ascending: false })
      .limit(50)
    setNotifs(data || [])
    setLoading(false)
    // Mark all as read
    await supabase
      .from('notifications')
      .update({ read: true })
      .eq('user_id', profile.id)
      .eq('read', false)
  }, [profile])

  useEffect(() => { fetchNotifs() }, [fetchNotifs])

  // Realtime
  useEffect(() => {
    if (!profile) return
    const ch = supabase
      .channel('notifs_rt')
      .on('postgres_changes', {
        event: 'INSERT', schema: 'public', table: 'notifications',
        filter: `user_id=eq.${profile.id}`,
      }, (p) => {
        setNotifs(prev => [p.new as Notif, ...prev])
      })
      .subscribe()
    return () => { supabase.removeChannel(ch) }
  }, [profile])

  const handleNotifTap = (n: Notif) => {
    if (n.type === 'new_message' && n.reference_id)     router.push(`/app/chat/${n.reference_id}`)
    else if (n.type === 'follow_request')                router.push('/app/profile')
    else if (n.type === 'follow_accepted' && n.reference_id) router.push(`/app/profile/${n.reference_id}`)
    else if ((n.type === 'deal_request' || n.type === 'deal_update') && n.reference_id) router.push(`/app/deals/${n.reference_id}`)
  }

  const handleFollowRequest = async (n: Notif, action: 'accept' | 'decline') => {
    if (!profile || !n.reference_id) return
    if (action === 'accept') {
      await supabase.from('follows')
        .update({ status: 'accepted' })
        .eq('follower_id', n.reference_id)
        .eq('following_id', profile.id)
      // Notify requester
      await supabase.from('notifications').insert({
        user_id: n.reference_id,
        type: 'follow_accepted',
        title: profile.display_name || profile.username || '',
        body: 'hat deine Anfrage angenommen',
        reference_id: profile.username,
      })
    } else {
      await supabase.from('follows')
        .delete()
        .eq('follower_id', n.reference_id)
        .eq('following_id', profile.id)
    }
    await supabase.from('notifications').delete().eq('id', n.id)
    setNotifs(prev => prev.filter(x => x.id !== n.id))
  }

  return (
    <div style={{ minHeight: '100dvh', background: '#060606', paddingTop: 60, paddingBottom: 100 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '0 20px 20px' }}>
        <button onClick={() => router.back()} style={{ background: 'none', border: 'none', color: 'rgba(240,236,228,0.5)', fontSize: 20, cursor: 'pointer', padding: 0 }}>←</button>
        <h1 className="font-display" style={{ fontSize: 22, color: '#f0ece4', letterSpacing: 1 }}>BENACHRICHTIGUNGEN</h1>
      </div>

      {loading ? (
        <div style={{ display: 'flex', justifyContent: 'center', paddingTop: 60 }}>
          <div style={{ width: 28, height: 28, border: '2px solid transparent', borderTopColor: '#FFB800', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
          <style>{'@keyframes spin{to{transform:rotate(360deg)}}'}</style>
        </div>
      ) : notifs.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '80px 32px' }}>
          <div style={{ fontSize: 52, marginBottom: 16 }}>🔔</div>
          <p className="font-display" style={{ fontSize: 16, color: 'rgba(240,236,228,0.4)', marginBottom: 8 }}>KEINE BENACHRICHTIGUNGEN</p>
          <p style={{ fontSize: 13, color: 'rgba(240,236,228,0.25)', fontFamily: 'Crimson Text, serif' }}>
            Du bist auf dem aktuellsten Stand.
          </p>
        </div>
      ) : (
        <div style={{ padding: '0 16px' }}>
          {notifs.map(n => {
            const icon  = TYPE_ICON[n.type]  || TYPE_ICON.default
            const color = TYPE_COLOR[n.type] || TYPE_COLOR.default
            const isFollowRequest = n.type === 'follow_request'

            return (
              <div
                key={n.id}
                onClick={() => !isFollowRequest && handleNotifTap(n)}
                style={{
                  display: 'flex', alignItems: 'flex-start', gap: 12,
                  padding: '14px 16px', borderRadius: 14, marginBottom: 8,
                  background: !n.read ? `${color}08` : '#111',
                  border: !n.read ? `1px solid ${color}25` : '1px solid rgba(255,255,255,0.05)',
                  cursor: isFollowRequest ? 'default' : 'pointer',
                }}
              >
                {/* Icon */}
                <div style={{
                  width: 40, height: 40, borderRadius: '50%', flexShrink: 0,
                  background: `${color}18`, border: `1px solid ${color}30`,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 18,
                }}>
                  {icon}
                </div>

                {/* Text */}
                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 2 }}>
                    <span style={{ fontSize: 13, color: '#f0ece4', fontWeight: !n.read ? 600 : 400 }}>
                      {n.title}
                    </span>
                    <span style={{ fontSize: 10, color: 'rgba(240,236,228,0.3)', flexShrink: 0, marginLeft: 8 }}>
                      {timeAgo(n.created_at)}
                    </span>
                  </div>
                  {n.body && (
                    <p style={{ fontSize: 12, color: 'rgba(240,236,228,0.5)', fontFamily: 'Crimson Text, serif', lineHeight: 1.4 }}>
                      {n.body}
                    </p>
                  )}
                  {/* Follow request actions */}
                  {isFollowRequest && (
                    <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
                      <button
                        onClick={() => handleFollowRequest(n, 'accept')}
                        style={{
                          padding: '7px 16px', borderRadius: 8, border: 'none', cursor: 'pointer',
                          background: 'linear-gradient(135deg, #CC8800, #FFB800)',
                          color: '#000', fontFamily: 'Cinzel, serif', fontSize: 9, fontWeight: 700, letterSpacing: 1,
                        }}
                      >ANNEHMEN</button>
                      <button
                        onClick={() => handleFollowRequest(n, 'decline')}
                        style={{
                          padding: '7px 16px', borderRadius: 8, cursor: 'pointer',
                          background: 'transparent', border: '1px solid rgba(255,255,255,0.1)',
                          color: 'rgba(240,236,228,0.4)', fontFamily: 'Cinzel, serif', fontSize: 9, letterSpacing: 1,
                        }}
                      >ABLEHNEN</button>
                    </div>
                  )}
                </div>
                {!n.read && (
                  <div style={{ width: 7, height: 7, borderRadius: '50%', background: color, flexShrink: 0, marginTop: 4 }} />
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
