'use client'

import { ConversationItem } from './ConversationItem'
import { useConversations } from '@/hooks/useConversations'

interface ConversationListProps {
  isCollapsed?: boolean
}

export function ConversationList({ isCollapsed = false }: ConversationListProps) {
  const {
    conversations,
    isLoading,
    renameConversation,
    deleteConversation,
  } = useConversations()

  // Hide when collapsed
  if (isCollapsed) {
    return null
  }

  if (isLoading) {
    return (
      <div className="space-y-2 px-2">
        {[...Array(5)].map((_, i) => (
          <div
            key={i}
            className="h-12 bg-neutral-100 rounded-lg animate-pulse"
          />
        ))}
      </div>
    )
  }

  if (conversations.length === 0) {
    return (
      <div className="px-4 py-8 text-center">
        <p className="text-sm text-neutral-400">No conversations yet</p>
        <p className="text-xs text-neutral-400 mt-1">
          Start a new chat to get started
        </p>
      </div>
    )
  }

  // Group conversations by date
  const today = new Date()
  const yesterday = new Date(today)
  yesterday.setDate(yesterday.getDate() - 1)
  const lastWeek = new Date(today)
  lastWeek.setDate(lastWeek.getDate() - 7)

  const grouped = {
    today: [] as typeof conversations,
    yesterday: [] as typeof conversations,
    lastWeek: [] as typeof conversations,
    older: [] as typeof conversations,
  }

  conversations.forEach((conv) => {
    const convDate = new Date(conv.updatedAt)
    if (convDate.toDateString() === today.toDateString()) {
      grouped.today.push(conv)
    } else if (convDate.toDateString() === yesterday.toDateString()) {
      grouped.yesterday.push(conv)
    } else if (convDate > lastWeek) {
      grouped.lastWeek.push(conv)
    } else {
      grouped.older.push(conv)
    }
  })

  return (
    <div className="space-y-4">
      {grouped.today.length > 0 && (
        <div>
          <p className="px-3 text-xs font-medium text-neutral-400 uppercase tracking-wider mb-2">
            Today
          </p>
          <div className="space-y-1">
            {grouped.today.map((conv) => (
              <ConversationItem
                key={conv.id}
                conversation={conv}
                onRename={renameConversation}
                onDelete={deleteConversation}
              />
            ))}
          </div>
        </div>
      )}

      {grouped.yesterday.length > 0 && (
        <div>
          <p className="px-3 text-xs font-medium text-neutral-400 uppercase tracking-wider mb-2">
            Yesterday
          </p>
          <div className="space-y-1">
            {grouped.yesterday.map((conv) => (
              <ConversationItem
                key={conv.id}
                conversation={conv}
                onRename={renameConversation}
                onDelete={deleteConversation}
              />
            ))}
          </div>
        </div>
      )}

      {grouped.lastWeek.length > 0 && (
        <div>
          <p className="px-3 text-xs font-medium text-neutral-400 uppercase tracking-wider mb-2">
            This Week
          </p>
          <div className="space-y-1">
            {grouped.lastWeek.map((conv) => (
              <ConversationItem
                key={conv.id}
                conversation={conv}
                onRename={renameConversation}
                onDelete={deleteConversation}
              />
            ))}
          </div>
        </div>
      )}

      {grouped.older.length > 0 && (
        <div>
          <p className="px-3 text-xs font-medium text-neutral-400 uppercase tracking-wider mb-2">
            Older
          </p>
          <div className="space-y-1">
            {grouped.older.map((conv) => (
              <ConversationItem
                key={conv.id}
                conversation={conv}
                onRename={renameConversation}
                onDelete={deleteConversation}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
