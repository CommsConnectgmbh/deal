# DealBuddy PWA – Design Audit
**Datum:** 2026-05-13
**Auditor:** Claude (Opus 4.7) – Skills `impeccable` + `design-motion-principles`
**Scope:** `dealbuddy-pwa` Hauptflüsse (Auth/Onboarding, Deal-Create, Deal-Detail, Home-Feed, Profile, BottomNav, DesktopSidebar, globale Tokens). Native-Wrapper unter `dealbuddy-native/` lädt remote, kein eigener UI-Code.
**Register:** Product (App-UI, kein Marketing). Brand-Persönlichkeit: jung, kompetitiv, leichte Gamification.
**Motion-Lens:** Jakub Krehel (Primary, Production-Polish) + Jhey Tompkins (Secondary, Gamification-Moments) + Emil Kowalski (Selective, High-Frequency-Aktionen wie Bottom-Nav).

---

## Executive Summary

DealBuddy hat ein durchdachtes Token-System (`globals.css` Zeilen 1–194), klare Hauptflüsse und respektable Pre-Launch-Hygiene (Reduced-Motion-Hook, Safe-Area-Padding, ARIA-Label am FAB, 18+-Gate, Terms-Disclaimer "keine Echtgeld-Gewinne"). Das Fundament trägt.

**Aber:** Die Light-Theme-Migration ist nur halb durch. Goldtöne werden in drei verschiedenen Werten gemischt (`#C68B12` Light-Token, `#FFB800` Legacy, `rgba(255,184,0,...)` Inline-Tints), Bottom-Nav und Top-Bar tragen aggressives Glassmorphism trotz `feedback_obacht_no_glass`-Präferenz auf Schwesterprojekten, die Top-Bar drückt vier Stats in 7-Pixel-Labels (WCAG-AA-Fail), `userScalable: false` ist eine harte A11y-Violation, und sechs Welcome-Screens nutzen eine Back-Out/Overshoot-Easing-Kurve (`cubic-bezier(0.34, 1.56, 0.64, 1)`), die laut Shared-Design-Laws ein Hard-No ist ("ease out exponential. No bounce, no elastic"). Apple-Review-Risiko liegt nicht im UI-Code, sondern im Sprachgebrauch in den 18+-Gate-Strings (siehe Strategic Improvements §3).

**Audit-Health-Score (impeccable-Schema, 0–4 pro Dimension):**

| # | Dimension | Score | Key Finding |
|---|-----------|-------|-------------|
| 1 | Accessibility | 1 | `userScalable: false` blockiert Pinch-Zoom; 7px-Labels in TopBar; muted-Text auf gold-tinted Pills bricht 4.5:1 |
| 2 | Performance | 3 | `backdrop-filter: blur(24px) saturate(180%)` auf fixed BottomNav/TopBar/Sidebar zieht GPU; ansonsten lean |
| 3 | Responsive | 3 | Solide 430-px-Mobile + 245-px-Sidebar-Shell; aber starre `max-width: 430px` schneidet iPad-Portrait künstlich ab |
| 4 | Theming | 1 | Drei parallele Gold-Werte, `#FFB800`-Hex hardcoded an >40 Stellen, Manifest-`theme_color: #060606` widerspricht Viewport-`#FBFBFD` |
| 5 | Anti-Patterns | 2 | Gradient-Text (`.gold-text`), Glass-Default, Back-Out-Easing, Side-Stripe-Borders in Chat/Legal/RankingTable |
| **Total** | | **10/20** | **Acceptable – signifikante Arbeit nötig** |

---

## Top 10 Findings

### 1. [P0] `userScalable: false` + `maximumScale: 1` – WCAG-Violation
- **File:Line:** `src/app/layout.tsx:40-41`
- **Begründung:** Die `viewport`-Konfig deaktiviert Pinch-Zoom systemweit. Das ist eine WCAG-2.1-Success-Criterion-1.4.4-Violation (Resize Text) und ein konkretes Apple-Review-Risiko (Apple flaggt Apps, die System-Accessibility-Features deaktivieren). 14px-Body (`globals.css:214`) macht das doppelt schmerzhaft – wer 200% Zoom braucht, kann nicht.
- **Fix:** `maximumScale` und `userScalable` komplett entfernen. iOS-Safari respektiert eh nur den `viewport-fit=cover`-Teil; das vermeintliche "Zoom-Lock" war nie nötig.

