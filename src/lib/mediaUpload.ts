import { supabase } from './supabase'

/* ═══════════════════════════════════════════════════════════════
   Media Upload Pipeline — Instagram Reels-Style
   • Videos: max 90s, 720p, ~15 MB, MP4 preferred
   • Images: always JPEG, max 1200px, quality 0.88
   ═══════════════════════════════════════════════════════════════ */

// ─── Constants (Instagram Reels-inspired) ───
const MAX_UPLOAD_MB = 20          // Hard upload limit
const VIDEO_COMPRESS_THRESHOLD_MB = 8  // Compress videos > 8 MB
const VIDEO_TARGET_MB = 15        // Target size after compression
const VIDEO_MAX_DIM = 720         // Max 720p
const VIDEO_FPS = 30
const VIDEO_MAX_BITRATE = 2_000_000  // 2 Mbps cap (plenty for 720p)
const IMAGE_MAX_DIM = 1200
const IMAGE_QUALITY = 0.88
const COMMENT_IMAGE_MAX_DIM = 800
const COMMENT_IMAGE_QUALITY = 0.85
const UPLOAD_TIMEOUT_MS = 120_000  // 2 min (enough for 20 MB)

/** Compress image client-side via canvas → always outputs JPEG */
export async function compressImage(
  file: File,
  maxSize = IMAGE_MAX_DIM,
  quality = IMAGE_QUALITY
): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => {
      const canvas = document.createElement('canvas')
      let w = img.width, h = img.height
      if (w > h) { if (w > maxSize) { h = Math.round(h * maxSize / w); w = maxSize } }
      else       { if (h > maxSize) { w = Math.round(w * maxSize / h); h = maxSize } }
      canvas.width = w
      canvas.height = h
      canvas.getContext('2d')!.drawImage(img, 0, 0, w, h)
      canvas.toBlob(
        b => (b ? resolve(b) : reject(new Error('Canvas toBlob failed'))),
        'image/jpeg',
        quality
      )
    }
    img.onerror = () => reject(new Error('Image load failed'))
    img.src = URL.createObjectURL(file)
  })
}

/**
 * Compress video client-side using Canvas + MediaRecorder.
 * Prefers MP4/H.264 (best compatibility), falls back to WebM/VP8.
 * Re-encodes at 720p with target bitrate to stay under targetMB.
 */
