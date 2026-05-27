'use client'
import { useState, useEffect, useRef, useCallback } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { useAuth } from '@/contexts/AuthContext'
import { supabase } from '@/lib/supabase'
import ProfileImage from '@/components/ProfileImage'
import { triggerPush } from '@/lib/sendPushNotification'
import { useLang } from '@/contexts/LanguageContext'

/* ───── Types ───── */
interface Msg {
  id: string
  sender_id: string
  content: string
  created_at: string
  read_at: string | null
  message_type: string
  media_url: string | null
  reply_to_id: string | null
  reply_preview: string | null
}

/* ───── Helpers ───── */
function formatTime(iso: string) {
  return new Date(iso).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })
}

function formatDateLabel(iso: string, t: (key: string) => string) {
  const d = new Date(iso)
  const now = new Date()
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const msgDay = new Date(d.getFullYear(), d.getMonth(), d.getDate())
  const diff = (today.getTime() - msgDay.getTime()) / 86400000
  if (diff === 0) return t('chat.today')
  if (diff === 1) return t('chat.yesterday')
  return d.toLocaleDateString(undefined, { day: '2-digit', month: '2-digit', year: 'numeric' })
}

function timeAgoPresence(iso: string, t: (key: string) => string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const m = Math.floor(diff / 60000)
  if (m < 1) return t('chat.justNow')
  if (m < 60) return t('chat.minutesAgo').replace('{n}', String(m))
  const h = Math.floor(m / 60)
  if (h < 24) return t('chat.hoursAgo').replace('{n}', String(h))
  return t('chat.daysAgo').replace('{n}', String(Math.floor(h / 24)))
}

/** Compress image before upload */
async function compressImage(file: File, maxSize = 800, quality = 0.8): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => {
      const canvas = document.createElement('canvas')
      let w = img.width, h = img.height
      if (w > h) { if (w > maxSize) { h = Math.round(h * maxSize / w); w = maxSize } }
      else       { if (h > maxSize) { w = Math.round(w * maxSize / h); h = maxSize } }
      canvas.width = w; canvas.height = h
      canvas.getContext('2d')!.drawImage(img, 0, 0, w, h)
      canvas.toBlob(b => b ? resolve(b) : reject(new Error('compress fail')), 'image/jpeg', quality)
    }
    img.onerror = () => reject(new Error('img load fail'))
    img.src = URL.createObjectURL(file)
  })
}

/* ───── Check Icons (Read Receipts) ───── */
function ReadReceipt({ read }: { read: boolean }) {
  return (
    <span style={{ fontSize: 11, marginLeft: 4, opacity: read ? 1 : 0.5 }}>
      <span style={{ color: read ? 'var(--gold-primary)' : 'var(--text-muted)' }}>✓✓</span>
    </span>
  )
}

const PAGE_SIZE = 50

