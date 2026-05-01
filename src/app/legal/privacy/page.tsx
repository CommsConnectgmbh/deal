'use client'

import { useRouter } from 'next/navigation'

export default function PrivacyPage() {
  const router = useRouter()

  return (
    <div style={{ maxWidth: 430, margin: '0 auto', minHeight: '100dvh', background: 'var(--bg-base)', color: 'var(--text-primary)', fontFamily: 'system-ui, sans-serif' }}>
      {/* Header */}
      <div style={{ position: 'sticky', top: 0, zIndex: 10, background: 'var(--bg-base)', borderBottom: '1px solid var(--border-subtle)', padding: '16px', display: 'flex', alignItems: 'center', gap: 12 }}>
        <button
          onClick={() => router.back()}
          style={{ background: 'var(--bg-overlay)', border: 'none', borderRadius: 10, width: 40, height: 40, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: 'var(--text-primary)', fontSize: 18 }}
        >
          &#8592;
        </button>
        <h1 style={{ fontFamily: 'Oswald, sans-serif', fontSize: 20, fontWeight: 700, color: 'var(--gold-primary)', margin: 0, letterSpacing: 1 }}>
          Datenschutzerkl&auml;rung
        </h1>
      </div>

      {/* Content */}
      <div style={{ padding: '24px 16px 64px', lineHeight: 1.7, fontSize: 14 }}>

        <p style={{ color: 'var(--text-secondary)', marginBottom: 24 }}>Stand: 1. Mai 2026</p>

        <Section title="1. Verantwortlicher">
          <p>
            Verantwortlicher im Sinne der Datenschutz-Grundverordnung (DSGVO) ist:
          </p>
          <p style={{ margin: '12px 0', padding: '12px 16px', background: 'var(--gold-subtle)', borderRadius: 10, borderLeft: '3px solid var(--gold-primary)' }}>
            <strong>Rainer Roloff</strong><br />
            Comms Connect GmbH<br />
            E-Mail: info@deal-buddy.app
          </p>
        </Section>

        <Section title="2. &Uuml;bersicht der erhobenen Daten">
          <p>Im Rahmen der Nutzung von DealBuddy werden folgende personenbezogene Daten erhoben:</p>
          <ul style={{ paddingLeft: 20, marginTop: 12 }}>
            <li><strong>Registrierungsdaten:</strong> E-Mail-Adresse, Telefonnummer, Benutzername</li>
            <li><strong>Profildaten:</strong> Profilbild (Kamera-Upload), Anzeigename</li>
            <li><strong>Deal-Beweise:</strong> Fotos, die &uuml;ber die In-App-Kamera aufgenommen werden</li>
            <li><strong>Nutzungsdaten:</strong> App-Interaktionen, Deals, Battle Cards, Tippen-Aktivit&auml;ten</li>
            <li><strong>Technische Daten:</strong> Ger&auml;tetyp, Betriebssystem, IP-Adresse</li>
            <li><strong>Push-Tokens:</strong> F&uuml;r den Versand von Push-Benachrichtigungen</li>
          </ul>
        </Section>

        <Section title="3. Rechtsgrundlagen">
          <p>Die Verarbeitung Ihrer Daten erfolgt auf Grundlage von:</p>
          <ul style={{ paddingLeft: 20, marginTop: 12 }}>
            <li><strong>Art. 6 Abs. 1 lit. a DSGVO</strong> &ndash; Einwilligung (z.&nbsp;B. Push-Benachrichtigungen, Kamera-Zugriff)</li>
            <li><strong>Art. 6 Abs. 1 lit. b DSGVO</strong> &ndash; Vertragserf&uuml;llung (Bereitstellung der App-Funktionen)</li>
            <li><strong>Art. 6 Abs. 1 lit. f DSGVO</strong> &ndash; Berechtigtes Interesse (Sicherheit, Missbrauchspr&auml;vention)</li>
          </ul>
        </Section>

        <Section title="4. Kamera-Zugriff">
          <p>
            DealBuddy ben&ouml;tigt Zugriff auf die Kamera Ihres Ger&auml;ts f&uuml;r:
          </p>
          <ul style={{ paddingLeft: 20, marginTop: 12 }}>
            <li>Aufnahme von Profilbildern</li>
            <li>Aufnahme von Deal-Beweisen (Proof-Fotos)</li>
          </ul>
          <p style={{ marginTop: 12 }}>
            Es wird ausschlie&szlig;lich die <strong>In-App-Kamera</strong> verwendet. Ein Zugriff auf die
            Foto-Galerie des Ger&auml;ts erfolgt nicht. Der Kamera-Zugriff wird nur nach ausdr&uuml;cklicher
            Erlaubnis des Nutzers aktiviert.
          </p>
        </Section>

        <Section title="5. Biometrische Daten (FaceID / TouchID)">
          <p>
            DealBuddy nutzt in der nativen App die biometrische Authentifizierung des Ger&auml;ts
            (FaceID oder TouchID) f&uuml;r die Best&auml;tigung von Deals (&bdquo;biometrischer
            Handshake&ldquo;).
          </p>
          <p style={{ marginTop: 12, padding: '12px 16px', background: 'rgba(34,197,94,0.08)', borderRadius: 10, borderLeft: '3px solid #22C55E' }}>
            <strong>Wichtig:</strong> Biometrische Daten werden ausschlie&szlig;lich lokal auf Ihrem
            Ger&auml;t verarbeitet. DealBuddy erh&auml;lt, speichert oder &uuml;bermittelt
            <strong> keine</strong> biometrischen Daten. Die Verarbeitung erfolgt vollst&auml;ndig
            &uuml;ber die Sicherheitsarchitektur Ihres Betriebssystems (iOS Secure Enclave / Android Keystore).
          </p>
        </Section>

        <Section title="6. Push-Benachrichtigungen">
          <p>
            Nach Ihrer Einwilligung speichern wir Ihr Push-Token in unserer Datenbank (Supabase),
            um Ihnen Benachrichtigungen &uuml;ber Deals, Nachrichten und andere relevante
            Aktivit&auml;ten senden zu k&ouml;nnen.
          </p>
          <p style={{ marginTop: 12 }}>
            Sie k&ouml;nnen Push-Benachrichtigungen jederzeit in den Ger&auml;teeinstellungen oder
            in den App-Einstellungen deaktivieren. Bei Deaktivierung wird Ihr Push-Token gel&ouml;scht.
          </p>
        </Section>

        <Section title="7. Zahlungsdaten">
          <p>
            Der Kauf von Coins erfolgt &uuml;ber den Zahlungsdienstleister <strong>Stripe, Inc.</strong>
            (San Francisco, USA). Ihre Zahlungsdaten (Kreditkartennummer, Bankdaten etc.) werden
            <strong> ausschlie&szlig;lich von Stripe verarbeitet</strong> und nicht an DealBuddy
            &uuml;bermittelt oder gespeichert.
          </p>
          <p style={{ marginTop: 12 }}>
            Stripe ist PCI DSS Level 1 zertifiziert. Weitere Informationen finden Sie in der
            Datenschutzerkl&auml;rung von Stripe:{' '}
            <a href="https://stripe.com/de/privacy" target="_blank" rel="noopener noreferrer" style={{ color: 'var(--gold-primary)' }}>
              stripe.com/de/privacy
            </a>
          </p>
          <p style={{ marginTop: 12 }}>
            F&uuml;r die Daten&uuml;bermittlung in die USA bestehen Standardvertragsklauseln gem&auml;&szlig;
            Art. 46 Abs. 2 lit. c DSGVO.
          </p>
        </Section>

        <Section title="8. Hosting und Datenverarbeitung">
          <p>
            <strong>Supabase:</strong> Unsere Datenbank und Backend-Dienste werden von Supabase betrieben.
            Der Serverstandort ist <strong>Frankfurt am Main, Deutschland (EU)</strong>. Ihre Daten
            verlassen damit grunds&auml;tzlich nicht den europ&auml;ischen Wirtschaftsraum.
          </p>
          <p style={{ marginTop: 12 }}>
            <strong>Vercel:</strong> Die Progressive Web App (PWA) wird &uuml;ber Vercel gehostet.
            Vercel nutzt ein globales Edge-Netzwerk, wobei der Hauptserverstandort in der EU liegt.
          </p>
        </Section>

        <Section title="9. Analytics (PostHog)">
          <p>
            Zur Verbesserung der App nutzen wir <strong>PostHog</strong> als Analyse-Tool. PostHog
            erfasst anonymisierte Nutzungsdaten wie Seitenaufrufe, Klickverhalten und Feature-Nutzung.
          </p>
          <p style={{ marginTop: 12 }}>
            Die Verarbeitung erfolgt auf Grundlage Ihrer Einwilligung (Art. 6 Abs. 1 lit. a DSGVO),
            die Sie beim ersten App-Start &uuml;ber das Cookie-Consent-Banner erteilen.
          </p>
          <p style={{ marginTop: 12, padding: '12px 16px', background: 'rgba(96,165,250,0.08)', borderRadius: 10, borderLeft: '3px solid #60A5FA' }}>
            <strong>Einwilligung widerrufen:</strong> Sie k&ouml;nnen Ihre Einwilligung in die
            Analyse-Verarbeitung jederzeit mit Wirkung f&uuml;r die Zukunft widerrufen unter{' '}
            <strong>Einstellungen &rarr; Datenschutz &rarr; Analyse</strong>. Bei Deaktivierung
            werden keine weiteren Analyse-Daten erfasst.
          </p>
        </Section>

        <Section title="10. Cookies">
          <p>
            DealBuddy verwendet ausschlie&szlig;lich <strong>technisch notwendige Cookies</strong>, die
            f&uuml;r den Betrieb der App erforderlich sind (z.&nbsp;B. Session-Cookies f&uuml;r die
            Authentifizierung).
          </p>
          <p style={{ marginTop: 12 }}>
            Marketing- oder Tracking-Cookies werden nicht eingesetzt. Eine gesonderte
            Cookie-Einwilligung ist daher nicht erforderlich.
          </p>
        </Section>

        <Section title="11. Speicherdauer">
          <p>
            Personenbezogene Daten werden nur so lange gespeichert, wie es f&uuml;r die Erf&uuml;llung
            der jeweiligen Zwecke erforderlich ist oder gesetzliche Aufbewahrungspflichten bestehen.
          </p>
          <p style={{ marginTop: 12 }}>
            Bei L&ouml;schung Ihres Kontos werden Ihre personenbezogenen Daten innerhalb von 30 Tagen
            gel&ouml;scht, sofern keine gesetzlichen Aufbewahrungspflichten entgegenstehen.
          </p>
        </Section>

        <Section title="12. Ihre Rechte">
          <p>Sie haben gem&auml;&szlig; DSGVO folgende Rechte:</p>
          <ul style={{ paddingLeft: 20, marginTop: 12 }}>
            <li><strong>Auskunftsrecht</strong> (Art. 15 DSGVO) &ndash; Sie k&ouml;nnen Auskunft &uuml;ber Ihre gespeicherten Daten verlangen.</li>
            <li><strong>Recht auf Berichtigung</strong> (Art. 16 DSGVO) &ndash; Sie k&ouml;nnen unrichtige Daten korrigieren lassen.</li>
            <li><strong>Recht auf L&ouml;schung</strong> (Art. 17 DSGVO) &ndash; Sie k&ouml;nnen die L&ouml;schung Ihrer Daten verlangen.</li>
            <li><strong>Recht auf Einschr&auml;nkung</strong> (Art. 18 DSGVO) &ndash; Sie k&ouml;nnen die Einschr&auml;nkung der Verarbeitung verlangen.</li>
            <li>
              <strong>Recht auf Daten&uuml;bertragbarkeit</strong> (Art. 20 DSGVO) &ndash; Sie
              k&ouml;nnen Ihre Daten in einem g&auml;ngigen Format erhalten. F&uuml;r den Selbst-Export
              steht Ihnen unter{' '}
              <strong>Einstellungen &rarr; Meine Daten &rarr; Daten exportieren</strong>{' '}
              ein Download-Button zur Verf&uuml;gung, der eine vollst&auml;ndige JSON-Datei mit allen
              zu Ihrer Person gespeicherten Daten erzeugt.
            </li>
            <li><strong>Widerspruchsrecht</strong> (Art. 21 DSGVO) &ndash; Sie k&ouml;nnen der Verarbeitung widersprechen.</li>
            <li><strong>Recht auf Widerruf</strong> &ndash; Erteilte Einwilligungen k&ouml;nnen jederzeit mit Wirkung f&uuml;r die Zukunft widerrufen werden.</li>
          </ul>
        </Section>

        <Section title="13. Beschwerderecht">
          <p>
            Sie haben das Recht, sich bei einer Datenschutz-Aufsichtsbeh&ouml;rde zu beschweren,
            wenn Sie der Ansicht sind, dass die Verarbeitung Ihrer Daten gegen die DSGVO verst&ouml;&szlig;t.
          </p>
        </Section>

        <Section title="14. Kontakt">
          <p>
            Bei Fragen zum Datenschutz oder zur Aus&uuml;bung Ihrer Rechte wenden Sie sich bitte an:
          </p>
          <p style={{ marginTop: 8 }}>
            <strong>E-Mail:</strong>{' '}
            <a href="mailto:info@deal-buddy.app" style={{ color: 'var(--gold-primary)' }}>info@deal-buddy.app</a>
          </p>
        </Section>

      </div>
    </div>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section style={{ marginBottom: 32 }}>
      <h2 style={{ fontFamily: 'Oswald, sans-serif', fontSize: 16, fontWeight: 600, color: 'var(--gold-primary)', marginBottom: 12, letterSpacing: 0.5 }}>
        {title}
      </h2>
      <div style={{ color: 'var(--text-secondary)' }}>{children}</div>
    </section>
  )
}
