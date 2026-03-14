# Deal Reliability Score + Opponent Filter — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add a reliability score badge to user profiles showing how consistently they fulfill bet stakes, plus an opponent filter that lets users control who can challenge them.

**Architecture:** New `bet_fulfillment` table tracks whether the loser delivered on their stake after deal completion. A DB trigger recalculates aggregated score on `profiles`. The `confirm-winner` edge function auto-creates fulfillment records. A Next.js API route handles fulfillment confirmation. UI additions: badge in profile header, notification prompt for winners, opponent filter in settings, filter check on deal creation.

**Tech Stack:** Supabase (Postgres tables, triggers, edge functions, RLS), Next.js API routes, React inline-styled components.

---

## Task 1: Migration — Create `bet_fulfillment` table + extend `profiles`

**Files:**
- Create: `MIGRATION_RELIABILITY.sql`

**Step 1: Write the migration SQL file**

```sql
-- MIGRATION_RELIABILITY.sql
-- Deal Reliability Score + Opponent Filter
-- Run in Supabase SQL Editor

-- ═══ 1. bet_fulfillment table ═══
CREATE TABLE IF NOT EXISTS bet_fulfillment (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  bet_id                UUID NOT NULL REFERENCES bets(id) ON DELETE CASCADE,
  obligated_user_id     UUID NOT NULL REFERENCES profiles(id),
  entitled_user_id      UUID NOT NULL REFERENCES profiles(id),
  status                TEXT NOT NULL DEFAULT 'pending_fulfillment'
                          CHECK (status IN (
                            'pending_fulfillment',
                            'fulfilled',
                            'unfulfilled',
                            'expired'
                          )),
  confirmed_by_user_id  UUID REFERENCES profiles(id),
  confirmed_at          TIMESTAMPTZ,
  expires_at            TIMESTAMPTZ,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(bet_id)
);

CREATE INDEX IF NOT EXISTS idx_bf_bet_id ON bet_fulfillment(bet_id);
CREATE INDEX IF NOT EXISTS idx_bf_obligated ON bet_fulfillment(obligated_user_id);
CREATE INDEX IF NOT EXISTS idx_bf_entitled ON bet_fulfillment(entitled_user_id);
CREATE INDEX IF NOT EXISTS idx_bf_status ON bet_fulfillment(status);
CREATE INDEX IF NOT EXISTS idx_bf_expires ON bet_fulfillment(expires_at);

-- ═══ 2. Reliability columns on profiles ═══
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS
  reliability_fulfilled_count   INT NOT NULL DEFAULT 0;

ALTER TABLE profiles ADD COLUMN IF NOT EXISTS
  reliability_unfulfilled_count INT NOT NULL DEFAULT 0;

ALTER TABLE profiles ADD COLUMN IF NOT EXISTS
  reliability_score             NUMERIC(4,3);

ALTER TABLE profiles ADD COLUMN IF NOT EXISTS
  reliability_color             TEXT;

ALTER TABLE profiles ADD COLUMN IF NOT EXISTS
  reliability_updated_at        TIMESTAMPTZ;

-- ═══ 3. Opponent Filter columns on profiles ═══
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS
  opponent_filter_enabled       BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE profiles ADD COLUMN IF NOT EXISTS
  opponent_min_reliability      INT;

ALTER TABLE profiles ADD COLUMN IF NOT EXISTS
  opponent_require_confirmation BOOLEAN NOT NULL DEFAULT false;

-- ═══ 4. Trigger function: recalculate reliability on fulfillment status change ═══
CREATE OR REPLACE FUNCTION recalc_reliability()
RETURNS TRIGGER AS $$
DECLARE
  v_user_id UUID := NEW.obligated_user_id;
  v_fulfilled INT;
  v_unfulfilled INT;
  v_relevant INT;
  v_score NUMERIC(4,3);
  v_color TEXT;
BEGIN
  -- Only fire on final status transitions
  IF NEW.status NOT IN ('fulfilled', 'unfulfilled') THEN
    RETURN NEW;
  END IF;

  -- Recount from source of truth
  SELECT
    count(*) FILTER (WHERE status = 'fulfilled'),
    count(*) FILTER (WHERE status = 'unfulfilled')
  INTO v_fulfilled, v_unfulfilled
  FROM bet_fulfillment
  WHERE obligated_user_id = v_user_id;

  v_relevant := v_fulfilled + v_unfulfilled;

  IF v_relevant < 5 THEN
    v_score := NULL;
    v_color := 'neutral';
  ELSE
    v_score := 1.0 - (v_unfulfilled::NUMERIC / v_relevant);
    IF    v_score >= 0.85 THEN v_color := 'green';
    ELSIF v_score >= 0.75 THEN v_color := 'yellow';
    ELSE                        v_color := 'red';
    END IF;
  END IF;

  UPDATE profiles SET
    reliability_fulfilled_count   = v_fulfilled,
    reliability_unfulfilled_count = v_unfulfilled,
    reliability_score             = v_score,
    reliability_color             = v_color,
    reliability_updated_at        = now()
  WHERE id = v_user_id;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ═══ 5. Attach trigger ═══
DROP TRIGGER IF EXISTS trg_recalc_reliability ON bet_fulfillment;
CREATE TRIGGER trg_recalc_reliability
  AFTER UPDATE OF status ON bet_fulfillment
  FOR EACH ROW
  EXECUTE FUNCTION recalc_reliability();

-- ═══ 6. RLS Policies ═══
ALTER TABLE bet_fulfillment ENABLE ROW LEVEL SECURITY;

-- Everyone can read fulfillment records (needed for profile badge)
CREATE POLICY "Anyone can read bet_fulfillment"
  ON bet_fulfillment FOR SELECT
  USING (true);

-- Only the entitled user (winner) can update status
CREATE POLICY "Entitled user can update fulfillment"
  ON bet_fulfillment FOR UPDATE
  USING (auth.uid() = entitled_user_id)
  WITH CHECK (
    auth.uid() = entitled_user_id
    AND status = 'pending_fulfillment'  -- can only transition FROM pending
  );

-- Insert only via service role (edge function / API route)
-- No public INSERT policy = only service_role can insert

-- ═══ 7. updated_at auto-trigger ═══
CREATE OR REPLACE FUNCTION update_bf_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_bf_updated_at ON bet_fulfillment;
CREATE TRIGGER trg_bf_updated_at
  BEFORE UPDATE ON bet_fulfillment
  FOR EACH ROW
  EXECUTE FUNCTION update_bf_updated_at();
```

