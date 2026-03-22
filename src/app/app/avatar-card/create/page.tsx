'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/contexts/AuthContext'
import { supabase } from '@/lib/supabase'
import CardRevealAnimation from '@/components/CardRevealAnimation'

/* ── Attribute options (4 steps — matching pre-generated card DNA) ─── */

const STEPS = [
  {
    key: 'gender', title: 'GESCHLECHT',
    options: [
      { value: 'male', label: 'Mannlich', icon: '\u2642\uFE0F' },
      { value: 'female', label: 'Weiblich', icon: '\u2640\uFE0F' },
    ],
  },
  {
    key: 'age', title: 'ALTER',
    options: [
      { value: 'young', label: 'Young (18-30)', icon: '\u{1F525}' },
      { value: 'prime', label: 'Prime (30-45)', icon: '\u{1F4AA}' },
      { value: 'elite', label: 'Elite (45+)', icon: '\u{1F451}' },
    ],
  },
  {
    key: 'origin', title: 'HERKUNFT',
    options: [
      { value: 'european', label: 'European', icon: '\u{1F30D}' },
      { value: 'african', label: 'African', icon: '\u{1F30D}' },
      { value: 'asian', label: 'Asian', icon: '\u{1F30F}' },
    ],
  },
  {
    key: 'hair', title: 'FRISUR',
    options: [
      { value: 'short', label: 'Kurz', icon: '\u{1F487}' },
      { value: 'long', label: 'Lang', icon: '\u{1F9D1}' },
      { value: 'curly', label: 'Lockig', icon: '\u{1F468}\u200D\u{1F9B1}' },
    ],
  },
] as const

type StepKey = typeof STEPS[number]['key']

