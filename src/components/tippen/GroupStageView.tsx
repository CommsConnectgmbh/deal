'use client'
import { useMemo, useState } from 'react'
import MatchCard, { MatchQuestion, TipDraft } from './MatchCard'

interface GroupQuestion extends MatchQuestion {
  competition_stage: string | null
  group_label: string | null
}

interface Props {
  questions: GroupQuestion[]
  drafts: Record<string, TipDraft>
  myAnswers: Record<string, { home_score_tip: number | null; away_score_tip: number | null; is_joker: boolean; points_earned: number | null } | undefined>
  jokerEnabled: boolean
  jokersRemaining: number
  onDraftChange: (qId: string, patch: Partial<TipDraft>) => void
  initialOpenGroup?: string | null
}

interface StandingRow {
  team: string
  short: string
  logo: string | null
  played: number
  wins: number
  draws: number
  losses: number
  goalsFor: number
  goalsAgainst: number
  diff: number
  points: number
}

const STAGE_GROUP = (s: string | null) => s === 'GROUP_STAGE' || s === 'GROUP_PHASE'

function computeStandings(matches: GroupQuestion[]): StandingRow[] {
  const map = new Map<string, StandingRow>()

  const upsert = (team: string, short: string | null, logo: string | null): StandingRow => {
    const key = team
    let row = map.get(key)
    if (!row) {
      row = {
        team, short: short || team.substring(0, 3).toUpperCase(), logo,
        played: 0, wins: 0, draws: 0, losses: 0,
        goalsFor: 0, goalsAgainst: 0, diff: 0, points: 0,
      }
      map.set(key, row)
    }
    return row
  }

  for (const m of matches) {
    if (!m.home_team || !m.away_team) continue
    const home = upsert(m.home_team, m.home_team_short, m.home_team_logo)
    const away = upsert(m.away_team, m.away_team_short, m.away_team_logo)
    if (m.status !== 'resolved' || m.home_score === null || m.away_score === null) continue
    home.played++
    away.played++
    home.goalsFor += m.home_score
    home.goalsAgainst += m.away_score
    away.goalsFor += m.away_score
    away.goalsAgainst += m.home_score
    if (m.home_score > m.away_score) { home.wins++; home.points += 3; away.losses++ }
    else if (m.home_score < m.away_score) { away.wins++; away.points += 3; home.losses++ }
    else { home.draws++; away.draws++; home.points++; away.points++ }
  }

  return [...map.values()]
    .map(r => ({ ...r, diff: r.goalsFor - r.goalsAgainst }))
    .sort((a, b) => b.points - a.points || b.diff - a.diff || b.goalsFor - a.goalsFor || a.team.localeCompare(b.team))
}

function deadlinePassed(iso: string) { return new Date(iso).getTime() < Date.now() }

