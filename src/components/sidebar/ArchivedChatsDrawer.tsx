'use client'

import { useState, useEffect, useCallback } from 'react'
import { cn } from '@/lib/utils'
import { HugeiconsIcon } from '@hugeicons/react'
import { ArchiveIcon, RestoreBinIcon } from '@hugeicons/core-free-icons'
import type { Conversation } from '@/types/shared'

interface ArchivedChatsDrawerProps {
  isOpen: boolean
  onClose: () => void
  onRestore: (id: string) => Promise<void>
}

const TRANSITION_TIMING = 'cubic-bezier(0.4, 0, 0.2, 1)'
const TRANSITION_DURATION = '300ms'

export function ArchivedChatsDrawer({ isOpen, onClose, onRestore }: ArchivedChatsDrawerProps) {
  const [conversations, setConversations] = useState<Conversation[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [restoringId, setRestoringId] = useState<string | null>(null)

  const fetchArchived = useCallback(async () => {
    try {
      setIsLoading(true)
      const response = await fetch('/api/conversations/archived')
      if (!response.ok) throw new Error('Failed to fetch archived conversations')
      const data = await response.json()
      setConversations(data.conversations || [])
    } catch (error) {
      console.error('Error fetching archived:', error)
    } finally {
      setIsLoading(false)
    }
  }, [])

  // Fetch when drawer opens
  useEffect(() => {
    if (isOpen) {
      fetchArchived()
    }
  }, [isOpen, fetchArchived])

  // Close on escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose()
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isOpen, onClose])

  // Prevent body scroll when drawer is open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = ''
    }
    return () => {
      document.body.style.overflow = ''
    }
  }, [isOpen])

  const handleRestore = async (id: string) => {
    try {
      setRestoringId(id)
      await onRestore(id)
      // Remove from local state
      setConversations((prev) => prev.filter((c) => c.id !== id))
    } catch (error) {
      console.error('Error restoring conversation:', error)
    } finally {
      setRestoringId(null)
    }
  }

  return (
    <>
      {/* Backdrop */}
      <div
        className={cn(
          'fixed inset-0 bg-black/20 z-40 transition-opacity',
          isOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'
        )}
        style={{
          transition: `opacity ${TRANSITION_DURATION} ${TRANSITION_TIMING}`,
        }}
        onClick={onClose}
      />

      {/* Drawer */}
      <div
        className={cn('fixed top-0 left-0 h-full bg-white z-50 flex flex-col shadow-xl')}
        style={{
          width: '320px',
          transform: isOpen ? 'translateX(0)' : 'translateX(-100%)',
          transition: `transform ${TRANSITION_DURATION} ${TRANSITION_TIMING}`,
        }}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-neutral-200">
          <div className="flex items-center gap-2">
            <HugeiconsIcon icon={ArchiveIcon} size={20} className="text-neutral-600" />
            <h2 className="text-lg font-semibold text-neutral-900">Archived Chats</h2>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-lg hover:bg-neutral-100 transition-colors"
            aria-label="Close drawer"
          >
            <svg
              width="20"
              height="20"
              className="w-5 h-5 text-neutral-600"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-3">
          {isLoading ? (
            <div className="space-y-2">
              {[...Array(5)].map((_, i) => (
                <div key={i} className="h-14 bg-neutral-100 rounded-lg animate-pulse" />
              ))}
            </div>
          ) : conversations.length === 0 ? (
            <div className="px-4 py-8 text-center">
              <HugeiconsIcon icon={ArchiveIcon} size={32} className="text-neutral-300 mx-auto mb-2" />
              <p className="text-sm text-neutral-400">No archived conversations</p>
              <p className="text-xs text-neutral-400 mt-1">
                Archived chats will appear here
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              {conversations.map((conv) => (
                <div
                  key={conv.id}
                  className="flex items-center justify-between p-3 rounded-lg hover:bg-neutral-50 transition-colors"
                >
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-neutral-900 truncate">
                      {conv.title || 'Untitled'}
                    </p>
                    <p className="text-xs text-neutral-400">
                      {new Date(conv.updatedAt).toLocaleDateString()}
                    </p>
                  </div>
                  <button
                    onClick={() => handleRestore(conv.id)}
                    disabled={restoringId === conv.id}
                    className={cn(
                      'flex items-center gap-1 px-2 py-1 text-xs font-medium rounded-md transition-colors',
                      'text-neutral-600 hover:text-neutral-900 hover:bg-neutral-100',
                      restoringId === conv.id && 'opacity-50 cursor-not-allowed'
                    )}
                    aria-label="Restore conversation"
                  >
                    <HugeiconsIcon
                      icon={RestoreBinIcon}
                      size={12}
                      className={restoringId === conv.id ? 'animate-spin' : ''}
                    />
                    Restore
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </>
  )
}
