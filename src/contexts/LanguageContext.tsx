'use client'
import { createContext, useContext, useState, useEffect, ReactNode } from 'react'

type Lang = 'de' | 'en'
type Messages = Record<string, any>

const LanguageContext = createContext<{
  lang: Lang
  setLang: (l: Lang) => void
  t: (key: string) => string
}>({ lang: 'de', setLang: () => {}, t: (k) => k })

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>('de')
  const [messages, setMessages] = useState<Messages>({})

  useEffect(() => {
    const stored = localStorage.getItem('db_lang') as Lang | null
    const initial = stored || 'de'
    setLangState(initial)
    loadMessages(initial)
  }, [])

  const loadMessages = async (l: Lang) => {
    const msgs = l === 'de'
      ? await import('../../messages/de.json')
      : await import('../../messages/en.json')
    setMessages(msgs.default)
  }

  const setLang = (l: Lang) => {
    setLangState(l)
    localStorage.setItem('db_lang', l)
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
