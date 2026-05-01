# Homepage FTP-Upload – deal-buddy.app

**Stand:** 2026-05-01
**Wann:** Nach jeder Änderung an `Homepage/*.html`, `Homepage/*.css`, `Homepage/*.js`. Die Homepage `deal-buddy.app` läuft auf Apache und wird **nicht** über Vercel/Git deployed – kein Auto-Deploy, kein CI.

---

## Was hochgeladen werden muss (Cookie-Banner Rollout 2026-05-01)

### Neue Files (vorher nicht vorhanden auf dem Server)

| Lokaler Pfad | Remote-Ziel |
|---|---|
| `Homepage/cookie-banner.css` | Web-Root + `/cookie-banner.css` |
| `Homepage/cookie-banner.js` | Web-Root + `/cookie-banner.js` |

### Modifizierte HTML-Files (Cookie-Banner-Einbindung – `<link>` vor `</head>`, `<script defer>` vor `</body>`)

| Lokaler Pfad | Remote-Ziel |
|---|---|
| `Homepage/index.html` | Web-Root + `/index.html` |
| `Homepage/datenschutz.html` | Web-Root + `/datenschutz.html` |
| `Homepage/agb.html` | Web-Root + `/agb.html` |
| `Homepage/impressum.html` | Web-Root + `/impressum.html` |
| `Homepage/download.html` | Web-Root + `/download.html` |
| `Homepage/support.html` | Web-Root + `/support.html` |

### Bewusst NICHT hochladen / unverändert

- `Homepage/card.html` – Share-Detail-Page, Cookie-Banner bewusst nicht eingebunden.
- `Homepage/admin/*`, `Homepage/creator/*` – nicht-public Tools, brauchen den Banner nicht.

**Insgesamt: 8 Files (2 neu + 6 modifiziert).**

---

## FTP-Upload-Schritte

### Vorbereitung

