import Link from 'next/link'

export const metadata = {
  title: 'Teilnahmebedingungen WM 2026 — iPhone-Cup · DealBuddy',
  description: 'Vollständige Teilnahmebedingungen des DealBuddy-Gewinnspiels "WM 2026 — iPhone-Cup" der Comms Connect GmbH.',
}

const sectionStyle: React.CSSProperties = {
  fontFamily: 'var(--font-display)',
  fontSize: 11,
  letterSpacing: 2,
  textTransform: 'uppercase',
  color: 'var(--gold-primary)',
  margin: '40px 0 12px',
  paddingTop: '24px',
  borderTop: '1px solid var(--border-subtle)',
  fontWeight: 700,
}
const firstSectionStyle: React.CSSProperties = { ...sectionStyle, borderTop: 'none', paddingTop: 0, marginTop: 24 }
const pStyle: React.CSSProperties = {
  fontSize: 14,
  color: 'var(--text-secondary)',
  lineHeight: 1.75,
  marginBottom: 10,
}

export default function TeilnahmebedingungenPage() {
  return (
    <div style={{
      minHeight: 'calc(100dvh - 80px)',
      padding: '24px 16px 100px',
      maxWidth: 720,
      margin: '0 auto',
    }}>
      <Link href="/app/gewinnspiel" style={{
        fontSize: 11, fontFamily: 'var(--font-display)', letterSpacing: 2,
        color: 'var(--gold-primary)', textTransform: 'uppercase',
        textDecoration: 'none', display: 'inline-block', marginBottom: 16,
      }}>
        ← Zurück zum Gewinnspiel
      </Link>

      <h1 style={{
        fontFamily: 'var(--font-display)', fontSize: 26, fontWeight: 800,
        letterSpacing: -0.5, lineHeight: 1.15, margin: '0 0 8px',
        color: 'var(--text-primary)',
      }}>
        Teilnahmebedingungen
      </h1>
      <p style={{ fontSize: 14, color: 'var(--text-muted)', margin: '0 0 28px' }}>
        DealBuddy WM 2026 — iPhone-Cup · Stand: Mai 2026 · Veranstalter: Comms Connect GmbH
      </p>

      {/* DAS WICHTIGSTE IN KÜRZE */}
      <div style={{
        padding: '18px 20px',
        background: 'rgba(255,184,0,0.04)',
        border: '1px solid var(--gold-glow)',
        borderRadius: 14,
        marginBottom: 32,
      }}>
        <div style={{
          fontFamily: 'var(--font-display)', fontSize: 10, fontWeight: 700,
          letterSpacing: 3, color: 'var(--gold-primary)', textTransform: 'uppercase',
          marginBottom: 14,
        }}>
          Das Wichtigste in Kürze
        </div>
        <ul style={{ listStyle: 'none', padding: 0, margin: 0, fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.7 }}>
          {[
            'Kostenlos und ohne Kaufpflicht — einfach in der App zur Tipprunde „iPhone-Cup" anmelden.',
            '1. Platz iPhone 17 Pro Max 256 GB · 2. Platz iPhone 17e · 3. Platz Apple Watch Series 11.',
            'Berechtigt: alle Personen ab 18 Jahren mit Wohnsitz in Deutschland oder Österreich.',
            'Zeitraum: 11. Juni bis 19. Juli 2026 (WM-Eröffnung bis Finale).',
            'Steuer übernimmt der Veranstalter — der Gewinner zahlt nichts drauf.',
            'Kein Glücksspiel, kein Geldeinsatz — nur Sportwissen zählt.',
          ].map((b, i) => (
            <li key={i} style={{ display: 'flex', gap: 10, marginBottom: 8 }}>
              <span style={{ color: 'var(--gold-primary)', flexShrink: 0 }}>✓</span>
              <span>{b}</span>
            </li>
          ))}
        </ul>
      </div>

      {/* § 1 */}
      <h2 style={firstSectionStyle}>§ 1 Veranstalter</h2>
      <p style={pStyle}>
        (1) Das Gewinnspiel „DealBuddy WM 2026 — iPhone-Cup" (nachfolgend „Gewinnspiel") wird veranstaltet von der <strong>Comms Connect GmbH</strong>, München. Die vollständige Anschrift, der Vertretungsberechtigte und die Handelsregistereintragung sind dem <Link href="/legal/impressum" style={{ color: 'var(--gold-primary)' }}>Impressum</Link> zu entnehmen.
      </p>
      <p style={pStyle}>
        (2) Das Gewinnspiel wird über die App und Webplattform „DealBuddy" (erreichbar unter deal-buddy.app sowie über die entsprechenden App-Store-Angebote) durchgeführt.
      </p>
      <p style={pStyle}>
        (3) Das Gewinnspiel steht in keiner Verbindung zu Apple Inc., Google LLC, der FIFA oder anderen Dritten und wird von diesen weder gesponsert noch unterstützt.
      </p>

      {/* § 2 */}
      <h2 style={sectionStyle}>§ 2 Teilnahmezeitraum</h2>
      <p style={pStyle}>
        (1) Das Gewinnspiel beginnt am <strong>11. Juni 2026</strong> mit dem Eröffnungsspiel der FIFA Fussball-Weltmeisterschaft 2026 und endet am <strong>19. Juli 2026</strong> mit dem Abpfiff des Finales.
      </p>
      <p style={pStyle}>
        (2) Eine Anmeldung zur Tipprunde „iPhone-Cup" ist ab Veröffentlichung dieser Bedingungen in der DealBuddy-App möglich.
      </p>
      <p style={pStyle}>
        (3) Der Veranstalter behält sich vor, den Teilnahmezeitraum aus wichtigem Grund (zum Beispiel bei Verschiebung oder Abbruch der WM durch den Ausrichter) entsprechend anzupassen. Eine Verlängerung oder Verkürzung wird rechtzeitig in der App bekanntgegeben.
      </p>

      {/* § 3 */}
      <h2 style={sectionStyle}>§ 3 Teilnahmeberechtigung</h2>
      <p style={pStyle}>
        (1) <strong>Mindestalter:</strong> Teilnehmen dürfen ausschließlich natürliche Personen, die zum Zeitpunkt der Anmeldung das 18. Lebensjahr vollendet haben.
      </p>
      <p style={pStyle}>
        (2) <strong>Wohnsitz:</strong> Die Teilnahme ist auf Personen mit Wohnsitz in <strong>Deutschland oder Österreich</strong> beschränkt.
      </p>
      <p style={pStyle}>
        (3) <strong>Ausschlüsse:</strong> Von der Teilnahme ausgeschlossen sind Mitarbeiterinnen und Mitarbeiter der Comms Connect GmbH sowie mit ihr verbundener Unternehmen und deren Angehörige (Ehe- und Lebenspartner, Kinder, Eltern, Geschwister sowie im selben Haushalt lebende Personen).
      </p>
      <p style={pStyle}>
        (4) <strong>Keine Kaufpflicht:</strong> Die Teilnahme ist kostenlos und nicht an den Abschluss eines entgeltlichen Vertrags, den Kauf eines Produkts oder eine sonstige Gegenleistung geknüpft.
      </p>
      <p style={pStyle}>
        (5) <strong>Ein Account pro Person:</strong> Jede Person darf nur einen DealBuddy-Account für die Teilnahme nutzen. Mehrfachaccounts führen zum Ausschluss.
      </p>
      <p style={pStyle}>
        (6) Der Veranstalter ist berechtigt, Personen, die gegen diese Bedingungen verstoßen oder die Teilnahme manipulieren (zum Beispiel durch automatisierte Skripte oder Botaccounts), jederzeit vom Gewinnspiel auszuschließen.
      </p>

      {/* § 4 */}
      <h2 style={sectionStyle}>§ 4 Ablauf und Spielmechanik</h2>
      <p style={pStyle}>
        (1) Der Veranstalter richtet in der DealBuddy-App eine offizielle Tipprunde mit der Bezeichnung „iPhone-Cup" ein. Registrierte Nutzer treten dort gegeneinander an, indem sie zu Spielen der FIFA WM 2026 Tipps abgeben.
      </p>
      <p style={pStyle}>
        (2) <strong>Punktesystem:</strong> Für korrekte und teilweise korrekte Tipps werden nach dem in der App dokumentierten Regelwerk Punkte vergeben. Massgeblich ist jeweils das offizielle Ergebnis zum Ende der regulären Spielzeit sowie — bei Spielen mit Verlängerung oder Elfmeterschiessen — das Endergebnis nach Abschluss aller Entscheidungsphasen.
      </p>
      <p style={pStyle}>
        (3) <strong>Kein Geldeinsatz:</strong> Bei DealBuddy wird zu keinem Zeitpunkt Geld eingesetzt oder riskiert. Es werden ausschliesslich Punkte vergeben. Das Spiel ist ein Geschicklichkeitswettbewerb, der Sportwissen und analytisches Denken erfordert, und kein Glücksspiel.
      </p>

      {/* § 5 */}
      <h2 style={sectionStyle}>§ 5 Gewinne</h2>
      <p style={pStyle}>
        (1) Es werden drei Sachgewinne vergeben:
      </p>
      <ul style={{ ...pStyle, paddingLeft: 22 }}>
        <li><strong>1. Platz:</strong> 1× Apple iPhone 17 Pro Max, 256 GB (Farbe nach Verfügbarkeit, versiegeltes Handelspaket mit deutschem Ladekabel und Garantiepapieren). UVP ca. 1.499 €.</li>
        <li><strong>2. Platz:</strong> 1× Apple iPhone 17e (Farbe und Speicher in der zum Versandzeitpunkt aktuell ausgelieferten Basiskonfiguration). UVP ca. 599 €.</li>
        <li><strong>3. Platz:</strong> 1× Apple Watch Series 11 (GPS, in der zum Versandzeitpunkt aktuell ausgelieferten Basiskonfiguration). UVP ca. 449 €.</li>
      </ul>
      <p style={pStyle}>
        (2) Der Veranstalter ist berechtigt, jeweils einen gleichwertigen Ersatzpreis zu gewähren, wenn das beschriebene Modell zum Zeitpunkt der Lieferung nicht mehr erhältlich ist (aktuelles vergleichbares Apple-Modell oder Apple-Online-Store-Gutschein im Gegenwert des ursprünglichen UVP).
      </p>
      <p style={pStyle}>
        (3) <strong>Keine Barauszahlung:</strong> Eine Barauszahlung der Gewinne ist ausgeschlossen. Die Gewinne sind nicht übertragbar. Eine Aufteilung zwischen mehreren Personen ist ausgeschlossen.
      </p>

      {/* § 6 */}
      <h2 style={sectionStyle}>§ 6 Gewinnerermittlung und Bekanntgabe</h2>
      <p style={pStyle}>
        (1) Die <strong>Plätze 1, 2 und 3</strong> ergeben sich aus dem Gesamtpunktestand in der offiziellen Tipprunde „iPhone-Cup" am Ende des Teilnahmezeitraums (Abpfiff des Finales am 19. Juli 2026). Den 1. Platz belegt die Person mit dem höchsten Gesamtpunktestand, gefolgt von den Plätzen 2 und 3.
      </p>
      <p style={pStyle}>
        (2) <strong>Tie-Breaker bei Punktgleichstand</strong> auf einem der drei Plätze:
      </p>
      <ul style={{ ...pStyle, paddingLeft: 22 }}>
        <li><strong>Erster Tie-Breaker:</strong> Die bei Anmeldung getippte Tor-Differenz im WM-Finale. Wer am dichtesten am tatsächlichen Wert liegt, wird vorrangig gewertet.</li>
        <li><strong>Zweiter Tie-Breaker:</strong> Besteht auch nach Anwendung des ersten Tie-Breakers ein vollständiger Gleichstand (gleiche Punkte und gleiche Tor-Differenz), entscheidet eine <strong>Verlosung unter den Gleichplatzierten</strong>. Die Verlosung erfolgt unter notarähnlicher Dokumentation durch den Veranstalter; das Ergebnis wird den Beteiligten unverzüglich mitgeteilt.</li>
      </ul>
      <p style={pStyle}>
        (3) Der Veranstalter benachrichtigt die Gewinnerinnen und Gewinner innerhalb von sieben Tagen nach Ende des Teilnahmezeitraums per E-Mail an die beim Account hinterlegte Adresse.
      </p>
      <p style={pStyle}>
        (4) Die Gewinnerinnen und Gewinner haben nach Eingang der Benachrichtigung <strong>14 Tage</strong> Zeit, die Annahme zu bestätigen und eine Lieferadresse in Deutschland oder Österreich anzugeben. Erfolgt innerhalb dieser Frist keine Rückmeldung, verfällt der Anspruch auf den jeweiligen Gewinn. In diesem Fall kann der Veranstalter die Person mit dem nächsthöheren Punktestand nachrücken lassen.
      </p>

      {/* § 7 */}
      <h2 style={sectionStyle}>§ 7 Versand des Gewinns</h2>
      <p style={pStyle}>
        (1) Der Versand erfolgt innerhalb von <strong>vier Wochen</strong> nach Bestätigung der Lieferadresse per versichertem Paket an eine Adresse in Deutschland oder Österreich. Lieferkosten trägt der Veranstalter.
      </p>
      <p style={pStyle}>
        (2) Eine Lieferung in andere Länder ist ausgeschlossen.
      </p>

      {/* § 8 */}
      <h2 style={sectionStyle}>§ 8 Steuerliche Behandlung</h2>
      <p style={pStyle}>
        (1) Der Veranstalter übernimmt die auf den Sachgewinn entfallende Pauschalsteuer. Der Gewinner muss den erhaltenen Preis nicht selbst in der Steuererklärung angeben und zahlt keine Einkommensteuer auf den Gewinn.
      </p>
      <p style={pStyle}>
        (2) Über die Übernahme der Pauschalsteuer wird der Gewinner schriftlich informiert.
      </p>

      {/* § 9 */}
      <h2 style={sectionStyle}>§ 9 Datenschutz</h2>
      <p style={pStyle}>
        (1) Verantwortlich für die Verarbeitung personenbezogener Daten ist die Comms Connect GmbH.
      </p>
      <p style={pStyle}>
        (2) Verarbeitet werden: E-Mail-Adresse, Nutzungsname, Tippeingaben und Punkte, Anmeldezeitpunkt sowie im Gewinnfall vollständiger Name und Lieferadresse.
      </p>
      <p style={pStyle}>
        (3) Zweck der Verarbeitung: Durchführung des Gewinnspiels (Ermittlung, Benachrichtigung, Versand). Rechtsgrundlage ist die Durchführung eines Rechtsverhältnisses, an dem die betroffene Person beteiligt ist.
      </p>
      <p style={pStyle}>
        (4) <strong>Speicherdauer:</strong> 12 Monate nach Ende des Gewinnspiels.
      </p>
      <p style={pStyle}>
        (5) <strong>Auftragsverarbeiter</strong> sind Supabase Inc. (USA, EU-Standardvertragsklauseln), Vercel Inc. (USA, EU-SCC) und Resend Inc. (USA, EU-SCC).
      </p>
      <p style={pStyle}>
        (6) Weitere Informationen, Betroffenenrechte und Kontaktmöglichkeiten in der vollständigen <Link href="/legal/privacy" style={{ color: 'var(--gold-primary)' }}>Datenschutzerklärung</Link>.
      </p>

      {/* § 10 */}
      <h2 style={sectionStyle}>§ 10 Sonstiges</h2>
      <p style={pStyle}>
        (1) <strong>Änderungsvorbehalt:</strong> Der Veranstalter behält sich vor, das Gewinnspiel aus wichtigem Grund vorzeitig zu beenden, insbesondere wenn eine ordnungsgemässe Durchführung aus technischen oder rechtlichen Gründen nicht sichergestellt werden kann.
      </p>
      <p style={pStyle}>
        (2) <strong>Rechtsweg:</strong> Der Rechtsweg bezüglich der Entscheidung über den Gewinner ist ausgeschlossen.
      </p>
      <p style={pStyle}>
        (3) <strong>Anwendbares Recht:</strong> Es gilt das Recht der Bundesrepublik Deutschland. Gerichtsstand — soweit gesetzlich zulässig — ist der Sitz der Comms Connect GmbH.
      </p>
      <p style={pStyle}>
        (4) <strong>Salvatorische Klausel:</strong> Sollte eine Bestimmung dieser Bedingungen unwirksam sein, bleibt die Wirksamkeit der übrigen Bestimmungen unberührt.
      </p>
      <p style={pStyle}>
        (5) <strong>Keine Verbindung zu Plattformbetreibern:</strong> Dieses Gewinnspiel steht in keiner Verbindung zu Apple Inc. oder Google LLC.
      </p>

      <div style={{
        marginTop: 48,
        padding: '16px 18px',
        background: 'var(--bg-surface)',
        border: '1px solid var(--border-subtle)',
        borderRadius: 10,
        fontSize: 11,
        color: 'var(--text-muted)',
        lineHeight: 1.7,
      }}>
        Comms Connect GmbH · München · Stand: Mai 2026 ·{' '}
        <Link href="/app/gewinnspiel" style={{ color: 'var(--gold-primary)' }}>
          Zurück zum Gewinnspiel
        </Link>
      </div>
    </div>
  )
}
