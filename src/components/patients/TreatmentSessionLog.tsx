'use client'

import { useState } from 'react'
import { useTreatmentSessions, useTreatmentSessionMutations } from '@/hooks/useTreatmentSessions'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { Input } from '@/components/ui/Input'
import { Select } from '@/components/ui/Select'
import { Spinner } from '@/components/ui/Spinner'
import { SessionModal } from './SessionModal'
import { SessionNotesModal } from './SessionNotesModal'
import { formatDate, formatRelativeTime } from '@/lib/utils'
import { HugeiconsIcon } from '@hugeicons/react'
import { PlusSignIcon, Delete02Icon, Edit02Icon } from '@hugeicons/core-free-icons'
import { toast } from 'react-hot-toast'
import type {
  TreatmentSessionWithDetails,
  TreatmentSessionFilters,
  TreatmentEffect,
} from '@/types/treatment'
import { EFFECT_LABELS, EFFECT_BADGE_VARIANTS } from '@/types/treatment'
import Link from 'next/link'

interface TreatmentSessionLogProps {
  patientId: string
}

export function TreatmentSessionLog({ patientId }: TreatmentSessionLogProps) {
  const [filters, setFilters] = useState<TreatmentSessionFilters>({
    effect: 'all',
  })
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false)
  const [editingSession, setEditingSession] = useState<TreatmentSessionWithDetails | null>(null)
  const [viewingNotes, setViewingNotes] = useState<TreatmentSessionWithDetails | null>(null)

  const { sessions, isLoading, error, refetch } = useTreatmentSessions(patientId, filters)
  const { deleteSession, isLoading: isMutating } = useTreatmentSessionMutations()

  const handleDelete = async (session: TreatmentSessionWithDetails) => {
    if (!confirm('Are you sure you want to delete this session?')) return

    try {
      await deleteSession(patientId, session.id)
      toast.success('Session deleted')
      refetch()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to delete session')
    }
  }

  const handleRowDoubleClick = (session: TreatmentSessionWithDetails) => {
    setViewingNotes(session)
  }

  if (error) {
    return (
      <div className="bg-red-50 dark:bg-red-900/30 rounded-2xl p-6 text-center">
        <p className="text-red-600 dark:text-red-400 mb-4">Failed to load treatment sessions</p>
        <Button variant="secondary" onClick={() => refetch()}>
          Try Again
        </Button>
      </div>
    )
  }

  return (
    <div className="bg-neutral-50 dark:bg-neutral-800 rounded-2xl p-6">
      <div className="flex items-center justify-between mb-6">
        <h3 className="text-sm font-medium text-neutral-500 dark:text-neutral-400 uppercase tracking-wider">
          Treatment Sessions
        </h3>
        <Button onClick={() => setIsCreateModalOpen(true)} size="sm">
          <HugeiconsIcon icon={PlusSignIcon} size={16} className="mr-1" />
          Log Session
        </Button>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-4 mb-6">
        <div className="flex-1 min-w-[200px]">
          <Input
            placeholder="Search notes or frequencies..."
            value={filters.search || ''}
            onChange={(e) => setFilters({ ...filters, search: e.target.value })}
          />
        </div>
        <div className="w-36">
          <Select
            value={filters.effect || 'all'}
            onChange={(e) => setFilters({ ...filters, effect: e.target.value as TreatmentEffect | 'all' })}
          >
            <option value="all">All Effects</option>
            <option value="positive">Positive</option>
            <option value="negative">Negative</option>
            <option value="nil">No Effect</option>
          </Select>
        </div>
      </div>

      {/* Sessions Table */}
      {isLoading ? (
        <div className="flex items-center justify-center h-32">
          <Spinner size="lg" className="text-brand-blue" />
        </div>
      ) : sessions.length === 0 ? (
        <div className="text-center py-8">
          <p className="text-neutral-500 dark:text-neutral-400 mb-4">
            {filters.search || filters.effect !== 'all'
              ? 'No sessions found matching your filters'
              : 'No treatment sessions logged yet'}
          </p>
          {!filters.search && filters.effect === 'all' && (
            <Button variant="secondary" onClick={() => setIsCreateModalOpen(true)}>
              Log First Session
            </Button>
          )}
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="text-left text-sm text-neutral-500 dark:text-neutral-400 border-b border-neutral-200 dark:border-neutral-700">
                <th className="pb-3 font-medium">Date & Time</th>
                <th className="pb-3 font-medium">Protocol</th>
                <th className="pb-3 font-medium">Frequencies</th>
                <th className="pb-3 font-medium">Effect</th>
                <th className="pb-3 font-medium">Notes</th>
                <th className="pb-3 font-medium">Updated</th>
                <th className="pb-3 font-medium w-24">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-100 dark:divide-neutral-800">
              {sessions.map((session) => (
                <tr
                  key={session.id}
                  className="hover:bg-neutral-100 dark:hover:bg-neutral-700 cursor-pointer transition-colors"
                  onDoubleClick={() => handleRowDoubleClick(session)}
                >
                  <td className="py-3">
                    <div className="font-medium text-neutral-900 dark:text-neutral-50">
                      {formatDate(session.sessionDate)}
                    </div>
                    {session.sessionTime && (
                      <div className="text-sm text-neutral-500 dark:text-neutral-400">
                        {session.sessionTime}
                      </div>
                    )}
                  </td>
                  <td className="py-3">
                    {session.protocol ? (
                      <Link
                        href={`/protocols/${session.protocol.id}`}
                        className="text-brand-blue hover:underline"
                        onClick={(e) => e.stopPropagation()}
                      >
                        {session.protocol.title}
                      </Link>
                    ) : (
                      <span className="text-neutral-400">—</span>
                    )}
                  </td>
                  <td className="py-3">
                    {session.frequenciesUsed.length > 0 ? (
                      <div className="flex flex-wrap gap-1 max-w-[200px]">
                        {session.frequenciesUsed.slice(0, 2).map((freq, i) => (
                          <span
                            key={i}
                            className="text-xs bg-neutral-100 dark:bg-neutral-700 text-neutral-700 dark:text-neutral-300 px-2 py-0.5 rounded"
                            title={`${freq.frequencyA}Hz${freq.frequencyB ? ` / ${freq.frequencyB}Hz` : ''}`}
                          >
                            {freq.name}
                          </span>
                        ))}
                        {session.frequenciesUsed.length > 2 && (
                          <span className="text-xs text-neutral-500 dark:text-neutral-400">
                            +{session.frequenciesUsed.length - 2} more
                          </span>
                        )}
                      </div>
                    ) : (
                      <span className="text-neutral-400 dark:text-neutral-500">—</span>
                    )}
                  </td>
                  <td className="py-3">
                    <Badge variant={EFFECT_BADGE_VARIANTS[session.effect]} size="sm">
                      {EFFECT_LABELS[session.effect]}
                    </Badge>
                  </td>
                  <td className="py-3">
                    {session.notes ? (
                      <p className="text-sm text-neutral-600 dark:text-neutral-400 truncate max-w-[150px]" title={session.notes}>
                        {session.notes}
                      </p>
                    ) : (
                      <span className="text-neutral-400 dark:text-neutral-500">—</span>
                    )}
                  </td>
                  <td className="py-3 text-sm text-neutral-500 dark:text-neutral-400">
                    {formatRelativeTime(session.updatedAt)}
                  </td>
                  <td className="py-3">
                    <div className="flex items-center gap-1">
                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          setEditingSession(session)
                        }}
                        className="p-1.5 text-neutral-500 dark:text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-200 hover:bg-neutral-200 dark:hover:bg-neutral-700 rounded-lg transition-colors"
                        title="Edit session"
                      >
                        <HugeiconsIcon icon={Edit02Icon} size={16} />
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          handleDelete(session)
                        }}
                        disabled={isMutating}
                        className="p-1.5 text-neutral-500 dark:text-neutral-400 hover:text-red-600 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/30 rounded-lg transition-colors"
                        title="Delete session"
                      >
                        <HugeiconsIcon icon={Delete02Icon} size={16} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Create/Edit Modal */}
      {(isCreateModalOpen || editingSession) && (
        <SessionModal
          patientId={patientId}
          session={editingSession || undefined}
          onClose={() => {
            setIsCreateModalOpen(false)
            setEditingSession(null)
          }}
          onSuccess={() => {
            setIsCreateModalOpen(false)
            setEditingSession(null)
            refetch()
          }}
        />
      )}

      {/* Notes Modal */}
      {viewingNotes && (
        <SessionNotesModal
          patientId={patientId}
          session={viewingNotes}
          onClose={() => setViewingNotes(null)}
          onUpdate={() => {
            setViewingNotes(null)
            refetch()
          }}
        />
      )}
    </div>
  )
}
