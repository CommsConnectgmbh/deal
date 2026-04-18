'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/contexts/AuthContext'
import { useLang } from '@/contexts/LanguageContext'
import { supabase } from '@/lib/supabase'
import TipGroupInteractionBar from '@/components/tippen/TipGroupInteractionBar'
import TipGroupBetWidget from '@/components/TipGroupBetWidget'

const LEAGUE_OPTIONS = [
  { value: 'BL1', label: '🇩🇪 Bundesliga', type: 'LEAGUE' },
  { value: 'BL2', label: '🇩🇪 2. Bundesliga', type: 'LEAGUE' },
  { value: 'CL', label: '🏆 Champions League', type: 'CUP' },
  { value: 'PL', label: '🏴 Premier League', type: 'LEAGUE' },
  { value: 'PD', label: '🇪🇸 La Liga', type: 'LEAGUE' },
  { value: 'EC', label: '🇪🇺 EM', type: 'TOURNAMENT' },
  { value: 'WC', label: '🌍 WM', type: 'TOURNAMENT' },
]

interface TipGroup {
  id: string
  name: string
  description: string | null
  category: string
  league: string | null
  stake: string | null
  invite_code: string
  is_public: boolean
  created_by: string
  max_members: number
  status: string
  created_at: string
  member_count?: number
  user_rank?: number
  next_question?: { question: string; deadline: string; home_team?: string; away_team?: string } | null
}

function generateInviteCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ'
  let code = 'DEAL-'
  for (let i = 0; i < 5; i++) code += chars[Math.floor(Math.random() * chars.length)]
  return code
}

