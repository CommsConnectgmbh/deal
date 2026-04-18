'use client'
import { useEffect } from 'react'

export default function DarkScope({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    const prev = document.documentElement.getAttribute('data-theme')
    document.documentElement.setAttribute('data-theme', 'dark')
    return () => {
      if (prev) document.documentElement.setAttribute('data-theme', prev)
      else document.documentElement.removeAttribute('data-theme')
    }
  }, [])
  return <>{children}</>
}