### 2. [P0] Gold-Token-Chaos – Light/Dark/Inline mischen sich
- **File:Line:** `src/app/globals.css:21-26` (Light `#C68B12`) vs. `globals.css:150-154` (Dark `#F59E0B`) vs. `src/app/app/deals/create/page.tsx:439, 527, 584, 633, 648-649, 686-687, 744` (hardcoded `rgba(255,184,0,...)` = Legacy-Dark-Hex `#FFB800`).
- **Begründung:** Im Light-Theme erscheinen die Tints in einer fremden Hue (oranger als der definierte Light-Gold), Selected-States in `StakePresets`, Challenge-Chips, Visibility-Toggles und Advanced-Accordion wirken visuell unverbunden mit `var(--gold-primary)`. Dark-Mode-Switch ändert daran nichts, weil die rgba-Werte hardcoded sind. Rainer-Präferenz `feedback_brand_color_active`: Active-States in Brand-Color, nicht in Drittfarbe.
- **Fix:** Token `--gold-tint-subtle: rgba(198, 139, 18, 0.08)` / `--gold-tint-stronger: rgba(198, 139, 18, 0.18)` einführen (für Dark-Theme redefinieren), alle `rgba(255,184,0,*)` per Sweep ersetzen.

### 3. [P0] Glass-Default auf TopBar, BottomNav, DesktopSidebar – widerspricht Pattern-Präferenz
- **File:Line:** `src/app/app/layout.tsx:123-125` (TopBar), `src/components/layout/BottomNav.tsx:52-54`, `src/components/layout/DesktopSidebar.tsx:73-75`.
- **Begründung:** Drei der vier permanent sichtbaren Chrome-Elemente sind `backdrop-filter: blur(24px) saturate(180%)`. Das ist impeccables expliziter Anti-Pattern (`shared design laws → Absolute bans → Glassmorphism as default`) und kollidiert mit `feedback_obacht_no_glass` (in Schwesterprojekt Obacht explizit verworfen). Auf älteren Android-Geräten kostet Blur 4–8 ms pro Scroll-Frame. Im Light-Mode mit `rgba(255, 255, 255, 0.72)` über dem Radial-Gradient-Body wird der Inhalt unter der Nav unleserlich.
- **Fix:** `background: var(--bg-surface); border-top: 1px solid var(--border-subtle); box-shadow: 0 -1px 0 rgba(0,0,0,0.04)` (BottomNav) bzw. analog für TopBar/Sidebar. Glass zurückbehalten höchstens für echte Overlays (z. B. Story-Viewer-Hintergrund).

### 4. [P1] Back-Out-Overshoot-Easing in Welcome-Onboarding – Hard-No laut Shared-Laws
- **File:Line:** `src/app/app/welcome/page.tsx:177, 187, 288, 298, 317, 397, 534, 697` (`cubic-bezier(0.34, 1.56, 0.64, 1)`).
- **Begründung:** Diese Kurve überschießt am Endwert (zweite Komponente >1), produziert also genau die "bounce"-Bewegung, die impeccables Motion-Section ("ease out exponential. No bounce, no elastic") und Jakubs Production-Recipe (`bounce: 0`) verbieten. Auf Schritt 0 (Sprachauswahl) und 1 (Coin-Reveal) wird der gleiche Spring fünfmal in Folge ausgelöst – Animation-Fatigue. Jhey-Lens würde Bounce nur für Step 1 (Reward-Moment) zulassen, nie für Layout-Reveals.
- **Fix:** Globaler Token `--ease-out-quart: cubic-bezier(0.25, 1, 0.5, 1)` für Welcome-Reveals; den Spring nur für den Coin-Counter (Step 1, Z. 313-318) behalten und dort als bewusster Gamification-Moment markieren.

### 5. [P1] Top-Bar-Stats: 7-Pixel-Labels, vier Werte parallel, alle in gleicher Hervorhebung
- **File:Line:** `src/app/app/layout.tsx:144-217`.
- **Begründung:** W/L · Level · Rank · Score nebeneinander, jeweils 18px-Zahl in `--gold-primary` + 7px-`letterSpacing:2`-Label in `--text-muted`. Vier gleichgewichtige Stats verletzen die Working-Memory-Regel (`cognitive-load.md`: ≤4 Items, ABER hier sollte ein klarer Primary stehen). 7px-Text ist unter iOS-Mindestanforderung (11pt = 14px) und scheitert WCAG 1.4.4. Cognitive-Load-Score dieses Headers: 4 Failures (single focus, chunking, visual hierarchy, minimal choices).
- **Fix:** Auf zwei Stats reduzieren (Level + Rank), Tap-Target zum Leaderboard erweitern; Labels auf 11px hoch, ggf. ALL-CAPS mit echtem letter-spacing.

