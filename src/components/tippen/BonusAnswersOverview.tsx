'use client'
import ProfileImage from '@/components/ProfileImage'

interface MemberInfo {
  user_id: string
  username: string
  display_name?: string | null
  avatar_url: string | null
  total_points?: number
}

interface BonusQuestionInfo {
  id: string
  question: string
  correct_answer: string | null
  points: number
  deadline: string
  status: string
  sort_order: number
}

interface BonusAnswerInfo {
  question_id: string
  user_id: string
  answer: string | null
  points_earned: number | null
}

interface Props {
  questions: BonusQuestionInfo[]
  members: MemberInfo[]
  answers: BonusAnswerInfo[]
}

function deadlinePassed(iso: string) { return new Date(iso).getTime() < Date.now() }

function getCellColor(a: BonusAnswerInfo | undefined, q: BonusQuestionInfo): string {
  if (!a || !a.answer) return 'var(--bg-elevated)'
  if (q.status !== 'resolved') return 'var(--bg-elevated)'
  if ((a.points_earned ?? 0) > 0) return 'rgba(34,197,94,0.15)' // green — hit
  return 'rgba(255,255,255,0.03)' // miss
}

/**
 * BonusAnswersOverview — Wer hat was bei den Spezial-Fragen getippt.
 * Rows = Bonus-Fragen, Cols = Mitglieder (sortiert nach Punkten).
 * Fremde Tipps erst nach Deadline sichtbar.
 */
export default function BonusAnswersOverview({ questions, members, answers }: Props) {
  if (questions.length === 0 || members.length === 0) return null

  const ansMap: Record<string, Record<string, BonusAnswerInfo>> = {}
  answers.forEach(a => {
    if (!ansMap[a.question_id]) ansMap[a.question_id] = {}
    ansMap[a.question_id][a.user_id] = a
  })

  const sortedMembers = [...members].sort((a, b) => (b.total_points ?? 0) - (a.total_points ?? 0))
  const sortedQuestions = [...questions].sort((a, b) => a.sort_order - b.sort_order)

  return (
    <div style={{ marginTop: 16 }}>
      <h3 style={{
        fontSize: 13, fontFamily: 'var(--font-display)', color: 'var(--gold-primary)',
        letterSpacing: 1, textTransform: 'uppercase', fontWeight: 700,
        margin: '8px 16px 6px',
      }}>
        Wer hat was getippt
      </h3>

      <div style={{ overflowX: 'auto', WebkitOverflowScrolling: 'touch', padding: '4px 0' }}>
        <table style={{
          borderCollapse: 'collapse', width: '100%',
          minWidth: members.length * 70 + 160,
          fontSize: 11, fontFamily: 'var(--font-display)',
        }}>
          <thead>
            <tr>
              <th style={{
                position: 'sticky', left: 0, zIndex: 2, background: 'var(--bg-base)',
                padding: '8px 6px', textAlign: 'left',
                borderBottom: '1px solid var(--border-subtle)',
                color: 'var(--text-muted)', fontWeight: 700, letterSpacing: 0.5,
                minWidth: 140,
              }}>
                Frage
              </th>
              {sortedMembers.map(m => (
                <th key={m.user_id} style={{
                  padding: '6px 4px', textAlign: 'center',
                  borderBottom: '1px solid var(--border-subtle)',
                  color: 'var(--text-secondary)', fontWeight: 600, minWidth: 60,
                }}>
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
                    <div style={{ position: 'relative' }}>
                      <ProfileImage size={22} avatarUrl={m.avatar_url} name={m.display_name || m.username} />
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
                    <span style={{ fontSize: 9, maxWidth: 60, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {m.display_name || m.username}
                    </span>
                  </div>
                </th>
              ))}
              <th style={{
                padding: '8px 6px', textAlign: 'center',
                borderBottom: '1px solid var(--border-subtle)',
                color: 'var(--gold-primary)', fontWeight: 700,
                minWidth: 80,
              }}>
                Richtig
              </th>
            </tr>
          </thead>
          <tbody>
            {sortedQuestions.map(q => {
              const dlPassed = deadlinePassed(q.deadline)
              return (
                <tr key={q.id}>
                  <td style={{
                    position: 'sticky', left: 0, zIndex: 1, background: 'var(--bg-base)',
                    padding: '8px 6px', borderBottom: '1px solid var(--border-subtle)',
                    color: 'var(--text-primary)', fontWeight: 600,
                    fontSize: 11, letterSpacing: 0.3, whiteSpace: 'nowrap',
                  }}>
                    <span style={{ color: 'var(--gold-primary)', fontWeight: 700, marginRight: 4 }}>
                      {q.points}P
                    </span>
                    {q.question}
                  </td>
                  {sortedMembers.map(m => {
                    const ans = ansMap[q.id]?.[m.user_id]
                    const hasAns = ans && ans.answer
                    const showAns = dlPassed && hasAns
                    return (
                      <td key={m.user_id} style={{
                        padding: '6px 4px', textAlign: 'center',
                        borderBottom: '1px solid var(--border-subtle)',
                        background: showAns ? getCellColor(ans, q) : 'transparent',
                        borderRadius: 4,
                      }}>
                        {!dlPassed ? (
                          <span style={{ fontSize: 12 }}>{hasAns ? '✓' : ''}</span>
                        ) : showAns ? (
                          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 1 }}>
                            <span style={{
                              fontWeight: 700, color: 'var(--text-primary)',
                              fontSize: 10, maxWidth: 70, overflow: 'hidden',
                              textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                            }}>
                              {ans!.answer}
                            </span>
                            {q.status === 'resolved' && ans!.points_earned !== null && ans!.points_earned !== undefined && (
                              <span style={{
                                fontSize: 9, fontWeight: 700, fontFamily: 'var(--font-display)',
                                color: ans!.points_earned > 0 ? '#22C55E' : 'var(--text-muted)',
                                letterSpacing: 0.3,
                              }}>
                                {ans!.points_earned > 0 ? `+${ans!.points_earned}` : '0'}
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
                    fontWeight: 700, color: 'var(--gold-primary)', fontSize: 11,
                    whiteSpace: 'nowrap',
                  }}>
                    {q.status === 'resolved' ? (q.correct_answer || '–') : '–'}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}
