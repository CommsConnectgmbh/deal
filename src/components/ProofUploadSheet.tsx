'use client'
import React, { useState, useRef } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/contexts/AuthContext'
import { useLang } from '@/contexts/LanguageContext'

interface Props {
  dealId: string
  proofType: 'winner_proof' | 'dispute_proof'
  open: boolean
  onClose: () => void
  onComplete: () => void
}

/** Compress image client-side → always JPEG */
async function compressImage(file: File, maxSize = 1200, quality = 0.88): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => {
      const canvas = document.createElement('canvas')
      let w = img.width, h = img.height
      if (w > h) { if (w > maxSize) { h = Math.round(h * maxSize / w); w = maxSize } }
      else       { if (h > maxSize) { w = Math.round(w * maxSize / h); h = maxSize } }
      canvas.width = w; canvas.height = h
      canvas.getContext('2d')!.drawImage(img, 0, 0, w, h)
      canvas.toBlob(b => b ? resolve(b) : reject(new Error('fail')), 'image/jpeg', quality)
    }
    img.onerror = () => reject(new Error('fail'))
    img.src = URL.createObjectURL(file)
  })
}

export default function ProofUploadSheet({ dealId, proofType, open, onClose, onComplete }: Props) {
  const { profile } = useAuth()
  const { t } = useLang()
  const [file, setFile] = useState<File | null>(null)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [description, setDescription] = useState('')
  const [uploading, setUploading] = useState(false)
  const [progress, setProgress] = useState(0)
  const fileRef = useRef<HTMLInputElement>(null)

  const handleFilePick = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0]
    if (!f) return
    e.target.value = ''
    setFile(f)
    setPreviewUrl(URL.createObjectURL(f))
  }

  const handleUpload = async () => {
    if (!file || !profile || uploading) return
    setUploading(true)
    setProgress(20)

    // Wake Lock — Bildschirm bleibt an während Upload
    let wakeLock: any = null
    try {
      if ('wakeLock' in navigator) {
        wakeLock = await (navigator as any).wakeLock.request('screen')
      }
    } catch (_) { /* nicht verfügbar */ }

    try {
      const isVideo = file.type.startsWith('video/')
      const isImage = file.type.startsWith('image/')
      if (!isImage && !isVideo) throw new Error(t('proof.onlyImagesOrVideos'))

      let uploadBlob: Blob = file
      if (isImage) uploadBlob = await compressImage(file)
      setProgress(50)

      const ext = isVideo ? 'mp4' : 'jpg'
      const path = `${dealId}/${crypto.randomUUID()}.${ext}`
      const { error: upErr } = await supabase.storage
        .from('deal-proofs').upload(path, uploadBlob, {
          contentType: isVideo ? 'video/mp4' : 'image/jpeg',
        })
      if (upErr) throw upErr
      setProgress(80)

      const { data: urlData } = supabase.storage.from('deal-proofs').getPublicUrl(path)

      await supabase.from('deal_proofs').insert({
        deal_id: dealId,
        user_id: profile.id,
        proof_type: proofType,
        media_type: isVideo ? 'video' : 'image',
        media_url: urlData.publicUrl,
        description: description.trim() || null,
      })
      setProgress(100)

      // Reset & callback
      setFile(null)
      setPreviewUrl(null)
      setDescription('')
      onComplete()
      onClose()
    } catch (err) {
      console.error('Proof upload error:', err)
    } finally {
      if (wakeLock) { try { await wakeLock.release() } catch (_) {} }
      setUploading(false)
      setProgress(0)
    }
  }

  const reset = () => {
    setFile(null)
    setPreviewUrl(null)
    setDescription('')
    onClose()
  }

  if (!open) return null

  return (
    <div style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.85)',
      display: 'flex', alignItems: 'flex-end', zIndex: 300,
    }} onClick={reset}>
      <div style={{
        width: '100%', maxWidth: 430, margin: '0 auto',
        background: 'var(--bg-surface)', borderRadius: '20px 20px 0 0',
        border: '1px solid var(--border-subtle)',
        maxHeight: '80vh', display: 'flex', flexDirection: 'column',
      }} onClick={e => e.stopPropagation()}>

        {/* Header */}
        <div style={{
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          padding: '16px 20px 12px', borderBottom: '1px solid var(--border-subtle)',
        }}>
          <span style={{ fontFamily: 'var(--font-display)', fontSize: 14, color: 'var(--text-primary)', letterSpacing: 2 }}>
            {proofType === 'winner_proof' ? t('proof.uploadProof') : t('proof.counterProof')}
          </span>
          <button onClick={reset} style={{
            background: 'none', border: 'none', color: 'var(--text-muted)', fontSize: 20, cursor: 'pointer', padding: 4,
          }}>✕</button>
        </div>

        {/* Upload progress */}
        {uploading && (
          <div style={{ padding: '0 20px', marginTop: 12 }}>
            <div style={{ height: 3, background: 'var(--bg-elevated)', borderRadius: 2, overflow: 'hidden' }}>
              <div style={{ width: `${progress}%`, height: '100%', background: 'var(--gold-primary)', borderRadius: 2, transition: 'width 0.3s' }} />
            </div>
            <p style={{ fontSize: 11, color: 'var(--text-secondary)', marginTop: 6, textAlign: 'center' }}>{t('components.uploadingProgress')}</p>
          </div>
        )}

        {/* Content */}
        <div style={{ padding: '20px', flex: 1, overflowY: 'auto' }}>
          {/* Preview or upload button */}
          {previewUrl ? (
            <div style={{ position: 'relative', marginBottom: 16 }}>
              {file?.type.startsWith('video/') ? (
                <video src={previewUrl} controls style={{ width: '100%', borderRadius: 12, maxHeight: 240 }} />
              ) : (
                <img src={previewUrl} alt="Vorschau" style={{ width: '100%', borderRadius: 12, maxHeight: 240, objectFit: 'cover' }} />
              )}
              <button
                onClick={() => { setFile(null); setPreviewUrl(null) }}
                style={{
                  position: 'absolute', top: 8, right: 8,
                  width: 28, height: 28, borderRadius: '50%',
                  background: 'rgba(0,0,0,0.6)', border: 'none', color: '#fff',
                  fontSize: 14, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}
              >✕</button>
            </div>
          ) : (
            <button
              onClick={() => fileRef.current?.click()}
              style={{
                width: '100%', padding: '32px 20px', borderRadius: 14,
                border: '2px dashed rgba(255,184,0,0.2)', background: 'rgba(255,184,0,0.03)',
                cursor: 'pointer', textAlign: 'center', marginBottom: 16,
              }}
            >
              <span style={{ fontSize: 36, display: 'block', marginBottom: 8 }}>{'\uD83D\uDCF8'}</span>
              <p style={{ fontFamily: 'var(--font-display)', fontSize: 11, letterSpacing: 2, color: 'var(--gold-primary)' }}>
                LIVE-FOTO AUFNEHMEN
              </p>
              <p style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 6, fontFamily: 'var(--font-body)' }}>
                {t('proof.cameraOnlyHint')}
              </p>
              <div style={{
                display: 'inline-flex', alignItems: 'center', gap: 6, marginTop: 10,
                padding: '4px 10px', borderRadius: 8,
                background: 'rgba(74,222,128,0.08)', border: '1px solid rgba(74,222,128,0.2)',
              }}>
                <span style={{ fontSize: 12 }}>{'\u2705'}</span>
                <span style={{ fontSize: 9, color: '#4ade80', fontFamily: 'var(--font-display)', letterSpacing: 1 }}>VERIFIZIERT</span>
              </div>
            </button>
          )}
          {/* Camera-only input — no gallery access for proof integrity */}
          <input ref={fileRef} type="file" accept="image/*,video/*" capture="environment" style={{ display: 'none' }} onChange={handleFilePick} />

          {/* Description */}
          <textarea
            value={description}
            onChange={e => setDescription(e.target.value.slice(0, 200))}
            placeholder={t('proof.optionalDesc')}
            rows={2}
            style={{
              width: '100%', padding: '12px 14px', background: 'var(--bg-deepest)',
              border: '1px solid var(--border-subtle)', borderRadius: 12, color: 'var(--text-primary)',
              fontSize: 13, fontFamily: 'var(--font-body)', resize: 'none', outline: 'none',
            }}
          />
          <p style={{ fontSize: 10, color: 'var(--text-muted)', textAlign: 'right', marginTop: 4 }}>{description.length}/200</p>

          {/* Submit */}
          {file ? (
            <button
              onClick={handleUpload}
              disabled={uploading}
              style={{
                width: '100%', padding: 14, borderRadius: 12, border: 'none', cursor: 'pointer',
                background: 'linear-gradient(135deg, var(--gold-dim), var(--gold-primary))',
                color: 'var(--text-inverse)',
                fontFamily: 'var(--font-display)', fontSize: 11, fontWeight: 700, letterSpacing: 2,
                marginTop: 16, marginBottom: 4,
              }}
            >
              {uploading ? t('proof.uploading') : proofType === 'winner_proof' ? t('proof.submitProof') : t('proof.submitCounter')}
            </button>
          ) : (
            <button
              onClick={() => { onComplete(); onClose() }}
              disabled={uploading}
              style={{
                width: '100%', padding: 14, borderRadius: 12, border: 'none', cursor: 'pointer',
                background: 'linear-gradient(135deg, var(--gold-dim), var(--gold-primary))',
                color: 'var(--text-inverse)',
                fontFamily: 'var(--font-display)', fontSize: 11, fontWeight: 700, letterSpacing: 2,
                marginTop: 16, marginBottom: 4,
              }}
            >
              {proofType === 'winner_proof' ? t('proof.withoutProof') : t('proof.withoutCounter')}
            </button>
          )}

          {/* Skip hint */}
          {!file && (
            <p style={{ fontSize: 11, color: 'var(--text-muted)', textAlign: 'center', fontFamily: 'var(--font-body)', marginTop: 4, marginBottom: 8 }}>
              {t('proof.optionalHint')}
            </p>
          )}
        </div>
      </div>
    </div>
  )
}
