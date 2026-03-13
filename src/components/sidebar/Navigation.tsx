'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { cn } from '@/lib/utils'
import { useRoleView } from '@/providers/RoleViewProvider'
import { HugeiconsIcon } from '@hugeicons/react'
import {
  BubbleChatIcon,
  Add01Icon,
  Pulse01Icon,
  TestTubeIcon,
  UserGroupIcon,
  File01Icon,
  SlidersHorizontalIcon,
  Settings01Icon,
  StarIcon,
  HealthIcon,
  ChartHistogramIcon,
} from '@hugeicons/core-free-icons'
import { UnreadBadge } from './UnreadBadge'

interface NavItem {
  label: string
  href: string
  icon: string
}

// Navigation items for practitioners
const PRACTITIONER_NAV_ITEMS: NavItem[] = [
  { label: 'New Chat', href: '/', icon: 'NewChat' },
  { label: 'Chats', href: '/chats', icon: 'Chats' },
  { label: 'Diagnostics', href: '/diagnostics', icon: 'Diagnostics' },
  { label: 'Labs', href: '/labs', icon: 'Labs' },
  { label: 'Patients', href: '/patients', icon: 'Patients' },
  { label: 'Protocols', href: '/protocols', icon: 'Protocols' },
  { label: 'Settings', href: '/settings', icon: 'Settings' },
]

// Navigation items for members - same as practitioner except no clinical protocols
const MEMBER_NAV_ITEMS: NavItem[] = [
  { label: 'New Chat', href: '/', icon: 'NewChat' },
  { label: 'Chats', href: '/chats', icon: 'Chats' },
  { label: 'Labs', href: '/my-labs', icon: 'Labs' },
  { label: 'Progress', href: '/my-progress', icon: 'Progress' },
  { label: 'myHealth', href: '/my-health', icon: 'myHealth' },
  { label: 'Suggestions', href: '/suggestions', icon: 'Suggestions' },
  { label: 'Settings', href: '/settings', icon: 'Settings' },
]

// Admin link - always visible for admins
const ADMIN_NAV_ITEM: NavItem = { label: 'Admin', href: '/admin', icon: 'Admin' }

interface NavigationProps {
  isCollapsed?: boolean
  unreadChatsCount?: number
}

const TRANSITION_TIMING = 'cubic-bezier(0.4, 0, 0.2, 1)'
const TRANSITION_DURATION = '300ms'

// Icon mapping for navigation items using Hugeicons
const NAV_ICONS: Record<string, typeof BubbleChatIcon> = {
  NewChat: Add01Icon,
  Chats: BubbleChatIcon,
  Diagnostics: Pulse01Icon,
  Labs: TestTubeIcon,
  Patients: UserGroupIcon,
  Protocols: File01Icon,
  Admin: SlidersHorizontalIcon,
  Settings: Settings01Icon,
  Suggestions: StarIcon,
  myHealth: HealthIcon,
  Progress: ChartHistogramIcon,
}

function NavIcon({ iconKey }: { iconKey: string }) {
  const icon = NAV_ICONS[iconKey] || BubbleChatIcon
  return <HugeiconsIcon icon={icon} size={20} strokeWidth={2} className="flex-shrink-0" />
}

export function Navigation({ isCollapsed = false, unreadChatsCount = 0 }: NavigationProps) {
  const pathname = usePathname()
  const { effectiveRole, isAdmin } = useRoleView()

  // Select nav items based on effective role (view mode for admins)
  const navItems = effectiveRole === 'member' ? MEMBER_NAV_ITEMS : PRACTITIONER_NAV_ITEMS

  return (
    <nav className="space-y-3">
      {navItems.map((item) => {
        // Check if active - handle home route specially
        const isActive = item.href === '/'
          ? pathname === '/'
          : pathname === item.href || pathname.startsWith(`${item.href}/`)

        // Show unread badge on Chats nav item
        const showBadge = item.icon === 'Chats' && unreadChatsCount > 0 && !isCollapsed

        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={isActive ? 'page' : undefined}
            className={cn(
              'group relative flex items-center gap-3 rounded-lg text-base font-semibold',
              'transition-colors duration-200 h-10 px-[10px]',
              isActive
                ? 'bg-neutral-200 dark:bg-neutral-700 text-neutral-900 dark:text-neutral-50'
                : 'text-neutral-900 dark:text-neutral-50 hover:bg-neutral-100 dark:hover:bg-neutral-800'
            )}
            style={{
              width: isCollapsed ? '40px' : '100%',
              transition: `width ${TRANSITION_DURATION} ${TRANSITION_TIMING}`,
            }}
          >
            {/* Tooltip when collapsed */}
            {isCollapsed && (
              <span className="absolute left-full ml-2 px-2 py-1 bg-neutral-900 dark:bg-neutral-700 text-white text-sm rounded whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-50">
                {item.label}
                {item.icon === 'Chats' && unreadChatsCount > 0 && ` (${unreadChatsCount})`}
              </span>
            )}
            {/* Icon with potential badge overlay when collapsed */}
            <div className="relative flex-shrink-0">
              <NavIcon iconKey={item.icon} />
              {/* Badge on icon when collapsed */}
              {item.icon === 'Chats' && unreadChatsCount > 0 && isCollapsed && (
                <span className="absolute -top-1 -right-1 flex items-center justify-center min-w-[14px] h-[14px] text-[9px] font-bold text-white bg-red-500 rounded-full">
                  {unreadChatsCount > 9 ? '9+' : unreadChatsCount}
                </span>
              )}
            </div>
            <span
              className="whitespace-nowrap flex-1"
              style={{
                opacity: isCollapsed ? 0 : 1,
                transition: `opacity ${TRANSITION_DURATION} ${TRANSITION_TIMING}`,
              }}
            >
              {item.label}
            </span>
            {/* Badge after label when expanded */}
            {showBadge && <UnreadBadge count={unreadChatsCount} />}
          </Link>
        )
      })}

      {/* Admin link - always visible for admins regardless of view mode */}
      {isAdmin && (
        <Link
          href={ADMIN_NAV_ITEM.href}
          aria-current={pathname.startsWith('/admin') ? 'page' : undefined}
          className={cn(
            'group relative flex items-center gap-3 rounded-lg text-base font-semibold',
            'transition-colors duration-200 h-12 px-[10px]',
            pathname.startsWith('/admin')
              ? 'bg-neutral-200 dark:bg-neutral-700 text-neutral-900 dark:text-neutral-50'
              : 'text-neutral-900 dark:text-neutral-50 hover:bg-neutral-100 dark:hover:bg-neutral-800'
          )}
          style={{
            width: isCollapsed ? '40px' : '100%',
            transition: `width ${TRANSITION_DURATION} ${TRANSITION_TIMING}`,
          }}
        >
          {/* Tooltip when collapsed */}
          {isCollapsed && (
            <span className="absolute left-full ml-2 px-2 py-1 bg-neutral-900 dark:bg-neutral-700 text-white text-sm rounded whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-50">
              {ADMIN_NAV_ITEM.label}
            </span>
          )}
          <NavIcon iconKey={ADMIN_NAV_ITEM.icon} />
          <span
            className="whitespace-nowrap"
            style={{
              opacity: isCollapsed ? 0 : 1,
              transition: `opacity ${TRANSITION_DURATION} ${TRANSITION_TIMING}`,
            }}
          >
            {ADMIN_NAV_ITEM.label}
          </span>
        </Link>
      )}
    </nav>
  )
}
