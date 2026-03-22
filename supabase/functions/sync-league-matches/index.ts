// Supabase Edge Function: sync-league-matches
// Fetches matches from football-data.org and upserts into tip_questions
// POST { group_id, competition_code, season, matchday? }

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

    const { group_id, competition_code, season, matchday } = await req.json()

    if (!group_id || !competition_code) {
      return new Response(JSON.stringify({ error: 'group_id and competition_code required' }), { status: 400, headers: corsHeaders })
    }

    // Verify user is admin of this group
    const { data: membership } = await supabase
      .from('tip_group_members')
      .select('role')
      .eq('group_id', group_id)
      .eq('user_id', user.id)
      .single()

    if (!membership || membership.role !== 'admin') {
      return new Response(JSON.stringify({ error: 'Only admins can sync matches' }), { status: 403, headers: corsHeaders })
    }

    // Fetch from football-data.org
    const apiKey = Deno.env.get('FOOTBALL_DATA_API_KEY')
    if (!apiKey) {
      return new Response(JSON.stringify({ error: 'FOOTBALL_DATA_API_KEY not configured' }), { status: 500, headers: corsHeaders })
    }

    let url = `https://api.football-data.org/v4/competitions/${competition_code}/matches`
    const params = new URLSearchParams()
    if (season) params.set('season', season)
    if (matchday) params.set('matchday', String(matchday))
    if (params.toString()) url += '?' + params.toString()

    const apiRes = await fetch(url, {
      headers: { 'X-Auth-Token': apiKey }
    })

    if (!apiRes.ok) {
      const errText = await apiRes.text()
      return new Response(JSON.stringify({ error: `football-data.org error: ${apiRes.status}`, details: errText }), { status: 502, headers: corsHeaders })
    }

    const apiData = await apiRes.json()
    const matches = apiData.matches || []

    if (matches.length === 0) {
      return new Response(JSON.stringify({ synced: 0, message: 'No matches found' }), { headers: corsHeaders })
    }

    // Map and upsert matches into tip_questions
    let synced = 0
    let errors: string[] = []

    for (const m of matches) {
      const matchApiId = String(m.id)
      const homeTeam = m.homeTeam?.name || m.homeTeam?.shortName || 'TBA'
      const awayTeam = m.awayTeam?.name || m.awayTeam?.shortName || 'TBA'
      const homeShort = m.homeTeam?.tla || m.homeTeam?.shortName || homeTeam.substring(0, 3).toUpperCase()
      const awayShort = m.awayTeam?.tla || m.awayTeam?.shortName || awayTeam.substring(0, 3).toUpperCase()
      const homeLogo = m.homeTeam?.crest || null
      const awayLogo = m.awayTeam?.crest || null
      const matchUtcDate = m.utcDate || null
      const matchStatus = m.status || 'SCHEDULED'
      const matchdayNum = m.matchday || null
      const stage = m.stage || null
      const groupLabel = m.group || null

      // Scores
      const homeScore = m.score?.fullTime?.home ?? null
      const awayScore = m.score?.fullTime?.away ?? null
      const halftimeHome = m.score?.halfTime?.home ?? null
      const halftimeAway = m.score?.halfTime?.away ?? null
      const matchMinute = m.minute ?? null

      // Deadline: 1 hour before kick-off (fallback: 1 year from now)
      let deadline: string
      if (matchUtcDate) {
        const kickoff = new Date(matchUtcDate)
        deadline = new Date(kickoff.getTime() - 60 * 60 * 1000).toISOString()
      } else {
        deadline = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString()
      }

      // Build question text
      const question = `${homeTeam} vs ${awayTeam}`

      // Map football-data status to our status
      let questionStatus = 'open'
      if (['FINISHED', 'AWARDED'].includes(matchStatus)) {
        questionStatus = 'resolved'
      } else if (['POSTPONED', 'CANCELLED', 'SUSPENDED'].includes(matchStatus)) {
        questionStatus = 'cancelled'
      } else if (['IN_PLAY', 'PAUSED', 'HALFTIME'].includes(matchStatus)) {
        questionStatus = 'open' // still open but live
      }

      const isLive = ['IN_PLAY', 'PAUSED', 'HALFTIME'].includes(matchStatus)

      // Check if question already exists for this match
      const { data: existing } = await supabase
        .from('tip_questions')
        .select('id')
        .eq('group_id', group_id)
        .eq('match_api_id', matchApiId)
        .maybeSingle()

      if (existing) {
        // Update existing
        const { error } = await supabase
          .from('tip_questions')
          .update({
            question,
            home_team: homeTeam,
            away_team: awayTeam,
            home_team_logo: homeLogo,
            away_team_logo: awayLogo,
            home_team_short: homeShort,
            away_team_short: awayShort,
            home_score: homeScore,
            away_score: awayScore,
            halftime_home: halftimeHome,
            halftime_away: halftimeAway,
            match_utc_date: matchUtcDate,
            match_status: matchStatus,
            match_minute: matchMinute,
            matchday: matchdayNum,
            competition_stage: stage,
            group_label: groupLabel,
            deadline,
            status: questionStatus,
            is_live: isLive,
            last_updated_at: new Date().toISOString(),
          })
          .eq('id', existing.id)

        if (error) errors.push(`Update ${matchApiId}: ${error.message}`)
        else synced++
      } else {
        // Insert new
        const { error } = await supabase
          .from('tip_questions')
          .insert({
            group_id,
            question,
            question_type: 'match',
            home_team: homeTeam,
            away_team: awayTeam,
            home_team_logo: homeLogo,
            away_team_logo: awayLogo,
            home_team_short: homeShort,
            away_team_short: awayShort,
            home_score: homeScore,
            away_score: awayScore,
            halftime_home: halftimeHome,
            halftime_away: halftimeAway,
            match_api_id: matchApiId,
            match_utc_date: matchUtcDate,
            match_status: matchStatus,
            match_minute: matchMinute,
            matchday: matchdayNum,
            competition_stage: stage,
            group_label: groupLabel,
            deadline,
            status: questionStatus,
            is_live: isLive,
            last_updated_at: new Date().toISOString(),
          })

        if (error) errors.push(`Insert ${matchApiId}: ${error.message}`)
        else synced++
      }
    }

    // Update group sync info
    await supabase
      .from('tip_groups')
      .update({
        competition_code,
        competition_name: apiData.competition?.name || competition_code,
        competition_id: apiData.competition?.id || null,
        season_year: season || null,
        last_synced_at: new Date().toISOString(),
      })
      .eq('id', group_id)

    return new Response(JSON.stringify({
      synced,
      total: matches.length,
      errors: errors.length > 0 ? errors : undefined,
      competition: apiData.competition?.name,
    }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })

  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), { status: 500, headers: corsHeaders })
  }
})
