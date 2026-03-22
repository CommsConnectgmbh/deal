'use client'
import { useState } from 'react'
import { useLang } from '@/contexts/LanguageContext'

interface Props {
  groupId: string
  onCreated: () => void
  onResolve: (questionId: string, correctAnswer: string) => Promise<void>
}

/**
 * Admin: create new bonus question + resolve existing ones.
 */
export default function BonusQuestionAdmin({ groupId, onCreated, onResolve }: Props) {
  const { t } = useLang()
  const [open, setOpen] = useState(false)
  const [question, setQuestion] = useState('')
  const [answerType, setAnswerType] = useState('single_choice')
  const [options, setOptions] = useState('')
  const [points, setPoints] = useState('5')
  const [deadline, setDeadline] = useState('')
  const [creating, setCreating] = useState(false)

  const handleCreate = async () => {
    if (!question.trim() || !deadline || creating) return
    setCreating(true)

    const { supabase } = await import('@/lib/supabase')
    const payload: Record<string, unknown> = {
      group_id: groupId,
      question: question.trim(),
      answer_type: answerType,
      points: parseInt(points) || 5,
      deadline: new Date(deadline).toISOString(),
      status: 'open',
    }

    if (answerType === 'single_choice' && options.trim()) {
      payload.options = options.split(',').map(o => o.trim()).filter(Boolean)
    }

    await supabase.from('tip_bonus_questions').insert(payload)
    setCreating(false)
    setOpen(false)
    setQuestion('')
    setOptions('')
    setPoints('5')
    setDeadline('')
    onCreated()
  }

  if (!open) {
    return (
      <button onClick={() => setOpen(true)} style={{
        width: '100%', padding: '12px', marginBottom: 16,
        background: 'var(--bg-elevated)', border: '1px dashed var(--gold-primary)',
        borderRadius: 14, color: 'var(--gold-primary)', fontSize: 13,
        fontFamily: 'var(--font-display)', fontWeight: 700, letterSpacing: 1,
        cursor: 'pointer', textTransform: 'uppercase',
      }}>
        {t('tippen.addBonusQuestion')}
      </button>
    )
  }

  return (
    <div style={{
      background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)',
      borderRadius: 14, padding: 16, marginBottom: 16,
    }}>
      <h3 style={{ fontSize: 14, fontFamily: 'var(--font-display)', color: 'var(--gold-primary)', margin: '0 0 12px', letterSpacing: 1 }}>
        {t('tippen.newBonusQuestion')}
      </h3>

      <input
        value={question} onChange={e => setQuestion(e.target.value)}
        placeholder={t('tippen.questionPlaceholder')}
        style={{
          width: '100%', padding: '10px 14px', marginBottom: 10,
          background: 'var(--input-bg)', border: '1px solid var(--input-border)',
          borderRadius: 10, color: 'var(--input-text)', fontSize: 14,
          outline: 'none', boxSizing: 'border-box',
        }}
      />

      <select
        value={answerType} onChange={e => setAnswerType(e.target.value)}
        style={{
          width: '100%', padding: '10px 14px', marginBottom: 10,
          background: 'var(--input-bg)', border: '1px solid var(--input-border)',
          borderRadius: 10, color: 'var(--input-text)', fontSize: 14, outline: 'none', boxSizing: 'border-box',
        }}
      >
        <option value="single_choice">{t('tippen.multipleChoice')}</option>
        <option value="freetext">{t('tippen.freetext')}</option>
        <option value="number">{t('tippen.number')}</option>
      </select>

      {answerType === 'single_choice' && (
        <input
          value={options} onChange={e => setOptions(e.target.value)}
          placeholder={t('tippen.optionsPlaceholder')}
          style={{
            width: '100%', padding: '10px 14px', marginBottom: 10,
            background: 'var(--input-bg)', border: '1px solid var(--input-border)',
            borderRadius: 10, color: 'var(--input-text)', fontSize: 14, outline: 'none', boxSizing: 'border-box',
          }}
        />
      )}

      <div style={{ display: 'flex', gap: 10, marginBottom: 10 }}>
        <div style={{ flex: 1 }}>
          <label style={{ fontSize: 11, color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>{t('tippen.pointsLabel')}</label>
          <input
            type="number" value={points} onChange={e => setPoints(e.target.value)} min="1" max="50"
            style={{
              width: '100%', padding: '10px', background: 'var(--input-bg)',
              border: '1px solid var(--input-border)', borderRadius: 10,
              color: 'var(--input-text)', fontSize: 14, outline: 'none', boxSizing: 'border-box',
            }}
          />
        </div>
        <div style={{ flex: 2 }}>
          <label style={{ fontSize: 11, color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>{t('tippen.deadlineLabel')}</label>
          <input
            type="datetime-local" value={deadline} onChange={e => setDeadline(e.target.value)}
            style={{
              width: '100%', padding: '10px', background: 'var(--input-bg)',
              border: '1px solid var(--input-border)', borderRadius: 10,
              color: 'var(--input-text)', fontSize: 14, outline: 'none', boxSizing: 'border-box',
            }}
          />
        </div>
      </div>

      <div style={{ display: 'flex', gap: 8 }}>
        <button onClick={() => setOpen(false)} style={{
          flex: 1, padding: '12px', background: 'var(--bg-elevated)',
          border: '1px solid var(--border-subtle)', borderRadius: 10,
          color: 'var(--text-muted)', fontSize: 12, fontFamily: 'var(--font-display)', cursor: 'pointer',
        }}>
          {t('tippen.cancel')}
        </button>
        <button onClick={handleCreate} disabled={!question.trim() || !deadline || creating} style={{
          flex: 1, padding: '12px',
          background: question.trim() && deadline ? 'linear-gradient(135deg, var(--gold-dim), var(--gold-primary))' : 'var(--bg-elevated)',
          border: 'none', borderRadius: 10, color: 'var(--text-inverse)',
          fontSize: 12, fontFamily: 'var(--font-display)', fontWeight: 700,
          cursor: 'pointer', letterSpacing: 1, textTransform: 'uppercase',
        }}>
          {creating ? '...' : t('tippen.createBtn')}
        </button>
      </div>
    </div>
  )
}
