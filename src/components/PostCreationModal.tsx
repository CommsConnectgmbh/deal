'use client'
import { useState, useRef, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { useAuth } from '@/contexts/AuthContext'
import { supabase } from '@/lib/supabase'
import MediaEditor from '@/components/MediaEditor'
import { useLang } from '@/contexts/LanguageContext'

interface Props {
  open: boolean
  onClose: () => void
  onPostCreated: () => void
}

interface DealItem {
  id: string
  title: string
  stake: string | null
  status: string
  created_at: string
}

export default function PostCreationModal({ open, onClose, onPostCreated }: Props) {
  const { profile } = useAuth()
  const [postType, setPostType] = useState<'photo' | 'video' | 'deal'>('photo')
  const [file, setFile] = useState<File | null>(null)
  const [filePreview, setFilePreview] = useState<string | null>(null)
  const [caption, setCaption] = useState('')
  const [selectedDeal, setSelectedDeal] = useState<DealItem | null>(null)
  const [deals, setDeals] = useState<DealItem[]>([])
  const [dealsLoaded, setDealsLoaded] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [mounted, setMounted] = useState(false)
  const [showEditor, setShowEditor] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)
  const { t } = useLang()

  useEffect(() => { setMounted(true) }, [])

  if (!open || !mounted) return null

  const loadDeals = async () => {
    if (dealsLoaded || !profile) return
    const { data } = await supabase
      .from('challenges')
      .select('id, title, stake, status, created_at')
      .or(`creator_id.eq.${profile.id},opponent_id.eq.${profile.id}`)
      .order('created_at', { ascending: false })
      .limit(20)
    setDeals((data as DealItem[]) || [])
    setDealsLoaded(true)
  }

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0]
    if (!f) return

    // Validate
    if (postType === 'photo') {
      if (!['image/jpeg', 'image/png', 'image/webp'].includes(f.type)) { alert('Nur JPEG, PNG oder WebP'); return }
      if (f.size > 10 * 1024 * 1024) { alert('Max 10MB'); return }
    }
    if (postType === 'video') {
      if (!f.type.startsWith('video/')) { alert('Nur Videos'); return }
      if (f.size > 20 * 1024 * 1024) { alert('Max 20 MB'); return }
    }

    setFile(f)
    setFilePreview(URL.createObjectURL(f))
  }

  const handleSubmit = async () => {
    if (!profile || submitting) return
    if (postType !== 'deal' && !file) { alert('Bitte w\u00E4hle eine Datei'); return }
    if (postType === 'deal' && !selectedDeal) { alert('Bitte w\u00E4hle einen Deal'); return }

    setSubmitting(true)
    try {
      let mediaUrl: string | null = null
      let mediaType: string | null = null

      if (file) {
        const ext = file.name.split('.').pop() || 'jpg'
        const path = `posts/${profile.id}/${Date.now()}.${ext}`
        const { error } = await supabase.storage.from('deal-media').upload(path, file, { contentType: file.type })
        if (error) throw error
        const { data: urlData } = supabase.storage.from('deal-media').getPublicUrl(path)
        mediaUrl = urlData.publicUrl
        mediaType = postType === 'video' ? 'video' : 'image'
      }

      const { data: newPost } = await supabase.from('profile_posts').insert({
        user_id: profile.id,
        post_type: postType,
        media_url: mediaUrl,
        media_type: mediaType,
        caption: caption.trim() || null,
        deal_id: selectedDeal?.id || null,
        is_public: true,
      }).select('id').single()

      // Insert feed event
      if (newPost) {
        await supabase.from('feed_events').insert({
          event_type: 'profile_post',
          user_id: profile.id,
          metadata: { post_id: newPost.id, post_type: postType },
        })
      }

      // Reset and close
      setFile(null); setFilePreview(null); setCaption(''); setSelectedDeal(null)
      onPostCreated()
      onClose()
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Fehler beim Posten'
      alert(message)
    }
    setSubmitting(false)
  }

  const content = (
    <div style={{ position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh', zIndex: 99997 }}>
      <div onClick={onClose} style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', background: 'rgba(0,0,0,0.6)' }} />
      <div style={{
        position: 'absolute', bottom: 0, left: 0, right: 0,
        maxWidth: 430, margin: '0 auto',
        background: 'var(--bg-elevated)', borderRadius: '20px 20px 0 0',
        maxHeight: '85vh', overflow: 'auto',
        paddingBottom: 'max(20px, env(safe-area-inset-bottom))',
      }}>
        {/* Handle bar */}
        <div style={{ display: 'flex', justifyContent: 'center', padding: '12px 0 8px' }}>
          <div style={{ width: 36, height: 4, borderRadius: 2, background: 'var(--border-strong)' }} />
        </div>

        <div style={{ padding: '0 20px 20px' }}>
          <p className="font-display" style={{ fontSize: 16, letterSpacing: 2, color: 'var(--text-primary)', marginBottom: 20, textAlign: 'center' }}>NEUER BEITRAG</p>

          {/* Type selector */}
          <div style={{ display: 'flex', gap: 8, marginBottom: 20 }}>
            {([
              { key: 'photo' as const, label: 'FOTO', icon: '\uD83D\uDCF7' },
              { key: 'video' as const, label: 'VIDEO', icon: '\uD83C\uDFA5' },
              { key: 'deal' as const, label: 'DEAL', icon: '\u2694\uFE0F' },
            ]).map(t => (
              <button key={t.key} onClick={() => { setPostType(t.key); if (t.key === 'deal') loadDeals(); setFile(null); setFilePreview(null); setSelectedDeal(null) }} style={{
                flex: 1, padding: '12px 8px', borderRadius: 10, cursor: 'pointer',
                background: postType === t.key ? 'var(--gold-subtle)' : 'var(--bg-surface)',
                border: `1px solid ${postType === t.key ? 'var(--gold-primary)' : 'var(--border-subtle)'}`,
                color: postType === t.key ? 'var(--gold-primary)' : 'var(--text-secondary)',
                fontFamily: 'var(--font-display)', fontSize: 10, letterSpacing: 1,
                display: 'flex', flexDirection: 'column' as const, alignItems: 'center', gap: 6,
              }}>
                <span style={{ fontSize: 20 }}>{t.icon}</span>
                {t.label}
              </button>
            ))}
          </div>

          {/* File picker for photo/video */}
          {postType !== 'deal' && (
            <div style={{ marginBottom: 16 }}>
              {filePreview ? (
                <div style={{ position: 'relative', borderRadius: 12, overflow: 'hidden', marginBottom: 8 }}>
                  {postType === 'video' ? (
                    <video src={filePreview} controls style={{ width: '100%', maxHeight: 200, objectFit: 'cover' }} />
                  ) : (
                    <img src={filePreview} alt="" style={{ width: '100%', maxHeight: 200, objectFit: 'cover' }} />
                  )}
                  <button onClick={() => { setFile(null); setFilePreview(null) }} style={{
                    position: 'absolute', top: 8, right: 8, width: 28, height: 28, borderRadius: 14,
                    background: 'rgba(0,0,0,0.6)', border: 'none', color: 'var(--text-inverse)', cursor: 'pointer', fontSize: 14,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}>{'\u2715'}</button>
                  <button onClick={() => setShowEditor(true)} style={{
                    position: 'absolute', top: 8, right: 44, height: 28, borderRadius: 14,
                    paddingLeft: 10, paddingRight: 10,
                    background: 'rgba(255,184,0,0.85)', border: 'none',
                    color: '#060606', fontSize: 10, fontWeight: 800,
                    fontFamily: 'var(--font-display)', letterSpacing: 1,
                    cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4,
                  }}>{'\u270F\uFE0F'} {t('editor.editMedia')}</button>
                </div>
              ) : (
                <button onClick={() => fileRef.current?.click()} style={{
                  width: '100%', padding: '32px', borderRadius: 12, cursor: 'pointer',
                  background: 'var(--bg-surface)', border: '2px dashed var(--border-default)',
                  color: 'var(--text-muted)', fontSize: 13, textAlign: 'center' as const,
                }}>
                  <div style={{ fontSize: 32, marginBottom: 8, opacity: 0.5 }}>{postType === 'video' ? '\uD83C\uDFA5' : '\uD83D\uDCF7'}</div>
                  {postType === 'video' ? 'Video auswählen (max 90s, 20 MB)' : 'Foto auswählen (max 10 MB)'}
                </button>
              )}
              <input ref={fileRef} type="file" accept={postType === 'video' ? 'video/mp4,video/quicktime,video/webm' : 'image/jpeg,image/png,image/webp'} onChange={handleFileSelect} style={{ display: 'none' }} />
            </div>
          )}

          {/* Deal selector */}
          {postType === 'deal' && (
            <div style={{ marginBottom: 16, maxHeight: 200, overflow: 'auto' }}>
              {deals.length === 0 ? (
                <p style={{ color: 'var(--text-muted)', fontSize: 13, textAlign: 'center', padding: 16 }}>Keine Deals vorhanden</p>
              ) : deals.map(d => (
                <button key={d.id} onClick={() => setSelectedDeal(d)} style={{
                  width: '100%', padding: '12px', marginBottom: 4, borderRadius: 8, cursor: 'pointer',
                  background: selectedDeal?.id === d.id ? 'var(--gold-subtle)' : 'var(--bg-surface)',
                  border: `1px solid ${selectedDeal?.id === d.id ? 'var(--gold-primary)' : 'var(--border-subtle)'}`,
                  color: 'var(--text-primary)', textAlign: 'left' as const, fontSize: 13,
                }}>
                  <strong>{d.title}</strong>
                  <span style={{ color: 'var(--text-muted)', marginLeft: 8, fontSize: 11 }}>{d.status}</span>
                </button>
              ))}
            </div>
          )}

          {/* Caption */}
          <textarea
            value={caption}
            onChange={e => setCaption(e.target.value.slice(0, 500))}
            placeholder="Caption hinzuf\u00FCgen... (optional)"
            style={{
              width: '100%', padding: '12px 14px', borderRadius: 12,
              background: 'var(--bg-surface)', border: '1px solid var(--border-default)',
              color: 'var(--text-primary)', fontSize: 13, outline: 'none',
              minHeight: 80, resize: 'none', fontFamily: 'inherit',
              boxSizing: 'border-box' as const,
            }}
          />
          <p style={{ fontSize: 10, color: 'var(--text-muted)', textAlign: 'right', marginTop: 4 }}>{caption.length}/500</p>

          {/* Submit */}
          <button onClick={handleSubmit} disabled={submitting} style={{
            width: '100%', padding: '16px', borderRadius: 12, border: 'none',
            background: 'var(--gold-primary)', color: 'var(--text-inverse)',
            fontFamily: 'var(--font-display)', fontSize: 13, fontWeight: 700,
            letterSpacing: 2, cursor: submitting ? 'default' : 'pointer',
            opacity: submitting ? 0.6 : 1, marginTop: 16,
          }}>{submitting ? 'WIRD GEPOSTET...' : 'POSTEN'}</button>
        </div>
      </div>
    </div>
  )

  return createPortal(
    <>
      {content}
      {showEditor && file && (
        <MediaEditor
          file={file}
          onDone={(editedFile, editedPreview) => {
            setFile(editedFile)
            setFilePreview(editedPreview)
            setShowEditor(false)
          }}
          onCancel={() => setShowEditor(false)}
        />
      )}
    </>,
    document.body
  )
}
