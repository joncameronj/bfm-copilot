'use client'

import { useState, useMemo } from 'react'
import Link from 'next/link'
import { useConversations } from '@/hooks/useConversations'
import { formatRelativeTime, cn } from '@/lib/utils'
import { HugeiconsIcon } from '@hugeicons/react'
import { Add01Icon, Search01Icon, StarIcon } from '@hugeicons/core-free-icons'
import type { Conversation } from '@/types/shared'

interface ChatListItemProps {
  conversation: Conversation
  isSelectMode: boolean
  isSelected: boolean
  onToggleSelect: (id: string) => void
  onStar: (id: string, isStarred: boolean) => void
  onRename: (id: string, title: string) => void
  onDelete: (id: string) => void
}

function ChatListItem({
  conversation,
  isSelectMode,
  isSelected,
  onToggleSelect,
  onStar,
  onRename,
  onDelete,
}: ChatListItemProps) {
  const [showMenu, setShowMenu] = useState(false)
  const [isEditing, setIsEditing] = useState(false)
  const [editValue, setEditValue] = useState(conversation.title)

  const handleRename = () => {
    if (editValue.trim() && editValue !== conversation.title) {
      onRename(conversation.id, editValue.trim())
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

  return (
    <div className="flex items-center gap-3 py-4 hover:bg-neutral-50 dark:hover:bg-neutral-800 -mx-4 px-4 rounded-lg group relative">
      {isSelectMode && (
        <input
          type="checkbox"
          checked={isSelected}
          onChange={() => onToggleSelect(conversation.id)}
          className="w-4 h-4 rounded border-neutral-300 dark:border-neutral-600 text-brand-blue focus:ring-brand-blue/20"
        />
      )}

      {isEditing ? (
        <input
          type="text"
          value={editValue}
          onChange={(e) => setEditValue(e.target.value)}
          onBlur={handleRename}
          onKeyDown={handleKeyDown}
          className="flex-1 bg-white dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-blue/20 text-neutral-900 dark:text-neutral-50"
          autoFocus
        />
      ) : (
        <Link
          href={`/?conversation=${conversation.id}`}
          className="flex-1 min-w-0"
          onClick={(e) => isSelectMode && e.preventDefault()}
        >
          <div className="flex items-center gap-2">
            {conversation.isStarred && (
              <HugeiconsIcon
                icon={StarIcon}
                size={14}
                className="text-amber-500 flex-shrink-0"
                fill="currentColor"
              />
            )}
            <span className="text-neutral-900 dark:text-neutral-50 font-medium truncate">
              {conversation.title || 'New Conversation'}
            </span>
          </div>
          <p className="text-sm text-neutral-400 dark:text-neutral-500 mt-1">
            Last message {formatRelativeTime(conversation.updatedAt)}
          </p>
        </Link>
      )}

      {/* Menu button - only show when not in select mode and not editing */}
      {!isSelectMode && !isEditing && (
        <div className="relative">
          <button
            onClick={(e) => {
              e.preventDefault()
              e.stopPropagation()
              setShowMenu(!showMenu)
            }}
            className={cn(
              'p-1.5 rounded text-neutral-400 dark:text-neutral-500 hover:text-neutral-600 dark:hover:text-neutral-300 hover:bg-neutral-200 dark:hover:bg-neutral-700',
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
              <div className="absolute right-0 top-full mt-1 z-20 bg-white dark:bg-neutral-800 rounded-lg py-1 min-w-[120px] shadow-lg border border-neutral-200 dark:border-neutral-700">
                <button
                  onClick={(e) => {
                    e.preventDefault()
                    e.stopPropagation()
                    setShowMenu(false)
                    onStar(conversation.id, !conversation.isStarred)
                  }}
                  className="w-full px-3 py-2 text-left text-sm text-neutral-700 dark:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-700 flex items-center gap-2"
                >
                  <HugeiconsIcon
                    icon={StarIcon}
                    size={16}
                    fill={conversation.isStarred ? 'currentColor' : 'none'}
                  />
                  {conversation.isStarred ? 'Unstar' : 'Star'}
                </button>
                <button
                  onClick={(e) => {
                    e.preventDefault()
                    e.stopPropagation()
                    setShowMenu(false)
                    setIsEditing(true)
                  }}
                  className="w-full px-3 py-2 text-left text-sm text-neutral-700 dark:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-700"
                >
                  Rename
                </button>
                <button
                  onClick={(e) => {
                    e.preventDefault()
                    e.stopPropagation()
                    setShowMenu(false)
                    onDelete(conversation.id)
                  }}
                  className="w-full px-3 py-2 text-left text-sm text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/30"
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

export default function ChatsPage() {
  const {
    conversations,
    isLoading,
    renameConversation,
    deleteConversation,
    starConversation,
  } = useConversations()

  const [searchQuery, setSearchQuery] = useState('')
  const [isSelectMode, setIsSelectMode] = useState(false)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())

  const filteredConversations = useMemo(() => {
    if (!searchQuery.trim()) return conversations
    return conversations.filter((c) =>
      c.title.toLowerCase().includes(searchQuery.toLowerCase())
    )
  }, [conversations, searchQuery])

  const toggleSelection = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const handleBulkDelete = async () => {
    for (const id of selectedIds) {
      await deleteConversation(id)
    }
    setSelectedIds(new Set())
    setIsSelectMode(false)
  }

  const handleBulkStar = async () => {
    for (const id of selectedIds) {
      const conv = conversations.find((c) => c.id === id)
      if (conv) await starConversation(conv.id, !conv.isStarred)
    }
    setSelectedIds(new Set())
    setIsSelectMode(false)
  }

  const handleCancelSelect = () => {
    setIsSelectMode(false)
    setSelectedIds(new Set())
  }

  return (
    <div className="max-w-7xl mx-auto p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-4xl font-bold tracking-[-0.05em] text-neutral-900 dark:text-neutral-50">Chats</h1>
        <Link
          href="/"
          className="flex items-center gap-2 px-4 py-2 border border-neutral-200 dark:border-neutral-700 rounded-lg hover:bg-neutral-50 dark:hover:bg-neutral-800 transition-colors"
        >
          <HugeiconsIcon icon={Add01Icon} size={16} />
          <span className="text-sm font-medium">New chat</span>
        </Link>
      </div>

      {/* Search */}
      <div className="relative mb-4">
        <HugeiconsIcon
          icon={Search01Icon}
          className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400"
          size={18}
        />
        <input
          type="text"
          placeholder="Search your chats..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full pl-10 pr-4 py-3 border border-neutral-200 dark:border-neutral-700 rounded-lg bg-neutral-50 dark:bg-neutral-800 focus:bg-white dark:focus:bg-neutral-700 focus:outline-none focus:ring-2 focus:ring-brand-blue/20 transition-colors text-neutral-900 dark:text-neutral-50 placeholder:text-neutral-400 dark:placeholder:text-neutral-500"
        />
      </div>

      {/* Count + Select Toggle */}
      <div className="flex items-center justify-between mb-4 text-sm">
        <span className="text-neutral-500 dark:text-neutral-400">
          {filteredConversations.length} chat{filteredConversations.length !== 1 ? 's' : ''}
        </span>
        {isSelectMode ? (
          <div className="flex items-center gap-3">
            <span className="text-neutral-500 dark:text-neutral-400">{selectedIds.size} selected</span>
            <button
              onClick={handleBulkStar}
              disabled={selectedIds.size === 0}
              className="text-amber-500 hover:underline disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Star
            </button>
            <button
              onClick={handleBulkDelete}
              disabled={selectedIds.size === 0}
              className="text-red-500 hover:underline disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Delete
            </button>
            <button
              onClick={handleCancelSelect}
              className="text-neutral-500 dark:text-neutral-400 hover:underline"
            >
              Cancel
            </button>
          </div>
        ) : (
          <button
            onClick={() => setIsSelectMode(true)}
            className="text-brand-blue hover:underline"
          >
            Select
          </button>
        )}
      </div>

      {/* Chat List */}
      {isLoading ? (
        <div className="space-y-4">
          {[...Array(5)].map((_, i) => (
            <div
              key={i}
              className="h-16 bg-neutral-100 dark:bg-neutral-800 rounded-lg animate-pulse"
            />
          ))}
        </div>
      ) : conversations.length === 0 ? (
        <div className="text-center py-12">
          <p className="text-neutral-500 dark:text-neutral-400">No chats yet</p>
          <p className="text-sm text-neutral-400 dark:text-neutral-500 mt-1">
            Start a new conversation!
          </p>
        </div>
      ) : searchQuery && filteredConversations.length === 0 ? (
        <div className="text-center py-12">
          <p className="text-neutral-500 dark:text-neutral-400">No chats matching &quot;{searchQuery}&quot;</p>
        </div>
      ) : (
        <div className="divide-y divide-neutral-100 dark:divide-neutral-800">
          {filteredConversations.map((conv) => (
            <ChatListItem
              key={conv.id}
              conversation={conv}
              isSelectMode={isSelectMode}
              isSelected={selectedIds.has(conv.id)}
              onToggleSelect={toggleSelection}
              onStar={starConversation}
              onRename={renameConversation}
              onDelete={deleteConversation}
            />
          ))}
        </div>
      )}
    </div>
  )
}
