'use client'
import React, { createContext, useContext, useState, useCallback, ReactNode } from 'react'
import LevelUpModal from '@/components/LevelUpModal'
import XPGainToast from '@/components/XPGainToast'

interface CelebrationContextType {
  showLevelUp: (level: number) => void
  showXPGain: (xp: number, coins?: number) => void
}

const CelebrationContext = createContext<CelebrationContextType>({
  showLevelUp: () => {},
  showXPGain: () => {},
})

export const useCelebration = () => useContext(CelebrationContext)

export function CelebrationProvider({ children }: { children: ReactNode }) {
  const [levelUpData, setLevelUpData] = useState<{ level: number } | null>(null)
  const [xpToastData, setXpToastData] = useState<{ xp: number; coins?: number } | null>(null)

  const showLevelUp = useCallback((level: number) => {
    setLevelUpData({ level })
  }, [])

  const showXPGain = useCallback((xp: number, coins?: number) => {
    setXpToastData({ xp, coins })
  }, [])

  return (
    <CelebrationContext.Provider value={{ showLevelUp, showXPGain }}>
      {children}

      {levelUpData && (
        <LevelUpModal
          level={levelUpData.level}
          onClose={() => setLevelUpData(null)}
        />
      )}

      {xpToastData && (
        <XPGainToast
          xp={xpToastData.xp}
          coins={xpToastData.coins}
          onDone={() => setXpToastData(null)}
        />
      )}
    </CelebrationContext.Provider>
  )
}