**Step 2: Run the migration in Supabase SQL Editor**

Go to https://vjygmfaefhkwznldegvq.supabase.co → SQL Editor → paste and run.

**Step 3: Commit**

```bash
git add MIGRATION_RELIABILITY.sql
git commit -m "feat: add bet_fulfillment table + reliability columns migration"
```

---

## Task 2: Extend `confirm-winner` edge function to auto-create `bet_fulfillment`

**Files:**
- Modify: `supabase/functions/confirm-winner/index.ts` (after line 348, before side bets section)

**Step 1: Add fulfillment record creation after deal completion**

After the winner/loser notifications (line ~348) and before side bets resolution (~350), insert:

```typescript
    // ── Create bet_fulfillment record (Reliability Score) ──
    // Only for bets with a stake (material obligation)
    if (deal.stake && deal.stake.trim() !== '') {
      await supabase.from('bet_fulfillment').insert({
        bet_id: deal_id,
        obligated_user_id: loser_id,
        entitled_user_id: winner_id,
        status: 'pending_fulfillment',
        expires_at: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString(),
      }).catch((err: any) => {
        console.error('bet_fulfillment insert error:', err)
        // Non-blocking — don't fail the deal completion
      })

      // Notification: ask winner if stake was received
      await supabase.from('notifications').insert({
        user_id: winner_id,
        type: 'fulfillment_check',
        title: 'Einsatz erhalten?',
        body: `Hat dein Gegner den Einsatz "${deal.stake}" eingelöst?`,
        reference_id: deal_id,
      }).catch(() => {})
    }
```

**Step 2: Deploy the edge function**

```bash
cd "C:\Users\RainerRoloff\Downloads\DealBuddy-FINAL-FOR-FAISAL\dealbuddy-pwa"
SUPABASE_ACCESS_TOKEN=sbp_26ab4b6c99f46ea170d15cc9cd13c91ae46bcbdb npx supabase functions deploy confirm-winner --project-ref vjygmfaefhkwznldegvq --use-api
```

**Step 3: Commit**

```bash
git add supabase/functions/confirm-winner/index.ts
git commit -m "feat: auto-create bet_fulfillment on deal completion"
```

---

## Task 3: API route for fulfillment confirmation

