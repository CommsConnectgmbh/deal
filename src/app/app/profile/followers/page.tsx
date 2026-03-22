'use client'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/contexts/AuthContext'
import { useLang } from '@/contexts/LanguageContext'
import { supabase } from '@/lib/supabase'
import ProfileImage from '@/components/ProfileImage'

interface FollowerProfile {
  id: string
  username: string
  display_name: string
  avatar_url: string | null
  level: number
}

interface FollowerRow {
  id: string
  follower_id: string
  following_id: string
  status: string
  follower: FollowerProfile
}

type FollowBackStatus = 'none' | 'pending' | 'accepted'

export default function FollowersPage() {
  const { profile } = useAuth()
  const { t } = useLang()
  const router = useRouter()
  const [followers, setFollowers] = useState<FollowerRow[]>([])
  const [followBackMap, setFollowBackMap] = useState<Record<string, FollowBackStatus>>({})
  const [searchQuery, setSearchQuery] = useState('')
  const [loading, setLoading] = useState(true)
  const [followLoading, setFollowLoading] = useState<string | null>(null)

  useEffect(() => {
    if (profile) fetchData()
  }, [profile])

  const fetchData = async () => {
    if (!profile) return
    setLoading(true)

    const { data: followerData } = await supabase
      .from('follows')
      .select('*, follower:follower_id(id,username,display_name,avatar_url,level)')
      .eq('following_id', profile.id)
      .eq('status', 'accepted')

    const { data: myFollows } = await supabase
      .from('follows')
      .select('following_id,status')
      .eq('follower_id', profile.id)

    const fbMap: Record<string, FollowBackStatus> = {}
    for (const f of (myFollows || [])) {
      fbMap[f.following_id] = f.status as FollowBackStatus
    }
    setFollowBackMap(fbMap)
    setFollowers((followerData || []) as unknown as FollowerRow[])
    setLoading(false)
  }

  const followBack = async (userId: string) => {
    if (!profile) return
    setFollowLoading(userId)

    const { data: targetProfile } = await supabase
      .from('profiles')
      .select('is_private')
      .eq('id', userId)
      .single()

    const isPrivate = targetProfile?.is_private ?? false
    const status = isPrivate ? 'pending' : 'accepted'

    await supabase.from('follows').upsert({
      follower_id: profile.id,
      following_id: userId,
      status,
    }, { onConflict: 'follower_id,following_id' })

    const notifBody = '@' + profile.username + ' ' + (isPrivate ? 'möchte dir folgen' : 'folgt dir jetzt')
    await supabase.from('notifications').insert({
      user_id: userId,
      type: isPrivate ? 'follow_request' : 'follow_accepted',
      title: isPrivate ? 'Neue Follower-Anfrage' : 'Neuer Follower',
      body: notifBody,
      reference_id: profile.id,
    })

    setFollowBackMap(prev => ({ ...prev, [userId]: status as FollowBackStatus }))
    setFollowLoading(null)
  }

  const unfollowBack = async (userId: string) => {
    if (!profile) return
    setFollowLoading(userId)

    await supabase.from('follows').delete()
      .eq('follower_id', profile.id)
      .eq('following_id', userId)

    setFollowBackMap(prev => {
      const next = { ...prev }
      delete next[userId]
      return next
    })
    setFollowLoading(null)
  }

  const filtered = followers.filter(row => {
    if (!searchQuery.trim()) return true
    const q = searchQuery.toLowerCase()
    const f = row.follower
    return (
      (f.username || '').toLowerCase().includes(q) ||
      (f.display_name || '').toLowerCase().includes(q)
    )
  })

  const FollowBackButton = ({ userId }: { userId: string }) => {
    const isLoading = followLoading === userId
    const status = followBackMap[userId]

    if (status === 'accepted') {
      return (
        <button
          onClick={(e) => { e.stopPropagation(); unfollowBack(userId) }}
          disabled={isLoading}
          style={{
            padding: '8px 14px',
            borderRadius: 8,
            border: '1px solid var(--border-subtle)',
            background: 'var(--bg-surface)',
            color: 'var(--text-secondary)',
            fontFamily: 'var(--font-display)',
            fontSize: 9,
            fontWeight: 700,
            letterSpacing: 1,
            cursor: 'pointer',
            whiteSpace: 'nowrap' as const,
            flexShrink: 0,
          }}
        >
          {isLoading ? '···' : `✓ ${t('profile.followed')}`}
        </button>
      )
    }

    if (status === 'pending') {
      return (
        <button
          disabled
          style={{
            padding: '8px 14px',
            borderRadius: 8,
            border: '1px solid rgba(255,184,0,0.2)',
            background: 'var(--bg-surface)',
            color: 'var(--text-muted)',
            fontFamily: 'var(--font-display)',
            fontSize: 9,
            fontWeight: 700,
            letterSpacing: 1,
            whiteSpace: 'nowrap' as const,
            flexShrink: 0,
          }}
        >
          {`${t('profile.requested')} ⏳`}
        </button>
      )
    }

    return (
      <button
        onClick={(e) => { e.stopPropagation(); followBack(userId) }}
        disabled={isLoading}
        style={{
          padding: '8px 14px',
          borderRadius: 8,
          border: 'none',
          background: 'linear-gradient(135deg, var(--gold-dim), var(--gold-primary))',
          color: 'var(--text-inverse)',
          fontFamily: 'var(--font-display)',
          fontSize: 9,
          fontWeight: 700,
          letterSpacing: 1,
          cursor: 'pointer',
          whiteSpace: 'nowrap' as const,
          flexShrink: 0,
        }}
      >
        {isLoading ? '···' : 'FOLGEN'}
      </button>
    )
  }

  return (
    <div style={{
      minHeight: '100dvh',
      background: 'var(--bg-base)',
      paddingBottom: 100,
    }}>

      {/* Header */}
      <div style={{
        padding: '16px 20px 12px',
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        position: 'sticky',
        top: 0,
        background: 'var(--bg-base)',
        zIndex: 50,
        borderBottom: '1px solid var(--border-subtle)',
      }}>
        <button
          onClick={() => router.back()}
          style={{
            background: 'none',
            border: 'none',
            color: 'var(--text-secondary)',
            cursor: 'pointer',
            fontSize: 22,
            padding: 0,
            lineHeight: 1,
          }}
        >
          {'←'}
        </button>
        <h1 style={{
          fontFamily: 'var(--font-display)',
          fontSize: 18,
          color: 'var(--text-primary)',
          fontWeight: 700,
          letterSpacing: 2,
          margin: 0,
          flex: 1,
        }}>
          FOLLOWER ({loading ? '…' : followers.length})
        </h1>
      </div>

      {/* Search Input */}
      <div style={{ padding: '16px 16px 8px' }}>
        <input
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder={t('profile.searchFollowers')}
          style={{
            width: '100%',
            padding: '12px 16px',
            background: 'var(--bg-elevated)',
            border: '1px solid var(--border-subtle)',
            borderRadius: 12,
            color: 'var(--text-primary)',
            fontSize: 15,
            fontFamily: 'var(--font-body)',
            outline: 'none',
            boxSizing: 'border-box' as const,
          }}
        />
      </div>

      {/* List */}
      <div style={{ padding: '8px 16px' }}>
        {loading && (
          <div style={{ textAlign: 'center', padding: '40px 20px' }}>
            <p style={{ fontSize: 14, color: 'var(--text-muted)', fontFamily: 'var(--font-body)' }}>
              Laden…
            </p>
          </div>
        )}

        {!loading && followers.length === 0 && (
          <div style={{ textAlign: 'center', padding: '60px 20px' }}>
            <p style={{ fontSize: 48, marginBottom: 16 }}>😶</p>
            <p style={{
              fontSize: 16,
              color: 'var(--text-secondary)',
              fontFamily: 'var(--font-body)',
            }}>
              {t('profile.noFollowers')}
            </p>
            <p style={{
              fontSize: 13,
              color: 'var(--text-muted)',
              fontFamily: 'var(--font-body)',
              marginTop: 8,
            }}>
              {t('profile.shareProfileToGain')}
            </p>
          </div>
        )}

        {!loading && followers.length > 0 && filtered.length === 0 && (
          <div style={{ textAlign: 'center', padding: '40px 20px' }}>
            <p style={{ fontSize: 32, marginBottom: 12 }}>🔍</p>
            <p style={{
              fontSize: 14,
              color: 'var(--text-secondary)',
              fontFamily: 'var(--font-body)',
            }}>
              {t('profile.noFollowerFound')}
            </p>
          </div>
        )}

        {filtered.map((row) => {
          const f = row.follower
          if (!f) return null
          const profilePath = '/app/profile/' + f.username
          return (
            <div
              key={row.follower_id}
              onClick={() => router.push(profilePath)}
              style={{
                background: 'var(--bg-surface)',
                borderRadius: 12,
                border: '1px solid var(--border-subtle)',
                padding: '12px 14px',
                display: 'flex',
                alignItems: 'center',
                gap: 12,
                marginBottom: 10,
                cursor: 'pointer',
              }}
            >
              <ProfileImage
                size={44}
                avatarUrl={f.avatar_url}
                name={f.username}
              />
              <div style={{ flex: 1, minWidth: 0 }}>
                <p style={{
                  fontSize: 14,
                  color: 'var(--text-primary)',
                  fontWeight: 600,
                  fontFamily: 'var(--font-body)',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                  margin: 0,
                }}>
                  {f.display_name || f.username}
                </p>
                <p style={{
                  fontSize: 12,
                  color: 'var(--text-secondary)',
                  fontFamily: 'var(--font-body)',
                  margin: '2px 0 0',
                }}>
                  @{f.username}
                </p>
              </div>
              <span style={{
                fontSize: 11,
                color: 'var(--gold-primary)',
                fontFamily: 'var(--font-display)',
                fontWeight: 700,
                letterSpacing: 1,
                marginRight: 4,
                flexShrink: 0,
              }}>
                LV. {f.level ?? 1}
              </span>
              <FollowBackButton userId={f.id} />
            </div>
          )
        })}
      </div>
    </div>
  )
}
