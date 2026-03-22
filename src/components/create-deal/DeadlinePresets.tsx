'use client'
import { useLang } from '@/contexts/LanguageContext'
import { DEADLINE_PRESETS } from '@/lib/createDealReducer'

const DEADLINE_LABEL_KEYS = ['deals.deadline24h', 'deals.deadline3days', 'deals.deadline1week', 'deals.deadline1month']

interface Props {
  value: string
  onChange: (deadline: string) => void
}

export default function DeadlinePresets({ value, onChange }: Props) {
  const { t, lang } = useLang()
  const selectPreset = (hours: number) => {
    const d = new Date()
    d.setHours(d.getHours() + hours)
    onChange(d.toISOString().slice(0, 16))
  }

  const clearDeadline = () => onChange('')

  return (
    <div>
      <label style={{
        display: 'block', fontSize: 10, fontFamily: 'var(--font-display)',
        letterSpacing: 2, color: 'var(--text-secondary)', marginBottom: 8,
      }}>
        {t('deals.deadlineLabel')}
      </label>

      {/* Preset chips */}
      <div style={{
        display: 'flex', gap: 6, marginBottom: 8,
        flexWrap: 'wrap',
      }}>
        {DEADLINE_PRESETS.map((p, i) => (
          <button
            key={p.label}
            onClick={() => selectPreset(p.hours)}
            style={{
              padding: '6px 12px',
              borderRadius: 20,
              border: '1px solid var(--border-subtle)',
              background: 'var(--bg-surface)',
              color: 'var(--text-muted)',
              fontSize: 11,
              fontFamily: 'var(--font-body)',
              cursor: 'pointer',
              transition: 'all 0.2s ease',
            }}
          >
            {DEADLINE_LABEL_KEYS[i] ? t(DEADLINE_LABEL_KEYS[i]) : p.label}
          </button>
        ))}
      </div>

      {/* Custom datetime input */}
      <input
        type="datetime-local"
        value={value}
        onChange={e => onChange(e.target.value)}
        min={new Date().toISOString().slice(0, 16)}
        style={{
          width: '100%', padding: '14px 16px',
          background: 'var(--bg-elevated)',
          border: '1px solid var(--border-subtle)',
          borderRadius: 10,
          color: 'var(--text-primary)',
          fontSize: 16, fontFamily: 'var(--font-body)',
          outline: 'none', boxSizing: 'border-box',
          colorScheme: 'dark',
        }}
      />

      {/* Active deadline display */}
      {value && (
        <div style={{
          display: 'flex', alignItems: 'center', gap: 8,
          marginTop: 8, padding: '8px 12px', borderRadius: 8,
          background: 'rgba(245,158,11,0.06)',
          border: '1px solid rgba(245,158,11,0.15)',
        }}>
          <span style={{ fontSize: 14 }}>{'\u23F0'}</span>
          <span style={{
            fontSize: 11, color: 'var(--gold-primary)',
            fontFamily: 'var(--font-display)', flex: 1,
          }}>
            {t('deals.deadlineEndsAt').replace('{date}', new Date(value).toLocaleDateString(lang === 'de' ? 'de-DE' : lang === 'fr' ? 'fr-FR' : lang === 'es' ? 'es-ES' : lang === 'it' ? 'it-IT' : 'en-US', {
              day: 'numeric', month: 'short', year: 'numeric',
              hour: '2-digit', minute: '2-digit',
            }))}
          </span>
          <button
            onClick={clearDeadline}
            style={{
              background: 'none', border: 'none',
              color: 'var(--text-muted)', cursor: 'pointer', fontSize: 14,
            }}
          >
            {'\u2715'}
          </button>
        </div>
      )}
    </div>
  )
}