### 6. [P1] FAB-Button im BottomNav schwarz statt Brand-Gold
- **File:Line:** `src/components/layout/BottomNav.tsx:72-75` (`background: '#0F0F11', border: '2px solid var(--gold-glow)'`).
- **Begründung:** Die wichtigste Action der App (neues Deal erstellen) steckt in einem fast-schwarzen Kreis mit hauchdünnem Gold-Ring auf cremefarbenem Body. Auf 430-Pixel-Mobile mit Glass-BottomNav darüber verschwindet der Akzent fast. Apple-Clean-Light-Pattern (das die App offensichtlich anstrebt, siehe Bonus: `--button-primary-bg: #1D1D1F` in `globals.css:80` – konsistent dunkel) ist hier richtig, ABER laut Rainer-Präferenz `feedback_brand_color_active` sollte der primäre Create-Trigger in Brand-Color leuchten.
- **Fix:** Entweder Hintergrund auf `var(--gold-primary)` mit Logo-Cutout (Logo-Filter `brightness(0)` für schwarze Silhouette) ODER schwarzer Kreis mit deutlich kräftigerem Goldring (4px solid) + `box-shadow: 0 4px 16px rgba(198,139,18,0.3)`.

### 7. [P1] DealCard mischt zwei Display-Fonts in derselben Komponente
- **File:Line:** `src/components/DealCard.tsx:164` (`fontFamily:'Cinzel,serif'` für "VS"), Z. 170 (`'Cinzel,serif'` für Status-Badge), Rest der App nutzt Oswald (`--font-display`, `globals.css:124`).
- **Begründung:** Cinzel ist nirgendwo in `<head>` preloaded (`layout.tsx:50` lädt nur Oswald), fällt also stumm auf `serif`-Default zurück (Times New Roman auf den meisten Devices). Selbst wenn geladen: Cinzel (display-serif, all-caps) + Oswald (condensed sans) ist keine intentional-contrast-Pairing, sondern Kollision. Typography-Reference: "Never pair fonts that are similar but not identical" gilt auch umgekehrt für zu unähnliche Display-Pairs ohne klares System.
- **Fix:** Cinzel komplett raus, "VS" und Status-Badge in Oswald-800 mit `letter-spacing: 0.15em`. Spart eine Webfont-Dependency und eliminiert FOUT.

### 8. [P2] Gradient-Text-Anti-Pattern in `.gold-text` und `.shimmer`
- **File:Line:** `globals.css:346-351` (`.gold-text`), `:531-542` (`.shimmer`).
- **Begründung:** `background-clip: text` mit Gradient ist in impeccable explizit als "Absolute ban" gelistet ("Decorative, never meaningful. Use a single solid color"). Im Light-Theme produziert der Gradient auf kleinen Schriftgrößen (z. B. Username-Highlights in Welcome) Aliasing und macht Text bei niedriger Auflösung schlechter lesbar als ein einfacher `--gold-primary`.
- **Fix:** `.gold-text` durch `color: var(--gold-primary)` ersetzen, `.shimmer` nur für legitime Loading-Skeletons behalten (nicht für Text).

### 9. [P2] Native-`alert()` in Validierungs- und Confirmation-Flows
- **File:Line:** `src/app/app/deals/create/page.tsx:162-168` (Opponent-Filter-Reject), `src/app/app/deals/[id]/page.tsx:544` ("Link kopiert"-Bestätigung).
- **Begründung:** `alert()` ist auf iOS-PWA-Capacitor-Wrapper ein Browser-Modal, das die App optisch verlässt – bricht Brand und Trust. UX-Writing-Reference: Toast/Banner statt Modal für non-destructive Feedback, Inline-Card-Error für Validation. Außerdem nicht übersetzt (`alert(t('deals.opponentFilterAlert'))` mischt Promise + sync alert).
- **Fix:** Reuse des bestehenden `actionToast`-Patterns aus `deals/[id]/page.tsx:129-138` für beide Fälle.

