# DealBuddy – Claude Master Context

> Kontext-Dokument für KI-gestützte Entwicklung mit Claude Code

---

## Projekt-Überblick

DealBuddy ist eine Social Challenge App (PWA + Native) mit Supabase Backend. User erstellen Deals, laden Freunde ein und bauen einen Reliability Score auf.

## Codebases

| Projekt | Pfad | Tech |
|---|---|---|
| dealbuddy-pwa | `dealbuddy-pwa/` | Next.js 16, React 19, Tailwind |
| dealbuddy-native | `dealbuddy-native/` | Expo 51, React Native 0.74 |
| dealbuddy-app | `dealbuddy-app/` | Backend-Referenz-Schema |

## Supabase

- **Projekt-ID:** `vjygmfaefhkwznldegvq`
- **URL:** `https://vjygmfaefhkwznldegvq.supabase.co`
- **Region:** eu-central-1
- **Org:** Deal Buddy (Free Plan → muss auf Pro für Edge Functions)

## Wichtige Konventionen

### Begriffe (Compliance)
- NIEMALS: `bet`, `gamble`, `wager`, `wette`
- IMMER: `challenge`, `deal`, `match`

### Design System (PWA)
- CSS Variables: `--gold-primary`, `--bg-base`, `--text-primary`
- Font: Oswald (Display), System (Body)
- Farben: Gold (#F59E0B), Schwarz (#080808), Surface (#16171B)

### Design System (Native)
- Theme: `lib/theme.ts` – Gold (#FFB800), Schwarz (#080808)
- Fonts: Cinzel (Display), Crimson Text (Body)
- Components: `components/ui/` – GoldButton, Card, Input, Avatar

## Stripe

- Session Creation: `/api/create-stripe-session`
- Webhook: `supabase/functions/stripe-webhook/`
- Fallback: `/api/verify-stripe-session`
- Produkte: coin_pack_xs bis coin_pack_xl, premium_pass, legendary_box

## Bekannte Issues

1. **Stripe Webhook kommt nicht an** – Edge Function möglicherweise nicht deployed oder Webhook-URL nicht in Stripe Dashboard konfiguriert
2. **Fallback-Fulfillment** eingebaut aber braucht Vercel Deployment
3. **Native App** ist deutlich weniger aktuell als PWA

---

*Zuletzt aktualisiert: März 2026*
