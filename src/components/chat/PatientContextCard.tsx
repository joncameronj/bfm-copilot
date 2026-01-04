'use client'

import { useState } from 'react'
import { HugeiconsIcon } from '@hugeicons/react'
import { ArrowDown01Icon, ArrowUp01Icon, UserIcon } from '@hugeicons/core-free-icons'
import { Badge } from '@/components/ui/Badge'
import type { PatientChatContext } from '@/types/patient-context'

interface PatientContextCardProps {
  context: PatientChatContext
  defaultExpanded?: boolean
}

export function PatientContextCard({ context, defaultExpanded = false }: PatientContextCardProps) {
  const [isExpanded, setIsExpanded] = useState(defaultExpanded)

  return (
    <div className="bg-neutral-50 rounded-xl border border-neutral-200 overflow-hidden">
      {/* Header - Always visible */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full px-4 py-3 flex items-center justify-between hover:bg-neutral-100 transition-colors"
      >
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-full bg-neutral-200 flex items-center justify-center">
            <HugeiconsIcon icon={UserIcon} size={16} className="text-neutral-600" />
          </div>
          <div className="text-left">
            <p className="text-xs text-neutral-500 uppercase tracking-wide">patient profile</p>
            <p className="font-medium text-neutral-900">{context.patient.name}</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Status Tags */}
          <div className="hidden sm:flex items-center gap-1.5">
            <Badge variant={context.labs.hasLabs ? 'success' : 'neutral'} size="sm">
              {context.labs.hasLabs ? 'Labs Uploaded' : 'No Labs'}
            </Badge>
            <Badge variant={context.diagnostics.hasAnalyses ? 'success' : 'neutral'} size="sm">
              {context.diagnostics.hasAnalyses ? 'Diagnostics Complete' : 'No Diagnostics'}
            </Badge>
            <Badge variant={context.treatments.hasTreatments ? 'success' : 'neutral'} size="sm">
              {context.treatments.hasTreatments ? 'Treatment Started' : 'No Treatments'}
            </Badge>
          </div>

          {/* Expand/Collapse Icon */}
          <HugeiconsIcon
            icon={isExpanded ? ArrowUp01Icon : ArrowDown01Icon}
            size={20}
            className="text-neutral-400"
          />
        </div>
      </button>

      {/* Mobile Tags - Show below header on small screens */}
      <div className="sm:hidden px-4 pb-3 flex flex-wrap gap-1.5">
        <Badge variant={context.labs.hasLabs ? 'success' : 'neutral'} size="sm">
          {context.labs.hasLabs ? 'Labs' : 'No Labs'}
        </Badge>
        <Badge variant={context.diagnostics.hasAnalyses ? 'success' : 'neutral'} size="sm">
          {context.diagnostics.hasAnalyses ? 'Diagnostics' : 'No Diagnostics'}
        </Badge>
        <Badge variant={context.treatments.hasTreatments ? 'success' : 'neutral'} size="sm">
          {context.treatments.hasTreatments ? 'Treatments' : 'No Treatments'}
        </Badge>
      </div>

      {/* Expanded Content */}
      {isExpanded && (
        <div className="px-4 pb-4 pt-2 border-t border-neutral-200 space-y-4">
          {/* Demographics */}
          <div>
            <h4 className="text-xs font-medium text-neutral-500 uppercase tracking-wide mb-2">Demographics</h4>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-sm">
              <div>
                <span className="text-neutral-500">Age:</span>{' '}
                <span className="text-neutral-900">{context.patient.age} years</span>
              </div>
              <div>
                <span className="text-neutral-500">Gender:</span>{' '}
                <span className="text-neutral-900 capitalize">{context.patient.gender}</span>
              </div>
              <div>
                <span className="text-neutral-500">Status:</span>{' '}
                <span className="text-neutral-900 capitalize">{context.patient.status}</span>
              </div>
            </div>
          </div>

          {/* Clinical */}
          {(context.clinical.chiefComplaints || context.clinical.medicalHistory) && (
            <div>
              <h4 className="text-xs font-medium text-neutral-500 uppercase tracking-wide mb-2">Clinical</h4>
              <div className="space-y-2 text-sm">
                {context.clinical.chiefComplaints && (
                  <div>
                    <span className="text-neutral-500">Chief Complaints:</span>{' '}
                    <span className="text-neutral-900">{context.clinical.chiefComplaints}</span>
                  </div>
                )}
                {context.clinical.medicalHistory && (
                  <div>
                    <span className="text-neutral-500">Medical History:</span>{' '}
                    <span className="text-neutral-900">{context.clinical.medicalHistory}</span>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Medications & Allergies */}
          {(context.clinical.currentMedications.length > 0 || context.clinical.allergies.length > 0) && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {context.clinical.currentMedications.length > 0 && (
                <div>
                  <h4 className="text-xs font-medium text-neutral-500 uppercase tracking-wide mb-2">Medications</h4>
                  <div className="flex flex-wrap gap-1">
                    {context.clinical.currentMedications.map((med, i) => (
                      <Badge key={i} variant="info" size="sm">{med}</Badge>
                    ))}
                  </div>
                </div>
              )}
              {context.clinical.allergies.length > 0 && (
                <div>
                  <h4 className="text-xs font-medium text-neutral-500 uppercase tracking-wide mb-2">Allergies</h4>
                  <div className="flex flex-wrap gap-1">
                    {context.clinical.allergies.map((allergy, i) => (
                      <Badge key={i} variant="danger" size="sm">{allergy}</Badge>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Labs Summary */}
          {context.labs.hasLabs && (
            <div>
              <h4 className="text-xs font-medium text-neutral-500 uppercase tracking-wide mb-2">Labs</h4>
              <div className="text-sm text-neutral-700">
                {context.labs.count} lab result{context.labs.count !== 1 ? 's' : ''} on file
                {context.labs.latestLabDate && ` (latest: ${new Date(context.labs.latestLabDate).toLocaleDateString()})`}
                {context.labs.ominousMarkersCount && context.labs.ominousMarkersCount > 0 && (
                  <span className="text-red-600 ml-2">
                    {context.labs.ominousMarkersCount} ominous marker{context.labs.ominousMarkersCount !== 1 ? 's' : ''}
                  </span>
                )}
              </div>
            </div>
          )}

          {/* Treatments Summary */}
          {context.treatments.hasTreatments && (
            <div>
              <h4 className="text-xs font-medium text-neutral-500 uppercase tracking-wide mb-2">Treatments</h4>
              <div className="text-sm text-neutral-700">
                {context.treatments.totalSessions} session{context.treatments.totalSessions !== 1 ? 's' : ''}
                {context.treatments.positiveOutcomes > 0 && (
                  <span className="text-green-600 ml-2">
                    ({context.treatments.positiveOutcomes} positive outcome{context.treatments.positiveOutcomes !== 1 ? 's' : ''})
                  </span>
                )}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
