// Supabase Edge Function: score-bonus-answers
// Resolves a bonus question and scores all answers server-authoritatively.
// Group admins (per JWT) OR the cron scheduler (service-role token) may invoke.
// POST { question_id, correct_answer }
//
// Faltet die Bonus-Punkte eines jeden Users in einen synthetischen 'bonus'-
// Bucket in tip_group_members.points_by_matchday und rechnet total_points neu,
// damit die Rangliste den Bonus mitnimmt (wie score-bracket es für 'bracket' macht).

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
        return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: corsHeaders })
      }
    }

    const { question_id, correct_answer } = await req.json()
    if (!question_id || correct_answer === undefined || correct_answer === null) {
      return new Response(JSON.stringify({ error: 'question_id and correct_answer required' }), { status: 400, headers: corsHeaders })
    }

    const { data: question } = await supabase
      .from('tip_bonus_questions')
      .select('id, group_id, points')
      .eq('id', question_id)
      .single()

    if (!question) {
      return new Response(JSON.stringify({ error: 'Question not found' }), { status: 404, headers: corsHeaders })
    }

    if (!isInternal) {
      const { data: membership } = await supabase
        .from('tip_group_members')
        .select('role')
        .eq('group_id', question.group_id)
        .eq('user_id', user!.id)
        .single()

      if (!membership || membership.role !== 'admin') {
        return new Response(JSON.stringify({ error: 'Only group admins can resolve bonus questions' }), { status: 403, headers: corsHeaders })
      }
    }

    const correct = String(correct_answer).toLowerCase().trim()
    const points = Number(question.points) || 0

    await supabase
      .from('tip_bonus_questions')
      .update({ correct_answer: String(correct_answer), status: 'resolved' })
      .eq('id', question_id)

    const { data: answers } = await supabase
      .from('tip_bonus_answers')
      .select('id, user_id, answer')
      .eq('question_id', question_id)

    const affectedUsers = new Set<string>()
    let scored = 0
    if (answers) {
      for (const a of answers) {
        const pts = String(a.answer).toLowerCase().trim() === correct ? points : 0
        await supabase
          .from('tip_bonus_answers')
          .update({ points_earned: pts })
          .eq('id', a.id)
        affectedUsers.add(a.user_id)
        scored++
      }
    }

    // Bonus-Bucket der betroffenen User neu aus tip_bonus_answers summieren und
    // tip_group_members aktualisieren — analog zu score-bracket.
    for (const userId of affectedUsers) {
      const { data: userAnswers } = await supabase
        .from('tip_bonus_answers')
        .select('points_earned, question_id, tip_bonus_questions!inner(group_id)')
        .eq('user_id', userId)
        .eq('tip_bonus_questions.group_id', question.group_id)

      const bonusTotal = (userAnswers || []).reduce((s: number, a: any) => s + (a.points_earned || 0), 0)

      const { data: member } = await supabase
        .from('tip_group_members')
        .select('points_by_matchday')
        .eq('group_id', question.group_id)
        .eq('user_id', userId)
        .single()
      if (!member) continue

      const byMatchday = (member.points_by_matchday as Record<string, number>) || {}
      byMatchday['bonus'] = bonusTotal
      const newTotal = Object.values(byMatchday).reduce((sum, p) => sum + (p || 0), 0)

      await supabase
        .from('tip_group_members')
        .update({ total_points: newTotal, points_by_matchday: byMatchday })
        .eq('group_id', question.group_id)
        .eq('user_id', userId)
    }

    return new Response(JSON.stringify({ resolved: true, scored, users_updated: affectedUsers.size }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (err) {
    return new Response(JSON.stringify({ error: (err as Error).message }), { status: 500, headers: corsHeaders })
  }
})