1. FTP-Client öffnen. Empfehlung:
   - **Windows:** FileZilla (https://filezilla-project.org/) oder WinSCP.
   - **macOS:** Cyberduck oder Transmit.
2. Zugangsdaten zur Hand haben:
   - **TODO Hoster verifizieren:** Login-URL/Host, FTP-User, FTP-Passwort liegen entweder in 1Password (Eintrag "deal-buddy.app FTP") oder im Dashboard des Hosters (Strato / IONOS / All-Inkl. / Hetzner / o. ä.). Vor Upload prüfen, welcher Hoster die Apache-Instanz hostet (DNS-Lookup `dig deal-buddy.app` zeigt die IP, daraus Hoster ableitbar). Sobald verifiziert, Hoster + Web-Root-Pfad in dieser Datei eintragen.

### Schritt-für-Schritt

1. FTP-Client öffnen → "Neue Verbindung".
2. Server-Details eintragen:
   - Host: (laut Hoster-Dashboard, üblich `ftp.deal-buddy.app` oder Hoster-spezifisch)
   - Protokoll: **SFTP** wenn vom Hoster angeboten, sonst FTP über TLS (FTPS). Plain-FTP nur als letzter Ausweg.
   - Benutzer: (laut 1Password)
   - Passwort: (laut 1Password)
   - Port: 22 (SFTP) bzw. 21 (FTP/FTPS).
3. Verbinden. Beim ersten Connect den Server-Fingerprint einmalig akzeptieren.
4. Lokaler Tab: navigiere zu `C:\Claude Code\DealBuddy\Homepage\`.
5. Remote Tab: navigiere zum **Web-Root** (übliche Namen je nach Hoster):
   - Strato: `/htdocs/` oder `/`
   - IONOS: `/`
   - All-Inkl.: `/www/htdocs/<paket-id>/`
   - Hetzner Webhosting: `/public_html/`
   - Wenn unklar: dort, wo bereits `index.html` und `datenschutz.html` liegen.
6. Markiere die 8 Files lokal (Strg+Klick auf jeden Eintrag aus der Tabelle oben) → **Hochladen** (Drag-and-Drop ins Remote-Panel ODER Rechtsklick → "Hochladen").
7. Bei Überschreiben-Warnung: **"Vorhandene Datei überschreiben"** wählen (für die 6 HTML-Files). Die 2 neuen Files (`cookie-banner.css`, `cookie-banner.js`) werden ohne Rückfrage hochgeladen.
8. Warten bis die Übertragung abgeschlossen ist (FileZilla zeigt "Erfolgreiche Übertragungen: 8" am unteren Rand).
9. Verbindung trennen.

## Verifikation

### A) Im Browser

1. Browser öffnen, **Inkognito-Modus** (sonst greift evtl. localStorage von vorherigen Tests).
2. https://deal-buddy.app aufrufen.
3. Hard-Reload: Strg+F5 (Windows) bzw. Cmd+Shift+R (macOS), um sicherzustellen, dass kein gecachter HTML geladen wird.
4. **Erwartet:** Am unteren Bildschirmrand erscheint nach kurzer Verzögerung ein dunkler Cookie-Banner mit der Überschrift "Cookie-Hinweis" und einem Button "Verstanden".
5. Klick auf "Verstanden" → der Banner soll mit einem 250ms Fade-Out verschwinden und beim Reload nicht mehr auftauchen.

### B) Im DevTools

1. F12 öffnen → Tab "Anwendung" / "Application".
2. Sektion "Speicher" / "Storage" → "Lokaler Speicher" / "Local Storage" → `https://deal-buddy.app`.
3. **Erwartet:** Eintrag `db_homepage_cookie_ack` mit Wert `1`.
4. Eintrag löschen → Reload → Banner erscheint wieder. Dies bestätigt die Banner-Logik.

### C) Pro HTML-Seite stichprobenartig

Auf jeder der 6 modifizierten Seiten den Banner sehen (Inkognito-Tab nutzen, weil localStorage pro Origin geteilt wird – nach erstem "Verstanden" verschwindet er auf allen Subpages):

- https://deal-buddy.app/
- https://deal-buddy.app/datenschutz.html
- https://deal-buddy.app/agb.html
- https://deal-buddy.app/impressum.html
- https://deal-buddy.app/download.html
- https://deal-buddy.app/support.html

Vor dem nächsten Stichproben-Check jeweils den localStorage-Key löschen (siehe Schritt B), sonst zeigt der Banner sich nur auf der ersten Seite.

### D) Network-Tab Sanity-Check

DevTools → Network → Reload. Beide neuen Files müssen mit Status 200 erscheinen:
- `cookie-banner.css` → 200
- `cookie-banner.js` → 200

Wenn einer 404 ist: der Upload hat sie nicht ins Web-Root gelegt. Pfad korrigieren und erneut hochladen.

---

## Troubleshooting

| Problem | Ursache | Lösung |
|---|---|---|
| Banner erscheint nicht | HTML wurde nicht überschrieben (alte Version live) | Strg+F5; FTP-Cache prüfen; ggf. Datei neu hochladen |
| Banner erscheint, verschwindet aber nicht nach Klick | `cookie-banner.js` fehlt oder 404 | Im Network-Tab Status prüfen, JS-Datei neu hochladen |
| Banner steht ungestylt unten links | `cookie-banner.css` fehlt oder 404 | Network-Tab prüfen, CSS-Datei neu hochladen |
| Banner erscheint im Privatmodus, aber nicht im normalen Browser | localStorage hat bereits `db_homepage_cookie_ack=1` | Erwartetes Verhalten – Banner ist abgehakt |
| 403/401 beim Upload | FTP-User hat kein Schreibrecht auf das Web-Root | Hoster-Dashboard: Schreibrechte prüfen, ggf. neuen FTP-User anlegen |
| Datei landet im falschen Ordner | Web-Root falsch gewählt | Im Browser https://deal-buddy.app/cookie-banner.css aufrufen – wenn 200, ist der Upload korrekt; wenn 404, falscher Remote-Ordner |

---

## Bei zukünftigen Homepage-Änderungen

Generelle Regel: jede Änderung in `C:\Claude Code\DealBuddy\Homepage\` muss manuell per FTP auf den Webspace.

Nach jedem Upload:
1. Hard-Reload im Inkognito-Modus.
2. Stichprobe: Datei direkt im Browser öffnen (z. B. https://deal-buddy.app/index.html) und Inhalt mit der lokalen Version vergleichen.
3. localStorage-Reset, falls Cookie-Banner-Logik betroffen.