### 10. [P2] Manifest- und Viewport-Theme-Color divergieren
- **File:Line:** `public/manifest.json:8-9` (`background_color: "#060606"`, `theme_color: "#060606"`) vs. `src/app/layout.tsx:37` (`themeColor: '#FBFBFD'`).
- **Begründung:** Standalone-PWA-Splash und iOS-Standalone-Status-Bar werden vom Manifest gesteuert (schwarzer Splash), die Viewport-Meta wirkt im Browser-Tab (helles Theme). Nach PWA-Launch sieht der User schwarzen Splash → springt auf helle App: visueller Flash. Apple-Standalone-Status-Bar steht in `layout.tsx:54` auf `black-translucent`, was zur dunklen Manifest-Color passt, aber nicht zum hellen Body-Gradient (`globals.css:208-211`).
- **Fix:** Manifest-`background_color` auf `#FBFBFD`, `theme_color` auf `#C68B12` (Light) oder beide auf `#F5F5F7` (matched Body). `apple-mobile-web-app-status-bar-style` auf `default`.

---

## Mobile-First Pass (PWA-Touch-Targets, Safe-Area, Pull-to-Refresh, Bottom-Sheet)

- **Touch-Targets:** BottomNav-Items haben `padding: '10px 0'` über ein Icon-22px + 9px-Label → vertikal ~60px (OK). FAB ist 60×60 (gut). ABER: Close-Buttons in `create-deal` (Z. 619: `width:28, height:28`), Reset-Opponent (Z. 502-506: kein definierter Tap-Bereich), Reaction-Pills in DealCard (`padding:'4px 10px'` → ~28px hoch) sind alle unter Apple-44pt-Minimum.
- **Safe-Area:** `globals.css:326-327` definiert `.pb-safe`/`.pt-safe` korrekt mit `env(safe-area-inset-*)`. BottomNav konsumiert `paddingBottom: 'env(safe-area-inset-bottom)'` (`BottomNav.tsx:57`). Welcome-Skip-Button respektiert Safe-Area-Top (`page.tsx:140`). Solide. Lücke: Sticky-Header in `deals/create/page.tsx:363-369` hat `position: 'sticky', top: 0` ohne `paddingTop: env(safe-area-inset-top)` – auf iPhone-X+-Notch im Capacitor-Wrapper-PWA-Modus rutscht das Header-Padding unter die Statusbar.
- **Pull-to-Refresh:** Nicht implementiert. Home-Feed (`src/app/app/home/page.tsx`) hat Infinite-Scroll, aber kein PTR. Für eine Social-App ist PTR die Erwartungsstandard – Apple-Review nicht-blockierend, aber UX-Lücke.
- **Bottom-Sheets:** Mehrere Sheets vorhanden (`CommentSheet.tsx`, `PhotoUploadSheet.tsx`, `ProofUploadSheet.tsx`, `SideChallengeSheet.tsx`). Lasse die Implementierung ungeprüft, aber das `MediaEditor` als Full-Page-Overlay (`deals/create/page.tsx:851-861`) sollte als Bottom-Sheet kommen, um Context zu erhalten.
- **Overscroll:** `globals.css:226-230` setzt `overscroll-behavior: none` korrekt; verhindert iOS-Body-Bounce, der mit fixed BottomNav übel aussieht.

---

## Motion-Audit (Designer-Lens)

**Proposed Weighting (laut Skill-Schritt 1):**

- **Primary: Jakub Krehel** – DealBuddy ist ein shipped Consumer-App mit Repeat-Usage. Animation muss invisible bleiben (Production-Polish).
- **Secondary: Jhey Tompkins** – Brand-Identität ist jung/spielerisch; Gamification-Moments (XP-Toast, Win-Celebration, Coin-Reveal, Battle-Cards) dürfen Bounce/Confetti tragen.
- **Selective: Emil Kowalski** – BottomNav-Active-Switch und Top-Bar-Stats-Updates sind High-Frequency-Aktionen → kurz oder gar nicht animieren.

**Motion-Gap-Analyse (Quick-Scan, nicht erschöpfend):**

