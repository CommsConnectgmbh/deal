'use client'
import { useState } from 'react'

interface BracketTip {
  stage: string
  position: number
  predicted_team_name: string | null
  actual_team_name: string | null
  is_correct: boolean | null
  points_earned: number
}

interface Props {
  tips: BracketTip[]
  stages: string[] // e.g. ['ROUND_OF_16', 'QUARTER_FINALS', 'SEMI_FINALS', 'FINAL']
  onSave: (stage: string, position: number, teamName: string) => Promise<void>
  teamOptions: string[]
  /** team-name → crest-url (optional). */
  teamLogos?: Record<string, string>
  locked: boolean
}

/** Points awarded per correctly predicted team that advances from a stage. */
const POINTS_PER_HIT = 3

const STAGE_LABELS: Record<string, string> = {
  'LAST_32': 'Sechzehntelfinale',
  'ROUND_OF_32': 'Sechzehntelfinale',
  'LAST_16': 'Achtelfinale',
  'ROUND_OF_16': 'Achtelfinale',
  'QUARTER_FINALS': 'Viertelfinale',
  'SEMI_FINALS': 'Halbfinale',
  'FINAL': 'Finale',
  'THIRD_PLACE': '3. Platz',
}

const STAGE_POSITIONS: Record<string, number> = {
  'LAST_32': 16,
  'ROUND_OF_32': 16,
  'LAST_16': 8,
  'ROUND_OF_16': 8,
  'QUARTER_FINALS': 4,
  'SEMI_FINALS': 2,
  'FINAL': 1,
  'THIRD_PLACE': 1,
}

/** Placeholder names that come from the fixture sync but are not real teams. */
const NON_TEAM_VALUES = new Set(['TBA', 'TBD', 'N/A', ''])

/**
 * TournamentBracket — Visual KO bracket using CSS grid.
 * Each stage shows slots for predicted teams.
 */
