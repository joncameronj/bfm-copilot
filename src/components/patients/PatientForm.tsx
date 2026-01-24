'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Select } from '@/components/ui/Select'
import { Textarea } from '@/components/ui/Textarea'
import { DatePicker } from '@/components/ui/DatePicker'
import { HugeiconsIcon } from '@hugeicons/react'
import { Add01Icon } from '@hugeicons/core-free-icons'
import { format } from 'date-fns'
import type { Patient, CreatePatientInput } from '@/types/patient'

interface PatientFormProps {
  patient?: Patient
  onSubmit: (_data: CreatePatientInput) => Promise<void>
  onCancel: () => void
}

export function PatientForm({ patient, onSubmit, onCancel }: PatientFormProps) {
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [medicationInput, setMedicationInput] = useState('')
  const [allergyInput, setAllergyInput] = useState('')
  const [formData, setFormData] = useState<CreatePatientInput>({
    firstName: patient?.firstName || '',
    lastName: patient?.lastName || '',
    dateOfBirth: patient?.dateOfBirth
      ? new Date(patient.dateOfBirth).toISOString().split('T')[0]
      : '',
    gender: patient?.gender || 'male',
    email: patient?.email || '',
    phone: patient?.phone || '',
    chiefComplaints: patient?.chiefComplaints || '',
    medicalHistory: patient?.medicalHistory || '',
    currentMedications: patient?.currentMedications || [],
    allergies: patient?.allergies || [],
  })

  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {}

    if (!formData.firstName.trim()) {
      newErrors.firstName = 'First name is required'
    }
    if (!formData.lastName.trim()) {
      newErrors.lastName = 'Last name is required'
    }
    if (!formData.dateOfBirth) {
      newErrors.dateOfBirth = 'Date of birth is required'
    }
    if (formData.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
      newErrors.email = 'Invalid email address'
    }

    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!validateForm()) return

    setIsSubmitting(true)
    try {
      await onSubmit(formData)
    } catch (error) {
      console.error('Form submission error:', error)
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleChange = (field: keyof CreatePatientInput, value: string | string[]) => {
    setFormData((prev) => ({ ...prev, [field]: value }))
    // Clear error when field is edited
    if (errors[field]) {
      setErrors((prev) => {
        const newErrors = { ...prev }
        delete newErrors[field]
        return newErrors
      })
    }
  }

  const addMedication = () => {
    if (medicationInput.trim()) {
      setFormData((prev) => ({
        ...prev,
        currentMedications: [...(prev.currentMedications || []), medicationInput.trim()],
      }))
      setMedicationInput('')
    }
  }

  const removeMedication = (index: number) => {
    setFormData((prev) => ({
      ...prev,
      currentMedications: (prev.currentMedications || []).filter((_, i) => i !== index),
    }))
  }

  const addAllergy = () => {
    if (allergyInput.trim()) {
      setFormData((prev) => ({
        ...prev,
        allergies: [...(prev.allergies || []), allergyInput.trim()],
      }))
      setAllergyInput('')
    }
  }

  const removeAllergy = (index: number) => {
    setFormData((prev) => ({
      ...prev,
      allergies: (prev.allergies || []).filter((_, i) => i !== index),
    }))
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Name Fields */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Input
          label="First Name *"
          value={formData.firstName}
          onChange={(e) => handleChange('firstName', e.target.value)}
          error={errors.firstName}
          placeholder="Enter first name"
        />
        <Input
          label="Last Name *"
          value={formData.lastName}
          onChange={(e) => handleChange('lastName', e.target.value)}
          error={errors.lastName}
          placeholder="Enter last name"
        />
      </div>

      {/* DOB and Gender */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-neutral-700 mb-2">
            Date of Birth *
          </label>
          <DatePicker
            value={formData.dateOfBirth ? new Date(formData.dateOfBirth) : null}
            onChange={(date) => handleChange('dateOfBirth', date ? format(date, 'yyyy-MM-dd') : '')}
            placeholder="Select date of birth"
            maxDate={new Date()}
          />
          {errors.dateOfBirth && (
            <p className="mt-1.5 text-sm text-red-500">{errors.dateOfBirth}</p>
          )}
        </div>
        <Select
          label="Gender *"
          value={formData.gender}
          onChange={(e) => handleChange('gender', e.target.value)}
        >
          <option value="male">Male</option>
          <option value="female">Female</option>
          <option value="other">Other</option>
        </Select>
      </div>

      {/* Contact Information */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Input
          label="Email"
          type="email"
          value={formData.email || ''}
          onChange={(e) => handleChange('email', e.target.value)}
          error={errors.email}
          placeholder="patient@example.com"
        />
        <Input
          label="Phone"
          type="tel"
          value={formData.phone || ''}
          onChange={(e) => handleChange('phone', e.target.value)}
          placeholder="+1 (555) 123-4567"
        />
      </div>

      {/* Chief Complaints */}
      <Textarea
        label="Chief Complaints"
        value={formData.chiefComplaints || ''}
        onChange={(e) => handleChange('chiefComplaints', e.target.value)}
        rows={3}
        placeholder="Primary health concerns and symptoms..."
      />

      {/* Medical History */}
      <Textarea
        label="Medical History"
        value={formData.medicalHistory || ''}
        onChange={(e) => handleChange('medicalHistory', e.target.value)}
        rows={4}
        placeholder="Previous conditions, surgeries, family history..."
      />

      {/* Current Medications */}
      <div>
        <label className="block text-sm font-medium text-neutral-700 mb-2">
          Current Medications
        </label>
        {(formData.currentMedications || []).length > 0 && (
          <div className="mb-3 p-3 bg-neutral-50 rounded-lg border border-neutral-200 space-y-2">
            {(formData.currentMedications || []).map((med, index) => (
              <div key={index} className="flex items-center justify-between bg-white px-3 py-2 rounded border border-neutral-200">
                <span className="text-sm text-neutral-700">{med}</span>
                <button
                  type="button"
                  onClick={() => removeMedication(index)}
                  className="text-xs text-red-600 hover:text-red-700 font-medium"
                >
                  Remove
                </button>
              </div>
            ))}
          </div>
        )}
        <div className="space-y-2">
          <Input
            className="w-full"
            value={medicationInput}
            onChange={(e) => setMedicationInput(e.target.value)}
            onKeyPress={(e) => e.key === 'Enter' && addMedication()}
            placeholder="Enter medication name"
          />
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="flex items-center"
            onClick={addMedication}
          >
            <HugeiconsIcon icon={Add01Icon} size={16} className="mr-1.5" />
            Add Medication
          </Button>
        </div>
      </div>

      {/* Allergies */}
      <div>
        <label className="block text-sm font-medium text-neutral-700 mb-2">
          Allergies
        </label>
        {(formData.allergies || []).length > 0 && (
          <div className="mb-3 p-3 bg-neutral-50 rounded-lg border border-neutral-200 space-y-2">
            {(formData.allergies || []).map((allergy, index) => (
              <div key={index} className="flex items-center justify-between bg-white px-3 py-2 rounded border border-neutral-200">
                <span className="text-sm text-neutral-700">{allergy}</span>
                <button
                  type="button"
                  onClick={() => removeAllergy(index)}
                  className="text-xs text-red-600 hover:text-red-700 font-medium"
                >
                  Remove
                </button>
              </div>
            ))}
          </div>
        )}
        <div className="space-y-2">
          <Input
            className="w-full"
            value={allergyInput}
            onChange={(e) => setAllergyInput(e.target.value)}
            onKeyPress={(e) => e.key === 'Enter' && addAllergy()}
            placeholder="Enter allergy"
          />
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="flex items-center"
            onClick={addAllergy}
          >
            <HugeiconsIcon icon={Add01Icon} size={16} className="mr-1.5" />
            Add Allergy
          </Button>
        </div>
      </div>

      {/* Form Actions */}
      <div className="flex justify-end gap-3 pt-4">
        <Button type="button" variant="danger" onClick={onCancel}>
          Cancel
        </Button>
        <Button type="submit" isLoading={isSubmitting}>
          {patient ? 'Update Patient' : 'Create Patient'}
        </Button>
      </div>
    </form>
  )
}
