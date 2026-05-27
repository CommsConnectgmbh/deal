import { supabase } from '@/lib/supabase'

export interface SpecialsSeedTemplate {
  question: string
  answer_type: 'single_choice' | 'freetext' | 'number'
  options?: string[] | null
  points: number
  sort_order: number
}

/**
 * Standard-Wetten-Set für Turniere (WM/EM).
 * Werden 1-Klick vom Admin angelegt; Deadline = Turnier-Start.
 */
export const TOURNAMENT_SPECIALS: SpecialsSeedTemplate[] = [
  { question: 'Wer wird Weltmeister?',          answer_type: 'freetext', points: 20, sort_order: 1 },
  { question: 'Wer wird Vize-Weltmeister?',     answer_type: 'freetext', points: 10, sort_order: 2 },
  { question: 'Wer wird Dritter?',              answer_type: 'freetext', points:  7, sort_order: 3 },
  { question: 'Torschützenkönig (Name)',        answer_type: 'freetext', points: 15, sort_order: 4 },
  { question: 'Beste Defensive (Team mit wenigsten Gegentoren)', answer_type: 'freetext', points: 10, sort_order: 5 },
  { question: 'Überraschungsteam — wer kommt am weitesten?',     answer_type: 'freetext', points:  8, sort_order: 6 },
  { question: 'Anzahl Tore im Finale (beide Mannschaften zusammen)', answer_type: 'number', points: 10, sort_order: 7 },
  { question: 'Spieler des Turniers',           answer_type: 'freetext', points: 12, sort_order: 8 },
]

export const EURO_SPECIALS: SpecialsSeedTemplate[] = [
  { question: 'Wer wird Europameister?',        answer_type: 'freetext', points: 20, sort_order: 1 },
  { question: 'Wer wird Vize-Europameister?',   answer_type: 'freetext', points: 10, sort_order: 2 },
  { question: 'Torschützenkönig (Name)',        answer_type: 'freetext', points: 15, sort_order: 3 },
  { question: 'Beste Defensive (Team mit wenigsten Gegentoren)', answer_type: 'freetext', points: 10, sort_order: 4 },
  { question: 'Überraschungsteam — wer kommt am weitesten?',     answer_type: 'freetext', points:  8, sort_order: 5 },
  { question: 'Anzahl Tore im Finale (beide Mannschaften zusammen)', answer_type: 'number', points: 10, sort_order: 6 },
  { question: 'Spieler des Turniers',           answer_type: 'freetext', points: 12, sort_order: 7 },
]

export function getSpecialsForCompetition(code: string | null | undefined): SpecialsSeedTemplate[] {
  if (code === 'EC') return EURO_SPECIALS
  return TOURNAMENT_SPECIALS // WC + Fallback
}

/**
 * Insert standard tournament specials for a group.
 * @returns Anzahl angelegter Fragen (0 falls bereits welche existieren).
 */
export async function seedTournamentSpecials(
  groupId: string,
  competitionCode: string | null | undefined,
  deadlineISO: string,
): Promise<number> {
  // Idempotenz: nur seeden falls Gruppe noch keine bonus-fragen hat
  const { count } = await supabase
    .from('tip_bonus_questions')
    .select('id', { count: 'exact', head: true })
    .eq('group_id', groupId)
  if (count && count > 0) return 0

  const templates = getSpecialsForCompetition(competitionCode)
  const rows = templates.map(t => ({
    group_id: groupId,
    question: t.question,
    answer_type: t.answer_type,
    options: t.options ?? null,
    points: t.points,
    sort_order: t.sort_order,
    deadline: deadlineISO,
    status: 'open' as const,
  }))

  const { error } = await supabase.from('tip_bonus_questions').insert(rows)
  if (error) throw error
  return rows.length
}

/** Default-Deadline: Turnier-Start (contest_starts_at) oder Fallback WM 2026 Start. */
export function defaultSpecialsDeadline(contestStartsAt: string | null | undefined): string {
  if (contestStartsAt) {
    const d = new Date(contestStartsAt)
    if (!isNaN(d.getTime())) return d.toISOString()
  }
  // Fallback: WM 2026 Eröffnung 11.06.2026 18:00 UTC
  return new Date('2026-06-11T18:00:00Z').toISOString()
}
