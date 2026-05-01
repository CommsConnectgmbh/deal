# App Store Connect – Privacy-Fragen für DealBuddy

**Stand:** 2026-05-01
**Wann:** Vor jeder neuen App-Submission, einmal initial. Anschließend bei jeder Änderung am `PrivacyInfo.xcprivacy`-Manifest erneut.
**Dauer:** ca. 12 Min
**Voraussetzung:** App-Record für DealBuddy in App Store Connect existiert.
**Apple App-ID:** 6763754507
**Bundle-ID:** `de.dealbuddy.app`
**Quelle der Wahrheit:** `dealbuddy-native/ios/DealBuddy/PrivacyInfo.xcprivacy` – jede Antwort hier muss exakt zum Manifest passen, sonst Reject.

---

## 1. Login + Navigation

1. Öffne https://appstoreconnect.apple.com → Login mit der Apple-ID des Comms-Connect-Org-Accounts.
2. Klicke oben "Apps" → wähle "DealBuddy" aus der App-Liste (App-ID 6763754507).
3. In der linken Sidebar ganz unten: "App-Datenschutz" (engl. "App Privacy").
4. Rechts neben "Datenerfassung von Nutzern" auf "Bearbeiten" klicken (bei Erst-Befüllung steht stattdessen "Erste Schritte" / "Get Started").

## 2. Frage: "Sammelt deine App Daten?"

Antwort: **Ja, wir sammeln Daten.**

Begründung: Manifest deklariert `NSPrivacyCollectedDataTypes` mit sieben Einträgen.

## 3. Daten-Typen ankreuzen

Apple zeigt eine Kategorienliste. Folgende sieben Häkchen setzen, alle anderen leer lassen:

- **Kontaktinformationen → E-Mail-Adresse**
- **Kontaktinformationen → Name**
- **Kontaktinformationen → Telefonnummer**
- **Benutzerinhalte → Fotos oder Videos**
- **Identifikatoren → Geräte-ID**
- **Benutzerinhalte → Andere benutzergenerierte Inhalte**
- **Diagnose → Absturzdaten**

Klick "Weiter".

## 4. Pro Daten-Typ die Folgefragen

Apple stellt für jeden angekreuzten Datentyp dieselben drei Folgefragen. Es gibt eine wichtige Sonderregel beim Datentyp **Absturzdaten**.

### Standardantworten für 6 von 7 Datentypen

E-Mail, Name, Telefonnummer, Fotos/Videos, Geräte-ID, Andere benutzergenerierte Inhalte:

#### Frage A: "Wird der Datentyp mit der Identität des Nutzers verknüpft?"
Antwort: **Ja, mit der Identität des Nutzers verknüpft (Linked to User).**

Manifest-Begründung: `NSPrivacyCollectedDataTypeLinked = true`.

#### Frage B: "Wird der Datentyp zum Tracking verwendet?"
Antwort: **Nein, nicht zum Tracking verwendet.**

Manifest-Begründung: `NSPrivacyTracking = false` und `NSPrivacyCollectedDataTypeTracking = false`.

#### Frage C: "Zwecke" (Multi-Select)
Antwort: nur **App-Funktionalität** ankreuzen. Alle anderen Boxen leer lassen.

Manifest-Begründung: Purposes-Array enthält ausschließlich `NSPrivacyCollectedDataTypePurposeAppFunctionality`.

### Sonderfall: Absturzdaten (Crash Data)

#### Frage A: "Wird der Datentyp mit der Identität des Nutzers verknüpft?"
Antwort: **Nein, nicht mit der Identität des Nutzers verknüpft (Not Linked to User).**

Manifest-Begründung: für Crash Data ist `NSPrivacyCollectedDataTypeLinked = false` (anders als die anderen sechs Datentypen!). Crash Reports werden anonym über die Expo/React-Native Runtime gesammelt.

#### Frage B: "Wird der Datentyp zum Tracking verwendet?"
Antwort: **Nein.**

#### Frage C: "Zwecke"
Antwort: nur **App-Funktionalität** ankreuzen.

---

## 5. Konkrete Datenpunkt-Liste (zur Kontrolle)

Was Rainer in ASC eintragen muss – exakter Spiegel des `PrivacyInfo.xcprivacy`:

