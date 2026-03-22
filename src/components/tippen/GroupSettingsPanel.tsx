'use client'
import { useState } from 'react'
import { useLang } from '@/contexts/LanguageContext'
import { supabase } from '@/lib/supabase'
import ProfileImage from '@/components/ProfileImage'

interface GroupConfig {
  id: string
  name: string
  description: string | null
  is_public: boolean
  points_exact: number
  points_diff: number
  points_tendency: number
  joker_enabled: boolean
  joker_multiplier: number
  joker_per_matchday: number
  competition_code: string | null
  competition_name: string | null
  season_year: string | null
  last_synced_at: string | null
  invite_code: string
}

interface MemberInfo {
  user_id: string
  username: string
  display_name: string | null
  avatar_url: string | null
  role: string
}

interface Props {
  group: GroupConfig
  members: MemberInfo[]
  currentUserId: string
  onSync: () => Promise<void>
  onGroupUpdated: () => void
  onDelete?: () => void
  onLeave?: () => void
}

const LEAGUE_OPTIONS = [
  { value: 'BL1', label: '🇩🇪 Bundesliga' },
  { value: 'BL2', label: '🇩🇪 2. Bundesliga' },
  { value: 'CL', label: '🏆 Champions League' },
  { value: 'PL', label: '🏴 Premier League' },
  { value: 'PD', label: '🇪🇸 La Liga' },
  { value: 'EC', label: '🇪🇺 EM' },
  { value: 'WC', label: '🌍 WM' },
]

