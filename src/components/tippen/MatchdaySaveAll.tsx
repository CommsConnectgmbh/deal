'use client'

interface Props {
  onSave: () => void
  saving: boolean
  /** How many tips have been entered/modified */
  tippCount: number
}

/** Sticky bottom "ALLE TIPPS SPEICHERN" button */
export default function MatchdaySaveAll({ onSave, saving, tippCount }: Props) {
  if (tippCount === 0) return null

  return (
    <div style={{
      position: 'sticky', bottom: 70, left: 0, right: 0,
      padding: '12px 16px', zIndex: 40,
    }}>
      <button
        onClick={onSave}
        disabled={saving}
        style={{
          width: '100%', padding: '14px 0',
          background: 'linear-gradient(135deg, var(--gold-dim), var(--gold-primary))',
          border: 'none', borderRadius: 14,
          color: 'var(--text-inverse)',
          fontFamily: 'var(--font-display)', fontSize: 14, fontWeight: 700,
          letterSpacing: 2, textTransform: 'uppercase',
          cursor: saving ? 'wait' : 'pointer',
          opacity: saving ? 0.6 : 1,
          boxShadow: '0 4px 20px rgba(255,184,0,0.3)',
          transition: 'opacity .2s',
        }}
      >
        {saving ? 'WIRD GESPEICHERT...' : `ALLE TIPPS SPEICHERN (${tippCount})`}
      </button>
    </div>
  )
}
