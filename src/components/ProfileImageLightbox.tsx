'use client'
import { useState, useRef, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { useAuth } from '@/contexts/AuthContext'
import { supabase } from '@/lib/supabase'
import { useLang } from '@/contexts/LanguageContext'

interface ProfileImage {
  id: string
  user_id: string
  storage_path: string
  public_url: string
  created_at: string
}

interface Props {
  open: boolean
  onClose: () => void
  images: ProfileImage[]
  onImagesChanged: () => void
  isOwnProfile?: boolean
}

export default function ProfileImageLightbox({ open, onClose, images, onImagesChanged, isOwnProfile = true }: Props) {
  const { profile, refreshProfile } = useAuth()
  const { t } = useLang()
  const [currentIndex, setCurrentIndex] = useState(0)
  const [uploading, setUploading] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [mounted, setMounted] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)
  const touchStartX = useRef(0)

  useEffect(() => { setMounted(true) }, [])

  if (!open || (images.length === 0 && !isOwnProfile)) return null
  if (!mounted) return null

  const currentImage = images[currentIndex] || null

  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartX.current = e.touches[0].clientX
  }
  const handleTouchEnd = (e: React.TouchEvent) => {
    const diff = e.changedTouches[0].clientX - touchStartX.current
    if (Math.abs(diff) > 60) {
      if (diff < 0 && currentIndex < images.length - 1) setCurrentIndex(i => i + 1)
      if (diff > 0 && currentIndex > 0) setCurrentIndex(i => i - 1)
    }
  }

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file || !profile) return

    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
      alert('Nur JPEG, PNG oder WebP erlaubt')
      return
    }
    if (file.size > 5 * 1024 * 1024) {
      alert('Maximal 5MB')
      return
    }

    setUploading(true)
    try {
      const path = `${profile.id}/${Date.now()}_${Math.random().toString(36).slice(2, 8)}.jpg`
      const { error: uploadErr } = await supabase.storage.from('profile-photos').upload(path, file, { contentType: file.type })
      if (uploadErr) throw uploadErr

      const { data: urlData } = supabase.storage.from('profile-photos').getPublicUrl(path)

      await supabase.from('profile_images').insert({
        user_id: profile.id,
        storage_path: path,
        public_url: urlData.publicUrl,
      })

      // Update avatar_url to newest image
      await supabase.from('profiles').update({ avatar_url: urlData.publicUrl }).eq('id', profile.id)
      refreshProfile()
      onImagesChanged()
      setCurrentIndex(0)
    } catch (err: any) {
      alert(err.message || 'Upload fehlgeschlagen')
    }
    setUploading(false)
    if (fileRef.current) fileRef.current.value = ''
  }

  const handleDelete = async () => {
    if (!currentImage || !profile || deleting) return
    if (!confirm('Bild wirklich l\u00F6schen?')) return

    setDeleting(true)
    try {
      await supabase.storage.from('profile-photos').remove([currentImage.storage_path])
      await supabase.from('profile_images').delete().eq('id', currentImage.id)

      const remaining = images.filter(i => i.id !== currentImage.id)
      const newAvatarUrl = remaining.length > 0 ? remaining[0].public_url : null
      await supabase.from('profiles').update({ avatar_url: newAvatarUrl }).eq('id', profile.id)
      refreshProfile()
      onImagesChanged()

      if (currentIndex >= remaining.length && remaining.length > 0) {
        setCurrentIndex(remaining.length - 1)
      }
      if (remaining.length === 0) onClose()
    } catch (err: any) {
      alert(err.message || 'L\u00F6schen fehlgeschlagen')
    }
    setDeleting(false)
  }

  // Use createPortal to render directly in document.body,
  // bypassing parent transforms that break position:fixed
  const content = (
    <div style={{
      position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh',
      zIndex: 99999, overflow: 'hidden',
      background: 'rgba(6,6,6,0.97)', backdropFilter: 'blur(20px)',
      display: 'flex', flexDirection: 'column', alignItems: 'center',
    }}>
      {/* Header */}
      <div style={{
        width: '100%', maxWidth: 430, display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        padding: '16px 20px', paddingTop: 'max(16px, env(safe-area-inset-top))',
        flexShrink: 0, zIndex: 2,
      }}>
        <button onClick={onClose} style={{
          background: 'rgba(255,255,255,0.1)', border: 'none', borderRadius: '50%',
          width: 40, height: 40, display: 'flex', alignItems: 'center', justifyContent: 'center',
          cursor: 'pointer', color: '#fff', fontSize: 18,
        }}>{'\u2715'}</button>
        {images.length > 0 && (
          <span style={{ color: 'rgba(255,255,255,0.6)', fontSize: 13, fontFamily: 'Cinzel,serif' }}>
            {currentIndex + 1} / {images.length}
          </span>
        )}
        <div style={{ width: 40 }} />
      </div>

      {/* Image */}
      {currentImage ? (
        <div
          onTouchStart={handleTouchStart}
          onTouchEnd={handleTouchEnd}
          style={{
            flex: 1, width: '100%', maxWidth: 430,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            padding: '16px', overflow: 'hidden',
          }}
        >
          <div style={{
            background: '#1a1a1a', borderRadius: 14, padding: 4,
            border: '1px solid rgba(255,184,0,0.25)',
            boxShadow: '0 0 30px rgba(255,184,0,0.08), 0 8px 32px rgba(0,0,0,0.6)',
            maxHeight: '100%', display: 'flex',
          }}>
            <img
              src={currentImage.public_url}
              alt="Profile"
              loading="lazy"
              style={{
                maxWidth: '100%', maxHeight: 'calc(100vh - 220px)', borderRadius: 10,
                objectFit: 'contain', display: 'block',
              }}
            />
          </div>
        </div>
      ) : (
        <div style={{
          flex: 1, display: 'flex', flexDirection: 'column',
          alignItems: 'center', justifyContent: 'center', gap: 16,
        }}>
          <div style={{ fontSize: 48, opacity: 0.3 }}>{'\u{1F4F7}'}</div>
          <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: 14 }}>{t('components.noImages')}</p>
        </div>
      )}

      {/* Dots */}
      {images.length > 1 && (
        <div style={{ display: 'flex', gap: 8, marginBottom: 8, flexShrink: 0 }}>
          {images.map((_, i) => (
            <div key={i} onClick={() => setCurrentIndex(i)} style={{
              width: 8, height: 8, borderRadius: 4, cursor: 'pointer',
              background: i === currentIndex ? '#FFB800' : 'rgba(255,255,255,0.25)',
              transition: 'background 0.2s',
            }} />
          ))}
        </div>
      )}

      {/* Actions (own profile only) */}
      {isOwnProfile && (
        <div style={{
          width: '100%', maxWidth: 430,
          display: 'flex', gap: 12, padding: '12px 20px',
          paddingBottom: 'max(16px, env(safe-area-inset-bottom))',
          flexShrink: 0,
        }}>
          {currentImage && (
            <button onClick={handleDelete} disabled={deleting} style={{
              flex: 1, padding: '14px', borderRadius: 12,
              background: 'rgba(239,68,68,0.15)', border: '1px solid rgba(239,68,68,0.3)',
              color: '#EF4444', fontSize: 12, fontFamily: 'Cinzel,serif',
              fontWeight: 700, letterSpacing: 1, cursor: 'pointer',
            }}>{deleting ? '...' : 'L\u00D6SCHEN'}</button>
          )}
          {images.length < 3 && (
            <button onClick={() => fileRef.current?.click()} disabled={uploading} style={{
              flex: 1, padding: '14px', borderRadius: 12,
              background: '#FFB800', border: 'none',
              color: '#060606', fontSize: 12, fontFamily: 'Cinzel,serif',
              fontWeight: 700, letterSpacing: 1, cursor: 'pointer',
            }}>{uploading ? 'L\u00C4DT...' : 'NEUES BILD'}</button>
          )}
          <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp" onChange={handleUpload} style={{ display: 'none' }} />
        </div>
      )}
    </div>
  )

  return createPortal(content, document.body)
}
