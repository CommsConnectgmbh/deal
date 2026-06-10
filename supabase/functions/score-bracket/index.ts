// Supabase Edge Function: score-bracket
// Scores tournament-bracket tips server-authoritatively.
// A bracket tip is correct when the predicted team actually advanced from that
// round (i.e. it is a participant of the following stage; for FINAL/THIRD_PLACE
// the winner of that match). Each correctly predicted team is worth 3 points,
// counted at most once per stage (so duplicate picks never double-score).
// Only group admins may invoke. POST { group_id }
//
// Idempotent: re-running re-evaluates from current fixture data.

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

const POINTS_PER_HIT = 3

// Which stage(s) the winners of a given stage move on to. Covers both naming
// variants used across competitions. Terminal stages (FINAL, THIRD_PLACE) are
// scored from their own match winner instead.
const ADVANCE_TO: Record<string, string[]> = {
  LAST_32: ['LAST_16', 'ROUND_OF_16'],
  ROUND_OF_32: ['LAST_16', 'ROUND_OF_16'],
  LAST_16: ['QUARTER_FINALS'],
  ROUND_OF_16: ['QUARTER_FINALS'],
  QUARTER_FINALS: ['SEMI_FINALS'],
  SEMI_FINALS: ['FINAL'],
}
const TERMINAL_STAGES = new Set(['FINAL', 'THIRD_PLACE'])
const NON_TEAM = new Set(['TBA', 'TBD', 'N/A', ''])

interface KoQuestion {
  competition_stage: string | null
  home_team: string | null
  away_team: string | null
  home_score: number | null
  away_score: number | null
  match_status: string | null
}

function isReal(team: string | null | undefined): team is string {
  return !!team && !NON_TEAM.has(team)
}

function isFinished(q: KoQuestion): boolean {
  return ['FINISHED', 'AWARDED'].includes(q.match_status || '') &&
    q.home_score !== null && q.away_score !== null
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    )

    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Missing Authorization header' }), { status: 401, headers: corsHeaders })
    }
    const token = authHeader.replace('Bearer ', '')
    const { data: { user }, error: authError } = await supabase.auth.getUser(token)
    if (authError || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: corsHeaders })
    }

    const { group_id } = await req.json()
    if (!group_id) {
      return new Response(JSON.stringify({ error: 'group_id required' }), { status: 400, headers: corsHeaders })
    }

    // Verify admin
    const { data: membership } = await supabase
      .from('tip_group_members')
      .select('role')
      .eq('group_id', group_id)
      .eq('user_id', user.id)
      .single()
    if (!membership || membership.role !== 'admin') {
      return new Response(JSON.stringify({ error: 'Only group admins can score the bracket' }), { status: 403, headers: corsHeaders })
    }

    // Load all KO questions for the group
    const { data: koQuestions } = await supabase
      .from('tip_questions')
      .select('competition_stage, home_team, away_team, home_score, away_score, match_status')
      .eq('group_id', group_id)
      .in('competition_stage', [
        'LAST_32', 'ROUND_OF_32', 'LAST_16', 'ROUND_OF_16',
        'QUARTER_FINALS', 'SEMI_FINALS', 'THIRD_PLACE', 'FINAL',
      ])

    const questionsByStage: Record<string, KoQuestion[]> = {}
    for (const q of (koQuestions || []) as KoQuestion[]) {
      const s = q.competition_stage || ''
      ;(questionsByStage[s] ||= []).push(q)
    }

    // Build the "correct set" per stage — the teams that actually advanced.
    // A stage is only scorable once that information exists.
    const correctByStage: Record<string, Set<string>> = {}
    const stageScorable: Record<string, boolean> = {}

    const allStages = new Set([
      ...Object.keys(ADVANCE_TO),
      ...TERMINAL_STAGES,
    ])

    for (const stage of allStages) {
      if (TERMINAL_STAGES.has(stage)) {
        const matches = questionsByStage[stage] || []
        const set = new Set<string>()
        let scorable = false
        for (const m of matches) {
          if (!isFinished(m)) continue
          if (m.home_score === m.away_score) continue // undecided (e.g. penalties not captured)
          const winner = (m.home_score! > m.away_score!) ? m.home_team : m.away_team
          if (isReal(winner)) { set.add(winner); scorable = true }
        }
        correctByStage[stage] = set
        stageScorable[stage] = scorable
      } else {
        // Winners advance to the next stage → they are the real participants there.
        const nextStages = ADVANCE_TO[stage]
        const set = new Set<string>()
        for (const ns of nextStages) {
          for (const m of (questionsByStage[ns] || [])) {
            if (isReal(m.home_team)) set.add(m.home_team)
            if (isReal(m.away_team)) set.add(m.away_team)
          }
        }
        correctByStage[stage] = set
        stageScorable[stage] = set.size > 0
      }
    }

    // Load all bracket tips for the group
    const { data: tips } = await supabase
      .from('tip_bracket_tips')
      .select('id, user_id, stage, position, predicted_team_name')
      .eq('group_id', group_id)
      .order('position', { ascending: true })

    // Per (user, stage) track which correct teams already scored, to dedupe.
    const counted: Record<string, Set<string>> = {}
    const affectedUsers = new Set<string>()
    let scoredRows = 0

    for (const tip of (tips || [])) {
      affectedUsers.add(tip.user_id)
      const stage = tip.stage
      if (!stageScorable[stage]) continue // not resolvable yet → leave untouched

      const team = tip.predicted_team_name
      const set = correctByStage[stage] || new Set()
      const ckey = `${tip.user_id}_${stage}`
      const seen = (counted[ckey] ||= new Set())

      let isCorrect = false
      let points = 0
      if (isReal(team) && set.has(team)) {
        isCorrect = true
        if (!seen.has(team)) { points = POINTS_PER_HIT; seen.add(team) }
      }

      await supabase
        .from('tip_bracket_tips')
        .update({ is_correct: isCorrect, points_earned: points })
        .eq('id', tip.id)
      scoredRows++
    }

    // Fold each affected user's bracket total into total_points via a synthetic
    // 'bracket' bucket, then recompute total = sum of all buckets.
    for (const userId of affectedUsers) {
      const { data: userTips } = await supabase
        .from('tip_bracket_tips')
        .select('points_earned')
        .eq('group_id', group_id)
        .eq('user_id', userId)
      const bracketTotal = (userTips || []).reduce((s, t) => s + (t.points_earned || 0), 0)

      const { data: member } = await supabase
        .from('tip_group_members')
        .select('points_by_matchday')
        .eq('group_id', group_id)
        .eq('user_id', userId)
        .single()
      if (!member) continue

      const byMatchday = (member.points_by_matchday as Record<string, number>) || {}
      byMatchday['bracket'] = bracketTotal
      const newTotal = Object.values(byMatchday).reduce((sum, p) => sum + (p || 0), 0)

      await supabase
        .from('tip_group_members')
        .update({ total_points: newTotal, points_by_matchday: byMatchday })
        .eq('group_id', group_id)
        .eq('user_id', userId)
    }

    const scorableStages = Object.keys(stageScorable).filter(s => stageScorable[s])

    return new Response(JSON.stringify({
      scored_rows: scoredRows,
      users_updated: affectedUsers.size,
      scorable_stages: scorableStages,
    }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })

  } catch (err) {
    return new Response(JSON.stringify({ error: (err as Error).message }), { status: 500, headers: corsHeaders })
  }
})
