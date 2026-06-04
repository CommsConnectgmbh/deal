'use client';
/**
 * SupportCenter — portable, self-contained support widget.
 *
 * Stack-agnostic: works in Next.js (Obacht, Simvi, Belegify) and Vite/React
 * (CommsOS, Swing & Savor, DealBuddy). No CSS framework dependency — all styles
 * inline, themed via the `brandColor` prop.
 *
 * Source of truth is Supabase (RLS-scoped). Create/reply go through edge functions;
 * reads happen directly through the host app's authenticated supabase client.
 *
 * Usage:
 *   <SupportCenter supabase={supabase} appLabel="Obacht" brandColor="#06b6d4" />
 */
import { useCallback, useEffect, useMemo, useState } from 'react';
import type { CSSProperties, FormEvent } from 'react';
import type { SupabaseClient } from '@supabase/supabase-js';

// The host app passes its own typed SupabaseClient. A per-app Database generic
// (SupabaseClient<Database>) is assignable to the default-generic SupabaseClient,
// so this stays portable without resorting to `any`.
type SupabaseLike = SupabaseClient;

type Ticket = {
  id: string;
  subject: string;
  status: keyof typeof STATUS;
  last_activity_at: string;
  created_at: string;
};
type Message = { id: string; author: 'user' | 'support'; body: string; created_at: string };

const STATUS = {
  received:     { label: 'Eingegangen',    color: '#6b7280' },
  in_progress:  { label: 'In Bearbeitung',  color: '#2563eb' },
  waiting_user: { label: 'Wartet auf dich', color: '#d97706' },
  resolved:     { label: 'Gelöst',          color: '#16a34a' },
  closed:       { label: 'Geschlossen',     color: '#9ca3af' },
} as const;

function StatusBadge({ status }: { status: keyof typeof STATUS }) {
  const s = STATUS[status] ?? STATUS.received;
  return (
    <span style={{
      display: 'inline-block', padding: '2px 10px', borderRadius: 999, fontSize: 12,
      fontWeight: 600, color: '#fff', background: s.color, whiteSpace: 'nowrap',
    }}>{s.label}</span>
  );
}

function fmt(d: string) {
  try {
    return new Date(d).toLocaleString('de-DE', {
      day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit',
    });
  } catch { return d; }
}

export type SupportCenterProps = {
  supabase: SupabaseLike;
  appLabel: string;
  brandColor?: string;
  /** Extra context attached to new tickets (app version, route, platform, ...). */
  context?: Record<string, unknown>;
};

