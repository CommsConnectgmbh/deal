# Plan: Invite Links, Push Notifications & Revanche

## Ergebnis der Exploration

| Feature | Status | Handlungsbedarf |
|---|---|---|
| Share/Invite Links | ⚠️ Teilweise | Öffentliche Deal-Seite fehlt, WinCardShare WhatsApp-Link zeigt 404 |
| Push Notifications | ✅ Komplett | DB-Column `subscription_json` prüfen, Edge Function deployen |
| Revanche Button | ✅ Komplett | Bereits voll funktionsfähig, keine Änderung nötig |

---

## Schritt 1: Öffentliche Deal-Seite `/deal/[id]` erstellen

**Neue Datei:** `src/app/deal/[id]/page.tsx`

- Server Component, liest Deal via Supabase service role (kein Auth nötig)
- Zeigt Deal-Vorschau: Titel, Einsatz, Creator vs Opponent, Status
- Bei completed Deals: Gewinner + Ergebnis
- CTA-Button: "Auf DealBuddy öffnen" → Link zu `/app/deals/${id}`
- Nicht eingeloggte User sehen den CTA, eingeloggte werden direkt weitergeleitet
- Open Graph Metadata (og:title, og:description, og:image) für Social Previews
- DealBuddy Branding (Logo, Farben, Fonts)

## Schritt 2: Share-URLs korrigieren

**Datei:** `src/components/InteractionBar.tsx`
- Share-URL von `/app/deals/${dealId}` auf `/deal/${dealId}` ändern (öffentlicher Link)

**Datei:** `src/components/WinCardShare.tsx`
- WhatsApp-URL zeigt bereits auf `/deal/${dealId}` → wird durch Schritt 1 funktional

**Datei:** `src/app/app/deals/[id]/page.tsx`
- "TEILEN" Button URL auf `/deal/${dealId}` ändern

## Schritt 3: Push Notifications — DB prüfen & deployen

- Prüfen ob `subscription_json` Column in `push_subscriptions` Tabelle existiert
- Falls nicht: Migration erstellen die Column hinzufügt
- Edge Function `send-push` deployen (falls noch nicht deployed)
- Testen: Settings → Push aktivieren → Wette erstellen → Push empfangen

## Schritt 4: Build & Deploy

- `npm run build` — TypeScript-Fehler beheben
- `npx vercel --prod` — Frontend deployen
- Edge Function deployen falls nötig
