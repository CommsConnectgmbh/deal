'use client'

import { useRouter } from 'next/navigation'

export default function ImprintPage() {
  const router = useRouter()

  return (
    <div style={{ maxWidth: 430, margin: '0 auto', minHeight: '100dvh', background: '#080808', color: '#e0e0e0', fontFamily: 'system-ui, sans-serif' }}>
      {/* Header */}
      <div style={{ position: 'sticky', top: 0, zIndex: 10, background: '#080808', borderBottom: '1px solid rgba(255,255,255,0.08)', padding: '16px', display: 'flex', alignItems: 'center', gap: 12 }}>
        <button
          onClick={() => router.back()}
          style={{ background: 'rgba(255,255,255,0.06)', border: 'none', borderRadius: 10, width: 40, height: 40, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: '#fff', fontSize: 18 }}
        >
          &#8592;
        </button>
        <h1 style={{ fontFamily: 'Oswald, sans-serif', fontSize: 20, fontWeight: 700, color: '#FFB800', margin: 0, letterSpacing: 1 }}>
          Impressum
        </h1>
      </div>

      {/* Content */}
      <div style={{ padding: '24px 16px 64px', lineHeight: 1.7, fontSize: 14 }}>

        <Section title="Angaben gem&auml;&szlig; &sect; 5 TMG">
          <p style={{ margin: '12px 0', padding: '16px', background: 'rgba(255,184,0,0.06)', borderRadius: 10, borderLeft: '3px solid #FFB800' }}>
            <strong style={{ fontSize: 16 }}>Comms Connect GmbH</strong><br /><br />
            Vertreten durch: Rainer Roloff<br /><br />
            Tal 30<br />
            80331 M&uuml;nchen<br />
            Deutschland
          </p>
        </Section>

        <Section title="Kontakt">
          <table style={{ borderCollapse: 'collapse', width: '100%' }}>
            <tbody>
              <Row label="E-Mail" value={<a href="mailto:info@deal-buddy.app" style={{ color: '#FFB800' }}>info@deal-buddy.app</a>} />
              <Row label="Telefon" value="+49 89 4522 1556" />
              <Row label="Website" value={<a href="https://deal-buddy.app" target="_blank" rel="noopener noreferrer" style={{ color: '#FFB800' }}>deal-buddy.app</a>} />
            </tbody>
          </table>
        </Section>

        <Section title="Umsatzsteuer-Identifikationsnummer">
          <p>
            Umsatzsteuer-Identifikationsnummer gem&auml;&szlig; &sect; 27 a Umsatzsteuergesetz:
          </p>
          <p style={{ marginTop: 8, fontWeight: 600, color: '#fff' }}>
            DE451966748
          </p>
        </Section>

        <Section title="Verantwortlich f&uuml;r den Inhalt gem&auml;&szlig; &sect; 18 Abs. 2 MStV">
          <p style={{ margin: '12px 0', padding: '16px', background: 'rgba(255,184,0,0.06)', borderRadius: 10, borderLeft: '3px solid #FFB800' }}>
            <strong>Rainer Roloff</strong><br />
            Comms Connect GmbH<br />
            Tal 30, 80331 M&uuml;nchen
          </p>
        </Section>

        <Section title="Handelsregister">
          <p>
            HRB 295951, Amtsgericht M&uuml;nchen
          </p>
        </Section>

        <Section title="EU-Streitschlichtung">
          <p>
            Die Europ&auml;ische Kommission stellt eine Plattform zur Online-Streitbeilegung (OS) bereit:{' '}
            <a href="https://ec.europa.eu/consumers/odr/" target="_blank" rel="noopener noreferrer" style={{ color: '#FFB800' }}>
              ec.europa.eu/consumers/odr
            </a>
          </p>
          <p style={{ marginTop: 12 }}>
            Unsere E-Mail-Adresse finden Sie oben im Impressum.
          </p>
        </Section>

        <Section title="Verbraucherstreitbeilegung / Universalschlichtungsstelle">
          <p>
            Wir sind nicht bereit oder verpflichtet, an Streitbeilegungsverfahren vor einer
            Verbraucherschlichtungsstelle teilzunehmen.
          </p>
        </Section>

        <Section title="Haftung f&uuml;r Inhalte">
          <p>
            Als Diensteanbieter sind wir gem&auml;&szlig; &sect; 7 Abs. 1 TMG f&uuml;r eigene Inhalte
            auf diesen Seiten nach den allgemeinen Gesetzen verantwortlich. Nach &sect;&sect; 8 bis 10 TMG
            sind wir als Diensteanbieter jedoch nicht verpflichtet, &uuml;bermittelte oder gespeicherte
            fremde Informationen zu &uuml;berwachen oder nach Umst&auml;nden zu forschen, die auf eine
            rechtswidrige T&auml;tigkeit hinweisen.
          </p>
          <p style={{ marginTop: 12 }}>
            Verpflichtungen zur Entfernung oder Sperrung der Nutzung von Informationen nach den
            allgemeinen Gesetzen bleiben hiervon unber&uuml;hrt. Eine diesbez&uuml;gliche Haftung
            ist jedoch erst ab dem Zeitpunkt der Kenntnis einer konkreten Rechtsverletzung m&ouml;glich.
            Bei Bekanntwerden von entsprechenden Rechtsverletzungen werden wir diese Inhalte
            umgehend entfernen.
          </p>
        </Section>

        <Section title="Haftung f&uuml;r Links">
          <p>
            Unser Angebot enth&auml;lt Links zu externen Websites Dritter, auf deren Inhalte wir
            keinen Einfluss haben. Deshalb k&ouml;nnen wir f&uuml;r diese fremden Inhalte auch keine
            Gew&auml;hr &uuml;bernehmen. F&uuml;r die Inhalte der verlinkten Seiten ist stets der
            jeweilige Anbieter oder Betreiber der Seiten verantwortlich.
          </p>
        </Section>

      </div>
    </div>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section style={{ marginBottom: 32 }}>
      <h2 style={{ fontFamily: 'Oswald, sans-serif', fontSize: 16, fontWeight: 600, color: '#FFB800', marginBottom: 12, letterSpacing: 0.5 }}>
        {title}
      </h2>
      <div style={{ color: '#ccc' }}>{children}</div>
    </section>
  )
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <tr>
      <td style={{ padding: '8px 16px 8px 0', color: '#888', whiteSpace: 'nowrap', verticalAlign: 'top' }}>{label}</td>
      <td style={{ padding: '8px 0', color: '#fff' }}>{value}</td>
    </tr>
  )
}
