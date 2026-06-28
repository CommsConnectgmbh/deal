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
  extratime_home?: number | null
  extratime_away?: number | null
  penalty_home?: number | null
  penalty_away?: number | null
  match_duration?: string | null // REGULAR | EXTRA_TIME | PENALTY_SHOOTOUT
  match_winner?: string | null   // HOME_TEAM | AWAY_TEAM | DRAW
  match_utc_date: string | null
  match_status: string | null
  match_minute: number | null
  is_live: boolean
  deadline: string
  status: string
  matchday: number | null
  competition_stage?: string | null
  group_label?: string | null
}

function formatStage(stage: string | null | undefined, groupLabel: string | null | undefined): string {
  if (groupLabel) {
    const short = groupLabel.replace(/^(?:Group|Gruppe)[\s_]+/i, '').replace(/^GROUP_/, '')
    return short.length <= 3 ? `Gruppe ${short}` : short
  }
  switch (stage) {
    case 'LAST_32':
    case 'ROUND_OF_32':       return 'Sechzehntelfinale'
    case 'LAST_16':
    case 'ROUND_OF_16':       return 'Achtelfinale'
    case 'QUARTER_FINALS':    return 'Viertelfinale'
    case 'SEMI_FINALS':       return 'Halbfinale'
    case 'THIRD_PLACE':       return 'Spiel um Platz 3'
    case 'FINAL':             return 'Finale'
    default: return ''
  }
}

export interface TipDraft {
  // undefined = unberührt, '' = vom User aktiv geleert, sonst getippter Wert.
  // Wichtig damit Backspace nicht auf den bestehenden Tipp zurückspringt.
  homeScore: string | undefined
  awayScore: string | undefined
}

interface MatchCardProps {
  q: MatchQuestion
  draft: TipDraft
  existingTip?: { home_score_tip: number | null; away_score_tip: number | null; points_earned: number | null } | null
  locked: boolean
  resolved: boolean
  onDraftChange: (patch: Partial<TipDraft>) => void
}

function deadlinePassed(iso: string) { return new Date(iso).getTime() < Date.now() }

function formatKickoff(iso: string | null, dayNames: string[]) {
  if (!iso) return ''
  const d = new Date(iso)
  const time = d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  const day = dayNames[d.getDay()]
  // Innerhalb der nächsten 6 Tage: nur Wochentag + Uhrzeit (Bundesliga-Stil).
  // Sonst (Turnier-Matches Wochen voraus): Wochentag + Datum + Uhrzeit.
  const diffDays = (d.getTime() - Date.now()) / (24 * 3600 * 1000)
  if (diffDays > -1 && diffDays < 6) return `${day} ${time}`
  const date = d.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit' })
  return `${day} ${date} ${time}`
}

/** FIFA-TLA → ISO-Alpha-2 für Flag-Emoji (nur Länderteams; Vereine ohne Mapping). */
const TLA_TO_ISO2: Record<string, string> = {
  GER: 'DE', ENG: 'GB', SCO: 'GB', WAL: 'GB', NIR: 'GB', IRL: 'IE',
  ESP: 'ES', POR: 'PT', FRA: 'FR', ITA: 'IT', NED: 'NL', BEL: 'BE',
  SUI: 'CH', AUT: 'AT', DEN: 'DK', SWE: 'SE', NOR: 'NO', FIN: 'FI',
  POL: 'PL', CZE: 'CZ', SVK: 'SK', HUN: 'HU', ROU: 'RO', BUL: 'BG',
  CRO: 'HR', SRB: 'RS', SVN: 'SI', UKR: 'UA', RUS: 'RU', TUR: 'TR',
  GRE: 'GR', ALB: 'AL', ARM: 'AM', AZE: 'AZ', BIH: 'BA', GEO: 'GE',
  KOS: 'XK', MKD: 'MK', MNE: 'ME', MDA: 'MD', BLR: 'BY', LTU: 'LT',
  LVA: 'LV', EST: 'EE', ISL: 'IS', ISR: 'IL',
  USA: 'US', CAN: 'CA', MEX: 'MX', CRC: 'CR', PAN: 'PA', JAM: 'JM',
  HON: 'HN', GUA: 'GT', SLV: 'SV', HAI: 'HT',
  BRA: 'BR', ARG: 'AR', URU: 'UY', PAR: 'PY', CHI: 'CL', COL: 'CO',
  PER: 'PE', ECU: 'EC', VEN: 'VE', BOL: 'BO',
  JPN: 'JP', KOR: 'KR', PRK: 'KP', CHN: 'CN', AUS: 'AU', NZL: 'NZ',
  KSA: 'SA', IRN: 'IR', IRQ: 'IQ', QAT: 'QA', UAE: 'AE', JOR: 'JO',
  LIB: 'LB', SYR: 'SY', YEM: 'YE', OMA: 'OM', BHR: 'BH', KUW: 'KW',
  IND: 'IN', PAK: 'PK', BAN: 'BD', THA: 'TH', VIE: 'VN', IDN: 'ID',
  MAS: 'MY', SGP: 'SG', PHI: 'PH', UZB: 'UZ', KAZ: 'KZ',
  EGY: 'EG', MAR: 'MA', ALG: 'DZ', TUN: 'TN', LBY: 'LY', SDN: 'SD',
  NGA: 'NG', GHA: 'GH', CIV: 'CI', SEN: 'SN', CMR: 'CM', RSA: 'ZA',
  KEN: 'KE', UGA: 'UG', TAN: 'TZ', ETH: 'ET', RWA: 'RW', ZIM: 'ZW',
  ANG: 'AO', MOZ: 'MZ', NAM: 'NA', ZAM: 'ZM', BFA: 'BF', MLI: 'ML',
  TOG: 'TG', BEN: 'BJ', GAB: 'GA', CGO: 'CG', COD: 'CD', GUI: 'GN',
  CPV: 'CV', MTN: 'MR', NIG: 'NE', LBR: 'LR', SLE: 'SL', GAM: 'GM',
  COM: 'KM', MAD: 'MG', SEY: 'SC', MRI: 'MU',
}

