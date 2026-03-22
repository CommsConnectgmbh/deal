// Supabase Edge Function: resolve-matchday
// Calculates points for all tips in a matchday using group's scoring config
// POST { group_id, matchday }

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

    // Verify authenticated user via JWT
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Missing Authorization header' }), { status: 401, headers: corsHeaders })
    }

    const token = authHeader.replace('Bearer ', '')
    const { data: { user }, error: authError } = await supabase.auth.getUser(token)

    if (authError || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized', details: authError?.message }), { status: 401, headers: corsHeaders })
    }

    const { group_id, matchday } = await req.json()
    if (!group_id || matchday === undefined) {
      return new Response(JSON.stringify({ error: 'group_id and matchday required' }), { status: 400, headers: corsHeaders })
    }

    // Verify admin
    const { data: membership } = await supabase
      .from('tip_group_members')
      .select('role')
      .eq('group_id', group_id)
      .eq('user_id', user.id)
      .single()

    if (!membership || membership.role !== 'admin') {
      return new Response(JSON.stringify({ error: 'Only admins can resolve matchdays' }), { status: 403, headers: corsHeaders })
    }

    // Get group scoring config
    const { data: group } = await supabase
      .from('tip_groups')
      .select('points_exact, points_diff, points_tendency, joker_multiplier')
      .eq('id', group_id)
      .single()

    if (!group) {
      return new Response(JSON.stringify({ error: 'Group not found' }), { status: 404, headers: corsHeaders })
    }

    const { points_exact, points_diff, points_tendency, joker_multiplier } = group

    // Get all FINISHED questions for this matchday
    const { data: questions } = await supabase
      .from('tip_questions')
      .select('id, home_score, away_score, match_status')
      .eq('group_id', group_id)
      .eq('matchday', matchday)

    if (!questions || questions.length === 0) {
      return new Response(JSON.stringify({ error: 'No questions found for this matchday' }), { status: 404, headers: corsHeaders })
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

    for (const q of finishedQuestions) {
      const actualHome = q.home_score!
      const actualAway = q.away_score!
      const actualDiff = actualHome - actualAway
      const actualTendency = actualHome > actualAway ? 'home' : actualHome < actualAway ? 'away' : 'draw'

      // Get all tips for this question
      const { data: tips } = await supabase
        .from('tip_answers')
        .select('id, user_id, home_score_tip, away_score_tip, is_joker')
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

        // Apply joker multiplier
        if (tip.is_joker && points > 0) {
          points *= joker_multiplier
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

      const currentTotal = member.total_points || 0
      const byMatchday = (member.points_by_matchday as Record<string, number>) || {}
      byMatchday[String(matchday)] = pts

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
      total_questions: questions.length,
      finished: finishedQuestions.length,
      users_scored: Object.keys(userPoints).length,
      points_summary: userPoints,
    }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })

  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), { status: 500, headers: corsHeaders })
  }
})
