'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'

interface FrameProgressWidgetProps {
  userId: string
}

const FRAME_ICONS: Record<string, string> = {
  crystal: '\uD83D\uDC8E',
  legend: '\uD83C\uDFC6',
  icon: '\u2B50',
  hero: '\uD83E\uDDB8',
}

function getFrameIcon(frameName: string): string {
  const lower = frameName.toLowerCase()
  for (const [key, icon] of Object.entries(FRAME_ICONS)) {
    if (lower.includes(key)) return icon
  }
  return '\uD83C\uDFC5'
}

interface FrameProgress {
  progress_pct: number
  current_value: number
  target_value: number
  condition_label: string
  frame: {
    name_de: string
    name_en: string
    prestige_condition: string
  }
}

export default function FrameProgressWidget({ userId }: FrameProgressWidgetProps) {
  const [frameData, setFrameData] = useState<FrameProgress | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function fetchProgress() {
      const { data, error } = await supabase
        .from('user_frame_progress')
        .select('*, frame:frame_id(name_de, name_en, prestige_condition)')
        .eq('user_id', userId)
        .eq('is_claimable', false)
        .order('progress_pct', { ascending: false })
        .limit(1)

      if (!error && data && data.length > 0) {
        setFrameData(data[0] as FrameProgress)
      }
      setLoading(false)
    }

    fetchProgress()
  }, [userId])

  if (loading || !frameData) return null

  const pct = Math.min(Math.round(frameData.progress_pct), 100)
  const frameName = frameData.frame.name_de || frameData.frame.name_en
  const icon = getFrameIcon(frameName)

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '12px',
        background: 'var(--bg-surface)',
        border: '1px solid var(--gold-dim, #b8860b)',
        borderRadius: 'var(--radius-lg, 12px)',
        padding: '10px 14px',
        fontFamily: 'var(--font-body, sans-serif)',
      }}
    >
      {/* Left: Icon */}
      <div
        style={{
          fontSize: '24px',
          lineHeight: 1,
          flexShrink: 0,
        }}
      >
        {icon}
      </div>

      {/* Center: Name + Bar + Label */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div
          style={{
            fontFamily: 'var(--font-display, Cinzel, serif)',
            fontSize: '11px',
            fontWeight: 700,
            color: 'var(--gold-primary, #FFB800)',
            textTransform: 'uppercase',
            letterSpacing: '1.5px',
            marginBottom: '4px',
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
          }}
        >
          {frameName}
        </div>

        {/* Progress bar */}
        <div
          style={{
            width: '100%',
            height: '6px',
            background: 'var(--bg-deepest, #111)',
            borderRadius: 'var(--radius-md, 8px)',
            overflow: 'hidden',
            marginBottom: '3px',
          }}
        >
          <div
            style={{
              width: `${pct}%`,
              height: '100%',
              background: 'linear-gradient(90deg, var(--gold-dim, #b8860b), var(--gold-primary, #FFB800))',
              borderRadius: 'var(--radius-md, 8px)',
              transition: 'width 0.4s ease',
            }}
          />
        </div>

        <div
          style={{
            fontSize: '10px',
            color: 'var(--text-muted, #888)',
            lineHeight: 1.2,
          }}
        >
          {frameData.current_value}/{frameData.target_value} {frameData.condition_label}
        </div>
      </div>

      {/* Right: Percentage */}
      <div
        style={{
          fontFamily: 'var(--font-display, Cinzel, serif)',
          fontSize: '16px',
          fontWeight: 700,
          color: 'var(--gold-primary, #FFB800)',
          flexShrink: 0,
        }}
      >
        {pct}%
      </div>
    </div>
  )
}