export default function AvatarCardCreate() {
  const router = useRouter()
  const { user, refreshProfile } = useAuth()
  const [step, setStep] = useState(0)
  const [selections, setSelections] = useState<Record<string, string>>({})
  const [creating, setCreating] = useState(false)
  const [error, setError] = useState('')
  const [revealCard, setRevealCard] = useState<any>(null)

  const currentStep = STEPS[step]
  const isLastStep = step === STEPS.length - 1
  const allSelected = STEPS.every(s => selections[s.key])

  const handleSelect = (value: string) => {
    setSelections(prev => ({ ...prev, [currentStep.key]: value }))
    // Auto-advance after short delay
    if (!isLastStep) {
      setTimeout(() => setStep(s => s + 1), 200)
    }
  }

  const handleCreate = async () => {
    if (!user || creating) return
    setCreating(true)
    setError('')

    try {
      // Single RPC call: saves DNA, unlocks starter items, finds & claims bronze card, equips it
      const { data: cardId, error: rpcErr } = await supabase.rpc('assign_starter_card', {
        p_user_id: user.id,
        p_gender: selections.gender,
        p_origin: selections.origin,
        p_hair: selections.hair,
        p_style: 'default',
        p_age: selections.age,
      })

      if (rpcErr) throw rpcErr

      // Fetch the assigned card for reveal animation
      const { data: card, error: fetchErr } = await supabase
        .from('card_catalog')
        .select('*')
        .eq('id', cardId)
        .single()

      if (fetchErr) throw fetchErr

      await refreshProfile()

      // Show card reveal animation
      setRevealCard(card)
    } catch (err: any) {
      setError(err.message || 'Fehler beim Erstellen')
      setCreating(false)
    }
  }

  const handleRevealComplete = () => {
    router.replace('/app/home')
  }

  // Show reveal animation overlay
  if (revealCard) {
    return (
      <CardRevealAnimation
        card={{
          image_url: revealCard.image_url,
          frame: revealCard.frame,
          rarity: revealCard.rarity,
          serial_display: revealCard.serial_display,
          card_code: revealCard.card_code,
        }}
        onComplete={handleRevealComplete}
      />
    )
  }

  return (
    <div style={{
      minHeight: '100dvh', background: 'var(--bg-base)',
      display: 'flex', flexDirection: 'column',
      padding: '60px 20px 40px',
    }}>
      {/* Header */}
      <div style={{ textAlign: 'center', marginBottom: 32 }}>
        <h1 className="font-display" style={{
          fontSize: 22, color: 'var(--gold-primary)', letterSpacing: 3, marginBottom: 8,
        }}>ERSTELLE DEINEN AVATAR</h1>
        <p style={{ fontSize: 13, color: 'var(--text-secondary)' }}>
          Wahle dein Aussehen und erhalte deine erste Sammelkarte
        </p>
      </div>

      {/* Step indicator */}
      <div style={{
        display: 'flex', gap: 6, justifyContent: 'center', marginBottom: 28,
      }}>
        {STEPS.map((s, i) => (
          <div key={s.key} style={{
            width: 36, height: 4, borderRadius: 2,
            background: i < step ? 'var(--gold-primary)' : i === step ? 'var(--gold-bright)' : 'var(--border-default)',
            transition: 'background 0.3s',
          }} />
        ))}
      </div>

      {/* Current step */}
      <div style={{ flex: 1 }}>
        <h2 className="font-display" style={{
          fontSize: 14, color: 'var(--text-primary)', letterSpacing: 2,
          marginBottom: 16, textAlign: 'center',
        }}>{currentStep.title}</h2>

        <div style={{
          display: 'grid',
          gridTemplateColumns: currentStep.options.length <= 2 ? 'repeat(2, 1fr)' : 'repeat(3, 1fr)',
          gap: 10,
        }}>
          {currentStep.options.map(opt => {
            const selected = selections[currentStep.key] === opt.value
            return (
              <button key={opt.value} onClick={() => handleSelect(opt.value)} style={{
                display: 'flex', flexDirection: 'column', alignItems: 'center',
                gap: 8, padding: '16px 8px', borderRadius: 12,
                background: selected ? 'var(--gold-subtle)' : 'var(--bg-surface)',
                border: `2px solid ${selected ? 'var(--gold-primary)' : 'var(--border-subtle)'}`,
                cursor: 'pointer', transition: 'all 0.15s',
                boxShadow: selected ? 'var(--shadow-gold)' : 'none',
              }}>
                <span style={{ fontSize: 28 }}>{opt.icon}</span>
                <span style={{
                  fontFamily: "'Oswald',sans-serif", fontSize: 11, fontWeight: 600,
                  letterSpacing: 1, textTransform: 'uppercase',
                  color: selected ? 'var(--gold-primary)' : 'var(--text-secondary)',
                }}>{opt.label}</span>
              </button>
            )
          })}
        </div>
      </div>

      {/* Navigation */}
      <div style={{ display: 'flex', gap: 10, marginTop: 24 }}>
        {step > 0 && (
          <button onClick={() => setStep(s => s - 1)} style={{
            flex: 1, padding: '14px 0', borderRadius: 12,
            border: '1px solid var(--border-default)',
            background: 'transparent', color: 'var(--text-secondary)',
            fontFamily: "'Oswald',sans-serif", fontSize: 13, fontWeight: 600,
            letterSpacing: 1.5, cursor: 'pointer',
          }}>ZURUCK</button>
        )}

        {isLastStep && allSelected ? (
          <button onClick={handleCreate} disabled={creating} style={{
            flex: 2, padding: '14px 0', borderRadius: 12, border: 'none',
            background: creating ? 'var(--gold-dim)' : 'var(--gold-primary)',
            color: 'var(--text-inverse)', fontFamily: "'Oswald',sans-serif",
            fontSize: 14, fontWeight: 700, letterSpacing: 2, cursor: creating ? 'wait' : 'pointer',
            boxShadow: 'var(--shadow-gold)',
          }}>{creating ? 'WIRD ERSTELLT...' : 'AVATAR ERSTELLEN'}</button>
        ) : !isLastStep && selections[currentStep.key] ? (
          <button onClick={() => setStep(s => s + 1)} style={{
            flex: 2, padding: '14px 0', borderRadius: 12, border: 'none',
            background: 'var(--gold-primary)', color: 'var(--text-inverse)',
            fontFamily: "'Oswald',sans-serif", fontSize: 13, fontWeight: 600,
            letterSpacing: 1.5, cursor: 'pointer', boxShadow: 'var(--shadow-gold)',
          }}>WEITER</button>
        ) : null}
      </div>

      {/* Summary when all selected (before creating) */}
      {allSelected && !creating && (
        <div style={{
          marginTop: 20, padding: '14px 16px', borderRadius: 12,
          background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)',
          textAlign: 'center',
        }}>
          <p style={{ fontFamily: 'var(--font-display)', fontSize: 9, letterSpacing: 2, color: 'var(--text-muted)', marginBottom: 8 }}>
            DEIN AVATAR
          </p>
          <div style={{ display: 'flex', justifyContent: 'center', gap: 8, flexWrap: 'wrap' }}>
            {STEPS.map(s => {
              const opt = s.options.find(o => o.value === selections[s.key])
              if (!opt) return null
              return (
                <span key={s.key} style={{
                  padding: '4px 10px', borderRadius: 8,
                  background: 'var(--gold-subtle)', border: '1px solid rgba(255,184,0,0.15)',
                  fontSize: 10, color: 'var(--gold-primary)',
                  fontFamily: "'Oswald',sans-serif", letterSpacing: 1,
                }}>
                  {opt.icon} {opt.label}
                </span>
              )
            })}
          </div>
          <p style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 8 }}>
            Du erhaltst deine erste Bronze-Sammelkarte
          </p>
        </div>
      )}

      {error && (
        <div style={{
          marginTop: 12, padding: '10px 16px', borderRadius: 8,
          background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)',
          color: '#EF4444', fontSize: 12, textAlign: 'center',
        }}>{error}</div>
      )}
    </div>
  )
}