export default function GroupSettingsPanel({ group, members, currentUserId, onSync, onGroupUpdated, onDelete, onLeave }: Props) {
  const { t } = useLang()
  const [name, setName] = useState(group.name)
  const [isPublic, setIsPublic] = useState(group.is_public)
  const [pointsExact, setPointsExact] = useState(group.points_exact)
  const [pointsDiff, setPointsDiff] = useState(group.points_diff)
  const [pointsTendency, setPointsTendency] = useState(group.points_tendency)
  const [jokerEnabled, setJokerEnabled] = useState(group.joker_enabled)
  const [jokerMultiplier, setJokerMultiplier] = useState(group.joker_multiplier)
  const [jokerPerMatchday, setJokerPerMatchday] = useState(group.joker_per_matchday)
  const [competitionCode, setCompetitionCode] = useState(group.competition_code || '')
  const [seasonYear, setSeasonYear] = useState(group.season_year || '2025')
  const [saving, setSaving] = useState(false)
  const [syncing, setSyncing] = useState(false)
  const [toast, setToast] = useState('')
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [confirmLeave, setConfirmLeave] = useState(false)
  const [deleting, setDeleting] = useState(false)

  const showToast = (msg: string) => { setToast(msg); setTimeout(() => setToast(''), 2500) }

  const saveSettings = async () => {
    setSaving(true)
    const { error } = await supabase.from('tip_groups').update({
      name: name.trim(),
      is_public: isPublic,
      points_exact: pointsExact,
      points_diff: pointsDiff,
      points_tendency: pointsTendency,
      joker_enabled: jokerEnabled,
      joker_multiplier: jokerMultiplier,
      joker_per_matchday: jokerPerMatchday,
      competition_code: competitionCode || null,
      season_year: seasonYear || null,
    }).eq('id', group.id)
    setSaving(false)
    if (error) showToast(t('tippen.errorPrefix').replace('{message}', error.message))
    else { showToast(t('tippen.settingsSaved')); onGroupUpdated() }
  }

  const handleSync = async () => {
    if (!competitionCode) { showToast(t('tippen.selectLeague')); return }
    setSyncing(true)
    await onSync()
    setSyncing(false)
    showToast(t('tippen.matchdaysLoaded'))
  }

  const shareInvite = () => {
    const text = t('tippen.shareInviteText').replace('{name}', group.name).replace('{code}', group.invite_code)
    if (navigator.share) navigator.share({ text })
    else { navigator.clipboard.writeText(group.invite_code); showToast(t('tippen.codeCopied')) }
  }

  const kickMember = async (userId: string) => {
    if (userId === currentUserId) return
    await supabase.from('tip_group_members').delete().eq('group_id', group.id).eq('user_id', userId)
    showToast(t('tippen.memberRemoved'))
    onGroupUpdated()
  }

  const inputStyle: React.CSSProperties = {
    width: '100%', padding: '10px 14px', background: 'var(--input-bg)',
    border: '1px solid var(--input-border)', borderRadius: 10,
    color: 'var(--input-text)', fontSize: 14, outline: 'none', boxSizing: 'border-box',
  }

  const labelStyle: React.CSSProperties = {
    fontSize: 11, color: 'var(--text-muted)', fontFamily: 'var(--font-display)',
    fontWeight: 700, letterSpacing: 1, marginBottom: 4, display: 'block', textTransform: 'uppercase',
  }

  const sectionStyle: React.CSSProperties = {
    background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)',
    borderRadius: 14, padding: 16, marginBottom: 16,
  }

  return (
    <div style={{ padding: '16px 16px 0' }}>

      {/* Gruppe */}
      <div style={sectionStyle}>
        <h3 style={{ fontSize: 13, fontFamily: 'var(--font-display)', color: 'var(--gold-primary)', margin: '0 0 12px', letterSpacing: 1 }}>
          {t('tippen.groupLabel')}
        </h3>
        <label style={labelStyle}>{t('tippen.nameLabel')}</label>
        <input value={name} onChange={e => setName(e.target.value)} style={{ ...inputStyle, marginBottom: 10 }} />

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
          <span style={{ fontSize: 13, color: 'var(--text-secondary)' }}>{t('tippen.publicLabel')}</span>
          <button onClick={() => setIsPublic(!isPublic)} style={{
            width: 44, height: 24, borderRadius: 12, border: 'none', cursor: 'pointer',
            background: isPublic ? 'var(--gold-primary)' : 'var(--bg-elevated)', position: 'relative',
          }}>
            <div style={{ width: 18, height: 18, borderRadius: 9, background: '#fff', position: 'absolute', top: 3, left: isPublic ? 23 : 3, transition: 'left .2s' }} />
          </button>
        </div>

        <div style={{ marginTop: 10 }}>
          <label style={labelStyle}>{t('tippen.inviteCodeLabel')}</label>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 16, fontFamily: 'var(--font-display)', fontWeight: 700, color: 'var(--gold-primary)', letterSpacing: 2 }}>
              {group.invite_code}
            </span>
            <button onClick={shareInvite} style={{
              padding: '6px 12px', background: 'var(--bg-elevated)', border: '1px solid var(--border-subtle)',
              borderRadius: 8, color: 'var(--text-secondary)', fontSize: 11, cursor: 'pointer',
            }}>
              {t('tippen.shareBtn')}
            </button>
          </div>
        </div>
      </div>

      {/* Punktesystem */}
      <div style={sectionStyle}>
        <h3 style={{ fontSize: 13, fontFamily: 'var(--font-display)', color: 'var(--gold-primary)', margin: '0 0 12px', letterSpacing: 1 }}>
          {t('tippen.pointsSystemLabel')}
        </h3>
        <div style={{ display: 'flex', gap: 8, marginBottom: 10 }}>
          <div style={{ flex: 1 }}>
            <label style={labelStyle}>{t('tippen.exactLabel')}</label>
            <input type="number" value={pointsExact} onChange={e => setPointsExact(+e.target.value)} min={0} max={20} style={inputStyle} />
          </div>
          <div style={{ flex: 1 }}>
            <label style={labelStyle}>{t('tippen.differenceLabel')}</label>
            <input type="number" value={pointsDiff} onChange={e => setPointsDiff(+e.target.value)} min={0} max={20} style={inputStyle} />
          </div>
          <div style={{ flex: 1 }}>
            <label style={labelStyle}>{t('tippen.tendencyLabel')}</label>
            <input type="number" value={pointsTendency} onChange={e => setPointsTendency(+e.target.value)} min={0} max={20} style={inputStyle} />
          </div>
        </div>
      </div>

      {/* Joker */}
      <div style={sectionStyle}>
        <h3 style={{ fontSize: 13, fontFamily: 'var(--font-display)', color: 'var(--gold-primary)', margin: '0 0 12px', letterSpacing: 1 }}>
          {t('tippen.jokerLabel')}
        </h3>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
          <span style={{ fontSize: 13, color: 'var(--text-secondary)' }}>{t('tippen.jokerEnabled')}</span>
          <button onClick={() => setJokerEnabled(!jokerEnabled)} style={{
            width: 44, height: 24, borderRadius: 12, border: 'none', cursor: 'pointer',
            background: jokerEnabled ? 'var(--gold-primary)' : 'var(--bg-elevated)', position: 'relative',
          }}>
            <div style={{ width: 18, height: 18, borderRadius: 9, background: '#fff', position: 'absolute', top: 3, left: jokerEnabled ? 23 : 3, transition: 'left .2s' }} />
          </button>
        </div>
        {jokerEnabled && (
          <div style={{ display: 'flex', gap: 8 }}>
            <div style={{ flex: 1 }}>
              <label style={labelStyle}>{t('tippen.multiplierLabel')}</label>
              <input type="number" value={jokerMultiplier} onChange={e => setJokerMultiplier(+e.target.value)} min={1} max={5} style={inputStyle} />
            </div>
            <div style={{ flex: 1 }}>
              <label style={labelStyle}>{t('tippen.perMatchdayLabel')}</label>
              <input type="number" value={jokerPerMatchday} onChange={e => setJokerPerMatchday(+e.target.value)} min={0} max={5} style={inputStyle} />
            </div>
          </div>
        )}
      </div>

      {/* Liga-Sync */}
      <div style={sectionStyle}>
        <h3 style={{ fontSize: 13, fontFamily: 'var(--font-display)', color: 'var(--gold-primary)', margin: '0 0 12px', letterSpacing: 1 }}>
          {t('tippen.leagueSyncLabel')}
        </h3>
        <label style={labelStyle}>{t('tippen.leagueLabel')}</label>
        <select value={competitionCode} onChange={e => setCompetitionCode(e.target.value)} style={{ ...inputStyle, marginBottom: 10 }}>
          <option value="">{t('tippen.noLeague')}</option>
          {LEAGUE_OPTIONS.map(l => (
            <option key={l.value} value={l.value}>{l.label}</option>
          ))}
        </select>
        <label style={labelStyle}>{t('tippen.seasonLabel')}</label>
        <input value={seasonYear} onChange={e => setSeasonYear(e.target.value)} placeholder="2025" style={{ ...inputStyle, marginBottom: 10 }} />

        {group.last_synced_at && (
          <p style={{ fontSize: 11, color: 'var(--text-muted)', margin: '0 0 8px' }}>
            {t('tippen.lastSynced').replace('{date}', new Date(group.last_synced_at).toLocaleString())}
          </p>
        )}

        <button onClick={handleSync} disabled={syncing || !competitionCode} style={{
          width: '100%', padding: '12px',
          background: competitionCode ? 'linear-gradient(135deg, var(--gold-dim), var(--gold-primary))' : 'var(--bg-elevated)',
          border: 'none', borderRadius: 10, color: 'var(--text-inverse)',
          fontFamily: 'var(--font-display)', fontSize: 13, fontWeight: 700,
          letterSpacing: 1, cursor: 'pointer', textTransform: 'uppercase',
          opacity: syncing ? 0.6 : 1,
        }}>
          {syncing ? t('tippen.loading') : t('tippen.loadMatchdays')}
        </button>
      </div>

      {/* Mitglieder */}
      <div style={sectionStyle}>
        <h3 style={{ fontSize: 13, fontFamily: 'var(--font-display)', color: 'var(--gold-primary)', margin: '0 0 12px', letterSpacing: 1 }}>
          {t('tippen.membersLabel').replace('{count}', String(members.length))}
        </h3>
        {members.map(m => (
          <div key={m.user_id} style={{
            display: 'flex', alignItems: 'center', gap: 10, padding: '8px 0',
            borderBottom: '1px solid var(--border-subtle)',
          }}>
            <ProfileImage size={30} avatarUrl={m.avatar_url} name={m.username} />
            <div style={{ flex: 1 }}>
              <span style={{ fontSize: 13, color: 'var(--text-primary)', fontWeight: 600 }}>@{m.username}</span>
              <span style={{ fontSize: 10, color: 'var(--text-muted)', marginLeft: 6 }}>{m.role}</span>
            </div>
            {m.user_id !== currentUserId && m.role !== 'admin' && (
              <button onClick={() => kickMember(m.user_id)} style={{
                padding: '4px 10px', background: 'none', border: '1px solid var(--status-error)',
                borderRadius: 6, color: 'var(--status-error)', fontSize: 10, cursor: 'pointer',
              }}>
                {t('tippen.kickBtn')}
              </button>
            )}
          </div>
        ))}
      </div>

      {/* Save All */}
      <button onClick={saveSettings} disabled={saving} style={{
        width: '100%', padding: '14px',
        background: 'linear-gradient(135deg, var(--gold-dim), var(--gold-primary))',
        border: 'none', borderRadius: 14, color: 'var(--text-inverse)',
        fontFamily: 'var(--font-display)', fontSize: 14, fontWeight: 700,
        letterSpacing: 2, cursor: 'pointer', textTransform: 'uppercase',
        marginBottom: 16, opacity: saving ? 0.6 : 1,
      }}>
        {saving ? t('tippen.saving') : t('tippen.saveSettings')}
      </button>

      {/* Gefahrenzone */}
      <div style={{
        ...sectionStyle,
        borderColor: 'var(--status-error)',
        background: 'rgba(239, 68, 68, 0.05)',
      }}>
        <h3 style={{ fontSize: 13, fontFamily: 'var(--font-display)', color: 'var(--status-error)', margin: '0 0 12px', letterSpacing: 1 }}>
          {t('tippen.dangerZone')}
        </h3>

        {/* Leave Group (for non-creators) */}
        {onLeave && (
          <div style={{ marginBottom: 12 }}>
            {!confirmLeave ? (
              <button onClick={() => setConfirmLeave(true)} style={{
                width: '100%', padding: '12px',
                background: 'none', border: '1px solid var(--status-error)',
                borderRadius: 10, color: 'var(--status-error)',
                fontFamily: 'var(--font-display)', fontSize: 12, fontWeight: 700,
                letterSpacing: 1, cursor: 'pointer', textTransform: 'uppercase',
              }}>
                {t('tippen.leaveGroup')}
              </button>
            ) : (
              <div style={{ display: 'flex', gap: 8 }}>
                <button onClick={() => setConfirmLeave(false)} style={{
                  flex: 1, padding: '12px', background: 'var(--bg-elevated)',
                  border: '1px solid var(--border-subtle)', borderRadius: 10,
                  color: 'var(--text-muted)', fontSize: 11, fontFamily: 'var(--font-display)',
                  cursor: 'pointer',
                }}>
                  {t('tippen.cancel')}
                </button>
                <button onClick={() => { onLeave(); }} style={{
                  flex: 1, padding: '12px',
                  background: 'var(--status-error)', border: 'none', borderRadius: 10,
                  color: '#fff', fontSize: 11, fontFamily: 'var(--font-display)',
                  fontWeight: 700, cursor: 'pointer', letterSpacing: 1,
                }}>
                  {t('tippen.confirmLeave')}
                </button>
              </div>
            )}
          </div>
        )}

        {/* Delete Group (admin only) */}
        {onDelete && (
          <div>
            {!confirmDelete ? (
              <button onClick={() => setConfirmDelete(true)} style={{
                width: '100%', padding: '12px',
                background: 'var(--status-error)', border: 'none',
                borderRadius: 10, color: '#fff',
                fontFamily: 'var(--font-display)', fontSize: 12, fontWeight: 700,
                letterSpacing: 1, cursor: 'pointer', textTransform: 'uppercase',
                opacity: deleting ? 0.6 : 1,
              }}>
                {t('tippen.deleteGroup')}
              </button>
            ) : (
              <div>
                <p style={{ fontSize: 12, color: 'var(--status-error)', margin: '0 0 10px', lineHeight: 1.5 }}>
                  {t('tippen.deleteWarning')}
                </p>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button onClick={() => setConfirmDelete(false)} style={{
                    flex: 1, padding: '12px', background: 'var(--bg-elevated)',
                    border: '1px solid var(--border-subtle)', borderRadius: 10,
                    color: 'var(--text-muted)', fontSize: 11, fontFamily: 'var(--font-display)',
                    cursor: 'pointer',
                  }}>
                    {t('tippen.cancel')}
                  </button>
                  <button onClick={async () => {
                    setDeleting(true)
                    await supabase.from('tip_groups').update({ status: 'deleted' }).eq('id', group.id)
                    onDelete()
                  }} disabled={deleting} style={{
                    flex: 1, padding: '12px',
                    background: 'var(--status-error)', border: 'none', borderRadius: 10,
                    color: '#fff', fontSize: 11, fontFamily: 'var(--font-display)',
                    fontWeight: 700, cursor: 'pointer', letterSpacing: 1,
                    opacity: deleting ? 0.6 : 1,
                  }}>
                    {deleting ? t('tippen.deleting') : t('tippen.confirmDelete')}
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Toast */}
      {toast && (
        <div style={{
          position: 'fixed', bottom: 100, left: '50%', transform: 'translateX(-50%)',
          background: 'var(--bg-overlay)', border: '1px solid var(--gold-primary)',
          borderRadius: 12, padding: '10px 20px', zIndex: 200,
          color: 'var(--text-primary)', fontSize: 13, fontWeight: 600, whiteSpace: 'nowrap',
        }}>
          {toast}
        </div>
      )}
    </div>
  )
}
