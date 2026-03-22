# DealBuddy – Development Roadmap V5

> Developer Edition – Technische Übersetzung des DealBuddy-Konzepts

---

## Key Rule

> Wenn zwei Nutzer eine Challenge nicht in unter 2 Minuten erstellen und abschließen können, ist das Produkt kaputt.

---

## Phase 0: Architektur & Datenmodelle ✅

### Core Data Models (PostgreSQL / Supabase)

| Model | Status | Beschreibung |
|---|---|---|
| profiles | ✅ 58 Spalten | User mit Reliability Score, Archetype, Coins, Level, XP |
| bets | ✅ 34 Spalten | Challenge-Objekt mit Outcome Claims, Auto-Resolve |
| challenge_results | ✅ | Separates Result-Modell mit Resolution Method |
| debt_ledger | ✅ | Schulden-Tracking nach Challenge-Abschluss |

### Funktionen
- `complete_bet()` – Gewinner eintragen, Schulden anlegen
- `try_auto_resolve_bet()` – Beidseitige Prüfung → Auto-Resolve oder Dispute
- `calculate_reliability_score()` – Score 0–100 berechnen
- `assign_archetype()` – Archetype aus Verhalten ableiten
- `add_coins()` – Atomare Coin-Gutschrift

---

## Phase 1: Frictionless Onboarding ✅

- Phone Auth (OTP) via Supabase + Twilio
- Email/Password als Fallback
- Profil-Setup: nur Username nötig (< 30 Sek.)
- Empty State mit CTA

---

## Phase 2: Core Challenge Engine ✅

- Challenge Creation Flow (Titel, Einsatz, Deadline)
- Challenge Dashboard (aktiv, ausstehend, vergangen)
- Push Notifications via Expo
- Multi-Step Modal für Deal-Erstellung

---

## Phase 3: Viral Invite System ✅

- Deep Linking: `dealbuddy.app/c/[id]`
- Web Preview mit OG-Metadata für Social Sharing
- Auto-Join nach Registration über Challenge-Link
- Referral-System mit Coin-Bonus

### API Endpunkte
- `POST /api/create-stripe-session` – Stripe Checkout
- `POST /api/verify-stripe-session` – Fallback-Verifizierung
- `POST /api/upload-media` – Signed URL für Media Upload

---

## Phase 4: Results, Trust & Dispute Resolution ✅

- Outcome Submission (beidseitig: win/loss/draw)
- Auto-Resolve bei Übereinstimmung
- Dispute State bei Widerspruch + Proof Upload
- Reliability Score (0–100) mit Farblogik
- Bet Fulfillment Tracking

---

## Phase 5: Status, Profiles & Archetypes ✅

- Public Profiles mit Win-Rate, Deals, Reliability
- 7 Archetypen mit Auto-Assignment (DB Trigger + Cron)
- Leaderboards (6 Kategorien, 3 Zeiträume)
- Rank Tiers: Recruit → Contender → Veteran → Elite → Legend → Mythic

---

## Phase 6: Social Growth ✅

- Social Feed mit Deal Events + Stories
- Kommentare & 4 Reaktions-Typen (🔥 😂 😱 💀)
- Follows + Favorites
- Chat/Direct Messages
- Rivalries mit Intensitäts-Tracking

---

## Phase 7: Economy ✅

- Buddy Coins (Start: 100, Daily Rewards, Stripe-Kauf)
- Cosmetics Shop (Frames, Badges, Skins, Archetypes)
- Battle Pass (30 Level, Free + Premium)
- Card-System mit Pack Opening + Rarity
- Stripe Webhook + Fallback-Fulfillment

---

## Datenbank-Übersicht

- **137 Tabellen** in Production
- **9 User** registriert (Stand März 2026)
- **10 Deals** erstellt
- Row Level Security auf allen Tabellen

---

*Stand: März 2026 – Alle 7 Phasen implementiert*
