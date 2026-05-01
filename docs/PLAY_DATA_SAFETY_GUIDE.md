# Google Play – Data Safety Section für DealBuddy

**Stand:** 2026-05-01
**Wann:** Vor erster Android-Submission. Bei jedem Update mit neuen Daten-Sammlung-Mechanismen erneut.
**Dauer:** ca. 15 Min
**Voraussetzung:** Play-Console-App-Eintrag für DealBuddy existiert.
**Quelle der Wahrheit:** `dealbuddy-native/ios/DealBuddy/PrivacyInfo.xcprivacy` (Apple-Manifest dient als Single-Source-of-Truth – Android-Datensammlung ist identisch).

---

## 1. Login + Navigation

1. Öffne https://play.google.com/console → Login.
2. Apps → "DealBuddy" auswählen.
3. Linke Sidebar: "Richtlinien" → "App-Inhalt" (engl. "App content").
4. Karte "Datensicherheit" (Data Safety) → Klick "Verwalten" / "Get started".

## 2. Datenerhebung & Sicherheit – Hauptfragen (Schritt 1)

Beantworte die globalen Fragen wie folgt:

1. **"Erhebt oder teilt deine App eine der erforderlichen Nutzerdatentypen?"**
   → **Ja.**

2. **"Werden alle erhobenen Nutzerdaten bei der Übertragung verschlüsselt?"**
   → **Ja.**
   Begründung: Supabase API über HTTPS, Stripe Checkout über HTTPS, Push via FCM TLS, alle Edge-Function-Calls TLS.

3. **"Stellst du eine Möglichkeit bereit, mit der Nutzer die Löschung ihrer Daten anfordern können?"**
   → **Ja, Nutzer können die Löschung ihrer Daten direkt in der App anfordern.**
   Begründung: In-App "Konto löschen"-Button im Profil-Tab, ruft die Server-API `/api/account/delete` auf (siehe `COMPLIANCE_FIXES_2026-05-01.md`).

4. **Web-URL für Datenlöschungs-Anfrage** (optional, aber empfohlen):
   → `https://deal-buddy.app/support` eintragen.

Klick "Weiter".

## 3. Daten-Typen (Schritt 2)

Play Console zeigt dieselbe Kategorienliste wie Apple, ist aber feingranularer. Folgende Typen ankreuzen:

### Kategorie "Persönliche Informationen"
- ✅ Name
- ✅ E-Mail-Adresse
- ✅ Telefonnummer

### Kategorie "Foto- und Videodaten"
- ✅ Fotos

### Kategorie "App-Aktivität"
- ✅ Andere von Nutzern erstellte Inhalte (Profil-Bio, Deal-Notizen, Forum-Posts)

### Kategorie "App-Informationen und -Leistung"
- ✅ Absturzprotokolle

### Kategorie "Geräte- oder andere IDs"
- ✅ Geräte- oder andere IDs (FCM Push-Token via expo-notifications)

Alle anderen Kategorien (Standort, Finanzinformationen, Gesundheits-/Fitnessdaten, Nachrichten, Audiodaten, Dateien und Dokumente, Kalender, Kontakte, Internetaktivitätsdaten, Such- und Browserverlauf) **leer lassen**.

> **Hinweis Stripe:** Zahlungen laufen über Stripe Checkout (Web-Redirect bzw. native sheet) – Kreditkartendaten landen NIE in der App selbst, sondern direkt bei Stripe. Daher KEIN Häkchen bei "Finanzinformationen → Zahlungsinformationen". Stripe ist Auftragsverarbeiter und zählt im Play-Sinne nicht als "Sharing".

Klick "Weiter".

## 4. Pro Daten-Typ die Folgefragen (Schritt 3)

Play Console fragt für JEDEN angekreuzten Typ vier Dinge:
- (a) Wird er **erhoben** (collected)?
- (b) Wird er **geteilt** (shared) mit Dritten?
- (c) Ist die Erhebung **erforderlich oder optional**?
- (d) Was ist der **Zweck** (mehrfach möglich)?

### Pauschal-Antwort für ALLE 7 Datentypen

