'use client'
import { useState, useRef, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { useLang } from '@/contexts/LanguageContext'
import { useAuth } from '@/contexts/AuthContext'

interface DealCardMenuProps {
  dealId: string
  onHide?: () => void
}

const REPORT_REASONS = [
  { key: 'spam', tKey: 'menu.reasonSpam' },
  { key: 'offensive', tKey: 'menu.reasonOffensive' },
  { key: 'fraud', tKey: 'menu.reasonFraud' },
  { key: 'other', tKey: 'menu.reasonOther' },
]

export default function DealCardMenu({ dealId, onHide }: DealCardMenuProps) {
  const { t } = useLang()
  const { user } = useAuth()
  const [open, setOpen] = useState(false)
  const [showReasons, setShowReasons] = useState(false)
  const [toast, setToast] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)

  // Close on click outside
  useEffect(() => {
    if (!open) return
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setOpen(false)
        setShowReasons(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [open])

  // Auto-hide toast
  useEffect(() => {
    if (!toast) return
    const timer = setTimeout(() => setToast(null), 2500)
    return () => clearTimeout(timer)
  }, [toast])

  const handleHide = async (e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    if (!user || loading) return
    setLoading(true)
    try {
      const { error } = await supabase
        .from('hidden_deals')
        .upsert({ user_id: user.id, deal_id: dealId, hidden_at: new Date().toISOString() })
      if (error) throw error
      setToast(t('menu.hidden'))
      setOpen(false)
      setShowReasons(false)
      onHide?.()
    } catch {
      setToast('Error')
    } finally {
      setLoading(false)
    }
  }

  const handleReport = async (e: React.MouseEvent, reason: string) => {
    e.preventDefault()
    e.stopPropagation()
    if (!user || loading) return
    setLoading(true)
    try {
      // Insert into deal_reports
      const { error } = await supabase
        .from('deal_reports')
        .insert({ deal_id: dealId, reporter_id: user.id, reason })
      if (error) throw error

      // Send email via API route
      await fetch('/api/report-deal', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ dealId, reason, reporterId: user.id }),
      })

      setToast(t('menu.reportSent'))
      setOpen(false)
      setShowReasons(false)
    } catch {
      setToast('Error')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div ref={menuRef} style={{ position: 'relative', zIndex: 10 }}>
      {/* 3-dot button */}
      <button
        onClick={(e) => {
          e.preventDefault()
          e.stopPropagation()
          setOpen(!open)
          setShowReasons(false)
        }}
        style={{
          background: 'transparent',
          border: 'none',
          width: 28,
          height: 28,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          cursor: 'pointer',
          padding: 0,
          color: 'var(--text-secondary)',
          fontSize: 20,
          fontWeight: 900,
          lineHeight: 1,
          letterSpacing: 1,
        }}
        aria-label="Menu"
      >
        {'\u22EE'}
      </button>

      {/* Dropdown */}
      {open && (
        <div style={{
          position: 'absolute',
          top: 32,
          right: 0,
          background: 'var(--bg-elevated)',
          border: '1px solid var(--border-subtle)',
          borderRadius: 10,
          boxShadow: '0 4px 20px rgba(0,0,0,0.12)',
          minWidth: showReasons ? 180 : 150,
          overflow: 'hidden',
          zIndex: 20,
        }}>
          {!showReasons ? (
            <>
              {/* Hide option */}
              <button
                onClick={handleHide}
                style={{
                  width: '100%',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  padding: '10px 14px',
                  background: 'transparent',
                  border: 'none',
                  borderBottom: '1px solid var(--border-subtle)',
                  cursor: 'pointer',
                  color: 'var(--text-primary)',
                  fontFamily: 'var(--font-body)',
                  fontSize: 13,
                  textAlign: 'left',
                }}
              >
                {/* Eye-slash icon (SVG) */}
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94" />
                  <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19" />
                  <path d="M14.12 14.12a3 3 0 1 1-4.24-4.24" />
                  <line x1="1" y1="1" x2="23" y2="23" />
                </svg>
                {t('menu.hide')}
              </button>

              {/* Report option */}
              <button
                onClick={(e) => {
                  e.preventDefault()
                  e.stopPropagation()
                  setShowReasons(true)
                }}
                style={{
                  width: '100%',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  padding: '10px 14px',
                  background: 'transparent',
                  border: 'none',
                  cursor: 'pointer',
                  color: '#ef4444',
                  fontFamily: 'var(--font-body)',
                  fontSize: 13,
                  textAlign: 'left',
                }}
              >
                {/* Flag icon (SVG) */}
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z" />
                  <line x1="4" y1="22" x2="4" y2="15" />
                </svg>
                {t('menu.report')}
              </button>
            </>
          ) : (
            <>
              {/* Reason picker header */}
              <div style={{
                padding: '8px 14px',
                borderBottom: '1px solid var(--border-subtle)',
                color: 'var(--text-muted)',
                fontFamily: 'var(--font-body)',
                fontSize: 11,
                fontWeight: 600,
              }}>
                {t('menu.reportReason')}
              </div>

              {/* Reason buttons */}
              {REPORT_REASONS.map((reason) => (
                <button
                  key={reason.key}
                  onClick={(e) => handleReport(e, reason.key)}
                  disabled={loading}
                  style={{
                    width: '100%',
                    display: 'block',
                    padding: '9px 14px',
                    background: 'transparent',
                    border: 'none',
                    borderBottom: '1px solid var(--border-subtle)',
                    cursor: loading ? 'wait' : 'pointer',
                    color: 'var(--text-primary)',
                    fontFamily: 'var(--font-body)',
                    fontSize: 12,
                    textAlign: 'left',
                    opacity: loading ? 0.5 : 1,
                  }}
                >
                  {t(reason.tKey)}
                </button>
              ))}

              {/* Cancel */}
              <button
                onClick={(e) => {
                  e.preventDefault()
                  e.stopPropagation()
                  setShowReasons(false)
                }}
                style={{
                  width: '100%',
                  padding: '9px 14px',
                  background: 'transparent',
                  border: 'none',
                  cursor: 'pointer',
                  color: 'var(--text-muted)',
                  fontFamily: 'var(--font-body)',
                  fontSize: 12,
                  textAlign: 'center',
                }}
              >
                {t('menu.cancel')}
              </button>
            </>
          )}
        </div>
      )}

      {/* Toast */}
      {toast && (
        <div style={{
          position: 'fixed',
          bottom: 80,
          left: '50%',
          transform: 'translateX(-50%)',
          background: 'var(--bg-elevated)',
          border: '1px solid var(--gold-glow)',
          color: 'var(--gold-primary)',
          fontFamily: 'var(--font-body)',
          fontSize: 13,
          fontWeight: 600,
          padding: '10px 20px',
          borderRadius: 10,
          boxShadow: '0 4px 20px rgba(0,0,0,0.15)',
          zIndex: 9999,
          whiteSpace: 'nowrap',
        }}>
          {toast}
        </div>
      )}
    </div>
  )
}