**Files:**
- Create: `src/app/api/fulfillment/route.ts`

**Step 1: Write the API route**

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function POST(req: NextRequest) {
  try {
    // Verify auth
    const authHeader = req.headers.get('authorization')
    if (!authHeader) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const token = authHeader.replace('Bearer ', '')
    const { data: { user }, error: authErr } = await supabaseAdmin.auth.getUser(token)
    if (authErr || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { betId, status } = await req.json()

    // Validate status
    if (!['fulfilled', 'unfulfilled'].includes(status)) {
      return NextResponse.json({ error: 'Invalid status. Must be fulfilled or unfulfilled.' }, { status: 400 })
    }

    // Fetch fulfillment record
    const { data: bf, error: bfErr } = await supabaseAdmin
      .from('bet_fulfillment')
      .select('*')
      .eq('bet_id', betId)
      .single()

    if (bfErr || !bf) {
      return NextResponse.json({ error: 'Fulfillment record not found' }, { status: 404 })
    }

    // Only the entitled user (winner) can confirm
    if (bf.entitled_user_id !== user.id) {
      return NextResponse.json({ error: 'Only the winner can confirm fulfillment' }, { status: 403 })
    }

    // Only pending records can be updated
    if (bf.status !== 'pending_fulfillment') {
      return NextResponse.json({ error: 'Fulfillment already resolved' }, { status: 400 })
    }

    // Verify the bet is completed
    const { data: bet } = await supabaseAdmin
      .from('bets')
      .select('status')
      .eq('id', betId)
      .single()

    if (!bet || bet.status !== 'completed') {
      return NextResponse.json({ error: 'Bet is not completed' }, { status: 400 })
    }

    // Update fulfillment status (triggers recalc_reliability)
    const { error: updateErr } = await supabaseAdmin
      .from('bet_fulfillment')
      .update({
        status,
        confirmed_by_user_id: user.id,
        confirmed_at: new Date().toISOString(),
      })
      .eq('id', bf.id)

    if (updateErr) {
      return NextResponse.json({ error: updateErr.message }, { status: 500 })
    }

    return NextResponse.json({ success: true, status })
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Server error' }, { status: 500 })
  }
}
```

**Step 2: Commit**

```bash
git add src/app/api/fulfillment/route.ts
git commit -m "feat: add fulfillment confirmation API route"
```

---

## Task 4: Fulfillment notification UI in deal detail page

**Files:**
- Modify: `src/app/app/deals/[id]/page.tsx`

**Step 1: Add fulfillment state and fetch logic**

At the top of the component (near other state declarations), add:

```typescript
const [fulfillment, setFulfillment] = useState<{
  id: string; status: string; entitled_user_id: string; obligated_user_id: string;
} | null>(null)
const [fulfillmentLoading, setFulfillmentLoading] = useState(false)
```

In the existing `useEffect` that fetches the deal, add after deal fetch:

```typescript
// Fetch fulfillment status
const { data: bfData } = await supabase
  .from('bet_fulfillment')
  .select('id, status, entitled_user_id, obligated_user_id')
  .eq('bet_id', id)
  .maybeSingle()
if (bfData) setFulfillment(bfData)
```

**Step 2: Add fulfillment confirmation handler**

```typescript
const handleFulfillment = async (status: 'fulfilled' | 'unfulfilled') => {
  if (!profile || fulfillmentLoading) return
  setFulfillmentLoading(true)
  try {
    const { data: { session } } = await supabase.auth.getSession()
    const res = await fetch('/api/fulfillment', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${session?.access_token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ betId: deal.id, status }),
    })
    if (res.ok) {
      setFulfillment(prev => prev ? { ...prev, status } : null)
    }
  } catch (err) {
    console.error('Fulfillment error:', err)
  }
  setFulfillmentLoading(false)
}
```

**Step 3: Add fulfillment banner UI**

Render this banner after the deal status section, only when the current user is the winner and fulfillment is pending:

```tsx
{/* ═══ FULFILLMENT CHECK — only for winner with pending fulfillment ═══ */}
{fulfillment && fulfillment.status === 'pending_fulfillment' && profile?.id === fulfillment.entitled_user_id && (
  <div style={{
    margin: '0 16px 16px', padding: '16px', borderRadius: 14,
    background: 'linear-gradient(135deg, rgba(255,184,0,0.08), rgba(255,184,0,0.03))',
    border: '1px solid rgba(255,184,0,0.2)',
  }}>
    <p style={{ fontFamily: 'var(--font-display)', fontSize: 11, letterSpacing: 1, color: 'var(--gold-primary)', marginBottom: 6 }}>
      EINSATZ ERHALTEN?
    </p>
    <p style={{ fontSize: 13, color: 'var(--text-secondary)', fontFamily: 'var(--font-body)', lineHeight: 1.5, marginBottom: 14 }}>
      Hat dein Gegner den Einsatz eingelöst?
    </p>
    <div style={{ display: 'flex', gap: 8 }}>
      <button
        onClick={() => handleFulfillment('fulfilled')}
        disabled={fulfillmentLoading}
        style={{
          flex: 1, padding: '10px 0', borderRadius: 10, border: 'none', cursor: 'pointer',
          background: 'linear-gradient(135deg, #22C55E, #16A34A)',
          color: '#fff', fontFamily: 'var(--font-display)', fontSize: 10, fontWeight: 700, letterSpacing: 1,
        }}
      >
        ✅ JA, ERHALTEN
      </button>
      <button
        onClick={() => handleFulfillment('unfulfilled')}
        disabled={fulfillmentLoading}
        style={{
          flex: 1, padding: '10px 0', borderRadius: 10, border: 'none', cursor: 'pointer',
          background: 'linear-gradient(135deg, #EF4444, #DC2626)',
          color: '#fff', fontFamily: 'var(--font-display)', fontSize: 10, fontWeight: 700, letterSpacing: 1,
        }}
      >
        ❌ NEIN
      </button>
    </div>
  </div>
)}
{fulfillment && fulfillment.status === 'fulfilled' && profile?.id === fulfillment.entitled_user_id && (
  <div style={{
    margin: '0 16px 16px', padding: '12px 16px', borderRadius: 14,
    background: 'rgba(34,197,94,0.08)', border: '1px solid rgba(34,197,94,0.2)',
    textAlign: 'center',
  }}>
    <span style={{ fontFamily: 'var(--font-display)', fontSize: 10, letterSpacing: 1, color: '#22C55E' }}>
      ✅ EINSATZ ALS ERHALTEN BESTÄTIGT
    </span>
  </div>
)}
{fulfillment && fulfillment.status === 'unfulfilled' && profile?.id === fulfillment.entitled_user_id && (
  <div style={{
    margin: '0 16px 16px', padding: '12px 16px', borderRadius: 14,
    background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)',
    textAlign: 'center',
  }}>
    <span style={{ fontFamily: 'var(--font-display)', fontSize: 10, letterSpacing: 1, color: '#EF4444' }}>
      ❌ EINSATZ NICHT ERHALTEN
    </span>
  </div>
)}
```

**Step 4: Commit**

```bash
git add src/app/app/deals/[id]/page.tsx
git commit -m "feat: add fulfillment check UI on deal detail page"
```

---

## Task 5: Add `fulfillment_check` notification type

**Files:**
- Modify: `src/app/app/notifications/page.tsx`

**Step 1: Add icon and color for the new notification type**

In `TYPE_ICON`, add:
```typescript
fulfillment_check:   '📋',
```

In `TYPE_COLOR`, add:
```typescript
fulfillment_check:   '#FFB800',
```

**Step 2: Add navigation handler**

In `handleNotifTap`, add a case:
```typescript
else if (n.type === 'fulfillment_check' && n.reference_id) router.push(`/app/deals/${n.reference_id}`)
```

**Step 3: Commit**

```bash
git add src/app/app/notifications/page.tsx
git commit -m "feat: add fulfillment_check notification type"
```

---

## Task 6: Reliability badge in profile pages

**Files:**
- Modify: `src/app/app/profile/page.tsx` (own profile stats grid)
- Modify: `src/app/app/profile/[username]/page.tsx` (public profile stats grid)
- Modify: `src/contexts/AuthContext.tsx` (add reliability fields to Profile interface)

**Step 1: Extend Profile interface in AuthContext**

Add to the `Profile` interface in `src/contexts/AuthContext.tsx`:

```typescript
reliability_score?: number | null
reliability_color?: string | null
```

**Step 2: Add reliability badge to own profile stats section**

In `src/app/app/profile/page.tsx`, in the stats grid (the array with DEALS, WIN%, STREAK, COINS), add a 5th item. Change the grid from `gridTemplateColumns: '1fr 1fr 1fr 1fr'` to `'1fr 1fr 1fr 1fr 1fr'`.

Add to the stats array:
```typescript
{
  label: 'ZUVERL.',
  val: profile?.reliability_score != null
    ? `${Math.round(profile.reliability_score * 100)}%`
    : '—',
  color: profile?.reliability_color === 'green' ? '#22C55E'
       : profile?.reliability_color === 'yellow' ? '#EAB308'
       : profile?.reliability_color === 'red' ? '#EF4444'
       : 'var(--text-muted)',
},
```

**Step 3: Add reliability badge to public profile stats section**

In `src/app/app/profile/[username]/page.tsx`, same approach. The public profile fetches `user` via supabase select — ensure `reliability_score, reliability_color` are included in the select query.

In the stats grid, change grid to 5 columns and add:
```typescript
{
  label: 'ZUVERL.',
  val: user.reliability_score != null
    ? `${Math.round(user.reliability_score * 100)}%`
    : '—',
  color: user.reliability_color === 'green' ? '#22C55E'
       : user.reliability_color === 'yellow' ? '#EAB308'
       : user.reliability_color === 'red' ? '#EF4444'
       : 'var(--text-muted)',
},
```

**Step 4: Commit**

```bash
git add src/contexts/AuthContext.tsx src/app/app/profile/page.tsx src/app/app/profile/[username]/page.tsx
git commit -m "feat: add reliability badge to profile pages"
```

---

## Task 7: Opponent Filter settings UI

**Files:**
- Modify: `src/app/app/settings/page.tsx`

**Step 1: Add state for opponent filter settings**

Add state variables after the existing state declarations:

```typescript
const [opponentFilterEnabled, setOpponentFilterEnabled] = useState(false)
const [opponentMinReliability, setOpponentMinReliability] = useState<number | null>(null)
const [opponentRequireConfirmation, setOpponentRequireConfirmation] = useState(false)
```

Sync from profile in the existing `useEffect`:

```typescript
setOpponentFilterEnabled(profile.opponent_filter_enabled || false)
setOpponentMinReliability(profile.opponent_min_reliability ?? null)
setOpponentRequireConfirmation(profile.opponent_require_confirmation || false)
```

**Step 2: Add the opponent filter section UI**

Place this after the Privacy section and before the Security section:

```tsx
{/* Opponent Filter Section */}
<p style={sectionTitle}>GEGNER-FILTER</p>
<div style={card}>
  <p style={{ fontSize: 13, color: 'var(--text-secondary)', fontFamily: 'var(--font-body)', lineHeight: 1.5, marginBottom: 16 }}>
    Lege fest, wer dich herausfordern darf.
  </p>

  {/* Option 1: No filter */}
  <label style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 0', cursor: 'pointer', borderBottom: '1px solid var(--border-subtle)' }}>
    <div style={{
      width: 20, height: 20, borderRadius: '50%',
      border: `2px solid ${!opponentFilterEnabled ? 'var(--gold-primary)' : 'var(--text-muted)'}`,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
    }}>
      {!opponentFilterEnabled && (
        <div style={{ width: 10, height: 10, borderRadius: '50%', background: 'var(--gold-primary)' }} />
      )}
    </div>
    <div style={{ flex: 1 }} onClick={() => {
      setOpponentFilterEnabled(false)
      setOpponentRequireConfirmation(false)
      supabase.from('profiles').update({
        opponent_filter_enabled: false,
        opponent_require_confirmation: false,
      }).eq('id', profile!.id)
    }}>
      <p style={{ fontSize: 14, color: 'var(--text-primary)' }}>Jeden akzeptieren</p>
      <p style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>Standard — alle können dich herausfordern</p>
    </div>
  </label>

  {/* Option 2: Min reliability */}
  <label style={{ display: 'flex', alignItems: 'flex-start', gap: 12, padding: '10px 0', cursor: 'pointer', borderBottom: '1px solid var(--border-subtle)' }}>
    <div style={{
      width: 20, height: 20, borderRadius: '50%', marginTop: 2,
      border: `2px solid ${opponentFilterEnabled && !opponentRequireConfirmation ? 'var(--gold-primary)' : 'var(--text-muted)'}`,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
    }}>
      {opponentFilterEnabled && !opponentRequireConfirmation && (
        <div style={{ width: 10, height: 10, borderRadius: '50%', background: 'var(--gold-primary)' }} />
      )}
    </div>
    <div style={{ flex: 1 }} onClick={() => {
      setOpponentFilterEnabled(true)
      setOpponentRequireConfirmation(false)
      const minVal = opponentMinReliability || 75
      setOpponentMinReliability(minVal)
      supabase.from('profiles').update({
        opponent_filter_enabled: true,
        opponent_min_reliability: minVal,
        opponent_require_confirmation: false,
      }).eq('id', profile!.id)
    }}>
      <p style={{ fontSize: 14, color: 'var(--text-primary)' }}>Mindest-Zuverlässigkeit</p>
      <p style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>Nur Gegner mit Score ≥ dem Mindestwert</p>
    </div>
  </label>

  {/* Slider for min reliability */}
  {opponentFilterEnabled && !opponentRequireConfirmation && (
    <div style={{ padding: '12px 0 8px', paddingLeft: 32 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
        <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>Mindestwert</span>
        <span style={{ fontFamily: 'var(--font-display)', fontSize: 16, color: 'var(--gold-primary)' }}>
          {opponentMinReliability || 75}%
        </span>
      </div>
      <input
        type="range"
        min={50}
        max={95}
        step={5}
        value={opponentMinReliability || 75}
        onChange={(e) => {
          const val = parseInt(e.target.value)
          setOpponentMinReliability(val)
          supabase.from('profiles').update({
            opponent_min_reliability: val,
          }).eq('id', profile!.id)
        }}
        style={{ width: '100%', accentColor: 'var(--gold-primary)' }}
      />
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 9, color: 'var(--text-muted)', fontFamily: 'var(--font-display)', letterSpacing: 1 }}>
        <span>50%</span><span>95%</span>
      </div>
    </div>
  )}

  {/* Option 3: Manual confirmation */}
  <label style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 0', cursor: 'pointer' }}>
    <div style={{
      width: 20, height: 20, borderRadius: '50%',
      border: `2px solid ${opponentRequireConfirmation ? 'var(--gold-primary)' : 'var(--text-muted)'}`,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
    }}>
      {opponentRequireConfirmation && (
        <div style={{ width: 10, height: 10, borderRadius: '50%', background: 'var(--gold-primary)' }} />
      )}
    </div>
    <div style={{ flex: 1 }} onClick={() => {
      setOpponentFilterEnabled(true)
      setOpponentRequireConfirmation(true)
      supabase.from('profiles').update({
        opponent_filter_enabled: true,
        opponent_require_confirmation: true,
      }).eq('id', profile!.id)
    }}>
      <p style={{ fontSize: 14, color: 'var(--text-primary)' }}>Manuell bestätigen</p>
      <p style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>Jede neue Challenge einzeln freigeben</p>
    </div>
  </label>
