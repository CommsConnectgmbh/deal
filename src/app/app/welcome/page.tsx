'use client'
import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/contexts/AuthContext'
import { useLang, LANGUAGES, Lang } from '@/contexts/LanguageContext'
import { supabase } from '@/lib/supabase'
import ProfileImage from '@/components/ProfileImage'
import { subscribeToPush, isPushSupported, getPushPermission } from '@/lib/pushNotifications'
import { trackOnboardingCompleted, trackInviteSent, trackShareClicked, trackScreenView } from '@/lib/analytics'

/**
 * Post-login onboarding — Mini-Game Journey.
 * 5 steps: Language → Welcome Reward → First Challenge → Invite Friends → Push
 * Feels like a game tutorial, not an app setup.
 */

export default function WelcomePage() {
  const [step, setStep] = useState(0) // 0=language, 1=reward, 2=challenge, 3=invite, 4=push
  const { user, profile, refreshProfile } = useAuth()
  const { t, lang, setLang } = useLang()
  const router = useRouter()
  const [animate, setAnimate] = useState(false)
  const [coinsVisible, setCoinsVisible] = useState(false)
  const [coinCount, setCoinCount] = useState(0)
  const [copied, setCopied] = useState(false)
  const [selectedChallenge, setSelectedChallenge] = useState<number | null>(null)
  const [pushStatus, setPushStatus] = useState<'idle' | 'loading' | 'done'>('idle')
  const [selectedLang, setSelectedLang] = useState<Lang>(lang)

  // Track screen view & trigger entrance animation
  useEffect(() => {
    trackScreenView('welcome_onboarding')
    setTimeout(() => setAnimate(true), 100)
  }, [])

  // Coin counting animation for step 1
  useEffect(() => {
    if (step === 1 && animate) {
      setTimeout(() => setCoinsVisible(true), 800)
      setTimeout(() => {
        let count = 0
        const iv = setInterval(() => {
          count += 5
          setCoinCount(count)
          if (count >= 50) clearInterval(iv)
        }, 40)
      }, 1200)
    }
  }, [step, animate])

  const completeOnboarding = useCallback(async () => {
    if (!user) return
    trackOnboardingCompleted()
    await supabase.from('profiles').update({ onboarding_completed: true }).eq('id', user.id)
    const currentCoins = profile?.coins || 0
    await supabase.from('profiles').update({ coins: currentCoins + 50 }).eq('id', user.id)
    await supabase.from('wallet_ledger').insert({
      user_id: user.id,
      amount: 50,
      type: 'welcome_bonus',
      description: 'Willkommensbonus',
    })
    await refreshProfile()
  }, [user, profile, refreshProfile])

  const goHome = useCallback(async () => {
    await completeOnboarding()
    router.replace('/app/home')
  }, [completeOnboarding, router])

  const goToChallenge = useCallback(async (template: string) => {
    await completeOnboarding()
    if (template) {
      router.replace('/app/deals/create')
    } else {
      router.replace('/app/deals/create')
    }
  }, [completeOnboarding, router])

  const handleShare = useCallback(async (method: 'whatsapp' | 'copy') => {
    const code = profile?.invite_code || ''
    const url = `https://app.deal-buddy.app/join/${code}`
    const text = `\u2694\uFE0F ${profile?.display_name || profile?.username} ${lang === 'de' ? 'fordert dich heraus!' : lang === 'fr' ? 'te d\u00E9fie !' : lang === 'es' ? '\u00A1te desaf\u00EDa!' : lang === 'it' ? 'ti sfida!' : 'challenges you!'} DealBuddy: ${url}`

    if (method === 'whatsapp') {
      trackInviteSent('whatsapp')
      trackShareClicked('invite', 'whatsapp')
      window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank')
    } else {
      try {
        await navigator.clipboard.writeText(url)
        trackInviteSent('copy_link')
        trackShareClicked('invite', 'copy_link')
        setCopied(true)
        setTimeout(() => setCopied(false), 2000)
      } catch { /* clipboard not available */ }
    }
  }, [profile, lang])

  const nextStep = () => {
    setAnimate(false)
    setTimeout(() => {
      setStep(s => s + 1)
      setAnimate(true)
    }, 150)
  }

  const CHALLENGE_OPTIONS = [
    {
      icon: '\uD83C\uDFC3',
      title: t('welcome.fitnessTitle'),
      sub: t('welcome.fitnessSub'),
      color: '#22C55E',
      template: t('welcome.fitnessSub'),
      category: 'fitness',
    },
    {
      icon: '\uD83C\uDFAF',
      title: t('welcome.predictionTitle'),
      sub: t('welcome.predictionSub'),
      color: '#3B82F6',
      template: t('welcome.predictionSub') + ': ',
      category: 'wissen',
    },
    {
      icon: '\u26A1',
      title: t('welcome.customTitle'),
      sub: t('welcome.customSub'),
      color: '#F59E0B',
      template: '',
      category: 'custom',
    },
  ]

  const name = profile?.display_name || profile?.username || 'Champion'

  // Skip button shared across all steps
  const skipButton = (
    <button onClick={goHome} style={{
      position: 'absolute', top: 'calc(env(safe-area-inset-top) + 16px)', right: 16,
      background: 'none', border: '1px solid rgba(255,255,255,0.15)',
      borderRadius: 20, padding: '6px 16px', cursor: 'pointer', zIndex: 10,
      color: 'var(--text-secondary)', fontFamily: 'var(--font-display)',
      fontSize: 11, letterSpacing: 1,
    }}>
      SKIP
    </button>
  )

  // ── STEP 0: Language Selection ──
  if (step === 0) {
    return (
      <div style={{
        minHeight: '100dvh', background: '#060606',
        display: 'flex', flexDirection: 'column',
        maxWidth: 430, margin: '0 auto', position: 'relative', overflow: 'hidden',
      }}>
        {skipButton}
        {/* Gold glow */}
        <div style={{
          position: 'absolute', top: '15%', left: '50%', transform: 'translateX(-50%)',
          width: 300, height: 300, borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(255,184,0,0.08) 0%, transparent 70%)',
          pointerEvents: 'none',
        }} />

        <div style={{
          flex: 1, display: 'flex', flexDirection: 'column',
          alignItems: 'center', justifyContent: 'center',
          padding: '40px 28px 0', textAlign: 'center', position: 'relative', zIndex: 1,
        }}>
          {/* Globe emoji */}
          <div style={{
            fontSize: 56, marginBottom: 20,
            opacity: animate ? 1 : 0,
            transform: animate ? 'translateY(0) scale(1)' : 'translateY(20px) scale(0.9)',
            transition: 'all 0.5s cubic-bezier(0.34, 1.56, 0.64, 1)',
          }}>
            {'\uD83C\uDF0D'}
          </div>

          <h1 style={{
            fontFamily: 'var(--font-display)', fontSize: 22, fontWeight: 900,
            color: '#F0ECE4', lineHeight: 1.3, marginBottom: 8, letterSpacing: 2,
            opacity: animate ? 1 : 0,
            transform: animate ? 'translateY(0)' : 'translateY(20px)',
            transition: 'all 0.5s 0.15s cubic-bezier(0.34, 1.56, 0.64, 1)',
          }}>
            {t('welcome.chooseLanguage')}
          </h1>

          <p style={{
            fontSize: 14, color: 'var(--text-secondary)', marginBottom: 32,
            opacity: animate ? 1 : 0,
            transform: animate ? 'translateY(0)' : 'translateY(20px)',
            transition: 'all 0.5s 0.25s',
          }}>
            Select your preferred language
          </p>

          {/* Language buttons */}
          <div style={{
            display: 'flex', flexDirection: 'column', gap: 10, width: '100%', maxWidth: 340,
            opacity: animate ? 1 : 0,
            transform: animate ? 'translateY(0)' : 'translateY(20px)',
            transition: 'all 0.5s 0.3s',
          }}>
            {LANGUAGES.map((l) => (
              <button
                key={l.code}
                onClick={() => {
                  setSelectedLang(l.code)
                  setLang(l.code)
                }}
                style={{
                  display: 'flex', alignItems: 'center', gap: 16,
                  padding: '16px 20px', borderRadius: 14, cursor: 'pointer',
                  background: selectedLang === l.code
                    ? 'rgba(255,184,0,0.08)'
                    : 'rgba(255,255,255,0.03)',
                  border: selectedLang === l.code
                    ? '2px solid rgba(255,184,0,0.4)'
                    : '2px solid rgba(255,255,255,0.06)',
                  transition: 'all 0.2s',
                  transform: selectedLang === l.code ? 'scale(1.02)' : 'scale(1)',
                }}
              >
                <span style={{ fontSize: 28 }}>{l.flag}</span>
                <span style={{
                  fontFamily: 'var(--font-display)', fontSize: 16, fontWeight: 700,
                  color: selectedLang === l.code ? 'var(--gold-primary)' : 'var(--text-primary)',
                  letterSpacing: 1, flex: 1, textAlign: 'left',
                }}>
                  {l.label}
                </span>
                {selectedLang === l.code && (
                  <span style={{ fontSize: 18, color: 'var(--gold-primary)' }}>{'\u2713'}</span>
                )}
              </button>
            ))}
          </div>
        </div>

        <div style={{ padding: '24px 28px 48px', position: 'relative', zIndex: 1 }}>
          <button
            onClick={nextStep}
            style={{
              width: '100%', padding: 20, borderRadius: 14, border: 'none', cursor: 'pointer',
              background: 'linear-gradient(135deg, var(--gold-dim), var(--gold-primary), var(--gold-bright))',
              color: 'var(--text-inverse)', fontFamily: 'var(--font-display)',
              fontSize: 14, fontWeight: 900, letterSpacing: 3,
              boxShadow: '0 4px 24px rgba(245,158,11,0.3)',
            }}
          >
            {t('welcome.continue')}
          </button>
        </div>
      </div>
    )
  }

  // ── STEP 1: Welcome Reward ──
  if (step === 1) {
    return (
      <div style={{
        minHeight: '100dvh', background: '#060606',
        display: 'flex', flexDirection: 'column',
        maxWidth: 430, margin: '0 auto', position: 'relative', overflow: 'hidden',
      }}>
        {skipButton}
        <div style={{
          position: 'absolute', top: '20%', left: '50%', transform: 'translateX(-50%)',
          width: 300, height: 300, borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(255,184,0,0.1) 0%, transparent 70%)',
          pointerEvents: 'none',
        }} />

        <div style={{
          flex: 1, display: 'flex', flexDirection: 'column',
          alignItems: 'center', justifyContent: 'center',
          padding: '40px 28px 0', textAlign: 'center', position: 'relative', zIndex: 1,
        }}>
          {/* Avatar */}
          <div style={{
            marginBottom: 24,
            opacity: animate ? 1 : 0,
            transform: animate ? 'translateY(0) scale(1)' : 'translateY(20px) scale(0.9)',
            transition: 'all 0.5s cubic-bezier(0.34, 1.56, 0.64, 1)',
          }}>
            <ProfileImage size={80} avatarUrl={profile?.avatar_url} name={name} goldBorder />
          </div>

          <h1 style={{
            fontFamily: 'var(--font-display)', fontSize: 24, fontWeight: 900,
            color: '#F0ECE4', lineHeight: 1.3, marginBottom: 8,
            opacity: animate ? 1 : 0,
            transform: animate ? 'translateY(0)' : 'translateY(20px)',
            transition: 'all 0.5s 0.15s cubic-bezier(0.34, 1.56, 0.64, 1)',
          }}>
            {t('welcome.welcomeTitle')}<br/>
            <span style={{ color: 'var(--gold-primary)' }}>@{profile?.username || 'Champion'}</span>
          </h1>

          <p style={{
            fontSize: 15, color: 'var(--text-secondary)', marginBottom: 40,
            opacity: animate ? 1 : 0,
            transform: animate ? 'translateY(0)' : 'translateY(20px)',
            transition: 'all 0.5s 0.25s',
          }}>
            {t('welcome.journeyStarts')}
          </p>

          {/* Coin Reward Animation */}
          <div style={{
            opacity: coinsVisible ? 1 : 0,
            transform: coinsVisible ? 'translateY(0) scale(1)' : 'translateY(30px) scale(0.8)',
            transition: 'all 0.6s cubic-bezier(0.34, 1.56, 0.64, 1)',
          }}>
            <div style={{
              width: 160, height: 160, borderRadius: '50%',
              background: 'radial-gradient(circle, rgba(255,184,0,0.12) 0%, rgba(255,184,0,0.03) 70%)',
              border: '2px solid rgba(255,184,0,0.2)',
              display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
              boxShadow: '0 0 60px rgba(255,184,0,0.15), 0 0 120px rgba(255,184,0,0.05)',
              animation: coinsVisible ? 'coin-glow 2s ease-in-out infinite' : 'none',
            }}>
              <span style={{ fontSize: 36, marginBottom: 4 }}>{'\uD83E\uDE99'}</span>
              <span style={{
                fontFamily: 'var(--font-display)', fontSize: 36, fontWeight: 900,
                color: 'var(--gold-primary)',
                textShadow: '0 0 20px rgba(255,184,0,0.5)',
              }}>
                +{coinCount}
              </span>
              <span style={{
                fontFamily: 'var(--font-display)', fontSize: 10, letterSpacing: 3,
                color: 'var(--text-muted)', marginTop: 2,
              }}>
                {t('welcome.welcomeBonus')}
              </span>
            </div>
          </div>
        </div>

        <div style={{ padding: '24px 28px 48px', position: 'relative', zIndex: 1 }}>
          <button
            onClick={nextStep}
            style={{
              width: '100%', padding: 20, borderRadius: 14, border: 'none', cursor: 'pointer',
              background: 'linear-gradient(135deg, var(--gold-dim), var(--gold-primary), var(--gold-bright))',
              color: 'var(--text-inverse)', fontFamily: 'var(--font-display)',
              fontSize: 14, fontWeight: 900, letterSpacing: 3,
              boxShadow: '0 4px 24px rgba(245,158,11,0.3)',
              opacity: coinsVisible ? 1 : 0.3,
              transition: 'opacity 0.5s',
            }}
          >
            {t('welcome.next')}
          </button>
        </div>

        <style>{`
          @keyframes coin-glow {
            0%, 100% { box-shadow: 0 0 60px rgba(255,184,0,0.15), 0 0 120px rgba(255,184,0,0.05); }
            50% { box-shadow: 0 0 80px rgba(255,184,0,0.25), 0 0 160px rgba(255,184,0,0.1); }
          }
        `}</style>
      </div>
    )
  }

  // ── STEP 2: First Challenge ──
  if (step === 2) {
    return (
      <div style={{
        minHeight: '100dvh', background: '#060606',
        display: 'flex', flexDirection: 'column',
        maxWidth: 430, margin: '0 auto', position: 'relative', overflow: 'hidden',
      }}>
        {skipButton}
        <div style={{
          position: 'absolute', top: '10%', left: '50%', transform: 'translateX(-50%)',
          width: 350, height: 350, borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(255,184,0,0.06) 0%, transparent 70%)',
          pointerEvents: 'none',
        }} />

        <div style={{
          flex: 1, display: 'flex', flexDirection: 'column',
          alignItems: 'center', justifyContent: 'center',
          padding: '40px 28px 0', textAlign: 'center', position: 'relative', zIndex: 1,
        }}>
          <div style={{
            fontSize: 56, marginBottom: 20, lineHeight: 1,
            opacity: animate ? 1 : 0,
            transform: animate ? 'translateY(0)' : 'translateY(20px)',
            transition: 'all 0.5s cubic-bezier(0.34, 1.56, 0.64, 1)',
          }}>
            {'\u2694\uFE0F'}
          </div>

          <h1 style={{
            fontFamily: 'var(--font-display)', fontSize: 22, fontWeight: 900,
            color: '#F0ECE4', lineHeight: 1.3, marginBottom: 6, letterSpacing: 2,
            opacity: animate ? 1 : 0,
            transform: animate ? 'translateY(0)' : 'translateY(20px)',
            transition: 'all 0.5s 0.1s',
          }}>
            {t('welcome.firstChallenge')}<br/>
            <span style={{ color: 'var(--gold-primary)' }}>{t('welcome.challenge')}</span>
          </h1>

          <p style={{
            fontSize: 14, color: 'var(--text-secondary)', marginBottom: 32,
            opacity: animate ? 1 : 0,
            transform: animate ? 'translateY(0)' : 'translateY(20px)',
            transition: 'all 0.5s 0.2s',
          }}>
            {t('welcome.challengeSub')}
          </p>

          <div style={{
            display: 'flex', flexDirection: 'column', gap: 12, width: '100%', maxWidth: 340,
            opacity: animate ? 1 : 0,
            transform: animate ? 'translateY(0)' : 'translateY(20px)',
            transition: 'all 0.5s 0.3s',
          }}>
            {CHALLENGE_OPTIONS.map((opt, i) => (
              <button
                key={opt.category}
                onClick={() => setSelectedChallenge(i)}
                style={{
                  display: 'flex', alignItems: 'center', gap: 14,
                  padding: '18px 20px', borderRadius: 14, cursor: 'pointer',
                  background: selectedChallenge === i
                    ? `rgba(${opt.color === '#22C55E' ? '34,197,94' : opt.color === '#3B82F6' ? '59,130,246' : '245,158,11'},0.08)`
                    : 'rgba(255,255,255,0.03)',
                  border: selectedChallenge === i
                    ? `2px solid ${opt.color}55`
                    : '2px solid rgba(255,255,255,0.06)',
                  transition: 'all 0.2s',
                  textAlign: 'left',
                  transform: selectedChallenge === i ? 'scale(1.02)' : 'scale(1)',
                }}
              >
                <div style={{
                  width: 48, height: 48, borderRadius: 12,
                  background: `${opt.color}15`,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 24, flexShrink: 0,
                }}>
                  {opt.icon}
                </div>
                <div>
                  <p style={{
                    fontFamily: 'var(--font-display)', fontSize: 14, fontWeight: 700,
                    color: selectedChallenge === i ? opt.color : 'var(--text-primary)',
                    letterSpacing: 0.5, marginBottom: 2,
                  }}>
                    {opt.title}
                  </p>
                  <p style={{ fontSize: 12, color: 'var(--text-muted)' }}>{opt.sub}</p>
                </div>
                {selectedChallenge === i && (
                  <span style={{ marginLeft: 'auto', fontSize: 18, color: opt.color }}>{'\u2713'}</span>
                )}
              </button>
            ))}
          </div>
        </div>

        <div style={{ padding: '24px 28px 48px', position: 'relative', zIndex: 1 }}>
          <button
            onClick={() => {
              if (selectedChallenge !== null) {
                goToChallenge(CHALLENGE_OPTIONS[selectedChallenge].template)
              }
            }}
            disabled={selectedChallenge === null}
            style={{
              width: '100%', padding: 20, borderRadius: 14, border: 'none',
              cursor: selectedChallenge === null ? 'default' : 'pointer',
              background: selectedChallenge !== null
                ? 'linear-gradient(135deg, var(--gold-dim), var(--gold-primary), var(--gold-bright))'
                : 'rgba(255,255,255,0.06)',
              color: selectedChallenge !== null ? 'var(--text-inverse)' : 'var(--text-muted)',
              fontFamily: 'var(--font-display)', fontSize: 14, fontWeight: 900, letterSpacing: 3,
              boxShadow: selectedChallenge !== null ? '0 4px 24px rgba(245,158,11,0.3)' : 'none',
              transition: 'all 0.3s',
            }}
          >
            {t('welcome.startChallenge')}
          </button>

          <button
            onClick={nextStep}
            style={{
              width: '100%', marginTop: 14, background: 'none', border: 'none',
              cursor: 'pointer', color: 'var(--text-muted)', fontSize: 13,
            }}
          >
            {t('welcome.later')}
          </button>
        </div>
      </div>
    )
  }

  // ── STEP 3: Invite Friends (Viral Moment) ──
  if (step === 3) {
    return (
      <div style={{
        minHeight: '100dvh', background: '#060606',
        display: 'flex', flexDirection: 'column',
        maxWidth: 430, margin: '0 auto', position: 'relative', overflow: 'hidden',
      }}>
        {skipButton}
        <div style={{
          position: 'absolute', top: '15%', left: '50%', transform: 'translateX(-50%)',
          width: 300, height: 300, borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(34,197,94,0.06) 0%, transparent 70%)',
          pointerEvents: 'none',
        }} />

        <div style={{
          flex: 1, display: 'flex', flexDirection: 'column',
          alignItems: 'center', justifyContent: 'center',
          padding: '40px 28px 0', textAlign: 'center', position: 'relative', zIndex: 1,
        }}>
          <div style={{
            fontSize: 56, marginBottom: 20,
            opacity: animate ? 1 : 0,
            transform: animate ? 'translateY(0)' : 'translateY(20px)',
            transition: 'all 0.5s cubic-bezier(0.34, 1.56, 0.64, 1)',
          }}>
            {'\uD83D\uDC65'}
          </div>

          <h1 style={{
            fontFamily: 'var(--font-display)', fontSize: 22, fontWeight: 900,
            color: '#F0ECE4', lineHeight: 1.3, marginBottom: 6, letterSpacing: 2,
            opacity: animate ? 1 : 0,
            transform: animate ? 'translateY(0)' : 'translateY(20px)',
            transition: 'all 0.5s 0.1s',
          }}>
            {t('welcome.inviteFriends')}<br/>
            <span style={{ color: '#22C55E' }}>{t('welcome.toDuel')}</span>
          </h1>

          <p style={{
            fontSize: 14, color: 'var(--text-secondary)', marginBottom: 40,
            whiteSpace: 'pre-line',
            opacity: animate ? 1 : 0,
            transform: animate ? 'translateY(0)' : 'translateY(20px)',
            transition: 'all 0.5s 0.2s',
          }}>
            {t('welcome.inviteSub')}
          </p>

          <div style={{
            display: 'flex', flexDirection: 'column', gap: 12, width: '100%', maxWidth: 320,
            opacity: animate ? 1 : 0,
            transform: animate ? 'translateY(0)' : 'translateY(20px)',
            transition: 'all 0.5s 0.3s',
          }}>
            {/* WhatsApp */}
            <button
              onClick={() => handleShare('whatsapp')}
              style={{
                display: 'flex', alignItems: 'center', gap: 14,
                padding: '18px 20px', borderRadius: 14, cursor: 'pointer',
                background: 'rgba(37,211,102,0.08)',
                border: '2px solid rgba(37,211,102,0.25)',
                transition: 'all 0.15s',
              }}
            >
              <div style={{
                width: 44, height: 44, borderRadius: 12,
                background: 'rgba(37,211,102,0.15)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 22, flexShrink: 0,
              }}>
                {'\uD83D\uDCAC'}
              </div>
              <div style={{ textAlign: 'left' }}>
                <p style={{
                  fontFamily: 'var(--font-display)', fontSize: 14, fontWeight: 700,
                  color: '#25D366', letterSpacing: 0.5, marginBottom: 2,
                }}>
                  {t('welcome.whatsapp')}
                </p>
                <p style={{ fontSize: 11, color: 'var(--text-muted)' }}>{t('welcome.whatsappSub')}</p>
              </div>
            </button>

            {/* Copy Link */}
            <button
              onClick={() => handleShare('copy')}
              style={{
                display: 'flex', alignItems: 'center', gap: 14,
                padding: '18px 20px', borderRadius: 14, cursor: 'pointer',
                background: copied ? 'rgba(34,197,94,0.08)' : 'rgba(255,184,0,0.05)',
                border: copied ? '2px solid rgba(34,197,94,0.25)' : '2px solid rgba(255,184,0,0.15)',
                transition: 'all 0.2s',
              }}
            >
              <div style={{
                width: 44, height: 44, borderRadius: 12,
                background: copied ? 'rgba(34,197,94,0.15)' : 'rgba(255,184,0,0.1)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 22, flexShrink: 0,
              }}>
                {copied ? '\u2705' : '\uD83D\uDD17'}
              </div>
              <div style={{ textAlign: 'left' }}>
                <p style={{
                  fontFamily: 'var(--font-display)', fontSize: 14, fontWeight: 700,
                  color: copied ? '#22C55E' : 'var(--gold-primary)',
                  letterSpacing: 0.5, marginBottom: 2,
                }}>
                  {copied ? t('welcome.copied') : t('welcome.copyLink')}
                </p>
                <p style={{ fontSize: 11, color: 'var(--text-muted)' }}>{t('welcome.copyLinkSub')}</p>
              </div>
            </button>

            {/* Invite code */}
            {profile?.invite_code && (
              <div style={{
                marginTop: 8, padding: '12px 20px', borderRadius: 10,
                background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)',
                textAlign: 'center',
              }}>
                <p style={{ fontSize: 9, color: 'var(--text-muted)', fontFamily: 'var(--font-display)', letterSpacing: 2, marginBottom: 4 }}>
                  {t('welcome.inviteCode')}
                </p>
                <p style={{ fontFamily: 'var(--font-display)', fontSize: 20, color: 'var(--gold-primary)', letterSpacing: 4, fontWeight: 700 }}>
                  {profile.invite_code}
                </p>
              </div>
            )}
          </div>
        </div>

        <div style={{ padding: '24px 28px 48px', position: 'relative', zIndex: 1 }}>
          <button
            onClick={nextStep}
            style={{
              width: '100%', padding: 20, borderRadius: 14, border: 'none', cursor: 'pointer',
              background: 'linear-gradient(135deg, var(--gold-dim), var(--gold-primary), var(--gold-bright))',
              color: 'var(--text-inverse)', fontFamily: 'var(--font-display)',
              fontSize: 14, fontWeight: 900, letterSpacing: 3,
              boxShadow: '0 4px 24px rgba(245,158,11,0.3)',
            }}
          >
            {t('welcome.next')}
          </button>
        </div>
      </div>
    )
  }

  // ── STEP 4: Push Notification Opt-In ──
  if (step === 4) {
    const supported = typeof window !== 'undefined' && isPushSupported()
    const permission = typeof window !== 'undefined' ? getPushPermission() : 'unsupported'

    // Auto-skip if push not supported or already granted/denied
    if (!supported || permission === 'denied' || permission === 'unsupported' || permission === 'granted') {
      goHome()
      return null
    }

    return (
      <div style={{
        minHeight: '100dvh', background: '#060606',
        display: 'flex', flexDirection: 'column',
        maxWidth: 430, margin: '0 auto', position: 'relative', overflow: 'hidden',
      }}>
        {skipButton}
        <div style={{
          position: 'absolute', top: '15%', left: '50%', transform: 'translateX(-50%)',
          width: 300, height: 300, borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(59,130,246,0.06) 0%, transparent 70%)',
          pointerEvents: 'none',
        }} />

        <div style={{
          flex: 1, display: 'flex', flexDirection: 'column',
          alignItems: 'center', justifyContent: 'center',
          padding: '40px 28px 0', textAlign: 'center', position: 'relative', zIndex: 1,
        }}>
          <div style={{
            fontSize: 56, marginBottom: 20,
            opacity: animate ? 1 : 0,
            transform: animate ? 'translateY(0)' : 'translateY(20px)',
            transition: 'all 0.5s cubic-bezier(0.34, 1.56, 0.64, 1)',
          }}>
            {'\uD83D\uDD14'}
          </div>

          <h1 style={{
            fontFamily: 'var(--font-display)', fontSize: 22, fontWeight: 900,
            color: '#F0ECE4', lineHeight: 1.3, marginBottom: 6, letterSpacing: 2,
            opacity: animate ? 1 : 0,
            transform: animate ? 'translateY(0)' : 'translateY(20px)',
            transition: 'all 0.5s 0.1s',
          }}>
            {t('welcome.pushTitle')}<br/>
            <span style={{ color: '#3B82F6' }}>{t('welcome.pushHighlight')}</span>
          </h1>

          <p style={{
            fontSize: 14, color: 'var(--text-secondary)', marginBottom: 40, lineHeight: 1.6,
            whiteSpace: 'pre-line',
            opacity: animate ? 1 : 0,
            transform: animate ? 'translateY(0)' : 'translateY(20px)',
            transition: 'all 0.5s 0.2s',
          }}>
            {t('welcome.pushSub')}
          </p>

          {pushStatus === 'done' && (
            <div style={{
              padding: '14px 24px', borderRadius: 12,
              background: 'rgba(34,197,94,0.08)',
              border: '1px solid rgba(34,197,94,0.25)',
              marginBottom: 20,
            }}>
              <p style={{ fontSize: 14, color: '#22C55E', fontWeight: 600 }}>
                {'\u2705'} {t('welcome.pushDone')}
              </p>
            </div>
          )}
        </div>

        <div style={{ padding: '24px 28px 48px', position: 'relative', zIndex: 1 }}>
          {pushStatus !== 'done' ? (
            <>
              <button
                onClick={async () => {
                  if (!user) return
                  setPushStatus('loading')
                  const success = await subscribeToPush(user.id)
                  setPushStatus(success ? 'done' : 'idle')
                  if (success) {
                    setTimeout(() => goHome(), 1200)
                  }
                }}
                disabled={pushStatus === 'loading'}
                style={{
                  width: '100%', padding: 20, borderRadius: 14, border: 'none', cursor: 'pointer',
                  background: pushStatus === 'loading'
                    ? 'rgba(59,130,246,0.3)'
                    : 'linear-gradient(135deg, #1d4ed8, #3b82f6)',
                  color: '#fff', fontFamily: 'var(--font-display)',
                  fontSize: 14, fontWeight: 900, letterSpacing: 3,
                  boxShadow: '0 4px 24px rgba(59,130,246,0.3)',
                  opacity: pushStatus === 'loading' ? 0.7 : 1,
                  transition: 'all 0.3s',
                }}
              >
                {pushStatus === 'loading' ? '...' : t('welcome.pushActivate')}
              </button>
              <button
                onClick={goHome}
                style={{
                  width: '100%', marginTop: 14, background: 'none', border: 'none',
                  cursor: 'pointer', color: 'var(--text-muted)', fontSize: 13,
                }}
              >
                {t('welcome.later')}
              </button>
            </>
          ) : (
            <button
              onClick={goHome}
              style={{
                width: '100%', padding: 20, borderRadius: 14, border: 'none', cursor: 'pointer',
                background: 'linear-gradient(135deg, var(--gold-dim), var(--gold-primary), var(--gold-bright))',
                color: 'var(--text-inverse)', fontFamily: 'var(--font-display)',
                fontSize: 14, fontWeight: 900, letterSpacing: 3,
                boxShadow: '0 4px 24px rgba(245,158,11,0.3)',
              }}
            >
              {t('welcome.letsGo')}
            </button>
          )}
        </div>
      </div>
    )
  }

  // Fallback
  return null
}
