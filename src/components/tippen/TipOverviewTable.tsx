'use client'
import ProfileImage from '@/components/ProfileImage'

interface MemberInfo {
  user_id: string
  username: string
  display_name?: string | null
  avatar_url: string | null
  total_points?: number
}

interface QuestionInfo {
  id: string
  home_team_short: string | null
  away_team_short: string | null
  home_team: string | null
  away_team: string | null
  home_score: number | null
  away_score: number | null
  extratime_home?: number | null
  extratime_away?: number | null
  penalty_home?: number | null
  penalty_away?: number | null
  match_winner?: string | null
  deadline: string
  status: string
}

interface TipInfo {
  question_id: string
  user_id: string
  home_score_tip: number | null
  away_score_tip: number | null
  points_earned: number | null
}

interface Props {
  questions: QuestionInfo[]
  members: MemberInfo[]
  tips: TipInfo[]
}

function deadlinePassed(iso: string) { return new Date(iso).getTime() < Date.now() }

function getCellColor(tip: TipInfo | undefined, q: QuestionInfo): string {
  if (!tip || tip.home_score_tip === null || tip.away_score_tip === null) return 'var(--bg-elevated)'
  if (q.status !== 'resolved' || q.home_score === null || q.away_score === null) return 'var(--bg-elevated)'

  const pts = tip.points_earned ?? 0
  if (pts >= 5) return 'rgba(34,197,94,0.15)' // green — exact
  if (pts >= 3) return 'rgba(234,179,8,0.15)'  // yellow — diff
  if (pts >= 2) return 'rgba(249,115,22,0.15)' // orange — tendency
  return 'rgba(255,255,255,0.03)' // miss
}

// Erg.-Zelle (Kicktipp-Stil): 90'-Score ist die Headline (darauf wird getippt),
// 120' (n.V.) und Elfmeterschießen als kleiner Annex.
function renderFinalScore(q: QuestionInfo): { head: string; suffix: string } {
  if (q.home_score === null || q.away_score === null) return { head: '–', suffix: '' }
  const head = `${q.home_score}:${q.away_score}`
  const parts: string[] = []
  if (q.extratime_home != null && q.extratime_away != null) {
    parts.push(`n.V. ${q.extratime_home}:${q.extratime_away}`)
  }
  if (q.penalty_home != null && q.penalty_away != null) {
    parts.push(`i.E. ${q.penalty_home}:${q.penalty_away}`)
  }
  return { head, suffix: parts.join(' · ') }
}

/**
 * TipOverviewTable — Matrix showing who tipped what.
 * Rows = matches, Cols = members. Tips hidden before deadline.
 */