export default function SupportCenter({
  supabase, appLabel, brandColor = '#2563eb', context,
}: SupportCenterProps) {
  const [view, setView] = useState<'list' | 'new' | 'detail'>('list');
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [active, setActive] = useState<Ticket | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const baseContext = useMemo(() => ({
    ...(context ?? {}),
    ...(typeof window !== 'undefined'
      ? { route: window.location?.pathname, ua: navigator?.userAgent }
      : {}),
  }), [context]);

  const loadTickets = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('support_tickets')
      .select('id,subject,status,last_activity_at,created_at')
      .order('last_activity_at', { ascending: false });
    if (error) setError('Konnte Anfragen nicht laden.');
    else { setTickets(data ?? []); setError(null); }
    setLoading(false);
  }, [supabase]);

  const loadMessages = useCallback(async (ticketId: string) => {
    const { data } = await supabase
      .from('support_ticket_messages')
      .select('id,author,body,created_at')
      .eq('ticket_id', ticketId)
      .order('created_at', { ascending: true });
    setMessages(data ?? []);
  }, [supabase]);

  // Kick loads off a microtask so no state is set synchronously inside the effect.
  useEffect(() => { queueMicrotask(() => { void loadTickets(); }); }, [loadTickets]);
  useEffect(() => {
    if (view !== 'detail' || !active) return;
    queueMicrotask(() => { void loadMessages(active.id); });
    const t = setInterval(() => { void loadMessages(active.id); }, 15000); // light poll while open
    return () => clearInterval(t);
  }, [view, active, loadMessages]);

  const openTicket = (t: Ticket) => { setActive(t); setView('detail'); };

  const panel: CSSProperties = {
    maxWidth: 640, margin: '0 auto', fontFamily: 'inherit', color: '#111827',
  };
  const card: CSSProperties = {
    border: '1px solid #e5e7eb', borderRadius: 14, background: '#fff',
    padding: 16, marginBottom: 12,
  };
  const btn = (filled = true): CSSProperties => ({
    border: filled ? 'none' : `1px solid ${brandColor}`,
    background: filled ? brandColor : 'transparent',
    color: filled ? '#fff' : brandColor,
    padding: '10px 16px', borderRadius: 10, fontWeight: 600, cursor: 'pointer', fontSize: 14,
  });
  const input: CSSProperties = {
    width: '100%', boxSizing: 'border-box', padding: '10px 12px', borderRadius: 10,
    border: '1px solid #d1d5db', fontSize: 14, fontFamily: 'inherit', marginTop: 6,
  };

  // ---- NEW ----
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  async function submitNew(e: FormEvent) {
    e.preventDefault();
    if (!subject.trim() || !body.trim()) return;
    setBusy(true); setError(null);
    const { data, error } = await supabase.functions.invoke('support-create', {
      body: { subject: subject.trim(), message: body.trim(), context: baseContext },
    });
    setBusy(false);
    if (error || !data?.id) { setError('Senden fehlgeschlagen. Bitte erneut versuchen.'); return; }
    setSubject(''); setBody('');
    await loadTickets();
    setView('list');
  }

  // ---- REPLY ----
  const [reply, setReply] = useState('');
  async function submitReply(e: FormEvent) {
    e.preventDefault();
    if (!active || !reply.trim()) return;
    setBusy(true); setError(null);
    const { error } = await supabase.functions.invoke('support-reply', {
      body: { ticket_id: active.id, message: reply.trim() },
    });
    setBusy(false);
    if (error) { setError('Senden fehlgeschlagen.'); return; }
    setReply('');
    await loadMessages(active.id);
    await loadTickets();
  }

  return (
    <div style={panel}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
        <h2 style={{ fontSize: 20, fontWeight: 700, margin: 0 }}>
          {view === 'new' ? 'Neue Anfrage' : view === 'detail' ? (active?.subject ?? 'Anfrage') : 'Hilfe & Support'}
        </h2>
        {view === 'list'
          ? <button style={btn()} onClick={() => { setError(null); setView('new'); }}>Neue Anfrage</button>
          : <button style={btn(false)} onClick={() => { setError(null); setView('list'); loadTickets(); }}>Zurück</button>}
      </div>

      {error && (
        <div style={{ ...card, borderColor: '#fecaca', background: '#fef2f2', color: '#b91c1c' }}>{error}</div>
      )}

      {view === 'list' && (
        <>
          {loading && <div style={card}>Lädt…</div>}
          {!loading && tickets.length === 0 && (
            <div style={{ ...card, textAlign: 'center', color: '#6b7280' }}>
              Noch keine Anfragen. Stell uns deine Frage zu {appLabel} – wir kümmern uns drum.
            </div>
          )}
          {!loading && tickets.map((t) => (
            <button key={t.id} onClick={() => openTicket(t)}
              style={{ ...card, width: '100%', textAlign: 'left', cursor: 'pointer', display: 'block' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
                <span style={{ fontWeight: 600, fontSize: 15 }}>{t.subject}</span>
                <StatusBadge status={t.status} />
              </div>
              <div style={{ color: '#6b7280', fontSize: 12, marginTop: 6 }}>
                Aktualisiert {fmt(t.last_activity_at)}
              </div>
            </button>
          ))}
        </>
      )}

      {view === 'new' && (
        <form onSubmit={submitNew} style={card}>
          <label style={{ fontSize: 13, fontWeight: 600 }}>Betreff
            <input style={input} value={subject} maxLength={200}
              onChange={(e) => setSubject(e.target.value)} placeholder="Worum geht's?" required />
          </label>
          <label style={{ fontSize: 13, fontWeight: 600, display: 'block', marginTop: 14 }}>Deine Nachricht
            <textarea style={{ ...input, minHeight: 130, resize: 'vertical' }} value={body} maxLength={5000}
              onChange={(e) => setBody(e.target.value)} placeholder="Beschreib dein Anliegen…" required />
          </label>
          <div style={{ marginTop: 14, display: 'flex', gap: 10 }}>
            <button type="submit" style={btn()} disabled={busy}>{busy ? 'Senden…' : 'Anfrage senden'}</button>
            <button type="button" style={btn(false)} onClick={() => setView('list')}>Abbrechen</button>
          </div>
        </form>
      )}

      {view === 'detail' && active && (
        <>
          <div style={{ ...card, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ color: '#6b7280', fontSize: 13 }}>Erstellt {fmt(active.created_at)}</span>
            <StatusBadge status={active.status} />
          </div>
          <div style={{ ...card }}>
            {messages.length === 0 && <div style={{ color: '#6b7280' }}>Lädt…</div>}
            {messages.map((m) => (
              <div key={m.id} style={{
                display: 'flex', justifyContent: m.author === 'user' ? 'flex-end' : 'flex-start', marginBottom: 10,
              }}>
                <div style={{
                  maxWidth: '80%', padding: '10px 14px', borderRadius: 14, fontSize: 14, whiteSpace: 'pre-wrap',
                  background: m.author === 'user' ? brandColor : '#f3f4f6',
                  color: m.author === 'user' ? '#fff' : '#111827',
                }}>
                  <div style={{ fontSize: 11, opacity: 0.7, marginBottom: 2 }}>
                    {m.author === 'user' ? 'Du' : 'Support'} · {fmt(m.created_at)}
                  </div>
                  {m.body}
                </div>
              </div>
            ))}
          </div>
          {active.status !== 'closed' && (
            <form onSubmit={submitReply} style={card}>
              <textarea style={{ ...input, minHeight: 80, marginTop: 0, resize: 'vertical' }} value={reply}
                maxLength={5000} onChange={(e) => setReply(e.target.value)} placeholder="Antwort schreiben…" />
              <div style={{ marginTop: 10 }}>
                <button type="submit" style={btn()} disabled={busy || !reply.trim()}>
                  {busy ? 'Senden…' : 'Antworten'}
                </button>
              </div>
            </form>
          )}
        </>
      )}
    </div>
  );
}
