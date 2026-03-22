'use client'
import React, { useRef, useCallback } from 'react'
import { useLang } from '@/contexts/LanguageContext'

interface ShareData {
  dealId: string
  title: string
  stake?: string
  status: string
  creatorName: string
  opponentName?: string
  winnerName?: string
}

export function useShareDeal() {
  const { t } = useLang()
  const share = useCallback(async (data: ShareData) => {
    const { dealId, title, stake, status, creatorName, opponentName, winnerName } = data
    const url = `https://app.deal-buddy.app/app/deals/${dealId}`
    const isCompleted = status === 'completed' && winnerName

    const text = isCompleted
      ? t('components.shareWinText').replace('{winner}', winnerName!).replace('{title}', title).replace('{stake}', stake || 'n/a')
      : t('components.shareVsText').replace('{creator}', creatorName).replace('{opponent}', opponentName || '???').replace('{title}', title).replace('{stake}', stake || 'n/a')

    const shareTitle = t('components.shareTitle')

    if (typeof navigator !== 'undefined' && navigator.share) {
      try {
        await navigator.share({ title: shareTitle, text, url })
        return true
      } catch {
        /* user cancelled */
      }
    }

    // Fallback: copy link
    if (typeof navigator !== 'undefined' && navigator.clipboard) {
      await navigator.clipboard.writeText(`${text}\n${url}`)
      return true
    }

    return false
  }, [])

  return { share }
}
