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
  locked: boolean
}

const STAGE_LABELS: Record<string, string> = {
  'LAST_16': 'Achtelfinale',
  'ROUND_OF_16': 'Achtelfinale',
  'QUARTER_FINALS': 'Viertelfinale',
  'SEMI_FINALS': 'Halbfinale',
  'FINAL': 'Finale',
  'THIRD_PLACE': '3. Platz',
}

const STAGE_POSITIONS: Record<string, number> = {
  'LAST_16': 8,
  'ROUND_OF_16': 8,
  'QUARTER_FINALS': 4,
  'SEMI_FINALS': 2,
  'FINAL': 1,
  'THIRD_PLACE': 1,
}

/**
 * TournamentBracket — Visual KO bracket using CSS grid.
 * Each stage shows slots for predicted teams.
 */
export default function TournamentBracket({ tips, stages, onSave, teamOptions, locked }: Props) {
  const [saving, setSaving] = useState<string | null>(null)

  const tipMap: Record<string, BracketTip> = {}
  tips.forEach(t => { tipMap[`${t.stage}_${t.position}`] = t })

  if (stages.length === 0) {
    return (
      <div style={{ textAlign: 'center', padding: '40px 0' }}>
        <p style={{ fontSize: 14, color: 'var(--text-muted)' }}>Turnierbaum wird nach der Gruppenphase verfügbar.</p>
      </div>
    )
  }

  return (
    <div style={{ padding: '8px 0', overflowX: 'auto', WebkitOverflowScrolling: 'touch' }}>
      <div style={{
        display: 'flex', gap: 16, minWidth: stages.length * 160,
        alignItems: 'flex-start', padding: '0 16px',
      }}>
        {stages.map(stage => {
          const positions = STAGE_POSITIONS[stage] || 2
          const label = STAGE_LABELS[stage] || stage

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

                  return (
                    <div key={key} style={{
                      background: 'var(--bg-surface)',
                      border: isCorrect === true ? '1px solid #22C55E'
                        : isCorrect === false ? '1px solid var(--status-error)'
                        : '1px solid var(--border-subtle)',
                      borderRadius: 10, padding: '8px 10px',
                    }}>
                      {locked || predicted ? (
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                          <span style={{
                            fontSize: 12, fontWeight: 600,
                            color: predicted ? 'var(--text-primary)' : 'var(--text-muted)',
                          }}>
                            {predicted || '–'}
                          </span>
                          {isCorrect === true && <span style={{ fontSize: 14 }}>✓</span>}
                          {isCorrect === false && <span style={{ fontSize: 14 }}>✗</span>}
                          {actual && (
                            <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>
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
                          {teamOptions.map(t => (
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
  )
}
