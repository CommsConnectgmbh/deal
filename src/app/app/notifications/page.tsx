'use client'
import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/contexts/AuthContext'
import { supabase } from '@/lib/supabase'
import MiniEventCard from '@/components/MiniEventCard'
import { aggregateFeedEvents, type FeedEvent, type FeedEventItem } from '@/components/MiniEventCard'
import { useLang } from '@/contexts/LanguageContext'

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
  follow_request:      '🤝',
  follow_accepted:     '✅',
  new_message:         '💬',
  deal_request:        '🤝',
  deal_update:         '📋',
  deal_completed:      '🏆',
  deal_won:            '👑',
  deal_lost:           '💀',
  level_up:            '⬆️',
  battlepass_tier:     '🎖️',
  battlepass_reward:   '🎁',
  challenge_reminder:  '🎯',
  challenge_completed: '✅',
  streak_milestone:    '🔥',
  coins_received:      '🪙',
  referral_completed:  '👥',
  frame_unlocked:      '✨',
  archetype_unlocked:  '🧬',
  side_bet_won:        '💰',
  side_bet_lost:       '📉',
  fulfillment_check:   '📋',
  default:             '🔔',
}

const TYPE_COLOR: Record<string, string> = {
  follow_request:      '#60A5FA',
  follow_accepted:     '#4ade80',
  new_message:         '#FFB800',
  deal_request:        '#FB923C',
  deal_update:         '#A78BFA',
  deal_completed:      '#FFB800',
  deal_won:            '#22C55E',
  deal_lost:           '#EF4444',
  level_up:            '#FFB800',
  battlepass_tier:     '#8B5CF6',
  battlepass_reward:   '#F59E0B',
  challenge_reminder:  '#3B82F6',
  challenge_completed: '#22C55E',
  streak_milestone:    '#F97316',
  coins_received:      '#F59E0B',
  referral_completed:  '#22C55E',
  frame_unlocked:      '#A855F7',
  archetype_unlocked:  '#EC4899',
  side_bet_won:        '#22C55E',
  side_bet_lost:       '#EF4444',
  fulfillment_check:   '#FFB800',
  default:             '#9CA3AF',
}

function timeAgo(iso: string, t: (key: string) => string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const m = Math.floor(diff / 60000)
  if (m < 1)   return t('notifications.now')
  if (m < 60)  return `${m}m`
  const h = Math.floor(m / 60)
  if (h < 24)  return `${h}h`
  return `${Math.floor(h / 24)}d`
}