async function compressVideo(
  file: File,
  targetMB = VIDEO_TARGET_MB,
  onProgress?: (msg: string) => void
): Promise<Blob> {
  onProgress?.('Video wird komprimiert...')

  return new Promise((resolve, reject) => {
    const video = document.createElement('video')
    video.muted = true
    video.playsInline = true
    video.preload = 'auto'

    video.onloadedmetadata = () => {
      // Scale to max 720p
      let w = video.videoWidth
      let h = video.videoHeight
      if (w > h) {
        if (w > VIDEO_MAX_DIM) { h = Math.round(h * VIDEO_MAX_DIM / w); w = VIDEO_MAX_DIM }
      } else {
        if (h > VIDEO_MAX_DIM) { w = Math.round(w * VIDEO_MAX_DIM / h); h = VIDEO_MAX_DIM }
      }
      // Ensure even dimensions (required by codecs)
      w = w % 2 === 0 ? w : w + 1
      h = h % 2 === 0 ? h : h + 1

      const canvas = document.createElement('canvas')
      canvas.width = w
      canvas.height = h
      const ctx = canvas.getContext('2d')!

      const duration = video.duration
      // Calculate bitrate: targetMB * 8 * 1024 * 1024 / duration = bps
      const targetBitsPerSecond = Math.min(
        Math.floor((targetMB * 8 * 1024 * 1024) / duration),
        VIDEO_MAX_BITRATE
      )

      // Prefer MP4/H.264 (universal playback), fall back to WebM/VP8
      const mimeType =
        MediaRecorder.isTypeSupported('video/mp4;codecs=avc1')
          ? 'video/mp4;codecs=avc1'
          : MediaRecorder.isTypeSupported('video/mp4')
            ? 'video/mp4'
            : MediaRecorder.isTypeSupported('video/webm;codecs=vp9')
              ? 'video/webm;codecs=vp9'
              : MediaRecorder.isTypeSupported('video/webm;codecs=vp8')
                ? 'video/webm;codecs=vp8'
                : 'video/webm'

      const isMP4 = mimeType.startsWith('video/mp4')
      const stream = canvas.captureStream(VIDEO_FPS)

      // Also capture audio if present
      try {
        const audioCtx = new AudioContext()
        const source = audioCtx.createMediaElementSource(video)
        const dest = audioCtx.createMediaStreamDestination()
        source.connect(dest)
        source.connect(audioCtx.destination)
        dest.stream.getAudioTracks().forEach(t => stream.addTrack(t))
      } catch (_) {
        // No audio track or AudioContext not supported
      }

      const recorder = new MediaRecorder(stream, {
        mimeType,
        videoBitsPerSecond: targetBitsPerSecond,
      })

      const chunks: Blob[] = []
      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunks.push(e.data)
      }

      recorder.onstop = () => {
        const outputType = isMP4 ? 'video/mp4' : 'video/webm'
        const blob = new Blob(chunks, { type: outputType })
        const originalMB = (file.size / 1024 / 1024).toFixed(1)
        const compressedMB = (blob.size / 1024 / 1024).toFixed(1)
        onProgress?.(`Komprimiert: ${originalMB} MB → ${compressedMB} MB`)
        URL.revokeObjectURL(video.src)
        resolve(blob)
      }

      recorder.onerror = () => {
        URL.revokeObjectURL(video.src)
        reject(new Error('Video-Komprimierung fehlgeschlagen'))
      }

      // Draw frames to canvas
      const drawFrame = () => {
        if (video.ended || video.paused) return
        ctx.drawImage(video, 0, 0, w, h)
        if (onProgress && duration > 0) {
          const pct = Math.round((video.currentTime / duration) * 100)
          onProgress(`Video wird komprimiert... ${pct}%`)
        }
        requestAnimationFrame(drawFrame)
      }

      recorder.start(1000) // 1s chunks
      video.currentTime = 0
      video.play().then(() => {
        drawFrame()
      }).catch(reject)

      video.onended = () => {
        setTimeout(() => recorder.stop(), 200)
      }
    }

    video.onerror = () => {
      URL.revokeObjectURL(video.src)
      reject(new Error('Video konnte nicht geladen werden'))
    }

    video.src = URL.createObjectURL(file)
  })
}

/**
 * Upload deal media via signed URL (bypasses Vercel 4.5 MB limit).
 * Instagram Reels-style pipeline:
 *   • Images → JPEG, max 1200px, ~88% quality
 *   • Videos → MP4 preferred, 720p, max 90s, ~15 MB target
 *   • Hard limit: 20 MB upload
 */
