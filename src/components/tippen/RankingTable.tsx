'use client'
import { useLang } from '@/contexts/LanguageContext'
import ProfileImage from '@/components/ProfileImage'

interface MemberRanking {
  user_id: string
  username: string
  display_name: string | null
  avatar_url: string | null
  total_points: number
  points_by_matchday: Record<string, number>
}

interface Props {
  members: MemberRanking[]
  totalMatchdays: number
  currentUserId: string
  onMatchdayClick?: (md: number) => void
  onUserClick?: (userId: string) => void
}

/**
 * RankingTable — Full leaderboard with podium for Top 3 + detailed rows.
 */
export default function RankingTable({ members, totalMatchdays, currentUserId, onMatchdayClick, onUserClick }: Props) {
  const { t } = useLang()
  // Sort by total_points descending
  const sorted = [...members].sort((a, b) => b.total_points - a.total_points)

  // Show matchday columns (last 5 + total)
  const mdCols = Array.from({ length: Math.min(totalMatchdays, 5) }, (_, i) => totalMatchdays - 4 + i).filter(m => m >= 1)

  // Count total tips for each member
  const getTippedMatchdays = (m: MemberRanking) => {
    return Object.values(m.points_by_matchday).filter(v => v > 0).length
  }

  if (sorted.length === 0) {
    return (
      <div style={{ textAlign: 'center', padding: '40px 0' }}>
        <p style={{ fontSize: 14, color: 'var(--text-muted)' }}>{t('tippen.noMembersFound')}</p>
      </div>
    )
  }

  // Top 3 for podium
  const top3 = sorted.slice(0, 3)
  const rest = sorted.slice(3)

  // Podium order: [2nd, 1st, 3rd] for visual layout
  const podiumOrder = top3.length >= 3
    ? [top3[1], top3[0], top3[2]]
    : top3.length >= 2
      ? [top3[1], top3[0]]
      : [top3[0]]

  const podiumHeights = [100, 130, 80] // 2nd, 1st, 3rd
  const podiumColors = ['#C0C0C0', '#FFB800', '#CD7F32'] // silver, gold, bronze
  const podiumMedals = ['🥈', '🥇', '🥉']

  return (
    <div style={{ padding: '8px 0' }}>

      {/* ── Podium for Top 3 ── */}
      {top3.length >= 2 && (
        <div style={{
          display: 'flex', alignItems: 'flex-end', justifyContent: 'center',
          gap: 8, padding: '16px 16px 0', marginBottom: 20,
        }}>
          {podiumOrder.map((m, i) => {
            if (!m) return null
            const actualRank = sorted.indexOf(m) + 1
            const isMe = m.user_id === currentUserId
            const height = podiumHeights[i] || 80
            const color = podiumColors[i] || '#CD7F32'
            const medal = podiumMedals[i] || ''

            return (
              <div
                key={m.user_id}
                onClick={() => onUserClick?.(m.user_id)}
                style={{
                  display: 'flex', flexDirection: 'column', alignItems: 'center',
                  cursor: onUserClick ? 'pointer' : 'default',
                  flex: 1, maxWidth: 120,
                }}
              >
                {/* Avatar + medal */}
                <div style={{ position: 'relative', marginBottom: 6 }}>
                  <ProfileImage
                    size={i === 1 ? 56 : 44}
                    avatarUrl={m.avatar_url}
                    name={m.display_name || m.username}
                    goldBorder={isMe}
                    borderColor={isMe ? undefined : color}
                  />
                  <span style={{
                    position: 'absolute', bottom: -4, left: '50%', transform: 'translateX(-50%)',
                    fontSize: i === 1 ? 20 : 16,
                  }}>
                    {medal}
                  </span>
                </div>

                {/* Name */}
                <p style={{
                  fontSize: 11, fontWeight: 700, margin: 0, marginTop: 4,
                  color: isMe ? 'var(--gold-primary)' : 'var(--text-primary)',
                  maxWidth: 100, overflow: 'hidden', textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap', textAlign: 'center',
                }}>
                  {m.display_name || m.username}
                </p>

                {/* Points */}
                <p style={{
                  fontSize: i === 1 ? 22 : 18, fontWeight: 700, margin: '4px 0 0',
                  fontFamily: 'var(--font-display)', color,
                }}>
                  {m.total_points}
                </p>

                {/* Tipped matchdays */}
                <p style={{
                  fontSize: 9, color: 'var(--text-muted)',
                  fontFamily: 'var(--font-display)', margin: '2px 0 6px',
                }}>
                  {getTippedMatchdays(m)}/{totalMatchdays} ST
                </p>

                {/* Podium bar */}
                <div style={{
                  width: '100%', height, borderRadius: '8px 8px 0 0',
                  background: `linear-gradient(to bottom, ${color}33, ${color}11)`,
                  border: `1px solid ${color}44`, borderBottom: 'none',
                  display: 'flex', alignItems: 'flex-start', justifyContent: 'center',
                  paddingTop: 8,
                }}>
                  <span style={{
                    fontFamily: 'var(--font-display)', fontSize: 24, fontWeight: 700,
                    color: `${color}88`,
                  }}>
                    {actualRank}
                  </span>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* ── Table header ── */}
      <div style={{
        display: 'flex', alignItems: 'center', padding: '8px 14px',
        fontSize: 10, fontFamily: 'var(--font-display)', fontWeight: 700,
        color: 'var(--text-muted)', letterSpacing: 1, textTransform: 'uppercase',
        borderBottom: '1px solid var(--border-subtle)',
        borderTop: '1px solid var(--border-subtle)',
      }}>
        <div style={{ width: 32, textAlign: 'center' }}>#</div>
        <div style={{ flex: 1, marginLeft: 8 }}>{t('tippen.playerLabel')}</div>
        {mdCols.map(md => (
          <div
            key={md}
            onClick={() => onMatchdayClick?.(md)}
            style={{
              width: 38, textAlign: 'center',
              cursor: onMatchdayClick ? 'pointer' : 'default',
              color: onMatchdayClick ? 'var(--gold-primary)' : 'var(--text-muted)',
            }}
          >
            ST{md}
          </div>
        ))}
        <div style={{ width: 48, textAlign: 'center', color: 'var(--gold-primary)' }}>{t('tippen.totalLabel')}</div>
      </div>

      {/* ── All rows (including top 3 for reference) ── */}
      {sorted.map((m, i) => {
        const rank = i + 1
        const isMe = m.user_id === currentUserId
        const medal = rank === 1 ? '🥇' : rank === 2 ? '🥈' : rank === 3 ? '🥉' : null
        const isTop3 = rank <= 3

        return (
          <div
            key={m.user_id}
            style={{
              display: 'flex', alignItems: 'center', padding: '10px 14px',
              background: isMe ? 'rgba(255,184,0,0.06)' : isTop3 ? 'rgba(255,255,255,0.015)' : 'transparent',
              borderBottom: '1px solid var(--border-subtle)',
              borderLeft: isMe ? '3px solid var(--gold-primary)' : '3px solid transparent',
            }}
          >
            {/* Rank */}
            <div style={{
              width: 32, textAlign: 'center', fontFamily: 'var(--font-display)',
              fontSize: medal ? 18 : 14, fontWeight: 700,
              color: medal ? undefined : 'var(--text-muted)',
            }}>
              {medal || `${rank}.`}
            </div>

            {/* Avatar + name + sub info */}
            <div
              onClick={() => onUserClick?.(m.user_id)}
              style={{
                flex: 1, display: 'flex', alignItems: 'center', gap: 8, marginLeft: 8,
                cursor: onUserClick ? 'pointer' : 'default', overflow: 'hidden',
              }}
            >
              <ProfileImage size={32} avatarUrl={m.avatar_url} name={m.display_name || m.username} goldBorder={isMe} />
              <div style={{ overflow: 'hidden' }}>
                <p style={{
                  fontSize: 13, fontWeight: 600, margin: 0,
                  color: isMe ? 'var(--gold-primary)' : 'var(--text-primary)',
                  overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                }}>
                  {m.display_name || m.username}
                </p>
                <p style={{
                  fontSize: 9, margin: '1px 0 0', color: 'var(--text-muted)',
                  fontFamily: 'var(--font-display)', letterSpacing: 0.3,
                }}>
                  {getTippedMatchdays(m)}/{totalMatchdays} {t('tippen.matchdaysLabel')}
                </p>
              </div>
            </div>

            {/* Per-matchday columns */}
            {mdCols.map(md => (
              <div key={md} style={{
                width: 38, textAlign: 'center', fontSize: 11,
                fontFamily: 'var(--font-display)', fontWeight: 600,
                color: (m.points_by_matchday[String(md)] ?? 0) > 0 ? 'var(--text-secondary)' : 'var(--text-muted)',
              }}>
                {m.points_by_matchday[String(md)] ?? '–'}
              </div>
            ))}

            {/* Total - larger for top 3 */}
            <div style={{
              width: 48, textAlign: 'center',
              fontSize: isTop3 ? 17 : 15,
              fontFamily: 'var(--font-display)', fontWeight: 700,
              color: rank <= 3 ? 'var(--gold-primary)' : 'var(--text-secondary)',
            }}>
              {m.total_points}
            </div>
          </div>
        )
      })}
    </div>
  )
}
