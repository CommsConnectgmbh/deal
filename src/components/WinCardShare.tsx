'use client'
import React, { useRef, useEffect, useState, useCallback } from 'react'
import { useLang } from '@/contexts/LanguageContext'

interface WinCardShareProps {
  open: boolean
  onClose: () => void
  dealTitle: string
  stake: string
  winner: { username: string; display_name: string; avatar_url?: string }
  loser: { username: string; display_name: string; avatar_url?: string }
  dealId: string
}

/** Word-wrap helper for canvas text */
function wrapText(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string[] {
  const words = text.split(' ')
  const lines: string[] = []
  let line = ''
  for (const word of words) {
    const test = line + (line ? ' ' : '') + word
    if (ctx.measureText(test).width > maxWidth && line) {
      lines.push(line)
      line = word
    } else {
      line = test
    }
  }
  if (line) lines.push(line)
  return lines.length > 0 ? lines : [text]
}

export default function WinCardShare({ open, onClose, dealTitle, stake, winner, loser, dealId }: WinCardShareProps) {
  const { t } = useLang()
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [sharing, setSharing] = useState(false)

  const renderCanvas = useCallback(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const W = 1080
    const H = 1920
    canvas.width = W
    canvas.height = H

    // Background gradient
    const grad = ctx.createLinearGradient(0, 0, 0, H)
    grad.addColorStop(0, '#0A0A0A')
    grad.addColorStop(0.5, '#141414')
    grad.addColorStop(1, '#1A1A1A')
    ctx.fillStyle = grad
    ctx.fillRect(0, 0, W, H)

    // Subtle gold radial glow behind crown area
    const glow = ctx.createRadialGradient(W / 2, 380, 50, W / 2, 380, 500)
    glow.addColorStop(0, 'rgba(255,184,0,0.08)')
    glow.addColorStop(1, 'rgba(255,184,0,0)')
    ctx.fillStyle = glow
    ctx.fillRect(0, 0, W, H)

    // Gold border
    ctx.strokeStyle = '#FFB800'
    ctx.lineWidth = 4
    ctx.strokeRect(40, 40, W - 80, H - 80)

    // Inner accent border
    ctx.strokeStyle = 'rgba(255,184,0,0.15)'
    ctx.lineWidth = 1
    ctx.strokeRect(56, 56, W - 112, H - 112)

    ctx.textAlign = 'center'

    // DealBuddy logo at very top
    ctx.font = '700 36px Cinzel, serif'
    ctx.fillStyle = 'rgba(255,184,0,0.5)'
    ctx.fillText('DEALBUDDY', W / 2, 140)

    // Crown emoji
    ctx.font = '160px serif'
    ctx.fillText('\uD83D\uDC51', W / 2, 420)

    // "GEWONNEN!" text
    ctx.font = '900 120px Cinzel, serif'
    ctx.fillStyle = '#FFB800'
    ctx.fillText(t('components.winCardWon'), W / 2, 600)

    // Gold decorative line
    ctx.fillStyle = 'rgba(255,184,0,0.4)'
    ctx.fillRect(W / 2 - 200, 640, 400, 3)

    // Winner name (large)
    ctx.font = '700 72px Cinzel, serif'
    ctx.fillStyle = '#FFFFFF'
    ctx.fillText(`@${winner.username}`, W / 2, 760)

    // Winner display name (subtitle)
    if (winner.display_name && winner.display_name !== winner.username) {
      ctx.font = '400 36px Crimson Text, serif'
      ctx.fillStyle = 'rgba(240,236,228,0.6)'
      ctx.fillText(winner.display_name, W / 2, 810)
    }

    // "vs" text
    ctx.font = '400 48px Crimson Text, serif'
    ctx.fillStyle = 'rgba(255,184,0,0.5)'
    ctx.fillText('vs', W / 2, 900)

    // Loser name (dimmed, smaller)
    ctx.font = '600 48px Cinzel, serif'
    ctx.fillStyle = 'rgba(240,236,228,0.35)'
    ctx.fillText(`@${loser.username}`, W / 2, 980)

    // Divider
    ctx.fillStyle = 'rgba(255,184,0,0.2)'
    ctx.fillRect(100, 1050, W - 200, 2)

    // Deal title
    ctx.font = '600 48px Cinzel, serif'
    ctx.fillStyle = '#F0ECE4'
    const titleLines = wrapText(ctx, `\u201E${dealTitle}\u201C`, W - 200)
    titleLines.forEach((line, i) => {
      ctx.fillText(line, W / 2, 1140 + i * 64)
    })

    // Stake
    const stakeY = 1140 + titleLines.length * 64 + 60
    if (stake) {
      ctx.font = '600 40px Crimson Text, serif'
      ctx.fillStyle = '#F59E0B'
      ctx.fillText(`\uD83C\uDFAF ${t('components.stakeDisplay').replace('{stake}', stake)}`, W / 2, stakeY)
    }

    // Bottom section
    // CTA text
    ctx.font = '600 36px Crimson Text, serif'
    ctx.fillStyle = 'rgba(255,184,0,0.7)'
    ctx.fillText(t('components.challengeFriends'), W / 2, H - 280)

    // Decorative line
    ctx.fillStyle = 'rgba(255,184,0,0.2)'
    ctx.fillRect(W / 2 - 150, H - 240, 300, 2)

    // URL
    ctx.font = '400 32px Crimson Text, serif'
    ctx.fillStyle = 'rgba(240,236,228,0.4)'
    ctx.fillText('app.deal-buddy.app', W / 2, H - 190)

    // DealBuddy logo text at bottom
    ctx.font = '700 28px Cinzel, serif'
    ctx.fillStyle = 'rgba(255,184,0,0.3)'
    ctx.fillText('DEALBUDDY', W / 2, H - 120)

    // Generate preview
    setPreviewUrl(canvas.toDataURL('image/png'))
  }, [dealTitle, stake, winner, loser, t])

  useEffect(() => {
    if (open) {
      // Small delay to ensure canvas is in DOM
      const t = setTimeout(renderCanvas, 50)
      return () => clearTimeout(t)
    } else {
      setPreviewUrl(null)
    }
  }, [open, renderCanvas])

  const handleShare = useCallback(async () => {
    const canvas = canvasRef.current
    if (!canvas) return
    setSharing(true)
    try {
      const blob = await new Promise<Blob | null>(resolve => canvas.toBlob(resolve, 'image/png'))
      if (!blob) return
      const file = new File([blob], `dealbuddy-win-${dealId}.png`, { type: 'image/png' })
      if (navigator.share && navigator.canShare?.({ files: [file] })) {
        await navigator.share({ files: [file], title: 'DealBuddy Win' })
      }
    } catch { /* user cancelled or share unavailable */ }
    setSharing(false)
  }, [dealId])

  const handleSave = useCallback(async () => {
    const canvas = canvasRef.current
    if (!canvas) return
    const blob = await new Promise<Blob | null>(resolve => canvas.toBlob(resolve, 'image/png'))
    if (!blob) return
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `dealbuddy-win-${dealId}.png`
    a.click()
    URL.revokeObjectURL(url)
  }, [dealId])

  if (!open) return null

  return (
    <div
      style={{
        position: 'fixed', inset: 0, zIndex: 300,
        background: 'rgba(0,0,0,0.95)',
        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
      }}
      onClick={onClose}
    >
      <div
        style={{ width: '100%', maxWidth: 430, padding: '16px 20px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16 }}
        onClick={e => e.stopPropagation()}
      >
        {/* Hidden canvas */}
        <canvas ref={canvasRef} style={{ display: 'none' }} />

        {/* Preview image */}
        {previewUrl && (
          <img
            src={previewUrl}
            alt="Win Card Preview"
            style={{ width: '100%', maxHeight: '60vh', objectFit: 'contain', borderRadius: 12, border: '1px solid rgba(255,184,0,0.2)' }}
          />
        )}

        {/* Buttons */}
        <div style={{ display: 'flex', gap: 10, width: '100%' }}>
          <button
            onClick={handleShare}
            disabled={sharing}
            style={{
              flex: 1, padding: '16px 12px', borderRadius: 12, border: 'none', cursor: 'pointer',
              background: 'linear-gradient(135deg, var(--gold-dim), var(--gold-primary))',
              color: 'var(--text-inverse)', fontFamily: 'var(--font-display)', fontSize: 11, fontWeight: 700, letterSpacing: 2,
            }}
          >
            {sharing ? '...' : t('components.winCardShare')}
          </button>
          <button
            onClick={handleSave}
            style={{
              flex: 1, padding: '16px 12px', borderRadius: 12, cursor: 'pointer',
              background: 'var(--bg-surface)',
              color: 'var(--gold-primary)', fontFamily: 'var(--font-display)', fontSize: 11, fontWeight: 700, letterSpacing: 2,
              border: '1px solid var(--border-subtle)',
            }}
          >
            {t('components.winCardSave')}
          </button>
        </div>

        {/* Social share row */}
        <div style={{ display: 'flex', gap: 10, width: '100%' }}>
          {/* WhatsApp */}
          <button
            onClick={async () => {
              // Save image first, then open WhatsApp with link
              handleSave()
              const text = `🏆 Ich hab gewonnen! @${winner.username} vs @${loser.username} – "${dealTitle}" auf DealBuddy!\nhttps://app.deal-buddy.app/deal/${dealId}`
              window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank')
            }}
            style={{
              flex: 1, padding: '12px', borderRadius: 12, cursor: 'pointer', border: 'none',
              background: 'linear-gradient(135deg, #128C7E, #25D366)',
              color: '#fff', fontFamily: 'var(--font-display)', fontSize: 10, fontWeight: 700, letterSpacing: 1,
            }}
          >
            💬 WHATSAPP
          </button>
          {/* Instagram hint */}
          <button
            onClick={() => {
              handleSave()
              alert(t('components.winCardInstagramHint'))
            }}
            style={{
              flex: 1, padding: '12px', borderRadius: 12, cursor: 'pointer', border: 'none',
              background: 'linear-gradient(135deg, #833AB4, #E1306C, #F77737)',
              color: '#fff', fontFamily: 'var(--font-display)', fontSize: 10, fontWeight: 700, letterSpacing: 1,
            }}
          >
            📸 INSTAGRAM
          </button>
        </div>

        <button
          onClick={onClose}
          style={{
            width: '100%', padding: '14px', borderRadius: 12, cursor: 'pointer',
            background: 'none', border: '1px solid var(--border-subtle)',
            color: 'var(--text-muted)', fontFamily: 'var(--font-display)', fontSize: 11, fontWeight: 700, letterSpacing: 2,
          }}
        >
          {t('components.winCardClose')}
        </button>
      </div>
    </div>
  )
}
