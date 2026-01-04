'use client'

import { useState, useEffect } from 'react'
import { Select } from '@/components/ui/Select'

interface Patient {
  id: string
  first_name: string
  last_name: string
}

interface PatientSelectProps {
  value?: string
  onChange: (patientId: string | undefined) => void
  placeholder?: string
  disabled?: boolean
}

export function PatientSelect({
  value,
  onChange,
  placeholder = 'Select a patient...',
  disabled = false,
}: PatientSelectProps) {
  const [patients, setPatients] = useState<Patient[]>([])
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    const fetchPatients = async () => {
      try {
        const response = await fetch('/api/patients?status=active&sortBy=name&sortOrder=asc')
        if (response.ok) {
          const { data } = await response.json()
          setPatients(data || [])
        }
      } catch (error) {
        console.error('Failed to fetch patients:', error)
      } finally {
        setIsLoading(false)
      }
    }

    fetchPatients()
  }, [])

  const handleChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const selectedValue = e.target.value
    onChange(selectedValue || undefined)
  }

  return (
    <Select
      value={value || ''}
      onChange={handleChange}
      disabled={disabled || isLoading}
    >
      <option value="">
        {isLoading ? 'Loading patients...' : placeholder}
      </option>
      {patients.map((patient) => (
        <option key={patient.id} value={patient.id}>
          {patient.first_name} {patient.last_name}
        </option>
      ))}
    </Select>
  )
}
