'use client'
import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import type { DealTemplate } from '@/lib/createDealReducer'

interface Props {
  onSelect: (template: DealTemplate) => void
  activeTemplateId?: string | null
}

export default function TemplateCarousel({ onSelect, activeTemplateId }: Props) {
  const [templates, setTemplates] = useState<DealTemplate[]>([])

  useEffect(() => {
    const load = async () => {
      const { data } = await supabase.from('deal_templates')
        .select('id, title, stake, category, icon, description, ruleset_type')
        .eq('is_system', true)
        .order('created_at')
      if (data) setTemplates(data)
    }
    load()
  }, [])

  if (templates.length === 0) return null

  return (
    <div>
      <label style={{
        display: 'block', fontSize: 10, fontFamily: 'var(--font-display)',
        letterSpacing: 2, color: 'var(--text-secondary)', marginBottom: 8,
      }}>
        SCHNELL STARTEN
      </label>
      <div style={{
        display: 'flex', gap: 8, overflowX: 'auto',
        paddingBottom: 4, scrollbarWidth: 'none',
      }}>
        {templates.map(tpl => {
          const active = activeTemplateId === tpl.id
          return (
            <button
              key={tpl.id}
              onClick={() => onSelect(tpl)}
              style={{
                flexShrink: 0,
                padding: '10px 14px',
                borderRadius: 12,
                border: active ? '1.5px solid var(--gold-primary)' : '1px solid var(--border-subtle)',
                background: active ? 'rgba(255,184,0,0.06)' : 'var(--bg-surface)',
                cursor: 'pointer',
                display: 'flex', flexDirection: 'column',
                alignItems: 'flex-start', gap: 3,
                minWidth: 120, maxWidth: 150,
                transition: 'all 0.2s ease',
              }}
            >
              <span style={{ fontSize: 18 }}>{tpl.icon}</span>
              <span style={{
                fontFamily: 'var(--font-display)', fontSize: 10,
                fontWeight: 700, letterSpacing: 0.5,
                color: active ? 'var(--gold-primary)' : 'var(--text-primary)',
                textAlign: 'left',
              }}>
                {tpl.title}
              </span>
              <span style={{
                fontSize: 9, color: 'var(--text-muted)',
                fontFamily: 'var(--font-body)',
                textAlign: 'left', lineHeight: 1.3,
                display: '-webkit-box',
                WebkitLineClamp: 2,
                WebkitBoxOrient: 'vertical',
                overflow: 'hidden',
              }}>
                {tpl.description}
              </span>
            </button>
          )
        })}
      </div>
    </div>
  )
}
