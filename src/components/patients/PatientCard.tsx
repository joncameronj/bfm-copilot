'use client'

import Link from 'next/link'
import { Badge } from '@/components/ui/Badge'
import { calculateAge, formatRelativeTime } from '@/lib/utils'
import type { PatientWithStats } from '@/types/patient'

interface PatientCardProps {
  patient: PatientWithStats
  selectable?: boolean
  selected?: boolean
  onSelect?: (patientId: string, selected: boolean) => void
}

export function PatientCard({ patient, selectable = false, selected = false, onSelect }: PatientCardProps) {
  const age = calculateAge(patient.dateOfBirth)
  const fullName = `${patient.firstName} ${patient.lastName}`

  const handleCheckboxClick = (e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    onSelect?.(patient.id, !selected)
  }

  const cardContent = (
    <div
      className={`bg-neutral-50 dark:bg-neutral-800 rounded-2xl p-6 hover:bg-neutral-100 dark:hover:bg-neutral-700 transition-colors cursor-pointer ${selected ? 'ring-2 ring-blue-500' : ''}`}
      data-patient-id={patient.id}
      data-selected={selected}
    >
      <div className="flex items-start justify-between mb-4">
        <div className="flex items-start gap-3">
          {selectable && (
            <div onClick={handleCheckboxClick} className="mt-0.5">
              <input
                type="checkbox"
                checked={selected}
                readOnly
                className="w-5 h-5 rounded border-2 border-neutral-300 dark:border-neutral-600 bg-white dark:bg-neutral-950 accent-blue-600 cursor-pointer"
              />
            </div>
          )}
          <div>
            <h3 className="font-bold text-neutral-900 dark:text-neutral-50">
              {fullName}
            </h3>
            <p className="text-sm text-neutral-500 dark:text-neutral-400">
              {age} years old &bull; {patient.gender === 'male' ? 'Male' : patient.gender === 'female' ? 'Female' : 'Other'}
            </p>
          </div>
        </div>
        {patient.hasOminousAlerts && (
          <Badge variant="danger" size="sm">
            Alert
          </Badge>
        )}
      </div>

      <div className="flex gap-4 text-sm text-neutral-500 dark:text-neutral-400 mb-3">
        <span>{patient.labCount} labs</span>
        <span>{patient.conversationCount} conversations</span>
      </div>

      <div className="flex items-center justify-between text-xs text-neutral-400 dark:text-neutral-500">
        <span>Added {formatRelativeTime(patient.createdAt)}</span>
        <Badge variant={patient.status === 'active' ? 'success' : 'neutral'} size="sm">
          {patient.status}
        </Badge>
      </div>
    </div>
  )

  if (selectable) {
    return (
      <div onClick={() => onSelect?.(patient.id, !selected)}>
        {cardContent}
      </div>
    )
  }

  return (
    <Link href={`/patients/${patient.id}`}>
      {cardContent}
    </Link>
  )
}
