'use client'
import { CATEGORIES } from '@/lib/createDealReducer'

interface Props {
  value: string
  onChange: (cat: string) => void
}

export default function CategoryPicker({ value, onChange }: Props) {
  return (
    <div>
      <label style={{
        display: 'block', fontSize: 10, fontFamily: 'var(--font-display)',
        letterSpacing: 2, color: 'var(--text-secondary)', marginBottom: 8,
      }}>
        KATEGORIE
      </label>
      <div style={{
        display: 'flex', flexWrap: 'wrap', gap: 6,
      }}>
        {CATEGORIES.map(cat => {
          const active = value === cat.value
          return (
            <button
              key={cat.value}
              onClick={() => onChange(cat.value)}
              style={{
                padding: '7px 12px',
                borderRadius: 20,
                border: active ? '1.5px solid var(--gold-primary)' : '1px solid var(--border-subtle)',
                background: active ? 'rgba(255,184,0,0.08)' : 'var(--bg-surface)',
                color: active ? 'var(--gold-primary)' : 'var(--text-muted)',
                fontSize: 11,
                fontFamily: 'var(--font-body)',
                cursor: 'pointer',
                display: 'flex', alignItems: 'center', gap: 4,
                transition: 'all 0.2s ease',
              }}
            >
              <span style={{ fontSize: 13 }}>{cat.icon}</span>
              {cat.label}
            </button>
          )
        })}
      </div>
    </div>
  )
}
