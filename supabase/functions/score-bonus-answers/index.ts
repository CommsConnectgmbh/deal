// Supabase Edge Function: score-bonus-answers
// Resolves a bonus question and scores all answers server-authoritatively.
// Only group admins may invoke. points_earned is NEVER trusted from the client.
// POST { question_id, correct_answer }

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
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: corsHeaders })
    }

    const { question_id, correct_answer } = await req.json()
    if (!question_id || correct_answer === undefined || correct_answer === null) {
      return new Response(JSON.stringify({ error: 'question_id and correct_answer required' }), { status: 400, headers: corsHeaders })
    }

    // Load question + its group
    const { data: question } = await supabase
      .from('tip_bonus_questions')
      .select('id, group_id, points')
      .eq('id', question_id)
      .single()

    if (!question) {
      return new Response(JSON.stringify({ error: 'Question not found' }), { status: 404, headers: corsHeaders })
    }

    // Verify the invoking user is an admin of that group
    const { data: membership } = await supabase
      .from('tip_group_members')
      .select('role')
      .eq('group_id', question.group_id)
      .eq('user_id', user.id)
      .single()

    if (!membership || membership.role !== 'admin') {
      return new Response(JSON.stringify({ error: 'Only group admins can resolve bonus questions' }), { status: 403, headers: corsHeaders })
    }

    const correct = String(correct_answer).toLowerCase().trim()
    const points = Number(question.points) || 0

    // Mark question resolved
    await supabase
      .from('tip_bonus_questions')
      .update({ correct_answer: String(correct_answer), status: 'resolved' })
      .eq('id', question_id)

    // Score all answers (service_role bypasses the client points lock)
    const { data: answers } = await supabase
      .from('tip_bonus_answers')
      .select('id, answer')
      .eq('question_id', question_id)

    let scored = 0
    if (answers) {
      for (const a of answers) {
        const pts = String(a.answer).toLowerCase().trim() === correct ? points : 0
        await supabase
          .from('tip_bonus_answers')
          .update({ points_earned: pts })
          .eq('id', a.id)
        scored++
      }
    }

    return new Response(JSON.stringify({ resolved: true, scored }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (err) {
    return new Response(JSON.stringify({ error: (err as Error).message }), { status: 500, headers: corsHeaders })
  }
})
