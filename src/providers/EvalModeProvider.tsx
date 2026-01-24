'use client'

import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from 'react'

interface EvalModeContextType {
  isEvalModeEnabled: boolean
  isLoading: boolean
  toggleEvalMode: () => Promise<void>
  // For components that need to know if user is eligible for eval mode
  isEvalModeUser: boolean
}

const EvalModeContext = createContext<EvalModeContextType | undefined>(undefined)

interface EvalModeProviderProps {
  children: ReactNode
  userEmail?: string | null
}

// Users who are eligible for eval mode
const EVAL_MODE_USERS = [
  'drrob@shslasvegas.com',
  'joncameron@etho.net',
  'patientadvocate@shslasvegas.com',
]

export function EvalModeProvider({ children, userEmail }: EvalModeProviderProps) {
  const [isEvalModeEnabled, setIsEvalModeEnabled] = useState(false)
  const [isLoading, setIsLoading] = useState(true)

  // Check if user is eligible for eval mode based on email
  const isEvalModeUser = userEmail ? EVAL_MODE_USERS.includes(userEmail.toLowerCase()) : false

  // Fetch current eval mode preference on mount
  useEffect(() => {
    if (!isEvalModeUser) {
      setIsLoading(false)
      setIsEvalModeEnabled(false)
      return
    }

    const fetchPreferences = async () => {
      try {
        const response = await fetch('/api/settings/preferences')
        if (response.ok) {
          const { data } = await response.json()
          setIsEvalModeEnabled(data?.eval_mode_enabled ?? false)
        }
      } catch (error) {
        console.error('Failed to fetch eval mode preference:', error)
      } finally {
        setIsLoading(false)
      }
    }

    fetchPreferences()
  }, [isEvalModeUser])

  // Toggle eval mode with optimistic update
  const toggleEvalMode = useCallback(async () => {
    if (!isEvalModeUser) return

    const newValue = !isEvalModeEnabled

    // Optimistic update
    setIsEvalModeEnabled(newValue)

    try {
      const response = await fetch('/api/settings/preferences', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ eval_mode_enabled: newValue }),
      })

      if (!response.ok) {
        // Revert on failure
        setIsEvalModeEnabled(!newValue)
        console.error('Failed to update eval mode preference')
      }
    } catch (error) {
      // Revert on error
      setIsEvalModeEnabled(!newValue)
      console.error('Failed to toggle eval mode:', error)
    }
  }, [isEvalModeUser, isEvalModeEnabled])

  return (
    <EvalModeContext.Provider
      value={{
        isEvalModeEnabled: isEvalModeUser && isEvalModeEnabled,
        isLoading,
        toggleEvalMode,
        isEvalModeUser,
      }}
    >
      {children}
    </EvalModeContext.Provider>
  )
}

export function useEvalMode() {
  const context = useContext(EvalModeContext)
  if (context === undefined) {
    throw new Error('useEvalMode must be used within an EvalModeProvider')
  }
  return context
}
