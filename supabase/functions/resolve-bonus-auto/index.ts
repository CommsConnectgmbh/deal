// Supabase Edge Function: resolve-bonus-auto
// Auflösung der automatisch ableitbaren Bonus-Fragen einer Tippgruppe — aktuell
// die „Sieger Gruppe X"-Fragen, sobald alle Spiele dieser Gruppenphase resolved
// sind. Berechnet den Tabellenersten nach FIFA-Standard
// (Punkte → Tordifferenz → erzielte Tore) und ruft score-bonus-answers auf, das
// die User-Bonus-Punkte in die Rangliste einrechnet.
//
// POST { group_id }   — nur Cron (Service-Role-Bearer).

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

const FINISHED_STATES = new Set(['FINISHED', 'AWARDED'])
const GROUP_STAGES = new Set(['GROUP_STAGE', 'GROUP_PHASE'])

type Standing = { team: string; played: number; wins: number; draws: number; losses: number; gf: number; ga: number; gd: number; points: number }

function computeStandings(matches: Array<Record<string, any>>): Standing[] {
  const map = new Map<string, Standing>()
  const upsert = (team: string) => {
    let row = map.get(team)
    if (!row) { row = { team, played: 0, wins: 0, draws: 0, losses: 0, gf: 0, ga: 0, gd: 0, points: 0 }; map.set(team, row) }
    return row
  }
  for (const m of matches) {
    if (!m.home_team || !m.away_team || m.home_team === 'TBA' || m.away_team === 'TBA') continue
    const home = upsert(m.home_team)
    const away = upsert(m.away_team)
    if (m.status !== 'resolved' || m.home_score === null || m.away_score === null) continue
    home.played++; away.played++
    home.gf += m.home_score; home.ga += m.away_score
    away.gf += m.away_score; away.ga += m.home_score
    if (m.home_score > m.away_score) { home.wins++; home.points += 3; away.losses++ }
    else if (m.home_score < m.away_score) { away.wins++; away.points += 3; home.losses++ }
    else { home.draws++; away.draws++; home.points++; away.points++ }
  }
  return [...map.values()]
    .map(r => ({ ...r, gd: r.gf - r.ga }))
    .sort((a, b) => b.points - a.points || b.gd - a.gd || b.gf - a.gf || a.team.localeCompare(b.team))
}

// "Sieger Gruppe A" → "A"  / "Sieger Gruppe AB" → null (nicht erkennbar)
function parseGroupLetter(question: string): string | null {
  const m = question.match(/Gruppe\s+([A-Z])\b/i)
  return m ? m[1].toUpperCase() : null
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
    const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

    const authHeader = req.headers.get('Authorization')
    const token = (authHeader || '').replace('Bearer ', '')
    if (!token || token !== SERVICE_KEY) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: corsHeaders })
    }

    const supabase = createClient(SUPABASE_URL, SERVICE_KEY)

    const { group_id } = await req.json()
    if (!group_id) {
      return new Response(JSON.stringify({ error: 'group_id required' }), { status: 400, headers: corsHeaders })
    }

    // Offene "Sieger Gruppe X"-Bonusfragen ziehen.
    const { data: openBonus } = await supabase
      .from('tip_bonus_questions')
      .select('id, question')
      .eq('group_id', group_id)
      .eq('status', 'open')
      .ilike('question', 'Sieger Gruppe %')

    if (!openBonus || openBonus.length === 0) {
      return new Response(JSON.stringify({ resolved: 0, message: 'no open Sieger Gruppe bonus questions' }), { headers: corsHeaders })
    }

    // Alle Gruppenphasen-Spiele dieser Tippgruppe einmal laden.
    const { data: gpMatches } = await supabase
      .from('tip_questions')
      .select('home_team, away_team, home_score, away_score, status, match_status, competition_stage, group_label')
      .eq('group_id', group_id)
      .in('competition_stage', [...GROUP_STAGES])

    const byLabel = new Map<string, Array<Record<string, any>>>()
    for (const m of gpMatches || []) {
      const lbl = (m.group_label || '').toString().toUpperCase().replace(/^GROUP[_\s]+/, '')
      if (!lbl) continue
      if (!byLabel.has(lbl)) byLabel.set(lbl, [])
      byLabel.get(lbl)!.push(m)
    }

    const internalHeaders = {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${SERVICE_KEY}`,
    }
    const callScore = (question_id: string, correct_answer: string) =>
      fetch(`${SUPABASE_URL}/functions/v1/score-bonus-answers`, {
        method: 'POST', headers: internalHeaders,
        body: JSON.stringify({ question_id, correct_answer }),
      }).then(r => r.json())

    const results: Array<Record<string, unknown>> = []

    for (const q of openBonus) {
      const letter = parseGroupLetter(q.question)
      if (!letter) { results.push({ question: q.question, skipped: 'cannot parse group letter' }); continue }

      const matches = byLabel.get(letter) || []
      if (matches.length === 0) { results.push({ question: q.question, skipped: 'no matches for label' }); continue }
      const allFinished = matches.every(m =>
        FINISHED_STATES.has(m.match_status || '') && m.status === 'resolved' &&
        m.home_score !== null && m.away_score !== null
      )
      if (!allFinished) { results.push({ question: q.question, skipped: 'group not finished' }); continue }

      const standings = computeStandings(matches)
      if (standings.length < 2) { results.push({ question: q.question, skipped: 'insufficient teams' }); continue }
      // Bei echtem Gleichstand (Punkte + GD + GF identisch) keine Auto-Auflösung —
      // FIFA fordert Head-to-Head, das nehmen wir hier nicht in Anspruch.
      const top = standings[0], second = standings[1]
      if (top.points === second.points && top.gd === second.gd && top.gf === second.gf) {
        results.push({ question: q.question, skipped: 'tie requires head-to-head, manual resolve' }); continue
      }

      const res = await callScore(q.id, top.team)
      results.push({ question: q.question, group: letter, winner: top.team, scored: res?.scored ?? 0 })
    }

    return new Response(JSON.stringify({ resolved: results.filter(r => r.winner).length, results }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (err) {
    return new Response(JSON.stringify({ error: (err as Error).message }), { status: 500, headers: corsHeaders })
  }
})
