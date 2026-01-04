'use client'

import { useState, useEffect, useCallback } from 'react'
import type { PatientWithStats, PatientFilters } from '@/types/patient'

interface UsePatientsResult {
  patients: PatientWithStats[]
  isLoading: boolean
  error: Error | null
  refetch: () => void
}

export function usePatients(filters: PatientFilters): UsePatientsResult {
  const [patients, setPatients] = useState<PatientWithStats[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<Error | null>(null)

  const fetchPatients = useCallback(async () => {
    setIsLoading(true)
    setError(null)

    try {
      const params = new URLSearchParams()
      if (filters.search) params.set('search', filters.search)
      if (filters.status) params.set('status', filters.status)
      if (filters.sortBy) params.set('sortBy', filters.sortBy)
      if (filters.sortOrder) params.set('sortOrder', filters.sortOrder)
      if (filters.hasAlerts) params.set('hasAlerts', String(filters.hasAlerts))

      const response = await fetch(`/api/patients?${params}`)

      if (!response.ok) {
        throw new Error('Failed to fetch patients')
      }

      const { data } = await response.json()

      // Convert date strings to Date objects
      const patientsWithDates = data.map((p: PatientWithStats & { dateOfBirth: string; createdAt: string; updatedAt: string }) => ({
        ...p,
        dateOfBirth: new Date(p.dateOfBirth),
        createdAt: new Date(p.createdAt),
        updatedAt: new Date(p.updatedAt),
      }))

      setPatients(patientsWithDates)
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Unknown error'))
    } finally {
      setIsLoading(false)
    }
  }, [filters.search, filters.status, filters.sortBy, filters.sortOrder, filters.hasAlerts])

  useEffect(() => {
    fetchPatients()
  }, [fetchPatients])

  return {
    patients,
    isLoading,
    error,
    refetch: fetchPatients,
  }
}

// Hook for single patient
interface UsePatientResult {
  patient: PatientWithStats | null
  isLoading: boolean
  error: Error | null
  refetch: () => void
}

export function usePatient(patientId: string | null): UsePatientResult {
  const [patient, setPatient] = useState<PatientWithStats | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<Error | null>(null)

  const fetchPatient = useCallback(async () => {
    if (!patientId) {
      setPatient(null)
      setIsLoading(false)
      return
    }

    setIsLoading(true)
    setError(null)

    try {
      const response = await fetch(`/api/patients/${patientId}`)

      if (!response.ok) {
        if (response.status === 404) {
          throw new Error('Patient not found')
        }
        throw new Error('Failed to fetch patient')
      }

      const { data } = await response.json()

      setPatient({
        ...data,
        dateOfBirth: new Date(data.dateOfBirth),
        createdAt: new Date(data.createdAt),
        updatedAt: new Date(data.updatedAt),
      })
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Unknown error'))
    } finally {
      setIsLoading(false)
    }
  }, [patientId])

  useEffect(() => {
    fetchPatient()
  }, [fetchPatient])

  return {
    patient,
    isLoading,
    error,
    refetch: fetchPatient,
  }
}

// Hook for patient mutations
interface UsePatientMutationsResult {
  createPatient: (data: unknown) => Promise<PatientWithStats>
  updatePatient: (id: string, data: unknown) => Promise<PatientWithStats>
  deletePatient: (id: string) => Promise<void>
  isLoading: boolean
  error: Error | null
}

export function usePatientMutations(): UsePatientMutationsResult {
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<Error | null>(null)

  const createPatient = async (data: unknown): Promise<PatientWithStats> => {
    setIsLoading(true)
    setError(null)

    try {
      const response = await fetch('/api/patients', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Failed to create patient')
      }

      const { data: patient } = await response.json()
      return patient
    } catch (err) {
      const error = err instanceof Error ? err : new Error('Unknown error')
      setError(error)
      throw error
    } finally {
      setIsLoading(false)
    }
  }

  const updatePatient = async (id: string, data: unknown): Promise<PatientWithStats> => {
    setIsLoading(true)
    setError(null)

    try {
      const response = await fetch(`/api/patients/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Failed to update patient')
      }

      const { data: patient } = await response.json()
      return patient
    } catch (err) {
      const error = err instanceof Error ? err : new Error('Unknown error')
      setError(error)
      throw error
    } finally {
      setIsLoading(false)
    }
  }

  const deletePatient = async (id: string): Promise<void> => {
    setIsLoading(true)
    setError(null)

    try {
      const response = await fetch(`/api/patients/${id}`, {
        method: 'DELETE',
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Failed to delete patient')
      }
    } catch (err) {
      const error = err instanceof Error ? err : new Error('Unknown error')
      setError(error)
      throw error
    } finally {
      setIsLoading(false)
    }
  }

  return {
    createPatient,
    updatePatient,
    deletePatient,
    isLoading,
    error,
  }
}
