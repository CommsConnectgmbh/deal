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

    const { group_id, competition_code, season, matchday } = await req.json()

    if (!group_id || !competition_code) {
      return new Response(JSON.stringify({ error: 'group_id and competition_code required' }), { status: 400, headers: corsHeaders })
    }

    // Verify user is admin of this group (skipped for trusted internal/cron calls)
    if (!isInternal) {
      const { data: membership } = await supabase
        .from('tip_group_members')
        .select('role')
        .eq('group_id', group_id)
        .eq('user_id', user!.id)
        .single()

      if (!membership || membership.role !== 'admin') {
        return new Response(JSON.stringify({ error: 'Only admins can sync matches' }), { status: 403, headers: corsHeaders })
      }
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

      // Scores. football-data.org liefert in v4:
      //   score.regularTime — Tore nach 90 min (NUR gesetzt bei ET/Elfmeter-Spielen)
      //   score.fullTime    — Gesamt-/Endstand INKL. Verlängerung UND Elfmeterschießen
      //                       (bei Elfmeter zählt fullTime die E11m mit, z.B. 6:4!)
      //   score.halfTime    — Tore zur Pause
      //   score.extraTime   — Tore aus der Verlängerung (nur ET-Phase)
      //   score.penalties   — Elfmeterschießen
      //   score.duration    — REGULAR | EXTRA_TIME | PENALTY_SHOOTOUT
      //   score.winner      — HOME_TEAM | AWAY_TEAM | DRAW (Gesamtsieger inkl. E11m)
      //
      // Kicktipp-Standard: exact/diff werden gegen den 90'-Stand gerechnet. Der steht
      // bei normalen Spielen in fullTime, bei ET/Elfmeter-Spielen aber in regularTime
      // (fullTime ist dort der ET-/Elfmeter-inflationierte Endstand). Darum:
      //   90'-Stand = regularTime ?? fullTime  → home_score/away_score.
      const homeScore = m.score?.regularTime?.home ?? m.score?.fullTime?.home ?? null
      const awayScore = m.score?.regularTime?.away ?? m.score?.fullTime?.away ?? null
      const halftimeHome = m.score?.halfTime?.home ?? null
      const halftimeAway = m.score?.halfTime?.away ?? null
      const extratimeHome = m.score?.extraTime?.home ?? null
      const extratimeAway = m.score?.extraTime?.away ?? null
      const matchDuration = m.score?.duration ?? null

      // Sudden-Death-Korrektur: football-data.org liefert in score.penalties manchmal
      // den 5:5-Stand vor Sudden Death und setzt erst in score.fullTime den echten
      // Pen-Endstand. Bei PENALTY_SHOOTOUT-Matches ziehen wir die echten Pens aus
      // (fullTime - regularTime - extraTime), sonst aus score.penalties.
      let penaltyHome: number | null = m.score?.penalties?.home ?? null
      let penaltyAway: number | null = m.score?.penalties?.away ?? null
      if (matchDuration === 'PENALTY_SHOOTOUT'
          && m.score?.fullTime?.home != null && m.score?.fullTime?.away != null
          && m.score?.regularTime?.home != null && m.score?.regularTime?.away != null) {
        const etH = m.score?.extraTime?.home ?? 0
        const etA = m.score?.extraTime?.away ?? 0
        const derivedH = m.score.fullTime.home - m.score.regularTime.home - etH
        const derivedA = m.score.fullTime.away - m.score.regularTime.away - etA
        if (derivedH >= 0 && derivedA >= 0 && derivedH !== derivedA) {
          // Nur überschreiben wenn die abgeleiteten Pens einen Sieger liefern,
          // sonst score.penalties (5:5) als Live-Snapshot stehen lassen.
          penaltyHome = derivedH
          penaltyAway = derivedA
        }
      }

      // Sieger-Fallback: bei winner=null aber duration!=REGULAR Sieger aus fullTime
      // ableiten (fullTime = Endstand inkl. ET+E11m). football-data.org lässt winner
      // nach langen Elfmeterschießen gelegentlich leer.
      let matchWinner: string | null = m.score?.winner ?? null
      if (!matchWinner && matchDuration && matchDuration !== 'REGULAR'
          && m.score?.fullTime?.home != null && m.score?.fullTime?.away != null
          && m.score.fullTime.home !== m.score.fullTime.away) {
        matchWinner = m.score.fullTime.home > m.score.fullTime.away ? 'HOME_TEAM' : 'AWAY_TEAM'
      }
      const matchMinute = m.minute ?? null

      // Deadline: Kick-off (fallback: 1 year from now). Einzelne Spiele sind bis
      // zum Anpfiff tippbar — gilt sowohl für Liga-Spieltage als auch KO-Matches.
      // Bonus/Spezial-Fragen (z.B. Gruppensieger, Torschütze) haben eigene
      // Deadlines und werden hier nicht angefasst.
      let deadline: string
      if (matchUtcDate) {
        deadline = new Date(matchUtcDate).toISOString()
      } else {
        deadline = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString()
      }

      // Build question text
      const question = `${homeTeam} vs ${awayTeam}`

      // `status` is the SCORING lifecycle ('open' → 'resolved'), owned solely by
      // resolve-matchday. The sync must NEVER mark a finished match 'resolved' itself —
      // otherwise the auto-resolver (which looks for FINISHED + status != 'resolved')
      // skips it and the tips are never scored. New questions start 'open' so the
      // resolver picks them up; existing questions keep their current scoring state.
      // Only cancellations are flagged here.
      const isCancelled = ['POSTPONED', 'CANCELLED', 'SUSPENDED'].includes(matchStatus)

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
            extratime_home: extratimeHome,
            extratime_away: extratimeAway,
            penalty_home: penaltyHome,
            penalty_away: penaltyAway,
            match_duration: matchDuration,
            match_winner: matchWinner,
            match_utc_date: matchUtcDate,
            match_status: matchStatus,
            match_minute: matchMinute,
            matchday: matchdayNum,
            competition_stage: stage,
            group_label: groupLabel,
            deadline,
            ...(isCancelled ? { status: 'cancelled' } : {}),
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
            extratime_home: extratimeHome,
            extratime_away: extratimeAway,
            penalty_home: penaltyHome,
            penalty_away: penaltyAway,
            match_duration: matchDuration,
            match_winner: matchWinner,
            match_api_id: matchApiId,
            match_utc_date: matchUtcDate,
            match_status: matchStatus,
            match_minute: matchMinute,
            matchday: matchdayNum,
            competition_stage: stage,
            group_label: groupLabel,
            deadline,
            status: isCancelled ? 'cancelled' : 'open',
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
