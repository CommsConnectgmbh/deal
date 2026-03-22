'use client'
import React from 'react'
import CoinIcon from './CoinIcon'
import type { FrameDefinition, FrameProgress, FrameUIState } from '@/lib/frame-progress'
import { getFrameActionText, getMotivationText } from '@/lib/frame-progress'
import { useLang } from '@/contexts/LanguageContext'

const RARITY_COLORS: Record<string, string> = {
  common:    '#9ca3af',
  rare:      '#3b82f6',
  epic:      '#a855f7',
  legendary: '#f59e0b',
  founder:   '#f59e0b',
  event:     '#ec4899',
}

interface FrameShopCardProps {
  frame: FrameDefinition
  state: FrameUIState
  progress?: FrameProgress
  onAction: (frame: FrameDefinition, state: FrameUIState) => void
  loading?: boolean
}

export default function FrameShopCard({ frame, state, progress, onAction, loading }: FrameShopCardProps) {
  const { t } = useLang()
  const rarityColor = RARITY_COLORS[frame.rarity] || '#9ca3af'
  const actionText = getFrameActionText(state, frame, progress, t)
  const motivationText = getMotivationText(state, frame, progress, t)

  const isClickable = ['buyable', 'owned', 'claimable', 'not_eligible'].includes(state)
  const isDisabled = state === 'not_eligible' || state === 'founder_only' || state === 'event_expired' || state === 'locked'
  const showProgress = ['in_progress', 'event_active'].includes(state)

  return (
    <div
      onClick={() => isClickable && !loading && onAction(frame, state)}
      style={{
        background: '#111',
        borderRadius: 14,
        border: `2px solid ${state === 'equipped' ? frame.frame_color : state === 'claimable' ? '#22c55e' : isDisabled ? '#333' : frame.frame_color + '60'}`,
        padding: 14,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 8,
        cursor: isClickable && !loading ? 'pointer' : 'default',
        opacity: isDisabled && state !== 'not_eligible' ? 0.5 : 1,
        position: 'relative',
        overflow: 'hidden',
        transition: 'all 0.2s ease',
        minHeight: 165,
      }}
    >
      {/* Category badge */}
      {frame.category !== 'shop' && (
        <div style={{
          position: 'absolute', top: 6, right: 6,
          fontSize: 8, fontWeight: 700, textTransform: 'uppercase',
          letterSpacing: '0.5px',
          padding: '2px 6px', borderRadius: 4,
          background: frame.category === 'prestige' ? 'rgba(139,92,246,0.25)' : 'rgba(236,72,153,0.25)',
          color: frame.category === 'prestige' ? '#a78bfa' : '#f472b6',
        }}>
          {frame.category === 'prestige' ? 'PRESTIGE' : 'EVENT'}
        </div>
      )}

      {/* Frame icon with glow */}
      <div style={{
        width: 52, height: 52, borderRadius: '50%',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: `radial-gradient(circle, ${frame.frame_color}30 0%, transparent 70%)`,
        boxShadow: state === 'claimable' ? `0 0 20px ${frame.frame_color}80` : 'none',
        animation: state === 'claimable' ? 'pulse-glow 2s ease-in-out infinite' : 'none',
        fontSize: 28,
      }}>
        {frame.icon_emoji}
      </div>

      {/* Name */}
      <div style={{
        fontFamily: "'Oswald', sans-serif",
        fontSize: 13, fontWeight: 700,
        color: '#fff', textAlign: 'center',
        textTransform: 'uppercase',
        letterSpacing: '0.5px',
      }}>
        {frame.name_de}
      </div>

      {/* Rarity */}
      <div style={{
        fontSize: 9, fontWeight: 600,
        color: rarityColor,
        textTransform: 'uppercase',
        letterSpacing: '1px',
      }}>
        {frame.rarity}
      </div>

      {/* Progress bar */}
      {showProgress && progress && (
        <div style={{ width: '100%', marginTop: 2 }}>
          <div style={{
            width: '100%', height: 6, borderRadius: 3,
            background: 'rgba(255,255,255,0.1)',
            overflow: 'hidden',
          }}>
            <div style={{
              width: `${Math.min(100, progress.progress_pct)}%`,
              height: '100%', borderRadius: 3,
              background: `linear-gradient(90deg, ${frame.frame_color}, ${frame.frame_color}cc)`,
              transition: 'width 0.5s ease',
            }} />
          </div>
          <div style={{
            fontSize: 10, color: '#9ca3af', textAlign: 'center', marginTop: 3,
            fontFamily: "'JetBrains Mono', monospace",
          }}>
            {progress.current_value}/{progress.target_value}
          </div>
        </div>
      )}

      {/* Action button */}
      <div style={{ marginTop: 'auto', width: '100%' }}>
        {state === 'buyable' && (
          <button
            disabled={loading}
            style={{
              width: '100%', padding: '7px 0',
              background: 'linear-gradient(135deg, #FFB800, #FF8C00)',
              border: 'none', borderRadius: 8,
              fontFamily: "'Oswald', sans-serif",
              fontSize: 12, fontWeight: 700, color: '#000',
              cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4,
              opacity: loading ? 0.6 : 1,
            }}
          >
            <CoinIcon size={14} />
            {frame.coin_price}
          </button>
        )}

        {state === 'owned' && (
          <button
            style={{
              width: '100%', padding: '7px 0',
              background: 'rgba(34,197,94,0.15)',
              border: '1px solid rgba(34,197,94,0.4)',
              borderRadius: 8,
              fontFamily: "'Oswald', sans-serif",
              fontSize: 11, fontWeight: 700, color: '#22c55e',
              cursor: 'pointer',
            }}
          >
            ANWENDEN
          </button>
        )}

        {state === 'equipped' && (
          <div style={{
            width: '100%', padding: '7px 0',
            background: 'rgba(59,130,246,0.15)',
            border: '1px solid rgba(59,130,246,0.4)',
            borderRadius: 8,
            fontFamily: "'Oswald', sans-serif",
            fontSize: 11, fontWeight: 700, color: '#60a5fa',
            textAlign: 'center',
          }}>
            AUSGERÜSTET ✓
          </div>
        )}

        {state === 'claimable' && (
          <button
            disabled={loading}
            style={{
              width: '100%', padding: '7px 0',
              background: 'linear-gradient(135deg, #22c55e, #16a34a)',
              border: 'none', borderRadius: 8,
              fontFamily: "'Oswald', sans-serif",
              fontSize: 12, fontWeight: 700, color: '#fff',
              cursor: 'pointer',
              animation: 'pulse-glow 2s ease-in-out infinite',
              opacity: loading ? 0.6 : 1,
            }}
          >
            EINLÖSEN
          </button>
        )}

        {state === 'locked' && (
          <div style={{
            width: '100%', padding: '5px 0',
            textAlign: 'center',
            fontSize: 9, color: '#6b7280',
            fontFamily: "'Oswald', sans-serif",
            fontWeight: 600,
          }}>
            🔒 {actionText}
          </div>
        )}

        {state === 'in_progress' && motivationText && (
          <div style={{
            textAlign: 'center', fontSize: 9, color: '#9ca3af',
            fontStyle: 'italic', marginTop: 2,
          }}>
            {motivationText}
          </div>
        )}

        {state === 'not_eligible' && (
          <div style={{
            width: '100%', padding: '7px 0',
            background: 'rgba(255,255,255,0.05)',
            border: '1px solid rgba(255,255,255,0.1)',
            borderRadius: 8,
            fontFamily: "'Oswald', sans-serif",
            fontSize: 10, fontWeight: 600, color: '#6b7280',
            textAlign: 'center',
          }}>
            <CoinIcon size={11} /> {frame.coin_price}
          </div>
        )}

        {state === 'founder_only' && (
          <div style={{
            width: '100%', padding: '5px 0',
            textAlign: 'center',
            fontSize: 9, color: '#f59e0b',
            fontFamily: "'Oswald', sans-serif",
            fontWeight: 600,
          }}>
            👑 NUR FÜR FOUNDER
          </div>
        )}

        {state === 'event_active' && motivationText && (
          <div style={{
            textAlign: 'center', fontSize: 9, color: '#f472b6',
            fontStyle: 'italic', marginTop: 2,
          }}>
            {motivationText}
          </div>
        )}

        {state === 'event_expired' && (
          <div style={{
            width: '100%', padding: '5px 0',
            textAlign: 'center',
            fontSize: 9, color: '#6b7280',
            fontFamily: "'Oswald', sans-serif",
            fontWeight: 600,
          }}>
            EVENT VORBEI
          </div>
        )}
      </div>
    </div>
  )
}
