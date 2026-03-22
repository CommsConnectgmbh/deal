'use client'
import { useState, useRef, useEffect, useCallback } from 'react'
import { useLang } from '@/contexts/LanguageContext'

/* ═══════════════════════════════════════════════════════════════
   MediaEditor — DealBuddy Light Editor
   • Video: Trim (Start/Ende), Text-Overlay, Filter
   • Image: Text-Overlay, Filter
   • Emojis über Tastatur = kostenlose Sticker
   ═══════════════════════════════════════════════════════════════ */

type TextOverlay = {
  text: string
  x: number      // 0-1 relative
  y: number      // 0-1 relative
  color: string
  fontSize: number // px
}

type Filter = 'none' | 'bw' | 'warm' | 'cool' | 'vivid'

const FILTERS: { key: Filter; label: string; css: string }[] = [
  { key: 'none',  label: 'Original', css: 'none' },
  { key: 'bw',    label: 'B&W',      css: 'grayscale(1)' },
  { key: 'warm',  label: 'Warm',     css: 'sepia(0.35) saturate(1.3) brightness(1.05)' },
  { key: 'cool',  label: 'Cool',     css: 'saturate(0.8) brightness(1.05) hue-rotate(15deg)' },
  { key: 'vivid', label: 'Vivid',    css: 'saturate(1.6) contrast(1.1) brightness(1.05)' },
]

const TEXT_COLORS = ['#ffffff', '#000000', '#FFB800', '#ef4444', '#4ade80', '#3b82f6', '#a78bfa', '#f97316']

interface MediaEditorProps {
  file: File
  onDone: (editedFile: File, preview: string) => void
  onCancel: () => void
}

