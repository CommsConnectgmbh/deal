// Supabase Edge Function: resolve-matchday
// Calculates points for all tips in a matchday using group's scoring config.
// POST { group_id, matchday }            — score one numeric matchday (league / group phase)
// POST { group_id, stage }               — score one KO stage (matchday-null cup fixtures)
//
// KO matches synced from football-data.org carry matchday=null and only a
// competition_stage (LAST_16, QUARTER_FINALS, FINAL, …). They are scored with
// the SAME exact/diff/tendency logic as every other match; their points are
// bucketed under the stage key in points_by_matchday (e.g. 'QUARTER_FINALS')
// so they add to total_points without polluting the numeric matchday columns.

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    )

    // Trusted internal/cron invocation: Authorization carries the service-role key.
    // Such calls skip the per-user JWT + admin checks (the scheduler is authoritative).
    const authHeader = req.headers.get('Authorization')
    const token = (authHeader || '').replace('Bearer ', '')
    const isInternal = !!token && token === Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')

    let user: { id: string } | null = null
    if (!isInternal) {
      if (!authHeader) {
        return new Response(JSON.stringify({ error: 'Missing Authorization header' }), { status: 401, headers: corsHeaders })
      }
      const { data, error: authError } = await supabase.auth.getUser(token)
      user = data.user
      if (authError || !user) {
        return new Response(JSON.stringify({ error: 'Unauthorized', details: authError?.message }), { status: 401, headers: corsHeaders })
      }
    }

    const { group_id, matchday, stage } = await req.json()
    if (!group_id || (matchday === undefined && !stage)) {
      return new Response(JSON.stringify({ error: 'group_id and (matchday or stage) required' }), { status: 400, headers: corsHeaders })
    }

    // Bucket key under which points land in points_by_matchday: the numeric
    // matchday for league/group fixtures, or the stage name for KO fixtures.
    const bucketKey = stage ? String(stage) : String(matchday)

    // Verify admin (skipped for trusted internal/cron calls)
    if (!isInternal) {
      const { data: membership } = await supabase
        .from('tip_group_members')
        .select('role')
        .eq('group_id', group_id)
        .eq('user_id', user!.id)
        .single()

      if (!membership || membership.role !== 'admin') {
        return new Response(JSON.stringify({ error: 'Only admins can resolve matchdays' }), { status: 403, headers: corsHeaders })
      }
    }

    // Get group scoring config
    const { data: group } = await supabase
      .from('tip_groups')
      .select('points_exact, points_diff, points_tendency')
      .eq('id', group_id)
      .single()

    if (!group) {
      return new Response(JSON.stringify({ error: 'Group not found' }), { status: 404, headers: corsHeaders })
    }

    const { points_exact, points_diff, points_tendency } = group

    // Get all FINISHED questions for this matchday (numeric) or KO stage.
    // For a stage we restrict to matchday IS NULL so a KO fixture that also
    // happens to carry a matchday is only ever scored once (via the numeric path).
    let questionQuery = supabase
      .from('tip_questions')
      .select('id, home_score, away_score, extratime_home, extratime_away, match_duration, match_winner, match_status')
      .eq('group_id', group_id)
    questionQuery = stage
      ? questionQuery.eq('competition_stage', stage).is('matchday', null)
      : questionQuery.eq('matchday', matchday)
    const { data: questions } = await questionQuery

    if (!questions || questions.length === 0) {
      return new Response(JSON.stringify({ error: 'No questions found for this matchday/stage' }), { status: 404, headers: corsHeaders })
    }

    const finishedQuestions = questions.filter(q =>
      ['FINISHED', 'AWARDED'].includes(q.match_status || '') &&
      q.home_score !== null && q.away_score !== null
    )

    if (finishedQuestions.length === 0) {
      return new Response(JSON.stringify({ error: 'No finished matches in this matchday', total: questions.length }), { status: 400, headers: corsHeaders })
    }

    let totalResolved = 0
    const userPoints: Record<string, number> = {}

    // In einer K.o.-Runde (stage gesetzt) kann es kein Unentschieden geben — es
    // wird IMMER ein Sieger ermittelt (Verlängerung / Elfmeterschießen). Darum
    // gilt hier eine andere Wertung als in der Liga/Gruppenphase:
    //   • Gewertet wird das ENDERGEBNIS, d.h. der Stand nach Verlängerung (120').
    //     home_score/away_score = 90'-Stand, extratime_* = Tore der Verlängerung
    //     → 120'-Endstand = home_score + extratime.
    //   • Der Sieger steht über match_winner fest (HOME_TEAM | AWAY_TEAM).
    //   • Ein Unentschieden-Tipp ist in der K.o. nicht erlaubt (UI sperrt das) und
    //     kann nie „exakt" sein, weil das Endergebnis immer einen Sieger hat.
    // In der Gruppenphase/Liga bleibt es beim Kicktipp-Standard (90'-Stand, Remis ok).
    const isKo = !!stage
    for (const q of finishedQuestions) {
      const actualHome = isKo ? q.home_score! + (q.extratime_home ?? 0) : q.home_score!
      const actualAway = isKo ? q.away_score! + (q.extratime_away ?? 0) : q.away_score!
      const actualDiff = actualHome - actualAway
      const tendencyFromWinner = q.match_winner === 'HOME_TEAM' ? 'home'
        : q.match_winner === 'AWAY_TEAM' ? 'away'
        : q.match_winner === 'DRAW' ? 'draw' : null
      const actualTendency = tendencyFromWinner
        ?? (actualHome > actualAway ? 'home' : actualHome < actualAway ? 'away' : 'draw')

      // Get all tips for this question
      const { data: tips } = await supabase
        .from('tip_answers')
        .select('id, user_id, home_score_tip, away_score_tip')
        .eq('question_id', q.id)

      if (!tips) continue

      for (const tip of tips) {
        if (tip.home_score_tip === null || tip.away_score_tip === null) continue

        const tipHome = tip.home_score_tip
        const tipAway = tip.away_score_tip
        const tipDiff = tipHome - tipAway
        const tipTendency = tipHome > tipAway ? 'home' : tipHome < tipAway ? 'away' : 'draw'

        let points = 0

        if (tipHome === actualHome && tipAway === actualAway) {
          // Exact match
          points = points_exact
        } else if (tipDiff === actualDiff) {
          // Correct goal difference
          points = points_diff
        } else if (tipTendency === actualTendency) {
          // Correct tendency (home/away/draw)
          points = points_tendency
        }

        // Update tip_answers.points_earned
        await supabase
          .from('tip_answers')
          .update({ points_earned: points })
          .eq('id', tip.id)

        // Accumulate per-user points
        if (!userPoints[tip.user_id]) userPoints[tip.user_id] = 0
        userPoints[tip.user_id] += points
      }

      // Mark question as resolved
      await supabase
        .from('tip_questions')
        .update({ status: 'resolved' })
        .eq('id', q.id)

      totalResolved++
    }

    // Update tip_group_members: total_points and points_by_matchday
    for (const [userId, pts] of Object.entries(userPoints)) {
      // Get current member data
      const { data: member } = await supabase
        .from('tip_group_members')
        .select('total_points, points_by_matchday')
        .eq('group_id', group_id)
        .eq('user_id', userId)
        .single()

      if (!member) continue

      const byMatchday = (member.points_by_matchday as Record<string, number>) || {}
      byMatchday[bucketKey] = pts

      // Recalculate total from all matchdays
      const newTotal = Object.values(byMatchday).reduce((sum, p) => sum + p, 0)

      await supabase
        .from('tip_group_members')
        .update({
          total_points: newTotal,
          points_by_matchday: byMatchday,
        })
        .eq('group_id', group_id)
        .eq('user_id', userId)
    }

    return new Response(JSON.stringify({
      resolved: totalResolved,
      bucket: bucketKey,
      total_questions: questions.length,
      finished: finishedQuestions.length,
      users_scored: Object.keys(userPoints).length,
      points_summary: userPoints,
    }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })

  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), { status: 500, headers: corsHeaders })
  }
})
