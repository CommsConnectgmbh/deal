'use client'
import { useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/contexts/AuthContext'
import { useLang } from '@/contexts/LanguageContext'
import ProfileImage from '@/components/ProfileImage'
import type { Profile, TeamConfig } from '@/lib/createDealReducer'
import { TEAM_COLORS } from '@/lib/createDealReducer'

interface Props {
  teamA: TeamConfig
  teamB: TeamConfig
  onAddMember: (side: 'a' | 'b', member: Profile) => void
  onRemoveMember: (side: 'a' | 'b', userId: string) => void
  onSetName: (side: 'a' | 'b', name: string) => void
  onSetColor: (side: 'a' | 'b', color: string) => void
}

export default function TeamBuilder({ teamA, teamB, onAddMember, onRemoveMember, onSetName, onSetColor }: Props) {
  const { profile } = useAuth()
  const { t } = useLang()
  const [searchA, setSearchA] = useState('')
  const [searchB, setSearchB] = useState('')
  const [resultsA, setResultsA] = useState<Profile[]>([])
  const [resultsB, setResultsB] = useState<Profile[]>([])

  const searchUsers = async (q: string, side: 'a' | 'b') => {
    if (side === 'a') setSearchA(q); else setSearchB(q)
    if (!q || !profile) {
      if (side === 'a') setResultsA([]); else setResultsB([])
      return
    }
    const { data } = await supabase.from('profiles')
      .select('id,username,display_name,level,avatar_url')
      .or(`username.ilike.%${q}%,display_name.ilike.%${q}%`)
      .neq('id', profile.id)
      .limit(5)
    if (side === 'a') setResultsA((data as Profile[]) || [])
    else setResultsB((data as Profile[]) || [])
  }

  const renderTeam = (side: 'a' | 'b') => {
    const team = side === 'a' ? teamA : teamB
    const query = side === 'a' ? searchA : searchB
    const results = side === 'a' ? resultsA : resultsB

    return (
      <div style={{ flex: 1, minWidth: 0 }}>
        {/* Team name */}
        <input
          value={team.name}
          onChange={e => onSetName(side, e.target.value)}
          placeholder={`Team ${side === 'a' ? 'A' : 'B'}`}
          style={{
            width: '100%', padding: '10px 12px',
            background: 'var(--bg-elevated)',
            border: `1.5px solid ${team.color}40`,
            borderRadius: 8,
            color: team.color,
            fontSize: 13, fontFamily: 'var(--font-display)',
            fontWeight: 700, letterSpacing: 1,
            outline: 'none', boxSizing: 'border-box',
            textAlign: 'center',
          }}
        />

        {/* Color picker */}
        <div style={{
          display: 'flex', gap: 4, justifyContent: 'center',
          marginTop: 6, marginBottom: 8,
        }}>
          {TEAM_COLORS.map(c => (
            <button
              key={c}
              onClick={() => onSetColor(side, c)}
              style={{
                width: 18, height: 18, borderRadius: '50%',
                background: c,
                border: team.color === c ? '2px solid var(--text-primary)' : '1px solid var(--border-subtle)',
                cursor: 'pointer', padding: 0,
              }}
            />
          ))}
        </div>

        {/* Members */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4, marginBottom: 8 }}>
          {team.members.map(m => (
            <div key={m.id} style={{
              display: 'flex', alignItems: 'center', gap: 6,
              padding: '4px 8px', borderRadius: 8,
              background: 'var(--bg-elevated)',
            }}>
              <ProfileImage size={20} avatarUrl={m.avatar_url} name={m.username} />
              <span style={{ fontSize: 10, color: 'var(--text-primary)', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                @{m.username}
              </span>
              <button
                onClick={() => onRemoveMember(side, m.id)}
                style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: 12, padding: '0 2px' }}
              >
                {'\u2715'}
              </button>
            </div>
          ))}
          {team.members.length === 0 && (
            <span style={{ fontSize: 9, color: 'var(--text-muted)', textAlign: 'center', padding: 8 }}>
              {t('components.noMembers')}
            </span>
          )}
        </div>

        {/* Add member search */}
        {team.members.length < 5 && (
          <>
            <input
              value={query}
              onChange={e => searchUsers(e.target.value, side)}
              placeholder="Hinzuf\u00FCgen\u2026"
              style={{
                width: '100%', padding: '8px 10px',
                background: 'var(--bg-surface)',
                border: '1px solid var(--border-subtle)',
                borderRadius: 8, color: 'var(--text-primary)',
                fontSize: 11, outline: 'none', boxSizing: 'border-box',
              }}
            />
            {results.length > 0 && (
              <div style={{
                background: 'var(--bg-surface)', borderRadius: 8,
                border: '1px solid var(--bg-elevated)',
                marginTop: 4, overflow: 'hidden',
              }}>
                {results.map(u => (
                  <button
                    key={u.id}
                    onClick={() => {
                      onAddMember(side, u)
                      if (side === 'a') { setSearchA(''); setResultsA([]) }
                      else { setSearchB(''); setResultsB([]) }
                    }}
                    style={{
                      width: '100%', padding: '8px 10px',
                      background: 'transparent', border: 'none',
                      borderBottom: '1px solid var(--bg-elevated)',
                      cursor: 'pointer', display: 'flex',
                      alignItems: 'center', gap: 6, textAlign: 'left',
                    }}
                  >
                    <ProfileImage size={20} avatarUrl={u.avatar_url} name={u.username} />
                    <span style={{ fontSize: 10, color: 'var(--text-primary)' }}>@{u.username}</span>
                  </button>
                ))}
              </div>
            )}
          </>
        )}
      </div>
    )
  }

  return (
    <div>
      <label style={{
        display: 'block', fontSize: 10, fontFamily: 'var(--font-display)',
        letterSpacing: 2, color: 'var(--text-secondary)', marginBottom: 10,
        textAlign: 'center',
      }}>
        TEAMS AUFSTELLEN
      </label>
      <div style={{ display: 'flex', gap: 12 }}>
        {renderTeam('a')}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          flexShrink: 0,
        }}>
          <span style={{
            fontFamily: 'var(--font-display)', fontSize: 16,
            fontWeight: 900, color: 'var(--gold-primary)',
            letterSpacing: 2,
          }}>VS</span>
        </div>
        {renderTeam('b')}
      </div>
    </div>
  )
}
