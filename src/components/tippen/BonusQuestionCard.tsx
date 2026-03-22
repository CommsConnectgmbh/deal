'use client'
import { useState } from 'react'
import { useLang } from '@/contexts/LanguageContext'

interface BonusQuestion {
  id: string
  question: string
  answer_type: string
  options: string[] | null
  correct_answer: string | null
  points: number
  deadline: string
  status: string
}

interface BonusAnswer {
  question_id: string
  answer: string
  points_earned: number
}

interface Props {
  question: BonusQuestion
  myAnswer?: BonusAnswer | null
  onSubmit: (questionId: string, answer: string) => Promise<void>
}

function deadlinePassed(iso: string) { return new Date(iso).getTime() < Date.now() }

export default function BonusQuestionCard({ question: q, myAnswer, onSubmit }: Props) {
  const { t, lang } = useLang()
  const [draft, setDraft] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const locked = deadlinePassed(q.deadline)
  const resolved = q.status === 'resolved'

  const handleSubmit = async () => {
    if (!draft.trim() || submitting) return
    setSubmitting(true)
    await onSubmit(q.id, draft.trim())
    setSubmitting(false)
  }

  return (
    <div style={{
      background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)',
      borderRadius: 14, padding: 16, marginBottom: 12,
    }}>
      {/* Question header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
        <p style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)', margin: 0, flex: 1 }}>
          ⚡ {q.question}
        </p>
        <span style={{
          fontSize: 11, fontFamily: 'var(--font-display)', fontWeight: 700,
          color: 'var(--gold-primary)', marginLeft: 8, whiteSpace: 'nowrap',
        }}>
          {q.points}P
        </span>
      </div>

      {/* Deadline */}
      {!locked && (
        <p style={{ fontSize: 11, color: 'var(--status-warning)', margin: '0 0 12px' }}>
          ⏱ {t('components.bonusDeadline')}: {new Date(q.deadline).toLocaleString(lang === 'de' ? 'de-DE' : lang === 'fr' ? 'fr-FR' : lang === 'es' ? 'es-ES' : lang === 'it' ? 'it-IT' : 'en-US', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}
        </p>
      )}

      {/* Resolved state */}
      {resolved && (
        <div style={{ padding: '8px 12px', background: 'var(--bg-elevated)', borderRadius: 8, marginBottom: 8 }}>
          <p style={{ fontSize: 12, color: 'var(--text-muted)', margin: '0 0 2px' }}>{t('components.bonusCorrectAnswer')}</p>
          <p style={{ fontSize: 14, fontWeight: 700, color: '#22C55E', margin: 0 }}>
            {q.correct_answer || '–'}
          </p>
        </div>
      )}

      {/* My answer display */}
      {myAnswer ? (
        <div style={{
          padding: '10px 12px', background: 'var(--gold-subtle)', borderRadius: 10,
        }}>
          <p style={{ fontSize: 12, color: 'var(--text-muted)', margin: '0 0 2px' }}>{t('components.bonusYourAnswer')}</p>
          <p style={{
            fontSize: 14, fontWeight: 600, margin: 0,
            color: resolved
              ? (myAnswer.points_earned > 0 ? '#22C55E' : 'var(--status-error)')
              : 'var(--gold-primary)',
          }}>
            {myAnswer.answer}
            {resolved && ` → ${myAnswer.points_earned}P`}
          </p>
        </div>
      ) : locked ? (
        <p style={{ fontSize: 13, color: 'var(--status-error)', margin: 0 }}>
          {t('components.bonusDeadlineMissed')}
        </p>
      ) : (
        /* Answer form */
        <>
          {q.answer_type === 'single_choice' && q.options ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 10 }}>
              {q.options.map((opt, i) => (
                <button key={i} onClick={() => setDraft(opt)} style={{
                  padding: '10px 14px', textAlign: 'left',
                  background: draft === opt ? 'linear-gradient(135deg, var(--gold-dim), var(--gold-primary))' : 'var(--bg-elevated)',
                  border: draft === opt ? '1px solid var(--gold-primary)' : '1px solid var(--border-subtle)',
                  borderRadius: 10, cursor: 'pointer',
                  color: draft === opt ? 'var(--text-inverse)' : 'var(--text-secondary)',
                  fontSize: 13, fontWeight: draft === opt ? 700 : 400,
                }}>
                  {opt}
                </button>
              ))}
            </div>
          ) : q.answer_type === 'number' ? (
            <input
              type="number" value={draft} onChange={e => setDraft(e.target.value)}
              placeholder={t('components.bonusEnterNumber')}
              style={{
                width: '100%', padding: '10px 14px', marginBottom: 10,
                background: 'var(--input-bg)', border: '1px solid var(--input-border)',
                borderRadius: 10, color: 'var(--input-text)', fontSize: 14,
                outline: 'none', boxSizing: 'border-box',
              }}
            />
          ) : (
            <input
              value={draft} onChange={e => setDraft(e.target.value)}
              placeholder={t('components.bonusEnterAnswer')}
              style={{
                width: '100%', padding: '10px 14px', marginBottom: 10,
                background: 'var(--input-bg)', border: '1px solid var(--input-border)',
                borderRadius: 10, color: 'var(--input-text)', fontSize: 14,
                outline: 'none', boxSizing: 'border-box', fontFamily: 'var(--font-body)',
              }}
            />
          )}

          <button onClick={handleSubmit} disabled={!draft.trim() || submitting} style={{
            width: '100%', padding: '12px',
            background: draft.trim()
              ? 'linear-gradient(135deg, var(--gold-dim), var(--gold-primary))'
              : 'var(--bg-elevated)',
            border: 'none', borderRadius: 10, color: 'var(--text-inverse)',
            fontFamily: 'var(--font-display)', fontSize: 13, fontWeight: 700,
            letterSpacing: 1, cursor: 'pointer', textTransform: 'uppercase',
            opacity: submitting ? 0.6 : 1,
          }}>
            {submitting ? t('components.bonusSaving') : t('components.bonusSubmit')}
          </button>
        </>
      )}
    </div>
  )
}
