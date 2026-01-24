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

interface PatientNote {
  id: string
  content: string
  created_at: string
  updated_at: string
}

interface PatientHistoryProps {
  patientId: string
  labs: LabResult[]
  notes: PatientNote[]
}

export function PatientHistory({ patientId, labs, notes }: PatientHistoryProps) {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      {/* Lab Results */}
      <div className="bg-neutral-50 dark:bg-neutral-800 rounded-2xl p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-medium text-neutral-900 dark:text-neutral-50">Lab Results</h3>
          <Link
            href={`/labs?patient=${patientId}`}
            className="text-sm text-brand-blue hover:underline"
          >
            View all
          </Link>
        </div>

        {labs.length === 0 ? (
          <p className="text-neutral-500 dark:text-neutral-400 text-sm">No lab results yet</p>
        ) : (
          <div className="space-y-3">
            {labs.slice(0, 5).map((lab) => (
              <Link
                key={lab.id}
                href={`/labs/${lab.id}`}
                className="block p-3 bg-white dark:bg-neutral-700 rounded-xl hover:bg-neutral-100 dark:hover:bg-neutral-600 transition-colors"
              >
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium text-neutral-900 dark:text-neutral-50">
                      {formatDate(lab.test_date)}
                    </p>
                    <p className="text-sm text-neutral-500 dark:text-neutral-400">
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

      {/* Notes */}
      <div className="bg-neutral-50 dark:bg-neutral-800 rounded-2xl p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-medium text-neutral-900 dark:text-neutral-50">Notes</h3>
        </div>

        {notes.length === 0 ? (
          <p className="text-neutral-500 dark:text-neutral-400 text-sm">No notes yet</p>
        ) : (
          <div className="space-y-3">
            {notes.slice(0, 5).map((note) => (
              <div
                key={note.id}
                className="p-3 bg-white dark:bg-neutral-700 rounded-xl"
              >
                <p className="text-neutral-900 dark:text-neutral-50 text-sm line-clamp-2">
                  {note.content}
                </p>
                <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-2">
                  {formatRelativeTime(note.created_at)}
                </p>
              </div>
            ))}
            {notes.length > 5 && (
              <p className="text-sm text-neutral-500 dark:text-neutral-400 text-center pt-2">
                +{notes.length - 5} more notes
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