function flagFor(tla: string | null | undefined): string {
  if (!tla) return ''
  const iso = TLA_TO_ISO2[tla.toUpperCase()]
  if (!iso) return ''
  return String.fromCodePoint(...[...iso].map(c => 0x1F1E6 + c.charCodeAt(0) - 65))
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
  q, draft, existingTip, locked, resolved, onDraftChange,
}: MatchCardProps) {
  const { t } = useLang()
  const dayNames = [t('tippen.dayShortSun'), t('tippen.dayShortMon'), t('tippen.dayShortTue'), t('tippen.dayShortWed'), t('tippen.dayShortThu'), t('tippen.dayShortFri'), t('tippen.dayShortSat')]
  const isLive = q.is_live
  const hasTipped = !!existingTip && existingTip.home_score_tip !== null

  // KO-Endergebnis inkl. Verlängerung & Elfmeterschießen:
  // Headline = Score nach 120 min (extratime) wenn ET stattfand, sonst 90 min.
  // Footer-Badge zeigt n.V. und i.E. mit Detail-Werten.
  const usedExtraTime = q.extratime_home != null && q.extratime_away != null
  const usedPenalties = q.penalty_home != null && q.penalty_away != null
  const displayHome = usedExtraTime ? q.extratime_home! : q.home_score
  const displayAway = usedExtraTime ? q.extratime_away! : q.away_score

  return (
    <div style={{
      background: 'var(--bg-surface)',
      border: isLive ? '1px solid rgba(34,197,94,0.3)' : '1px solid var(--border-subtle)',
      borderRadius: 14, padding: '14px 16px', marginBottom: 10,
      boxShadow: isLive ? '0 0 12px rgba(34,197,94,0.08)' : 'none',
    }}>
      {/* Top bar: kickoff time + stage badge + live/deadline */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10, gap: 6 }}>
        <span style={{ fontSize: 11, color: 'var(--text-muted)', fontFamily: 'var(--font-display)', letterSpacing: 0.5 }}>
          {formatKickoff(q.match_utc_date, dayNames)}
        </span>
        {(() => {
          const stageLabel = formatStage(q.competition_stage, q.group_label)
          if (!stageLabel) return null
          return (
            <span style={{
              fontSize: 9, padding: '3px 8px', borderRadius: 6,
              fontFamily: 'var(--font-display)', fontWeight: 700, letterSpacing: 0.8,
              textTransform: 'uppercase', whiteSpace: 'nowrap',
              color: 'var(--gold-primary)',
              background: 'var(--gold-subtle)',
              border: '1px solid var(--gold-glow)',
            }}>
              {stageLabel}
            </span>
          )
        })()}
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
          {q.home_team_logo ? (
            <img src={q.home_team_logo} alt="" style={{ width: 24, height: 24, objectFit: 'contain', flexShrink: 0 }} />
          ) : flagFor(q.home_team_short) ? (
            <span style={{ fontSize: 22, lineHeight: 1, flexShrink: 0 }}>{flagFor(q.home_team_short)}</span>
          ) : null}
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
                {displayHome ?? '-'}
              </span>
              <span style={{ fontSize: 14, color: 'var(--text-muted)', fontWeight: 700 }}>:</span>
              <span style={{
                width: 32, height: 36, display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 18, fontWeight: 700, fontFamily: 'var(--font-display)',
                color: isLive ? '#22C55E' : 'var(--text-primary)',
                background: 'var(--bg-elevated)', borderRadius: 6,
              }}>
                {displayAway ?? '-'}
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
                type="text" inputMode="numeric" pattern="[0-9]*" maxLength={2}
                value={draft.homeScore !== undefined ? draft.homeScore : (hasTipped ? String(existingTip!.home_score_tip ?? '') : '')}
                onChange={e => onDraftChange({ homeScore: e.target.value.replace(/[^0-9]/g, '').slice(0, 2) })}
                onFocus={e => e.currentTarget.select()}
                style={{
                  width: 36, height: 40, textAlign: 'center', fontSize: 18, fontWeight: 700,
                  background: 'var(--input-bg)', border: '1px solid var(--input-border)',
                  borderRadius: 8, color: 'var(--input-text)', outline: 'none',
                  fontFamily: 'var(--font-display)',
                  WebkitAppearance: 'none', appearance: 'none',
                }}
              />
              <span style={{ fontSize: 16, color: 'var(--text-muted)', fontWeight: 700 }}>:</span>
              <input
                type="text" inputMode="numeric" pattern="[0-9]*" maxLength={2}
                value={draft.awayScore !== undefined ? draft.awayScore : (hasTipped ? String(existingTip!.away_score_tip ?? '') : '')}
                onChange={e => onDraftChange({ awayScore: e.target.value.replace(/[^0-9]/g, '').slice(0, 2) })}
                onFocus={e => e.currentTarget.select()}
                style={{
                  width: 36, height: 40, textAlign: 'center', fontSize: 18, fontWeight: 700,
                  background: 'var(--input-bg)', border: '1px solid var(--input-border)',
                  borderRadius: 8, color: 'var(--input-text)', outline: 'none',
                  fontFamily: 'var(--font-display)',
                  WebkitAppearance: 'none', appearance: 'none',
                }}
              />
            </div>
          )}
        </div>

        {/* Away team */}
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 8 }}>
          {q.away_team_logo ? (
            <img src={q.away_team_logo} alt="" style={{ width: 24, height: 24, objectFit: 'contain', flexShrink: 0 }} />
          ) : flagFor(q.away_team_short) ? (
            <span style={{ fontSize: 22, lineHeight: 1, flexShrink: 0 }}>{flagFor(q.away_team_short)}</span>
          ) : null}
          <span style={{
            fontSize: 13, fontWeight: 600, color: 'var(--text-primary)',
            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
          }}>
            {q.away_team_short || q.away_team || 'TBA'}
          </span>
        </div>
      </div>

      {/* K.o.-Endergebnis-Detail: 90'-Score und Elfmeterschießen, falls relevant. */}
      {(usedExtraTime || usedPenalties) && (
        <div style={{
          marginTop: 8, display: 'flex', justifyContent: 'center', gap: 8,
          fontSize: 10, fontFamily: 'var(--font-display)', fontWeight: 700,
          color: 'var(--text-muted)', letterSpacing: 0.5,
        }}>
          {usedExtraTime && (
            <span>n.V. · 90&apos; {q.home_score ?? '-'}:{q.away_score ?? '-'}</span>
          )}
          {usedPenalties && (
            <span style={{ color: 'var(--gold-primary)' }}>
              i.E. {q.penalty_home}:{q.penalty_away}
            </span>
          )}
        </div>
      )}

      {/* Bottom: points (if resolved) or saved confirmation */}
      {resolved && hasTipped && (
        <div style={{ marginTop: 8, textAlign: 'center' }}>
          <span style={{
            fontSize: 12, fontWeight: 700, fontFamily: 'var(--font-display)',
            color: getPointsLabel(existingTip!.points_earned).color,
            letterSpacing: 0.5,
          }}>
            {t('tippen.tipLabel').replace('{home}', String(existingTip!.home_score_tip)).replace('{away}', String(existingTip!.away_score_tip))}
            {' → '}{getPointsLabel(existingTip!.points_earned).text}
          </span>
        </div>
      )}

      {hasTipped && !locked && !resolved && (
        <div style={{ marginTop: 6, textAlign: 'center' }}>
          <span style={{ fontSize: 11, color: 'var(--status-active)', fontFamily: 'var(--font-display)' }}>
            {t('tippen.tipSaved').replace('{home}', String(existingTip!.home_score_tip)).replace('{away}', String(existingTip!.away_score_tip))}
          </span>
        </div>
      )}

    </div>
  )
}
