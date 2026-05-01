'use client'
import { useState, useEffect, useRef, useCallback } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { useAuth } from '@/contexts/AuthContext'
import { useLang } from '@/contexts/LanguageContext'
import { supabase } from '@/lib/supabase'
import ProfileImage from '@/components/ProfileImage'
import MatchdayNav from '@/components/tippen/MatchdayNav'
import MatchCard, { MatchQuestion, TipDraft } from '@/components/tippen/MatchCard'
import MatchdaySaveAll from '@/components/tippen/MatchdaySaveAll'
import TipOverviewTable from '@/components/tippen/TipOverviewTable'
import RankingTable from '@/components/tippen/RankingTable'
import BonusQuestionCard from '@/components/tippen/BonusQuestionCard'
import BonusQuestionAdmin from '@/components/tippen/BonusQuestionAdmin'
import TournamentBracket from '@/components/tippen/TournamentBracket'
import GroupSettingsPanel from '@/components/tippen/GroupSettingsPanel'

/* ═══════════════════════════════════════════════════════════════
   TYPES
   ═══════════════════════════════════════════════════════════════ */
interface TipGroup {
  id: string; name: string; description: string | null; category: string
  league: string | null; stake: string | null; invite_code: string; is_public: boolean
  created_by: string; max_members: number; status: string; created_at: string
  points_exact: number; points_diff: number; points_tendency: number
  joker_enabled: boolean; joker_multiplier: number; joker_per_matchday: number
  competition_id: number | null; competition_code: string | null
  competition_name: string | null; competition_type: string | null
  season_year: string | null; auto_sync: boolean; last_synced_at: string | null
}

interface TipQuestion {
  id: string; group_id: string; question: string; question_type: string
  home_team: string | null; away_team: string | null
  home_team_logo: string | null; away_team_logo: string | null
  home_team_short: string | null; away_team_short: string | null
  match_api_id: string | null; options: string[] | null; result: string | null
  home_score: number | null; away_score: number | null
  halftime_home: number | null; halftime_away: number | null
  match_utc_date: string | null; match_status: string | null
  match_minute: number | null; is_live: boolean
  competition_stage: string | null; group_label: string | null
  deadline: string; status: string; matchday: number | null; created_at: string
  last_updated_at: string | null
}

interface TipAnswer {
  id: string; question_id: string; user_id: string
  home_score_tip: number | null; away_score_tip: number | null
  tendency: string | null; answer: string | null
  points_earned: number | null; is_joker: boolean; created_at: string
}

interface MemberRow {
  group_id: string; user_id: string; total_points: number
  jokers_remaining: number; role: string; joined_at: string
  jokers_used_matchdays: number[]
  points_by_matchday: Record<string, number>
  profiles?: { username: string; display_name: string; avatar_url: string | null }
}

interface BonusQ {
  id: string; group_id: string; question: string; answer_type: string
  options: string[] | null; correct_answer: string | null; points: number
  deadline: string; status: string; sort_order: number; created_at: string
}

interface BonusA {
  id: string; question_id: string; user_id: string; answer: string
  points_earned: number; created_at: string
}

interface BracketTip {
  id: string; group_id: string; user_id: string; stage: string; position: number
  predicted_team_name: string | null; actual_team_name: string | null
  is_correct: boolean | null; points_earned: number; deadline: string | null
}

interface ChatMsg {
  id: string; sender_id: string; content: string; created_at: string
  message_type: string; media_url: string | null; group_id: string
  profiles?: { username: string; display_name: string; avatar_url: string | null }
}

type Tab = 'spieltag' | 'uebersicht' | 'rangliste' | 'bonus' | 'bracket' | 'chat' | 'settings'

/* ═══════════════════════════════════════════════════════════════
   HELPERS
   ═══════════════════════════════════════════════════════════════ */
function formatChatTime(iso: string) {
  return new Date(iso).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })
}
function deadlinePassed(iso: string) { return new Date(iso).getTime() < Date.now() }

/** Find the "current" matchday: the earliest matchday that still has open questions */
function findCurrentMatchday(questions: TipQuestion[]): number {
  const matchdays = [...new Set(questions.filter(q => q.matchday).map(q => q.matchday!))].sort((a, b) => a - b)
  if (matchdays.length === 0) return 1
  // Find earliest matchday where at least one question is still open/scheduled
  for (const md of matchdays) {
    const mdQuestions = questions.filter(q => q.matchday === md)
    const hasOpen = mdQuestions.some(q => q.status !== 'resolved' && q.status !== 'cancelled')
    if (hasOpen) return md
  }
  return matchdays[matchdays.length - 1]
}

/* ═══════════════════════════════════════════════════════════════
   MAIN COMPONENT
   ═══════════════════════════════════════════════════════════════ */
