'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Image from 'next/image'
import { cn } from '@/lib/utils'
import { createClient } from '@/lib/supabase/client'
import { useRoleView } from '@/providers/RoleViewProvider'
import { useTheme } from '@/providers/ThemeProvider'
import { HugeiconsIcon } from '@hugeicons/react'
import { Sun01Icon, Moon01Icon, ComputerIcon } from '@hugeicons/core-free-icons'

interface UserMenuProps {
  user: {
    email: string
    fullName?: string | null
    avatarUrl?: string | null
  }
  isCollapsed?: boolean
}

const VIEW_MODE_CONFIG = {
  practitioner: {
    label: 'Practitioner',
    color: 'bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300',
    dotColor: 'bg-blue-500',
  },
  member: {
    label: 'Member',
    color: 'bg-green-50 text-green-700 dark:bg-green-900/30 dark:text-green-300',
    dotColor: 'bg-green-500',
  },
} as const

const TRANSITION_TIMING = 'cubic-bezier(0.4, 0, 0.2, 1)'
const TRANSITION_DURATION = '300ms'

export function UserMenu({ user, isCollapsed = false }: UserMenuProps) {
  const router = useRouter()
  const [isOpen, setIsOpen] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const { isAdmin, viewMode, setViewMode, actualRole } = useRoleView()
  const { theme, setTheme } = useTheme()

  const handleLogout = async () => {
    setIsLoading(true)
    try {
      const supabase = createClient()
      await supabase.auth.signOut()
      router.push('/login')
    } catch (error) {
      console.error('Error signing out:', error)
    } finally {
      setIsLoading(false)
    }
  }

  const initials = user.fullName
    ? user.fullName
        .split(' ')
        .map((n) => n[0])
        .join('')
        .toUpperCase()
        .slice(0, 2)
    : user.email.charAt(0).toUpperCase()

  // Get current view mode config (for admins) or actual role config (for others)
  const currentViewConfig = isAdmin
    ? VIEW_MODE_CONFIG[viewMode]
    : actualRole === 'practitioner'
      ? VIEW_MODE_CONFIG.practitioner
      : VIEW_MODE_CONFIG.member

  return (
    <div className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={cn(
          'group relative flex items-center gap-3 rounded-lg h-auto min-h-[40px] px-[6px] py-2',
          'transition-colors duration-200 hover:bg-neutral-100 dark:hover:bg-neutral-800',
          isOpen && 'bg-neutral-100 dark:bg-neutral-800'
        )}
        style={{
          width: isCollapsed ? '40px' : '100%',
          transition: `width ${TRANSITION_DURATION} ${TRANSITION_TIMING}`,
        }}
      >
        {/* Tooltip when collapsed */}
        {isCollapsed && !isOpen && (
          <span className="absolute left-full ml-2 px-2 py-1 bg-neutral-900 dark:bg-neutral-700 text-white text-xs rounded whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-50">
            {user.fullName || user.email}
          </span>
        )}
        {/* Avatar */}
        <div className="w-7 h-7 rounded-full bg-neutral-200 dark:bg-neutral-700 flex items-center justify-center flex-shrink-0 overflow-hidden">
          {user.avatarUrl ? (
            <Image
              src={user.avatarUrl}
              alt={user.fullName || 'User avatar'}
              width={28}
              height={28}
              className="w-full h-full object-cover"
            />
          ) : (
            <span className="text-sm font-medium text-neutral-700 dark:text-neutral-300">{initials}</span>
          )}
        </div>

        {/* User info */}
        <div
          className="flex-1 text-left min-w-0 overflow-hidden"
          style={{
            opacity: isCollapsed ? 0 : 1,
            transition: `opacity ${TRANSITION_DURATION} ${TRANSITION_TIMING}`,
          }}
        >
          <p className="text-sm font-medium text-neutral-900 dark:text-neutral-50 truncate">
            {user.fullName || 'User'}
          </p>
          <p className="text-xs text-neutral-500 dark:text-neutral-400 truncate">{user.email}</p>

          {/* Role badges */}
          <div className="mt-1.5 flex flex-wrap gap-1">
            {/* Static Admin badge - only for admins */}
            {isAdmin && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-purple-50 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300">
                <span className="w-1.5 h-1.5 rounded-full bg-purple-500" />
                Admin
              </span>
            )}
            {/* View mode badge - shows current view */}
            <span
              className={cn(
                'inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium',
                currentViewConfig.color
              )}
            >
              <span className={cn('w-1.5 h-1.5 rounded-full', currentViewConfig.dotColor)} />
              {currentViewConfig.label}
            </span>
          </div>
        </div>

        {/* Chevron */}
        <svg
          width="16"
          height="16"
          className={cn(
            'w-4 h-4 text-neutral-900 dark:text-neutral-50 flex-shrink-0',
            isOpen && 'rotate-180'
          )}
          style={{
            opacity: isCollapsed ? 0 : 1,
            transition: `opacity ${TRANSITION_DURATION} ${TRANSITION_TIMING}, transform 200ms`,
          }}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M5 15l7-7 7 7"
          />
        </svg>
      </button>

      {/* Dropdown */}
      {isOpen && (
        <>
          <div
            className="fixed inset-0 z-10"
            onClick={() => setIsOpen(false)}
          />
          <div className={cn(
            'absolute bottom-full mb-2 z-20 bg-white dark:bg-neutral-800 rounded-lg py-1 shadow-lg border border-neutral-200 dark:border-neutral-700',
            isCollapsed ? 'left-full ml-2 bottom-0 mb-0 w-56' : 'left-0 right-0'
          )}>
            {/* View mode switcher for admins */}
            {isAdmin && (
              <>
                <div className="px-3 py-1.5 text-xs font-medium text-neutral-500 dark:text-neutral-400 uppercase tracking-wider">
                  Preview As
                </div>
                {(['practitioner', 'member'] as const).map((mode) => {
                  const config = VIEW_MODE_CONFIG[mode]
                  const isActive = viewMode === mode
                  return (
                    <button
                      key={mode}
                      onClick={() => {
                        setViewMode(mode)
                        setIsOpen(false)
                      }}
                      className={cn(
                        'w-full px-3 py-2 text-left text-sm flex items-center gap-2',
                        isActive
                          ? 'bg-neutral-100 dark:bg-neutral-700 text-neutral-900 dark:text-neutral-50'
                          : 'text-neutral-700 dark:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-700'
                      )}
                    >
                      <span className={cn('w-2 h-2 rounded-full', config.dotColor)} />
                      {config.label}
                      {isActive && (
                        <svg className="w-4 h-4 ml-auto" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                        </svg>
                      )}
                    </button>
                  )
                })}
                <div className="my-1 border-t border-neutral-200 dark:border-neutral-700" />
              </>
            )}

            {/* Theme switcher */}
            <div className="px-3 py-1.5 text-xs font-medium text-neutral-500 dark:text-neutral-400 uppercase tracking-wider">
              Theme
            </div>
            <div className="px-2 pb-2">
              <div className="flex gap-1 p-1 bg-neutral-100 dark:bg-neutral-700 rounded-lg">
                <button
                  onClick={() => setTheme('light')}
                  className={cn(
                    'flex-1 flex items-center justify-center gap-1.5 px-2 py-1.5 rounded text-xs font-medium transition-colors',
                    theme === 'light'
                      ? 'bg-white dark:bg-neutral-600 text-neutral-900 dark:text-neutral-50 shadow-sm'
                      : 'text-neutral-600 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-neutral-200'
                  )}
                >
                  <HugeiconsIcon icon={Sun01Icon} size={14} />
                  Light
                </button>
                <button
                  onClick={() => setTheme('dark')}
                  className={cn(
                    'flex-1 flex items-center justify-center gap-1.5 px-2 py-1.5 rounded text-xs font-medium transition-colors',
                    theme === 'dark'
                      ? 'bg-white dark:bg-neutral-600 text-neutral-900 dark:text-neutral-50 shadow-sm'
                      : 'text-neutral-600 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-neutral-200'
                  )}
                >
                  <HugeiconsIcon icon={Moon01Icon} size={14} />
                  Dark
                </button>
                <button
                  onClick={() => setTheme('system')}
                  className={cn(
                    'flex-1 flex items-center justify-center gap-1.5 px-2 py-1.5 rounded text-xs font-medium transition-colors',
                    theme === 'system'
                      ? 'bg-white dark:bg-neutral-600 text-neutral-900 dark:text-neutral-50 shadow-sm'
                      : 'text-neutral-600 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-neutral-200'
                  )}
                >
                  <HugeiconsIcon icon={ComputerIcon} size={14} />
                  Auto
                </button>
              </div>
            </div>
            <div className="my-1 border-t border-neutral-200 dark:border-neutral-700" />

            <button
              onClick={() => {
                setIsOpen(false)
                router.push('/settings')
              }}
              className="w-full px-3 py-2 text-left text-sm text-neutral-700 dark:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-700"
            >
              Settings
            </button>
            <button
              onClick={() => {
                setIsOpen(false)
                handleLogout()
              }}
              disabled={isLoading}
              className={cn(
                'w-full px-3 py-2 text-left text-sm text-neutral-700 dark:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-700',
                isLoading && 'opacity-50 cursor-not-allowed'
              )}
            >
              {isLoading ? 'Signing out...' : 'Sign out'}
            </button>
          </div>
        </>
      )}
    </div>
  )
}
