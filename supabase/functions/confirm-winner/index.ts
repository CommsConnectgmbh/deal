// Supabase Edge Function: confirm-winner
// Called when the second party confirms the proposed winner
// Handles XP, coins, streak, battle pass, rivalries server-side

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    )

    // Get authenticated user
    const authHeader = req.headers.get('Authorization')!
    const { data: { user } } = await createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: authHeader } } }
    ).auth.getUser()

    if (!user) return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: corsHeaders })

    const { deal_id } = await req.json()
    if (!deal_id) return new Response(JSON.stringify({ error: 'deal_id required' }), { status: 400, headers: corsHeaders })

    // Fetch the deal
    const { data: deal, error: dealError } = await supabase
      .from('bets')
      .select('*')
      .eq('id', deal_id)
      .single()

    if (dealError || !deal) return new Response(JSON.stringify({ error: 'Deal not found' }), { status: 404, headers: corsHeaders })

    // Validate: user must be a participant
    if (deal.creator_id !== user.id && deal.opponent_id !== user.id) {
      return new Response(JSON.stringify({ error: 'Not a participant' }), { status: 403, headers: corsHeaders })
    }

    // Validate: deal must be in pending_confirmation or disputed
    if (!['pending_confirmation', 'disputed'].includes(deal.status)) {
      return new Response(JSON.stringify({ error: 'Deal not awaiting confirmation' }), { status: 400, headers: corsHeaders })
    }

    // Validate: confirmer is NOT the one who proposed
    if (deal.winner_proposed_by === user.id) {
      return new Response(JSON.stringify({ error: 'Cannot confirm your own proposal' }), { status: 400, headers: corsHeaders })
    }

    // Validate: deal was active for at least 10 minutes (anti-farming)
    if (deal.accepted_at) {
      const acceptedAt = new Date(deal.accepted_at).getTime()
      const now = Date.now()
      if (now - acceptedAt < 10 * 60 * 1000) {
        return new Response(JSON.stringify({ error: 'Deal must be active for at least 10 minutes' }), { status: 400, headers: corsHeaders })
      }
    }

    const winner_id = deal.proposed_winner_id
    const loser_id = winner_id === deal.creator_id ? deal.opponent_id : deal.creator_id

    // Anti-farming: max 3 XP wins per 24h
    const since24h = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
    const { count: recentWins } = await supabase
      .from('xp_events')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', winner_id)
      .eq('event_type', 'deal_won')
      .gte('created_at', since24h)

    const winCapReached = (recentWins || 0) >= 3

    // Anti-farming: same opponent within 24h = 50% XP
    const { count: sameOpponentCount } = await supabase
      .from('bets')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'completed')
      .gte('confirmed_at', since24h)
      .or(`and(creator_id.eq.${deal.creator_id},opponent_id.eq.${deal.opponent_id}),and(creator_id.eq.${deal.opponent_id},opponent_id.eq.${deal.creator_id})`)

    const sameOpponentPenalty = (sameOpponentCount || 0) >= 1

    // Fetch winner profile for streak
    const { data: winnerProfile } = await supabase
      .from('profiles')
      .select('streak, xp, level, coins, battle_pass_xp, battle_pass_level')
      .eq('id', winner_id)
      .single()

    const currentStreak = winnerProfile?.streak || 0

    // XP calculation
    const baseXP = 50
    const winBonus = 50
    const streakMultiplier = 1 + Math.min(currentStreak, 7) * 0.1
    let totalWinnerXP = Math.floor((baseXP + winBonus) * streakMultiplier)
    let totalLoserXP = baseXP

    if (sameOpponentPenalty) {
      totalWinnerXP = Math.floor(totalWinnerXP * 0.5)
      totalLoserXP = Math.floor(totalLoserXP * 0.5)
    }
    if (winCapReached) {
      totalWinnerXP = 0 // No XP for winner if cap reached
    }

    const winnerCoins = winCapReached ? 0 : 25
    const participationCoins = 5

    const now = new Date().toISOString()

    // Update deal to completed
    await supabase.from('bets').update({
      status: 'completed',
      winner_id,
      confirmed_at: now,
      xp_awarded: true,
      xp_amount: totalWinnerXP
    }).eq('id', deal_id)

    // Write deal_actions audit entry
    await supabase.from('deal_actions').insert({
      deal_id,
      actor_id: user.id,
      action: 'confirm_winner',
      meta: { winner_id, winner_xp: totalWinnerXP, loser_xp: totalLoserXP }
    })

    // Award XP + coins to winner
    if (totalWinnerXP > 0) {
      await supabase.from('xp_events').insert({
        user_id: winner_id,
        event_type: 'deal_won',
        xp_gained: totalWinnerXP,
        description: `Deal gewonnen 🏆 (${sameOpponentPenalty ? '50% Bonus' : 'Full'})`,
        related_bet_id: deal_id
      })
    }

    // Award participation XP to loser
    await supabase.from('xp_events').insert({
      user_id: loser_id,
      event_type: 'deal_completed',
      xp_gained: totalLoserXP,
      description: 'Deal abgeschlossen',
      related_bet_id: deal_id
    })

    // Wallet ledger entries
    if (winnerCoins > 0) {
      await supabase.from('wallet_ledger').insert({
        user_id: winner_id,
        delta: winnerCoins,
        reason: 'win_reward',
        reference_id: deal_id
      })
    }
    await supabase.from('wallet_ledger').insert({
      user_id: loser_id,
      delta: participationCoins,
      reason: 'participation_reward',
      reference_id: deal_id
    })
    await supabase.from('wallet_ledger').insert({
      user_id: winner_id,
      delta: participationCoins,
      reason: 'participation_reward',
      reference_id: deal_id
    })

    // New level calculation: xp_required(level) = 250 * (level^1.35)
    const calcLevel = (xp: number) => {
      let level = 1
      while (level <= 100) {
        const needed = Math.floor(250 * Math.pow(level, 1.35))
        if (xp >= needed) level++
        else break
      }
      return Math.max(1, level - 1)
    }

    // Update winner profile
    const newWinnerXP = (winnerProfile?.xp || 0) + totalWinnerXP
    const newWinnerLevel = calcLevel(newWinnerXP)
    const levelUpCoins = Math.max(0, newWinnerLevel - (winnerProfile?.level || 1)) * 10

    await supabase.from('profiles').update({
      xp: newWinnerXP,
      level: newWinnerLevel,
      coins: (winnerProfile?.coins || 0) + winnerCoins + participationCoins + levelUpCoins,
      wins: supabase.rpc('increment', { field: 'wins' }), // fallback below
      streak: currentStreak + 1,
      deals_total: supabase.rpc('increment', { field: 'deals_total' }),
      last_active_at: now
    }).eq('id', winner_id)

    // Simpler update using raw SQL style
    await supabase.rpc('increment_profile_stats', {
      p_user_id: winner_id,
      p_xp: totalWinnerXP,
      p_coins: winnerCoins + participationCoins + levelUpCoins,
      p_wins: 1,
      p_deals: 1,
      p_streak_delta: 1
    }).catch(() => {
      // Fallback: direct update
      supabase.from('profiles').update({
        xp: newWinnerXP,
        level: newWinnerLevel,
        coins: (winnerProfile?.coins || 0) + winnerCoins + participationCoins + levelUpCoins,
        wins: (winnerProfile as any)?.wins + 1 || 1,
        streak: currentStreak + 1,
        deals_total: (winnerProfile as any)?.deals_total + 1 || 1,
        last_active_at: now
      }).eq('id', winner_id)
    })

    // Update loser profile
    const { data: loserProfile } = await supabase
      .from('profiles')
      .select('xp, level, coins, streak, deals_total, losses')
      .eq('id', loser_id)
      .single()

    const newLoserXP = (loserProfile?.xp || 0) + totalLoserXP
    const newLoserLevel = calcLevel(newLoserXP)
    const loserLevelUpCoins = Math.max(0, newLoserLevel - (loserProfile?.level || 1)) * 10

    await supabase.from('profiles').update({
      xp: newLoserXP,
      level: newLoserLevel,
      coins: (loserProfile?.coins || 0) + participationCoins + loserLevelUpCoins,
      losses: (loserProfile?.losses || 0) + 1,
      streak: 0, // streak reset on loss
      deals_total: (loserProfile?.deals_total || 0) + 1,
      last_active_at: now
    }).eq('id', loser_id)

    // Update battle pass season XP
    await supabase.from('user_battlepass')
      .upsert({
        user_id: winner_id,
        season_id: 1,
        season_xp: (winnerProfile?.battle_pass_xp || 0) + totalWinnerXP,
        current_tier: Math.floor(((winnerProfile?.battle_pass_xp || 0) + totalWinnerXP) / 500)
      }, { onConflict: 'user_id,season_id' })

    // Update rivalries (both directions)
    const upsertRivalry = async (userId: string, rivalId: string, isWinner: boolean) => {
      await supabase.from('rivalries').upsert({
        user_id: userId,
        rival_id: rivalId,
        wins: isWinner ? 1 : 0,
        losses: isWinner ? 0 : 1,
        total_deals: 1,
        rivalry_intensity: 5
      }, { onConflict: 'user_id,rival_id' })

      // Then increment
      const { data: existing } = await supabase
        .from('rivalries')
        .select('wins, losses, total_deals, rivalry_intensity')
        .eq('user_id', userId)
        .eq('rival_id', rivalId)
        .single()

      if (existing) {
        const newIntensity = Math.min((existing.rivalry_intensity || 0) + 5, 100)
        await supabase.from('rivalries').update({
          wins: (existing.wins || 0) + (isWinner ? 1 : 0),
          losses: (existing.losses || 0) + (isWinner ? 0 : 1),
          total_deals: (existing.total_deals || 0) + 1,
          rivalry_intensity: newIntensity,
          is_heated: newIntensity >= 50,
          is_legendary: newIntensity >= 80,
          updated_at: now
        }).eq('user_id', userId).eq('rival_id', rivalId)
      }
    }

    await upsertRivalry(winner_id, loser_id, true)
    await upsertRivalry(loser_id, winner_id, false)

    // Send notification to winner
    await supabase.from('notifications').insert({
      user_id: winner_id,
      type: 'deal_won',
      title: '🏆 Deal gewonnen!',
      body: `Du hast +${totalWinnerXP} XP und ${winnerCoins} Coins erhalten.`,
      data: { deal_id, xp: totalWinnerXP, coins: winnerCoins }
    })

    return new Response(JSON.stringify({
      success: true,
      winner_xp: totalWinnerXP,
      winner_coins: winnerCoins,
      loser_xp: totalLoserXP,
      anti_farming_applied: winCapReached || sameOpponentPenalty
    }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })

  } catch (err) {
    console.error(err)
    return new Response(JSON.stringify({ error: String(err) }), { status: 500, headers: corsHeaders })
  }
})
