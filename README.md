# DealBuddy

> **Proof of Humanity. Proof of Integrity. DealBuddy.**
>
> Das erste verifizierte soziale Netzwerk fuer echte menschliche Interaktion, Wettbewerb und verbindliches Vertrauen.

---

## Inhaltsverzeichnis
1. [Ueber das Projekt](#ueber-das-projekt)
2. [Tech Stack](#tech-stack)
3. [Die 3 Hard Rules (WICHTIG)](#die-3-hard-rules-wichtig)
4. [Lokales Setup](#lokales-setup)
5. [Projektstruktur](#projektstruktur)
6. [Git Workflow & Contribution](#git-workflow--collaboration)
7. [Feature Flags](#feature-flags)
8. [Dokumentation & Ressourcen](#dokumentation)

---

## Ueber das Projekt

DealBuddy macht den "digitalen Handschlag" messbar. Nutzer erstellen Challenges (Deals), laden Freunde ein, tragen Ergebnisse ein und bauen sich einen verifizierten "Reliability Score" auf.

**Kern-Features:**
- **Zero Friction Onboarding:** PWA First-Touch & Phone Auth (OTP).
- **AI Dispute Arbiter:** Konfliktloesung durch On-Device KI.
- **On-Chain Identity:** Exportierbarer Reliability Score (ZKP / EAS).
- **Native Trust:** Biometrische Bestaetigung (FaceID/TouchID) von Ergebnissen.

---

## Tech Stack

- **Frontend / PWA:** [Next.js 16](https://nextjs.org/) (React 19, Tailwind CSS)
- **Frontend / Mobile:** [React Native](https://reactnative.dev/) via [Expo 51](https://expo.dev/)
- **Backend / Database:** [Supabase](https://supabase.com/) (PostgreSQL, Auth, Edge Functions, Storage)
- **Payments:** [Stripe](https://stripe.com/) (Checkout Sessions + Webhooks)
- **Analytics:** [PostHog](https://posthog.com/)
- **AI Integration:** OpenAI API (GPT-4o-mini)

---

## Die 3 Hard Rules (WICHTIG)

Jeder Entwickler, der an diesem Repo arbeitet, **muss** diese Regeln befolgen:

1. **Zero Friction Rule:** Wenn zwei Nutzer eine Challenge nicht in unter 2 Minuten erstellen und abschliessen koennen, wird der PR abgelehnt. Keine unnoetigen Klicks.
2. **Compliance Rule:** Verwende im Code, in der DB und im UI **NIEMALS** die Woerter `bet`, `gamble`, `wager` oder `wette`. Nutze ausschliesslich `challenge`, `deal` oder `match`.
3. **PWA First-Touch Rule:** Ein neuer Nutzer, der einen Invite-Link klickt, muss die Challenge im mobilen Browser annehmen koennen, *ohne* die App vorher zu installieren.

---

## Lokales Setup

### Voraussetzungen
- Node.js (v18+)
- npm oder pnpm
- Expo CLI (`npm install -g expo-cli`) - fuer Native App
- Supabase CLI (fuer lokale DB-Entwicklung)

### Installation

1. **Repository klonen:**
   ```bash
   git clone https://github.com/CommsConnectgmbh/deal.git
   cd deal
   ```

2. **Abhaengigkeiten installieren:**
   ```bash
   npm install
   ```

3. **Umgebungsvariablen setzen:**
   ```bash
   cp .env.example .env.local
   ```
   Trage deine Supabase-Keys ein:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `SUPABASE_SERVICE_ROLE_KEY`
   - `STRIPE_SECRET_KEY`

4. **App starten:**
   ```bash
   npm run dev
   ```

---

## Projektstruktur

```text
dealbuddy-pwa/
├── src/
│   ├── app/              # Next.js App Router (47 Pages + 5 API Routes)
│   ├── components/       # 99+ UI-Komponenten
│   ├── contexts/         # Auth, Language, Celebration Providers
│   ├── hooks/            # usePresence, useTheme
│   └── lib/              # Supabase, Analytics, Media Upload, Helpers
├── supabase/
│   └── functions/        # Edge Functions (stripe-webhook, etc.)
├── docs/                 # Dokumentation
│   ├── DealBuddy_Master_Blueprint_2026.md
│   ├── DealBuddy_Development_Roadmap_V5.md
│   ├── 00_DealBuddy_Claude_Master_Context.md
│   └── 01_DealBuddy_Claude_Prompts.md
└── MIGRATION_*.sql       # DB-Migrationen
```

---

## Git Workflow & Collaboration

### Branch Naming Convention
- `feature/ticket-id-kurze-beschreibung` (z.B. `feature/DB-12-otp-login`)
- `bugfix/ticket-id-kurze-beschreibung` (z.B. `bugfix/DB-45-fix-deep-link`)
- `hotfix/kurze-beschreibung` (fuer kritische Fehler im Main-Branch)

### Commit Messages (Conventional Commits)
- `feat: add biometric auth for result submission`
- `fix: resolve crash on challenge creation`
- `chore: update dependencies`

### Pull Requests (PRs)
1. Branch immer ausgehend von `main` erstellen.
2. PR gegen `main` oeffnen.
3. Mindestens **1 Approval** von einem anderen Entwickler.
4. CI/CD-Pipelines muessen gruen sein.

---

## Feature Flags

Features werden progressiv aktiviert basierend auf User-Verhalten:

| Feature | Trigger | Status |
|---|---|---|
| Home Dashboard | IMMEDIATE | Aktiv |
| Deals erstellen | IMMEDIATE | Aktiv |
| Push Notifications | IMMEDIATE | Aktiv |
| Tipps Tab | AFTER_1_DEAL | Aktiv |
| Community Tab | AFTER_3_DEALS | Aktiv |
| Kicktipp Tab | AFTER_3_DEALS | Aktiv |
| Economy/Shop | IMMEDIATE | Aktiv |
| Battle Pass | IMMEDIATE | Aktiv |
| AI Dispute Arbiter | MANUAL | In Entwicklung |

---

## Dokumentation

- [Master Blueprint](./docs/DealBuddy_Master_Blueprint_2026.md) - Vision & Strategie
- [Development Roadmap V5](./docs/DealBuddy_Development_Roadmap_V5.md) - Phasen & Status
- [Claude Master Context](./docs/00_DealBuddy_Claude_Master_Context.md) - KI-Entwicklungskontext
- [Claude Prompts](./docs/01_DealBuddy_Claude_Prompts.md) - Bewährte Prompts

---

## Compliance

Stand 2026-05-01: Code-seitige Compliance (Account-Loeschung Native+PWA, iOS PrivacyInfo, Stripe Billing Portal, PostHog Opt-In, DSGVO Datenexport, Cookie-Banner Homepage, DB-Rename `bets`→`challenges`) ist live. Manuelle Schritte siehe Guides.

Reports im Workspace-Parent `C:\Claude Code\DealBuddy\` (ausserhalb des PWA-Repos):
- `COMPLIANCE_AUDIT_2026-05-01.md` – Ergebnis-Matrix der 21 Audit-Punkte.
- `COMPLIANCE_FIXES_2026-05-01.md` – Erste Welle: Account-Delete, PrivacyInfo, Stripe Portal.
- `COMPLIANCE_FIXES_2026-05-01-rename.md` – DB-Rename `bets` → `challenges`.
- `COMPLIANCE_POLISH_2026-05-01.md` – Zweite Welle: PostHog Consent, Datenexport, Cookie-Banner, Native Git-Remote.

Manuelle Schritte (Guides im PWA-Repo unter [`docs/`](./docs/)):
- [`docs/APP_STORE_PRIVACY_GUIDE.md`](./docs/APP_STORE_PRIVACY_GUIDE.md) – Apple ASC App-Datenschutz-Fragen vor jeder iOS-Submission.
- [`docs/PLAY_DATA_SAFETY_GUIDE.md`](./docs/PLAY_DATA_SAFETY_GUIDE.md) – Google Play Data-Safety-Section vor Android-Submission.
- [`docs/HOMEPAGE_FTP_UPLOAD.md`](./docs/HOMEPAGE_FTP_UPLOAD.md) – Manueller FTP-Upload der Homepage (Cookie-Banner-Rollout).

---

*Built with Supabase, Next.js & Expo by the DealBuddy Team.*
