'use client'
import { useState, useEffect, useRef, useCallback } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { useAuth } from '@/contexts/AuthContext'
import { supabase } from '@/lib/supabase'

interface Msg {
  id: string
  sender_id: string
  content: string
  created_at: string
  read_at: string | null
}

function formatTime(iso: string) {
  const d = new Date(iso)
  return d.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })
}

export default function ChatConversationPage() {
  const { id: convoId } = useParams<{ id: string }>()
  const { profile } = useAuth()
  const router = useRouter()

  const [messages, setMessages] = useState<Msg[]>([])
  const [otherUser, setOtherUser] = useState<any>(null)
  const [text, setText] = useState('')
  const [sending, setSending] = useState(false)
  const [loading, setLoading] = useState(true)
  const bottomRef = useRef<HTMLDivElement>(null)
  const inputRef  = useRef<HTMLInputElement>(null)

  const scrollToBottom = useCallback(() => {
    setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: 'smooth' }), 50)
  }, [])

  const markRead = useCallback(async () => {
    if (!profile || !convoId) return
    // Mark all messages from the other user as read
    await supabase
      .from('messages')
      .update({ read_at: new Date().toISOString() })
      .eq('conversation_id', convoId)
      .neq('sender_id', profile.id)
      .is('read_at', null)
    // Reset unread counter on conversation
    const { data: convo } = await supabase
      .from('conversations').select('participant_1').eq('id', convoId).single()
    if (convo) {
      const col = convo.participant_1 === profile.id ? 'unread_1' : 'unread_2'
      await supabase.from('conversations').update({ [col]: 0 }).eq('id', convoId)
    }
  }, [profile, convoId])

  useEffect(() => {
    if (!profile || !convoId) return
    const init = async () => {
      // Load conversation + other participant
      const { data: convo } = await supabase
        .from('conversations')
        .select('participant_1, participant_2')
        .eq('id', convoId).single()
      if (!convo) { router.push('/app/chat'); return }

      const otherId = convo.participant_1 === profile.id ? convo.participant_2 : convo.participant_1
      const { data: other } = await supabase
        .from('profiles').select('id, username, display_name, level').eq('id', otherId).single()
      setOtherUser(other)

      // Load messages
      const { data: msgs } = await supabase
        .from('messages')
        .select('id, sender_id, content, created_at, read_at')
        .eq('conversation_id', convoId)
        .order('created_at', { ascending: true })
      setMessages(msgs || [])
      setLoading(false)
      await markRead()
      scrollToBottom()
    }
    init()
  }, [profile, convoId, router, markRead, scrollToBottom])

  // Realtime subscription
  useEffect(() => {
    if (!convoId) return
    const ch = supabase
      .channel(`chat_${convoId}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'messages', filter: `conversation_id=eq.${convoId}` },
        (payload) => {
          setMessages(prev => [...prev, payload.new as Msg])
          scrollToBottom()
          markRead()
        }
      )
      .subscribe()
    return () => { supabase.removeChannel(ch) }
  }, [convoId, markRead, scrollToBottom])

  const sendMessage = async () => {
    if (!text.trim() || !profile || sending) return
    const content = text.trim()
    setText('')
    setSending(true)

    const { data: msg, error } = await supabase
      .from('messages')
      .insert({ conversation_id: convoId, sender_id: profile.id, content })
      .select().single()

    if (!error && msg) {
      // Update conversation preview
      await supabase.from('conversations').update({
        last_message_preview: content.slice(0, 80),
        last_message_at: new Date().toISOString(),
      }).eq('id', convoId)
      // Increment other user's unread count
      const { data: convo } = await supabase
        .from('conversations').select('participant_1').eq('id', convoId).single()
      if (convo) {
        const col = convo.participant_1 === profile.id ? 'unread_2' : 'unread_1'
        try { await supabase.rpc('increment_unread', { convo_id: convoId, col_name: col }) } catch {}
      }
      // Insert notification for other user
      if (otherUser) {
        try {
          await supabase.from('notifications').insert({
            user_id: otherUser.id,
            type: 'new_message',
            title: profile.display_name || profile.username,
            body: content.slice(0, 60),
            reference_id: convoId,
          })
        } catch {}
      }
    }
    setSending(false)
  }

  const handleKey = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage() }
  }

  const initials = (u: any) => (u?.display_name || u?.username || 'U').slice(0, 2).toUpperCase()

  return (
    <div style={{ minHeight: '100dvh', background: '#060606', display: 'flex', flexDirection: 'column' }}>
      {/* Header */}
      <div style={{
        position: 'fixed', top: 0, left: '50%', transform: 'translateX(-50%)',
        width: '100%', maxWidth: 430, background: 'rgba(6,6,6,0.96)',
        backdropFilter: 'blur(20px)', borderBottom: '1px solid rgba(255,255,255,0.06)',
        padding: '12px 16px', zIndex: 100,
        display: 'flex', alignItems: 'center', gap: 12,
      }}>
        <button onClick={() => router.push('/app/chat')} style={{ background: 'none', border: 'none', color: 'rgba(240,236,228,0.5)', fontSize: 20, cursor: 'pointer', padding: 0 }}>←</button>
        {otherUser && (
          <>
            <div
              onClick={() => router.push(`/app/profile/${otherUser.username}`)}
              style={{ width: 38, height: 38, borderRadius: '50%', background: 'linear-gradient(135deg, #CC8800, #FFB800)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}
            >
              <span className="font-display" style={{ fontSize: 12, color: '#000', fontWeight: 700 }}>{initials(otherUser)}</span>
            </div>
            <div style={{ flex: 1 }} onClick={() => router.push(`/app/profile/${otherUser.username}`)} className="cursor-pointer">
              <p style={{ fontSize: 14, color: '#f0ece4', fontWeight: 600 }}>{otherUser.display_name || otherUser.username}</p>
              <p style={{ fontSize: 11, color: 'rgba(240,236,228,0.4)' }}>@{otherUser.username} · Lv.{otherUser.level}</p>
            </div>
          </>
        )}
      </div>

      {/* Messages */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '80px 16px 90px', display: 'flex', flexDirection: 'column', gap: 8 }}>
        {loading ? (
          <div style={{ display: 'flex', justifyContent: 'center', paddingTop: 40 }}>
            <div style={{ width: 24, height: 24, border: '2px solid transparent', borderTopColor: '#FFB800', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
            <style>{'@keyframes spin{to{transform:rotate(360deg)}}'}</style>
          </div>
        ) : messages.length === 0 ? (
          <div style={{ textAlign: 'center', paddingTop: 60 }}>
            <p style={{ fontSize: 13, color: 'rgba(240,236,228,0.3)', fontFamily: 'Crimson Text, serif' }}>
              Noch keine Nachrichten. Schreib etwas!
            </p>
          </div>
        ) : (
          messages.map((msg, i) => {
            const isMine = msg.sender_id === profile?.id
            const showTime = i === 0 || new Date(msg.created_at).getTime() - new Date(messages[i - 1].created_at).getTime() > 300000
            return (
              <div key={msg.id}>
                {showTime && (
                  <p style={{ textAlign: 'center', fontSize: 10, color: 'rgba(240,236,228,0.25)', fontFamily: 'Cinzel, serif', letterSpacing: 1, margin: '8px 0 4px' }}>
                    {formatTime(msg.created_at)}
                  </p>
                )}
                <div style={{ display: 'flex', justifyContent: isMine ? 'flex-end' : 'flex-start' }}>
                  <div style={{
                    maxWidth: '72%', padding: '10px 14px', borderRadius: isMine ? '18px 18px 4px 18px' : '18px 18px 18px 4px',
                    background: isMine ? 'linear-gradient(135deg, #CC8800, #FFB800)' : '#1A1A1A',
                    border: isMine ? 'none' : '1px solid rgba(255,255,255,0.07)',
                  }}>
                    <p style={{ fontSize: 14, color: isMine ? '#000' : '#f0ece4', lineHeight: 1.5, fontFamily: 'Crimson Text, serif', margin: 0 }}>
                      {msg.content}
                    </p>
                  </div>
                </div>
              </div>
            )
          })
        )}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div style={{
        position: 'fixed', bottom: 0, left: '50%', transform: 'translateX(-50%)',
        width: '100%', maxWidth: 430, background: 'rgba(6,6,6,0.97)',
        backdropFilter: 'blur(20px)', borderTop: '1px solid rgba(255,255,255,0.06)',
        padding: '12px 16px calc(12px + env(safe-area-inset-bottom))',
        display: 'flex', alignItems: 'center', gap: 10,
      }}>
        <input
          ref={inputRef}
          value={text}
          onChange={e => setText(e.target.value)}
          onKeyDown={handleKey}
          placeholder="Nachricht…"
          maxLength={2000}
          style={{
            flex: 1, padding: '12px 16px', background: '#151515',
            border: '1px solid rgba(255,255,255,0.08)', borderRadius: 24,
            color: '#f0ece4', fontSize: 15, fontFamily: 'Crimson Text, serif', outline: 'none',
          }}
        />
        <button
          onClick={sendMessage}
          disabled={!text.trim() || sending}
          style={{
            width: 44, height: 44, borderRadius: '50%', border: 'none', cursor: 'pointer',
            background: text.trim() ? 'linear-gradient(135deg, #CC8800, #FFB800)' : '#1A1A1A',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 18, transition: 'background 0.2s', flexShrink: 0,
          }}
        >
          {sending ? '⏳' : '↑'}
        </button>
      </div>
    </div>
  )
}