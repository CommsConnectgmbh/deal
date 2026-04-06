'use client'
import { createContext, useContext, useState, useEffect, ReactNode } from 'react'

export type Lang = 'de' | 'en' | 'fr' | 'es' | 'it' | 'ru' | 'ar' | 'hi'
type Messages = Record<string, any>

export const LANGUAGES: { code: Lang; label: string; flag: string }[] = [
  { code: 'de', label: 'Deutsch',   flag: '🇩🇪' },
  { code: 'en', label: 'English',   flag: '🇬🇧' },
  { code: 'fr', label: 'Français',  flag: '🇫🇷' },
  { code: 'es', label: 'Español',   flag: '🇪🇸' },
  { code: 'it', label: 'Italiano',  flag: '🇮🇹' },
  { code: 'ru', label: 'Русский',   flag: '🇷🇺' },
  { code: 'ar', label: 'العربية',   flag: '🇸🇦' },
  { code: 'hi', label: 'हिन्दी',     flag: '🇮🇳' },
]

const LanguageContext = createContext<{
  lang: Lang
  setLang: (l: Lang) => void
  t: (key: string) => string
}>({ lang: 'de', setLang: () => {}, t: (k) => k })

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>('de')
  const [messages, setMessages] = useState<Messages>({})

  useEffect(() => {
    let stored: Lang | null = null
    try { stored = localStorage.getItem('db_lang') as Lang | null } catch {}
    const valid: Lang[] = ['de', 'en', 'fr', 'es', 'it', 'ru', 'ar', 'hi']
    const initial = stored && valid.includes(stored) ? stored : 'de'
    setLangState(initial)
    loadMessages(initial)
  }, [])

  // Keep <html lang="..."> in sync
  useEffect(() => {
    if (typeof document !== 'undefined') {
      document.documentElement.lang = lang
    }
  }, [lang])

  const loadMessages = async (l: Lang) => {
    let msgs: any
    switch (l) {
      case 'en': msgs = await import('../../messages/en.json'); break
      case 'fr': msgs = await import('../../messages/fr.json'); break
      case 'es': msgs = await import('../../messages/es.json'); break
      case 'it': msgs = await import('../../messages/it.json'); break
      case 'ru': msgs = await import('../../messages/ru.json'); break
      case 'ar': msgs = await import('../../messages/ar.json'); break
      case 'hi': msgs = await import('../../messages/hi.json'); break
      default:   msgs = await import('../../messages/de.json'); break
    }
    setMessages(msgs.default)
  }

  const setLang = (l: Lang) => {
    setLangState(l)
    try { localStorage.setItem('db_lang', l) } catch {}
    loadMessages(l)
  }

  const t = (key: string): string => {
    const parts = key.split('.')
    let val: any = messages
    for (const p of parts) {
      val = val?.[p]
      if (val === undefined) return key
    }
    return typeof val === 'string' ? val : key
  }

  return (
    <LanguageContext.Provider value={{ lang, setLang, t }}>
      {children}
    </LanguageContext.Provider>
  )
}

export const useLang = () => useContext(LanguageContext)
