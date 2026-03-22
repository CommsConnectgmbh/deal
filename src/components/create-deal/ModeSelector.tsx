'use client'
import { useLang } from '@/contexts/LanguageContext'
import type { DealMode } from '@/lib/createDealReducer'

interface Props {
  selected: DealMode
  onSelect: (mode: DealMode) => void
}

const MODE_KEYS: { value: DealMode; icon: string; labelKey: string; descKey: string }[] = [
  { value: '1v1', icon: '\u2694\uFE0F', labelKey: 'deals.mode1v1', descKey: 'deals.mode1v1Desc' },
  { value: 'team', icon: '\u{1F46B}', labelKey: 'deals.modeTeam', descKey: 'deals.modeTeamDesc' },
  { value: 'open_challenge', icon: '\u{1F310}', labelKey: 'deals.modeOpen', descKey: 'deals.modeOpenDesc' },
]

export default function ModeSelector({ selected, onSelect }: Props) {
  const { t } = useLang()
  return (
    <div>
      <label style={{
        display: 'block', fontSize: 10, fontFamily: 'var(--font-display)',
        letterSpacing: 2, color: 'var(--text-secondary)', marginBottom: 10,
      }}>
        {t('deals.modeLabel')}
      </label>
      <div style={{ display: 'flex', gap: 8 }}>
        {MODE_KEYS.map(m => {
          const active = selected === m.value
          return (
            <button
              key={m.value}
              onClick={() => onSelect(m.value)}
              style={{
                flex: 1,
                padding: '14px 8px',
                borderRadius: 12,
                border: active ? '1.5px solid var(--gold-primary)' : '1px solid var(--border-subtle)',
                background: active ? 'rgba(255,184,0,0.06)' : 'var(--bg-surface)',
                cursor: 'pointer',
                display: 'flex', flexDirection: 'column',
                alignItems: 'center', gap: 6,
                transition: 'all 0.2s ease',
              }}
            >
              <span style={{ fontSize: 22 }}>{m.icon}</span>
              <span style={{
                fontFamily: 'var(--font-display)', fontSize: 10,
                fontWeight: 700, letterSpacing: 1,
                color: active ? 'var(--gold-primary)' : 'var(--text-primary)',
              }}>
                {t(m.labelKey)}
              </span>
              <span style={{
                fontSize: 9, color: 'var(--text-muted)',
                fontFamily: 'var(--font-body)',
              }}>
                {t(m.descKey)}
              </span>
            </button>
          )
        })}
      </div>
    </div>
  )
}
