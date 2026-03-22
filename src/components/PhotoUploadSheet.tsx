'use client'
import React, { useState, useEffect, useRef, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/contexts/AuthContext'
import { useLang } from '@/contexts/LanguageContext'

interface Props {
  open: boolean
  onClose: () => void
  onPhotoChanged?: () => void
}

interface PhotoSlot {
  id?: string
  url: string
  storagePath: string
  isActive: boolean
  slotIndex: number
}

/** Compress image client-side via canvas → always JPEG, max 800px */
async function compressImage(file: File, maxSize = 800, quality = 0.88): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => {
      const canvas = document.createElement('canvas')
      let w = img.width, h = img.height
      if (w > h) { if (w > maxSize) { h = Math.round(h * maxSize / w); w = maxSize } }
      else       { if (h > maxSize) { w = Math.round(w * maxSize / h); h = maxSize } }
      canvas.width = w
      canvas.height = h
      const ctx = canvas.getContext('2d')!
      ctx.drawImage(img, 0, 0, w, h)
      canvas.toBlob(
        blob => blob ? resolve(blob) : reject(new Error('Compression failed')),
        'image/jpeg',
        quality,
      )
    }
    img.onerror = () => reject(new Error('Image load failed'))
    img.src = URL.createObjectURL(file)
  })
}