</div>
```

**Step 3: Commit**

```bash
git add src/app/app/settings/page.tsx
git commit -m "feat: add opponent filter settings UI"
```

---

## Task 8: Opponent filter check on deal creation

**Files:**
- Modify: `src/app/app/deals/create/page.tsx`

**Step 1: Add opponent filter check before inserting the bet**

In the `createDeal` function, after `dispatch({ type: 'SET_LOADING', loading: true })` and before the `supabase.from('bets').insert(...)` call (around line 136), add:

```typescript
      // ── Opponent Filter Check ──
      if (state.opponent?.id) {
        const { data: opponentProfile } = await supabase
          .from('profiles')
          .select('opponent_filter_enabled, opponent_min_reliability, opponent_require_confirmation, display_name')
          .eq('id', state.opponent.id)
          .single()

        if (opponentProfile?.opponent_filter_enabled) {
          if (opponentProfile.opponent_require_confirmation) {
            // Manual confirmation required — deal will be 'pending', opponent sees notification
            // This is the default flow, no blocking needed
          } else if (opponentProfile.opponent_min_reliability != null) {
            // Check challenger's reliability score
            const { data: myProfile } = await supabase
              .from('profiles')
              .select('reliability_score')
              .eq('id', profile.id)
              .single()

            const myScorePct = myProfile?.reliability_score != null
              ? Math.round(myProfile.reliability_score * 100)
              : null

            if (myScorePct === null || myScorePct < opponentProfile.opponent_min_reliability) {
              dispatch({ type: 'SET_LOADING', loading: false })
              alert(
                `Dieser Spieler akzeptiert nur Gegner mit Zuverlässigkeit ≥ ${opponentProfile.opponent_min_reliability}%.`
                + (myScorePct === null
                  ? ' Du hast noch keinen Score (mind. 5 Deals nötig).'
                  : ` Dein Score: ${myScorePct}%.`)
              )
              return
            }
          }
        }
      }
