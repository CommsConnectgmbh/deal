# DealBuddy – Master Business & Dev Blueprint 2026

> Proof of Humanity. Proof of Integrity. DealBuddy.

---

## Vision

DealBuddy ist das erste verifizierte soziale Netzwerk für echte menschliche Interaktion, Wettbewerb und verbindliches Vertrauen. Nutzer erstellen Challenges (Deals), laden Freunde ein, tragen Ergebnisse ein und bauen sich einen verifizierten Reliability Score auf.

---

## Core Loop (< 2 Minuten)

```
Challenge erstellen → Freund einladen → Ergebnis eintragen → Status erhalten
```

Jedes Feature das diesen Loop verlangsamt, wird gestrichen.

---

## Säulen

### 1. Trust & Verification
- **Reliability Score** (0–100): Grün (≥85) / Gelb (≥60) / Rot (<60)
- Beidseitige Ergebnis-Eingabe mit Auto-Resolve
- Dispute State bei Widerspruch
- Biometrische Bestätigung (FaceID/TouchID) für Ergebnisse

### 2. Status & Archetypes
- 7 Archetypen: Newcomer, Winner, Dealer, High Roller, Closer, Veteran, Maverick
- Auto-Assignment basierend auf Verhalten
- Leaderboards: Global + Friends, Week/Season/All-time
- XP-System mit Level-Progression

### 3. Social & Viral Growth
- Deep Linking für Challenge-Sharing (dealbuddy.app/c/[id])
- Web Preview für nicht installierte User
- Auto-Join nach Registration über Challenge-Link
- Social Feed mit Reactions & Kommentaren
- Rivalries mit Head-to-Head Stats

### 4. Economy
- Buddy Coins als In-App Währung
- Cosmetics Shop (Frames, Badges, Skins)
- Battle Pass (Free + Premium Track)
- Card-System mit Pack Opening
- Stripe Integration für Echtgeld-Käufe

---

## Monetarisierung

| Quelle | Modell |
|---|---|
| Coin Packs | €2,99 – €39,99 |
| Premium Battle Pass | €9,99 / Season |
| Legendary Mystery Box | €4,99 |
| Affiliate Tipps | Revenue Share |

---

## Zielgruppe

- 18–35 Jahre, Social-Media-affin
- Wettbewerbsorientiert, statusbewusst
- Deutschland-first, dann DACH, dann global

---

## Compliance

**NIEMALS** die Wörter `bet`, `gamble`, `wager` oder `wette` im Code, in der DB oder im UI verwenden. Ausschließlich `challenge`, `deal` oder `match`.

---

## Tech Stack

- **Frontend:** React Native (Expo) + Next.js PWA
- **Backend:** Supabase (PostgreSQL, Auth, Edge Functions, Storage)
- **Payments:** Stripe (Checkout Sessions + Webhooks)
- **Analytics:** PostHog
- **AI:** OpenAI API (GPT-4o-mini) für Dispute Resolution
- **Deep Linking:** Expo Linking + Universal Links

---

*Stand: März 2026*