export default function TippgruppeDetailPage() {
  const { id: groupId } = useParams<{ id: string }>()
  const { user, profile } = useAuth()
  const { t } = useLang()
  const router = useRouter()

  // Core state
  const [group, setGroup] = useState<TipGroup | null>(null)
  const [membership, setMembership] = useState<MemberRow | null>(null)
  const [activeTab, setActiveTab] = useState<Tab>('spieltag')
  const [loading, setLoading] = useState(true)

  // Spieltag tab
  const [questions, setQuestions] = useState<TipQuestion[]>([])
  const [allAnswers, setAllAnswers] = useState<TipAnswer[]>([])
  const [myAnswers, setMyAnswers] = useState<Record<string, TipAnswer>>({})
  const [drafts, setDrafts] = useState<Record<string, TipDraft>>({})
  const [activeMatchday, setActiveMatchday] = useState(1)
  const [saving, setSaving] = useState(false)
  const [toast, setToast] = useState<string | null>(null)

  // Rangliste
  const [members, setMembers] = useState<MemberRow[]>([])

  // Winner prediction
  const [winnerPrediction, setWinnerPrediction] = useState<{ id: string; predicted_winner_id: string; status: string; coins_awarded: number } | null>(null)
  const [selectedWinner, setSelectedWinner] = useState<string>('')
  const [winnerBetSaving, setWinnerBetSaving] = useState(false)

  // Bonus
  const [bonusQuestions, setBonusQuestions] = useState<BonusQ[]>([])
  const [bonusAnswers, setBonusAnswers] = useState<Record<string, BonusA>>({})

  // Bracket
  const [bracketTips, setBracketTips] = useState<BracketTip[]>([])

  // Chat
  const [chatMessages, setChatMessages] = useState<ChatMsg[]>([])
  const [chatText, setChatText] = useState('')
  const [chatSending, setChatSending] = useState(false)
  const chatBottomRef = useRef<HTMLDivElement>(null)
  const messagesRef = useRef<HTMLDivElement>(null)

  // Live polling
  const liveIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null)
  // Track whether we've done the initial matchday navigation
  const initializedRef = useRef(false)
  // Track whether auto-sync has already run this session
  const autoSyncDoneRef = useRef(false)

  const showToast = useCallback((msg: string) => { setToast(msg); setTimeout(() => setToast(null), 2500) }, [])

  // Derived data
  const matchdays = [...new Set(questions.filter(q => q.matchday).map(q => q.matchday!))].sort((a, b) => a - b)
  const totalMatchdays = matchdays.length > 0 ? matchdays[matchdays.length - 1] : 0
  const mdQuestions = questions.filter(q => q.matchday === activeMatchday)
  const isAdmin = membership?.role === 'admin'
  const isTournament = group?.competition_type === 'TOURNAMENT' || group?.competition_type === 'CUP'
  const isCustomGroup = group?.category === 'custom'
  const hasLiveMatches = questions.some(q => q.is_live)

  /* ── Load group + membership ── */
  useEffect(() => {
    if (!user || !groupId) return
    const init = async () => {
      const { data: g } = await supabase.from('tip_groups').select('*').eq('id', groupId).single()
      if (!g) { router.push('/app/tippen'); return }
      setGroup(g)
      const { data: m } = await supabase.from('tip_group_members').select('*').eq('group_id', groupId).eq('user_id', user.id).single()
      setMembership(m || null)
      setLoading(false)
    }
    init()
  }, [user, groupId, router])

  /* ── Load questions + answers ── */
  const loadQuestions = useCallback(async () => {
    if (!user || !groupId) return
    const { data: qs } = await supabase.from('tip_questions').select('*').eq('group_id', groupId).order('matchday', { ascending: true }).order('match_utc_date', { ascending: true })
    const allQ = (qs || []) as TipQuestion[]
    setQuestions(allQ)

    // Find current matchday on first load only (use ref to avoid stale closure)
    if (allQ.length > 0 && !initializedRef.current) {
      initializedRef.current = true
      setActiveMatchday(findCurrentMatchday(allQ))
    }

    // Load MY answers
    const qIds = allQ.map(q => q.id)
    if (qIds.length > 0) {
      const { data: ans } = await supabase.from('tip_answers').select('*').eq('user_id', user.id).in('question_id', qIds)
      const map: Record<string, TipAnswer> = {}
      ;(ans || []).forEach((a: any) => { map[a.question_id] = a })
      setMyAnswers(map)
    }
  }, [user, groupId])

  useEffect(() => { loadQuestions() }, [loadQuestions])

  /* ── Auto-sync on page load (for admin, if auto_sync enabled & stale) ── */
  useEffect(() => {
    if (!group || !group.auto_sync || !group.competition_code || !user || !membership) return
    if (membership.role !== 'admin') return
    if (autoSyncDoneRef.current) return
    autoSyncDoneRef.current = true

    // Only auto-sync if last sync was > 2 hours ago (or never synced)
    const lastSync = group.last_synced_at ? new Date(group.last_synced_at).getTime() : 0
    const twoHoursAgo = Date.now() - 2 * 60 * 60 * 1000
    if (lastSync > twoHoursAgo) return

    const runAutoSync = async () => {
      try {
        const { data: { session } } = await supabase.auth.refreshSession()
        if (!session) return

        // 1. Sync latest match data from football-data.org
        await fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/sync-league-matches`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${session.access_token}`,
            apikey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '',
          },
          body: JSON.stringify({
            group_id: groupId,
            competition_code: group.competition_code,
            season: group.season_year || '2025',
          }),
        })

        // 2. Auto-resolve all finished but unresolved matchdays
        const { data: unresolvedQ } = await supabase
          .from('tip_questions')
          .select('matchday')
          .eq('group_id', groupId)
          .eq('match_status', 'FINISHED')
          .neq('status', 'resolved')
        const unresolvedMDs = [...new Set((unresolvedQ || []).map((q: any) => q.matchday).filter(Boolean))]
        for (const md of unresolvedMDs) {
          await fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/resolve-matchday`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${session.access_token}`,
              apikey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '',
            },
            body: JSON.stringify({ group_id: groupId, matchday: md }),
          })
        }

        // 3. Reload questions after sync
        loadQuestions()
      } catch {}
    }

    runAutoSync()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [group, user, membership, groupId])

  /* ── Load ALL answers for overview tab ── */
  useEffect(() => {
    if (!groupId || activeTab !== 'uebersicht') return
    const load = async () => {
      const mdQ = questions.filter(q => q.matchday === activeMatchday)
      const qIds = mdQ.map(q => q.id)
      if (qIds.length === 0) return
      const { data } = await supabase.from('tip_answers').select('*').in('question_id', qIds)
      setAllAnswers(data || [])
    }
    load()
  }, [groupId, activeTab, activeMatchday, questions])

  /* ── Load ranking ── */
  useEffect(() => {
    if (!groupId) return
    const load = async () => {
      const { data } = await supabase
        .from('tip_group_members').select('*, profiles(username, display_name, avatar_url)')
        .eq('group_id', groupId).order('total_points', { ascending: false })
      setMembers(data || [])
    }
    load()
  }, [groupId, activeTab])

  /* ── Load winner prediction ── */
  useEffect(() => {
    if (!groupId || !user) return
    const load = async () => {
      const { data } = await supabase
        .from('tip_group_winner_challenges')
        .select('id, predicted_winner_id, status, coins_awarded')
        .eq('group_id', groupId)
        .eq('user_id', user.id)
        .maybeSingle()
      if (data) {
        setWinnerPrediction(data)
        setSelectedWinner(data.predicted_winner_id)
      }
    }
    load()
  }, [groupId, user])

  /* ── Save winner prediction ── */
  const saveWinnerPrediction = async () => {
    if (!user || !groupId || !selectedWinner || winnerBetSaving) return
    setWinnerBetSaving(true)
    const { data, error } = await supabase
      .from('tip_group_winner_challenges')
      .upsert({
        group_id: groupId,
        user_id: user.id,
        predicted_winner_id: selectedWinner,
        updated_at: new Date().toISOString(),
      }, { onConflict: 'group_id,user_id' })
      .select('id, predicted_winner_id, status, coins_awarded')
      .single()
    if (!error && data) {
      setWinnerPrediction(data)
      showToast(t('tippen.winnerTipSaved'))
    }
    setWinnerBetSaving(false)
  }

  /* ── Load bonus ── */
  const loadBonusTab = activeTab === 'bonus' || (isCustomGroup && activeTab === 'spieltag')
  useEffect(() => {
    if (!groupId || !user || !loadBonusTab) return
    const load = async () => {
      const { data: bqs } = await supabase.from('tip_bonus_questions').select('*').eq('group_id', groupId).order('sort_order')
      setBonusQuestions(bqs || [])
      if (bqs && bqs.length > 0) {
        const bqIds = bqs.map((b: BonusQ) => b.id)
        const { data: bas } = await supabase.from('tip_bonus_answers').select('*').eq('user_id', user.id).in('question_id', bqIds)
        const map: Record<string, BonusA> = {}
        ;(bas || []).forEach((a: BonusA) => { map[a.question_id] = a })
        setBonusAnswers(map)
      }
    }
    load()
  }, [groupId, user, loadBonusTab])

  /* ── Load bracket ── */
  useEffect(() => {
    if (!groupId || !user || activeTab !== 'bracket') return
    const load = async () => {
      const { data } = await supabase.from('tip_bracket_tips').select('*').eq('group_id', groupId).eq('user_id', user.id)
      setBracketTips(data || [])
    }
    load()
  }, [groupId, user, activeTab])

  /* ── Load chat ── */
  useEffect(() => {
    if (!groupId || activeTab !== 'chat') return
    const load = async () => {
      const { data } = await supabase
        .from('messages').select('*, profiles:sender_id(username, display_name, avatar_url)')
        .eq('group_id', groupId).order('created_at', { ascending: true }).limit(200)
      setChatMessages(data || [])
      setTimeout(() => {
        if (messagesRef.current) messagesRef.current.scrollTop = messagesRef.current.scrollHeight
      }, 100)
    }
    load()
  }, [groupId, activeTab])

  /* ── Realtime chat ── */
  useEffect(() => {
    if (!groupId || activeTab !== 'chat') return
    const ch = supabase.channel(`group_chat_${groupId}`)
      .on('postgres_changes', {
        event: 'INSERT', schema: 'public', table: 'messages',
        filter: `group_id=eq.${groupId}`,
      }, async (payload: any) => {
        const newMsg = payload.new as ChatMsg
        const { data: p } = await supabase.from('profiles').select('username, display_name, avatar_url').eq('id', newMsg.sender_id).single()
        setChatMessages(prev => [...prev, { ...newMsg, profiles: p || undefined }])
        setTimeout(() => {
          if (messagesRef.current) messagesRef.current.scrollTop = messagesRef.current.scrollHeight
        }, 50)
      })
      .subscribe()
    return () => { supabase.removeChannel(ch) }
  }, [groupId, activeTab])

  /* ── Live score polling ── */
  useEffect(() => {
    if (!hasLiveMatches || !groupId || !user) return
    const poll = async () => {
      try {
        // Force token refresh to avoid stale JWT (401 errors)
        const { data: { session } } = await supabase.auth.refreshSession()
        if (!session) return
        await fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/update-live-scores`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${session.access_token}`,
            apikey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '',
          },
          body: JSON.stringify({ group_id: groupId }),
        })
        // Reload questions
        loadQuestions()
      } catch {}
    }

    liveIntervalRef.current = setInterval(poll, 60000) // every 60s
    return () => {
      if (liveIntervalRef.current) clearInterval(liveIntervalRef.current)
    }
  }, [hasLiveMatches, groupId, user, loadQuestions])

  /* ── Save all tips for current matchday ── */
  const saveAllTips = async () => {
    if (!user || !membership || saving) return
    setSaving(true)

    const matchQuestions = mdQuestions.filter(q => q.question_type === 'match' && !deadlinePassed(q.deadline))
    let saved = 0

    for (const q of matchQuestions) {
      const draft = drafts[q.id]
      const existing = myAnswers[q.id]

      // Get effective values
      const homeScore = draft?.homeScore || (existing?.home_score_tip !== null ? String(existing.home_score_tip) : '')
      const awayScore = draft?.awayScore || (existing?.away_score_tip !== null ? String(existing.away_score_tip) : '')

      if (homeScore === '' || awayScore === '') continue

      const isJoker = draft?.joker || false

      const payload = {
        question_id: q.id,
        user_id: user.id,
        home_score_tip: parseInt(homeScore),
        away_score_tip: parseInt(awayScore),
        is_joker: isJoker,
      }

      const { data, error } = await supabase
        .from('tip_answers')
        .upsert(payload, { onConflict: 'question_id,user_id' })
        .select()
        .single()

      if (!error && data) {
        setMyAnswers(prev => ({ ...prev, [q.id]: data }))
        saved++
      }
    }

    // Clear drafts for this matchday
    setDrafts(prev => {
      const n = { ...prev }
      matchQuestions.forEach(q => delete n[q.id])
      return n
    })

    setSaving(false)
    showToast(`${saved} ${t('tippen.tipsSaved')}`)
  }

  /* ── Send chat message ── */
  const sendChatMsg = async () => {
    if (!user || !chatText.trim() || chatSending) return
    setChatSending(true)
    const content = chatText.trim()
    setChatText('')
    await supabase.from('messages').insert({
      group_id: groupId,
      conversation_id: null,
      sender_id: user.id,
      content,
      message_type: 'text',
    })
    setChatSending(false)
  }

  /* ── Sync matches (admin) ── */
  const syncMatches = async () => {
    if (!group || !group.competition_code || !user) return
    try {
      // Force token refresh to avoid stale JWT (401 errors)
      const { data: { session }, error: refreshErr } = await supabase.auth.refreshSession()
      if (refreshErr || !session) { showToast(t('tippen.sessionExpired')); return }
      const res = await fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/sync-league-matches`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
          apikey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '',
        },
        body: JSON.stringify({
          group_id: groupId,
          competition_code: group.competition_code,
          season: group.season_year || '2025',
        }),
      })
      const result = await res.json()
      if (result.error) {
        showToast(t('tippen.error') + ': ' + result.error)
      } else {
        showToast(`${result.synced} ${t('tippen.matchesSynced')}`)
        // Auto-resolve ALL finished but unresolved matchdays
        try {
          const { data: unresolvedQ } = await supabase
            .from('tip_questions')
            .select('matchday')
            .eq('group_id', groupId)
            .eq('match_status', 'FINISHED')
            .neq('status', 'resolved')
          const unresolvedMDs = [...new Set((unresolvedQ || []).map((q: any) => q.matchday).filter(Boolean))]
          let totalResolved = 0
          for (const md of unresolvedMDs) {
            const resolveRes = await fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/resolve-matchday`, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${session.access_token}`,
                apikey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '',
              },
              body: JSON.stringify({ group_id: groupId, matchday: md }),
            })
            const resolveResult = await resolveRes.json()
            totalResolved += resolveResult.resolved || 0
          }
          if (totalResolved > 0) {
            showToast(`${totalResolved} ${t('tippen.matchesResolved')}`)
          }
        } catch {}
        loadQuestions()
      }
    } catch (err: unknown) {
      showToast(t('tippen.syncFailed'))
    }
  }

  /* ── Resolve matchday (admin) ── */
  const resolveMatchday = async () => {
    if (!user || !groupId) return
    try {
      // Force token refresh to avoid stale JWT (401 errors)
      const { data: { session }, error: refreshErr } = await supabase.auth.refreshSession()
      if (refreshErr || !session) { showToast(t('tippen.sessionExpired')); return }
      const res = await fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/resolve-matchday`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
          apikey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '',
        },
        body: JSON.stringify({ group_id: groupId, matchday: activeMatchday }),
      })
      const result = await res.json()
      if (result.error) showToast(t('tippen.error') + ': ' + result.error)
      else {
        showToast(`${result.resolved} ${t('tippen.matchesResolved')}`)
        loadQuestions()
      }
    } catch {
      showToast(t('tippen.resolveFailed'))
    }
  }

  /* ── Submit bonus answer ── */
  const submitBonusAnswer = async (questionId: string, answer: string) => {
    if (!user) return
    const { data, error } = await supabase
      .from('tip_bonus_answers')
      .upsert({ question_id: questionId, user_id: user.id, answer }, { onConflict: 'question_id,user_id' })
      .select()
      .single()
    if (!error && data) {
      setBonusAnswers(prev => ({ ...prev, [questionId]: data }))
      showToast(t('tippen.answerSaved'))
    }
  }

  /* ── Save bracket tip ── */
  const saveBracketTip = async (stage: string, position: number, teamName: string) => {
    if (!user || !groupId) return
    const { data } = await supabase
      .from('tip_bracket_tips')
      .upsert({
        group_id: groupId, user_id: user.id,
        stage, position, predicted_team_name: teamName,
      }, { onConflict: 'group_id,user_id,stage,position' })
      .select()
      .single()
    if (data) {
      setBracketTips(prev => {
        const filtered = prev.filter(t => !(t.stage === stage && t.position === position))
        return [...filtered, data]
      })
      showToast(t('tippen.tipSaved'))
    }
  }

  /* ── Draft helpers ── */
  const getDraft = (qId: string): TipDraft => drafts[qId] || { homeScore: '', awayScore: '', joker: false }
  const updateDraft = (qId: string, patch: Partial<TipDraft>) => {
    setDrafts(prev => ({ ...prev, [qId]: { ...getDraft(qId), ...patch } }))
  }

  // Count how many drafts have scores for the save button
  const tippCount = mdQuestions.filter(q => {
    if (q.question_type !== 'match' || deadlinePassed(q.deadline)) return false
    const d = drafts[q.id]
    const ex = myAnswers[q.id]
    const h = d?.homeScore || (ex?.home_score_tip !== null ? String(ex?.home_score_tip) : '')
    const a = d?.awayScore || (ex?.away_score_tip !== null ? String(ex?.away_score_tip) : '')
    return h !== '' && a !== ''
  }).length

  // Check if joker already used in this matchday
  const jokerUsedMatchdays = (membership?.jokers_used_matchdays || []) as number[]
  const jokerUsedThisMd = jokerUsedMatchdays.includes(activeMatchday)

  /* ── Share invite ── */
  const shareInvite = () => {
    if (!group) return
    const text = `${t('tippen.shareText')} "${group.name}"! Code: ${group.invite_code}`
    if (navigator.share) navigator.share({ text })
    else { navigator.clipboard.writeText(group.invite_code); showToast(t('tippen.codeCopied')) }
  }

  /* ── Loading ── */
  if (loading || !group) {
    return (
      <div style={{ minHeight: '100dvh', background: 'var(--bg-base)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ width: 28, height: 28, border: '2px solid transparent', borderTopColor: 'var(--gold-primary)', borderRadius: '50%', animation: 'spin .8s linear infinite' }} />
        <style>{'@keyframes spin{to{transform:rotate(360deg)}}'}</style>
      </div>
    )
  }

  /* ═══════════════════════════════════════════════════════════════
     TAB CONFIG
     ═══════════════════════════════════════════════════════════════ */
  const tabs: { key: Tab; label: string; show: boolean }[] = [
    { key: 'spieltag', label: isCustomGroup ? 'CHALLENGES' : t('tippen.tabMatchday'), show: true },
    { key: 'uebersicht', label: t('tippen.tabOverview'), show: !isCustomGroup },
    { key: 'rangliste', label: t('tippen.tabRanking'), show: true },
    { key: 'bonus', label: t('tippen.tabBonus'), show: !isCustomGroup },
    { key: 'bracket', label: 'BRACKET', show: isTournament && !isCustomGroup },
    { key: 'chat', label: 'CHAT', show: true },
    { key: 'settings', label: '\u2699\uFE0F', show: true },
  ]

  /* ═══════════════════════════════════════════════════════════════
     RENDER
     ═══════════════════════════════════════════════════════════════ */
  return (
    <div style={{ minHeight: '100dvh', background: 'var(--bg-base)', paddingBottom: 80 }}>

      {/* ── HEADER ── */}
      <div style={{
        position: 'sticky', top: 0, zIndex: 50, background: 'var(--bg-base)',
        borderBottom: '1px solid var(--border-subtle)', padding: '14px 16px',
        display: 'flex', alignItems: 'center', gap: 12,
      }}>
        <button onClick={() => router.push('/app/tippen')} style={{
          background: 'none', border: 'none', color: 'var(--text-secondary)',
          fontSize: 22, cursor: 'pointer', padding: 0, lineHeight: 1,
        }}>
          &#8592;
        </button>
        <div style={{ flex: 1, overflow: 'hidden' }}>
          <h1 style={{
            margin: 0, fontFamily: 'var(--font-display)', fontSize: 16,
            fontWeight: 700, color: 'var(--text-primary)', letterSpacing: 1,
            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
          }}>
            {group.name}
          </h1>
          {group.competition_name ? (
            <p style={{ margin: 0, fontSize: 11, color: 'var(--text-muted)', letterSpacing: 0.5 }}>
              {group.competition_name} {group.season_year ? `${group.season_year}/${parseInt(group.season_year) + 1}` : ''}
            </p>
          ) : isCustomGroup ? (
            <p style={{ margin: 0, fontSize: 11, color: 'var(--gold-primary)', letterSpacing: 0.5, fontFamily: 'var(--font-display)' }}>
              {t('tippen.challengeGroup')}
            </p>
          ) : null}
        </div>
        <button onClick={shareInvite} style={{
          background: 'var(--bg-elevated)', border: '1px solid var(--border-subtle)',
          borderRadius: 8, padding: '6px 10px', color: 'var(--gold-primary)',
          fontSize: 11, fontFamily: 'var(--font-display)', cursor: 'pointer', letterSpacing: 1,
        }}>
          {t('tippen.invite')}
        </button>
      </div>

      {/* ── TAB BAR (scrollable) ── */}
      <div style={{
        display: 'flex', overflowX: 'auto', scrollbarWidth: 'none',
        borderBottom: '1px solid var(--border-subtle)',
        background: 'var(--bg-base)', position: 'sticky', top: 53, zIndex: 49,
        WebkitOverflowScrolling: 'touch',
      }}>
        {tabs.filter(t => t.show).map(tab => (
          <button key={tab.key} onClick={() => setActiveTab(tab.key)} style={{
            padding: '12px 14px', background: 'none', border: 'none', flexShrink: 0,
            borderBottom: activeTab === tab.key ? '2px solid var(--gold-primary)' : '2px solid transparent',
            color: activeTab === tab.key ? 'var(--gold-primary)' : 'var(--text-muted)',
            fontFamily: 'var(--font-display)', fontSize: 11, fontWeight: 700,
            letterSpacing: 1.5, textTransform: 'uppercase', cursor: 'pointer',
            transition: 'color .2s, border-color .2s', whiteSpace: 'nowrap',
          }}>
            {tab.label}
          </button>
        ))}
      </div>

      {/* ════════════════════════════════════════════════════════════
         SPIELTAG TAB
         ════════════════════════════════════════════════════════════ */}
      {activeTab === 'spieltag' && (
        <div>
          {isCustomGroup ? (
            /* ── CUSTOM GROUP: Challenges via BonusQuestion components ── */
            <div style={{ padding: '16px 16px 0' }}>
              {isAdmin && (
                <BonusQuestionAdmin
                  groupId={groupId}
                  onCreated={() => {
                    supabase.from('tip_bonus_questions').select('*').eq('group_id', groupId).order('sort_order')
                      .then(({ data }: any) => setBonusQuestions(data || []))
                  }}
                  onResolve={async (qId, correctAnswer) => {
                    await supabase.from('tip_bonus_questions')
                      .update({ correct_answer: correctAnswer, status: 'resolved' })
                      .eq('id', qId)
                    const { data: answers } = await supabase.from('tip_bonus_answers').select('*').eq('question_id', qId)
                    const q = bonusQuestions.find(bq => bq.id === qId)
                    if (answers && q) {
                      for (const a of answers) {
                        const pts = a.answer.toLowerCase().trim() === correctAnswer.toLowerCase().trim() ? q.points : 0
                        await supabase.from('tip_bonus_answers').update({ points_earned: pts }).eq('id', a.id)
                      }
                    }
                    showToast(t('tippen.challengeResolved'))
                    const { data: bqs } = await supabase.from('tip_bonus_questions').select('*').eq('group_id', groupId).order('sort_order')
                    setBonusQuestions(bqs || [])
                  }}
                />
              )}

              {bonusQuestions.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '40px 0' }}>
                  <p style={{ fontSize: 40, lineHeight: 1, marginBottom: 12 }}>{'\uD83C\uDFC6'}</p>
                  <p style={{ fontSize: 14, color: 'var(--text-muted)' }}>
                    {isAdmin
                      ? t('tippen.noChallengesAdmin')
                      : t('tippen.noChallenges')}
                  </p>
                </div>
              ) : (
                bonusQuestions.map(bq => (
                  <BonusQuestionCard
                    key={bq.id}
                    question={bq}
                    myAnswer={bonusAnswers[bq.id] || null}
                    onSubmit={submitBonusAnswer}
                  />
                ))
              )}
            </div>
          ) : (
            /* ── FOOTBALL GROUP: Standard Spieltag ── */
            <>
              {totalMatchdays > 0 && (
                <MatchdayNav
                  totalMatchdays={totalMatchdays}
                  currentMatchday={findCurrentMatchday(questions)}
                  activeMatchday={activeMatchday}
                  onSelect={setActiveMatchday}
                />
              )}

              {/* Admin buttons */}
              {isAdmin && (
                <div style={{ display: 'flex', gap: 8, padding: '10px 16px' }}>
                  {group.competition_code && (
                    <button onClick={syncMatches} style={{
                      flex: 1, padding: '10px', background: 'var(--bg-elevated)',
                      border: '1px solid var(--border-subtle)', borderRadius: 10,
                      color: 'var(--gold-primary)', fontSize: 11, fontFamily: 'var(--font-display)',
                      fontWeight: 700, cursor: 'pointer', letterSpacing: 0.5,
                    }}>
                      {'\u27F3'} SYNC
                    </button>
                  )}
                  {mdQuestions.some(q => q.match_status === 'FINISHED' && q.status !== 'resolved') && (
                    <button onClick={resolveMatchday} style={{
                      flex: 1, padding: '10px', background: 'var(--bg-elevated)',
                      border: '1px solid var(--gold-primary)', borderRadius: 10,
                      color: 'var(--gold-primary)', fontSize: 11, fontFamily: 'var(--font-display)',
                      fontWeight: 700, cursor: 'pointer', letterSpacing: 0.5,
                    }}>
                      {'\u2713'} AUSWERTEN
                    </button>
                  )}
                </div>
              )}

              {/* Match cards */}
              <div style={{ padding: '8px 16px 0' }}>
                {mdQuestions.length === 0 ? (
                  <div style={{ textAlign: 'center', padding: '40px 0' }}>
                    <p style={{ fontSize: 40, lineHeight: 1, marginBottom: 12 }}>{'\u26BD'}</p>
                    <p style={{ fontSize: 14, color: 'var(--text-muted)' }}>
                      {totalMatchdays === 0
                        ? t('tippen.noMatchesYet')
                        : t('tippen.noMatchesMatchday')}
                    </p>
                  </div>
                ) : (
                  mdQuestions.map(q => (
                    <MatchCard
                      key={q.id}
                      q={q as MatchQuestion}
                      draft={getDraft(q.id)}
                      existingTip={myAnswers[q.id] || null}
                      locked={deadlinePassed(q.deadline)}
                      resolved={q.status === 'resolved'}
                      jokerEnabled={group.joker_enabled}
                      jokersRemaining={membership?.jokers_remaining || 0}
                      jokerUsedThisMatchday={jokerUsedThisMd}
                      onDraftChange={patch => updateDraft(q.id, patch)}
                    />
                  ))
                )}
              </div>

              {/* Save all button */}
              <MatchdaySaveAll onSave={saveAllTips} saving={saving} tippCount={tippCount} />
            </>
          )}
        </div>
      )}

      {/* ════════════════════════════════════════════════════════════
         ÜBERSICHT TAB
         ════════════════════════════════════════════════════════════ */}
      {activeTab === 'uebersicht' && (
        <div>
          {totalMatchdays > 0 && (
            <MatchdayNav
              totalMatchdays={totalMatchdays}
              currentMatchday={findCurrentMatchday(questions)}
              activeMatchday={activeMatchday}
              onSelect={setActiveMatchday}
            />
          )}
          <div style={{ padding: '0 8px' }}>
            <TipOverviewTable
              questions={mdQuestions.map(q => ({
                id: q.id,
                home_team_short: q.home_team_short,
                away_team_short: q.away_team_short,
                home_team: q.home_team,
                away_team: q.away_team,
                home_score: q.home_score,
                away_score: q.away_score,
                deadline: q.deadline,
                status: q.status,
              }))}
              members={members.map(m => ({
                user_id: m.user_id,
                username: m.profiles?.username || '?',
                avatar_url: m.profiles?.avatar_url || null,
              }))}
              tips={allAnswers.map(a => ({
                question_id: a.question_id,
                user_id: a.user_id,
                home_score_tip: a.home_score_tip,
                away_score_tip: a.away_score_tip,
                points_earned: a.points_earned,
              }))}
            />
          </div>
        </div>
      )}

      {/* ════════════════════════════════════════════════════════════
         RANGLISTE TAB
         ════════════════════════════════════════════════════════════ */}
      {activeTab === 'rangliste' && (
        <div>
          <RankingTable
            members={members.map(m => ({
              user_id: m.user_id,
              username: m.profiles?.username || '?',
              display_name: m.profiles?.display_name || null,
              avatar_url: m.profiles?.avatar_url || null,
              total_points: m.total_points || 0,
              points_by_matchday: (m.points_by_matchday || {}) as Record<string, number>,
            }))}
            totalMatchdays={totalMatchdays}
            currentUserId={user?.id || ''}
            onMatchdayClick={(md) => { setActiveMatchday(md); setActiveTab('uebersicht') }}
            onUserClick={(userId) => {
              const m = members.find(x => x.user_id === userId)
              if (m?.profiles?.username) router.push(`/app/profile/${m.profiles.username}`)
            }}
          />

          {/* ── SIEGER-TIPP: Winner Prediction ── */}
          <div style={{ padding: '20px 16px 0' }}>
            <div style={{
              background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)',
              borderRadius: 14, padding: '18px 16px', overflow: 'hidden',
            }}>
              {/* Header */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
                <span style={{ fontSize: 20 }}>🎯</span>
                <div>
                  <p style={{ fontFamily: 'var(--font-display)', fontSize: 13, color: 'var(--gold-primary)', margin: 0, letterSpacing: 1.5, fontWeight: 700 }}>
                    {t('tippen.winnerTip')}
                  </p>
                  <p style={{ fontSize: 11, color: 'var(--text-muted)', margin: '2px 0 0' }}>
                    {t('tippen.whoWinsOverall')}
                  </p>
                </div>
                <div style={{
                  marginLeft: 'auto', background: 'rgba(245,158,11,0.1)',
                  padding: '4px 10px', borderRadius: 8,
                }}>
                  <span style={{ fontFamily: 'var(--font-display)', fontSize: 11, color: 'var(--gold-primary)', fontWeight: 700 }}>
                    🪙 25
                  </span>
                </div>
              </div>

              {winnerPrediction?.status === 'won' ? (
                <div style={{
                  background: 'rgba(34,197,94,0.08)', border: '1px solid rgba(34,197,94,0.3)',
                  borderRadius: 10, padding: 14, textAlign: 'center',
                }}>
                  <p style={{ fontSize: 14, color: '#22C55E', fontWeight: 700, margin: '0 0 4px' }}>{t('tippen.correctTip')}</p>
                  <p style={{ fontSize: 13, color: '#22C55E', margin: 0 }}>+25 Coins</p>
                </div>
              ) : winnerPrediction?.status === 'lost' ? (
                <div style={{
                  background: 'rgba(239,68,68,0.06)', border: '1px solid rgba(239,68,68,0.2)',
                  borderRadius: 10, padding: 14, textAlign: 'center',
                }}>
                  <p style={{ fontSize: 13, color: '#EF4444', fontWeight: 700, margin: 0 }}>{t('tippen.wrongTip')}</p>
                </div>
              ) : (
                <>
                  {/* Dropdown */}
                  <select
                    value={selectedWinner}
                    onChange={e => setSelectedWinner(e.target.value)}
                    style={{
                      width: '100%', padding: '12px 14px',
                      background: 'var(--bg-elevated)', border: '1px solid var(--border-subtle)',
                      borderRadius: 10, color: 'var(--text-primary)', fontSize: 14,
                      fontFamily: 'var(--font-body)', outline: 'none',
                      appearance: 'none', marginBottom: 12,
                    }}
                  >
                    <option value="">— {t('tippen.selectWinner')} —</option>
                    {members.map(m => (
                      <option key={m.user_id} value={m.user_id}>
                        @{m.profiles?.username || '?'} ({m.total_points} Pkt.)
                      </option>
                    ))}
                  </select>

                  {winnerPrediction && (
                    <p style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 8, textAlign: 'center' }}>
                      {t('tippen.currentTip')}: @{members.find(m => m.user_id === winnerPrediction.predicted_winner_id)?.profiles?.username || '?'}
                      {' · '}{t('tippen.canChangeAnytime')}
                    </p>
                  )}

                  <button
                    onClick={saveWinnerPrediction}
                    disabled={!selectedWinner || winnerBetSaving}
                    style={{
                      width: '100%', padding: 12, borderRadius: 10, border: 'none', cursor: 'pointer',
                      background: selectedWinner
                        ? 'linear-gradient(135deg, var(--gold-dim), var(--gold-primary))'
                        : 'var(--bg-elevated)',
                      color: selectedWinner ? 'var(--text-inverse)' : 'var(--text-muted)',
                      fontFamily: 'var(--font-display)', fontSize: 11, fontWeight: 700,
                      letterSpacing: 1.5, textTransform: 'uppercase',
                      opacity: winnerBetSaving ? 0.6 : 1,
                    }}
                  >
                    {winnerBetSaving ? t('tippen.saving') : winnerPrediction ? t('tippen.changeTip') : t('tippen.submitWinnerTip')}
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ════════════════════════════════════════════════════════════
         BONUS TAB
         ════════════════════════════════════════════════════════════ */}
      {activeTab === 'bonus' && (
        <div style={{ padding: '16px 16px 0' }}>
          {isAdmin && (
            <BonusQuestionAdmin
              groupId={groupId}
              onCreated={() => {
                // Reload bonus questions
                supabase.from('tip_bonus_questions').select('*').eq('group_id', groupId).order('sort_order')
                  .then(({ data }: any) => setBonusQuestions(data || []))
              }}
              onResolve={async (qId, correctAnswer) => {
                await supabase.from('tip_bonus_questions')
                  .update({ correct_answer: correctAnswer, status: 'resolved' })
                  .eq('id', qId)
                // Recalculate bonus points
                const { data: answers } = await supabase.from('tip_bonus_answers').select('*').eq('question_id', qId)
                const q = bonusQuestions.find(bq => bq.id === qId)
                if (answers && q) {
                  for (const a of answers) {
                    const pts = a.answer.toLowerCase().trim() === correctAnswer.toLowerCase().trim() ? q.points : 0
                    await supabase.from('tip_bonus_answers').update({ points_earned: pts }).eq('id', a.id)
                  }
                }
                showToast(t('tippen.bonusResolved'))
                // Reload
                const { data: bqs } = await supabase.from('tip_bonus_questions').select('*').eq('group_id', groupId).order('sort_order')
                setBonusQuestions(bqs || [])
              }}
            />
          )}

          {bonusQuestions.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '40px 0' }}>
              <p style={{ fontSize: 40, lineHeight: 1, marginBottom: 12 }}>⚽</p>
              <p style={{ fontSize: 14, color: 'var(--text-muted)' }}>{t('tippen.noBonusQuestions')}</p>
            </div>
          ) : (
            bonusQuestions.map(bq => (
              <BonusQuestionCard
                key={bq.id}
                question={bq}
                myAnswer={bonusAnswers[bq.id] || null}
                onSubmit={submitBonusAnswer}
              />
            ))
          )}
        </div>
      )}

      {/* ════════════════════════════════════════════════════════════
         BRACKET TAB (tournament only)
         ════════════════════════════════════════════════════════════ */}
      {activeTab === 'bracket' && isTournament && (
        <div style={{ padding: '16px 0' }}>
          <TournamentBracket
            tips={bracketTips.map(t => ({
              stage: t.stage,
              position: t.position,
              predicted_team_name: t.predicted_team_name,
              actual_team_name: t.actual_team_name,
              is_correct: t.is_correct,
              points_earned: t.points_earned,
            }))}
            stages={(() => {
              // Derive stages from question data
              const stagesSet = new Set(questions.filter(q => q.competition_stage).map(q => q.competition_stage!))
              const stageOrder = ['LAST_16', 'ROUND_OF_16', 'QUARTER_FINALS', 'SEMI_FINALS', 'THIRD_PLACE', 'FINAL']
              return stageOrder.filter(s => stagesSet.has(s))
            })()}
            teamOptions={(() => {
              const teams = new Set<string>()
              questions.forEach(q => {
                if (q.home_team) teams.add(q.home_team)
                if (q.away_team) teams.add(q.away_team)
              })
              return [...teams].sort()
            })()}
            onSave={saveBracketTip}
            locked={false}
          />
        </div>
      )}

      {/* ════════════════════════════════════════════════════════════
         CHAT TAB
         ════════════════════════════════════════════════════════════ */}
      {activeTab === 'chat' && (
        <div style={{ display: 'flex', flexDirection: 'column', height: 'calc(100dvh - 160px)' }}>
          {/* Messages area */}
          <div ref={messagesRef} style={{ flex: 1, overflowY: 'auto', padding: '16px 16px 8px', display: 'flex', flexDirection: 'column', gap: 8 }}>
            {chatMessages.length === 0 ? (
              <div style={{ textAlign: 'center', paddingTop: 40 }}>
                <p style={{ fontSize: 14, color: 'var(--text-muted)' }}>{t('tippen.noMessages')}</p>
              </div>
            ) : (
              chatMessages.map(msg => {
                const isMine = msg.sender_id === user?.id
                const sender = msg.profiles

                return (
                  <div key={msg.id} style={{
                    display: 'flex', gap: 8,
                    flexDirection: isMine ? 'row-reverse' : 'row',
                    alignItems: 'flex-start',
                  }}>
                    {!isMine && (
                      <ProfileImage size={30} avatarUrl={sender?.avatar_url} name={sender?.username || '?'} />
                    )}
                    <div style={{ maxWidth: '75%' }}>
                      {!isMine && (
                        <p style={{ fontSize: 11, color: 'var(--gold-primary)', margin: '0 0 2px', fontWeight: 600 }}>
                          @{sender?.username || '???'}
                        </p>
                      )}
                      <div style={{
                        padding: '10px 14px',
                        borderRadius: isMine ? '14px 14px 4px 14px' : '14px 14px 14px 4px',
                        background: isMine ? 'linear-gradient(135deg, var(--gold-dim), var(--gold-primary))' : 'var(--bg-surface)',
                        border: isMine ? 'none' : '1px solid var(--border-subtle)',
                      }}>
                        <p style={{
                          fontSize: 14, margin: 0, lineHeight: 1.5, wordBreak: 'break-word',
                          color: isMine ? 'var(--text-inverse)' : 'var(--text-primary)',
                          fontFamily: 'Crimson Text, serif',
                        }}>
                          {msg.content}
                        </p>
                      </div>
                      <p style={{
                        fontSize: 10, color: 'var(--text-muted)', margin: '2px 0 0',
                        textAlign: isMine ? 'right' : 'left',
                      }}>
                        {formatChatTime(msg.created_at)}
                      </p>
                    </div>
                  </div>
                )
              })
            )}
            <div ref={chatBottomRef} />
          </div>

          {/* Input bar */}
          <div style={{
            padding: '10px 16px', borderTop: '1px solid var(--border-subtle)',
            display: 'flex', alignItems: 'center', gap: 8, background: 'var(--bg-base)',
          }}>
            <input
              value={chatText} onChange={e => setChatText(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendChatMsg() } }}
              placeholder={t('tippen.messagePlaceholder')}
              maxLength={1000}
              style={{
                flex: 1, padding: '12px 16px', background: 'var(--bg-elevated)',
                border: '1px solid var(--border-subtle)', borderRadius: 24,
                color: 'var(--text-primary)', fontSize: 14, fontFamily: 'Crimson Text, serif',
                outline: 'none',
              }}
            />
            <button onClick={sendChatMsg} disabled={!chatText.trim() || chatSending} style={{
              width: 42, height: 42, borderRadius: '50%', border: 'none', cursor: 'pointer',
              background: chatText.trim() ? 'linear-gradient(135deg, var(--gold-dim), var(--gold-primary))' : 'var(--bg-elevated)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 18, transition: 'background .2s', flexShrink: 0,
              color: chatText.trim() ? 'var(--text-inverse)' : 'var(--text-muted)',
            }}>
              {chatSending ? '...' : '➤'}
            </button>
          </div>
        </div>
      )}

      {/* ════════════════════════════════════════════════════════════
         SETTINGS TAB (admin only)
         ════════════════════════════════════════════════════════════ */}
      {activeTab === 'settings' && (
        isAdmin ? (
          <GroupSettingsPanel
            group={{
              id: group.id,
              name: group.name,
              description: group.description,
              is_public: group.is_public,
              points_exact: group.points_exact,
              points_diff: group.points_diff,
              points_tendency: group.points_tendency,
              joker_enabled: group.joker_enabled,
              joker_multiplier: group.joker_multiplier,
              joker_per_matchday: group.joker_per_matchday,
              competition_code: group.competition_code,
              competition_name: group.competition_name,
              season_year: group.season_year,
              last_synced_at: group.last_synced_at,
              invite_code: group.invite_code,
            }}
            members={members.map(m => ({
              user_id: m.user_id,
              username: m.profiles?.username || '?',
              display_name: m.profiles?.display_name || null,
              avatar_url: m.profiles?.avatar_url || null,
              role: m.role,
            }))}
            currentUserId={user?.id || ''}
            onSync={syncMatches}
            onGroupUpdated={async () => {
              const { data: g } = await supabase.from('tip_groups').select('*').eq('id', groupId).single()
              if (g) setGroup(g)
              const { data: ms } = await supabase.from('tip_group_members').select('*, profiles(username, display_name, avatar_url)')
                .eq('group_id', groupId).order('total_points', { ascending: false })
              setMembers(ms || [])
            }}
            onDelete={() => router.push('/app/tippen')}
            onLeave={undefined}
          />
        ) : (
          /* Non-admin: only show leave option */
          <div style={{ padding: '16px' }}>
            <div style={{
              background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)',
              borderRadius: 14, padding: 16, marginBottom: 16,
            }}>
              <h3 style={{ fontSize: 13, fontFamily: 'var(--font-display)', color: 'var(--gold-primary)', margin: '0 0 12px', letterSpacing: 1 }}>
                {t('tippen.group')}
              </h3>
              <p style={{ fontSize: 13, color: 'var(--text-secondary)', margin: '0 0 6px' }}>
                {group.name}
              </p>
              <p style={{ fontSize: 11, color: 'var(--text-muted)', margin: 0 }}>
                {t('tippen.inviteCode')}: <strong style={{ color: 'var(--gold-primary)', letterSpacing: 2 }}>{group.invite_code}</strong>
              </p>
            </div>
            <div style={{
              background: 'rgba(239, 68, 68, 0.05)', border: '1px solid var(--status-error)',
              borderRadius: 14, padding: 16,
            }}>
              <h3 style={{ fontSize: 13, fontFamily: 'var(--font-display)', color: 'var(--status-error)', margin: '0 0 12px', letterSpacing: 1 }}>
                {t('tippen.dangerZone')}
              </h3>
              <button onClick={async () => {
                if (!confirm(t('tippen.leaveConfirm'))) return
                await supabase.from('tip_group_members').delete().eq('group_id', groupId).eq('user_id', user?.id)
                router.push('/app/tippen')
              }} style={{
                width: '100%', padding: '12px',
                background: 'none', border: '1px solid var(--status-error)',
                borderRadius: 10, color: 'var(--status-error)',
                fontFamily: 'var(--font-display)', fontSize: 12, fontWeight: 700,
                letterSpacing: 1, cursor: 'pointer', textTransform: 'uppercase',
              }}>
                {t('tippen.leaveGroup')}
              </button>
            </div>
          </div>
        )
      )}

      {/* ── TOAST ── */}
      {toast && (
        <div style={{
          position: 'fixed', bottom: 100, left: '50%', transform: 'translateX(-50%)',
          background: 'var(--bg-overlay)', border: '1px solid var(--gold-primary)',
          borderRadius: 12, padding: '10px 20px', zIndex: 200,
          color: 'var(--text-primary)', fontSize: 13, fontWeight: 600,
          boxShadow: 'var(--shadow-lg)', whiteSpace: 'nowrap',
        }}>
          {toast}
        </div>
      )}
    </div>
  )
}
