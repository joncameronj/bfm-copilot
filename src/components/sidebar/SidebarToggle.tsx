'use client'

import { cn } from '@/lib/utils'

interface SidebarToggleProps {
  isCollapsed: boolean
  onToggle: () => void
}

const TRANSITION_TIMING = 'cubic-bezier(0.4, 0, 0.2, 1)'
const TRANSITION_DURATION = '300ms'

export function SidebarToggle({ isCollapsed, onToggle }: SidebarToggleProps) {
  return (
    <button
      onClick={onToggle}
      className={cn(
        'group relative flex items-center gap-3 h-12 px-[14px]',
        'text-neutral-900 hover:bg-neutral-100',
        'transition-colors duration-200'
      )}
      style={{
        borderTop: isCollapsed ? 'none' : '1px solid rgb(229 229 229)',
        transition: `border ${TRANSITION_DURATION} ${TRANSITION_TIMING}`,
      }}
      aria-label={isCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
    >
      {/* Tooltip when collapsed */}
      {isCollapsed && (
        <span className="absolute left-full ml-2 px-2 py-1 bg-neutral-900 text-white text-xs rounded whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-50">
          Expand
        </span>
      )}
      <svg
        width="20"
        height="20"
        className="w-5 h-5 flex-shrink-0"
        style={{
          transform: isCollapsed ? 'rotate(180deg)' : 'rotate(0deg)',
          transition: `transform ${TRANSITION_DURATION} ${TRANSITION_TIMING}`,
        }}
        fill="none"
        stroke="currentColor"
        viewBox="0 0 24 24"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M11 19l-7-7 7-7m8 14l-7-7 7-7"
        />
      </svg>
      <span
        className="text-sm font-medium whitespace-nowrap"
        style={{
          opacity: isCollapsed ? 0 : 1,
          transition: `opacity ${TRANSITION_DURATION} ${TRANSITION_TIMING}`,
        }}
      >
        Collapse
      </span>
    </button>
  )
}
