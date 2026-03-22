'use client'
import { useLang } from '@/contexts/LanguageContext'
import LiveIndicator from './LiveIndicator'

export interface MatchQuestion {
  id: string
  question: string
  home_team: string | null
  away_team: string | null
  home_team_logo: string | null
  away_team_logo: string | null
  home_team_short: string | null
  away_team_short: string | null
  home_score: number | null
  away_score: number | null
  halftime_home: number | null
  halftime_away: number | null
  match_utc_date: string | null
  match_status: string | null
  match_minute: number | null
  is_live: boolean
  deadline: string
  status: string
  matchday: number | null
}

export interface TipDraft {
  homeScore: string
  awayScore: string
  joker: boolean
}

interface MatchCardProps {
  q: MatchQuestion
  draft: TipDraft
  existingTip?: { home_score_tip: number | null; away_score_tip: number | null; is_joker: boolean; points_earned: number | null } | null
  locked: boolean
  resolved: boolean
  jokerEnabled: boolean
  jokersRemaining: number
  jokerUsedThisMatchday: boolean
  onDraftChange: (patch: Partial<TipDraft>) => void
}

function deadlinePassed(iso: string) { return new Date(iso).getTime() < Date.now() }

function formatKickoff(iso: string | null, dayNames: string[]) {
  if (!iso) return ''
  const d = new Date(iso)
  return `${dayNames[d.getDay()]} ${d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`
}

function formatDeadlineCountdown(iso: string) {
  const diff = new Date(iso).getTime() - Date.now()
  if (diff <= 0) return '_expired_'
  const h = Math.floor(diff / 3600000)
  const m = Math.floor((diff % 3600000) / 60000)
  if (h > 24) return `${Math.floor(h / 24)}T ${h % 24}h`
  if (h > 0) return `${h}h ${m}min`
  return `${m}min`
}

function getPointsLabel(pts: number | null | undefined): { text: string; color: string } {
  if (pts === null || pts === undefined) return { text: '', color: '' }
  if (pts >= 5) return { text: `${pts}P ✓ Exakt`, color: '#22C55E' }
  if (pts >= 3) return { text: `${pts}P Differenz`, color: '#EAB308' }
  if (pts >= 2) return { text: `${pts}P Tendenz`, color: '#F97316' }
  return { text: '0P', color: 'var(--text-muted)' }
}

