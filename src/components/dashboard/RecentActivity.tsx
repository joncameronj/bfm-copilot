'use client'

import Link from 'next/link'
import { Badge } from '@/components/ui/Badge'
import { formatRelativeTime } from '@/lib/utils'

interface Activity {
  id: string
  title: string
  conversation_type: string
  created_at: string
}

interface RecentActivityProps {
  activities: Activity[]
}

export function RecentActivity({ activities }: RecentActivityProps) {
  if (activities.length === 0) {
    return (
      <p className="text-neutral-500 text-sm py-4">
        No recent activity
      </p>
    )
  }

  const getConversationTypeLabel = (type: string) => {
    switch (type) {
      case 'lab_analysis':
        return 'Lab Analysis'
      case 'diagnostics':
        return 'Diagnostics'
      case 'brainstorm':
        return 'Brainstorm'
      default:
        return 'General'
    }
  }

  const getConversationTypeVariant = (type: string) => {
    switch (type) {
      case 'lab_analysis':
        return 'info' as const
      case 'diagnostics':
        return 'warning' as const
      case 'brainstorm':
        return 'success' as const
      default:
        return 'neutral' as const
    }
  }

  return (
    <div className="space-y-3">
      {activities.map((activity) => (
        <Link
          key={activity.id}
          href={`/?conversation=${activity.id}`}
          className="block p-3 rounded-xl hover:bg-neutral-100 transition-colors"
        >
          <div className="flex items-center justify-between">
            <div className="flex-1 min-w-0">
              <p className="font-medium text-neutral-900 truncate">
                {activity.title || 'Untitled conversation'}
              </p>
              <p className="text-sm text-neutral-500">
                {formatRelativeTime(activity.created_at)}
              </p>
            </div>
            <Badge
              variant={getConversationTypeVariant(activity.conversation_type)}
              size="sm"
            >
              {getConversationTypeLabel(activity.conversation_type)}
            </Badge>
          </div>
        </Link>
      ))}
    </div>
  )
}