export default function MediaEditor({ file, onDone, onCancel }: MediaEditorProps) {
  const { t } = useLang()
  const isVideo = file.type.startsWith('video/')

  // State
  const [filter, setFilter] = useState<Filter>('none')
  const [textOverlay, setTextOverlay] = useState<TextOverlay | null>(null)
  const [showTextInput, setShowTextInput] = useState(false)
  const [textDraft, setTextDraft] = useState('')
  const [textColor, setTextColor] = useState('#ffffff')
  const [textSize, setTextSize] = useState(28)
  const [trimStart, setTrimStart] = useState(0)
  const [trimEnd, setTrimEnd] = useState(0)
  const [duration, setDuration] = useState(0)
  const [currentTime, setCurrentTime] = useState(0)
  const [isDragging, setIsDragging] = useState(false)
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 })
  const [exporting, setExporting] = useState(false)
  const [exportProgress, setExportProgress] = useState(0)

  // Refs
  const videoRef = useRef<HTMLVideoElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const previewRef = useRef<HTMLDivElement>(null)
  const previewUrl = useRef<string>('')

  // Init preview URL
  useEffect(() => {
    previewUrl.current = URL.createObjectURL(file)
    return () => URL.revokeObjectURL(previewUrl.current)
  }, [file])

  // Video metadata
  useEffect(() => {
    if (!isVideo) return
    const v = videoRef.current
    if (!v) return
    const onMeta = () => {
      setDuration(v.duration)
      setTrimEnd(v.duration)
    }
    v.addEventListener('loadedmetadata', onMeta)
    return () => v.removeEventListener('loadedmetadata', onMeta)
  }, [isVideo])

  // Video time update
  useEffect(() => {
    if (!isVideo) return
    const v = videoRef.current
    if (!v) return
    const onTime = () => {
      setCurrentTime(v.currentTime)
      if (v.currentTime >= trimEnd) {
        v.currentTime = trimStart
      }
    }
    v.addEventListener('timeupdate', onTime)
    return () => v.removeEventListener('timeupdate', onTime)
  }, [isVideo, trimStart, trimEnd])

  // Play from trimStart when trimStart changes
  useEffect(() => {
    const v = videoRef.current
    if (v && isVideo) {
      v.currentTime = trimStart
    }
  }, [trimStart, isVideo])

  // ─── Text overlay drag ───
  const handleTextDragStart = useCallback((e: React.TouchEvent | React.MouseEvent) => {
    if (!textOverlay || !previewRef.current) return
    e.preventDefault()
    setIsDragging(true)
    const rect = previewRef.current.getBoundingClientRect()
    const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX
    const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY
    setDragOffset({
      x: clientX - (textOverlay.x * rect.width),
      y: clientY - (textOverlay.y * rect.height),
    })
  }, [textOverlay])

  const handleTextDragMove = useCallback((e: React.TouchEvent | React.MouseEvent) => {
    if (!isDragging || !textOverlay || !previewRef.current) return
    e.preventDefault()
    const rect = previewRef.current.getBoundingClientRect()
    const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX
    const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY
    const x = Math.max(0, Math.min(1, (clientX - dragOffset.x) / rect.width))
    const y = Math.max(0.05, Math.min(0.95, (clientY - dragOffset.y) / rect.height))
    setTextOverlay({ ...textOverlay, x, y })
  }, [isDragging, textOverlay, dragOffset])

  const handleTextDragEnd = useCallback(() => {
    setIsDragging(false)
  }, [])

  // ─── Add text overlay ───
  const addText = () => {
    if (!textDraft.trim()) return
    setTextOverlay({
      text: textDraft,
      x: 0.5,
      y: 0.5,
      color: textColor,
      fontSize: textSize,
    })
    setShowTextInput(false)
  }

  // ─── Format time ───
  const fmt = (s: number) => {
    const m = Math.floor(s / 60)
    const sec = Math.floor(s % 60)
    return `${m}:${sec.toString().padStart(2, '0')}`
  }

  // ─── Get CSS filter string ───
  const filterCSS = FILTERS.find(f => f.key === filter)?.css || 'none'

  // ─── Export (render final file) ───
  const handleExport = async () => {
    setExporting(true)
    setExportProgress(0)

    try {
      if (isVideo) {
        await exportVideo()
      } else {
        await exportImage()
      }
    } catch (err) {
      console.error('Export failed:', err)
      // Fallback: return original file
      onDone(file, previewUrl.current)
    } finally {
      setExporting(false)
    }
  }

  // ─── Export IMAGE ───
  const exportImage = async () => {
    setExportProgress(30)
    const img = new Image()
    img.crossOrigin = 'anonymous'

    await new Promise<void>((resolve, reject) => {
      img.onload = () => resolve()
      img.onerror = () => reject(new Error('Image load failed'))
      img.src = previewUrl.current
    })

    const canvas = document.createElement('canvas')
    const maxDim = 1200
    let w = img.width, h = img.height
    if (w > h) { if (w > maxDim) { h = Math.round(h * maxDim / w); w = maxDim } }
    else       { if (h > maxDim) { w = Math.round(w * maxDim / h); h = maxDim } }
    canvas.width = w
    canvas.height = h
    const ctx = canvas.getContext('2d')!

    // Apply filter
    if (filter !== 'none') ctx.filter = filterCSS
    ctx.drawImage(img, 0, 0, w, h)
    ctx.filter = 'none'

    setExportProgress(60)

    // Draw text overlay
    if (textOverlay) {
      drawTextOnCanvas(ctx, textOverlay, w, h)
    }

    setExportProgress(90)

    const blob = await new Promise<Blob>((res, rej) => {
      canvas.toBlob(b => b ? res(b) : rej(new Error('toBlob failed')), 'image/jpeg', 0.88)
    })

    const editedFile = new File([blob], file.name.replace(/\.[^.]+$/, '.jpg'), { type: 'image/jpeg' })
    const editedPreview = URL.createObjectURL(blob)
    setExportProgress(100)
    onDone(editedFile, editedPreview)
  }

  // ─── Export VIDEO (trimmed + filter + text) ───
  const exportVideo = async () => {
    const srcVideo = document.createElement('video')
    srcVideo.muted = true
    srcVideo.playsInline = true
    srcVideo.preload = 'auto'
    srcVideo.src = previewUrl.current

    await new Promise<void>((res) => {
      srcVideo.onloadedmetadata = () => res()
    })

    const maxDim = 720
    let w = srcVideo.videoWidth, h = srcVideo.videoHeight
    if (w > h) { if (w > maxDim) { h = Math.round(h * maxDim / w); w = maxDim } }
    else       { if (h > maxDim) { w = Math.round(w * maxDim / h); h = maxDim } }
    w = w % 2 === 0 ? w : w + 1
    h = h % 2 === 0 ? h : h + 1

    const canvas = document.createElement('canvas')
    canvas.width = w
    canvas.height = h
    const ctx = canvas.getContext('2d')!

    const trimDuration = trimEnd - trimStart
    const targetBps = Math.min(Math.floor((15 * 8 * 1024 * 1024) / trimDuration), 2_000_000)

    // Prefer MP4/H.264
    const mimeType =
      MediaRecorder.isTypeSupported('video/mp4;codecs=avc1') ? 'video/mp4;codecs=avc1'
        : MediaRecorder.isTypeSupported('video/mp4') ? 'video/mp4'
          : MediaRecorder.isTypeSupported('video/webm;codecs=vp9') ? 'video/webm;codecs=vp9'
            : 'video/webm'
    const isMP4 = mimeType.startsWith('video/mp4')

    const stream = canvas.captureStream(30)

    // Audio
    try {
      const audioCtx = new AudioContext()
      const source = audioCtx.createMediaElementSource(srcVideo)
      const dest = audioCtx.createMediaStreamDestination()
      source.connect(dest)
      source.connect(audioCtx.destination)
      dest.stream.getAudioTracks().forEach(t => stream.addTrack(t))
    } catch (_) {}

    const recorder = new MediaRecorder(stream, { mimeType, videoBitsPerSecond: targetBps })
    const chunks: Blob[] = []
    recorder.ondataavailable = (e) => { if (e.data.size > 0) chunks.push(e.data) }

    return new Promise<void>((resolve, reject) => {
      recorder.onstop = () => {
        const outputType = isMP4 ? 'video/mp4' : 'video/webm'
        const ext = isMP4 ? '.mp4' : '.webm'
        const blob = new Blob(chunks, { type: outputType })
        const editedFile = new File([blob], file.name.replace(/\.[^.]+$/, ext), { type: outputType })
        const editedPreview = URL.createObjectURL(blob)
        setExportProgress(100)
        onDone(editedFile, editedPreview)
        resolve()
      }
      recorder.onerror = () => reject(new Error('Video export failed'))

      recorder.start(1000)
      srcVideo.currentTime = trimStart
      srcVideo.play().then(() => {
        const drawFrame = () => {
          if (srcVideo.ended || srcVideo.paused || srcVideo.currentTime >= trimEnd) {
            setTimeout(() => recorder.stop(), 200)
            return
          }
          if (filter !== 'none') ctx.filter = filterCSS
          ctx.drawImage(srcVideo, 0, 0, w, h)
          ctx.filter = 'none'
          if (textOverlay) drawTextOnCanvas(ctx, textOverlay, w, h)

          const progress = Math.round(((srcVideo.currentTime - trimStart) / trimDuration) * 100)
          setExportProgress(progress)
          requestAnimationFrame(drawFrame)
        }
        drawFrame()
      }).catch(reject)

      srcVideo.onended = () => {
        setTimeout(() => { if (recorder.state === 'recording') recorder.stop() }, 200)
      }
    })
  }

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 9999,
      background: '#060606', display: 'flex', flexDirection: 'column',
    }}>
      {/* ═══ HEADER ═══ */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '12px 16px', borderBottom: '1px solid rgba(255,255,255,0.08)',
      }}>
        <button onClick={onCancel} style={{
          background: 'none', border: 'none', color: '#fff',
          fontSize: 14, fontFamily: 'var(--font-body)', cursor: 'pointer',
        }}>
          {'\u2715'} {t('editor.cancel')}
        </button>
        <span style={{
          fontFamily: 'var(--font-display)', fontSize: 11,
          fontWeight: 800, letterSpacing: 2, color: '#FFB800',
        }}>
          {t('editor.title')}
        </span>
        <button onClick={handleExport} disabled={exporting} style={{
          background: 'linear-gradient(135deg, #FFB800, #f59e0b)',
          border: 'none', borderRadius: 8, padding: '8px 16px',
          color: '#060606', fontFamily: 'var(--font-display)',
          fontSize: 11, fontWeight: 800, letterSpacing: 1,
          cursor: exporting ? 'wait' : 'pointer',
          opacity: exporting ? 0.6 : 1,
        }}>
          {exporting ? `${exportProgress}%` : t('editor.done')}
        </button>
      </div>

      {/* ═══ PREVIEW AREA ═══ */}
      <div
        ref={previewRef}
        style={{
          flex: 1, position: 'relative', overflow: 'hidden',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          touchAction: isDragging ? 'none' : 'auto',
        }}
        onMouseMove={handleTextDragMove}
        onMouseUp={handleTextDragEnd}
        onTouchMove={handleTextDragMove}
        onTouchEnd={handleTextDragEnd}
      >
        {isVideo ? (
          <video
            ref={videoRef}
            src={previewUrl.current}
            autoPlay muted loop playsInline
            style={{
              maxWidth: '100%', maxHeight: '100%', objectFit: 'contain',
              filter: filterCSS,
            }}
          />
        ) : (
          <img
            src={previewUrl.current}
            alt=""
            style={{
              maxWidth: '100%', maxHeight: '100%', objectFit: 'contain',
              filter: filterCSS,
            }}
          />
        )}

        {/* Text overlay display */}
        {textOverlay && (
          <div
            onMouseDown={handleTextDragStart}
            onTouchStart={handleTextDragStart}
            style={{
              position: 'absolute',
              left: `${textOverlay.x * 100}%`,
              top: `${textOverlay.y * 100}%`,
              transform: 'translate(-50%, -50%)',
              color: textOverlay.color,
              fontSize: textOverlay.fontSize,
              fontFamily: 'var(--font-display)',
              fontWeight: 900,
              textShadow: '0 2px 8px rgba(0,0,0,0.7), 0 0 20px rgba(0,0,0,0.4)',
              cursor: isDragging ? 'grabbing' : 'grab',
              userSelect: 'none',
              WebkitUserSelect: 'none',
              whiteSpace: 'pre-wrap',
              textAlign: 'center',
              maxWidth: '85%',
              lineHeight: 1.2,
              padding: '4px 8px',
              zIndex: 10,
            }}
          >
            {textOverlay.text}
          </div>
        )}

        {/* Remove text button */}
        {textOverlay && (
          <button
            onClick={() => setTextOverlay(null)}
            style={{
              position: 'absolute', top: 8, right: 8, zIndex: 11,
              width: 28, height: 28, borderRadius: '50%',
              background: 'rgba(0,0,0,0.7)', border: 'none',
              color: '#fff', fontSize: 12, cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}
          >
            {'\u2715'}
          </button>
        )}
      </div>

      {/* ═══ VIDEO TRIMMER ═══ */}
      {isVideo && duration > 0 && (
        <div style={{
          padding: '8px 16px',
          borderTop: '1px solid rgba(255,255,255,0.08)',
          background: '#0a0a0a',
        }}>
          <div style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            marginBottom: 6,
          }}>
            <span style={{ fontSize: 10, color: '#FFB800', fontFamily: 'var(--font-display)', letterSpacing: 1 }}>
              {'\u2702\uFE0F'} {t('editor.trim')}
            </span>
            <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.5)', fontFamily: 'var(--font-body)' }}>
              {fmt(trimStart)} — {fmt(trimEnd)} ({fmt(trimEnd - trimStart)})
            </span>
          </div>

          {/* Trim range (two range sliders) */}
          <div style={{ position: 'relative', height: 36 }}>
            {/* Track background */}
            <div style={{
              position: 'absolute', top: 14, left: 0, right: 0, height: 8,
              background: 'rgba(255,255,255,0.08)', borderRadius: 4,
            }} />
            {/* Active range highlight */}
            <div style={{
              position: 'absolute', top: 14, height: 8, borderRadius: 4,
              background: 'linear-gradient(90deg, #FFB800, #f59e0b)',
              left: `${(trimStart / duration) * 100}%`,
              width: `${((trimEnd - trimStart) / duration) * 100}%`,
            }} />
            {/* Current time indicator */}
            <div style={{
              position: 'absolute', top: 10, height: 16, width: 2,
              background: '#fff', borderRadius: 1,
              left: `${(currentTime / duration) * 100}%`,
              transition: 'left 0.1s linear',
            }} />
            {/* Start slider */}
            <input
              type="range" min={0} max={duration} step={0.1}
              value={trimStart}
              onChange={(e) => {
                const v = parseFloat(e.target.value)
                if (v < trimEnd - 1) setTrimStart(v)
              }}
              style={{
                position: 'absolute', top: 0, left: 0, width: '100%',
                height: 36, opacity: 0, cursor: 'pointer', zIndex: 2,
              }}
            />
            {/* End slider */}
            <input
              type="range" min={0} max={duration} step={0.1}
              value={trimEnd}
              onChange={(e) => {
                const v = parseFloat(e.target.value)
                if (v > trimStart + 1) setTrimEnd(v)
              }}
              style={{
                position: 'absolute', top: 0, left: 0, width: '100%',
                height: 36, opacity: 0, cursor: 'pointer', zIndex: 3,
              }}
            />
          </div>
        </div>
      )}

      {/* ═══ TEXT INPUT PANEL ═══ */}
      {showTextInput && (
        <div style={{
          padding: '12px 16px',
          borderTop: '1px solid rgba(255,255,255,0.08)',
          background: '#111',
        }}>
          <textarea
            value={textDraft}
            onChange={(e) => setTextDraft(e.target.value)}
            placeholder={t('editor.textPlaceholder')}
            maxLength={100}
            autoFocus
            style={{
              width: '100%', padding: '10px 12px', borderRadius: 10,
              background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,184,0,0.2)',
              color: '#fff', fontSize: 16, fontFamily: 'var(--font-body)',
              outline: 'none', resize: 'none', height: 60, boxSizing: 'border-box',
            }}
          />

          {/* Text size slider */}
          <div style={{
            display: 'flex', alignItems: 'center', gap: 8, marginTop: 8,
          }}>
            <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.5)' }}>A</span>
            <input
              type="range" min={14} max={48} value={textSize}
              onChange={(e) => setTextSize(parseInt(e.target.value))}
              style={{ flex: 1, accentColor: '#FFB800' }}
            />
            <span style={{ fontSize: 18, color: 'rgba(255,255,255,0.5)' }}>A</span>
          </div>

          {/* Color picker */}
          <div style={{
            display: 'flex', gap: 8, marginTop: 8, justifyContent: 'center',
            flexWrap: 'wrap',
          }}>
            {TEXT_COLORS.map(c => (
              <button
                key={c}
                onClick={() => setTextColor(c)}
                style={{
                  width: 28, height: 28, borderRadius: '50%',
                  background: c, border: textColor === c ? '3px solid #FFB800' : '2px solid rgba(255,255,255,0.2)',
                  cursor: 'pointer', transition: 'transform 0.15s',
                  transform: textColor === c ? 'scale(1.15)' : 'scale(1)',
                }}
              />
            ))}
          </div>

          <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
            <button
              onClick={() => { setShowTextInput(false); setTextDraft('') }}
              style={{
                flex: 1, padding: '10px', borderRadius: 10,
                background: 'rgba(255,255,255,0.06)', border: 'none',
                color: '#fff', fontSize: 13, fontFamily: 'var(--font-body)',
                cursor: 'pointer',
              }}
            >
              {t('editor.cancel')}
            </button>
            <button
              onClick={addText}
              disabled={!textDraft.trim()}
              style={{
                flex: 1, padding: '10px', borderRadius: 10,
                background: textDraft.trim() ? 'linear-gradient(135deg, #FFB800, #f59e0b)' : 'rgba(255,255,255,0.06)',
                border: 'none',
                color: textDraft.trim() ? '#060606' : 'rgba(255,255,255,0.3)',
                fontSize: 13, fontFamily: 'var(--font-display)',
                fontWeight: 800, letterSpacing: 1, cursor: textDraft.trim() ? 'pointer' : 'default',
              }}
            >
              {t('editor.addText')}
            </button>
          </div>
        </div>
      )}

      {/* ═══ TOOLS BAR ═══ */}
      {!showTextInput && (
        <div style={{
          padding: '10px 16px 14px',
          borderTop: '1px solid rgba(255,255,255,0.08)',
          background: '#0a0a0a',
        }}>
          {/* Tool buttons */}
          <div style={{
            display: 'flex', gap: 12, marginBottom: 10, justifyContent: 'center',
          }}>
            <button
              onClick={() => { setShowTextInput(true); setTextDraft(textOverlay?.text || '') }}
              style={{
                display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3,
                background: 'none', border: 'none', cursor: 'pointer', padding: '6px 12px',
              }}
            >
              <span style={{ fontSize: 22 }}>{'\u{1F524}'}</span>
              <span style={{ fontSize: 9, color: '#FFB800', fontFamily: 'var(--font-display)', letterSpacing: 1 }}>
                {t('editor.text')}
              </span>
            </button>
          </div>

          {/* Filter strip */}
          <div style={{
            display: 'flex', gap: 10, overflowX: 'auto', paddingBottom: 4,
            justifyContent: 'center',
          }}>
            {FILTERS.map(f => (
              <button
                key={f.key}
                onClick={() => setFilter(f.key)}
                style={{
                  display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4,
                  background: 'none', border: 'none', cursor: 'pointer',
                  padding: '4px 6px', minWidth: 52,
                  opacity: filter === f.key ? 1 : 0.5,
                  transition: 'opacity 0.2s',
                }}
              >
                <div style={{
                  width: 44, height: 44, borderRadius: 8, overflow: 'hidden',
                  border: filter === f.key ? '2px solid #FFB800' : '2px solid transparent',
                  background: '#222',
                }}>
                  {isVideo ? (
                    <video
                      src={previewUrl.current}
                      muted playsInline
                      style={{ width: '100%', height: '100%', objectFit: 'cover', filter: f.css }}
                    />
                  ) : (
                    <img
                      src={previewUrl.current}
                      alt=""
                      style={{ width: '100%', height: '100%', objectFit: 'cover', filter: f.css }}
                    />
                  )}
                </div>
                <span style={{
                  fontSize: 9, fontFamily: 'var(--font-display)',
                  color: filter === f.key ? '#FFB800' : 'rgba(255,255,255,0.5)',
                  fontWeight: 700, letterSpacing: 0.5,
                }}>
                  {f.label}
                </span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* ═══ EXPORT PROGRESS OVERLAY ═══ */}
      {exporting && (
        <div style={{
          position: 'absolute', inset: 0, zIndex: 20,
          background: 'rgba(6,6,6,0.85)', display: 'flex',
          flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 16,
        }}>
          <div style={{
            width: 64, height: 64, borderRadius: '50%',
            border: '3px solid rgba(255,184,0,0.2)',
            borderTopColor: '#FFB800',
            animation: 'editorSpin 0.8s linear infinite',
          }} />
          <span style={{
            fontFamily: 'var(--font-display)', fontSize: 14,
            color: '#FFB800', fontWeight: 800, letterSpacing: 2,
          }}>
            {t('editor.exporting')} {exportProgress}%
          </span>
          <div style={{
            width: '60%', height: 4, borderRadius: 2,
            background: 'rgba(255,255,255,0.08)',
          }}>
            <div style={{
              height: '100%', borderRadius: 2,
              background: 'linear-gradient(90deg, #FFB800, #f59e0b)',
              width: `${exportProgress}%`,
              transition: 'width 0.3s ease',
            }} />
          </div>
        </div>
      )}

      <style>{`
        @keyframes editorSpin {
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  )
}

/* ─── Helper: draw text overlay onto canvas ─── */
function drawTextOnCanvas(ctx: CanvasRenderingContext2D, overlay: TextOverlay, w: number, h: number) {
  const fontSize = Math.round(overlay.fontSize * (w / 375)) // Scale relative to 375px phone width
  ctx.save()
  ctx.font = `900 ${fontSize}px "Cinzel", serif`
  ctx.fillStyle = overlay.color
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.shadowColor = 'rgba(0,0,0,0.7)'
  ctx.shadowBlur = 8
  ctx.shadowOffsetY = 2

  const x = overlay.x * w
  const y = overlay.y * h
  const maxWidth = w * 0.85

  // Word wrap
  const lines = wrapText(ctx, overlay.text, maxWidth)
  const lineHeight = fontSize * 1.2
  const startY = y - ((lines.length - 1) * lineHeight) / 2

  lines.forEach((line, i) => {
    ctx.fillText(line, x, startY + i * lineHeight)
  })

  ctx.restore()
}

function wrapText(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string[] {
  const words = text.split(/\s+/)
  const lines: string[] = []
  let current = ''

  for (const word of words) {
    const test = current ? `${current} ${word}` : word
    if (ctx.measureText(test).width > maxWidth && current) {
      lines.push(current)
      current = word
    } else {
      current = test
    }
  }
  if (current) lines.push(current)
  return lines.length > 0 ? lines : ['']
}
