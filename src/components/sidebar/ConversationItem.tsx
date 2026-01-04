'use client'

import { useState } from 'react'
import Link from 'next/link'
import { usePathname, useSearchParams } from 'next/navigation'
import { cn } from '@/lib/utils'
import { formatRelativeTime } from '@/lib/utils'
import type { Conversation } from '@/types/shared'

interface ConversationItemProps {
  conversation: Conversation
  onRename?: (id: string, title: string) => void
  onDelete?: (id: string) => void
  onStar?: (id: string, isStarred: boolean) => void
  onNavigate?: () => void
}

export function ConversationItem({
  conversation,
  onRename,
  onDelete,
  onStar,
  onNavigate,
}: ConversationItemProps) {
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const currentConversationId = searchParams.get('conversation')
  const isActive = currentConversationId === conversation.id

  const [isEditing, setIsEditing] = useState(false)
  const [editValue, setEditValue] = useState(conversation.title)
  const [showMenu, setShowMenu] = useState(false)

  const handleRename = () => {
    if (editValue.trim() && editValue !== conversation.title) {
      onRename?.(conversation.id, editValue.trim())
    }
    setIsEditing(false)
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleRename()
    } else if (e.key === 'Escape') {
      setEditValue(conversation.title)
      setIsEditing(false)
    }
  }

  const handleDelete = () => {
    setShowMenu(false)
    onDelete?.(conversation.id)
  }

  return (
    <div
      className={cn(
        'group relative flex items-center gap-2 px-3 py-2 rounded-lg',
        'transition-colors cursor-pointer',
        isActive ? 'bg-neutral-200' : 'hover:bg-neutral-100'
      )}
    >
      {isEditing ? (
        <input
          type="text"
          value={editValue}
          onChange={(e) => setEditValue(e.target.value)}
          onBlur={handleRename}
          onKeyDown={handleKeyDown}
          className="flex-1 bg-white rounded px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-brand-blue/20"
          autoFocus
        />
      ) : (
        <Link
          href={`/?conversation=${conversation.id}`}
          className="flex-1 min-w-0"
          onClick={() => onNavigate?.()}
        >
          <div className="flex items-center gap-2">
            {conversation.isStarred && (
              <svg
                width="12"
                height="12"
                className="w-3 h-3 text-amber-500 flex-shrink-0"
                fill="currentColor"
                viewBox="0 0 20 20"
              >
                <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
              </svg>
            )}
            <p className="text-sm text-neutral-900 truncate">
              {conversation.title || 'New Conversation'}
            </p>
          </div>
          <p className="text-xs text-neutral-400">
            {formatRelativeTime(conversation.updatedAt)}
          </p>
        </Link>
      )}

      {/* Menu button */}
      {!isEditing && (
        <div className="relative">
          <button
            onClick={(e) => {
              e.preventDefault()
              e.stopPropagation()
              setShowMenu(!showMenu)
            }}
            className={cn(
              'p-1 rounded text-neutral-400 hover:text-neutral-600 hover:bg-neutral-200',
              'opacity-0 group-hover:opacity-100 transition-opacity',
              showMenu && 'opacity-100'
            )}
          >
            <svg
              width="16"
              height="16"
              className="w-4 h-4"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 5v.01M12 12v.01M12 19v.01M12 6a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2z"
              />
            </svg>
          </button>

          {/* Dropdown menu */}
          {showMenu && (
            <>
              <div
                className="fixed inset-0 z-10"
                onClick={() => setShowMenu(false)}
              />
              <div className="absolute right-0 top-full mt-1 z-20 bg-white rounded-lg py-1 min-w-[120px] shadow-lg border border-neutral-200">
                <button
                  onClick={(e) => {
                    e.preventDefault()
                    e.stopPropagation()
                    setShowMenu(false)
                    onStar?.(conversation.id, !conversation.isStarred)
                  }}
                  className="w-full px-3 py-2 text-left text-sm text-neutral-700 hover:bg-neutral-100 flex items-center gap-2"
                >
                  <svg
                    width="16"
                    height="16"
                    className="w-4 h-4"
                    fill={conversation.isStarred ? 'currentColor' : 'none'}
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z"
                    />
                  </svg>
                  {conversation.isStarred ? 'Unstar' : 'Star'}
                </button>
                <button
                  onClick={(e) => {
                    e.preventDefault()
                    e.stopPropagation()
                    setShowMenu(false)
                    setIsEditing(true)
                  }}
                  className="w-full px-3 py-2 text-left text-sm text-neutral-700 hover:bg-neutral-100"
                >
                  Rename
                </button>
                <button
                  onClick={(e) => {
                    e.preventDefault()
                    e.stopPropagation()
                    handleDelete()
                  }}
                  className="w-full px-3 py-2 text-left text-sm text-red-600 hover:bg-red-50"
                >
                  Delete
                </button>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  )
}
