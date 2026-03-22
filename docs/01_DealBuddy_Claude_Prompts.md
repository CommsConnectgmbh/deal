# DealBuddy – Claude Code Prompts

> Bewährte Prompts für die KI-gestützte Entwicklung mit Claude Code

---

## Setup-Prompt (Neuer Chat)

```
Ich arbeite am DealBuddy Projekt. Lies bitte:
- docs/00_DealBuddy_Claude_Master_Context.md
- docs/DealBuddy_Development_Roadmap_V5.md

Supabase Projekt-ID: vjygmfaefhkwznldegvq
PWA: dealbuddy-pwa/ (Next.js 16)
Native: dealbuddy-native/ (Expo 51)

Wichtig: Verwende NIEMALS die Wörter bet/gamble/wager/wette im Code.
Nutze stattdessen: challenge, deal, match.
```

---

## Feature-Prompts

### Neues Feature
```
Implementiere [Feature] in der PWA.
- Bestehende Struktur beibehalten
- CSS Variables aus globals.css nutzen
- Supabase RLS beachten
- Deutsche UI-Texte
```

### Bug Fix
```
Bug: [Beschreibung]
- Prüfe die Supabase DB direkt (Projekt: vjygmfaefhkwznldegvq)
- Lies den relevanten Code
- Fixe den Bug und erkläre was schiefging
```

### DB Migration
```
Erstelle eine Migration für [Änderung].
- Nutze IF NOT EXISTS / ADD COLUMN IF NOT EXISTS
- RLS Policies nicht vergessen
- Führe direkt in Supabase aus
```

### Performance Check
```
Prüfe die Performance von [Seite/Feature].
- Supabase Queries optimieren (Indexes?)
- Unnötige Re-Renders finden
- Bundle Size prüfen
```

---

## Stripe Debug-Prompt

```
Prüfe den Stripe Payment Flow:
1. Gibt es pending Transactions in stripe_transactions?
2. Kommt der Webhook an? (supabase/functions/stripe-webhook/)
3. Ist die Edge Function deployed?
4. Ist die Webhook-URL in Stripe Dashboard konfiguriert?
5. Hat der User seine Coins bekommen?
```

---

## DB Check-Prompt

```
Prüfe die Supabase DB (vjygmfaefhkwznldegvq):
- Wie viele User/Deals gibt es?
- Gibt es Fehler in den Transactions?
- Sind alle Migrationen angewendet?
- Funktionieren die RPC Functions?
```

---

*Stand: März 2026*