| Frage | Antwort |
|---|---|
| Erhoben? | **Ja** |
| Geteilt? | **Nein** (Supabase, Stripe, FCM sind Auftragsverarbeiter und zählen im Play-Sinne nicht als "Sharing") |
| Erforderlich oder optional? | siehe Tabelle unten |
| Zweck | siehe Tabelle unten |

### Konkrete Tabelle pro Datentyp

| Datentyp | Erforderlich/Optional | Zweck |
|---|---|---|
| Name | Optional (vom Nutzer im Profil pflegbar) | Account-Verwaltung, App-Funktionalität |
| E-Mail-Adresse | Erforderlich | Account-Verwaltung, App-Funktionalität |
| Telefonnummer | Optional (nur bei Phone-OTP-Login statt Email-OTP) | Account-Verwaltung, App-Funktionalität |
| Fotos | Optional (nur wenn User Profilbild setzt) | App-Funktionalität, Account-Verwaltung |
| Andere von Nutzern erstellte Inhalte | Optional | App-Funktionalität |
| Absturzprotokolle | Erforderlich (automatisch) | App-Funktionalität, Analyse |
| Geräte- oder andere IDs | Optional (nur wenn Push aktiviert) | App-Funktionalität (Push-Benachrichtigungen) |

> **WICHTIG: Werbung & Tracking** – bei keinem der 7 Typen den Zweck "Werbung oder Marketing" ankreuzen. DealBuddy nutzt KEIN cross-app Tracking, kein IDFA, keine Ad-Networks. Das spiegelt `NSPrivacyTracking = false` aus dem iOS-Manifest.

Klick "Weiter".

## 5. Sicherheitspraktiken (Schritt 4)

| Frage | Antwort |
|---|---|
| Werden Daten in Übertragung verschlüsselt? | **Ja** (TLS überall) |
| Bietet die App eine Möglichkeit, die Datenlöschung anzufordern? | **Ja** (in-app, Profil → Konto löschen) |
| Folgt die App den Google Play Families Policies? | **Nein** (DealBuddy ist 18+, kein Kinder-Content) |
| Wurde die App durch ein unabhängiges Sicherheits-Audit geprüft? | **Nein** (kann später auf Ja gesetzt werden, wenn ein Pen-Test gemacht wird) |

Im Hinweistext zur "Datenlöschungs-Anfrage" zusätzlich erwähnen:

> Nutzer können ihr Konto direkt in der App unter "Profil → Konto löschen" entfernen. Dabei werden personenbezogene Daten anonymisiert bzw. gelöscht. Alternativ: Mail an info@deal-buddy.app.

## 6. Zielgruppe / Altersgate (Schritt 5)

Falls noch nicht gesetzt: in der "Zielgruppe und Inhalt"-Sektion (separater Menüpunkt unter "App-Inhalt") **18+** als Zielgruppe wählen. Begründung: DealBuddy ist Social-Betting-Plattform (im Play-Kontext: "User-Generated Content + In-App-Käufe von virtuellen Gütern"). Altersgate beim Onboarding ist im App-Code.

## 7. Speichern + Senden

1. Nach allen Sektionen unten "Speichern" klicken.
2. Anschließend oben rechts auf der Übersichts-Seite "Zur Überprüfung senden" / "Senden" (Submit) klicken.
3. Status muss zu "Eingereicht" / "Sent" wechseln. Das ist der Live-Zustand für neue Submissions.

## 8. Verifikation

In der Play-Listing-Vorschau (in der Console "App-Inhalt → Datensicherheit → Vorschau") muss der Datensicherheits-Block alle 7 Typen mit den oben gewählten Zwecken anzeigen. Wenn die Vorschau leer oder unvollständig ist: noch einmal speichern und senden.

---

## Bei Änderungen am Datensammlungs-Verhalten

Jedes Mal, wenn ein neues SDK / eine neue Datenkategorie hinzukommt:

1. iOS-Manifest `dealbuddy-native/ios/DealBuddy/PrivacyInfo.xcprivacy` ergänzen.
2. ASC App-Datenschutz aktualisieren (siehe `docs/APP_STORE_PRIVACY_GUIDE.md`).
3. Play-Console-Datensicherheit hier analog ergänzen + erneut "Senden".
4. Diese Datei pflegen, damit die Anleitungen synchron mit dem realen Verhalten bleiben.