export default function TournamentBracket({ tips, stages, onSave, teamOptions, teamLogos, locked }: Props) {
  const [saving, setSaving] = useState<string | null>(null)

  const tipMap: Record<string, BracketTip> = {}
  tips.forEach(t => { tipMap[`${t.stage}_${t.position}`] = t })

  // Real, selectable teams only (drop "TBA" placeholders + dedupe).
  const realTeamOptions = [...new Set(teamOptions.filter(t => !NON_TEAM_VALUES.has(t)))].sort()

  // Bracket scoring summary.
  const totalPoints = tips.reduce((s, t) => s + (t.points_earned || 0), 0)
  const correctCount = tips.filter(t => t.is_correct === true).length
  const isScored = tips.some(t => t.is_correct !== null)

  if (stages.length === 0) {
    return (
      <div style={{ textAlign: 'center', padding: '40px 16px' }}>
        <p style={{ fontSize: 40, lineHeight: 1, marginBottom: 12 }}>🏆</p>
        <p style={{ fontSize: 14, color: 'var(--text-primary)', fontWeight: 600, marginBottom: 6 }}>
          Turnierbaum wird nach der Gruppenphase freigeschaltet
        </p>
        <p style={{ fontSize: 12, color: 'var(--text-muted)', maxWidth: 280, margin: '0 auto', lineHeight: 1.45 }}>
          Sobald die Achtelfinal-Paarungen feststehen, kannst du hier deine Tipps für die K.o.-Runde abgeben.
        </p>
      </div>
    )
  }

  return (
    <div>
      {/* ── Scoring banner ── */}
      <div style={{
        margin: '0 16px 12px', padding: '10px 14px', borderRadius: 12,
        background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12,
      }}>
        <div style={{ minWidth: 0 }}>
          <p style={{
            margin: 0, fontSize: 11, fontFamily: 'var(--font-display)', fontWeight: 700,
            color: 'var(--gold-primary)', letterSpacing: 1, textTransform: 'uppercase',
          }}>
            {POINTS_PER_HIT} Punkte je richtig getipptem Team
          </p>
          <p style={{ margin: '3px 0 0', fontSize: 11, color: 'var(--text-muted)', lineHeight: 1.4 }}>
            {isScored
              ? `${correctCount} Treffer · pro Runde zählt jedes Team einmal`
              : 'Wird nach jeder K.o.-Runde automatisch ausgewertet.'}
          </p>
        </div>
        <div style={{
          flexShrink: 0, textAlign: 'center', background: 'rgba(34,197,94,0.10)',
          border: '1px solid rgba(34,197,94,0.30)', borderRadius: 10, padding: '6px 12px',
        }}>
          <p style={{ margin: 0, fontSize: 18, fontWeight: 700, fontFamily: 'var(--font-display)', color: '#22C55E', lineHeight: 1 }}>
            {totalPoints}
          </p>
          <p style={{ margin: '2px 0 0', fontSize: 9, color: 'var(--text-muted)', letterSpacing: 0.5 }}>PUNKTE</p>
        </div>
      </div>

      <div style={{ padding: '0 0 8px', overflowX: 'auto', WebkitOverflowScrolling: 'touch' }}>
        <div style={{
          display: 'flex', gap: 16, minWidth: stages.length * 160,
          alignItems: 'flex-start', padding: '0 16px',
        }}>
          {stages.map(stage => {
            const positions = STAGE_POSITIONS[stage] || 2
            const label = STAGE_LABELS[stage] || stage

            // Teams already picked elsewhere in THIS stage — a team can only
            // advance once per round, so it must not be selectable twice here.
            // (Across different stages the same team may legitimately repeat.)
            const takenInStage = new Set(
              tips.filter(t => t.stage === stage && t.predicted_team_name)
                .map(t => t.predicted_team_name as string)
            )

            return (
              <div key={stage} style={{ flex: 1, minWidth: 140 }}>
                {/* Stage header */}
                <div style={{
                  textAlign: 'center', padding: '8px 0', marginBottom: 8,
                  borderBottom: '1px solid var(--border-subtle)',
                }}>
                  <span style={{
                    fontSize: 11, fontFamily: 'var(--font-display)', fontWeight: 700,
                    color: 'var(--gold-primary)', letterSpacing: 1, textTransform: 'uppercase',
                  }}>
                    {label}
                  </span>
                </div>

                {/* Slots */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {Array.from({ length: positions }, (_, i) => {
                    const key = `${stage}_${i}`
                    const tip = tipMap[key]
                    const predicted = tip?.predicted_team_name || ''
                    const actual = tip?.actual_team_name
                    const isCorrect = tip?.is_correct
                    const points = tip?.points_earned || 0

                    // Exclude teams already taken in this stage, except this slot's own pick.
                    const slotOptions = realTeamOptions.filter(o => o === predicted || !takenInStage.has(o))

                    return (
                      <div key={key} style={{
                        background: 'var(--bg-surface)',
                        border: isCorrect === true ? '1px solid #22C55E'
                          : isCorrect === false ? '1px solid var(--status-error)'
                          : '1px solid var(--border-subtle)',
                        borderRadius: 10, padding: '8px 10px',
                      }}>
                        {locked || predicted ? (
                          <div style={{ display: 'flex', alignItems: 'center', gap: 6, justifyContent: 'space-between' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 6, minWidth: 0, flex: 1 }}>
                              {predicted && teamLogos?.[predicted] && (
                                <img src={teamLogos[predicted]} alt="" style={{ width: 18, height: 18, objectFit: 'contain', flexShrink: 0 }} />
                              )}
                              <span style={{
                                fontSize: 12, fontWeight: 600,
                                color: predicted ? 'var(--text-primary)' : 'var(--text-muted)',
                                overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                              }}>
                                {predicted || '–'}
                              </span>
                            </div>
                            {isCorrect === true && (
                              <span style={{ display: 'flex', alignItems: 'center', gap: 3, flexShrink: 0 }}>
                                {points > 0 && (
                                  <span style={{ fontSize: 10, fontWeight: 700, color: '#22C55E', fontFamily: 'var(--font-display)' }}>
                                    +{points}
                                  </span>
                                )}
                                <span style={{ fontSize: 14, color: '#22C55E' }}>✓</span>
                              </span>
                            )}
                            {isCorrect === false && <span style={{ fontSize: 14, color: 'var(--status-error)', flexShrink: 0 }}>✗</span>}
                            {actual && actual !== predicted && (
                              <span style={{ fontSize: 10, color: 'var(--text-muted)', flexShrink: 0 }}>
                                ({actual})
                              </span>
                            )}
                          </div>
                        ) : (
                          <select
                            value={predicted}
                            onChange={async (e) => {
                              if (!e.target.value) return
                              setSaving(key)
                              await onSave(stage, i, e.target.value)
                              setSaving(null)
                            }}
                            disabled={saving === key}
                            style={{
                              width: '100%', padding: '4px 6px',
                              background: 'var(--input-bg)', border: '1px solid var(--input-border)',
                              borderRadius: 6, color: 'var(--input-text)', fontSize: 12,
                              outline: 'none', boxSizing: 'border-box',
                            }}
                          >
                            <option value="">Wählen...</option>
                            {slotOptions.map(t => (
                              <option key={t} value={t}>{t}</option>
                            ))}
                          </select>
                        )}
                      </div>
                    )
                  })}
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
