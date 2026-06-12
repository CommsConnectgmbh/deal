'use client'

import { useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { useAuth } from '@/contexts/AuthContext'
import { supabase } from '@/lib/supabase'

const OFFICIAL_INVITE_CODE = 'DEAL-WM2026'
const CONTEST_END = new Date('2026-07-19T23:59:59+02:00').getTime()

interface OfficialContest {
  id: string
  name: string
  description: string | null
  prize_label: string | null
  prize_value_cents: number | null
  prize_2nd_label: string | null
  prize_2nd_value_cents: number | null
  prize_3rd_label: string | null
  prize_3rd_value_cents: number | null
  contest_starts_at: string | null
  contest_ends_at: string | null
  tie_breaker_question: string | null
  organizer_name: string | null
  member_count: number
}

function useCountdown(target: number) {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(id)
  }, [])
  const diff = Math.max(0, target - now)
  const d = Math.floor(diff / 86_400_000)
  const h = Math.floor((diff % 86_400_000) / 3_600_000)
  const m = Math.floor((diff % 3_600_000) / 60_000)
  const s = Math.floor((diff % 60_000) / 1000)
  return { d, h, m, s, done: diff === 0 }
}

export default function GewinnspielPage() {
  const { user, profile } = useAuth()
  const router = useRouter()
  const [contest, setContest] = useState<OfficialContest | null>(null)
  const [isMember, setIsMember] = useState(false)
  const [tieBreakerAnswer, setTieBreakerAnswer] = useState('')
  const [savedTieBreaker, setSavedTieBreaker] = useState<number | null>(null)
  const [loading, setLoading] = useState(true)
  const [joinLoading, setJoinLoading] = useState(false)
  const [joinError, setJoinError] = useState('')
  const countdown = useCountdown(CONTEST_END)

  const load = useCallback(async () => {
    setLoading(true)
    // Offizielle WM-Gruppe ist über is_official=true sichtbar (RLS public read)
    const { data: g } = await supabase
      .from('tip_groups')
      .select('id, name, description, prize_label, prize_value_cents, prize_2nd_label, prize_2nd_value_cents, prize_3rd_label, prize_3rd_value_cents, contest_starts_at, contest_ends_at, tie_breaker_question, organizer_name')
      .eq('invite_code', OFFICIAL_INVITE_CODE)
      .eq('is_official', true)
      .maybeSingle()

    if (!g) {
      setLoading(false)
      return
    }

    const { count } = await supabase
      .from('tip_group_members')
      .select('*', { count: 'exact', head: true })
      .eq('group_id', g.id)

    setContest({ ...g, member_count: count || 0 })

    if (user) {
      const { data: membership } = await supabase
        .from('tip_group_members')
        .select('user_id, tie_breaker_answer')
        .eq('group_id', g.id)
        .eq('user_id', user.id)
        .maybeSingle()
      if (membership) {
        setIsMember(true)
        setSavedTieBreaker(membership.tie_breaker_answer)
        if (membership.tie_breaker_answer != null) {
          setTieBreakerAnswer(String(membership.tie_breaker_answer))
        }
      }
    }
    setLoading(false)
  }, [user])

  useEffect(() => { load() }, [load])

  const handleJoin = async () => {
    if (!user) {
      router.push(`/auth/login?redirect=${encodeURIComponent('/app/gewinnspiel')}`)
      return
    }
    if (!contest) return
    setJoinLoading(true)
    setJoinError('')
    const tb = tieBreakerAnswer.trim() === '' ? null : parseInt(tieBreakerAnswer, 10)
    if (tb !== null && (isNaN(tb) || tb < 0 || tb > 20)) {
      setJoinError('Tor-Differenz muss eine Zahl zwischen 0 und 20 sein.')
      setJoinLoading(false)
      return
    }
    const { error } = await supabase.from('tip_group_members').insert({
      group_id: contest.id,
      user_id: user.id,
      role: 'member',
      total_points: 0,
      tie_breaker_answer: tb,
    })
    if (error) {
      setJoinError(error.message)
      setJoinLoading(false)
      return
    }
    setIsMember(true)
    setSavedTieBreaker(tb)
    setJoinLoading(false)
    await load()
  }

  const handleUpdateTieBreaker = async () => {
    if (!user || !contest) return
    const tb = parseInt(tieBreakerAnswer, 10)
    if (isNaN(tb) || tb < 0 || tb > 20) {
      setJoinError('Tor-Differenz muss eine Zahl zwischen 0 und 20 sein.')
      return
    }
    setJoinLoading(true)
    await supabase
      .from('tip_group_members')
      .update({ tie_breaker_answer: tb })
      .eq('group_id', contest.id)
      .eq('user_id', user.id)
    setSavedTieBreaker(tb)
    setJoinLoading(false)
  }

  if (loading) {
    return (
      <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-muted)' }}>
        Lade Gewinnspiel...
      </div>
    )
  }

  if (!contest) {
    return (
      <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-muted)' }}>
        Aktuell läuft kein offizielles Gewinnspiel.
      </div>
    )
  }

  const prize = contest.prize_label || 'iPhone 17 Pro Max'
  const prizeValue = contest.prize_value_cents
    ? `${(contest.prize_value_cents / 100).toLocaleString('de-DE', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 })} UVP`
    : ''
  const totalPrizePool = (contest.prize_value_cents || 0) + (contest.prize_2nd_value_cents || 0) + (contest.prize_3rd_value_cents || 0)
  const totalPrizePoolLabel = totalPrizePool > 0
    ? `${(totalPrizePool / 100).toLocaleString('de-DE', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 })}`
    : ''

  return (
    <div style={{
      minHeight: 'calc(100dvh - 80px)',
      padding: '20px 16px 100px',
      maxWidth: 640,
      margin: '0 auto',
    }}>
      {/* HERO */}
      <div style={{
        position: 'relative',
        borderRadius: 20,
        overflow: 'hidden',
        marginBottom: 24,
        background: 'linear-gradient(160deg, #0b0b0d 0%, #1a1208 50%, #0b0b0d 100%)',
        border: '1px solid var(--gold-glow)',
        boxShadow: '0 20px 60px -20px rgba(255,184,0,0.3)',
      }}>
        <div style={{
          position: 'absolute', inset: 0,
          background: 'radial-gradient(ellipse 80% 60% at 50% 0%, rgba(255,184,0,0.12), transparent 60%)',
          pointerEvents: 'none',
        }} />

        <div style={{ position: 'relative', padding: '32px 24px 28px', textAlign: 'center' }}>
          <span style={{
            display: 'inline-block',
            fontFamily: 'var(--font-display)', fontSize: 9, fontWeight: 700, letterSpacing: 3,
            color: 'var(--gold-primary)', textTransform: 'uppercase',
            padding: '6px 14px', borderRadius: 999,
            border: '1px solid var(--gold-glow)',
            background: 'rgba(255,184,0,0.06)',
            marginBottom: 16,
          }}>
            Offizielles Gewinnspiel
          </span>

          <h1 style={{
            fontFamily: 'var(--font-display)', fontSize: 30, fontWeight: 800,
            letterSpacing: -0.5, lineHeight: 1.1, margin: '0 0 8px',
            color: 'var(--text-primary)',
          }}>
            WM 2026 — iPhone-Cup
          </h1>
          <p style={{
            fontSize: 14, color: 'var(--text-secondary)', margin: '0 0 24px',
            lineHeight: 1.5,
          }}>
            Tippe alle 104 Spiele der FIFA WM 2026 mit. Die besten drei am 19. Juli gewinnen Apple-Hardware im Gesamtwert von {totalPrizePoolLabel || '2.547 €'}.
          </p>

          {/* Prize visual */}
          <div style={{
            fontFamily: 'var(--font-display)', fontSize: 13, fontWeight: 800,
            color: 'var(--gold-primary)', letterSpacing: 1.5, textTransform: 'uppercase',
            margin: '0 0 4px',
          }}>
            1. Platz
          </div>
          <div style={{
            fontFamily: 'var(--font-display)', fontSize: 22, fontWeight: 800,
            color: 'var(--text-primary)', margin: '0 0 4px',
          }}>
            Apple {prize}
          </div>
          {prizeValue && (
            <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 24 }}>
              {prizeValue} · Steuer übernimmt der Veranstalter
            </div>
          )}

          {/* Countdown */}
          <div style={{
            display: 'flex', justifyContent: 'center', gap: 10, marginBottom: 8,
          }}>
            {[
              { v: countdown.d, label: 'Tage' },
              { v: countdown.h, label: 'Std.' },
              { v: countdown.m, label: 'Min.' },
              { v: countdown.s, label: 'Sek.' },
            ].map((c) => (
              <div key={c.label} style={{
                minWidth: 56,
                padding: '8px 6px',
                borderRadius: 10,
                background: 'rgba(255,184,0,0.06)',
                border: '1px solid var(--gold-glow)',
              }}>
                <div style={{
                  fontFamily: 'var(--font-display)', fontSize: 20, fontWeight: 800,
                  color: 'var(--gold-primary)', lineHeight: 1,
                }}>
                  {String(c.v).padStart(2, '0')}
                </div>
                <div style={{
                  fontSize: 9, color: 'var(--text-muted)', letterSpacing: 1,
                  textTransform: 'uppercase', marginTop: 4,
                }}>
                  {c.label}
                </div>
              </div>
            ))}
          </div>
          <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 8 }}>
            bis zum Finale am 19. Juli 2026
          </div>
        </div>
      </div>

      {/* SECONDARY PRIZES */}
      <SectionHeader label="Auch Platz 2 und 3 gewinnen" />
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 24 }}>
        <div style={{
          padding: '16px 14px', borderRadius: 14,
          background: 'var(--bg-surface)',
          border: '1px solid var(--border-subtle)',
          textAlign: 'center',
        }}>
          <div style={{
            fontFamily: 'var(--font-display)', fontSize: 10, fontWeight: 700,
            letterSpacing: 2, color: 'var(--gold-primary)', textTransform: 'uppercase',
            marginBottom: 6,
          }}>
            2. Platz
          </div>
          <div style={{ fontSize: 32, lineHeight: 1, marginBottom: 8 }}>📱</div>
          <div style={{
            fontFamily: 'var(--font-display)', fontSize: 14, fontWeight: 800,
            color: 'var(--text-primary)', marginBottom: 4, lineHeight: 1.2,
          }}>
            Apple {contest.prize_2nd_label || 'iPhone 17e'}
          </div>
          {contest.prize_2nd_value_cents && (
            <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
              {(contest.prize_2nd_value_cents / 100).toLocaleString('de-DE', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 })} UVP
            </div>
          )}
        </div>
        <div style={{
          padding: '16px 14px', borderRadius: 14,
          background: 'var(--bg-surface)',
          border: '1px solid var(--border-subtle)',
          textAlign: 'center',
        }}>
          <div style={{
            fontFamily: 'var(--font-display)', fontSize: 10, fontWeight: 700,
            letterSpacing: 2, color: 'var(--gold-primary)', textTransform: 'uppercase',
            marginBottom: 6,
          }}>
            3. Platz
          </div>
          <div style={{ fontSize: 32, lineHeight: 1, marginBottom: 8 }}>⌚</div>
          <div style={{
            fontFamily: 'var(--font-display)', fontSize: 14, fontWeight: 800,
            color: 'var(--text-primary)', marginBottom: 4, lineHeight: 1.2,
          }}>
            Apple {contest.prize_3rd_label || 'Watch Series 11'}
          </div>
          {contest.prize_3rd_value_cents && (
            <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
              {(contest.prize_3rd_value_cents / 100).toLocaleString('de-DE', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 })} UVP
            </div>
          )}
        </div>
      </div>

      {/* MEMBER COUNT */}
      <div style={{
        textAlign: 'center', marginBottom: 24,
        color: 'var(--text-secondary)', fontSize: 13,
      }}>
        <strong style={{ color: 'var(--gold-primary)', fontWeight: 800 }}>{contest.member_count}</strong>{' '}
        {contest.member_count === 1 ? 'Teilnehmer' : 'Teilnehmer'} dabei
      </div>

      {/* HOW IT WORKS */}
      <SectionHeader label="So funktioniert's" />
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 28 }}>
        {[
          { n: '1', title: 'Mittippen', body: 'Tippe Sieger und Tor-Differenz für jedes WM-Spiel. Push-Erinnerung vor jedem Anpfiff.' },
          { n: '2', title: 'Punkte sammeln', body: 'Exakter Tipp = 4 Pkt. · Richtige Tor-Differenz = 3 Pkt. · Richtiger Sieger = 2 Pkt.' },
          { n: '3', title: 'Top 3 gewinnen', body: 'Platz 1 holt das iPhone 17 Pro Max, Platz 2 das iPhone 17e, Platz 3 die Apple Watch Series 11. Bei Gleichstand zählt deine Tor-Differenz fürs Finale — wenn auch die gleich ist, wird gelost.' },
        ].map(step => (
          <div key={step.n} style={{
            display: 'flex', gap: 14, alignItems: 'flex-start',
            padding: '14px 16px',
            background: 'var(--bg-surface)',
            border: '1px solid var(--border-subtle)',
            borderRadius: 14,
          }}>
            <div style={{
              flexShrink: 0,
              width: 36, height: 36, borderRadius: '50%',
              background: 'linear-gradient(135deg, var(--gold-dim), var(--gold-primary))',
              color: 'var(--text-inverse)',
              fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: 16,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              {step.n}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{
                fontFamily: 'var(--font-display)', fontSize: 13, fontWeight: 800,
                color: 'var(--text-primary)', letterSpacing: 0.5, marginBottom: 4,
              }}>
                {step.title}
              </div>
              <div style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.4 }}>
                {step.body}
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* TIE BREAKER + JOIN */}
      <SectionHeader label={isMember ? 'Deine Anmeldung' : 'Jetzt mittippen'} />
      <div style={{
        padding: '18px 16px',
        background: 'var(--bg-surface)',
        border: '1px solid var(--gold-glow)',
        borderRadius: 14, marginBottom: 24,
      }}>
        <label style={{ fontSize: 12, color: 'var(--text-secondary)', fontWeight: 600, marginBottom: 4, display: 'block' }}>
          Stichfrage · Tor-Differenz im Finale
        </label>
        <p style={{ fontSize: 11, color: 'var(--text-muted)', margin: '0 0 10px', lineHeight: 1.4 }}>
          Beispiel: Bei einem 3:0 ist die Tor-Differenz 3. Bei Punktgleichstand zählt, wer am dichtesten dran ist. Falls auch die Differenz identisch ist, wird zwischen den Gleichplatzierten gelost.
        </p>
        <input
          value={tieBreakerAnswer}
          onChange={(e) => setTieBreakerAnswer(e.target.value.replace(/\D/g, '').slice(0, 2))}
          placeholder="0–20"
          type="text"
          inputMode="numeric"
          style={{
            width: '100%', padding: '12px 14px',
            background: 'var(--bg-elevated)',
            border: '1px solid var(--border-subtle)',
            borderRadius: 10,
            color: 'var(--text-primary)', fontSize: 16, fontFamily: 'var(--font-body)',
            outline: 'none', boxSizing: 'border-box', marginBottom: 12,
          }}
        />

        {joinError && (
          <p style={{ color: 'var(--status-error)', fontSize: 12, margin: '0 0 10px' }}>{joinError}</p>
        )}

        {isMember ? (
          <>
            <div style={{
              padding: '10px 12px',
              background: 'rgba(74,222,128,0.08)',
              border: '1px solid rgba(74,222,128,0.27)',
              borderRadius: 10,
              color: '#4ade80', fontSize: 12, fontWeight: 600,
              textAlign: 'center', marginBottom: 12,
            }}>
              ✓ Du bist dabei. Stichfrage gespeichert: {savedTieBreaker ?? '—'}
            </div>
            <button
              onClick={handleUpdateTieBreaker}
              disabled={joinLoading || tieBreakerAnswer === '' || parseInt(tieBreakerAnswer, 10) === savedTieBreaker}
              style={{
                width: '100%', padding: '12px',
                background: 'var(--bg-elevated)',
                border: '1px solid var(--border-subtle)',
                borderRadius: 10,
                color: 'var(--text-secondary)', fontSize: 12, fontFamily: 'var(--font-display)',
                fontWeight: 700, letterSpacing: 1, cursor: 'pointer',
                opacity: joinLoading ? 0.6 : 1, marginBottom: 8,
              }}
            >
              Stichfrage aktualisieren
            </button>
            <button
              onClick={() => router.push(`/app/tippen/${contest.id}`)}
              style={{
                width: '100%', padding: '14px',
                background: 'linear-gradient(135deg, var(--gold-dim), var(--gold-primary))',
                border: 'none', borderRadius: 12,
                color: 'var(--text-inverse)', fontSize: 13, fontFamily: 'var(--font-display)',
                fontWeight: 800, letterSpacing: 1.5, textTransform: 'uppercase', cursor: 'pointer',
              }}
            >
              Zur Tipprunde
            </button>
          </>
        ) : (
          <button
            onClick={handleJoin}
            disabled={joinLoading}
            style={{
              width: '100%', padding: '14px',
              background: 'linear-gradient(135deg, var(--gold-dim), var(--gold-primary))',
              border: 'none', borderRadius: 12,
              color: 'var(--text-inverse)', fontSize: 13, fontFamily: 'var(--font-display)',
              fontWeight: 800, letterSpacing: 1.5, textTransform: 'uppercase', cursor: 'pointer',
              opacity: joinLoading ? 0.6 : 1,
            }}
          >
            {joinLoading ? 'Anmelden...' : user ? 'Jetzt kostenlos mittippen' : 'Anmelden & mittippen'}
          </button>
        )}
        <p style={{ fontSize: 10, color: 'var(--text-muted)', textAlign: 'center', margin: '10px 0 0', lineHeight: 1.5 }}>
          Teilnahme kostenlos · keine Kaufbedingung · ab 18 J. · DE/AT.{' '}
          <Link href="/app/gewinnspiel/teilnahmebedingungen" style={{ color: 'var(--gold-primary)', textDecoration: 'underline' }}>
            Teilnahmebedingungen
          </Link>
        </p>
      </div>

      {/* QUICK FACTS */}
      <SectionHeader label="Das Wichtigste in Kürze" />
      <ul style={{
        listStyle: 'none', padding: 0, margin: '0 0 24px',
        fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.7,
      }}>
        {[
          'Teilnahme komplett kostenlos, keine Kaufbedingung',
          'Mindestalter: 18 Jahre, Wohnsitz Deutschland oder Österreich',
          'Spielzeitraum: 11.06.2026 bis 19.07.2026',
          '1. Platz: Apple iPhone 17 Pro Max 256 GB',
          '2. Platz: Apple iPhone 17e',
          '3. Platz: Apple Watch Series 11',
          'Versand: innerhalb 4 Wochen nach WM-Finale',
          'Veranstalter trägt die pauschale Steuer auf alle drei Preise',
        ].map(item => (
          <li key={item} style={{ display: 'flex', gap: 10, marginBottom: 8 }}>
            <span style={{ color: 'var(--gold-primary)', flexShrink: 0 }}>✓</span>
            <span>{item}</span>
          </li>
        ))}
      </ul>

      <p style={{
        fontSize: 11, color: 'var(--text-muted)', textAlign: 'center',
        margin: '24px 0 0', lineHeight: 1.6,
      }}>
        Veranstalter: {contest.organizer_name || 'Comms Connect GmbH'} · Kein Kauf erforderlich · Rechtsweg ausgeschlossen.
      </p>
    </div>
  )
}

function SectionHeader({ label }: { label: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12, margin: '0 0 14px' }}>
      <div style={{ flex: 1, height: 1, background: 'var(--border-subtle)' }} />
      <span style={{
        fontFamily: 'var(--font-display)', fontSize: 11, fontWeight: 700,
        color: 'var(--text-muted)', letterSpacing: 2, textTransform: 'uppercase', whiteSpace: 'nowrap',
      }}>
        {label}
      </span>
      <div style={{ flex: 1, height: 1, background: 'var(--border-subtle)' }} />
    </div>
  )
}
