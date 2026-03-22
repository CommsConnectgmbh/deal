'use client'
import { useState, useEffect } from 'react'
import { useLang } from '@/contexts/LanguageContext'
import { STAKE_PRESETS } from '@/lib/createDealReducer'

const STAKE_PRESET_KEYS = [
  'deals.stakePresetBeer',
  'deals.stakePresetDinner',
  'deals.stakePresetPhoto',
  'deals.stakePresetPushups',
  'deals.stakePresetCarwash',
  'deals.stakePresetDrinks',
]

const STAKE_PRESET_EMOJIS = ['\u{1F37A}', '\u{1F37D}\uFE0F', '\u{1F4F8}', '\u{1F4AA}', '\u{1F697}', '\u{1F942}']

interface Props {
  value: string
  onChange: (stake: string) => void
  error?: string
  onBlur?: () => void
  onKeyDown?: (e: React.KeyboardEvent) => void
}

export default function StakePresets({ value, onChange, error, onBlur, onKeyDown }: Props) {
  const { t } = useLang()
  const [placeholderIdx, setPlaceholderIdx] = useState(0)

  const translatedPresets = STAKE_PRESET_KEYS.map((key, i) => `${t(key)} ${STAKE_PRESET_EMOJIS[i]}`)

  useEffect(() => {
    const timer = setInterval(() => setPlaceholderIdx(i => (i + 1) % translatedPresets.length), 3000)
    return () => clearInterval(timer)
  }, [])

  return (
    <div>
      <label style={{
        display: 'block', fontSize: 10, fontFamily: 'var(--font-display)',
        letterSpacing: 2, color: 'var(--text-secondary)', marginBottom: 8,
      }}>
        {t('deals.stakeLabel')} *
      </label>

      {/* Quick chips */}
      <div style={{
        display: 'flex', gap: 6, overflowX: 'auto',
        marginBottom: 8, paddingBottom: 4,
        scrollbarWidth: 'none',
      }}>
        {translatedPresets.map((preset) => {
          const active = value === preset
          return (
            <button
              key={preset}
              onClick={() => onChange(active ? '' : preset)}
              style={{
                flexShrink: 0,
                padding: '6px 12px',
                borderRadius: 20,
                border: active ? '1.5px solid var(--gold-primary)' : '1px solid var(--border-subtle)',
                background: active ? 'rgba(255,184,0,0.08)' : 'var(--bg-surface)',
                color: active ? 'var(--gold-primary)' : 'var(--text-muted)',
                fontSize: 11,
                fontFamily: 'var(--font-body)',
                cursor: 'pointer',
                whiteSpace: 'nowrap',
                transition: 'all 0.2s ease',
              }}
            >
              {preset}
            </button>
          )
        })}
      </div>

      {/* Custom input */}
      <input
        value={value}
        onChange={e => onChange(e.target.value)}
        onBlur={onBlur}
        onKeyDown={onKeyDown}
        placeholder={translatedPresets[placeholderIdx]}
        style={{
          width: '100%', padding: '14px 16px',
          background: 'var(--bg-elevated)',
          border: error ? '1px solid var(--status-error)' : '1px solid var(--border-subtle)',
          borderRadius: 10,
          color: 'var(--text-primary)',
          fontSize: 16, fontFamily: 'var(--font-body)',
          outline: 'none', boxSizing: 'border-box',
        }}
      />
      {error && <p style={{ color: 'var(--status-error)', fontSize: 12, marginTop: 4, margin: '4px 0 0' }}>{error}</p>}
    </div>
  )
}
