'use client'

import { useRouter } from 'next/navigation'
import { toast } from 'react-hot-toast'
import { PatientForm } from '@/components/patients/PatientForm'
import { usePatientMutations } from '@/hooks/usePatients'
import type { CreatePatientInput } from '@/types/patient'

export default function NewPatientPage() {
  const router = useRouter()
  const { createPatient } = usePatientMutations()

  const handleSubmit = async (data: CreatePatientInput) => {
    try {
      const patient = await createPatient(data)
      toast.success('Patient created successfully')
      router.push(`/patients/${patient.id}`)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to create patient')
    }
  }

  const handleCancel = () => {
    router.back()
  }

  return (
    <div className="p-6 max-w-3xl mx-auto">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-4xl font-bold tracking-[-0.05em] text-neutral-900">New Patient</h1>
        <p className="text-neutral-500 mt-1">Add a new patient to your practice</p>
      </div>

      {/* Form */}
      <div className="bg-neutral-50 rounded-2xl p-6">
        <PatientForm onSubmit={handleSubmit} onCancel={handleCancel} />
      </div>
    </div>
  )
}
