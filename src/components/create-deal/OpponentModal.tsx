'use client'
import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/contexts/AuthContext'
import { useLang } from '@/contexts/LanguageContext'
import ProfileImage from '@/components/ProfileImage'
import type { Profile } from '@/lib/createDealReducer'

interface Props {
  show: boolean
  onSelect: (p: Profile) => void
  onClose: () => void
}

export default function OpponentModal({ show, onSelect, onClose }: Props) {
  const { profile } = useAuth()
  const { t } = useLang()
  const [query, setQuery] = useState('')
  const [friends, setFriends] = useState<Profile[]>([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (show && profile) {
      loadFriends()
    }
    if (!show) {
      setQuery('')
    }
  }, [show, profile])

  const loadFriends = async () => {
    if (!profile) return
    setLoading(true)
    try {
      // Get accepted follows where user is follower (people I follow)
      const { data: following } = await supabase
        .from('follows')
        .select('following_id')
        .eq('follower_id', profile.id)
        .eq('status', 'accepted')

      // Get accepted follows where user is following (people who follow me)
      const { data: followers } = await supabase
        .from('follows')
        .select('follower_id')
        .eq('following_id', profile.id)
        .eq('status', 'accepted')

      const friendIds = new Set<string>()
      following?.forEach((f: any) => friendIds.add(f.following_id))
      followers?.forEach((f: any) => friendIds.add(f.follower_id))

      if (friendIds.size === 0) {
        setFriends([])
        setLoading(false)
        return
      }

      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, username, display_name, level, avatar_url')
        .in('id', Array.from(friendIds))
        .order('display_name')

      setFriends((profiles as Profile[]) || [])
    } catch (err) {
      console.error('Failed to load friends:', err)
    }
    setLoading(false)
  }

  const filtered = query.trim()
    ? friends.filter(f =>
        f.username.toLowerCase().includes(query.toLowerCase()) ||
        f.display_name.toLowerCase().includes(query.toLowerCase())
      )
    : friends

  if (!show) return null

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 9999,
        background: 'rgba(0,0,0,0.6)',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'flex-end',
      }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          background: 'var(--bg-base)',
          borderRadius: '20px 20px 0 0',
          maxHeight: '75dvh',
          display: 'flex',
          flexDirection: 'column',
          animation: 'slideUp 0.25s ease-out',
        }}
      >
        {/* Handle bar */}
        <div style={{
          display: 'flex', justifyContent: 'center', padding: '12px 0 4px',
        }}>
          <div style={{
            width: 36, height: 4, borderRadius: 2,
            background: 'var(--border-subtle)',
          }} />
        </div>

        {/* Title */}
        <div style={{ padding: '8px 20px 12px' }}>
          <h3 style={{
            margin: 0,
            fontFamily: 'var(--font-display)',
            fontSize: 14,
            letterSpacing: 2,
            color: 'var(--text-primary)',
            textAlign: 'center',
          }}>
            {t('deals.gegner')}
          </h3>
        </div>

        {/* Search */}
        <div style={{ padding: '0 20px 12px' }}>
          <input
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder={t('deals.searchFriends')}
            autoFocus
            style={{
              width: '100%',
              padding: '12px 16px',
              background: 'var(--bg-elevated)',
              border: '1px solid var(--border-subtle)',
              borderRadius: 10,
              color: 'var(--text-primary)',
              fontSize: 14,
              fontFamily: 'var(--font-body)',
              outline: 'none',
              boxSizing: 'border-box',
            }}
          />
        </div>

        {/* Results list */}
        <div style={{
          flex: 1,
          overflowY: 'auto',
          padding: '0 20px',
          minHeight: 100,
        }}>
          {loading ? (
            <p style={{
              textAlign: 'center', color: 'var(--text-muted)',
              fontSize: 13, padding: '24px 0',
            }}>...</p>
          ) : filtered.length === 0 ? (
            <p style={{
              textAlign: 'center', color: 'var(--text-muted)',
              fontSize: 13, padding: '24px 0',
              fontFamily: 'var(--font-body)',
            }}>
              {query.trim() ? t('deals.noResults') : t('deals.noFriendsYet')}
            </p>
          ) : (
            filtered.map(user => (
              <button
                key={user.id}
                onClick={() => onSelect(user)}
                style={{
                  width: '100%',
                  padding: '12px 0',
                  background: 'transparent',
                  border: 'none',
                  borderBottom: '1px solid var(--bg-elevated)',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 12,
                  textAlign: 'left',
                }}
              >
                <ProfileImage size={40} avatarUrl={user.avatar_url} name={user.username} />
                <div style={{ flex: 1 }}>
                  <p style={{
                    color: 'var(--text-primary)', fontSize: 14,
                    fontWeight: 600, margin: 0,
                    fontFamily: 'var(--font-body)',
                  }}>
                    {user.display_name}
                  </p>
                  <p style={{
                    color: 'var(--text-muted)', fontSize: 12,
                    margin: 0, fontFamily: 'var(--font-body)',
                  }}>
                    @{user.username} {'\u00B7'} Lv. {user.level || 1}
                  </p>
                </div>
              </button>
            ))
          )}
        </div>

        {/* Footer */}
        <div style={{ padding: '12px 20px 28px' }}>
          <button
            onClick={onClose}
            style={{
              width: '100%',
              padding: 14,
              borderRadius: 12,
              border: '1px dashed var(--border-subtle)',
              background: 'transparent',
              color: 'var(--text-secondary)',
              fontFamily: 'var(--font-display)',
              fontSize: 11,
              letterSpacing: 1.5,
              cursor: 'pointer',
            }}
          >
            {t('deals.continueWithout')}
          </button>
        </div>
      </div>

      <style>{`
        @keyframes slideUp {
          from { transform: translateY(100%); }
          to { transform: translateY(0); }
        }
      `}</style>
    </div>
  )
}
