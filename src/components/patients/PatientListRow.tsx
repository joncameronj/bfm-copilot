'use client'

import Link from 'next/link'
import { Badge } from '@/components/ui/Badge'
import { calculateAge, formatRelativeTime } from '@/lib/utils'
import type { PatientWithStats } from '@/types/patient'

interface PatientListRowProps {
  patient: PatientWithStats
}

export function PatientListRow({ patient }: PatientListRowProps) {
  const age = calculateAge(patient.dateOfBirth)
  const fullName = `${patient.firstName} ${patient.lastName}`

  return (
    <Link href={`/patients/${patient.id}`}>
      <div className="flex items-center gap-4 px-4 py-3 hover:bg-neutral-50 transition-colors cursor-pointer border-b border-neutral-100 last:border-b-0">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <h3 className="font-medium text-neutral-900 truncate">
              {fullName}
            </h3>
            {patient.hasOminousAlerts && (
              <Badge variant="danger" size="sm">
                Alert
              </Badge>
            )}
          </div>
          <p className="text-sm text-neutral-500 truncate">
            {patient.chiefComplaints || 'No chief complaints'}
          </p>
        </div>

        <div className="hidden sm:block text-sm text-neutral-500 w-24 text-center">
          {age} yrs
        </div>

        <div className="hidden md:block text-sm text-neutral-500 w-20 text-center">
          {patient.gender === 'male' ? 'Male' : patient.gender === 'female' ? 'Female' : 'Other'}
        </div>

        <div className="hidden lg:block text-sm text-neutral-500 w-16 text-center">
          {patient.labCount} labs
        </div>

        <div className="hidden lg:block text-sm text-neutral-500 w-32 text-center">
          {patient.conversationCount} conversations
        </div>

        <div className="hidden sm:block text-xs text-neutral-400 w-24 text-right">
          {formatRelativeTime(patient.createdAt)}
        </div>

        <div className="w-20 text-right">
          <Badge variant={patient.status === 'active' ? 'success' : 'neutral'} size="sm">
            {patient.status}
          </Badge>
        </div>
      </div>
    </Link>
  )
}