export default function GroupStageView({
  questions, drafts, myAnswers,
  jokerEnabled, jokersRemaining, onDraftChange, initialOpenGroup,
}: Props) {
  const groupQuestions = useMemo(
    () => questions.filter(q => STAGE_GROUP(q.competition_stage) && q.group_label),
    [questions]
  )

  const groupedByLabel = useMemo(() => {
    const map = new Map<string, GroupQuestion[]>()
    for (const q of groupQuestions) {
      const label = q.group_label || 'Unsorted'
      if (!map.has(label)) map.set(label, [])
      map.get(label)!.push(q)
    }
    return [...map.entries()].sort(([a], [b]) => a.localeCompare(b))
  }, [groupQuestions])

  const firstWithOpenMatch = useMemo(() => {
    for (const [label, ms] of groupedByLabel) {
      if (ms.some(m => m.status !== 'resolved' && !deadlinePassed(m.deadline))) return label
    }
    return groupedByLabel[0]?.[0] ?? null
  }, [groupedByLabel])

  const [openGroup, setOpenGroup] = useState<string | null>(initialOpenGroup ?? firstWithOpenMatch)

  if (groupedByLabel.length === 0) {
    return (
      <div style={{ textAlign: 'center', padding: '40px 16px' }}>
        <p style={{ fontSize: 40, lineHeight: 1, marginBottom: 12 }}>{'⚽'}</p>
        <p style={{ fontSize: 14, color: 'var(--text-muted)' }}>
          Noch keine Gruppen-Daten vorhanden. Admin: synce die Liga, dann erscheinen die Gruppen A–H automatisch.
        </p>
      </div>
    )
  }

  return (
    <div style={{ padding: '8px 12px 16px' }}>
      {/* Group quick-nav chips */}
      <div style={{
        display: 'flex', gap: 6, overflowX: 'auto', padding: '8px 4px 12px',
        scrollbarWidth: 'none', msOverflowStyle: 'none', WebkitOverflowScrolling: 'touch',
      }}>
        {groupedByLabel.map(([label]) => {
          const isOpen = label === openGroup
          const shortLabel = label.replace(/^(?:Group|Gruppe)[\s_]+/i, '').replace(/^GROUP_/, '')
          return (
            <button
              key={label}
              onClick={() => setOpenGroup(label)}
              style={{
                flexShrink: 0,
                padding: '7px 14px', borderRadius: 999,
                fontSize: 11, fontFamily: 'var(--font-display)', fontWeight: 800,
                letterSpacing: 1.2, textTransform: 'uppercase', cursor: 'pointer',
                background: isOpen
                  ? 'linear-gradient(135deg, var(--gold-dim), var(--gold-primary))'
                  : 'var(--bg-elevated)',
                color: isOpen ? 'var(--text-inverse)' : 'var(--text-secondary)',
                border: isOpen ? 'none' : '1px solid var(--border-subtle)',
                transition: 'background .2s',
              }}
            >
              {shortLabel.length <= 3 ? `Gruppe ${shortLabel}` : shortLabel}
            </button>
          )
        })}
      </div>

      {groupedByLabel.map(([label, matches]) => {
        if (label !== openGroup) return null
        const standings = computeStandings(matches)
        const sortedMatches = [...matches].sort((a, b) => {
          const ta = a.match_utc_date ? new Date(a.match_utc_date).getTime() : 0
          const tb = b.match_utc_date ? new Date(b.match_utc_date).getTime() : 0
          return ta - tb
        })

        return (
          <div key={label}>
            {/* Mini standings table */}
            <div style={{
              background: 'var(--bg-surface)',
              border: '1px solid var(--border-subtle)',
              borderRadius: 14, padding: '14px 12px 10px',
              marginBottom: 14,
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10, padding: '0 4px' }}>
                <span style={{
                  fontSize: 11, fontFamily: 'var(--font-display)', fontWeight: 800,
                  color: 'var(--gold-primary)', letterSpacing: 1.5, textTransform: 'uppercase',
                }}>
                  Tabelle {label.replace(/^(?:Group|Gruppe)[\s_]+/i, '').replace(/^GROUP_/, '')}
                </span>
                <span style={{ flex: 1, height: 1, background: 'var(--border-subtle)' }} />
                <span style={{ fontSize: 10, color: 'var(--text-muted)', letterSpacing: 0.5 }}>
                  Top 2 weiter
                </span>
              </div>

              <table style={{
                width: '100%', borderCollapse: 'collapse', fontSize: 12,
                fontFamily: 'var(--font-body)',
              }}>
                <thead>
                  <tr style={{ color: 'var(--text-muted)', fontSize: 10, letterSpacing: 0.8, textTransform: 'uppercase' }}>
                    <th style={{ textAlign: 'left', padding: '6px 4px', fontWeight: 600, width: 18 }}>#</th>
                    <th style={{ textAlign: 'left', padding: '6px 4px', fontWeight: 600 }}>Team</th>
                    <th style={{ textAlign: 'center', padding: '6px 4px', fontWeight: 600 }}>Sp</th>
                    <th style={{ textAlign: 'center', padding: '6px 4px', fontWeight: 600 }}>S</th>
                    <th style={{ textAlign: 'center', padding: '6px 4px', fontWeight: 600 }}>U</th>
                    <th style={{ textAlign: 'center', padding: '6px 4px', fontWeight: 600 }}>N</th>
                    <th style={{ textAlign: 'center', padding: '6px 4px', fontWeight: 600 }}>Tore</th>
                    <th style={{ textAlign: 'center', padding: '6px 4px', fontWeight: 600 }}>Diff</th>
                    <th style={{ textAlign: 'right', padding: '6px 6px 6px 4px', fontWeight: 700, color: 'var(--text-secondary)' }}>Pkt</th>
                  </tr>
                </thead>
                <tbody>
                  {standings.map((row, i) => {
                    const qualified = i < 2
                    return (
                      <tr key={row.team} style={{
                        borderTop: '1px solid var(--border-subtle)',
                        background: qualified ? 'rgba(255,184,0,0.04)' : 'transparent',
                      }}>
                        <td style={{
                          padding: '8px 4px', color: qualified ? 'var(--gold-primary)' : 'var(--text-muted)',
                          fontWeight: 700, fontFamily: 'var(--font-display)',
                        }}>{i + 1}</td>
                        <td style={{ padding: '8px 4px' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                            {row.logo && (
                              <img src={row.logo} alt="" style={{ width: 18, height: 18, objectFit: 'contain', flexShrink: 0 }} />
                            )}
                            <span style={{
                              fontSize: 12, fontWeight: 600,
                              color: 'var(--text-primary)',
                              overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                              maxWidth: 110,
                            }}>{row.team}</span>
                          </div>
                        </td>
                        <td style={{ textAlign: 'center', padding: '8px 4px', color: 'var(--text-secondary)' }}>{row.played}</td>
                        <td style={{ textAlign: 'center', padding: '8px 4px', color: 'var(--text-secondary)' }}>{row.wins}</td>
                        <td style={{ textAlign: 'center', padding: '8px 4px', color: 'var(--text-secondary)' }}>{row.draws}</td>
                        <td style={{ textAlign: 'center', padding: '8px 4px', color: 'var(--text-secondary)' }}>{row.losses}</td>
                        <td style={{ textAlign: 'center', padding: '8px 4px', color: 'var(--text-secondary)' }}>
                          {row.goalsFor}:{row.goalsAgainst}
                        </td>
                        <td style={{
                          textAlign: 'center', padding: '8px 4px',
                          color: row.diff > 0 ? '#22C55E' : row.diff < 0 ? 'var(--status-error)' : 'var(--text-muted)',
                          fontWeight: 600,
                        }}>{row.diff > 0 ? `+${row.diff}` : row.diff}</td>
                        <td style={{
                          textAlign: 'right', padding: '8px 6px 8px 4px',
                          fontFamily: 'var(--font-display)', fontWeight: 800,
                          color: qualified ? 'var(--gold-primary)' : 'var(--text-primary)',
                        }}>{row.points}</td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>

              {standings.every(r => r.played === 0) && (
                <p style={{
                  textAlign: 'center', color: 'var(--text-muted)',
                  fontSize: 11, margin: '8px 0 4px',
                }}>
                  Noch keine Ergebnisse — Tabelle aktualisiert sich nach den ersten Spielen.
                </p>
              )}
            </div>

            {/* Matches in this group */}
            <div style={{ marginBottom: 12 }}>
              {sortedMatches.map(q => {
                const draft = drafts[q.id] || { homeScore: '', awayScore: '', joker: false }
                return (
                  <MatchCard
                    key={q.id}
                    q={q as MatchQuestion}
                    draft={draft}
                    existingTip={myAnswers[q.id] || null}
                    locked={deadlinePassed(q.deadline)}
                    resolved={q.status === 'resolved'}
                    jokerEnabled={jokerEnabled}
                    jokersRemaining={jokersRemaining}
                    jokerUsedThisMatchday={false}
                    onDraftChange={patch => onDraftChange(q.id, patch)}
                  />
                )
              })}
            </div>
          </div>
        )
      })}
    </div>
  )
}
