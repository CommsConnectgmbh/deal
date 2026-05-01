'use client'

import { useRouter } from 'next/navigation'
import type { ReactNode } from 'react'

export default function ChildSafetyPage() {
  const router = useRouter()

  return (
    <div style={{ maxWidth: 430, margin: '0 auto', minHeight: '100dvh', background: 'var(--bg-base)', color: 'var(--text-primary)', fontFamily: 'system-ui, sans-serif' }}>
      <div style={{ position: 'sticky', top: 0, zIndex: 10, background: 'var(--bg-base)', borderBottom: '1px solid var(--border-subtle)', padding: '16px', display: 'flex', alignItems: 'center', gap: 12 }}>
        <button
          onClick={() => router.back()}
          style={{ background: 'var(--bg-overlay)', border: 'none', borderRadius: 10, width: 40, height: 40, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: 'var(--text-primary)', fontSize: 18 }}
        >
          &#8592;
        </button>
        <h1 style={{ fontFamily: 'Oswald, sans-serif', fontSize: 20, fontWeight: 700, color: 'var(--gold-primary)', margin: 0, letterSpacing: 1 }}>
          Sicherheitsstandards zum Schutz von Kindern
        </h1>
      </div>

      <div style={{ padding: '24px 16px 64px', lineHeight: 1.7, fontSize: 14 }}>
        <p style={{ color: 'var(--text-secondary)', marginBottom: 24 }}>Stand: 2. Mai 2026</p>

        <Section title="1. Null-Toleranz-Grundsatz">
          <p>
            DealBuddy verfolgt eine absolute Null-Toleranz-Politik gegenüber Inhalten, die Kinder
            sexuell ausbeuten oder missbrauchen (Child Sexual Abuse Material, CSAM), sowie gegenüber
            jeglicher Form der sexuellen Belästigung oder Gefährdung von Minderjährigen.
            Verstöße führen zur sofortigen, dauerhaften Sperrung des Accounts und zur Meldung an
            die zuständigen Behörden.
          </p>
        </Section>

        <Section title="2. Mindestalter">
          <p>
            DealBuddy ist ausschließlich für Nutzer ab 18 Jahren bestimmt. Bei der Registrierung
            wird das Alter abgefragt; bei begründetem Verdacht auf Minderjährigkeit wird der Account
            geprüft und ggf. gesperrt.
          </p>
        </Section>

        <Section title="3. Präventionsmaßnahmen">
          <ul style={{ paddingLeft: 18, margin: 0 }}>
            <li>Account-Sperrung beim Verdacht auf Minderjährigkeit</li>
            <li>Reaktive Moderation aller gemeldeten Inhalte und Profile</li>
            <li>Möglichkeit, Nutzer und Inhalte zu blockieren und zu melden (in jeder App-Ansicht)</li>
            <li>Beschränkung der Interaktion auf eingeladene Freunde (Friends-Only-Modus)</li>
            <li>Keine öffentlichen, ungeprüften Direct-Messaging-Kanäle</li>
            <li>Keine Standortfreigabe an unbekannte Nutzer</li>
          </ul>
        </Section>

        <Section title="4. Meldewege">
          <p>
            Inhalte und Profile mit Verdacht auf CSAM oder sexuelle Belästigung von Minderjährigen
            können in der App über die <strong>Melden</strong>-Funktion (in jedem Profil und Beitrag)
            gemeldet werden. Außerdem direkt an:
          </p>
          <ul style={{ paddingLeft: 18, margin: 0 }}>
            <li>E-Mail: <a href="mailto:safety@deal-buddy.app">safety@deal-buddy.app</a></li>
            <li>Postanschrift: Comms Connect GmbH, Tal 30, 80331 München, Deutschland</li>
          </ul>
        </Section>

        <Section title="5. Reaktionszeit & Bearbeitung">
          <p>
            Meldungen werden innerhalb von <strong>24 Stunden</strong> geprüft. Bei begründetem
            Verdacht erfolgt:
          </p>
          <ul style={{ paddingLeft: 18, margin: 0 }}>
            <li>Sofortige Sperrung des betroffenen Accounts</li>
            <li>Sicherung der Beweise</li>
            <li>Meldung an das Bundeskriminalamt (BKA, Deutschland) gemäß § 184b StGB</li>
            <li>Meldung an das National Center for Missing & Exploited Children (NCMEC, USA)
              gemäß 18 U.S.C. § 2258A bei US-bezogenen Vorfällen</li>
            <li>Kooperation mit lokalen Strafverfolgungsbehörden</li>
          </ul>
        </Section>

        <Section title="6. Rechtsgrundlagen">
          <p>
            DealBuddy hält folgende Gesetze ein:
          </p>
          <ul style={{ paddingLeft: 18, margin: 0 }}>
            <li>Strafgesetzbuch §§ 184b–184d (Deutschland)</li>
            <li>Jugendmedienschutz-Staatsvertrag (JMStV)</li>
            <li>Digital Services Act (EU) 2022/2065</li>
            <li>Online Safety Act 2023 (UK)</li>
            <li>EU-Verordnung 2024/1689 zu CSAM</li>
            <li>18 U.S.C. § 2258A (USA, NCMEC-Meldepflicht)</li>
          </ul>
        </Section>

        <Section title="7. Verantwortliche Kontaktperson">
          <p>
            Ansprechpartner für Strafverfolgungsbehörden, Aufsichtsstellen und Behörden zu Fragen
            der Kindersicherheit:
          </p>
          <p style={{ marginTop: 8 }}>
            Rainer Roloff, Geschäftsführer<br />
            Comms Connect GmbH<br />
            Tal 30, 80331 München, Deutschland<br />
            E-Mail: <a href="mailto:safety@deal-buddy.app">safety@deal-buddy.app</a><br />
            Eskalations-Mail: <a href="mailto:rainer.roloff@comms-connect.de">rainer.roloff@comms-connect.de</a>
          </p>
        </Section>

        <Section title="8. Transparenz">
          <p>
            Diese Sicherheitsstandards werden mindestens einmal jährlich überprüft und bei
            Gesetzesänderungen unverzüglich aktualisiert. Die jeweils aktuelle Version ist unter
            <span style={{ wordBreak: 'break-all' }}> https://app.deal-buddy.app/legal/child-safety </span>
            öffentlich abrufbar.
          </p>
        </Section>
      </div>
    </div>
  )
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div style={{ marginBottom: 24 }}>
      <h2 style={{ fontFamily: 'Oswald, sans-serif', fontSize: 16, fontWeight: 700, color: 'var(--gold-primary)', margin: '0 0 8px', letterSpacing: 0.5 }}>
        {title}
      </h2>
      {children}
    </div>
  )
}
