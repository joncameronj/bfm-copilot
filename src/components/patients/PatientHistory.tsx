'use client'

import Link from 'next/link'
import { Badge } from '@/components/ui/Badge'
import { formatDate, formatRelativeTime } from '@/lib/utils'

interface LabResult {
  id: string
  test_date: string
  ominous_count: number
  ominous_markers_triggered: string[]
  created_at: string
}

interface Conversation {
  id: string
  title: string
  conversation_type: string
  updated_at: string
}

interface PatientHistoryProps {
  patientId: string
  labs: LabResult[]
  conversations: Conversation[]
}

export function PatientHistory({ patientId, labs, conversations }: PatientHistoryProps) {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      {/* Lab Results */}
      <div className="bg-neutral-50 rounded-2xl p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-medium text-neutral-900">Lab Results</h3>
          <Link
            href={`/labs?patient=${patientId}`}
            className="text-sm text-brand-blue hover:underline"
          >
            View all
          </Link>
        </div>

        {labs.length === 0 ? (
          <p className="text-neutral-500 text-sm">No lab results yet</p>
        ) : (
          <div className="space-y-3">
            {labs.slice(0, 5).map((lab) => (
              <Link
                key={lab.id}
                href={`/labs/${lab.id}`}
                className="block p-3 bg-white rounded-xl hover:bg-neutral-100 transition-colors"
              >
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium text-neutral-900">
                      {formatDate(lab.test_date)}
                    </p>
                    <p className="text-sm text-neutral-500">
                      {formatRelativeTime(lab.created_at)}
                    </p>
                  </div>
                  {lab.ominous_count >= 3 ? (
                    <Badge variant="danger">
                      {lab.ominous_count} alerts
                    </Badge>
                  ) : lab.ominous_count > 0 ? (
                    <Badge variant="warning">
                      {lab.ominous_count} flags
                    </Badge>
                  ) : (
                    <Badge variant="success">Normal</Badge>
                  )}
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>

      {/* Conversations */}
      <div className="bg-neutral-50 rounded-2xl p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-medium text-neutral-900">Conversations</h3>
          <Link
            href={`/?patient=${patientId}`}
            className="text-sm text-brand-blue hover:underline"
          >
            View all
          </Link>
        </div>

        {conversations.length === 0 ? (
          <p className="text-neutral-500 text-sm">No conversations yet</p>
        ) : (
          <div className="space-y-3">
            {conversations.slice(0, 5).map((conversation) => (
              <Link
                key={conversation.id}
                href={`/?conversation=${conversation.id}`}
                className="block p-3 bg-white rounded-xl hover:bg-neutral-100 transition-colors"
              >
                <div className="flex items-center justify-between">
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-neutral-900 truncate">
                      {conversation.title || 'Untitled conversation'}
                    </p>
                    <p className="text-sm text-neutral-500">
                      {formatRelativeTime(conversation.updated_at)}
                    </p>
                  </div>
                  <Badge variant="neutral" size="sm">
                    {conversation.conversation_type}
                  </Badge>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
