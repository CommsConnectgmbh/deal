'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/contexts/AuthContext'
import { supabase } from '@/lib/supabase'
import ProfileImage from '@/components/ProfileImage'

interface FollowingUser {
  id: string
  username: string
  display_name: string | null
  avatar_url: string | null
  level: number
}

interface FollowRow {
  id: string
  following: FollowingUser
}

export default function FollowingPage() {
  const router = useRouter()
  const { profile } = useAuth()
  const [followingList, setFollowingList] = useState<FollowRow[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [unfollowingId, setUnfollowingId] = useState<string | null>(null)

  useEffect(() => {
    if (!profile?.id) return
    fetchFollowing()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile?.id])

  async function fetchFollowing() {
    if (!profile?.id) return
    setLoading(true)
    const { data, error } = await supabase
      .from('follows')
      .select('id, following:following_id(id,username,display_name,avatar_url,level)')
      .eq('follower_id', profile.id)
      .eq('status', 'accepted')

    if (!error && data) {
      setFollowingList(data as unknown as FollowRow[])
    }
    setLoading(false)
  }

  async function handleUnfollow(userId: string) {
    if (!profile?.id) return
    setUnfollowingId(userId)
    const { error } = await supabase
      .from('follows')
      .delete()
      .eq('follower_id', profile.id)
      .eq('following_id', userId)

    if (!error) {
      setFollowingList((prev) => prev.filter((f) => f.following.id !== userId))
    }
    setUnfollowingId(null)
  }

  const filtered = followingList.filter((f) => {
    if (!search.trim()) return true
    const q = search.toLowerCase()
    const uname = (f.following.username || '').toLowerCase()
    const dname = (f.following.display_name || '').toLowerCase()
    return uname.includes(q) || dname.includes(q)
  })

  return (
    <div
      style={{
        minHeight: '100dvh',
        background: 'var(--bg-base)',
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      {/* Header */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 12,
          padding: '16px 16px 12px',
          borderBottom: '1px solid var(--border-subtle)',
          background: 'var(--bg-base)',
          position: 'sticky',
          top: 0,
          zIndex: 10,
        }}
      >
        <button
          onClick={() => router.back()}
          style={{
            background: 'none',
            border: 'none',
            color: 'var(--text-primary)',
            fontSize: 22,
            cursor: 'pointer',
            padding: '4px 8px 4px 0',
            lineHeight: 1,
          }}
          aria-label="Zurück"
        >
          ←
        </button>
        <h1
          style={{
            margin: 0,
            fontSize: 18,
            fontFamily: 'var(--font-display)',
            fontWeight: 700,
            color: 'var(--text-primary)',
            letterSpacing: '0.04em',
            textTransform: 'uppercase',
          }}
        >
          Folge ich ({followingList.length})
        </h1>
      </div>

      {/* Search */}
      <div style={{ padding: '12px 16px 8px' }}>
        <input
          type="text"
          placeholder="Suche nach Username..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          style={{
            width: '100%',
            padding: '10px 14px',
            fontSize: 14,
            fontFamily: 'var(--font-body)',
            background: 'var(--bg-elevated)',
            border: '1px solid var(--border-subtle)',
            borderRadius: 10,
            color: 'var(--text-primary)',
            outline: 'none',
            boxSizing: 'border-box',
          }}
        />
      </div>

      {/* List */}
      <div style={{ flex: 1, padding: '4px 16px 24px', overflowY: 'auto' }}>
        {loading ? (
          <div
            style={{
              textAlign: 'center',
              padding: '48px 0',
              color: 'var(--text-muted)',
              fontSize: 14,
            }}
          >
            Laden...
          </div>
        ) : filtered.length === 0 && search.trim() ? (
          <div
            style={{
              textAlign: 'center',
              padding: '48px 0',
              color: 'var(--text-muted)',
              fontSize: 14,
            }}
          >
            Keine Ergebnisse für &quot;{search}&quot;
          </div>
        ) : followingList.length === 0 ? (
          <div
            style={{
              textAlign: 'center',
              padding: '64px 16px',
              color: 'var(--text-muted)',
              fontSize: 15,
            }}
          >
            <div style={{ fontSize: 40, marginBottom: 12 }}>👤</div>
            <div>Du folgst noch niemandem</div>
            <div style={{ fontSize: 13, marginTop: 6, color: 'var(--text-muted)' }}>
              Entdecke andere Nutzer und folge ihnen!
            </div>
          </div>
        ) : (
          filtered.map((row) => {
            const user = row.following
            return (
              <div
                key={user.id}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 12,
                  padding: '12px 14px',
                  marginBottom: 8,
                  background: 'var(--bg-surface)',
                  border: '1px solid var(--border-subtle)',
                  borderRadius: 12,
                  cursor: 'pointer',
                }}
                onClick={() => router.push('/app/profile/' + user.username)}
              >
                <ProfileImage
                  size={44}
                  avatarUrl={user.avatar_url}
                  name={user.display_name || user.username}
                />

                <div style={{ flex: 1, minWidth: 0 }}>
                  <div
                    style={{
                      fontSize: 15,
                      fontWeight: 600,
                      color: 'var(--text-primary)',
                      whiteSpace: 'nowrap',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                    }}
                  >
                    {user.display_name || user.username}
                  </div>
                  <div
                    style={{
                      fontSize: 13,
                      color: 'var(--text-secondary)',
                      display: 'flex',
                      alignItems: 'center',
                      gap: 6,
                    }}
                  >
                    <span>@{user.username}</span>
                    <span
                      style={{
                        fontSize: 11,
                        fontWeight: 700,
                        color: 'var(--gold-dim)',
                        letterSpacing: '0.03em',
                      }}
                    >
                      LV. {user.level ?? 1}
                    </span>
                  </div>
                </div>

                <button
                  onClick={(e) => {
                    e.stopPropagation()
                    handleUnfollow(user.id)
                  }}
                  disabled={unfollowingId === user.id}
                  style={{
                    padding: '6px 14px',
                    fontSize: 12,
                    fontWeight: 600,
                    fontFamily: 'var(--font-body)',
                    background: 'var(--bg-surface)',
                    border: '1px solid var(--border-subtle)',
                    borderRadius: 8,
                    color: 'var(--text-secondary)',
                    cursor: unfollowingId === user.id ? 'not-allowed' : 'pointer',
                    opacity: unfollowingId === user.id ? 0.5 : 1,
                    whiteSpace: 'nowrap',
                    letterSpacing: '0.03em',
                    textTransform: 'uppercase',
                  }}
                >
                  {unfollowingId === user.id ? '...' : 'Entfolgen'}
                </button>
              </div>
            )
          })
        )}
      </div>
    </div>
  )
}
