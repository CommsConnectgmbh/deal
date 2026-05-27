'use client'
import { useState } from 'react'
import { useLang } from '@/contexts/LanguageContext'
import { seedTournamentSpecials, defaultSpecialsDeadline, getSpecialsForCompetition } from './wmSpecialsSeed'

interface Props {
  groupId: string
  onCreated: () => void
  onResolve: (questionId: string, correctAnswer: string) => Promise<void>
  /** Falls gesetzt, blendet den 1-Klick-Seeder für Standard-Turnier-Specials ein. */
  tournamentSeed?: {
    competitionCode: string | null
    contestStartsAt: string | null
    hasExistingBonusQuestions: boolean
  }
}

/**
 * Admin: create new bonus question + resolve existing ones.
 */
export default function BonusQuestionAdmin({ groupId, onCreated, onResolve, tournamentSeed }: Props) {
  const { t } = useLang()
  const [open, setOpen] = useState(false)
  const [question, setQuestion] = useState('')
  const [answerType, setAnswerType] = useState('single_choice')
  const [options, setOptions] = useState('')
  const [points, setPoints] = useState('5')
  const [deadline, setDeadline] = useState('')
  const [creating, setCreating] = useState(false)
  const [seeding, setSeeding] = useState(false)
  const [seedError, setSeedError] = useState('')

  const handleSeedTournament = async () => {
    if (!tournamentSeed || seeding) return
    setSeeding(true)
    setSeedError('')
    try {
      const iso = defaultSpecialsDeadline(tournamentSeed.contestStartsAt)
      const n = await seedTournamentSpecials(groupId, tournamentSeed.competitionCode, iso)
      if (n === 0) {
        setSeedError('Es gibt bereits Specials in dieser Gruppe.')
      } else {
        onCreated()
      }
    } catch (e: any) {
      setSeedError(e?.message || 'Fehler beim Anlegen')
    } finally {
      setSeeding(false)
    }
  }

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
    const showSeed = tournamentSeed && !tournamentSeed.hasExistingBonusQuestions
    const specials = tournamentSeed ? getSpecialsForCompetition(tournamentSeed.competitionCode) : []
    return (
      <div style={{ marginBottom: 16 }}>
        {showSeed && (
          <div style={{
            background: 'linear-gradient(135deg, rgba(255,184,0,0.10), rgba(255,184,0,0.03))',
            border: '1px solid var(--gold-glow)', borderRadius: 14,
            padding: '14px 14px 12px', marginBottom: 10,
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
              <span style={{ fontSize: 16 }}>🏆</span>
              <span style={{
                fontFamily: 'var(--font-display)', fontSize: 12,
                color: 'var(--gold-primary)', letterSpacing: 1.2, fontWeight: 800,
                textTransform: 'uppercase',
              }}>
                Standard-Turnier-Wetten
              </span>
            </div>
            <p style={{ fontSize: 12, color: 'var(--text-secondary)', margin: '0 0 10px', lineHeight: 1.45 }}>
              {specials.length} Spezial-Wetten mit einem Klick anlegen: Weltmeister, Torschützenkönig, Tore im Finale &amp; mehr. Deadline = Turnier-Start.
            </p>
            <button
              onClick={handleSeedTournament}
              disabled={seeding}
              style={{
                width: '100%', padding: '11px 14px',
                background: 'linear-gradient(135deg, var(--gold-dim), var(--gold-primary))',
                color: 'var(--text-inverse)', border: 'none', borderRadius: 10,
                fontFamily: 'var(--font-display)', fontSize: 12, fontWeight: 800,
                letterSpacing: 1.2, textTransform: 'uppercase',
                cursor: seeding ? 'not-allowed' : 'pointer', opacity: seeding ? 0.6 : 1,
              }}
            >
              {seeding ? 'Wird angelegt...' : `${specials.length} Standard-Wetten anlegen`}
            </button>
            {seedError && (
              <p style={{ fontSize: 11, color: 'var(--status-error)', margin: '8px 0 0' }}>{seedError}</p>
            )}
          </div>
        )}
        <button onClick={() => setOpen(true)} style={{
          width: '100%', padding: '12px',
          background: 'var(--bg-elevated)', border: '1px dashed var(--gold-primary)',
          borderRadius: 14, color: 'var(--gold-primary)', fontSize: 13,
          fontFamily: 'var(--font-display)', fontWeight: 700, letterSpacing: 1,
          cursor: 'pointer', textTransform: 'uppercase',
        }}>
          {t('tippen.addBonusQuestion')}
        </button>
      </div>
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