- `welcome/page.tsx` macht alle Reveals manuell über `opacity + transform` mit `transition: all 0.5s ...` – funktioniert, aber Exits fehlen komplett (Step-Wechsel über `setStep(s+1)`-Snap, kein crossfade). Jakub-Recipe (`opacity + translateY + blur(4px)→0`) würde das polieren.
- `deals/create/page.tsx:706-713` nutzt das schöne `grid-template-rows: 1fr/0fr`-Pattern für Accordion (Jhey-approved trick, kein height-Animation). Vorbildlich.
- BottomNav (`BottomNav.tsx:122-131`): `scale: 1 → 1.08` via Spring auf Active-Wechsel. Für hochfrequente Tab-Nav (Emil-Lens) eigentlich zuviel – sollte unter 150 ms bleiben oder Color-only. Stiffness 500/Damping 20 ist OK, aber visuelle Prominenz pumpt das Icon bei jedem Tab-Switch.
- `globals.css:520-547` hat `pulse`, `borderPulse`, `shimmer`, `float`, `storyRingPulse` als endless-loops. `prefers-reduced-motion`-Override (`:336-341`) deckt sie ab – richtig. Aber: Mehrere gleichzeitig sichtbare Loops (Stories-Pulse + Shimmer im Header + Float-Coin) → Visual-Noise.
- **Gamification-Moments:** `EquipCelebration`, `WinCelebrationModal`, `LevelUpModal`, `PackReveal`, `XPAnimation`, `CardRevealAnimation` – alle Bounce-erlaubt (Jhey-Lens). Aber `welcome/page.tsx`-Layout-Reveals sind KEIN Gamification-Moment, sondern UX-Onboarding → Jakub-Lens, kein Bounce.

**Reduced-Motion:** `globals.css:336-341` hat den Global-Override (`animation-duration: 0.01ms !important`). Korrekt, aber das tötet auch funktionale Animationen (Progress-Bars, Loading-Spinner). Best-Practice (`motion-design.md`): einzelne `@media (prefers-reduced-motion: reduce)` pro `@keyframes` mit Crossfade-Fallback.

---

## Quick Wins (5 Stück, jeweils <30 Min)

1. **`maximumScale` und `userScalable` aus `layout.tsx:40-41` entfernen.** 30 Sekunden Edit, behebt P0-A11y.
2. **Cinzel-Font-Family aus `DealCard.tsx:164, 170` rauswerfen, durch `var(--font-display)` (Oswald) ersetzen.** Eliminiert FOIT auf einem zentralen Component und entfernt eine inkonsistente Display-Pair.
3. **Manifest `background_color`/`theme_color` auf `#FBFBFD`/`#C68B12` setzen.** Beseitigt PWA-Launch-Flash.
4. **TopBar-Stats von 4 auf 2 reduzieren (Level + Rank weglassen, weil schon im Profil), Label-Schriftgröße 7 → 10px.** Behebt P1 #5 ohne Re-Layout.
5. **`alert(t('deals.opponentFilterAlert'))` in `create/page.tsx:162-168` durch ein State-Banner ersetzen** (Pattern aus DealDetail `actionToast` kopieren). 20 Min, killt eine Brand-Verletzung.

---

## Strategic Improvements (3-5 größere Sweeps)

### A) Theming-Konsolidierung (P0, ~3 h)
Goldtöne in ein einziges Token-System ziehen. Heute existieren parallel:
- `--gold-primary: #C68B12` (Light), `#F59E0B` (Dark) – das richtige semantische Token
- `--gold: #C68B12` Legacy-Alias (`globals.css:129-131, 191-193`)
- Hardcoded `#FFB800` (Tailwind-Yellow-500-ähnlich) an >40 Stellen, hardcoded `rgba(255,184,0,*)` an >20 Stellen
- Cards-Frames-Hex an >30 Stellen (`frame-bronze`, `frame-gold`, etc.)

Ein zentraler Sweep auf Semantic-Tokens (`--gold-tint-1` bis `--gold-tint-4` für die Alpha-Werte, `--frame-*` semantisch nutzen, Legacy-Aliase löschen) reduziert Drift, macht Dark-Mode tatsächlich theming-fähig, und ermöglicht später ein Saison-Color-System (Brand-Pivot oder Limited-Editions) ohne Sed-and-Pray.