export async function uploadDealMedia(
  file: File,
  dealId: string,
  _userId: string,
  onProgress?: (percent: number) => void,
  onStatusMessage?: (msg: string) => void
): Promise<{ url: string; type: 'image' | 'video' }> {
  const isVideo = file.type.startsWith('video/') || /\.(mp4|mov|webm|m4v|3gp|mpeg)$/i.test(file.name || '')
  const isImage = file.type.startsWith('image/') && !isVideo
  if (!isImage && !isVideo) throw new Error('Nur Bilder oder Videos erlaubt')

  let uploadFile: File | Blob = file
  let uploadFileName = file.name
  let uploadFileType = file.type

  // ─── Images: always compress to JPEG ───
  if (isImage) {
    onProgress?.(5)
    onStatusMessage?.('Bild wird optimiert...')
    uploadFile = await compressImage(file, IMAGE_MAX_DIM, IMAGE_QUALITY)
    uploadFileName = uploadFileName.replace(/\.[^.]+$/, '.jpg')
    uploadFileType = 'image/jpeg'
  }

  // ─── Videos: compress if > 8 MB (almost always) ───
  if (isVideo && file.size > VIDEO_COMPRESS_THRESHOLD_MB * 1024 * 1024) {
    onProgress?.(5)
    try {
      uploadFile = await compressVideo(file, VIDEO_TARGET_MB, (msg) => {
        onStatusMessage?.(msg)
      })
      // Set correct extension based on output format
      const isMP4Output = uploadFile.type === 'video/mp4'
      uploadFileName = uploadFileName.replace(/\.[^.]+$/, isMP4Output ? '.mp4' : '.webm')
      uploadFileType = uploadFile.type || (isMP4Output ? 'video/mp4' : 'video/webm')
      onStatusMessage?.(`Komprimiert: ${(file.size / 1024 / 1024).toFixed(0)} MB → ${(uploadFile.size / 1024 / 1024).toFixed(0)} MB`)
    } catch (err) {
      console.warn('Video compression failed, uploading original:', err)
    }
  }

  // ─── Final size check: 20 MB hard limit ───
  const finalSize = uploadFile.size || (uploadFile as Blob).size
  if (finalSize > MAX_UPLOAD_MB * 1024 * 1024) {
    throw new Error(`Datei zu groß (${(finalSize / 1024 / 1024).toFixed(0)} MB). Max ${MAX_UPLOAD_MB} MB.`)
  }

  // Get auth token
  const { data: { session } } = await supabase.auth.getSession()
  const token = session?.access_token
  if (!token) throw new Error('Nicht eingeloggt')

  onProgress?.(10)
  onStatusMessage?.('Wird hochgeladen...')

  // Step 1: Get signed upload URL from our API
  console.log('[Upload] Getting signed URL...', { dealId, fileName: uploadFileName, fileSize: finalSize })
  const res = await fetch('/api/upload-media', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      dealId,
      fileName: uploadFileName,
      fileType: uploadFileType,
    }),
  })

  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: 'Signed URL fehlgeschlagen' }))
    console.error('[Upload] Signed URL error:', err)
    throw new Error(err.error || `Server-Fehler (${res.status})`)
  }

  const { signedUrl, publicUrl, contentType, type } = await res.json()
  console.log('[Upload] Uploading directly to Supabase...', {
    signedUrl: signedUrl?.substring(0, 60) + '...',
    fileSize: finalSize,
  })

  onProgress?.(15)

  // Step 2: Upload file DIRECTLY to Supabase Storage via XHR
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest()

    xhr.upload.addEventListener('progress', (e) => {
      if (e.lengthComputable && onProgress) {
        const percent = 15 + Math.round((e.loaded / e.total) * 85)
        onProgress(Math.min(percent, 99))
        const mbLoaded = (e.loaded / 1024 / 1024).toFixed(1)
        const mbTotal = (e.total / 1024 / 1024).toFixed(1)
        onStatusMessage?.(`${mbLoaded} / ${mbTotal} MB hochgeladen`)
      }
    })

    xhr.addEventListener('load', () => {
      console.log('[Upload] XHR response:', xhr.status, xhr.responseText?.substring(0, 200))
      if (xhr.status >= 200 && xhr.status < 300) {
        onProgress?.(100)
        onStatusMessage?.('Fertig!')
        resolve({ url: publicUrl, type })
      } else {
        let msg = 'Upload fehlgeschlagen'
        try {
          const body = JSON.parse(xhr.responseText)
          msg = body?.error || body?.message || body?.statusCode || msg
        } catch (_) {
          msg = `Upload fehlgeschlagen (HTTP ${xhr.status})`
        }
        reject(new Error(String(msg)))
      }
    })

    xhr.addEventListener('error', () => {
      console.error('[Upload] XHR network error')
      reject(new Error('Netzwerkfehler beim Upload'))
    })
    xhr.addEventListener('abort', () => reject(new Error('Upload abgebrochen')))
    xhr.addEventListener('timeout', () => reject(new Error('Upload Timeout')))

    xhr.timeout = UPLOAD_TIMEOUT_MS
    xhr.open('PUT', signedUrl)
    xhr.setRequestHeader('Content-Type', contentType)
    xhr.send(uploadFile)
  })
}

/** Upload comment media (image only) → always JPEG */
export async function uploadCommentMedia(
  file: File,
  dealId: string,
): Promise<string> {
  if (!file.type.startsWith('image/')) throw new Error('Nur Bilder erlaubt')

  const uploadBlob = await compressImage(file, COMMENT_IMAGE_MAX_DIM, COMMENT_IMAGE_QUALITY)
  const path = `comments/${dealId}/${crypto.randomUUID()}.jpg`

  const { error } = await supabase.storage
    .from('deal-media')
    .upload(path, uploadBlob, { contentType: 'image/jpeg' })
  if (error) throw error

  const { data } = supabase.storage.from('deal-media').getPublicUrl(path)
  return data.publicUrl
}
