'use client'
import React, { useState, useRef, useCallback } from 'react'
import { useLang } from '@/contexts/LanguageContext'

interface Deal {
  id: string
  title: string
  stake?: string
  status: string
  creator?: { username: string } | null
  opponent?: { username: string } | null
  confirmed_winner_id?: string
  creator_id?: string
}

interface Props {
  deal: Deal
  open: boolean
  onClose: () => void
}

export default function ShareCardGenerator({ deal, open, onClose }: Props) {
  const { t } = useLang()
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [format, setFormat] = useState<'square' | 'story'>('square')
  const [generating, setGenerating] = useState(false)

  const generateCard = useCallback(async () => {
    const canvas = canvasRef.current
    if (!canvas) return null
    const ctx = canvas.getContext('2d')
    if (!ctx) return null

    const w = format === 'story' ? 540 : 600
    const h = format === 'story' ? 960 : 600
    canvas.width = w
    canvas.height = h

    // Background
    ctx.fillStyle = '#0A0A0A'
    ctx.fillRect(0, 0, w, h)

    // Gold border
    ctx.strokeStyle = '#FFB800'
    ctx.lineWidth = 3
    ctx.strokeRect(16, 16, w - 32, h - 32)

    // Inner accent line
    ctx.strokeStyle = 'rgba(255,184,0,0.2)'
    ctx.lineWidth = 1
    ctx.strokeRect(24, 24, w - 48, h - 48)

    // Logo
    ctx.font = '700 16px Cinzel, serif'
    ctx.fillStyle = '#FFB800'
    ctx.textAlign = 'center'
    ctx.fillText('DEALBUDDY', w / 2, 60)

    // VS indicator
    const vsY = format === 'story' ? 180 : 140
    ctx.font = '900 48px Cinzel, serif'
    ctx.fillStyle = '#FFB800'
    ctx.fillText('VS', w / 2, vsY)

    // Creator name
    ctx.font = '700 18px Cinzel, serif'
    ctx.fillStyle = '#F0ECE4'
    ctx.fillText(`@${deal.creator?.username || '???'}`, w / 2 - 120, vsY - 10)

    // Opponent name
    ctx.fillText(`@${deal.opponent?.username || '???'}`, w / 2 + 120, vsY - 10)

    // Divider
    const titleY = format === 'story' ? 260 : 220
    ctx.fillStyle = 'rgba(255,184,0,0.3)'
    ctx.fillRect(40, titleY - 20, w - 80, 1)

    // Title
    ctx.font = '600 22px Cinzel, serif'
    ctx.fillStyle = '#FFFFFF'
    const titleLines = wrapText(ctx, `"${deal.title}"`, w - 100)
    titleLines.forEach((line, i) => {
      ctx.fillText(line, w / 2, titleY + 10 + i * 30)
    })

    // Stake
    const stakeY = titleY + 10 + titleLines.length * 30 + 30
    if (deal.stake) {
      ctx.font = '600 16px Crimson Text, serif'
      ctx.fillStyle = '#F59E0B'
      ctx.fillText(t('components.stakeDisplay').replace('{stake}', deal.stake), w / 2, stakeY)
    }

    // Winner if completed
    if (deal.status === 'completed' && deal.confirmed_winner_id) {
      const winnerName = deal.confirmed_winner_id === deal.creator_id ? deal.creator?.username : deal.opponent?.username
      const winnerY = stakeY + 50
      ctx.font = '700 18px Cinzel, serif'
      ctx.fillStyle = '#FFB800'
      ctx.fillText(`👑 @${winnerName} gewinnt!`, w / 2, winnerY)
    }

    // Bottom: URL
    ctx.font = '400 12px Crimson Text, serif'
    ctx.fillStyle = 'rgba(240,236,228,0.3)'
    ctx.fillText('app.deal-buddy.app', w / 2, h - 40)

    return canvas
  }, [deal, format])

  const handleShare = async () => {
    setGenerating(true)
    const canvas = await generateCard()
    if (!canvas) { setGenerating(false); return }

    canvas.toBlob(async (blob) => {
      if (!blob) { setGenerating(false); return }
      const file = new File([blob], 'dealbuddy-share.png', { type: 'image/png' })

      if (navigator.share && navigator.canShare?.({ files: [file] })) {
        try {
          await navigator.share({
            title: `DealBuddy: ${deal.title}`,
            text: `⚔️ "${deal.title}" – @${deal.creator?.username} vs @${deal.opponent?.username || '???'}`,
            files: [file],
          })
        } catch { /* user cancelled */ }
      } else {
        // Fallback: download
        const url = URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url; a.download = 'dealbuddy-share.png'; a.click()
        URL.revokeObjectURL(url)
      }
      setGenerating(false)
      onClose()
    }, 'image/png')
  }

  if (!open) return null

  return (
    <div style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.9)',
      display: 'flex', alignItems: 'flex-end', zIndex: 300,
    }} onClick={onClose}>
      <div style={{
        width: '100%', maxWidth: 430, margin: '0 auto',
        background: 'var(--bg-surface)', borderRadius: '20px 20px 0 0',
        border: '1px solid var(--border-subtle)',
        padding: '20px',
      }} onClick={e => e.stopPropagation()}>

        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <span style={{ fontFamily: 'var(--font-display)', fontSize: 14, color: 'var(--text-primary)', letterSpacing: 2 }}>
            ALS BILD TEILEN
          </span>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', fontSize: 20, cursor: 'pointer' }}>✕</button>
        </div>

        {/* Format Selection */}
        <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
          {(['square', 'story'] as const).map(f => (
            <button key={f} onClick={() => setFormat(f)} style={{
              flex: 1, padding: '10px', borderRadius: 10, cursor: 'pointer',
              background: format === f ? 'rgba(255,184,0,0.12)' : 'var(--bg-deepest)',
              border: format === f ? '1px solid var(--gold-glow)' : '1px solid var(--border-subtle)',
              color: format === f ? 'var(--gold-primary)' : '#888',
              fontFamily: 'var(--font-display)', fontSize: 10, letterSpacing: 1,
            }}>
              {f === 'square' ? '◻ QUADRAT' : '▯ STORY'}
            </button>
          ))}
        </div>

        {/* Hidden canvas */}
        <canvas ref={canvasRef} style={{ display: 'none' }} />

        {/* Share button */}
        <button
          onClick={handleShare}
          disabled={generating}
          style={{
            width: '100%', padding: 16, borderRadius: 12, border: 'none', cursor: 'pointer',
            background: 'linear-gradient(135deg, var(--gold-dim), var(--gold-primary))',
            color: 'var(--text-inverse)', fontFamily: 'var(--font-display)', fontSize: 12, fontWeight: 700, letterSpacing: 2,
            marginBottom: 8,
          }}
        >
          {generating ? 'WIRD GENERIERT...' : '📸 SHARE CARD ERSTELLEN'}
        </button>

        <p style={{ fontSize: 11, color: 'var(--text-muted)', textAlign: 'center', fontFamily: 'var(--font-body)' }}>
          {t('components.shareCardDesc')}
        </p>
      </div>
    </div>
  )
}

/** Word-wrap helper for canvas */
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
