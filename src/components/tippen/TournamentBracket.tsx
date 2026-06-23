'use client'
import { useMemo } from 'react'
import MatchCard, { MatchQuestion, TipDraft } from './MatchCard'

interface Props {
  /** All group questions; the component filters the KO stages itself. */
  questions: MatchQuestion[]
  drafts: Record<string, TipDraft>
  myAnswers: Record<string, { home_score_tip: number | null; away_score_tip: number | null; points_earned: number | null } | undefined>
  onDraftChange: (qId: string, patch: Partial<TipDraft>) => void
}

/** KO stages in bracket order, earliest round first. */
const KO_STAGE_ORDER = [
  'LAST_32', 'ROUND_OF_32',
  'LAST_16', 'ROUND_OF_16',
  'QUARTER_FINALS',
  'SEMI_FINALS',
  'THIRD_PLACE',
  'FINAL',
]
const KO_STAGES = new Set(KO_STAGE_ORDER)

const STAGE_LABELS: Record<string, string> = {
  LAST_32: 'Sechzehntelfinale',
  ROUND_OF_32: 'Sechzehntelfinale',
  LAST_16: 'Achtelfinale',
  ROUND_OF_16: 'Achtelfinale',
  QUARTER_FINALS: 'Viertelfinale',
  SEMI_FINALS: 'Halbfinale',
  THIRD_PLACE: 'Spiel um Platz 3',
  FINAL: 'Finale',
}

/** Placeholder names that come from the fixture sync but are not real teams. */
const NON_TEAM = new Set(['TBA', 'TBD', 'N/A', ''])
function teamKnown(name: string | null | undefined) {
  return !!name && !NON_TEAM.has(name)
}
function deadlinePassed(iso: string) { return new Date(iso).getTime() < Date.now() }

function formatKickoff(iso: string | null): string {
  if (!iso) return 'Termin offen'
  const d = new Date(iso)
  return d.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit' }) +
    ' · ' + d.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })
}

/**
 * TournamentBracket — the real K.o.-tree (Sechzehntelfinale → Finale).
 *
 * Driven entirely by the synced fixtures (tip_questions of the KO stages). As
 * group winners are determined, football-data.org fills the pairings and the
 * tree fills up. Once a pairing stands, the match is tipped inline with the
 * exact same score inputs + scoring as the Spieltag — there is no separate
 * "who advances" prediction.
 */
export default function TournamentBracket({ questions, drafts, myAnswers, onDraftChange }: Props) {
  const stageColumns = useMemo(() => {
    const koQuestions = questions.filter(q => q.competition_stage && KO_STAGES.has(q.competition_stage))
    const byStage = new Map<string, MatchQuestion[]>()
    for (const q of koQuestions) {
      const s = q.competition_stage as string
      if (!byStage.has(s)) byStage.set(s, [])
      byStage.get(s)!.push(q)
    }
    return KO_STAGE_ORDER
      .filter(s => byStage.has(s))
      .map(stage => {
        const matches = [...byStage.get(stage)!].sort((a, b) => {
          const ta = a.match_utc_date ? new Date(a.match_utc_date).getTime() : Number.MAX_SAFE_INTEGER
          const tb = b.match_utc_date ? new Date(b.match_utc_date).getTime() : Number.MAX_SAFE_INTEGER
          return ta - tb
        })
        return { stage, label: STAGE_LABELS[stage] || stage, matches }
      })
  }, [questions])

  if (stageColumns.length === 0) {
    return (
      <div style={{ textAlign: 'center', padding: '48px 16px' }}>
        <p style={{ fontSize: 40, lineHeight: 1, marginBottom: 12 }}>🏆</p>
        <p style={{ fontSize: 14, color: 'var(--text-primary)', fontWeight: 600, marginBottom: 6 }}>
          Der Turnierbaum füllt sich nach der Gruppenphase
        </p>
        <p style={{ fontSize: 12, color: 'var(--text-muted)', maxWidth: 300, margin: '0 auto', lineHeight: 1.45 }}>
          Sobald die K.o.-Paarungen feststehen, erscheinen sie hier — und du tippst das Ergebnis direkt im Baum.
        </p>
      </div>
    )
  }

  return (
    <div>
      {/* ── Info banner ── */}
      <div style={{
        margin: '0 16px 14px', padding: '10px 14px', borderRadius: 12,
        background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)',
      }}>
        <p style={{
          margin: 0, fontSize: 11, fontFamily: 'var(--font-display)', fontWeight: 700,
          color: 'var(--gold-primary)', letterSpacing: 1, textTransform: 'uppercase',
        }}>
          K.o.-Runde
        </p>
        <p style={{ margin: '3px 0 0', fontSize: 11, color: 'var(--text-muted)', lineHeight: 1.4 }}>
          Tippe jede Partie wie im Spieltag — gleiche Punkte. Steht eine Paarung noch nicht fest,
          füllt sie sich automatisch, sobald die Sieger feststehen.
        </p>
      </div>

      {/* ── Bracket: one column per round, horizontal scroll ── */}
      <div style={{ overflowX: 'auto', WebkitOverflowScrolling: 'touch', paddingBottom: 8 }}>
        <div style={{ display: 'flex', gap: 14, alignItems: 'flex-start', padding: '0 16px', minWidth: 'min-content' }}>
          {stageColumns.map(({ stage, label, matches }) => {
            const knownCount = matches.filter(m => teamKnown(m.home_team) && teamKnown(m.away_team)).length
            return (
              <div key={stage} style={{ width: 290, flexShrink: 0 }}>
                {/* Stage header */}
                <div style={{
                  textAlign: 'center', padding: '8px 0', marginBottom: 10,
                  borderBottom: '1px solid var(--border-subtle)',
                }}>
                  <span style={{
                    fontSize: 11, fontFamily: 'var(--font-display)', fontWeight: 700,
                    color: 'var(--gold-primary)', letterSpacing: 1, textTransform: 'uppercase',
                  }}>
                    {label}
                  </span>
                  <span style={{ display: 'block', fontSize: 9, color: 'var(--text-muted)', marginTop: 2, letterSpacing: 0.5 }}>
                    {knownCount}/{matches.length} Paarungen
                  </span>
                </div>

                {/* Matches */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
                  {matches.map(q => {
                    const isSet = teamKnown(q.home_team) && teamKnown(q.away_team)
                    if (isSet) {
                      return (
                        <MatchCard
                          key={q.id}
                          q={q}
                          draft={drafts[q.id] || { homeScore: undefined, awayScore: undefined }}
                          existingTip={myAnswers[q.id] || null}
                          locked={deadlinePassed(q.deadline)}
                          resolved={q.status === 'resolved'}
                          onDraftChange={patch => onDraftChange(q.id, patch)}
                        />
                      )
                    }
                    // Undrawn pairing — placeholder slot, fills in after the feeding round.
                    return (
                      <div key={q.id} style={{
                        background: 'var(--bg-surface)',
                        border: '1px dashed var(--border-subtle)',
                        borderRadius: 14, padding: '16px 14px', marginBottom: 10,
                        textAlign: 'center',
                      }}>
                        <p style={{
                          margin: 0, fontSize: 12, fontWeight: 600, color: 'var(--text-muted)',
                          fontFamily: 'var(--font-display)', letterSpacing: 0.5,
                        }}>
                          Paarung steht noch nicht fest
                        </p>
                        <p style={{ margin: '6px 0 0', fontSize: 10, color: 'var(--text-muted)', letterSpacing: 0.3 }}>
                          {formatKickoff(q.match_utc_date)}
                        </p>
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