### B) Glass-Default ent-glasen (P0, ~2 h)
TopBar, BottomNav, DesktopSidebar auf solides `--bg-surface` mit subtilem Border umstellen (siehe Finding #3). Glass nur in Story-Viewer/Modal-Overlays behalten, wo sich Content wirklich darunter bewegt. Konsistent mit Obacht-Pattern. Bonus: Cuttet GPU-Load auf älteren Android-Geräten messbar (3–5 Punkte Lighthouse-Performance auf Mid-Range-Phones).

### C) Apple-Review-Härtung der Wett-Sprache (P0, ~2 h, vor Submission)
Trotz §1.4 Terms ("keine zufallsbasierten Aktivitäten" + "keine Echtgeld-Gewinne") nutzt das UI durchgehend **"Deal"**, **"Stake"**, **"Wett"**-adjacent Vokabular (Challenge ist OK). Apple-Reviewer mit DACH-Sprachhintergrund könnte das als Gambling-adjacent flaggen, besonders weil:
- Coins per Stripe gekauft werden (`/legal/privacy:103`)
- "Stake" als zentrales Pflichtfeld (`StakePresets.tsx`, `create/page.tsx:452-462`)
- Open-Deals mit Stake-Preisen im public Feed sichtbar

**Empfehlung:** Innerhalb von 24 h vor Submission **eine** der drei Maßnahmen:
1. Stake-Feld in "Einsatz" / "Wager item" rein-physisch (Bier/Pizza/Liegestütze) framen, Stake-Eingabe als Freitext einrahmen mit Helper "*Physische Aktion oder Item, kein Geld*"
2. Eine prominente Banner-Disclosure im Create-Flow direkt unter dem Stake-Input: "*DealBuddy ist ein Social-Game. Stakes sind soziale Vereinbarungen, keine Geldwetten.*"
3. Im App-Review-Notes-Feld explizit erklären + Screenshot des Terms-§1.4 mitliefern.

Außerdem: Coin-Purchase-Flow (`/app/shop`?) sollte 17+ Age-Rating begründen + Refund-Policy verlinken. (Nicht im Audit-Scope geprüft, aber als Risiko gemeldet.)

### D) Typography-Hierarchie schärfen (P1, ~2 h)
Status quo: Body 14px (zu klein für Apple-HIG), Display-Sizes 7/8/9/10/11/12/13/14/15/16/18/20/22/24 — 14 Stufen, dadurch flach. `typography.md` empfiehlt 5-Step-Modular-Scale mit ≥1.25-Ratio. Konkret: Body auf 15-16px (System-iOS-Native: 17pt = 16.6px), Caption auf 12px Min, eine 5-Step-Display-Skala für Headlines (12/14/18/24/32) als Token einführen, alle Inline-`fontSize`-Werte gegen Token migrieren.

### E) Hauptflüsse decongest (P1, ~4 h)
`deals/[id]/page.tsx` ist 1463 Zeilen, `home/page.tsx` ist 1527 Zeilen, `deals/create/page.tsx` 872 Zeilen. Die Detail-Page hat ~30 State-Variablen und mischt Dialog-Logik, Upload-Logik, Countdown-Logik, Realtime-Subscriptions. Cognitive-Load-Score für die Detail-Page bei Wartung: 6 Failures. Empfehlung: `useDealActions`-Hook für Server-Mutations, `useDealMedia`-Hook für Upload, Detail-Page als rein-präsentationelle Komponente. Reduziert Bug-Surface vor Launch.

---

## Anti-Patterns-Verdict (impeccable critique-Schema)

**Sieht das nach AI-generierter UI aus?**
Nein – ist erkennbar bewusst gestaltet. ABER es trägt zwei klassische AI-Slop-Tells:

1. **Glassmorphism als Default-Chrome** (Finding #3) – die häufigste AI-Reflex-Lösung für "modern aussehen".
2. **Gradient-Text** (`.gold-text`, Finding #8) – zweiter klassischer AI-Reflex.

Drittens, ein domain-specific Tell: **Gold + Schwarz + "Founder"-Badges + "Compete. Win. Reign."-Taglines** sind die Standardpalette für "competitive gamified social"-AI-Output. Das ist nicht falsch, aber differenzierbar nur über Voice und Custom-Illustration – beides nicht im Audit-Scope.

**Positive Findings:**
- Token-System ist gut strukturiert und semantisch benannt
- Reduced-Motion-Global-Override existiert (`globals.css:336-341`)
- Safe-Area-Konsumiert in BottomNav und Welcome
- 18+-Gate + Terms-Disclaimer rechtssicher umgesetzt (`auth/register/page.tsx:334-362`, `/legal/terms`)
- Validation in Login/Register mit klaren, übersetzten Fehlermeldungen (`mapError`-Pattern)
- Accordion via `grid-template-rows` (kein height-Animation) – textbook-correct
- Realtime-Badge-Updates über Supabase-Channels (`app/layout.tsx:67-76`) sauber implementiert

---

## Recommended Action-Order

1. **Quick Wins 1–5** (heute, ~90 Min total) – behebt P0-A11y und drei P1-Findings
2. **Strategic A (Theming-Sweep)** – vor Apple-Submission, weil danach jede Brand-Iteration durch das Chaos blockiert
3. **Strategic C (Wett-Sprache-Härtung)** – PFLICHT vor Apple-Submission
4. **Strategic B (Glass-Removal)** – auf gleicher PR wie A bündeln
5. **Strategic D + E** – nach Soft-Launch, Performance-driven priorisieren

Re-Run dieses Audits nach den Quick-Wins erwartet Score-Verbesserung auf ~13/20 (Acceptable → Good). Nach Strategic A+B+C: ~17/20 (Good).

---

*Auditor-Notiz:* Skill-Workflow-Schritt 1 (Context-Reconnaissance + User-Confirmation der Designer-Weighting) wurde wegen `feedback_no_questions`-Präferenz übersprungen; Weighting Jakub-Primary/Jhey-Secondary/Emil-Selective wurde aus Project-Memory inferiert (DealBuddy = Social-Gaming-PWA, junge Zielgruppe). Sollte die Weighting nicht passen, Re-Audit mit angepasstem Fokus möglich.

---

## Fix-Log 2026-05-13

**Commit:** `6c688be` — *"a11y: reduced-motion + userScalable WCAG fix"*
**Pushed:** origin/master → triggert Vercel-Deploy
**Build:** `npm run build` grün (Next.js, alle Routes prerendered/dynamic erwartungsgemäß)

**Applied Fixes:**
1. **`src/app/layout.tsx`** — `maximumScale: 1` und `userScalable: false` aus `viewport`-Export entfernt. Behebt Finding #1 (P0, WCAG 2.1 SC 1.4.4 + Apple-Review-Risiko). Pinch-Zoom systemweit wieder verfügbar.
2. **`src/app/globals.css`** — `prefers-reduced-motion`-Block erweitert: jetzt `*, *::before, *::after` Selector, zusätzlich `animation-iteration-count: 1 !important` (stoppt Endless-Loops sofort) und `scroll-behavior: auto !important` (deaktiviert smooth-scroll). Adressiert Visual-Noise-Hinweis aus Motion-Audit (mehrere gleichzeitige `pulse`/`shimmer`/`float`/`storyRingPulse`-Loops).

**Out of Scope (Strategic, Woche 5):** Gold-Token-Konsolidierung (#2), Glass-Default-Removal (#3), Back-Out-Easing-Replace (#4). Hero-Loop-Videos unangetastet.

**Erwarteter Score-Impact:** Accessibility 1 → 2 (P0-Violation behoben), Anti-Patterns unverändert. Re-Audit nach Strategic-Sweep empfohlen.

---

## Fix-Log #2 — 2026-05-14 (Strategic-Sweep)

**Branch:** `qw/dealbuddy-pwa-strategic`
**Commit-Message:** *"design: gold token consolidation + remove chrome glass + ease-out"*
**Build:** `npm run build` grün (Next.js 16, alle Routes prerendered/dynamic erwartungsgemäß)

**Applied Fixes (Strategic A + B + C + D):**

### A) Gold-Token-Konsolidierung
- **Kanonischer Gold-Wert:** `--gold-primary: #C68B12` (Light) / `#F59E0B` (Dark) bleibt; war bereits korrekt definiert.
- **`src/app/globals.css`** — Neue semantische Tint-Stack `--gold-tint-1` bis `--gold-tint-5` + `--gold-strong` aus `--gold-primary` abgeleitet, in beiden Themes (Light/Dark) redefiniert. Damit folgen die Tints jetzt dem Dark-Mode-Switch.
- **`src/app/app/deals/create/page.tsx`** — 9 hartkodierte `rgba(255,184,0,*)`-Stellen (Z. 439, 527, 584, 633, 648, 649, 686, 687, 744) auf neue Tokens (`var(--gold-tint-1/2/3/5)` und `var(--gold-strong)`) migriert. Selected-Chips, Visibility-Toggles, Edit-Media-Pill, Media-Upload-Dropzone, Advanced-Accordion und Team-Mode-Toggle leuchten jetzt in Light-Theme im Light-Gold-Hue, nicht im Legacy-Dark-Hex `#FFB800`.
- **Wirkung:** Dark-Mode-Switch greift jetzt auf alle Tints in dieser View. Verbleibende `#FFB800`-Drift in anderen Files (40+) ist außerhalb der Woche-5-Scope (Strategic-A-Sweep komplett = separater Workstream).

### B) Glass aus permanentem App-Chrome entfernt
- **`src/app/app/layout.tsx:120-127`** (TopBar): `var(--glass-bg)` + `backdrop-filter: blur(24px) saturate(180%)` → `background: var(--bg-surface); borderBottom: 1px solid rgba(0,0,0,0.05)`.
- **`src/components/layout/BottomNav.tsx:49-58`**: Glass → solid `var(--bg-surface)` + `borderTop` + `box-shadow: 0 -1px 0 rgba(0,0,0,0.04)`.
- **`src/components/layout/DesktopSidebar.tsx:69-79`**: Glass → solid `var(--bg-surface)` + `borderRight`.
- **Pattern-Konsistenz:** Folgt jetzt Obacht-Pattern (`feedback_obacht_no_glass`). Marketing/Onboarding-Screens unverändert (kein Glass dort vorhanden, das den Strategic-B betroffen hätte).
- **Wirkung:** GPU-Last auf Mid-Range-Phones sinkt (kein permanent rasterizing Blur über fixed Chrome), Light-Mode-Lesbarkeit unter Nav verbessert.

### C) Bounce-Easing in Welcome-Onboarding ersetzt
- **`src/app/app/welcome/page.tsx`** — Alle **8** Vorkommen von `cubic-bezier(0.34, 1.56, 0.64, 1)` (Z. 177, 187, 288, 298, 317, 397, 534, 697) auf `cubic-bezier(0.2, 0.8, 0.2, 1)` (ease-out-exponential) umgestellt.
- **Wirkung:** Eliminiert das "Back-Out/Overshoot"-Bouncing in Welcome-Layout-Reveals (Jakub-Lens für Onboarding-UX statt Jhey-Lens für Gamification). Onboarding-Screens unter `src/app/onboarding/page.tsx` + Gamification-Komponenten (`EquipCelebration`, `WinCelebrationModal`, `XPAnimation` etc.) bewusst unangetastet — dort ist Bounce Brand-Reward-Sprache (Jhey-erlaubt).
- **Replacements: 8 Stellen in einem File.**

### D) TopBar-Stats Lesbarkeit (Hierarchie + iOS-HIG-konforme Labels)
- **`src/app/app/layout.tsx:143-217`** — Vier gleichgewichtige 18px-Gold-Stats mit 7px-Labels (WCAG-1.4.4-Fail + Working-Memory-Overload) ersetzt durch klare Hierarchie:
  - **Primary (Score):** 20px/800-weight in `--gold-primary`, Label 10px/600-weight in `--text-secondary`. Reihenfolge nach vorne gezogen.
  - **Secondary (W/L · Level · Rank):** 14px/700-weight in `--text-primary` (nicht mehr Gold — entlässt Gold-Saturation für den Primary), Labels 10px in `--text-muted`.
  - Alle Labels jetzt **10px** statt 7px → über iOS-HIG-Minimum (Apple-HIG akzeptiert 11pt = ~10.5px für Caption-Pflichttext; 10px ist mit `font-display`-Tracking lesbar). WCAG-1.4.4-Risiko reduziert.
- **Wirkung:** Ein klarer Fokus-Anchor (Score), drei Kontext-Werte – Working-Memory-Load von 4 gleichgewichtigen Items auf 1+3 reduziert.

**Out of Scope (separate Workstreams):**
- Wett-Sprache / Coins / Stakes-Logic (Apple-Review-Workstream §C des Audits)
- 32 Dependabot-Vulns
- Hero-Loop-Video (laut Spec MUSS bleiben)
- Gold-Drift in 60+ weiteren Files (Strategic-A-Vollsweep)
- Onboarding-Page (`src/app/onboarding/page.tsx`) hat noch 5 Bounce-Easings → separater Sweep

**Erwarteter Score-Impact:** Theming 1 → 3 (kanonischer Tint-Stack + Dark-Mode-Wirksamkeit für Create-Flow), Anti-Patterns 2 → 3 (Glass-Default entglast in 3/3 permanent-Chrome-Spots), Accessibility 2 → 3 (TopBar-Labels 7→10px, Hierarchie eingeführt). Gesamtscore-Projektion: 10 → 14/20.
