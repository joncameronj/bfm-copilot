'use client'

import { createContext, useContext, useState, useEffect, type ReactNode } from 'react'
import type { UserRole } from '@/types/roles'

// View mode for admins - they preview as practitioner or member
type ViewMode = 'practitioner' | 'member'

interface RoleViewContextType {
  actualRole: UserRole | null
  viewMode: ViewMode
  setViewMode: (mode: ViewMode) => void
  isAdmin: boolean
  // Effective role for navigation/permissions (what the user sees as)
  effectiveRole: UserRole | null
}

const RoleViewContext = createContext<RoleViewContextType | undefined>(undefined)

interface RoleViewProviderProps {
  children: ReactNode
  actualRole: UserRole | null
}

const STORAGE_KEY = 'bfm-admin-view-mode'

export function RoleViewProvider({ children, actualRole }: RoleViewProviderProps) {
  const [viewMode, setViewModeState] = useState<ViewMode>('practitioner')

  const isAdmin = actualRole === 'admin'

  // Load saved view mode from localStorage on mount (admins only)
  useEffect(() => {
    if (isAdmin) {
      const saved = localStorage.getItem(STORAGE_KEY)
      if (saved && ['practitioner', 'member'].includes(saved)) {
        setViewModeState(saved as ViewMode)
      }
    }
  }, [isAdmin])

  const setViewMode = (mode: ViewMode) => {
    if (!isAdmin) return
    setViewModeState(mode)
    localStorage.setItem(STORAGE_KEY, mode)
  }

  // Effective role determines what navigation/content the user sees
  // - Admins: see admin panel + preview as practitioner or member
  // - Others: see their actual role's view
  const effectiveRole: UserRole | null = isAdmin ? viewMode : actualRole

  return (
    <RoleViewContext.Provider
      value={{
        actualRole,
        viewMode,
        setViewMode,
        isAdmin,
        effectiveRole,
      }}
    >
      {children}
    </RoleViewContext.Provider>
  )
}

export function useRoleView() {
  const context = useContext(RoleViewContext)
  if (context === undefined) {
    throw new Error('useRoleView must be used within a RoleViewProvider')
  }
  return context
}