/* ───── Main Component ───── */
export default function ChatConversationPage() {
  const { id: convoId } = useParams<{ id: string }>()
  const { profile } = useAuth()
  const router = useRouter()
  const { t } = useLang()

  const [messages, setMessages] = useState<Msg[]>([])
  const [otherUser, setOtherUser] = useState<any>(null)
  const [text, setText] = useState('')
  const [sending, setSending] = useState(false)
  const [loading, setLoading] = useState(true)
  const [isOnline, setIsOnline] = useState(false)
  const [lastSeen, setLastSeen] = useState<string | null>(null)
  const [isTyping, setIsTyping] = useState(false)
  const [replyTo, setReplyTo] = useState<Msg | null>(null)
  const [mediaPreview, setMediaPreview] = useState<string | null>(null)
  const [hasMore, setHasMore] = useState(false)
  const [loadingMore, setLoadingMore] = useState(false)
  const [toast, setToast] = useState<string | null>(null)

  const showToast = (msg: string) => { setToast(msg); setTimeout(() => setToast(null), 3000) }

  const bottomRef = useRef<HTMLDivElement>(null)
  const messagesRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const fileRef = useRef<HTMLInputElement>(null)
  const typingTimeout = useRef<ReturnType<typeof setTimeout> | null>(null)
  const touchStartX = useRef(0)

  const scrollToBottom = useCallback(() => {
    setTimeout(() => {
      if (messagesRef.current) {
        messagesRef.current.scrollTop = messagesRef.current.scrollHeight
      }
    }, 50)
  }, [])

  /* ── Mark messages as read ── */
  const markRead = useCallback(async () => {
    if (!profile || !convoId) return
    await supabase.from('messages')
      .update({ read_at: new Date().toISOString() })
      .eq('conversation_id', convoId)
      .neq('sender_id', profile.id)
      .is('read_at', null)
    const { data: convo } = await supabase
      .from('conversations').select('participant_1').eq('id', convoId).single()
    if (convo) {
      const col = convo.participant_1 === profile.id ? 'unread_1' : 'unread_2'
      await supabase.from('conversations').update({ [col]: 0 }).eq('id', convoId)
    }
  }, [profile, convoId])

  /* ── Load conversation — ALL QUERIES PARALLEL ── */
  useEffect(() => {
    if (!profile || !convoId) return
    const init = async () => {
      try {
      // Step 1: Get conversation to find the other participant
      const { data: convo, error: convoErr } = await supabase
        .from('conversations').select('participant_1, participant_2')
        .eq('id', convoId).single()
      if (convoErr || !convo) { console.error('Conversation load failed:', convoErr); router.push('/app/chat'); return }

      const otherId = convo.participant_1 === profile.id ? convo.participant_2 : convo.participant_1

      // Step 2: PARALLEL — load other user + presence + messages all at once
      const [otherRes, presenceRes, msgsRes] = await Promise.all([
        supabase.from('profiles').select('id, username, display_name, level, avatar_url').eq('id', otherId).single(),
        supabase.from('user_presence').select('is_online, last_seen').eq('user_id', otherId).maybeSingle(),
        supabase.from('messages')
          .select('id, sender_id, content, created_at, read_at, message_type, media_url, reply_to_id, reply_preview')
          .eq('conversation_id', convoId)
          .order('created_at', { ascending: false })
          .limit(PAGE_SIZE),
      ])

      if (otherRes.data) setOtherUser(otherRes.data)
      if (presenceRes.data) {
        setIsOnline(presenceRes.data.is_online)
        setLastSeen(presenceRes.data.last_seen)
      }

      // Reverse messages to show oldest first
      const msgs = (msgsRes.data || []).reverse()
      setMessages(msgs)
      setHasMore((msgsRes.data || []).length === PAGE_SIZE)
      setLoading(false)

      // Mark read in background (don't await)
      markRead()
      scrollToBottom()
      } catch (err) {
        console.error('Chat init error:', err)
        setLoading(false)
      }
    }
    init()
  }, [profile, convoId, router, markRead, scrollToBottom])

  /* ── Load older messages ── */
  const loadOlderMessages = async () => {
    if (loadingMore || !messages.length) return
    setLoadingMore(true)
    const oldestMsg = messages[0]
    const { data } = await supabase.from('messages')
      .select('id, sender_id, content, created_at, read_at, message_type, media_url, reply_to_id, reply_preview')
      .eq('conversation_id', convoId)
      .lt('created_at', oldestMsg.created_at)
      .order('created_at', { ascending: false })
      .limit(PAGE_SIZE)

    if (data && data.length > 0) {
      setMessages(prev => [...data.reverse(), ...prev])
      setHasMore(data.length === PAGE_SIZE)
    } else {
      setHasMore(false)
    }
    setLoadingMore(false)
  }

  /* ── Realtime: messages ── */
  useEffect(() => {
    if (!convoId) return
    const channelName = `chat_${convoId}`
    const ch = supabase.channel(channelName)
      .on('postgres_changes', {
        event: 'INSERT', schema: 'public', table: 'messages',
        filter: `conversation_id=eq.${convoId}`,
      }, (payload: any) => {
        const newMsg = payload.new as Msg
        // Deduplicate: skip if message already exists (e.g. sender's own message)
        setMessages(prev => {
          if (prev.some(m => m.id === newMsg.id)) return prev
          return [...prev, newMsg]
        })
        scrollToBottom()
        markRead()
      })
      .on('postgres_changes', {
        event: 'UPDATE', schema: 'public', table: 'messages',
        filter: `conversation_id=eq.${convoId}`,
      }, (payload: any) => {
        setMessages(prev => prev.map(m => m.id === (payload.new as Msg).id ? { ...m, ...(payload.new as Msg) } : m))
      })
      .subscribe()
    return () => { supabase.removeChannel(ch) }
  }, [convoId, markRead, scrollToBottom])

  /* ── Realtime: presence ── */
  useEffect(() => {
    if (!otherUser) return
    const ch = supabase.channel(`presence_${otherUser.id}`)
      .on('postgres_changes', {
        event: '*', schema: 'public', table: 'user_presence',
        filter: `user_id=eq.${otherUser.id}`,
      }, (payload: any) => {
        setIsOnline(payload.new?.is_online ?? false)
        setLastSeen(payload.new?.last_seen ?? null)
      })
      .subscribe()
    return () => { supabase.removeChannel(ch) }
  }, [otherUser])

  /* ── Realtime: typing indicator ── */
  useEffect(() => {
    if (!otherUser || !convoId) return
    const ch = supabase.channel(`typing_${convoId}`)
      .on('postgres_changes', {
        event: '*', schema: 'public', table: 'typing_indicators',
        filter: `conversation_id=eq.${convoId}`,
      }, (payload: any) => {
        if (payload.new?.user_id === otherUser.id) {
          setIsTyping(true)
          setTimeout(() => setIsTyping(false), 4000)
        }
        if (payload.eventType === 'DELETE' && payload.old?.user_id === otherUser.id) {
          setIsTyping(false)
        }
      })
      .subscribe()
    return () => { supabase.removeChannel(ch) }
  }, [otherUser, convoId])

  /* ── Typing indicator: emit ── */
  const emitTyping = useCallback(async () => {
    if (!profile || !convoId) return
    await supabase.from('typing_indicators').upsert({
      user_id: profile.id,
      conversation_id: convoId,
      started_at: new Date().toISOString(),
    }, { onConflict: 'user_id,conversation_id' })

    if (typingTimeout.current) clearTimeout(typingTimeout.current)
    typingTimeout.current = setTimeout(async () => {
      await supabase.from('typing_indicators')
        .delete().eq('user_id', profile.id).eq('conversation_id', convoId)
    }, 3000)
  }, [profile, convoId])

  /* ── Send message ── */
  const sendMessage = async (mediaUrl?: string, msgType?: string) => {
    if (!profile || sending) return
    const content = text.trim()
    if (!content && !mediaUrl) return

    setText('')
    setSending(true)
    const replyRef = replyTo
    setReplyTo(null)

    // Clear typing
    supabase.from('typing_indicators')
      .delete().eq('user_id', profile.id).eq('conversation_id', convoId)

    const msgPayload = {
      conversation_id: convoId,
      sender_id: profile.id,
      content: mediaUrl ? (content || '') : content,
      message_type: msgType || 'text',
      media_url: mediaUrl || null,
      reply_to_id: replyRef?.id || null,
      reply_preview: replyRef ? (replyRef.content || '').slice(0, 60) : null,
    }

    const { data: insertedMsg, error } = await supabase.from('messages')
      .insert(msgPayload)
      .select('id, sender_id, content, created_at, read_at, message_type, media_url, reply_to_id, reply_preview')
      .single()

    if (error || !insertedMsg) {
      console.error('Send message failed:', error)
      showToast(`❌ ${t('chat.sendFailed')}`)
      setText(content) // restore text so user can retry
      setSending(false)
      return
    }

    // Optimistically add the sent message to local state (dedup in realtime handler prevents doubles)
    setMessages(prev => {
      if (prev.some(m => m.id === insertedMsg.id)) return prev
      return [...prev, insertedMsg as Msg]
    })
    scrollToBottom()

    {
      const preview = mediaUrl ? (msgType === 'video' ? `🎥 ${t('chat.video')}` : `📷 ${t('chat.photo')}`) : content.slice(0, 80)

      // Parallel: update conversation + send push (don't block UI)
      const updateConvo = supabase.from('conversations').update({
        last_message_preview: preview,
        last_message_at: new Date().toISOString(),
      }).eq('id', convoId)

      const incrementUnread = (async () => {
        const { data: convo } = await supabase
          .from('conversations').select('participant_1').eq('id', convoId).single()
        if (convo) {
          const col = convo.participant_1 === profile.id ? 'unread_2' : 'unread_1'
          try { await supabase.rpc('increment_unread', { convo_id: convoId, col_name: col }) } catch {}
        }
      })()

      const sendNotif = (async () => {
        if (otherUser) {
          try {
            await supabase.from('notifications').insert({
              user_id: otherUser.id,
              type: 'new_message',
              title: profile.display_name || profile.username,
              body: preview.slice(0, 60),
              reference_id: convoId,
            })
          } catch {}
          const pushPreview = (mediaUrl ? (msgType === 'video' ? `🎥 ${t('chat.video')}` : `📷 ${t('chat.photo')}`) : content).substring(0, 50)
          triggerPush(otherUser.id, `💬 ${profile.display_name || profile.username}`, pushPreview, `/app/chat/${convoId}`)
        }
      })()

      // Fire all in parallel, don't await
      Promise.all([updateConvo, incrementUnread, sendNotif]).catch(() => {})
    }
    setSending(false)
  }

  /* ── Media upload ── */
  const handleMediaPick = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file || !profile) return
    e.target.value = ''

    const isVideo = file.type.startsWith('video/')
    const isImage = file.type.startsWith('image/')
    if (!isImage && !isVideo) return

    try {
      let uploadFile: Blob = file
      if (isImage) uploadFile = await compressImage(file)

      const ext = isVideo ? 'mp4' : 'jpg'
      const path = `${convoId}/${crypto.randomUUID()}.${ext}`
      const { error: upErr } = await supabase.storage
        .from('chat-media').upload(path, uploadFile, {
          contentType: isVideo ? 'video/mp4' : 'image/jpeg',
        })
      if (upErr) throw upErr

      const { data: urlData } = supabase.storage.from('chat-media').getPublicUrl(path)
      await sendMessage(urlData.publicUrl, isVideo ? 'video' : 'image')
    } catch (_err) {
      console.error('Media upload failed:', _err)
      showToast(`❌ ${t('chat.uploadFailed')}`)
    }
  }

  /* ── Swipe to reply ── */
  const handleTouchStart = (e: React.TouchEvent, msg: Msg) => {
    touchStartX.current = e.touches[0].clientX
  }
  const handleTouchEnd = (e: React.TouchEvent, msg: Msg) => {
    const diff = e.changedTouches[0].clientX - touchStartX.current
    if (diff > 60) {
      setReplyTo(msg)
      inputRef.current?.focus()
    }
  }

  const handleKey = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage() }
  }

  /* ── Windowing: only render last 100 messages to avoid DOM bloat ── */
  const RENDER_WINDOW = 100
  const visibleMessages = messages.length > RENDER_WINDOW ? messages.slice(-RENDER_WINDOW) : messages

  /* ── Render helpers (operate on visibleMessages) ── */
  const shouldShowDate = (idx: number): boolean => {
    if (idx === 0) return true
    const prev = new Date(visibleMessages[idx - 1].created_at)
    const curr = new Date(visibleMessages[idx].created_at)
    return prev.toDateString() !== curr.toDateString()
  }

  const shouldShowTime = (idx: number): boolean => {
    if (idx === 0) return true
    return new Date(visibleMessages[idx].created_at).getTime() - new Date(visibleMessages[idx - 1].created_at).getTime() > 300000
  }

  return (
    <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'var(--bg-base)', zIndex: 98 }}>
    <div style={{ maxWidth: 430, margin: '0 auto', height: '100%', display: 'flex', flexDirection: 'column', position: 'relative' }}>
      {/* ── Header ── */}
      <div style={{
        position: 'fixed', top: 0, left: '50%', transform: 'translateX(-50%)',
        width: '100%', maxWidth: 430, background: 'var(--bg-base)',
        backdropFilter: 'blur(20px)', borderBottom: '1px solid var(--border-subtle)',
        padding: 'calc(env(safe-area-inset-top) + 12px) 16px 12px 16px', zIndex: 101,
        display: 'flex', alignItems: 'center', gap: 12,
      }}>
        <button onClick={() => router.back()} style={{
          background: 'none', border: 'none', cursor: 'pointer', padding: 4,
        }}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--text-primary)" strokeWidth="2" strokeLinecap="round">
            <polyline points="15 18 9 12 15 6" />
          </svg>
        </button>
        {otherUser && (
          <>
            <ProfileImage
              size={38}
              avatarUrl={otherUser.avatar_url}
              name={otherUser.username}
              goldBorder
              online={isOnline}
              onClick={() => router.push(`/app/profile/${otherUser.username}`)}
            />
            <div style={{ flex: 1, cursor: 'pointer' }} onClick={() => router.push(`/app/profile/${otherUser.username}`)}>
              <p style={{ fontSize: 14, color: 'var(--text-primary)', fontWeight: 600 }}>
                {otherUser.display_name || otherUser.username}
              </p>
              <p style={{ fontSize: 11, color: isOnline ? 'var(--status-active)' : 'var(--text-secondary)' }}>
                {isOnline ? t('chat.online') : lastSeen ? `${t('chat.lastOnline')} ${timeAgoPresence(lastSeen, t)}` : `@${otherUser.username}`}
              </p>
            </div>
          </>
        )}
      </div>

      {/* ── Messages ── */}
      <div ref={messagesRef} style={{ flex: 1, overflowY: 'auto', padding: 'calc(env(safe-area-inset-top) + 70px) 16px 140px', display: 'flex', flexDirection: 'column', gap: 4 }}>
        {loading ? (
          <div style={{ display: 'flex', justifyContent: 'center', paddingTop: 40 }}>
            <div style={{ width: 24, height: 24, border: '2px solid transparent', borderTopColor: 'var(--gold-primary)', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
            <style>{'@keyframes spin{to{transform:rotate(360deg)}}'}</style>
          </div>
        ) : (
          <>
            {/* Load more button */}
            {hasMore && (
              <button
                onClick={loadOlderMessages}
                disabled={loadingMore}
                style={{
                  alignSelf: 'center', padding: '6px 16px', borderRadius: 20,
                  background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)',
                  color: 'var(--text-secondary)', fontSize: 11, cursor: 'pointer',
                  fontFamily: 'var(--font-display)', letterSpacing: 1, marginBottom: 8,
                }}
              >
                {loadingMore ? '...' : `↑ ${t('chat.olderMessages')}`}
              </button>
            )}

            {visibleMessages.length === 0 ? (
              <div style={{ textAlign: 'center', paddingTop: 60 }}>
                <p style={{ fontSize: 13, color: 'var(--text-muted)', fontFamily: 'Crimson Text, serif' }}>
                  {t('chat.noMessages')}
                </p>
              </div>
            ) : (
              visibleMessages.map((msg, i) => {
                const isMine = msg.sender_id === profile?.id
                const showDate = shouldShowDate(i)
                const showTime = shouldShowTime(i)

                return (
                  <div key={msg.id}>
                    {/* Date separator */}
                    {showDate && (
                      <div style={{ textAlign: 'center', margin: '16px 0 8px' }}>
                        <span style={{
                          fontSize: 10, fontFamily: 'var(--font-display)', letterSpacing: 2,
                          color: 'var(--text-muted)', background: 'var(--bg-overlay)',
                          padding: '4px 14px', borderRadius: 10,
                        }}>
                          {formatDateLabel(msg.created_at, t)}
                        </span>
                      </div>
                    )}

                    {/* Time label */}
                    {showTime && !showDate && (
                      <p style={{ textAlign: 'center', fontSize: 10, color: 'var(--text-muted)', fontFamily: 'var(--font-display)', letterSpacing: 1, margin: '8px 0 4px' }}>
                        {formatTime(msg.created_at)}
                      </p>
                    )}

                    {/* Message bubble */}
                    <div
                      style={{ display: 'flex', justifyContent: isMine ? 'flex-end' : 'flex-start' }}
                      onTouchStart={e => handleTouchStart(e, msg)}
                      onTouchEnd={e => handleTouchEnd(e, msg)}
                    >
                      <div style={{
                        maxWidth: '78%', borderRadius: isMine ? '18px 18px 4px 18px' : '18px 18px 18px 4px',
                        background: isMine ? 'linear-gradient(135deg, var(--gold-dim), var(--gold-primary))' : 'var(--bg-surface)',
                        border: isMine ? 'none' : '1px solid var(--border-subtle)',
                        overflow: 'hidden',
                      }}>
                        {/* Reply preview */}
                        {msg.reply_preview && (
                          <div style={{
                            padding: '6px 12px', margin: msg.message_type !== 'text' ? 0 : undefined,
                            background: isMine ? 'rgba(0,0,0,0.12)' : 'var(--gold-subtle)',
                            borderLeft: `3px solid ${isMine ? 'rgba(0,0,0,0.3)' : 'var(--gold-primary)'}`,
                          }}>
                            <p style={{ fontSize: 11, color: isMine ? 'rgba(0,0,0,0.5)' : 'var(--text-secondary)', margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                              {msg.reply_preview}
                            </p>
                          </div>
                        )}

                        {/* Media content — lazy loading */}
                        {msg.message_type === 'image' && msg.media_url && (
                          <img
                            src={msg.media_url}
                            alt={t('chat.image')}
                            loading="lazy"
                            onClick={() => setMediaPreview(msg.media_url)}
                            style={{ width: '100%', maxWidth: 260, display: 'block', cursor: 'pointer', borderRadius: msg.content ? 0 : undefined }}
                            onError={(e) => { (e.target as HTMLImageElement).style.display = 'none' }}
                          />
                        )}
                        {msg.message_type === 'video' && msg.media_url && (
                          <video
                            src={msg.media_url}
                            controls
                            preload="none"
                            playsInline
                            style={{ width: '100%', maxWidth: 260, display: 'block' }}
                          />
                        )}

                        {/* Text content */}
                        {(msg.content || msg.message_type === 'text') && (
                          <div style={{ padding: '10px 14px', display: 'flex', alignItems: 'flex-end', gap: 4 }}>
                            <p style={{
                              fontSize: 14, color: isMine ? 'var(--text-inverse)' : 'var(--text-primary)', lineHeight: 1.5,
                              fontFamily: 'Crimson Text, serif', margin: 0, flex: 1, wordBreak: 'break-word',
                            }}>
                              {msg.content}
                            </p>
                            <span style={{ fontSize: 9, color: isMine ? 'rgba(0,0,0,0.4)' : 'var(--text-muted)', whiteSpace: 'nowrap', flexShrink: 0 }}>
                              {formatTime(msg.created_at)}
                              {isMine && <ReadReceipt read={!!msg.read_at} />}
                            </span>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                )
              })
            )}
          </>
        )}

        {/* Typing indicator */}
        {isTyping && (
          <div style={{ display: 'flex', justifyContent: 'flex-start', marginTop: 4 }}>
            <div style={{
              padding: '10px 16px', borderRadius: '18px 18px 18px 4px',
              background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)',
            }}>
              <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
                {[0, 1, 2].map(i => (
                  <div key={i} style={{
                    width: 6, height: 6, borderRadius: '50%', background: 'var(--gold-primary)',
                    animation: `typingBounce 1.2s ease-in-out ${i * 0.2}s infinite`,
                  }} />
                ))}
              </div>
              <style>{`@keyframes typingBounce { 0%, 60%, 100% { transform: translateY(0); opacity: 0.4; } 30% { transform: translateY(-4px); opacity: 1; } }`}</style>
            </div>
          </div>
        )}

        <div ref={bottomRef} />
      </div>

      {/* ── Reply bar ── */}
      {replyTo && (
        <div style={{
          position: 'fixed', bottom: 130, left: '50%', transform: 'translateX(-50%)',
          width: '100%', maxWidth: 430, background: 'var(--bg-surface)',
          borderTop: '1px solid var(--gold-glow)',
          padding: '8px 16px', paddingBottom: 'max(8px, env(safe-area-inset-bottom))',
          display: 'flex', alignItems: 'center', gap: 10, zIndex: 51,
        }}>
          <div style={{ flex: 1, borderLeft: '3px solid var(--gold-primary)', paddingLeft: 10, overflow: 'hidden' }}>
            <p style={{ fontSize: 10, color: 'var(--gold-primary)', margin: 0, fontWeight: 600 }}>{t('chat.reply')}</p>
            <p style={{ fontSize: 12, color: 'var(--text-secondary)', margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {replyTo.content || (replyTo.message_type === 'image' ? `📷 ${t('chat.photo')}` : `🎥 ${t('chat.video')}`)}
            </p>
          </div>
          <button onClick={() => setReplyTo(null)} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', fontSize: 16, cursor: 'pointer', padding: 4 }}>✕</button>
        </div>
      )}

      {/* ── Input bar ── */}
      <div style={{
        position: 'fixed', bottom: 72, left: '50%', transform: 'translateX(-50%)',
        width: '100%', maxWidth: 430, background: 'var(--bg-base)',
        backdropFilter: 'blur(20px)', borderTop: '1px solid var(--border-subtle)',
        padding: '10px 16px', paddingBottom: 'max(10px, env(safe-area-inset-bottom))',
        display: 'flex', alignItems: 'center', gap: 8, zIndex: 50,
      }}>
        {/* Media button */}
        <button onClick={() => fileRef.current?.click()} style={{
          width: 40, height: 40, borderRadius: '50%', border: 'none',
          background: 'var(--bg-elevated)', cursor: 'pointer',
          display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
        }}>
          <span style={{ fontSize: 18 }}>📷</span>
        </button>
        <input ref={fileRef} type="file" accept="image/*,video/*" style={{ display: 'none' }} onChange={handleMediaPick} />
        <input id="chatCameraInput" type="file" accept="image/*,video/*" capture="environment" style={{ display: 'none' }} onChange={handleMediaPick} />

        <input
          ref={inputRef}
          value={text}
          onChange={e => { setText(e.target.value); emitTyping() }}
          onKeyDown={handleKey}
          placeholder={t('chat.messagePlaceholder')}
          maxLength={2000}
          style={{
            flex: 1, padding: '12px 16px', background: 'var(--bg-elevated)',
            border: '1px solid var(--border-subtle)', borderRadius: 24,
            color: 'var(--text-primary)', fontSize: 15, fontFamily: 'Crimson Text, serif', outline: 'none',
          }}
        />
        <button
          onClick={() => sendMessage()}
          disabled={!text.trim() || sending}
          style={{
            width: 44, height: 44, borderRadius: '50%', border: 'none', cursor: 'pointer',
            background: text.trim() ? 'linear-gradient(135deg, var(--gold-dim), var(--gold-primary))' : 'var(--bg-elevated)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 18, transition: 'background 0.2s', flexShrink: 0,
          }}
        >
          {sending ? '⏳' : '↑'}
        </button>
      </div>

      {/* ── Error toast ── */}
      {toast && (
        <div style={{
          position: 'fixed', bottom: 180, left: '50%', transform: 'translateX(-50%)',
          background: 'var(--bg-elevated)', border: '1px solid var(--border-subtle)',
          borderRadius: 12, padding: '10px 20px', zIndex: 200,
          color: 'var(--text-primary)', fontSize: 13, fontFamily: 'var(--font-body)',
          boxShadow: '0 4px 24px rgba(0,0,0,0.5)',
          animation: 'fadeIn 0.2s ease',
        }}>
          {toast}
        </div>
      )}

      {/* ── Media preview overlay ── */}
      {mediaPreview && (
        <div
          onClick={() => setMediaPreview(null)}
          style={{
            position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.95)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 500,
          }}
        >
          <img src={mediaPreview} alt={t('chat.preview')} style={{ maxWidth: '90%', maxHeight: '85vh', borderRadius: 8 }} />
          <button style={{
            position: 'absolute', top: 20, right: 20,
            background: 'rgba(255,255,255,0.1)', border: 'none', color: 'var(--text-inverse)',
            width: 40, height: 40, borderRadius: '50%', fontSize: 20, cursor: 'pointer',
          }}>✕</button>
        </div>
      )}
    </div>
    </div>
  )
}