export default function TipOverviewTable({ questions, members, tips }: Props) {
  if (questions.length === 0 || members.length === 0) {
    return (
      <div style={{ textAlign: 'center', padding: '40px 0' }}>
        <p style={{ fontSize: 14, color: 'var(--text-muted)' }}>Keine Daten für die Übersicht.</p>
      </div>
    )
  }

  // Build lookup: tips[questionId][userId]
  const tipMap: Record<string, Record<string, TipInfo>> = {}
  tips.forEach(t => {
    if (!tipMap[t.question_id]) tipMap[t.question_id] = {}
    tipMap[t.question_id][t.user_id] = t
  })

  // Columns sorted left→right by current rank (Platz 1 first).
  const sortedMembers = [...members].sort((a, b) => (b.total_points ?? 0) - (a.total_points ?? 0))

  return (
    <div style={{ overflowX: 'auto', WebkitOverflowScrolling: 'touch', padding: '8px 0' }}>
      <table style={{
        borderCollapse: 'collapse', width: '100%', minWidth: members.length * 60 + 100,
        fontSize: 11, fontFamily: 'var(--font-display)',
      }}>
        <thead>
          <tr>
            <th style={{
              position: 'sticky', left: 0, zIndex: 2, background: 'var(--bg-base)',
              padding: '8px 6px', textAlign: 'left', borderBottom: '1px solid var(--border-subtle)',
              color: 'var(--text-muted)', fontWeight: 700, letterSpacing: 0.5,
            }}>
              Spiel
            </th>
            {sortedMembers.map(m => (
              <th key={m.user_id} style={{
                padding: '6px 4px', textAlign: 'center',
                borderBottom: '1px solid var(--border-subtle)',
                color: 'var(--text-secondary)', fontWeight: 600, minWidth: 50,
              }}>
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
                  <div style={{ position: 'relative' }}>
                    <ProfileImage size={22} avatarUrl={m.avatar_url} name={m.display_name || m.username} />
                    {/* Aktuelle Punktzahl, hochgestellt an der Avatar-Ecke */}
                    <span style={{
                      position: 'absolute', top: -6, right: -8,
                      minWidth: 14, height: 14, padding: '0 3px', boxSizing: 'border-box',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      background: 'linear-gradient(135deg, var(--gold-dim), var(--gold-primary))',
                      color: 'var(--text-inverse)', borderRadius: 7,
                      fontSize: 9, fontWeight: 800, fontFamily: 'var(--font-display)',
                      lineHeight: 1, letterSpacing: 0, border: '1px solid var(--bg-base)',
                    }}>
                      {m.total_points ?? 0}
                    </span>
                  </div>
                  <span style={{ fontSize: 9, maxWidth: 50, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {m.display_name || m.username}
                  </span>
                </div>
              </th>
            ))}
            <th style={{
              padding: '8px 6px', textAlign: 'center',
              borderBottom: '1px solid var(--border-subtle)',
              color: 'var(--gold-primary)', fontWeight: 700,
            }}>
              Erg.
            </th>
          </tr>
        </thead>
        <tbody>
          {questions.map(q => {
            const matchLabel = `${q.home_team_short || q.home_team || '?'} - ${q.away_team_short || q.away_team || '?'}`
            const dlPassed = deadlinePassed(q.deadline)

            return (
              <tr key={q.id}>
                <td style={{
                  position: 'sticky', left: 0, zIndex: 1, background: 'var(--bg-base)',
                  padding: '8px 6px', borderBottom: '1px solid var(--border-subtle)',
                  color: 'var(--text-primary)', fontWeight: 600, whiteSpace: 'nowrap',
                  fontSize: 10, letterSpacing: 0.3,
                }}>
                  {matchLabel}
                </td>
                {sortedMembers.map(m => {
                  const tip = tipMap[q.id]?.[m.user_id]
                  const hasTip = tip && tip.home_score_tip !== null
                  const showTip = dlPassed && hasTip

                  return (
                    <td key={m.user_id} style={{
                      padding: '6px 4px', textAlign: 'center',
                      borderBottom: '1px solid var(--border-subtle)',
                      background: showTip ? getCellColor(tip, q) : 'transparent',
                      borderRadius: 4,
                    }}>
                      {!dlPassed ? (
                        <span style={{ fontSize: 12 }}>{hasTip ? '✓' : ''}</span>
                      ) : showTip ? (
                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 1 }}>
                          <span style={{ fontWeight: 700, color: 'var(--text-primary)', fontSize: 11 }}>
                            {tip!.home_score_tip}:{tip!.away_score_tip}
                          </span>
                          {q.status === 'resolved' && tip!.points_earned !== null && tip!.points_earned !== undefined && (
                            <span style={{
                              fontSize: 8, fontWeight: 700, fontFamily: 'var(--font-display)',
                              color: tip!.points_earned >= 5 ? '#22C55E' : tip!.points_earned >= 3 ? '#EAB308' : tip!.points_earned >= 2 ? '#F97316' : 'var(--text-muted)',
                              letterSpacing: 0.3,
                            }}>
                              +{tip!.points_earned}
                            </span>
                          )}
                        </div>
                      ) : (
                        <span style={{ color: 'var(--text-muted)', fontSize: 10 }}>–</span>
                      )}
                    </td>
                  )
                })}
                <td style={{
                  padding: '6px', textAlign: 'center',
                  borderBottom: '1px solid var(--border-subtle)',
                  whiteSpace: 'nowrap',
                }}>
                  {q.status === 'resolved' ? (() => {
                    const { head, suffix } = renderFinalScore(q)
                    return (
                      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 1 }}>
                        <span style={{ fontWeight: 700, color: 'var(--gold-primary)', fontSize: 12 }}>{head}</span>
                        {suffix && (
                          <span style={{ fontSize: 8, fontWeight: 700, color: 'var(--text-muted)', letterSpacing: 0.3 }}>
                            {suffix}
                          </span>
                        )}
                      </div>
                    )
                  })() : <span style={{ color: 'var(--text-muted)', fontSize: 12 }}>–</span>}
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