export default function TippenPage() {
  const { user, profile, refreshProfile } = useAuth()
  const { t } = useLang()
  const router = useRouter()

  const [myGroups, setMyGroups] = useState<TipGroup[]>([])
  const [publicGroups, setPublicGroups] = useState<TipGroup[]>([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [inviteCode, setInviteCode] = useState('')
  const [joinLoading, setJoinLoading] = useState(false)
  const [joinError, setJoinError] = useState('')

  // Create form state
  const [formName, setFormName] = useState('')
  const [formCategory, setFormCategory] = useState('football')
  const [formLeague, setFormLeague] = useState('BL1')
  const [formStake, setFormStake] = useState('')
  const [formPublic, setFormPublic] = useState(true)
  const [formMaxMembers, setFormMaxMembers] = useState('50')
  const [formAutoSync, setFormAutoSync] = useState(true)
  const [formSeason, setFormSeason] = useState('2025')
  const [creating, setCreating] = useState(false)
  const [createError, setCreateError] = useState('')

  // Filter state
  const [tipFilter, setTipFilter] = useState<'alle' | 'followers' | 'bookmarks'>('alle')
  const [followIds, setFollowIds] = useState<string[]>([])
  const [bookmarkedGroupIds, setBookmarkedGroupIds] = useState<Set<string>>(new Set())
  const [followerGroupIds, setFollowerGroupIds] = useState<Set<string>>(new Set())

  // Loading states for actions
  const [bookmarkLoading, setBookmarkLoading] = useState<string | null>(null)
  const [actionLoading, setActionLoading] = useState(false)

  // Edit/Delete state
  const [editGroupId, setEditGroupId] = useState<string | null>(null)
  const [editName, setEditName] = useState('')
  const [editSaving, setEditSaving] = useState(false)
  const [menuOpenId, setMenuOpenId] = useState<string | null>(null)
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null)

  // Fight Night collapsible cards
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set())
  const toggleGroupExpand = (id: string) => {
    setExpandedGroups(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id); else next.add(id)
      return next
    })
  }

  const fetchGroups = useCallback(async () => {
    if (!user) return
    setLoading(true)

    // Fetch groups where user is a member
    const { data: memberRows } = await supabase
      .from('tip_group_members')
      .select('group_id')
      .eq('user_id', user.id)

    const memberGroupIds = (memberRows || []).map((r: any) => r.group_id)

    // Fetch my groups with details
    if (memberGroupIds.length > 0) {
      const { data: groups } = await supabase
        .from('tip_groups')
        .select('*')
        .in('id', memberGroupIds)
        .eq('status', 'active')
        .order('created_at', { ascending: false })

      const enriched: TipGroup[] = []
      for (const g of groups || []) {
        // Member count
        const { count } = await supabase
          .from('tip_group_members')
          .select('*', { count: 'exact', head: true })
          .eq('group_id', g.id)

        // User rank
        const { data: rankings } = await supabase
          .from('tip_group_members')
          .select('user_id, total_points')
          .eq('group_id', g.id)
          .order('total_points', { ascending: false })

        const rankIndex = (rankings || []).findIndex((r: any) => r.user_id === user.id)

        // Next open question
        const { data: nextQ } = await supabase
          .from('tip_questions')
          .select('question, deadline, home_team, away_team')
          .eq('group_id', g.id)
          .eq('status', 'open')
          .order('deadline', { ascending: true })
          .limit(1)

        enriched.push({
          ...g,
          member_count: count || 0,
          user_rank: rankIndex >= 0 ? rankIndex + 1 : 0,
          next_question: nextQ && nextQ.length > 0 ? nextQ[0] : null,
        })
      }
      setMyGroups(enriched)
    } else {
      setMyGroups([])
    }

    // Fetch public groups where user is NOT a member
    let pubQuery = supabase
      .from('tip_groups')
      .select('*')
      .eq('is_public', true)
      .eq('status', 'active')
      .order('created_at', { ascending: false })
      .limit(20)

    if (memberGroupIds.length > 0) {
      pubQuery = pubQuery.not('id', 'in', `(${memberGroupIds.join(',')})`)
    }

    const { data: pubGroups } = await pubQuery

    const pubEnriched: TipGroup[] = []
    for (const g of pubGroups || []) {
      const { count } = await supabase
        .from('tip_group_members')
        .select('*', { count: 'exact', head: true })
        .eq('group_id', g.id)
      pubEnriched.push({ ...g, member_count: count || 0 })
    }
    setPublicGroups(pubEnriched)
    setLoading(false)
  }, [user])

  useEffect(() => {
    if (user) fetchGroups()
  }, [user, fetchGroups])

  // Fetch follow IDs, bookmarks, and follower group IDs
  useEffect(() => {
    if (!profile) return
    const loadFilterData = async () => {
      // 1. Get IDs of people I follow
      const { data: followRows } = await supabase
        .from('follows')
        .select('following_id')
        .eq('follower_id', profile.id)
      const fIds = (followRows || []).map((r: any) => r.following_id)
      setFollowIds(fIds)

      // 2. Get bookmarked tip_group IDs
      const { data: bookmarkRows } = await supabase
        .from('user_bookmarks')
        .select('item_id')
        .eq('user_id', profile.id)
        .eq('item_type', 'tip_group')
      setBookmarkedGroupIds(new Set((bookmarkRows || []).map((r: any) => r.item_id)))

      // 3. Get group IDs where at least one member is someone I follow
      if (fIds.length > 0) {
        const { data: memberRows } = await supabase
          .from('tip_group_members')
          .select('group_id')
          .in('user_id', fIds)
        const uniqueGroupIds = new Set<string>((memberRows || []).map((r: any) => r.group_id))
        setFollowerGroupIds(uniqueGroupIds)
      } else {
        setFollowerGroupIds(new Set())
      }
    }
    loadFilterData()
  }, [profile])

  // Toggle bookmark for a tip group
  const toggleGroupBookmark = async (groupId: string) => {
    if (!profile) return
    setBookmarkLoading(groupId)
    try {
      const isBookmarked = bookmarkedGroupIds.has(groupId)
      if (isBookmarked) {
        await supabase
          .from('user_bookmarks')
          .delete()
          .eq('user_id', profile.id)
          .eq('item_type', 'tip_group')
          .eq('item_id', groupId)
        setBookmarkedGroupIds(prev => { const next = new Set(prev); next.delete(groupId); return next })
      } else {
        await supabase
          .from('user_bookmarks')
          .insert({ user_id: profile.id, item_type: 'tip_group', item_id: groupId })
        setBookmarkedGroupIds(prev => new Set(prev).add(groupId))
      }
      if (typeof navigator !== 'undefined' && navigator.vibrate) navigator.vibrate(10)
    } finally {
      setBookmarkLoading(null)
    }
  }

  // Filtered public groups
  const filteredPublicGroups = publicGroups.filter(g => {
    if (tipFilter === 'followers') return followerGroupIds.has(g.id)
    if (tipFilter === 'bookmarks') return bookmarkedGroupIds.has(g.id)
    return true
  })

  // Also filter myGroups for bookmarks/followers view
  const filteredMyGroups = myGroups.filter(g => {
    if (tipFilter === 'followers') return followerGroupIds.has(g.id)
    if (tipFilter === 'bookmarks') return bookmarkedGroupIds.has(g.id)
    return true
  })

  const validateFormName = (v: string): string => {
    if (!v.trim()) return t('tippen.name') + ' required'
    if (v.trim().length < 3) return 'Min. 3 Zeichen'
    if (v.trim().length > 50) return 'Max. 50 Zeichen'
    return ''
  }
  const validateMaxMembers = (v: string): string => {
    const n = parseInt(v)
    if (isNaN(n)) return 'Muss eine Zahl sein'
    if (n < 2) return 'Min. 2'
    if (n > 100) return 'Max. 100'
    return ''
  }

  const [formNameErr, setFormNameErr] = useState('')
  const [formMaxMembersErr, setFormMaxMembersErr] = useState('')
  const [deleting, setDeleting] = useState<string | null>(null)
  const [leaving, setLeaving] = useState<string | null>(null)

  const handleCreate = async () => {
    const nameErr = validateFormName(formName)
    const membersErr = validateMaxMembers(formMaxMembers)
    setFormNameErr(nameErr)
    setFormMaxMembersErr(membersErr)
    if (nameErr || membersErr) return
    if (!user || !formName.trim()) return
    setCreating(true)
    setCreateError('')

    const code = generateInviteCode()
    const leagueOption = LEAGUE_OPTIONS.find(l => l.value === formLeague)
    const { data: newGroup, error } = await supabase
      .from('tip_groups')
      .insert({
        name: formName.trim(),
        category: formCategory,
        league: formCategory === 'football' ? formLeague : null,
        stake: formStake.trim() || null,
        invite_code: code,
        is_public: formPublic,
        created_by: user.id,
        max_members: parseInt(formMaxMembers) || 50,
        status: 'active',
        // New competition fields
        competition_code: formCategory === 'football' ? formLeague : null,
        competition_name: formCategory === 'football' ? leagueOption?.label?.replace(/^[^\s]+\s/, '') : null,
        competition_type: formCategory === 'football' ? (leagueOption?.type || 'LEAGUE') : null,
        season_year: formCategory === 'football' ? formSeason : null,
        auto_sync: formCategory === 'football' ? formAutoSync : false,
      })
      .select()
      .single()

    if (error || !newGroup) {
      setCreateError(error?.message || t('tippen.createError'))
      setCreating(false)
      return
    }

    // Add creator as admin member
    await supabase.from('tip_group_members').insert({
      group_id: newGroup.id,
      user_id: user.id,
      role: 'admin',
      total_points: 0,
      jokers_remaining: 3,
    })

    // Award +50 XP
    await supabase.from('xp_events').insert({
      user_id: user.id,
      xp: 50,
      reason: 'Tippgruppe erstellt',
    })
    await supabase
      .from('profiles')
      .update({ xp: (profile?.xp || 0) + 50 })
      .eq('id', user.id)
    refreshProfile()

    // Auto-sync matches if football + auto_sync enabled
    if (formCategory === 'football' && formAutoSync && formLeague) {
      try {
        // Force token refresh to avoid stale JWT (401 errors)
        const { data: { session } } = await supabase.auth.refreshSession()
        if (session) {
          await fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/sync-league-matches`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${session.access_token}`,
              apikey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '',
            },
            body: JSON.stringify({
              group_id: newGroup.id,
              competition_code: formLeague,
              season: formSeason,
            }),
          })
        }
      } catch {}
    }

    setCreating(false)
    setShowModal(false)
    setFormName('')
    setFormStake('')
    setFormCategory('football')
    setFormLeague('BL1')
    setFormPublic(true)
    setFormMaxMembers('50')
    setFormAutoSync(true)
    setFormSeason('2025')
    fetchGroups()
  }

  const handleJoinPublic = async (groupId: string) => {
    if (!user) return
    setJoinLoading(true)
    await supabase.from('tip_group_members').insert({
      group_id: groupId,
      user_id: user.id,
      role: 'member',
      total_points: 0,
      jokers_remaining: 3,
    })
    setJoinLoading(false)
    fetchGroups()
  }

  const handleJoinByCode = async () => {
    if (!user || !inviteCode.trim()) return
    setJoinLoading(true)
    setJoinError('')

    const code = inviteCode.trim().toUpperCase()
    const { data: group } = await supabase
      .from('tip_groups')
      .select('*')
      .eq('invite_code', code)
      .single()

    if (!group) {
      setJoinError(t('tippen.groupNotFound'))
      setJoinLoading(false)
      return
    }

    // Check if already member
    const { data: existing } = await supabase
      .from('tip_group_members')
      .select('user_id')
      .eq('group_id', group.id)
      .eq('user_id', user.id)
      .maybeSingle()

    if (existing) {
      setJoinLoading(false)
      router.push(`/app/tippen/${group.id}`)
      return
    }

    await supabase.from('tip_group_members').insert({
      group_id: group.id,
      user_id: user.id,
      role: 'member',
      total_points: 0,
      jokers_remaining: 3,
    })

    setJoinLoading(false)
    setInviteCode('')
    router.push(`/app/tippen/${group.id}`)
  }

  const handleEditGroup = async (groupId: string) => {
    if (!editName.trim() || editSaving) return
    setEditSaving(true)
    await supabase.from('tip_groups').update({ name: editName.trim() }).eq('id', groupId)
    setEditSaving(false)
    setEditGroupId(null)
    fetchGroups()
  }

  const handleDeleteGroup = async (groupId: string) => {
    setDeleting(groupId)
    setActionLoading(true)
    try {
      await supabase.from('tip_groups').update({ status: 'deleted' }).eq('id', groupId)
      setDeleteConfirmId(null)
      setMenuOpenId(null)
      fetchGroups()
    } finally {
      setActionLoading(false)
      setDeleting(null)
    }
  }

  const handleLeaveGroup = async (groupId: string) => {
    if (!user) return
    setLeaving(groupId)
    setActionLoading(true)
    try {
      await supabase.from('tip_group_members').delete().eq('group_id', groupId).eq('user_id', user.id)
      setMenuOpenId(null)
      fetchGroups()
    } finally {
      setActionLoading(false)
      setLeaving(null)
    }
  }

  const formatDeadline = (iso: string) => {
    const d = new Date(iso)
    return d.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })
  }

  // ── Render ──────────────────────────────────────────────────────

  return (
    <div style={{ minHeight: 'calc(100dvh - 80px)', background: 'var(--bg-base)', padding: '24px 16px 100px' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
        <h1 style={{
          fontFamily: 'var(--font-display)', fontSize: 26, fontWeight: 700,
          color: 'var(--gold-primary)', margin: 0, letterSpacing: 2, textTransform: 'uppercase',
        }}>
          🏆 TIPPEN
        </h1>
      </div>

      {/* Create Button */}
      <button
        onClick={() => setShowModal(true)}
        style={{
          width: '100%', padding: '14px 0', marginBottom: 28,
          background: 'linear-gradient(135deg, var(--gold-dim), var(--gold-primary))',
          color: 'var(--text-inverse)', fontFamily: 'var(--font-display)',
          fontSize: 12, fontWeight: 700, letterSpacing: 2, textTransform: 'uppercase',
          border: 'none', borderRadius: 12, cursor: 'pointer',
        }}
      >
        {t('tippen.newGroup')}
      </button>

      {/* Filter Tab Bar */}
      <div style={{ display: 'flex', gap: 8, justifyContent: 'center', marginBottom: 20 }}>
        {(['alle', 'followers', 'bookmarks'] as const).map(f => (
          <button
            key={f}
            onClick={() => setTipFilter(f)}
            style={{
              fontSize: 10, fontFamily: 'var(--font-display)', letterSpacing: 1.5,
              padding: '8px 16px', borderRadius: 20, border: 'none', cursor: 'pointer',
              background: tipFilter === f ? 'var(--gold-primary)' : 'var(--bg-overlay)',
              color: tipFilter === f ? 'var(--text-inverse)' : 'var(--text-muted)',
              fontWeight: tipFilter === f ? 800 : 600,
              transition: 'all 0.2s ease',
            }}
          >
            {t(`tippen.filter${f.charAt(0).toUpperCase() + f.slice(1)}`)}
          </button>
        ))}
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: 40, color: 'var(--text-muted)', fontSize: 14 }}>{t('tippen.loading')}</div>
      ) : (
        <>
          {/* ── MEINE GRUPPEN ── */}
          <SectionHeader label={t('tippen.myGroups')} />

          {filteredMyGroups.length === 0 ? (
            <p style={{ color: 'var(--text-muted)', fontSize: 14, textAlign: 'center', margin: '12px 0 28px' }}>
              {tipFilter === 'bookmarks' ? t('tippen.noBookmarks') : tipFilter === 'followers' ? t('tippen.noFollowerGroups') : t('tippen.noGroupsYet')}
            </p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 28 }}>
              {filteredMyGroups.map((g) => {
                const isGroupAdmin = g.created_by === user?.id

                // Inline edit mode
                if (editGroupId === g.id) {
                  return (
                    <div key={g.id} style={{
                      background: 'var(--bg-surface)', border: '1px solid var(--gold-primary)',
                      borderRadius: 14, padding: '16px 18px',
                    }}>
                      <label style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 700, marginBottom: 4, display: 'block', letterSpacing: 1 }}>
                        {t('tippen.groupName')}
                      </label>
                      <input
                        value={editName}
                        onChange={e => setEditName(e.target.value)}
                        autoFocus
                        maxLength={60}
                        style={{
                          width: '100%', padding: '10px 14px', background: 'var(--bg-elevated)',
                          border: '1px solid var(--border-subtle)', borderRadius: 10, marginBottom: 10,
                          color: 'var(--text-primary)', fontSize: 14, outline: 'none', boxSizing: 'border-box',
                        }}
                      />
                      <div style={{ display: 'flex', gap: 8 }}>
                        <button onClick={() => setEditGroupId(null)} style={{
                          flex: 1, padding: '10px', background: 'var(--bg-elevated)',
                          border: '1px solid var(--border-subtle)', borderRadius: 10,
                          color: 'var(--text-muted)', fontSize: 11, fontFamily: 'var(--font-display)',
                          cursor: 'pointer',
                        }}>
                          {t('tippen.cancel')}
                        </button>
                        <button onClick={() => handleEditGroup(g.id)} disabled={editSaving || !editName.trim()} style={{
                          flex: 1, padding: '10px',
                          background: editName.trim() ? 'linear-gradient(135deg, var(--gold-dim), var(--gold-primary))' : 'var(--bg-elevated)',
                          border: 'none', borderRadius: 10, color: 'var(--text-inverse)',
                          fontSize: 11, fontFamily: 'var(--font-display)', fontWeight: 700,
                          cursor: 'pointer', letterSpacing: 1, opacity: editSaving ? 0.6 : 1,
                        }}>
                          {editSaving ? '...' : t('tippen.save')}
                        </button>
                      </div>
                    </div>
                  )
                }

                // Delete confirm mode
                if (deleteConfirmId === g.id) {
                  return (
                    <div key={g.id} style={{
                      background: 'rgba(239, 68, 68, 0.05)', border: '1px solid var(--status-error)',
                      borderRadius: 14, padding: '16px 18px',
                    }}>
                      <p style={{ fontSize: 13, color: 'var(--status-error)', margin: '0 0 4px', fontWeight: 700 }}>
                        &quot;{g.name}&quot; {t('tippen.deleteConfirm')}
                      </p>
                      <p style={{ fontSize: 12, color: 'var(--text-muted)', margin: '0 0 12px' }}>
                        {t('tippen.deleteWarning')}
                      </p>
                      <div style={{ display: 'flex', gap: 8 }}>
                        <button onClick={() => setDeleteConfirmId(null)} style={{
                          flex: 1, padding: '10px', background: 'var(--bg-elevated)',
                          border: '1px solid var(--border-subtle)', borderRadius: 10,
                          color: 'var(--text-muted)', fontSize: 11, fontFamily: 'var(--font-display)',
                          cursor: 'pointer',
                        }}>
                          {t('tippen.cancel')}
                        </button>
                        <button onClick={() => handleDeleteGroup(g.id)} disabled={deleting === g.id || actionLoading} style={{
                          flex: 1, padding: '10px',
                          background: 'var(--status-error)', border: 'none', borderRadius: 10,
                          color: '#fff', fontSize: 11, fontFamily: 'var(--font-display)',
                          fontWeight: 700, cursor: (deleting === g.id || actionLoading) ? 'not-allowed' : 'pointer', letterSpacing: 1,
                          opacity: (deleting === g.id || actionLoading) ? 0.6 : 1,
                        }}>
                          {deleting === g.id ? '...' : t('tippen.yesDelete')}
                        </button>
                      </div>
                    </div>
                  )
                }

                {
                  const isGroupExpanded = expandedGroups.has(g.id)
                  return (
                  <div
                    key={g.id}
                    style={{
                      background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)',
                      borderRadius: 16, overflow: 'hidden',
                      position: 'relative',
                      boxShadow: 'var(--shadow-sm)',
                    }}
                  >
                    {/* ═══ COLLAPSED HEADER — Deal-Style 3 rows ═══ */}
                    <div
                      onClick={() => toggleGroupExpand(g.id)}
                      style={{
                        display: 'flex', alignItems: 'center', gap: 10,
                        padding: '10px 12px', cursor: 'pointer',
                        borderBottom: isGroupExpanded ? '1px solid var(--border-subtle)' : 'none',
                      }}
                    >
                      {/* Status dot */}
                      <span style={{
                        width: 7, height: 7, borderRadius: '50%', flexShrink: 0,
                        background: '#4ade80',
                        boxShadow: '0 0 5px rgba(74,222,128,0.5)',
                      }} />

                      {/* Main info block — 3 rows */}
                      <div style={{ flex: 1, minWidth: 0 }}>
                        {/* Row 1: Title */}
                        <p style={{
                          fontFamily: 'var(--font-display)', fontSize: 12, fontWeight: 800,
                          color: 'var(--text-primary)', letterSpacing: 0.8, lineHeight: 1.25,
                          margin: 0,
                          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                        }}>
                          {g.name}
                        </p>
                        {/* Row 2: Members + Rank — gold */}
                        <div style={{
                          display: 'flex', alignItems: 'center', gap: 5, margin: '3px 0 0',
                        }}>
                          <span style={{
                            fontSize: 11, fontWeight: 700, color: 'var(--gold-primary)',
                            fontFamily: 'var(--font-display)', letterSpacing: 0.5,
                          }}>
                            {'\uD83D\uDC65'} {g.member_count} {t('tippen.members')} {'\u00B7'} {'\uD83C\uDFC6'} #{g.user_rank || '\u2013'}
                          </span>
                        </div>
                        {/* Row 3: Stake chip + Next question hint */}
                        <div style={{
                          display: 'flex', alignItems: 'center', gap: 5, margin: '3px 0 0',
                        }}>
                          {g.stake && (
                            <span style={{
                              fontSize: 9, color: 'var(--text-secondary)', fontWeight: 600,
                              fontFamily: 'var(--font-body)', whiteSpace: 'nowrap',
                              padding: '2px 8px', borderRadius: 6,
                              background: 'var(--gold-subtle)',
                              border: '1px solid var(--gold-glow)',
                            }}>
                              {'\uD83C\uDFAF'} {g.stake}
                            </span>
                          )}
                          {g.next_question && (
                            <span style={{
                              fontSize: 9, color: 'var(--text-muted)', fontWeight: 600,
                              fontFamily: 'var(--font-body)', whiteSpace: 'nowrap',
                              padding: '2px 8px', borderRadius: 6,
                              background: 'var(--bg-overlay)',
                              border: '1px solid var(--border-subtle)',
                            }}>
                              {'\u23F3'} {formatDeadline(g.next_question.deadline)}
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Bookmark button */}
                      <button
                        onClick={(e) => { e.stopPropagation(); toggleGroupBookmark(g.id) }}
                        disabled={bookmarkLoading === g.id}
                        style={{
                          background: 'none', border: 'none', cursor: bookmarkLoading === g.id ? 'not-allowed' : 'pointer', padding: '2px 4px',
                          fontSize: 16, flexShrink: 0, lineHeight: 1,
                          color: bookmarkedGroupIds.has(g.id) ? 'var(--gold-primary)' : 'var(--text-muted)',
                          transition: 'color 0.2s ease',
                          opacity: bookmarkLoading === g.id ? 0.5 : 1,
                        }}
                      >
                        {bookmarkedGroupIds.has(g.id) ? '\u2691' : '\u2690'}
                      </button>

                      {/* Status badge */}
                      <span style={{
                        fontSize: 7, padding: '3px 7px', borderRadius: 5, flexShrink: 0,
                        fontFamily: 'var(--font-display)', fontWeight: 700, letterSpacing: 1,
                        color: '#4ade80', border: '1px solid rgba(74,222,128,0.27)', background: 'rgba(74,222,128,0.08)',
                      }}>
                        {g.category === 'custom' ? 'CHALLENGE' : t('tippen.active')}
                      </span>

                      {/* Chevron */}
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="var(--text-muted)" strokeWidth="2" strokeLinecap="round"
                        style={{ flexShrink: 0, transition: 'transform 0.25s', transform: isGroupExpanded ? 'rotate(180deg)' : 'rotate(0deg)' }}>
                        <polyline points="6 9 12 15 18 9" />
                      </svg>
                    </div>

                    {/* ═══ EXPANDED: Hero + Details — animated ═══ */}
                    <div style={{
                      display: 'grid',
                      gridTemplateRows: isGroupExpanded ? '1fr' : '0fr',
                      opacity: isGroupExpanded ? 1 : 0,
                      transition: 'grid-template-rows 0.3s ease, opacity 0.25s ease',
                    }}>
                      <div style={{ overflow: 'hidden' }}>
                        {/* Banner */}
                        <div
                          onClick={() => router.push(`/app/tippen/${g.id}`)}
                          style={{
                            position: 'relative', width: '100%', aspectRatio: '860 / 380',
                            backgroundImage: 'url(/tipp-bg.webp)',
                            backgroundSize: 'cover', backgroundPosition: 'center', backgroundRepeat: 'no-repeat',
                            cursor: 'pointer',
                          }}
                        >
                          <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.3)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '16px 20px' }}>
                            <p style={{
                              fontFamily: 'var(--font-display)', fontSize: 12, color: '#ccc', margin: 0, textShadow: '0 1px 4px rgba(0,0,0,0.9)',
                            }}>
                              {g.member_count} {t('tippen.members')} {'\u00B7'} {t('tippen.youRank')} {g.user_rank || '\u2013'}
                            </p>
                          </div>
                          <div style={{
                            position: 'absolute', bottom: 0, left: 0, right: 0, height: '30%',
                            background: 'linear-gradient(to bottom, transparent 0%, var(--bg-surface) 100%)',
                            pointerEvents: 'none',
                          }} />
                        </div>

                        {/* Next question info + menu */}
                        <div style={{ padding: '8px 16px 6px', position: 'relative' }}>
                          <button
                            onClick={(e) => { e.stopPropagation(); setMenuOpenId(menuOpenId === g.id ? null : g.id) }}
                            style={{
                              position: 'absolute', top: 8, right: 12,
                              background: 'none', border: 'none', padding: '4px 8px',
                              fontSize: 18, color: 'var(--text-muted)', cursor: 'pointer', lineHeight: 1,
                            }}
                          >
                            {'\u22EE'}
                          </button>
                          {menuOpenId === g.id && (
                            <div style={{
                              position: 'absolute', top: 36, right: 16, zIndex: 100,
                              background: 'var(--bg-elevated)', border: '1px solid var(--border-subtle)',
                              borderRadius: 10, overflow: 'hidden', boxShadow: 'var(--shadow-lg)',
                              minWidth: 160,
                            }}>
                              {isGroupAdmin && (
                                <button onClick={(e) => { e.stopPropagation(); setMenuOpenId(null); setEditName(g.name); setEditGroupId(g.id) }}
                                  style={{ width: '100%', padding: '12px 16px', background: 'none', border: 'none', color: 'var(--text-primary)', fontSize: 13, textAlign: 'left', cursor: 'pointer', borderBottom: '1px solid var(--border-subtle)' }}>
                                  {'\u270F\uFE0F'} {t('tippen.edit')}
                                </button>
                              )}
                              {isGroupAdmin ? (
                                <button onClick={(e) => { e.stopPropagation(); setMenuOpenId(null); setDeleteConfirmId(g.id) }}
                                  style={{ width: '100%', padding: '12px 16px', background: 'none', border: 'none', color: 'var(--status-error)', fontSize: 13, textAlign: 'left', cursor: 'pointer' }}>
                                  {'\uD83D\uDDD1'} {t('tippen.delete')}
                                </button>
                              ) : (
                                <button onClick={(e) => { e.stopPropagation(); if (confirm(t('tippen.leaveConfirm'))) { handleLeaveGroup(g.id) } }}
                                  disabled={leaving === g.id || actionLoading}
                                  style={{ width: '100%', padding: '12px 16px', background: 'none', border: 'none', color: 'var(--status-error)', fontSize: 13, textAlign: 'left', cursor: (leaving === g.id || actionLoading) ? 'not-allowed' : 'pointer', opacity: (leaving === g.id || actionLoading) ? 0.6 : 1 }}>
                                  {leaving === g.id ? '...' : `${'\uD83D\uDEAA'} ${t('tippen.leave')}`}
                                </button>
                              )}
                            </div>
                          )}
                          <div onClick={() => router.push(`/app/tippen/${g.id}`)}>
                            {g.next_question ? (
                              <div style={{ fontSize: 13, color: 'var(--text-secondary)' }}>
                                {g.next_question.home_team && g.next_question.away_team ? (
                                  <>{t('tippen.nextMatch')}: {g.next_question.home_team} vs {g.next_question.away_team}</>
                                ) : (
                                  <>{g.next_question.question}</>
                                )}
                                <span style={{ color: 'var(--gold-primary)', marginLeft: 8 }}>
                                  {'\u23F1'} {t('tippen.until')} {formatDeadline(g.next_question.deadline)}
                                </span>
                              </div>
                            ) : (
                              <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{t('tippen.noOpenTips')}</div>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* ═══ ALWAYS VISIBLE: Interaction + Tipps ═══ */}
                    <TipGroupInteractionBar groupId={g.id} inviteCode={g.invite_code} groupName={g.name} />
                    <TipGroupBetWidget groupId={g.id} />
                  </div>
                  )
                }
              })}
            </div>
          )}

          {/* ── ÖFFENTLICHE GRUPPEN ── */}
          <SectionHeader label={t('tippen.publicGroups')} />

          {filteredPublicGroups.length === 0 ? (
            <p style={{ color: 'var(--text-muted)', fontSize: 14, textAlign: 'center', margin: '12px 0 28px' }}>
              {tipFilter === 'bookmarks' ? t('tippen.noBookmarks') : tipFilter === 'followers' ? t('tippen.noFollowerGroups') : t('tippen.noPublicGroups')}
            </p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 28 }}>
              {filteredPublicGroups.map((g) => {
                const isPubExpanded = expandedGroups.has(`pub-${g.id}`)
                return (
                <div
                  key={g.id}
                  style={{
                    background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)',
                    borderRadius: 14, overflow: 'hidden',
                    position: 'relative',
                    boxShadow: 'var(--shadow-sm)',
                  }}
                >
                  {/* ═══ COLLAPSED HEADER — Deal-Style 3 rows ═══ */}
                  <div
                    onClick={() => toggleGroupExpand(`pub-${g.id}`)}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 10,
                      padding: '10px 12px', cursor: 'pointer',
                      borderBottom: isPubExpanded ? '1px solid var(--border-subtle)' : 'none',
                    }}
                  >
                    {/* Status dot */}
                    <span style={{
                      width: 7, height: 7, borderRadius: '50%', flexShrink: 0,
                      background: 'var(--gold-primary)',
                      boxShadow: '0 0 5px rgba(255,184,0,0.5)',
                    }} />

                    {/* Main info block — 3 rows */}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      {/* Row 1: Title */}
                      <p style={{
                        fontFamily: 'var(--font-display)', fontSize: 12, fontWeight: 800,
                        color: 'var(--text-primary)', letterSpacing: 0.8, lineHeight: 1.25,
                        margin: 0,
                        overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                      }}>
                        {g.name}
                      </p>
                      {/* Row 2: Members — gold */}
                      <div style={{
                        display: 'flex', alignItems: 'center', gap: 5, margin: '3px 0 0',
                      }}>
                        <span style={{
                          fontSize: 11, fontWeight: 700, color: 'var(--gold-primary)',
                          fontFamily: 'var(--font-display)', letterSpacing: 0.5,
                        }}>
                          {'\uD83D\uDC65'} {g.member_count} {t('tippen.members')}
                        </span>
                      </div>
                      {/* Row 3: Stake chip + Category chip */}
                      <div style={{
                        display: 'flex', alignItems: 'center', gap: 5, margin: '3px 0 0',
                      }}>
                        {g.stake && (
                          <span style={{
                            fontSize: 9, color: 'var(--text-secondary)', fontWeight: 600,
                            fontFamily: 'var(--font-body)', whiteSpace: 'nowrap',
                            padding: '2px 8px', borderRadius: 6,
                            background: 'var(--gold-subtle)',
                            border: '1px solid var(--gold-glow)',
                          }}>
                            {'\uD83C\uDFAF'} {g.stake}
                          </span>
                        )}
                        {g.league && (
                          <span style={{
                            fontSize: 9, color: 'var(--text-muted)', fontWeight: 600,
                            fontFamily: 'var(--font-body)', whiteSpace: 'nowrap',
                            padding: '2px 8px', borderRadius: 6,
                            background: 'var(--bg-overlay)',
                            border: '1px solid var(--border-subtle)',
                          }}>
                            {'\u26BD'} {LEAGUE_OPTIONS.find(l => l.value === g.league)?.label?.replace(/^[^\s]+\s/, '') || g.league}
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Bookmark button */}
                    <button
                      onClick={(e) => { e.stopPropagation(); toggleGroupBookmark(g.id) }}
                      style={{
                        background: 'none', border: 'none', cursor: 'pointer', padding: '2px 4px',
                        fontSize: 16, flexShrink: 0, lineHeight: 1,
                        color: bookmarkedGroupIds.has(g.id) ? 'var(--gold-primary)' : 'var(--text-muted)',
                        transition: 'color 0.2s ease',
                      }}
                    >
                      {bookmarkedGroupIds.has(g.id) ? '\u2691' : '\u2690'}
                    </button>

                    {/* Public badge */}
                    <span style={{
                      fontSize: 7, padding: '3px 7px', borderRadius: 5, flexShrink: 0,
                      fontFamily: 'var(--font-display)', fontWeight: 700, letterSpacing: 1,
                      color: 'var(--gold-primary)', border: '1px solid rgba(255,184,0,0.27)', background: 'rgba(255,184,0,0.08)',
                    }}>
                      {g.category === 'custom' ? 'CHALLENGE' : t('tippen.public')}
                    </span>

                    {/* Chevron */}
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="var(--text-muted)" strokeWidth="2" strokeLinecap="round"
                      style={{ flexShrink: 0, transition: 'transform 0.25s', transform: isPubExpanded ? 'rotate(180deg)' : 'rotate(0deg)' }}>
                      <polyline points="6 9 12 15 18 9" />
                    </svg>
                  </div>

                  {/* ═══ EXPANDED: Hero — animated ═══ */}
                  <div style={{
                    display: 'grid',
                    gridTemplateRows: isPubExpanded ? '1fr' : '0fr',
                    opacity: isPubExpanded ? 1 : 0,
                    transition: 'grid-template-rows 0.3s ease, opacity 0.25s ease',
                  }}>
                    <div style={{ overflow: 'hidden' }}>
                      {/* Background banner */}
                      <div style={{
                        position: 'relative', width: '100%', aspectRatio: '860 / 340',
                        backgroundImage: 'url(/tipp-bg.webp)',
                        backgroundSize: 'cover', backgroundPosition: 'center', backgroundRepeat: 'no-repeat',
                      }}>
                        <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.35)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '16px 20px' }}>
                          <p style={{ fontSize: 12, color: '#ccc', margin: 0, textShadow: '0 1px 4px rgba(0,0,0,0.9)' }}>
                            {g.member_count} {t('tippen.members')}
                          </p>
                        </div>
                        <div style={{
                          position: 'absolute', bottom: 0, left: 0, right: 0, height: '30%',
                          background: 'linear-gradient(to bottom, transparent 0%, var(--bg-surface) 100%)',
                          pointerEvents: 'none',
                        }} />
                      </div>
                    </div>
                  </div>

                  {/* ═══ ALWAYS VISIBLE: Join button ═══ */}
                  <div style={{ padding: '8px 12px 10px', textAlign: 'center' }}>
                    <button
                      onClick={() => handleJoinPublic(g.id)}
                      disabled={joinLoading}
                      style={{
                        width: '100%', padding: '10px 18px',
                        background: 'linear-gradient(135deg, var(--gold-dim), var(--gold-primary))',
                        color: 'var(--text-inverse)', fontFamily: 'var(--font-display)',
                        fontSize: 11, fontWeight: 700, letterSpacing: 1.5, textTransform: 'uppercase',
                        border: 'none', borderRadius: 10, cursor: 'pointer',
                      }}
                    >
                      {t('tippen.join')}
                    </button>
                  </div>
                </div>
                )
              })}
            </div>
          )}

          {/* ── BEITRETEN PER CODE ── */}
          <SectionHeader label={t('tippen.joinByCode')} />

          <div style={{
            display: 'flex', gap: 10, alignItems: 'center', marginBottom: 8,
          }}>
            <input
              value={inviteCode}
              onChange={(e) => { setInviteCode(e.target.value); setJoinError('') }}
              placeholder="DEAL-XXXXX"
              style={{
                flex: 1, padding: '12px 14px', background: 'var(--bg-elevated)',
                border: '1px solid var(--border-subtle)', borderRadius: 10,
                color: 'var(--text-primary)', fontSize: 14, fontFamily: 'var(--font-body)',
                outline: 'none', textTransform: 'uppercase', letterSpacing: 1.5,
              }}
            />
            <button
              onClick={handleJoinByCode}
              disabled={joinLoading || !inviteCode.trim()}
              style={{
                padding: '12px 22px',
                background: inviteCode.trim()
                  ? 'linear-gradient(135deg, var(--gold-dim), var(--gold-primary))'
                  : 'var(--bg-elevated)',
                color: inviteCode.trim() ? 'var(--text-inverse)' : 'var(--text-muted)',
                fontFamily: 'var(--font-display)', fontSize: 11, fontWeight: 700,
                letterSpacing: 1.5, textTransform: 'uppercase',
                border: 'none', borderRadius: 10, cursor: inviteCode.trim() ? 'pointer' : 'default',
              }}
            >
              {t('tippen.join')}
            </button>
          </div>
          {joinError && (
            <p style={{ color: 'var(--status-error)', fontSize: 13, margin: '4px 0 0' }}>{joinError}</p>
          )}
        </>
      )}

      {/* ── CREATE MODAL (bottom sheet) ── */}
      {showModal && (
        <div
          onClick={() => setShowModal(false)}
          style={{
            position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)',
            zIndex: 9999, display: 'flex', alignItems: 'flex-end', justifyContent: 'center',
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              width: '100%', maxWidth: 480,
              background: 'var(--glass-bg)',
              backdropFilter: 'blur(24px) saturate(180%)',
              WebkitBackdropFilter: 'blur(24px) saturate(180%)',
              border: '1px solid var(--glass-border)',
              borderRadius: '20px 20px 0 0', padding: '24px 20px 32px',
              maxHeight: '85dvh', overflowY: 'auto',
              boxShadow: 'var(--shadow-lg)',
            }}
          >
            {/* Drag indicator */}
            <div style={{
              width: 40, height: 4, borderRadius: 2, background: 'var(--border-subtle)',
              margin: '0 auto 18px',
            }} />

            <h2 style={{
              fontFamily: 'var(--font-display)', fontSize: 18, fontWeight: 700,
              color: 'var(--gold-primary)', margin: '0 0 20px', letterSpacing: 1.5,
              textTransform: 'uppercase', textAlign: 'center',
            }}>
              {t('tippen.newGroupTitle')}
            </h2>

            {/* Category selector — pill buttons */}
            <div style={{ display: 'flex', gap: 8, marginBottom: 18 }}>
              <button
                onClick={() => setFormCategory('football')}
                style={{
                  flex: 1, padding: '10px 8px', borderRadius: 10, cursor: 'pointer',
                  fontFamily: 'var(--font-display)', fontSize: 11, fontWeight: 700,
                  letterSpacing: 1, textTransform: 'uppercase',
                  background: formCategory === 'football'
                    ? 'linear-gradient(135deg, rgba(255,184,0,0.15), rgba(255,184,0,0.08))'
                    : 'var(--bg-surface)',
                  border: formCategory === 'football'
                    ? '1.5px solid var(--gold-primary)'
                    : '1px solid var(--border-subtle)',
                  color: formCategory === 'football' ? 'var(--gold-primary)' : 'var(--text-muted)',
                  transition: 'all 0.2s ease',
                }}
              >
                {'\u26BD'} {t('tippen.football')}
              </button>
              <button
                onClick={() => setFormCategory('custom')}
                style={{
                  flex: 1, padding: '10px 8px', borderRadius: 10, cursor: 'pointer',
                  fontFamily: 'var(--font-display)', fontSize: 11, fontWeight: 700,
                  letterSpacing: 1, textTransform: 'uppercase',
                  background: formCategory === 'custom'
                    ? 'linear-gradient(135deg, rgba(255,184,0,0.15), rgba(255,184,0,0.08))'
                    : 'var(--bg-surface)',
                  border: formCategory === 'custom'
                    ? '1.5px solid var(--gold-primary)'
                    : '1px solid var(--border-subtle)',
                  color: formCategory === 'custom' ? 'var(--gold-primary)' : 'var(--text-muted)',
                  transition: 'all 0.2s ease',
                }}
              >
                {'\uD83C\uDFC6'} CHALLENGE
              </button>
            </div>

            {/* Name */}
            <label style={{ fontSize: 12, color: 'var(--text-secondary)', fontWeight: 600, marginBottom: 4, display: 'block' }}>
              {t('tippen.name')}
            </label>
            <input
              value={formName}
              onChange={(e) => { setFormName(e.target.value); if (formNameErr) setFormNameErr(validateFormName(e.target.value)) }}
              onBlur={() => formName && setFormNameErr(validateFormName(formName))}
              placeholder={formCategory === 'custom' ? t('tippen.namePlaceholderCustom') : t('tippen.namePlaceholderFootball')}
              maxLength={50}
              style={{
                width: '100%', padding: '12px 14px', background: 'var(--bg-surface)',
                border: `1px solid ${formNameErr ? 'var(--status-error)' : 'var(--border-subtle)'}`, borderRadius: 10, marginBottom: formNameErr ? 4 : 16,
                color: 'var(--text-primary)', fontSize: 14, fontFamily: 'var(--font-body)',
                outline: 'none', boxSizing: 'border-box',
              }}
            />
            {formNameErr && <p style={{ color: 'var(--status-error)', fontSize: 11, margin: '0 0 12px' }}>{formNameErr}</p>}

            {/* Hint for custom */}
            {formCategory === 'custom' && (
              <p style={{
                fontSize: 11, color: 'var(--text-muted)', fontStyle: 'italic',
                margin: '-10px 0 16px', padding: '0 2px',
              }}>
                {t('tippen.customHint')}
              </p>
            )}

            {/* League (football only) */}
            {formCategory === 'football' && (
              <>
                <label style={{ fontSize: 12, color: 'var(--text-secondary)', fontWeight: 600, marginBottom: 4, display: 'block' }}>
                  {t('tippen.league')}
                </label>
                <select
                  value={formLeague}
                  onChange={(e) => setFormLeague(e.target.value)}
                  style={{
                    width: '100%', padding: '12px 14px', background: 'var(--bg-surface)',
                    border: '1px solid var(--border-subtle)', borderRadius: 10, marginBottom: 16,
                    color: 'var(--text-primary)', fontSize: 14, fontFamily: 'var(--font-body)',
                    outline: 'none', boxSizing: 'border-box', appearance: 'none',
                  }}
                >
                  {LEAGUE_OPTIONS.map((l) => (
                    <option key={l.value} value={l.value}>{l.label}</option>
                  ))}
                </select>

                {/* Season */}
                <label style={{ fontSize: 12, color: 'var(--text-secondary)', fontWeight: 600, marginBottom: 4, display: 'block' }}>
                  {t('tippen.season')}
                </label>
                <input
                  value={formSeason}
                  onChange={(e) => setFormSeason(e.target.value)}
                  placeholder="2025"
                  style={{
                    width: '100%', padding: '12px 14px', background: 'var(--bg-surface)',
                    border: '1px solid var(--border-subtle)', borderRadius: 10, marginBottom: 16,
                    color: 'var(--text-primary)', fontSize: 14, fontFamily: 'var(--font-body)',
                    outline: 'none', boxSizing: 'border-box',
                  }}
                />

                {/* Auto-Sync toggle */}
                <div style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  marginBottom: 16,
                }}>
                  <div>
                    <span style={{ fontSize: 13, color: 'var(--text-secondary)', fontWeight: 600, display: 'block' }}>
                      {t('tippen.autoSync')}
                    </span>
                    <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                      {t('tippen.autoSyncDesc')}
                    </span>
                  </div>
                  <button
                    onClick={() => setFormAutoSync(!formAutoSync)}
                    style={{
                      width: 48, height: 26, borderRadius: 13, border: 'none', cursor: 'pointer',
                      background: formAutoSync ? 'var(--gold-primary)' : 'var(--bg-surface)',
                      position: 'relative', transition: 'background 0.2s', flexShrink: 0,
                    }}
                  >
                    <div style={{
                      width: 20, height: 20, borderRadius: 10, background: '#fff',
                      position: 'absolute', top: 3,
                      left: formAutoSync ? 25 : 3,
                      transition: 'left 0.2s',
                    }} />
                  </button>
                </div>
              </>
            )}

            {/* Stake */}
            <label style={{ fontSize: 12, color: 'var(--text-secondary)', fontWeight: 600, marginBottom: 4, display: 'block' }}>
              {t('tippen.stakeOptional')}
            </label>
            <input
              value={formStake}
              onChange={(e) => setFormStake(e.target.value)}
              placeholder={t('tippen.stakePlaceholder')}
              maxLength={100}
              style={{
                width: '100%', padding: '12px 14px', background: 'var(--bg-surface)',
                border: '1px solid var(--border-subtle)', borderRadius: 10, marginBottom: 16,
                color: 'var(--text-primary)', fontSize: 14, fontFamily: 'var(--font-body)',
                outline: 'none', boxSizing: 'border-box',
              }}
            />

            {/* Public toggle */}
            <div style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              marginBottom: 16,
            }}>
              <span style={{ fontSize: 13, color: 'var(--text-secondary)', fontWeight: 600 }}>
                {t('tippen.public')}
              </span>
              <button
                onClick={() => setFormPublic(!formPublic)}
                style={{
                  width: 48, height: 26, borderRadius: 13, border: 'none', cursor: 'pointer',
                  background: formPublic ? 'var(--gold-primary)' : 'var(--bg-surface)',
                  position: 'relative', transition: 'background 0.2s',
                }}
              >
                <div style={{
                  width: 20, height: 20, borderRadius: 10, background: '#fff',
                  position: 'absolute', top: 3,
                  left: formPublic ? 25 : 3,
                  transition: 'left 0.2s',
                }} />
              </button>
            </div>

            {/* Max members */}
            <label style={{ fontSize: 12, color: 'var(--text-secondary)', fontWeight: 600, marginBottom: 4, display: 'block' }}>
              {t('tippen.maxMembers')}
            </label>
            <input
              value={formMaxMembers}
              onChange={(e) => { const v = e.target.value.replace(/\D/g, ''); setFormMaxMembers(v); if (formMaxMembersErr) setFormMaxMembersErr(validateMaxMembers(v)) }}
              onBlur={() => setFormMaxMembersErr(validateMaxMembers(formMaxMembers))}
              type="text"
              inputMode="numeric"
              style={{
                width: '100%', padding: '12px 14px', background: 'var(--bg-surface)',
                border: `1px solid ${formMaxMembersErr ? 'var(--status-error)' : 'var(--border-subtle)'}`, borderRadius: 10, marginBottom: formMaxMembersErr ? 4 : 20,
                color: 'var(--text-primary)', fontSize: 14, fontFamily: 'var(--font-body)',
                outline: 'none', boxSizing: 'border-box',
              }}
            />
            {formMaxMembersErr && <p style={{ color: 'var(--status-error)', fontSize: 11, margin: '0 0 16px' }}>{formMaxMembersErr}</p>}

            {createError && (
              <p style={{ color: 'var(--status-error)', fontSize: 13, marginBottom: 12 }}>{createError}</p>
            )}

            {/* Submit */}
            <button
              onClick={handleCreate}
              disabled={creating || !formName.trim() || formName.trim().length < 3}
              style={{
                width: '100%', padding: '14px 0',
                background: formName.trim()
                  ? 'linear-gradient(135deg, var(--gold-dim), var(--gold-primary))'
                  : 'var(--bg-surface)',
                color: formName.trim() ? 'var(--text-inverse)' : 'var(--text-muted)',
                fontFamily: 'var(--font-display)', fontSize: 13, fontWeight: 700,
                letterSpacing: 2, textTransform: 'uppercase',
                border: 'none', borderRadius: 12, cursor: formName.trim() ? 'pointer' : 'default',
                opacity: creating ? 0.6 : 1,
              }}
            >
              {creating ? t('tippen.creating') : t('tippen.createGroup')}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

/* ── Section Header ─────────────────────────────────────────────── */

function SectionHeader({ label }: { label: string }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 12, margin: '0 0 14px',
    }}>
      <div style={{ flex: 1, height: 1, background: 'var(--border-subtle)' }} />
      <span style={{
        fontFamily: 'var(--font-display)', fontSize: 11, fontWeight: 700,
        color: 'var(--text-muted)', letterSpacing: 2, textTransform: 'uppercase', whiteSpace: 'nowrap',
      }}>
        {label}
      </span>
      <div style={{ flex: 1, height: 1, background: 'var(--border-subtle)' }} />
    </div>
  )
}
