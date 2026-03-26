'use client'
import { useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/contexts/AuthContext'
import { useLang } from '@/contexts/LanguageContext'
import ProfileImage from '@/components/ProfileImage'
import type { Profile } from '@/lib/createDealReducer'

interface Props {
  selected: Profile | null
  onSelect: (p: Profile | null) => void
  onSkipToOpen?: () => void
}

export default function OpponentSearch({ selected, onSelect, onSkipToOpen }: Props) {
  const { profile } = useAuth()
  const { t } = useLang()
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<Profile[]>([])
  const [searched, setSearched] = useState(false)

  const search = async (q: string) => {
    setQuery(q)
    if (!q || !profile) { setResults([]); setSearched(false); return }
    const { data } = await supabase.from('profiles')
      .select('id,username,display_name,level,avatar_url')
      .or(`username.ilike.%${q}%,display_name.ilike.%${q}%`)
      .neq('id', profile.id)
      .limit(6)
    setResults((data as Profile[]) || [])
    setSearched(true)
  }

  const inviteViaWhatsApp = () => {
    const displayName = profile?.display_name || profile?.username || 'Jemand'
    const inviteCode = profile?.invite_code || ''
    const inviteLink = `https://app.deal-buddy.app/auth/register?ref=${inviteCode}`
    const text = `\u2694\uFE0F ${displayName} ${t('deals.whatsappInviteText')}\n${inviteLink}`
    window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank')
  }

  const selectUser = (user: Profile) => {
    onSelect(user)
    setResults([])
    setQuery(user.username)
  }

  const clearSelection = () => {
    onSelect(null)
    setQuery('')
    setResults([])
  }

  return (
    <div>
      <label style={{
        display: 'block', fontSize: 10, fontFamily: 'var(--font-display)',
        letterSpacing: 2, color: 'var(--text-secondary)', marginBottom: 8,
      }}>
        {t('deals.searchOpponent')}
      </label>

      <input
        value={query}
        onChange={e => search(e.target.value)}
        placeholder={t('deals.searchUsernamePlaceholder')}
        style={{
          width: '100%', padding: '14px 16px',
          background: 'var(--bg-elevated)',
          border: '1px solid var(--border-subtle)',
          borderRadius: 10,
          color: 'var(--text-primary)',
          fontSize: 16, fontFamily: 'var(--font-body)',
          outline: 'none', boxSizing: 'border-box',
        }}
      />

      {/* Search results */}
      {results.length > 0 && (
        <div style={{
          background: 'var(--bg-surface)', borderRadius: 10,
          border: '1px solid var(--bg-elevated)',
          marginTop: 8, overflow: 'hidden',
        }}>
          {results.map((u) => (
            <button
              key={u.id}
              onClick={() => selectUser(u)}
              style={{
                width: '100%', padding: '12px 16px',
                background: 'transparent', border: 'none',
                borderBottom: '1px solid var(--bg-elevated)',
                cursor: 'pointer', display: 'flex',
                alignItems: 'center', gap: 10, textAlign: 'left',
              }}
            >
              <ProfileImage size={32} avatarUrl={u.avatar_url} name={u.username} />
              <div style={{ flex: 1 }}>
                <p style={{ color: 'var(--text-primary)', fontSize: 13, fontWeight: 600, margin: 0 }}>
                  {u.display_name}
                </p>
                <p style={{ color: 'var(--text-muted)', fontSize: 11, margin: 0 }}>
                  @{u.username} {'\u00B7'} Lv. {u.level || 1}
                </p>
              </div>
              {selected?.id === u.id && (
                <span style={{ color: 'var(--gold-primary)' }}>{'\u2713'}</span>
              )}
            </button>
          ))}
        </div>
      )}

      {/* Selected opponent badge */}
      {selected && (
        <div style={{
          marginTop: 12, padding: '10px 14px',
          background: 'var(--gold-subtle)', borderRadius: 10,
          border: '1px solid var(--border-subtle)',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <ProfileImage size={24} avatarUrl={selected.avatar_url} name={selected.username} />
            <span style={{ color: 'var(--gold-primary)', fontSize: 13 }}>
              {'\u2713'} @{selected.username}
            </span>
          </div>
          <button
            onClick={clearSelection}
            style={{
              background: 'none', border: 'none',
              color: 'var(--text-muted)', cursor: 'pointer', fontSize: 16,
            }}
          >
            {'\u2715'}
          </button>
        </div>
      )}

      {/* WhatsApp invite — always visible when no opponent selected */}
      {!selected && (
        <button
          onClick={inviteViaWhatsApp}
          style={{
            width: '100%', marginTop: 16, padding: '14px',
            borderRadius: 12, border: 'none', cursor: 'pointer',
            background: 'linear-gradient(135deg, #128C7E, #25D366)',
            color: '#fff',
            fontFamily: 'var(--font-display)',
            fontSize: 13, fontWeight: 700, letterSpacing: 1,
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
          }}
        >
          💬 {t('deals.inviteViaWhatsapp')}
        </button>
      )}

      {/* Open challenge option */}
      {onSkipToOpen && !selected && (
        <button
          onClick={onSkipToOpen}
          style={{
            width: '100%', marginTop: 16, padding: '14px',
            borderRadius: 12,
            border: '1.5px dashed var(--border-subtle)',
            background: 'transparent',
            color: 'var(--text-secondary)',
            fontFamily: 'var(--font-display)',
            fontSize: 11, letterSpacing: 1.5,
            cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
          }}
        >
          <span style={{ fontSize: 16 }}>{'\u{1F310}'}</span>
          {t('deals.createOpenChallenge')}
        </button>
      )}
    </div>
  )
}