```

**Step 2: Commit**

```bash
git add src/app/app/deals/create/page.tsx
git commit -m "feat: check opponent filter on deal creation"
```

---

## Task 9: Cron job — expire pending fulfillments after 14 days

**Files:**
- Create: `supabase/functions/expire-fulfillments/index.ts`

**Step 1: Write the edge function**

```typescript
// Supabase Edge Function: expire-fulfillments
// Runs daily via cron — sets pending_fulfillment to 'expired' after 14 days
// Expired entries do NOT affect reliability score (neither positive nor negative)

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    )

    const now = new Date().toISOString()

    // Find all expired pending fulfillments
    const { data: expired, error } = await supabase
      .from('bet_fulfillment')
      .select('id')
      .eq('status', 'pending_fulfillment')
      .lt('expires_at', now)

    if (error) {
      return new Response(JSON.stringify({ error: error.message }), {
        status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    let count = 0
    if (expired && expired.length > 0) {
      // Update to 'expired' — this does NOT trigger recalc_reliability
      // because the trigger only fires for 'fulfilled' or 'unfulfilled'
      const { error: updateErr } = await supabase
        .from('bet_fulfillment')
        .update({ status: 'expired' })
        .eq('status', 'pending_fulfillment')
        .lt('expires_at', now)

      if (updateErr) {
        return new Response(JSON.stringify({ error: updateErr.message }), {
          status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        })
      }
      count = expired.length
    }

    return new Response(JSON.stringify({
      success: true,
      expired_count: count,
      checked_at: now,
    }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })

  } catch (err) {
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }
})
```

**Step 2: Deploy the edge function**

```bash
SUPABASE_ACCESS_TOKEN=sbp_26ab4b6c99f46ea170d15cc9cd13c91ae46bcbdb npx supabase functions deploy expire-fulfillments --project-ref vjygmfaefhkwznldegvq --use-api
```

**Step 3: Set up the cron job in Supabase**

In Supabase SQL Editor, run:

```sql
-- Daily cron job to expire pending fulfillments
SELECT cron.schedule(
  'expire-pending-fulfillments',
  '0 3 * * *',  -- daily at 3:00 UTC
  $$
  SELECT net.http_post(
    url := 'https://vjygmfaefhkwznldegvq.supabase.co/functions/v1/expire-fulfillments',
    headers := jsonb_build_object(
      'Authorization', 'Bearer ' || current_setting('supabase.service_role_key'),
      'Content-Type', 'application/json'
    ),
    body := '{}'
  );
  $$
);
```

**Step 4: Commit**

```bash
git add supabase/functions/expire-fulfillments/
git commit -m "feat: add cron edge function to expire pending fulfillments"
```

---

## Task 10: Update service worker + build verification

**Files:**
- Modify: `public/sw.js`

**Step 1: Bump SW version**

Change `SW_VERSION` to `'v4-2026-03-14'`.

**Step 2: Build and verify**

```bash
cd "C:\Users\RainerRoloff\Downloads\DealBuddy-FINAL-FOR-FAISAL\dealbuddy-pwa"
npm run build
```

Expect: 0 TypeScript errors, all routes compile.

**Step 3: Commit all remaining changes**

```bash
git add -A
git commit -m "feat: Deal Reliability Score + Opponent Filter — complete implementation"
```

**Step 4: Deploy**

```bash
npx vercel --prod --token YOUR_VERCEL_TOKEN
```

---

## Summary of all files touched

| Action | File |
|--------|------|
| Create | `MIGRATION_RELIABILITY.sql` |
| Create | `src/app/api/fulfillment/route.ts` |
| Create | `supabase/functions/expire-fulfillments/index.ts` |
| Modify | `supabase/functions/confirm-winner/index.ts` |
| Modify | `src/app/app/deals/[id]/page.tsx` |
| Modify | `src/app/app/notifications/page.tsx` |
| Modify | `src/app/app/profile/page.tsx` |
| Modify | `src/app/app/profile/[username]/page.tsx` |
| Modify | `src/app/app/settings/page.tsx` |
| Modify | `src/app/app/deals/create/page.tsx` |
| Modify | `src/contexts/AuthContext.tsx` |
| Modify | `public/sw.js` |
