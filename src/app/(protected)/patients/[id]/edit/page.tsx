'use client'

import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import { toast } from 'react-hot-toast'
import { PatientForm } from '@/components/patients/PatientForm'
import { LoadingSpinner } from '@/components/ui/Spinner'
import { usePatient, usePatientMutations } from '@/hooks/usePatients'
import { use } from 'react'
import type { CreatePatientInput } from '@/types/patient'

interface EditPatientPageProps {
  params: Promise<{ id: string }>
}

export default function EditPatientPage({ params }: EditPatientPageProps) {
  const { id } = use(params)
  const router = useRouter()
  const { patient, isLoading, error } = usePatient(id)
  const { updatePatient } = usePatientMutations()

  const handleSubmit = async (data: CreatePatientInput) => {
    try {
      await updatePatient(id, data)
      toast.success('Patient updated successfully')
      router.push(`/patients/${id}`)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to update patient')
    }
  }

  const handleCancel = () => {
    router.back()
  }

  if (isLoading) {
    return <LoadingSpinner />
  }

  if (error || !patient) {
    return (
      <div className="p-6 max-w-3xl mx-auto">
        <div className="bg-red-50 rounded-2xl p-6 text-center">
          <p className="text-red-600">
            {error?.message || 'Patient not found'}
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="p-6 max-w-3xl mx-auto">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-4xl font-bold tracking-[-0.05em] text-neutral-900">
          Edit Patient
        </h1>
        <p className="text-neutral-500 mt-1">
          Update {patient.firstName} {patient.lastName}&apos;s information
        </p>
      </div>

      {/* Form */}
      <div className="bg-neutral-50 rounded-2xl p-6">
        <PatientForm
          patient={patient}
          onSubmit={handleSubmit}
          onCancel={handleCancel}
        />
      </div>
    </div>
  )
}