export default function MatchCard({
  q, draft, existingTip, locked, resolved,
  jokerEnabled, jokersRemaining, jokerUsedThisMatchday, onDraftChange,
}: MatchCardProps) {
  const { t } = useLang()
  const dayNames = [t('tippen.dayShortSun'), t('tippen.dayShortMon'), t('tippen.dayShortTue'), t('tippen.dayShortWed'), t('tippen.dayShortThu'), t('tippen.dayShortFri'), t('tippen.dayShortSat')]
  const isLive = q.is_live
  const hasTipped = !!existingTip && existingTip.home_score_tip !== null

  return (
    <div style={{
      background: 'var(--bg-surface)',
      border: isLive ? '1px solid rgba(34,197,94,0.3)' : '1px solid var(--border-subtle)',
      borderRadius: 14, padding: '14px 16px', marginBottom: 10,
      boxShadow: isLive ? '0 0 12px rgba(34,197,94,0.08)' : 'none',
    }}>
      {/* Top bar: kickoff time + live/deadline */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
        <span style={{ fontSize: 11, color: 'var(--text-muted)', fontFamily: 'var(--font-display)', letterSpacing: 0.5 }}>
          {formatKickoff(q.match_utc_date, dayNames)}
        </span>
        {isLive ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            {q.match_minute && (
              <span style={{ fontSize: 11, color: '#22C55E', fontFamily: 'var(--font-display)', fontWeight: 700 }}>
                {q.match_minute}&apos;
              </span>
            )}
            <LiveIndicator size={6} />
          </div>
        ) : !locked ? (
          <span style={{ fontSize: 11, color: 'var(--status-warning)', fontFamily: 'var(--font-display)' }}>
            ⏱ {(() => { const cd = formatDeadlineCountdown(q.deadline); return cd === '_expired_' ? t('tippen.expired') : cd; })()}
          </span>
        ) : null}
      </div>

      {/* Teams row */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        {/* Home team */}
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 8, justifyContent: 'flex-end' }}>
          <span style={{
            fontSize: 13, fontWeight: 600, color: 'var(--text-primary)',
            textAlign: 'right', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
          }}>
            {q.home_team_short || q.home_team || 'TBA'}
          </span>
          {q.home_team_logo && (
            <img src={q.home_team_logo} alt="" style={{ width: 24, height: 24, objectFit: 'contain', flexShrink: 0 }} />
          )}
        </div>

        {/* Score / Input area */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 4, flexShrink: 0 }}>
          {resolved || isLive ? (
            // Show actual score
            <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              <span style={{
                width: 32, height: 36, display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 18, fontWeight: 700, fontFamily: 'var(--font-display)',
                color: isLive ? '#22C55E' : 'var(--text-primary)',
                background: 'var(--bg-elevated)', borderRadius: 6,
              }}>
                {q.home_score ?? '-'}
              </span>
              <span style={{ fontSize: 14, color: 'var(--text-muted)', fontWeight: 700 }}>:</span>
              <span style={{
                width: 32, height: 36, display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 18, fontWeight: 700, fontFamily: 'var(--font-display)',
                color: isLive ? '#22C55E' : 'var(--text-primary)',
                background: 'var(--bg-elevated)', borderRadius: 6,
              }}>
                {q.away_score ?? '-'}
              </span>
            </div>
          ) : hasTipped && locked ? (
            // Locked, show user's tip
            <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              <span style={{
                width: 32, height: 36, display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 16, fontWeight: 700, fontFamily: 'var(--font-display)',
                color: 'var(--gold-primary)', background: 'var(--gold-subtle)', borderRadius: 6,
              }}>
                {existingTip!.home_score_tip}
              </span>
              <span style={{ fontSize: 14, color: 'var(--text-muted)', fontWeight: 700 }}>:</span>
              <span style={{
                width: 32, height: 36, display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 16, fontWeight: 700, fontFamily: 'var(--font-display)',
                color: 'var(--gold-primary)', background: 'var(--gold-subtle)', borderRadius: 6,
              }}>
                {existingTip!.away_score_tip}
              </span>
            </div>
          ) : locked ? (
            // Locked, no tip
            <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              <span style={{
                width: 32, height: 36, display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 16, fontWeight: 700, color: 'var(--text-muted)', background: 'var(--bg-elevated)', borderRadius: 6,
              }}>–</span>
              <span style={{ fontSize: 14, color: 'var(--text-muted)', fontWeight: 700 }}>:</span>
              <span style={{
                width: 32, height: 36, display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 16, fontWeight: 700, color: 'var(--text-muted)', background: 'var(--bg-elevated)', borderRadius: 6,
              }}>–</span>
            </div>
          ) : (
            // Editable inputs
            <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              <input
                type="number" min="0" max="20"
                value={hasTipped && !draft.homeScore ? String(existingTip!.home_score_tip ?? '') : draft.homeScore}
                onChange={e => onDraftChange({ homeScore: e.target.value })}
                style={{
                  width: 36, height: 40, textAlign: 'center', fontSize: 18, fontWeight: 700,
                  background: 'var(--input-bg)', border: '1px solid var(--input-border)',
                  borderRadius: 8, color: 'var(--input-text)', outline: 'none',
                  fontFamily: 'var(--font-display)',
                }}
              />
              <span style={{ fontSize: 16, color: 'var(--text-muted)', fontWeight: 700 }}>:</span>
              <input
                type="number" min="0" max="20"
                value={hasTipped && !draft.awayScore ? String(existingTip!.away_score_tip ?? '') : draft.awayScore}
                onChange={e => onDraftChange({ awayScore: e.target.value })}
                style={{
                  width: 36, height: 40, textAlign: 'center', fontSize: 18, fontWeight: 700,
                  background: 'var(--input-bg)', border: '1px solid var(--input-border)',
                  borderRadius: 8, color: 'var(--input-text)', outline: 'none',
                  fontFamily: 'var(--font-display)',
                }}
              />
            </div>
          )}
        </div>

        {/* Away team */}
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 8 }}>
          {q.away_team_logo && (
            <img src={q.away_team_logo} alt="" style={{ width: 24, height: 24, objectFit: 'contain', flexShrink: 0 }} />
          )}
          <span style={{
            fontSize: 13, fontWeight: 600, color: 'var(--text-primary)',
            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
          }}>
            {q.away_team_short || q.away_team || 'TBA'}
          </span>
        </div>
      </div>

      {/* Bottom: Joker toggle (if open) or points (if resolved) */}
      {resolved && hasTipped && (
        <div style={{ marginTop: 8, textAlign: 'center' }}>
          <span style={{
            fontSize: 12, fontWeight: 700, fontFamily: 'var(--font-display)',
            color: getPointsLabel(existingTip!.points_earned).color,
            letterSpacing: 0.5,
          }}>
            {t('tippen.tipLabel').replace('{home}', String(existingTip!.home_score_tip)).replace('{away}', String(existingTip!.away_score_tip))}
            {existingTip!.is_joker ? ' 🃏' : ''}
            {' → '}{getPointsLabel(existingTip!.points_earned).text}
          </span>
        </div>
      )}

      {!locked && !resolved && jokerEnabled && jokersRemaining > 0 && !jokerUsedThisMatchday && (
        <label style={{
          display: 'flex', alignItems: 'center', gap: 6, marginTop: 8,
          cursor: 'pointer', fontSize: 11, color: draft.joker ? 'var(--gold-primary)' : 'var(--text-muted)',
          fontFamily: 'var(--font-display)', letterSpacing: 0.5,
        }}>
          <input
            type="checkbox" checked={draft.joker}
            onChange={e => onDraftChange({ joker: e.target.checked })}
            style={{ accentColor: 'var(--gold-primary)', width: 16, height: 16 }}
          />
          {t('tippen.jokerRemaining').replace('{count}', String(jokersRemaining))}
        </label>
      )}

      {hasTipped && !locked && !resolved && (
        <div style={{ marginTop: 6, textAlign: 'center' }}>
          <span style={{ fontSize: 11, color: 'var(--status-active)', fontFamily: 'var(--font-display)' }}>
            {t('tippen.tipSaved').replace('{home}', String(existingTip!.home_score_tip)).replace('{away}', String(existingTip!.away_score_tip))}
            {existingTip!.is_joker ? ' 🃏' : ''}
          </span>
        </div>
      )}

    </div>
  )
}
