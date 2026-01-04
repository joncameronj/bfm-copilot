'use client'

import Link from 'next/link'
import { Badge } from '@/components/ui/Badge'
import { calculateAge, formatRelativeTime } from '@/lib/utils'
import type { PatientWithStats } from '@/types/patient'

interface PatientCardProps {
  patient: PatientWithStats
}

export function PatientCard({ patient }: PatientCardProps) {
  const age = calculateAge(patient.dateOfBirth)
  const fullName = `${patient.firstName} ${patient.lastName}`

  return (
    <Link href={`/patients/${patient.id}`}>
      <div className="bg-neutral-50 dark:bg-neutral-800 rounded-2xl p-6 hover:bg-neutral-100 dark:hover:bg-neutral-700 transition-colors cursor-pointer">
        <div className="flex items-start justify-between mb-4">
          <div>
            <h3 className="font-medium text-neutral-900 dark:text-neutral-50">
              {fullName}
            </h3>
            <p className="text-sm text-neutral-500 dark:text-neutral-400">
              {age} years old &bull; {patient.gender === 'male' ? 'Male' : patient.gender === 'female' ? 'Female' : 'Other'}
            </p>
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

        {patient.chiefComplaints && (
          <p className="text-sm text-neutral-600 dark:text-neutral-400 line-clamp-2 mb-3">
            {patient.chiefComplaints}
          </p>
        )}

        <div className="flex items-center justify-between text-xs text-neutral-400 dark:text-neutral-500">
          <span>Added {formatRelativeTime(patient.createdAt)}</span>
          <Badge variant={patient.status === 'active' ? 'success' : 'neutral'} size="sm">
            {patient.status}
          </Badge>
        </div>
      </div>
    </Link>
  )
}
