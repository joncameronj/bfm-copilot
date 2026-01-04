'use client'

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Select } from '@/components/ui/Select'
import { Textarea } from '@/components/ui/Textarea'
import { DatePicker } from '@/components/ui/DatePicker'
import { format } from 'date-fns'
import type { Protocol, CreateProtocolInput, ProtocolCategory } from '@/types/protocol'
import { CATEGORY_LABELS } from '@/types/protocol'

interface Patient {
  id: string
  firstName: string
  lastName: string
}

interface ProtocolFormProps {
  protocol?: Protocol
  onSubmit: (data: CreateProtocolInput) => Promise<void>
  onCancel: () => void
}

export function ProtocolForm({ protocol, onSubmit, onCancel }: ProtocolFormProps) {
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [patients, setPatients] = useState<Patient[]>([])
  const [loadingPatients, setLoadingPatients] = useState(true)

  const [formData, setFormData] = useState<CreateProtocolInput>({
    patientId: protocol?.patientId || undefined,
    title: protocol?.title || '',
    content: protocol?.content || '',
    category: protocol?.category || 'general',
    durationDays: protocol?.durationDays || undefined,
    startDate: protocol?.startDate || undefined,
    endDate: protocol?.endDate || undefined,
    notes: protocol?.notes || undefined,
  })

  // Fetch patients for dropdown
  useEffect(() => {
    const fetchPatients = async () => {
      try {
        const response = await fetch('/api/patients?status=active&limit=100')
        if (response.ok) {
          const { data } = await response.json()
          setPatients(data.map((p: { id: string; firstName: string; lastName: string }) => ({
            id: p.id,
            firstName: p.firstName,
            lastName: p.lastName,
          })))
        }
      } catch (error) {
        console.error('Failed to fetch patients:', error)
      } finally {
        setLoadingPatients(false)
      }
    }

    fetchPatients()
  }, [])

  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {}

    if (!formData.title.trim()) {
      newErrors.title = 'Title is required'
    }
    if (!formData.content.trim()) {
      newErrors.content = 'Content is required'
    }
    if (formData.startDate && formData.endDate) {
      if (new Date(formData.endDate) < new Date(formData.startDate)) {
        newErrors.endDate = 'End date must be after start date'
      }
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

  const handleChange = (field: keyof CreateProtocolInput, value: string | number | undefined) => {
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

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Title */}
      <Input
        label="Protocol Title *"
        value={formData.title}
        onChange={(e) => handleChange('title', e.target.value)}
        error={errors.title}
        placeholder="Enter protocol title"
      />

      {/* Patient and Category */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Select
          label="Patient"
          value={formData.patientId || ''}
          onChange={(e) => handleChange('patientId', e.target.value || undefined)}
          disabled={loadingPatients}
        >
          <option value="">No patient assigned</option>
          {patients.map((patient) => (
            <option key={patient.id} value={patient.id}>
              {patient.firstName} {patient.lastName}
            </option>
          ))}
        </Select>

        <Select
          label="Category"
          value={formData.category || 'general'}
          onChange={(e) => handleChange('category', e.target.value as ProtocolCategory)}
        >
          {(Object.keys(CATEGORY_LABELS) as ProtocolCategory[]).map((category) => (
            <option key={category} value={category}>
              {CATEGORY_LABELS[category]}
            </option>
          ))}
        </Select>
      </div>

      {/* Content */}
      <Textarea
        label="Protocol Content *"
        value={formData.content}
        onChange={(e) => handleChange('content', e.target.value)}
        error={errors.content}
        rows={8}
        placeholder="Enter the detailed protocol instructions, recommendations, and guidelines..."
      />

      {/* Duration and Dates */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Input
          label="Duration (days)"
          type="number"
          min={1}
          value={formData.durationDays?.toString() || ''}
          onChange={(e) => handleChange('durationDays', e.target.value ? parseInt(e.target.value) : undefined)}
          placeholder="e.g., 30"
        />

        <div>
          <label className="block text-sm font-medium text-neutral-700 mb-2">
            Start Date
          </label>
          <DatePicker
            value={formData.startDate ? new Date(formData.startDate) : null}
            onChange={(date) => handleChange('startDate', date ? format(date, 'yyyy-MM-dd') : undefined)}
            placeholder="Select start date"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-neutral-700 mb-2">
            End Date
          </label>
          <DatePicker
            value={formData.endDate ? new Date(formData.endDate) : null}
            onChange={(date) => handleChange('endDate', date ? format(date, 'yyyy-MM-dd') : undefined)}
            placeholder="Select end date"
          />
          {errors.endDate && (
            <p className="mt-1.5 text-sm text-red-500">{errors.endDate}</p>
          )}
        </div>
      </div>

      {/* Notes */}
      <Textarea
        label="Additional Notes"
        value={formData.notes || ''}
        onChange={(e) => handleChange('notes', e.target.value || undefined)}
        rows={3}
        placeholder="Any additional notes or context for this protocol..."
      />

      {/* Form Actions */}
      <div className="flex justify-end gap-3 pt-4">
        <Button type="button" variant="secondary" onClick={onCancel}>
          Cancel
        </Button>
        <Button type="submit" isLoading={isSubmitting}>
          {protocol ? 'Update Protocol' : 'Create Protocol'}
        </Button>
      </div>
    </form>
  )
}
