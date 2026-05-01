'use client'

import { useRouter } from 'next/navigation'

export default function TermsPage() {
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
          Nutzungsbedingungen
        </h1>
      </div>

      {/* Content */}
      <div style={{ padding: '24px 16px 64px', lineHeight: 1.7, fontSize: 14 }}>

        <p style={{ color: 'var(--text-secondary)', marginBottom: 24 }}>Stand: 1. Mai 2026</p>

        <Section title="1. Geltungsbereich">
          <p>
            Diese Allgemeinen Gesch&auml;ftsbedingungen (AGB) gelten f&uuml;r die Nutzung der DealBuddy-App
            (nachfolgend &bdquo;App&ldquo; oder &bdquo;Plattform&ldquo;), betrieben von:
          </p>
          <p style={{ margin: '12px 0', padding: '12px 16px', background: 'var(--gold-subtle)', borderRadius: 10, borderLeft: '3px solid var(--gold-primary)' }}>
            <strong>Rainer Roloff</strong><br />
            Comms Connect GmbH<br />
            E-Mail: info@deal-buddy.app
          </p>
          <p>
            Mit der Registrierung und Nutzung der App erkl&auml;rt sich der Nutzer mit diesen AGB einverstanden.
          </p>
        </Section>

        <Section title="2. Beschreibung der Plattform">
          <p>
            DealBuddy ist eine <strong>Social-Competition-Plattform</strong>, auf der Nutzer sich gegenseitig zu
            privaten, f&auml;higkeitsbasierten Herausforderungen (&bdquo;Deals&ldquo;) auffordern k&ouml;nnen. Deals
            sind pers&ouml;nliche Abmachungen zwischen Freunden, die auf eigenem K&ouml;nnen und Ehrgeiz basieren.
          </p>
          <p style={{ marginTop: 12 }}>
            <strong>DealBuddy ist ausdr&uuml;cklich keine Plattform f&uuml;r Gl&uuml;cksspiele oder
            zufallsbasierte Aktivit&auml;ten.</strong> Es werden keine Echtgeld-Gewinne ausgesch&uuml;ttet. Deals
            dienen ausschlie&szlig;lich der Unterhaltung und dem freundschaftlichen Wettstreit.
          </p>
          <p style={{ marginTop: 12 }}>
            Weitere Funktionen der App umfassen: Battle Cards, Tippen (Sporttipps), einen In-App-Shop
            f&uuml;r Coins sowie Push-Benachrichtigungen.
          </p>
        </Section>

        <Section title="3. Registrierung und Mindestalter">
          <p>
            Die Nutzung der App setzt eine Registrierung voraus. Der Nutzer muss mindestens
            <strong> 18 Jahre alt</strong> sein. Mit der Registrierung best&auml;tigt der Nutzer, dass er das
            erforderliche Mindestalter erreicht hat.
          </p>
          <p style={{ marginTop: 12 }}>
            Jeder Nutzer darf nur ein Konto besitzen. Die Weitergabe von Zugangsdaten an Dritte ist untersagt.
          </p>
        </Section>

        <Section title="4. Coins und virtuelle W&auml;hrung">
          <p>
            Innerhalb der App k&ouml;nnen Nutzer &bdquo;Coins&ldquo; erwerben. Coins sind eine
            <strong> virtuelle W&auml;hrung ohne realen Geldwert</strong>. Es besteht kein Anspruch auf
            R&uuml;ckerstattung oder Auszahlung von Coins in Echtgeld.
          </p>
          <p style={{ marginTop: 12 }}>
            Coins k&ouml;nnen ausschlie&szlig;lich innerhalb der App f&uuml;r die vorgesehenen
            Funktionen verwendet werden. Der Kauf von Coins erfolgt &uuml;ber den Zahlungsdienstleister
            Stripe in Euro (EUR).
          </p>
        </Section>

        <Section title="5. Deals (Herausforderungen)">
          <p>
            Deals sind private, f&auml;higkeitsbasierte Herausforderungen zwischen zwei oder mehr Nutzern.
            Sie basieren auf pers&ouml;nlichem K&ouml;nnen, Geschicklichkeit oder Wissen.
          </p>
          <p style={{ marginTop: 12 }}>
            Die Best&auml;tigung eines Deals erfolgt &uuml;ber einen biometrischen Handshake
            (FaceID/TouchID) auf dem Endger&auml;t des Nutzers. Die biometrischen Daten werden
            ausschlie&szlig;lich lokal auf dem Ger&auml;t verarbeitet und nicht an DealBuddy &uuml;bermittelt.
          </p>
          <p style={{ marginTop: 12 }}>
            Deal-Beweise (Fotos) werden &uuml;ber die In-App-Kamera aufgenommen und in der App gespeichert.
          </p>
        </Section>

        <Section title="6. Nutzerverhalten und Inhalte">
          <p>
            Nutzer sind f&uuml;r s&auml;mtliche von ihnen eingestellten Inhalte (Profilbilder, Deal-Beweise,
            Nachrichten) selbst verantwortlich. Folgende Inhalte sind untersagt:
          </p>
          <ul style={{ paddingLeft: 20, marginTop: 12 }}>
            <li>Beleidigende, diskriminierende oder gewaltverherrlichende Inhalte</li>
            <li>Pornografische oder sexuell explizite Inhalte</li>
            <li>Inhalte, die gegen geltendes Recht versto&szlig;en</li>
            <li>Spam, Phishing oder betr&uuml;gerische Inhalte</li>
            <li>Inhalte, die Rechte Dritter (insbesondere Urheberrechte oder Pers&ouml;nlichkeitsrechte) verletzen</li>
          </ul>
          <p style={{ marginTop: 12 }}>
            DealBuddy beh&auml;lt sich das Recht vor, unangemessene Inhalte ohne Vorank&uuml;ndigung zu
            entfernen und den betreffenden Nutzer zu sperren.
          </p>
        </Section>

        <Section title="7. Haftungsausschluss">
          <p>
            DealBuddy stellt lediglich die technische Plattform zur Verf&uuml;gung. F&uuml;r den Inhalt,
            die Durchf&uuml;hrung und das Ergebnis von Deals zwischen Nutzern &uuml;bernimmt DealBuddy
            keine Haftung.
          </p>
          <p style={{ marginTop: 12 }}>
            Die Haftung von DealBuddy ist auf Vorsatz und grobe Fahrl&auml;ssigkeit beschr&auml;nkt,
            soweit gesetzlich zul&auml;ssig. F&uuml;r die Verf&uuml;gbarkeit der App wird keine Gew&auml;hr
            &uuml;bernommen.
          </p>
        </Section>

        <Section title="8. K&uuml;ndigung und Kontol&ouml;schung">
          <p>
            Der Nutzer kann sein Konto jederzeit &uuml;ber die App-Einstellungen l&ouml;schen. Mit der
            L&ouml;schung werden alle pers&ouml;nlichen Daten gem&auml;&szlig; den gesetzlichen Vorgaben
            entfernt.
          </p>
          <p style={{ marginTop: 12 }}>
            DealBuddy beh&auml;lt sich das Recht vor, Nutzerkonten bei Verst&ouml;&szlig;en gegen
            diese AGB ohne Vorank&uuml;ndigung zu sperren oder zu l&ouml;schen. Erworbene Coins
            verfallen in diesem Fall ersatzlos.
          </p>
        </Section>

        <Section title="9. &Auml;nderungen der AGB">
          <p>
            DealBuddy beh&auml;lt sich vor, diese AGB jederzeit zu &auml;ndern. &Uuml;ber wesentliche
            &Auml;nderungen werden Nutzer rechtzeitig informiert. Die fortgesetzte Nutzung der App nach
            Inkrafttreten ge&auml;nderter AGB gilt als Zustimmung.
          </p>
        </Section>

        <Section title="10. Anwendbares Recht und Gerichtsstand">
          <p>
            Es gilt das Recht der Bundesrepublik Deutschland. Gerichtsstand ist, soweit gesetzlich
            zul&auml;ssig, der Sitz der Comms Connect GmbH.
          </p>
        </Section>

        <Section title="11. Kontakt">
          <p>
            Bei Fragen zu diesen Nutzungsbedingungen wenden Sie sich bitte an:
          </p>
          <p style={{ marginTop: 8 }}>
            <strong>E-Mail:</strong> info@deal-buddy.app
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