export default function PhotoUploadSheet({ open, onClose, onPhotoChanged }: Props) {
  const { profile, refreshProfile } = useAuth()
  const { t } = useLang()
  const [slots, setSlots] = useState<(PhotoSlot | null)[]>([null, null])
  const [uploading, setUploading] = useState(false)
  const [progress, setProgress] = useState(0)
  const [menuSlot, setMenuSlot] = useState<number | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)
  const targetSlot = useRef<number>(1)

  // Load existing photos
  const loadPhotos = useCallback(async () => {
    if (!profile) return
    const { data } = await supabase
      .from('profile_photos')
      .select('*')
      .eq('user_id', profile.id)
      .order('slot_index')

    const newSlots: (PhotoSlot | null)[] = [null, null]
    if (data) {
      for (const row of data) {
        const idx = row.slot_index - 1
        if (idx === 0 || idx === 1) {
          const { data: urlData } = supabase.storage.from('profile-photos').getPublicUrl(row.storage_path)
          newSlots[idx] = {
            id: row.id,
            url: urlData.publicUrl + '?t=' + Date.now(),
            storagePath: row.storage_path,
            isActive: row.is_active,
            slotIndex: row.slot_index,
          }
        }
      }
    }
    setSlots(newSlots)
  }, [profile])

  useEffect(() => {
    if (open) loadPhotos()
  }, [open, loadPhotos])

  // Trigger file picker for a slot
  const pickFile = (slotIndex: number) => {
    targetSlot.current = slotIndex
    setMenuSlot(null)
    fileRef.current?.click()
  }

  // Handle file selected
  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file || !profile) return
    e.target.value = '' // reset

    if (!file.type.startsWith('image/')) return
    if (file.size > 10 * 1024 * 1024) return // 10MB max before compression

    setUploading(true)
    setProgress(20)

    try {
      // Compress
      const blob = await compressImage(file)
      setProgress(50)

      // Upload path
      const ext = 'jpg'
      const fileName = `${crypto.randomUUID()}.${ext}`
      const path = `${profile.id}/${fileName}`

      // Delete old file if replacing
      const existingSlot = slots[targetSlot.current - 1]
      if (existingSlot) {
        await supabase.storage.from('profile-photos').remove([existingSlot.storagePath])
      }

      // Upload
      const { error: upErr } = await supabase.storage
        .from('profile-photos')
        .upload(path, blob, { contentType: 'image/jpeg', upsert: true })

      if (upErr) throw upErr
      setProgress(80)

      // Get public URL
      const { data: urlData } = supabase.storage.from('profile-photos').getPublicUrl(path)
      const publicUrl = urlData.publicUrl

      // Check if we have any active photo
      const hasActivePhoto = slots.some(s => s?.isActive)
      const shouldBeActive = !hasActivePhoto || (existingSlot?.isActive)

      // Upsert profile_photos row
      await supabase.from('profile_photos').upsert({
        user_id: profile.id,
        slot_index: targetSlot.current,
        storage_path: path,
        is_active: shouldBeActive,
      }, { onConflict: 'user_id,slot_index' })

      // If this becomes active, update profiles.avatar_url
      if (shouldBeActive) {
        // Deactivate other slot
        const otherSlot = targetSlot.current === 1 ? 2 : 1
        await supabase.from('profile_photos')
          .update({ is_active: false })
          .eq('user_id', profile.id)
          .eq('slot_index', otherSlot)

        await supabase.from('profiles').update({ avatar_url: publicUrl }).eq('id', profile.id)
      }

      setProgress(100)
      await loadPhotos()
      await refreshProfile()
      onPhotoChanged?.()
    } catch (err) {
      console.error('Upload error:', err)
    } finally {
      setUploading(false)
      setProgress(0)
    }
  }

  // Set a slot as active
  const setActive = async (slotIndex: number) => {
    if (!profile) return
    setMenuSlot(null)
    const slot = slots[slotIndex - 1]
    if (!slot) return

    // Deactivate all, activate this one
    await supabase.from('profile_photos').update({ is_active: false }).eq('user_id', profile.id)
    await supabase.from('profile_photos').update({ is_active: true }).eq('user_id', profile.id).eq('slot_index', slotIndex)

    // Update profiles.avatar_url
    const { data: urlData } = supabase.storage.from('profile-photos').getPublicUrl(slot.storagePath)
    await supabase.from('profiles').update({ avatar_url: urlData.publicUrl }).eq('id', profile.id)

    await loadPhotos()
    await refreshProfile()
    onPhotoChanged?.()
  }

  // Delete a slot
  const deleteSlot = async (slotIndex: number) => {
    if (!profile) return
    setMenuSlot(null)
    const slot = slots[slotIndex - 1]
    if (!slot) return

    // Remove from storage
    await supabase.storage.from('profile-photos').remove([slot.storagePath])
    // Delete DB row
    await supabase.from('profile_photos').delete().eq('user_id', profile.id).eq('slot_index', slotIndex)

    // If was active, activate other slot or clear avatar
    if (slot.isActive) {
      const otherIdx = slotIndex === 1 ? 2 : 1
      const otherSlot = slots[otherIdx - 1]
      if (otherSlot) {
        await supabase.from('profile_photos').update({ is_active: true }).eq('user_id', profile.id).eq('slot_index', otherIdx)
        const { data: urlData } = supabase.storage.from('profile-photos').getPublicUrl(otherSlot.storagePath)
        await supabase.from('profiles').update({ avatar_url: urlData.publicUrl }).eq('id', profile.id)
      } else {
        await supabase.from('profiles').update({ avatar_url: null }).eq('id', profile.id)
      }
    }

    await loadPhotos()
    await refreshProfile()
    onPhotoChanged?.()
  }

  if (!open) return null

  return (
    <div style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.85)',
      display: 'flex', alignItems: 'flex-end', zIndex: 300,
    }} onClick={onClose}>
      <div style={{
        width: '100%', maxWidth: 430, margin: '0 auto',
        background: 'var(--bg-surface)', borderRadius: '20px 20px 0 0',
        border: '1px solid var(--border-subtle)',
      }} onClick={e => e.stopPropagation()}>

        {/* Header */}
        <div style={{
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          padding: '16px 20px 12px', borderBottom: '1px solid var(--border-subtle)',
        }}>
          <span style={{ fontFamily: 'var(--font-display)', fontSize: 14, color: 'var(--text-primary)', letterSpacing: 2 }}>
            {t('components.profilePhotos')}
          </span>
          <button onClick={onClose} style={{
            background: 'none', border: 'none', color: 'var(--text-muted)', fontSize: 20, cursor: 'pointer', padding: 4,
          }}>✕</button>
        </div>

        {/* Upload progress */}
        {uploading && (
          <div style={{ padding: '0 20px', marginTop: 12 }}>
            <div style={{ height: 3, background: 'var(--bg-elevated)', borderRadius: 2, overflow: 'hidden' }}>
              <div style={{
                width: `${progress}%`, height: '100%', background: 'var(--gold-primary)',
                borderRadius: 2, transition: 'width 0.3s',
              }} />
            </div>
            <p style={{ fontSize: 11, color: 'var(--text-secondary)', marginTop: 6, textAlign: 'center' }}>{t('components.uploadingProgress')}</p>
          </div>
        )}

        {/* Photo slots */}
        <div style={{
          display: 'flex', gap: 16, padding: '24px 20px 8px', justifyContent: 'center',
        }}>
          {[1, 2].map(slotIdx => {
            const slot = slots[slotIdx - 1]
            return (
              <div key={slotIdx} style={{ position: 'relative' }}>
                {/* Photo circle or empty */}
                <div
                  onClick={() => {
                    if (slot) setMenuSlot(menuSlot === slotIdx ? null : slotIdx)
                    else pickFile(slotIdx)
                  }}
                  style={{
                    width: 100, height: 100, borderRadius: '50%', overflow: 'hidden',
                    background: slot ? 'var(--bg-elevated)' : 'var(--bg-deepest)',
                    border: slot?.isActive
                      ? '3px solid var(--gold-primary)'
                      : '2px dashed rgba(255,255,255,0.15)',
                    cursor: 'pointer',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    transition: 'border-color 0.2s',
                  }}
                >
                  {slot ? (
                    <img src={slot.url} alt={`Foto ${slotIdx}`} style={{
                      width: '100%', height: '100%', objectFit: 'cover', display: 'block',
                    }} />
                  ) : (
                    <div style={{ textAlign: 'center' }}>
                      <span style={{ fontSize: 28, opacity: 0.3 }}>📷</span>
                      <p style={{ fontSize: 9, color: 'var(--text-muted)', marginTop: 4 }}>FOTO {slotIdx}</p>
                    </div>
                  )}
                </div>

                {/* Active badge */}
                {slot?.isActive && (
                  <div style={{
                    position: 'absolute', top: -2, right: -2,
                    width: 22, height: 22, borderRadius: '50%',
                    background: 'var(--gold-primary)', border: '2px solid var(--bg-surface)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}>
                    <span style={{ fontSize: 11 }}>✓</span>
                  </div>
                )}

                {/* Slot label */}
                <p style={{
                  textAlign: 'center', fontSize: 10, color: slot?.isActive ? 'var(--gold-primary)' : 'var(--text-muted)',
                  marginTop: 8, fontFamily: 'var(--font-display)', letterSpacing: 1,
                }}>
                  {slot?.isActive ? 'AKTIV' : `SLOT ${slotIdx}`}
                </p>

                {/* Context menu */}
                {menuSlot === slotIdx && slot && (
                  <div style={{
                    position: 'absolute', top: 108, left: '50%', transform: 'translateX(-50%)',
                    background: 'var(--bg-elevated)', border: '1px solid var(--border-subtle)', borderRadius: 12,
                    padding: '4px 0', minWidth: 140, zIndex: 10,
                    boxShadow: '0 8px 24px rgba(0,0,0,0.6)',
                  }}>
                    {!slot.isActive && (
                      <button onClick={() => setActive(slotIdx)} style={{
                        display: 'block', width: '100%', padding: '10px 16px', textAlign: 'left',
                        background: 'none', border: 'none', color: 'var(--gold-primary)', fontSize: 13, cursor: 'pointer',
                        fontFamily: 'Crimson Text, serif',
                      }}>
                        {t('components.setActive')}
                      </button>
                    )}
                    <button onClick={() => pickFile(slotIdx)} style={{
                      display: 'block', width: '100%', padding: '10px 16px', textAlign: 'left',
                      background: 'none', border: 'none', color: 'var(--text-primary)', fontSize: 13, cursor: 'pointer',
                      fontFamily: 'Crimson Text, serif',
                    }}>
                      {t('components.replacePhoto')}
                    </button>
                    <button onClick={() => deleteSlot(slotIdx)} style={{
                      display: 'block', width: '100%', padding: '10px 16px', textAlign: 'left',
                      background: 'none', border: 'none', color: '#EF4444', fontSize: 13, cursor: 'pointer',
                      fontFamily: 'Crimson Text, serif',
                    }}>
                      {t('components.deletePhoto')}
                    </button>
                  </div>
                )}
              </div>
            )
          })}
        </div>

        {/* Info text */}
        <p style={{
          textAlign: 'center', fontSize: 12, color: 'var(--text-muted)',
          fontFamily: 'Crimson Text, serif', padding: '12px 20px 24px',
          paddingBottom: 'max(24px, env(safe-area-inset-bottom))',
        }}>
          {t('components.profilePhotoInfo')}
        </p>

        {/* Hidden file input */}
        <input
          ref={fileRef}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          style={{ display: 'none' }}
          onChange={handleFileChange}
        />
      </div>
    </div>
  )
}
