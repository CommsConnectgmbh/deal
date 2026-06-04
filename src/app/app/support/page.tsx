'use client'

import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import SupportCenter from '@/components/support/SupportCenter'

export default function SupportPage() {
  const router = useRouter()
  return (
    <div style={{ minHeight: '100dvh', paddingBottom: 96 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '16px 20px' }}>
        <button
          onClick={() => router.back()}
          aria-label="Zurück"
          style={{
            width: 36, height: 36, borderRadius: '50%', border: '1px solid var(--border-subtle)',
            background: 'transparent', color: 'var(--text-primary)', cursor: 'pointer', fontSize: 18,
          }}
        >
          ‹
        </button>
        <h1 className="font-display" style={{ fontSize: 20, color: 'var(--text-primary)' }}>Hilfe &amp; Support</h1>
      </div>
      <div style={{ padding: '0 16px' }}>
        {supabase ? (
          <SupportCenter
            supabase={supabase}
            appLabel="DealBuddy"
            brandColor="#f59e0b"
            context={{ platform: 'web', app: 'dealbuddy' }}
          />
        ) : (
          <p style={{ color: 'var(--text-secondary)', padding: 20 }}>Support ist gerade nicht verfügbar.</p>
        )}
      </div>
    </div>
  )
}