export default function NotificationsPage() {
  const { profile } = useAuth()
  const router = useRouter()
  const { t } = useLang()
  const [notifs, setNotifs] = useState<Notif[]>([])
  const [feedEvents, setFeedEvents] = useState<FeedEventItem[]>([])
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<'notifs' | 'activity'>('notifs')

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

  const fetchFeedEvents = useCallback(async () => {
    if (!profile) return
    const since7d = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()
    const { data } = await supabase
      .from('feed_events')
      .select('*, user:user_id(username, display_name, avatar_url)')
      .gte('created_at', since7d)
      .order('created_at', { ascending: false })
      .limit(50)
    const aggregated = aggregateFeedEvents((data || []) as FeedEvent[])
    setFeedEvents(aggregated)
  }, [profile])

  useEffect(() => { fetchNotifs(); fetchFeedEvents() }, [fetchNotifs, fetchFeedEvents])

  // Realtime
  useEffect(() => {
    if (!profile) return
    const ch = supabase
      .channel('notifs_rt')
      .on('postgres_changes', {
        event: 'INSERT', schema: 'public', table: 'notifications',
        filter: `user_id=eq.${profile.id}`,
      }, (p: any) => {
        setNotifs(prev => [p.new as Notif, ...prev])
      })
      .subscribe()
    return () => { supabase.removeChannel(ch) }
  }, [profile])

  const handleNotifTap = (n: Notif) => {
    if (n.type === 'new_message' && n.reference_id) router.push(`/app/chat/${n.reference_id}`)
    else if (n.type === 'follow_request') router.push('/app/profile')
    else if (n.type === 'follow_accepted' && n.reference_id) router.push(`/app/profile/${n.reference_id}`)
    else if (['deal_request', 'deal_update', 'deal_completed', 'deal_won', 'deal_lost'].includes(n.type) && n.reference_id) router.push(`/app/deals/${n.reference_id}`)
    else if (['battlepass_tier', 'battlepass_reward'].includes(n.type)) router.push('/app/battlepass')
    else if (['challenge_reminder', 'challenge_completed'].includes(n.type)) router.push('/app/challenges')
    else if (n.type === 'streak_milestone') router.push('/app/rewards')
    else if (['coins_received', 'side_bet_won', 'side_bet_lost'].includes(n.type) && n.reference_id) router.push(`/app/deals/${n.reference_id}`)
    else if (n.type === 'referral_completed') router.push('/app/invite')
    else if (n.type === 'fulfillment_check' && n.reference_id) router.push(`/app/deals/${n.reference_id}`)
    else if (['frame_unlocked', 'archetype_unlocked'].includes(n.type)) router.push('/app/shop')
    else if (n.type === 'level_up') router.push('/app/profile')
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
        body: t('notifications.acceptedRequest'),
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
    <div style={{ minHeight: '100dvh', background: 'var(--bg-base)', paddingTop: 60, paddingBottom: 100 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '0 20px 12px' }}>
        <button onClick={() => router.back()} style={{ background: 'none', border: 'none', color: 'var(--text-secondary)', fontSize: 20, cursor: 'pointer', padding: 0 }}>←</button>
        <h1 className="font-display" style={{ fontSize: 22, color: 'var(--text-primary)', letterSpacing: 1 }}>{t('notifications.title').toUpperCase()}</h1>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 8, padding: '0 16px 16px' }}>
        {(['notifs', 'activity'] as const).map(tab => (
          <button key={tab} onClick={() => setActiveTab(tab)} style={{
            flex: 1, padding: '8px 0', borderRadius: 10, border: 'none', cursor: 'pointer',
            background: activeTab === tab ? 'rgba(255,184,0,0.12)' : 'var(--bg-surface)',
            color: activeTab === tab ? 'var(--gold-primary)' : 'var(--text-muted)',
            fontFamily: 'var(--font-display)', fontSize: 10, fontWeight: 700, letterSpacing: 1.5,
            transition: 'all 0.2s',
          }}>
            {tab === 'notifs' ? `🔔 ${t('notifications.important')}` : `📋 ${t('notifications.activity')}`}
          </button>
        ))}
      </div>

      {loading ? (
        <div style={{ display: 'flex', justifyContent: 'center', paddingTop: 60 }}>
          <div style={{ width: 28, height: 28, border: '2px solid transparent', borderTopColor: 'var(--gold-primary)', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
          <style>{'@keyframes spin{to{transform:rotate(360deg)}}'}</style>
        </div>
      ) : activeTab === 'activity' ? (
        /* ═══ AKTIVITÄT TAB — Feed Events ═══ */
        feedEvents.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '80px 32px' }}>
            <div style={{ fontSize: 52, marginBottom: 16 }}>📋</div>
            <p className="font-display" style={{ fontSize: 16, color: 'var(--text-secondary)', marginBottom: 8 }}>{t('notifications.noActivity')}</p>
            <p style={{ fontSize: 13, color: 'var(--text-muted)', fontFamily: 'Crimson Text, serif' }}>
              {t('notifications.noActivityText')}
            </p>
          </div>
        ) : (
          <div style={{ padding: '0 16px' }}>
            {feedEvents.map((evt) => (
              <div key={evt.id} style={{ marginBottom: 6 }}>
                <MiniEventCard event={evt} />
              </div>
            ))}
          </div>
        )
      ) : notifs.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '80px 32px' }}>
          <div style={{ fontSize: 52, marginBottom: 16 }}>🔔</div>
          <p className="font-display" style={{ fontSize: 16, color: 'var(--text-secondary)', marginBottom: 8 }}>{t('notifications.noNotifications')}</p>
          <p style={{ fontSize: 13, color: 'var(--text-muted)', fontFamily: 'Crimson Text, serif' }}>
            {t('notifications.upToDate')}
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
                  background: !n.read ? `${color}08` : 'var(--bg-surface)',
                  border: !n.read ? `1px solid ${color}25` : '1px solid var(--border-subtle)',
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
                    <span style={{ fontSize: 13, color: 'var(--text-primary)', fontWeight: !n.read ? 600 : 400 }}>
                      {n.title}
                    </span>
                    <span style={{ fontSize: 10, color: 'var(--text-muted)', flexShrink: 0, marginLeft: 8 }}>
                      {timeAgo(n.created_at, t)}
                    </span>
                  </div>
                  {n.body && (
                    <p style={{ fontSize: 12, color: 'var(--text-secondary)', fontFamily: 'Crimson Text, serif', lineHeight: 1.4 }}>
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
                          background: 'linear-gradient(135deg, var(--gold-dim), var(--gold-primary))',
                          color: 'var(--text-inverse)', fontFamily: 'var(--font-display)', fontSize: 9, fontWeight: 700, letterSpacing: 1,
                        }}
                      >{t('notifications.accept')}</button>
                      <button
                        onClick={() => handleFollowRequest(n, 'decline')}
                        style={{
                          padding: '7px 16px', borderRadius: 8, cursor: 'pointer',
                          background: 'transparent', border: '1px solid var(--border-subtle)',
                          color: 'var(--text-secondary)', fontFamily: 'var(--font-display)', fontSize: 9, letterSpacing: 1,
                        }}
                      >{t('notifications.decline')}</button>
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
