'use client'
import { Component, ReactNode } from 'react'

interface Props { children: ReactNode }
interface State { hasError: boolean }

export default class GlobalErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false }

  static getDerivedStateFromError() {
    return { hasError: true }
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{
          minHeight: '100vh', background: '#080808', display: 'flex',
          flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
          padding: '2rem', fontFamily: 'Oswald, sans-serif', color: '#fff',
        }}>
          <h1 style={{ color: '#FFB800', fontSize: '1.5rem', marginBottom: '1rem' }}>
            Etwas ist schiefgelaufen
          </h1>
          <p style={{ color: '#888', fontSize: '0.9rem', marginBottom: '1.5rem' }}>
            Bitte lade die Seite neu.
          </p>
          <button
            onClick={() => window.location.reload()}
            style={{
              background: '#FFB800', color: '#080808', border: 'none', borderRadius: 12,
              padding: '14px 32px', fontSize: '1rem', fontWeight: 700, cursor: 'pointer',
              fontFamily: 'Oswald, sans-serif', textTransform: 'uppercase',
            }}
          >
            Neu laden
          </button>
        </div>
      )
    }
    return this.props.children
  }
}
