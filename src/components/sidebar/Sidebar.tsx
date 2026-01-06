'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import Image from 'next/image'
import { cn } from '@/lib/utils'
import { Navigation } from './Navigation'
import { UserMenu } from './UserMenu'
import { SidebarToggle } from './SidebarToggle'
import { HugeiconsIcon } from '@hugeicons/react'
import { Add01Icon } from '@hugeicons/core-free-icons'

interface SidebarProps {
  user: {
    email: string
    fullName?: string | null
    avatarUrl?: string | null
  }
}

const TRANSITION_TIMING = 'cubic-bezier(0.4, 0, 0.2, 1)'
const TRANSITION_DURATION = '300ms'

export function Sidebar({ user }: SidebarProps) {
  const router = useRouter()
  const [isCollapsed, setIsCollapsed] = useState(false)

  return (
    <>
      <aside
        className={cn(
          'h-screen flex flex-col flex-shrink-0 overflow-hidden',
          isCollapsed ? 'bg-white dark:bg-neutral-900' : 'bg-neutral-50 dark:bg-neutral-900'
        )}
        style={{
          width: isCollapsed ? '60px' : '280px',
          transition: `width ${TRANSITION_DURATION} ${TRANSITION_TIMING}, background-color ${TRANSITION_DURATION} ${TRANSITION_TIMING}`,
        }}
      >
        {/* Logo */}
        <div className="p-3 pl-[14px] relative h-10">
          <Link href="/" className="block">
            {/* Full logo - visible when expanded (light mode) */}
            <Image
              src="/images/copilot-logo-gradient.svg"
              alt="Copilot Logo"
              width={120}
              height={29}
              className="absolute top-3 left-[14px] dark:hidden"
              style={{
                opacity: isCollapsed ? 0 : 1,
                transition: `opacity ${TRANSITION_DURATION} ${TRANSITION_TIMING}`,
              }}
            />
            {/* Full logo - visible when expanded (dark mode) */}
            <Image
              src="/images/copilot-logo-gradient-dark.svg"
              alt="Copilot Logo"
              width={120}
              height={29}
              className="absolute top-3 left-[14px] hidden dark:block"
              style={{
                opacity: isCollapsed ? 0 : 1,
                transition: `opacity ${TRANSITION_DURATION} ${TRANSITION_TIMING}`,
              }}
            />
            {/* Icon - visible when collapsed (gradient icon works for both themes) */}
            <Image
              src="/icons/bfm-icon.svg"
              alt="BFM Icon"
              width={28}
              height={32}
              className="absolute top-2 left-[14px]"
              style={{
                opacity: isCollapsed ? 1 : 0,
                transition: `opacity ${TRANSITION_DURATION} ${TRANSITION_TIMING}`,
              }}
            />
          </Link>
        </div>

        {/* Navigation */}
        <div className="pt-8 px-[10px] space-y-3">
          {/* New Chat Button */}
          <button
            onClick={() => {
              router.push('/')
            }}
            className={cn(
              'group relative flex items-center gap-3 rounded-lg',
              'text-neutral-900 dark:text-neutral-50 hover:bg-neutral-100 dark:hover:bg-neutral-800 h-10 px-[10px]',
              'transition-colors duration-200'
            )}
            style={{
              width: isCollapsed ? '40px' : '100%',
              transition: `width ${TRANSITION_DURATION} ${TRANSITION_TIMING}`,
            }}
            aria-label="New chat"
          >
            {/* Tooltip */}
            {isCollapsed && (
              <span className="absolute left-full ml-2 px-2 py-1 bg-neutral-900 dark:bg-neutral-700 text-white text-xs rounded whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-50">
                New chat
              </span>
            )}
            <div className="w-5 h-5 rounded-full bg-black dark:bg-neutral-50 flex items-center justify-center flex-shrink-0">
              <HugeiconsIcon icon={Add01Icon} size={12} strokeWidth={3.5} className="text-white dark:text-black" color="currentColor" />
            </div>
            <span
              className="text-base font-semibold whitespace-nowrap"
              style={{
                opacity: isCollapsed ? 0 : 1,
                transition: `opacity ${TRANSITION_DURATION} ${TRANSITION_TIMING}`,
              }}
            >
              New chat
            </span>
          </button>
          <Navigation isCollapsed={isCollapsed} />
        </div>

        {/* Spacer */}
        <div className="flex-1" />

        {/* Divider */}
        <div
          className="mx-3 border-t border-neutral-200 dark:border-neutral-700"
          style={{
            opacity: isCollapsed ? 0 : 1,
            transition: `opacity ${TRANSITION_DURATION} ${TRANSITION_TIMING}`,
          }}
        />

        {/* User Menu */}
        <div className="p-[10px]">
          <UserMenu user={user} isCollapsed={isCollapsed} />
        </div>

        {/* Toggle button - at bottom */}
        <SidebarToggle
          isCollapsed={isCollapsed}
          onToggle={() => setIsCollapsed(!isCollapsed)}
        />
      </aside>
    </>
  )
}