- ✅ **E-Mail-Adresse** (`NSPrivacyCollectedDataTypeEmailAddress`) – linked: Ja, tracking: Nein, Zweck: App-Funktionalität. (Supabase Auth)
- ✅ **Name** (`NSPrivacyCollectedDataTypeName`) – linked: Ja, tracking: Nein, Zweck: App-Funktionalität. (Profil Display Name)
- ✅ **Telefonnummer** (`NSPrivacyCollectedDataTypePhoneNumber`) – linked: Ja, tracking: Nein, Zweck: App-Funktionalität. (Supabase Phone-OTP)
- ✅ **Fotos oder Videos** (`NSPrivacyCollectedDataTypePhotosorVideos`) – linked: Ja, tracking: Nein, Zweck: App-Funktionalität. (Profilbild-Upload)
- ✅ **Geräte-ID** (`NSPrivacyCollectedDataTypeDeviceID`) – linked: Ja, tracking: Nein, Zweck: App-Funktionalität. (Push-Token via expo-notifications)
- ✅ **Andere benutzergenerierte Inhalte** (`NSPrivacyCollectedDataTypeOtherUserContent`) – linked: Ja, tracking: Nein, Zweck: App-Funktionalität. (Profil-Bio, Deal-Notizen, Forum-Posts)
- ✅ **Absturzdaten** (`NSPrivacyCollectedDataTypeCrashData`) – linked: **Nein**, tracking: Nein, Zweck: App-Funktionalität. (Expo/React-Native Runtime)

---

## 6. Veröffentlichen

**WICHTIG:** Nach dem letzten Schritt erscheint eine Übersicht. Oben rechts ist ein Button **"Veröffentlichen"** (engl. "Publish"). DIESEN klicken.

Wenn nur "Speichern" geklickt wird, schlägt das nächste Build-Submit fehl mit
`APP_DATA_USAGES_REQUIRED` (siehe interne Memory `reference_asc_privacy_publish`).

## 7. Verifikation

Nach dem Klick auf "Veröffentlichen" steht oben auf der Privacy-Seite:

> Veröffentlicht – Stand 01.05.2026

Wenn dort weiterhin "Entwurf" oder "Nicht veröffentlicht" steht: nochmal "Veröffentlichen" klicken.

---

## 8. Required-Reason-APIs (rein zur Info, KEINE ASC-Eingabe nötig)

Apple prüft beim Build-Upload zusätzlich automatisch das Manifest auf deklarierte
Required-Reason-APIs. Im DealBuddy-Manifest sind das:

- `NSPrivacyAccessedAPICategoryUserDefaults` – Reason `CA92.1` (Supabase-Session-Storage / App-Preferences).
- `NSPrivacyAccessedAPICategoryFileTimestamp` – Reason `C617.1` (Image-/Asset-Cache-Freshness).
- `NSPrivacyAccessedAPICategorySystemBootTime` – Reason `35F9.1` (Networking-Timeouts/Retry-Windows).
- `NSPrivacyAccessedAPICategoryDiskSpace` – Reason `E174.1` (Image-Upload-Preflight-Checks).

Diese müssen NICHT in ASC eingegeben werden – sie werden direkt aus dem Manifest gelesen.

---

## Bei Änderungen am xcprivacy-Manifest

Jedes Mal, wenn `dealbuddy-native/ios/DealBuddy/PrivacyInfo.xcprivacy` erweitert wird (z. B. neue SDK-Integration, neuer Datentyp), gilt:

1. ASC → "App-Datenschutz" → "Bearbeiten".
2. Neuen Datentyp ankreuzen, Folgefragen identisch zum Manifest beantworten.
3. **Erneut "Veröffentlichen"** klicken – sonst nächster Submit-Fail.
4. Diese Datei (`docs/APP_STORE_PRIVACY_GUIDE.md`) und `docs/PLAY_DATA_SAFETY_GUIDE.md` (für Android) bei der Gelegenheit aktualisieren.

---

## Hinweis: PrivacyInfo.xcprivacy in den iOS-Build-Folder propagieren

DealBuddy ist Expo-basiert. Der `dealbuddy-native/ios/`-Ordner wird beim
nächsten `expo prebuild --clean` (bzw. EAS Cloud Build) neu generiert.
Vor dem nächsten EAS-Build-Trigger verifizieren, dass die Datei
`dealbuddy-native/ios/DealBuddy/PrivacyInfo.xcprivacy` im finalen Xcode-Target
landet – sonst ist das Manifest weg und Apple lehnt den Build mit
`ITMS-91056: Invalid privacy manifest` ab.
