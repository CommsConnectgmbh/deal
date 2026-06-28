// Supabase Edge Function: cron-score-groups
// Server-side scheduler entrypoint. For every competition-linked tip group with
// relevant activity it runs the full scoring pipeline IN ORDER, awaiting each step:
//   1. sync-league-matches  — pull fresh fixtures/scores from football-data.org
//   2. resolve-matchday     — score tips for every FINISHED-but-unresolved matchday
//      (numeric matchdays) AND every FINISHED-but-unresolved KO stage (matchday-null
//      cup fixtures, scored by competition_stage with the same exact/diff/tendency logic)
//
// It reuses the exact same edge functions the client triggers, so the scoring
// logic lives in exactly one place (no drift). Those functions accept a trusted
// internal call when the Authorization bearer is the service-role key.
//
// Auth: invoked by pg_cron via pg_net with header `x-cron-secret: <secret>`, where
// the secret lives in the RLS-locked public.app_secrets table (only the postgres /
// service_role roles can read it). verify_jwt is disabled; we validate the header
// against that stored secret. Calls to the sub-functions use the service-role key.

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

const FINISHED_STATES = ['FINISHED', 'AWARDED']

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
    const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

    const supabase = createClient(SUPABASE_URL, SERVICE_KEY)

    // Only the scheduler may invoke this: validate the shared secret (RLS-locked,
    // readable only by the service role) against the x-cron-secret header.
    const { data: secretRow } = await supabase
      .from('app_secrets')
      .select('value')
      .eq('key', 'cron_secret')
      .single()
    const provided = req.headers.get('x-cron-secret') || ''
    if (!secretRow?.value || provided !== secretRow.value) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: corsHeaders })
    }
    const internalHeaders = {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${SERVICE_KEY}`,
    }
    const call = (fn: string, body: Record<string, unknown>) =>
      fetch(`${SUPABASE_URL}/functions/v1/${fn}`, { method: 'POST', headers: internalHeaders, body: JSON.stringify(body) })

    // Candidate groups: competition-linked AND with at least one question that is
    // still in play, recently kicked off, or finished-but-unscored. This keeps the
    // football-data.org call count bounded to groups that actually need attention.
    const { data: groups } = await supabase
      .from('tip_groups')
      .select('id, competition_code, season_year, competition_type, last_synced_at')
      .not('competition_code', 'is', null)

    const nowMs = Date.now()
    const windowStart = new Date(nowMs - 24 * 60 * 60 * 1000).toISOString() // 24h ago
    const windowEnd = new Date(nowMs + 3 * 60 * 60 * 1000).toISOString()    // 3h ahead
    // TBA-Paarungen ändern sich höchstens 1× pro Spiel — alle 15 min die
    // football-data.org-API zu pollen wäre Verschwendung und kratzt am
    // Rate-Limit. Eine Stunde Cool-down pro Gruppe reicht völlig.
    const TBA_SYNC_COOLDOWN_MS = 60 * 60 * 1000

    const results: Array<Record<string, unknown>> = []

    for (const g of groups || []) {
      // Turnier-/Cup-Gruppen mit unresolved TBA-Paarungen werden auch außerhalb
      // des Aktivitätsfensters synchronisiert (gedrosselt, s.o.), damit gerade
      // festgelegte K.o.-Pairings ins System fließen.
      const isTournament = g.competition_type === 'TOURNAMENT' || g.competition_type === 'CUP'
      const lastSyncMs = g.last_synced_at ? new Date(g.last_synced_at).getTime() : 0
      const tbaCheckDue = nowMs - lastSyncMs >= TBA_SYNC_COOLDOWN_MS
      let hasTbaPairing = false
      if (isTournament && tbaCheckDue) {
        const { data: tbaRow } = await supabase
          .from('tip_questions')
          .select('id')
          .eq('group_id', g.id)
          .neq('status', 'resolved')
          .neq('status', 'cancelled')
          .or('home_team.eq.TBA,away_team.eq.TBA')
          .limit(1)
        hasTbaPairing = !!tbaRow && tbaRow.length > 0
      }

      // Is this group relevant right now (in-window oder gerade fertig)?
      const { data: live } = await supabase
        .from('tip_questions')
        .select('id')
        .eq('group_id', g.id)
        .neq('status', 'resolved')
        .neq('status', 'cancelled')
        .or(`match_status.in.(${FINISHED_STATES.join(',')}),and(match_utc_date.gte.${windowStart},match_utc_date.lte.${windowEnd})`)
        .limit(1)
      const hasLive = !!live && live.length > 0

      if (!hasTbaPairing && !hasLive) continue

      try {
        // 1. Pull fresh fixtures/scores (awaited so the DB is current for step 2).
        await call('sync-league-matches', {
          group_id: g.id,
          competition_code: g.competition_code,
          season: g.season_year || '2025',
        })

        // 2a. Score every FINISHED-but-unresolved numeric matchday.
        const { data: unresolvedMd } = await supabase
          .from('tip_questions')
          .select('matchday')
          .eq('group_id', g.id)
          .in('match_status', FINISHED_STATES)
          .neq('status', 'resolved')
          .not('matchday', 'is', null)

        const matchdays = [...new Set((unresolvedMd || []).map(q => q.matchday))]
        for (const md of matchdays) {
          await call('resolve-matchday', { group_id: g.id, matchday: md })
        }

        // 2b. Score every FINISHED-but-unresolved KO stage (matchday IS NULL).
        const { data: unresolvedKo } = await supabase
          .from('tip_questions')
          .select('competition_stage')
          .eq('group_id', g.id)
          .in('match_status', FINISHED_STATES)
          .neq('status', 'resolved')
          .is('matchday', null)
          .not('competition_stage', 'is', null)

        const stages = [...new Set((unresolvedKo || []).map(q => q.competition_stage))]
        for (const st of stages) {
          await call('resolve-matchday', { group_id: g.id, stage: st })
        }

        // 3. Auto-Auflösung der „Sieger Gruppe X"-Bonusfragen, sobald die jeweilige
        //    Gruppenphase komplett resolved ist — schreibt korrekten Sieger,
        //    bepunktet Tipps und faltet die Bonus-Punkte in tip_group_members ein.
        const bonusRes = await call('resolve-bonus-auto', { group_id: g.id })
          .then(r => r.json()).catch(() => ({}))

        results.push({
          group_id: g.id,
          resolved_matchdays: matchdays,
          resolved_stages: stages,
          resolved_bonus: bonusRes?.resolved || 0,
        })
      } catch (e) {
        results.push({ group_id: g.id, error: String((e as Error).message || e) })
      }
    }

    return new Response(JSON.stringify({ processed: results.length, results }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (err) {
    return new Response(JSON.stringify({ error: (err as Error).message }), { status: 500, headers: corsHeaders })
  }
})
