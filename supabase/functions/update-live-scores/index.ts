// Supabase Edge Function: update-live-scores
// Fetches current match scores from football-data.org and updates tip_questions
// POST { group_id } or { competition_code }

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

    const body = await req.json()
    const { group_id } = body

    if (!group_id) {
      return new Response(JSON.stringify({ error: 'group_id required' }), { status: 400, headers: corsHeaders })
    }

    // Get group info
    const { data: group } = await supabase
      .from('tip_groups')
      .select('competition_code, season_year')
      .eq('id', group_id)
      .single()

    if (!group || !group.competition_code) {
      return new Response(JSON.stringify({ error: 'Group has no competition linked' }), { status: 400, headers: corsHeaders })
    }

    // Fetch today's matches for this competition
    const apiKey = Deno.env.get('FOOTBALL_DATA_API_KEY')
    if (!apiKey) {
      return new Response(JSON.stringify({ error: 'FOOTBALL_DATA_API_KEY not configured' }), { status: 500, headers: corsHeaders })
    }

    // Get matches for today and yesterday (to catch late updates)
    const today = new Date()
    const yesterday = new Date(today.getTime() - 24 * 60 * 60 * 1000)
    const dateFrom = yesterday.toISOString().split('T')[0]
    const dateTo = today.toISOString().split('T')[0]

    const url = `https://api.football-data.org/v4/competitions/${group.competition_code}/matches?dateFrom=${dateFrom}&dateTo=${dateTo}`

    const apiRes = await fetch(url, {
      headers: { 'X-Auth-Token': apiKey }
    })

    if (!apiRes.ok) {
      const errText = await apiRes.text()
      return new Response(JSON.stringify({ error: `API error: ${apiRes.status}`, details: errText }), { status: 502, headers: corsHeaders })
    }

    const apiData = await apiRes.json()
    const matches = apiData.matches || []

    let updated = 0
    let nowLive = 0
    let justFinished = 0

    for (const m of matches) {
      const matchApiId = String(m.id)
      const matchStatus = m.status || 'SCHEDULED'
      const homeScore = m.score?.fullTime?.home ?? null
      const awayScore = m.score?.fullTime?.away ?? null
      const halftimeHome = m.score?.halfTime?.home ?? null
      const halftimeAway = m.score?.halfTime?.away ?? null
      const matchMinute = m.minute ?? null
      const isLive = ['IN_PLAY', 'PAUSED', 'HALFTIME'].includes(matchStatus)
      const isFinished = ['FINISHED', 'AWARDED'].includes(matchStatus)

      if (isLive) nowLive++
      if (isFinished) justFinished++

      // For live/finished matches, use the latest available score
      const displayHome = isLive ? (m.score?.fullTime?.home ?? m.score?.halfTime?.home ?? null) : homeScore
      const displayAway = isLive ? (m.score?.fullTime?.away ?? m.score?.halfTime?.away ?? null) : awayScore

      let questionStatus = 'open'
      if (isFinished) questionStatus = 'resolved'
      else if (['POSTPONED', 'CANCELLED', 'SUSPENDED'].includes(matchStatus)) questionStatus = 'cancelled'

      // Update matching tip_question
      const { data: updatedRow, error } = await supabase
        .from('tip_questions')
        .update({
          home_score: displayHome,
          away_score: displayAway,
          halftime_home: halftimeHome,
          halftime_away: halftimeAway,
          match_status: matchStatus,
          match_minute: matchMinute,
          is_live: isLive,
          status: questionStatus,
          last_updated_at: new Date().toISOString(),
        })
        .eq('group_id', group_id)
        .eq('match_api_id', matchApiId)
        .select('id')

      if (updatedRow && updatedRow.length > 0) updated++
    }

    // Update group last_synced_at
    await supabase
      .from('tip_groups')
      .update({ last_synced_at: new Date().toISOString() })
      .eq('id', group_id)

    return new Response(JSON.stringify({
      updated,
      total_matches: matches.length,
      live: nowLive,
      finished: justFinished,
    }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })

  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), { status: 500, headers: corsHeaders })
  }
})
