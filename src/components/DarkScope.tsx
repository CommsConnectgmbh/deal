'use client'
import { useEffect, useInsertionEffect } from 'react'

const SET_DARK = `try{document.documentElement.setAttribute('data-theme','dark')}catch(e){}`

export default function DarkScope({ children }: { children: React.ReactNode }) {
  // useInsertionEffect runs synchronously after DOM mutations, before paint —
  // applies dark theme before the first frame, eliminating light-flash.
  useInsertionEffect(() => {
    const prev = document.documentElement.getAttribute('data-theme')
    document.documentElement.setAttribute('data-theme', 'dark')
    return () => {
      if (prev) document.documentElement.setAttribute('data-theme', prev)
      else document.documentElement.removeAttribute('data-theme')
    }
  }, [])

  // Belt-and-suspenders: also fire on mount in case useInsertionEffect was missed.
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', 'dark')
  }, [])

  return (
    <>
      {/* Inline script runs during hydration, before children paint, killing light-flash */}
      <script dangerouslySetInnerHTML={{ __html: SET_DARK }} />
      {children}
    </>
  )
}
