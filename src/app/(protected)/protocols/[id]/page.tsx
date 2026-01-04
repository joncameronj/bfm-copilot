import { createClient } from '@/lib/supabase/server'
import { redirect, notFound } from 'next/navigation'
import Link from 'next/link'
import { Avatar } from '@/components/ui/Avatar'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { formatDate, formatRelativeTime } from '@/lib/utils'
import {
  STATUS_LABELS,
  CATEGORY_LABELS,
  CATEGORY_COLORS,
  OUTCOME_LABELS,
  OUTCOME_COLORS,
} from '@/types/protocol'
import type { ProtocolStatus, ProtocolCategory, FeedbackOutcome } from '@/types/protocol'

interface ProtocolPageProps {
  params: Promise<{ id: string }>
}

export default async function ProtocolPage({ params }: ProtocolPageProps) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  // Fetch protocol with related data
  const { data: protocol, error } = await supabase
    .from('protocols')
    .select(`
      *,
      patients (
        id,
        first_name,
        last_name,
        date_of_birth,
        gender
      ),
      protocol_feedback (
        id,
        outcome,
        outcome_text,
        adjustments_made,
        rating,
        lab_comparison,
        created_at
      )
    `)
    .eq('id', id)
    .eq('practitioner_id', user.id)
    .single()

  if (error || !protocol) {
    notFound()
  }

  const patientName = protocol.patients
    ? `${protocol.patients.first_name} ${protocol.patients.last_name}`
    : 'No patient assigned'

  const positiveCount = protocol.protocol_feedback?.filter(
    (f: { outcome: string }) => f.outcome === 'positive'
  ).length || 0
  const negativeCount = protocol.protocol_feedback?.filter(
    (f: { outcome: string }) => f.outcome === 'negative'
  ).length || 0
  const totalFeedback = protocol.protocol_feedback?.length || 0

  return (
    <div className="p-6 max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex items-start justify-between mb-8">
        <div>
          <div className="flex items-center gap-3 mb-2">
            <h1 className="text-4xl font-bold tracking-[-0.05em] text-neutral-900">
              {protocol.title}
            </h1>
            <Badge
              variant={protocol.status === 'active' ? 'success' : protocol.status === 'completed' ? 'info' : 'neutral'}
            >
              {STATUS_LABELS[protocol.status as ProtocolStatus]}
            </Badge>
          </div>
          <div className="flex items-center gap-3">
            <span className={`text-sm px-2 py-1 rounded-full ${CATEGORY_COLORS[protocol.category as ProtocolCategory]}`}>
              {CATEGORY_LABELS[protocol.category as ProtocolCategory]}
            </span>
            <span className="text-neutral-500">
              Created {formatRelativeTime(new Date(protocol.created_at))}
            </span>
          </div>
        </div>
        <div className="flex gap-3">
          <Link href={`/protocols/${id}/edit`}>
            <Button>Edit Protocol</Button>
          </Link>
        </div>
      </div>

      {/* Protocol Info Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
        {/* Patient Info */}
        <div className="bg-neutral-50 rounded-2xl p-6">
          <h3 className="text-sm font-medium text-neutral-500 uppercase tracking-wider mb-4">
            Patient
          </h3>
          {protocol.patients ? (
            <Link href={`/patients/${protocol.patients.id}`} className="block hover:bg-neutral-100 -m-2 p-2 rounded-lg transition-colors">
              <div className="flex items-center gap-3">
                <Avatar name={patientName} size="lg" />
                <div>
                  <p className="font-medium text-neutral-900">{patientName}</p>
                  <p className="text-sm text-neutral-500">View patient profile</p>
                </div>
              </div>
            </Link>
          ) : (
            <p className="text-neutral-500">No patient assigned to this protocol</p>
          )}
        </div>

        {/* Duration & Dates */}
        <div className="bg-neutral-50 rounded-2xl p-6">
          <h3 className="text-sm font-medium text-neutral-500 uppercase tracking-wider mb-4">
            Timeline
          </h3>
          <div className="space-y-3">
            {protocol.duration_days && (
              <div>
                <p className="text-xs text-neutral-400">Duration</p>
                <p className="text-neutral-900">{protocol.duration_days} days</p>
              </div>
            )}
            {protocol.start_date && (
              <div>
                <p className="text-xs text-neutral-400">Start Date</p>
                <p className="text-neutral-900">{formatDate(protocol.start_date)}</p>
              </div>
            )}
            {protocol.end_date && (
              <div>
                <p className="text-xs text-neutral-400">End Date</p>
                <p className="text-neutral-900">{formatDate(protocol.end_date)}</p>
              </div>
            )}
            {!protocol.duration_days && !protocol.start_date && !protocol.end_date && (
              <p className="text-neutral-500">No timeline set</p>
            )}
          </div>
        </div>

        {/* Feedback Summary */}
        <div className="bg-neutral-50 rounded-2xl p-6">
          <h3 className="text-sm font-medium text-neutral-500 uppercase tracking-wider mb-4">
            Feedback Summary
          </h3>
          <div className="grid grid-cols-3 gap-4">
            <div>
              <p className="text-3xl font-semibold text-neutral-900">{totalFeedback}</p>
              <p className="text-sm text-neutral-500">Total</p>
            </div>
            <div>
              <p className="text-3xl font-semibold text-green-600">{positiveCount}</p>
              <p className="text-sm text-neutral-500">Positive</p>
            </div>
            <div>
              <p className="text-3xl font-semibold text-red-600">{negativeCount}</p>
              <p className="text-sm text-neutral-500">Negative</p>
            </div>
          </div>
        </div>
      </div>

      {/* Protocol Content */}
      <div className="bg-neutral-50 rounded-2xl p-6 mb-8">
        <h3 className="text-sm font-medium text-neutral-500 uppercase tracking-wider mb-4">
          Protocol Content
        </h3>
        <div className="prose prose-neutral max-w-none">
          <p className="text-neutral-900 whitespace-pre-wrap">{protocol.content}</p>
        </div>
      </div>

      {/* Notes */}
      {protocol.notes && (
        <div className="bg-neutral-50 rounded-2xl p-6 mb-8">
          <h3 className="text-sm font-medium text-neutral-500 uppercase tracking-wider mb-4">
            Additional Notes
          </h3>
          <p className="text-neutral-900 whitespace-pre-wrap">{protocol.notes}</p>
        </div>
      )}

      {/* Feedback History */}
      <div className="bg-neutral-50 rounded-2xl p-6">
        <h3 className="text-sm font-medium text-neutral-500 uppercase tracking-wider mb-4">
          Feedback History
        </h3>
        {protocol.protocol_feedback && protocol.protocol_feedback.length > 0 ? (
          <div className="space-y-4">
            {protocol.protocol_feedback.map((feedback: {
              id: string
              outcome: string
              outcome_text: string | null
              adjustments_made: string | null
              rating: string | null
              lab_comparison: string | null
              created_at: string
            }) => (
              <div key={feedback.id} className="bg-white rounded-xl p-4 border border-neutral-200">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-3">
                    <span className={`font-medium ${OUTCOME_COLORS[feedback.outcome as FeedbackOutcome]}`}>
                      {OUTCOME_LABELS[feedback.outcome as FeedbackOutcome]} Outcome
                    </span>
                    {feedback.rating && (
                      <Badge variant={feedback.rating === 'thumbs_up' ? 'success' : 'danger'} size="sm">
                        {feedback.rating === 'thumbs_up' ? 'Thumbs Up' : 'Thumbs Down'}
                      </Badge>
                    )}
                  </div>
                  <span className="text-sm text-neutral-500">
                    {formatRelativeTime(new Date(feedback.created_at))}
                  </span>
                </div>
                {feedback.outcome_text && (
                  <p className="text-neutral-700 mb-2">{feedback.outcome_text}</p>
                )}
                {feedback.adjustments_made && (
                  <div className="mt-2 pt-2 border-t border-neutral-100">
                    <p className="text-xs text-neutral-400 mb-1">Adjustments Made</p>
                    <p className="text-sm text-neutral-600">{feedback.adjustments_made}</p>
                  </div>
                )}
                {feedback.lab_comparison && (
                  <div className="mt-2 pt-2 border-t border-neutral-100">
                    <p className="text-xs text-neutral-400 mb-1">Lab Comparison</p>
                    <p className="text-sm text-neutral-600">{feedback.lab_comparison}</p>
                  </div>
                )}
              </div>
            ))}
          </div>
        ) : (
          <p className="text-neutral-500">No feedback recorded yet</p>
        )}
      </div>
    </div>
  )
}
