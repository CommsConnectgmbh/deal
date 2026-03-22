'use client'
import { useRouter } from 'next/navigation'
import { useLang } from '@/contexts/LanguageContext'

interface Props {
  step: number
  totalSteps: number
  title?: string
  onBack: () => void
}

export default function CreateDealHeader({ step, totalSteps, title, onBack }: Props) {
  const router = useRouter()
  const { t } = useLang()
  const STEP_LABELS = [t('createDeal.stepOpponent'), t('createDeal.stepChallenge'), t('createDeal.stepStake')]

  return (
    <div style={{
      position: 'sticky', top: 0, zIndex: 50,
      background: 'var(--bg-base)',
      borderBottom: '1px solid var(--border-subtle)',
      padding: '0 16px',
    }}>
      {/* Top row: Back + Title */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 12,
        padding: '52px 0 10px',
      }}>
        <button
          onClick={step <= 1 ? () => router.back() : onBack}
          style={{
            background: 'none', border: 'none', cursor: 'pointer',
            padding: '4px 8px', color: 'var(--text-secondary)',
            fontSize: 18, display: 'flex', alignItems: 'center',
          }}
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M19 12H5" /><path d="M12 19l-7-7 7-7" />
          </svg>
        </button>
        <h1 style={{
          fontFamily: 'var(--font-display)', fontSize: 18, fontWeight: 700,
          color: 'var(--text-primary)', letterSpacing: 2, flex: 1,
        }}>
          {title || t('createDeal.newDeal')}
        </h1>
      </div>

      {/* Step indicator */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 6,
        paddingBottom: 12, justifyContent: 'center',
      }}>
        {Array.from({ length: totalSteps }).map((_, i) => (
          <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <div style={{
              display: 'flex', alignItems: 'center', gap: 4,
            }}>
              <div style={{
                width: step === i + 1 ? 28 : 8,
                height: 4,
                borderRadius: 2,
                background: step >= i + 1 ? 'var(--gold-primary)' : 'var(--bg-elevated)',
                transition: 'all 0.3s ease',
              }} />
            </div>
          </div>
        ))}
      </div>

      {/* Step label */}
      <div style={{ textAlign: 'center', paddingBottom: 8 }}>
        <span style={{
          fontSize: 9, fontFamily: 'var(--font-display)',
          color: 'var(--text-muted)', letterSpacing: 2,
          textTransform: 'uppercase',
        }}>
          {STEP_LABELS[step - 1] || ''}
        </span>
      </div>
    </div>
  )
}
