'use client';

import { useState, useCallback, useMemo } from 'react';
import type {
  PatientContext,
  LabFormValues,
  LabCalculationResult,
  LabMarker,
  LabCategory,
} from '@/types/labs';
import { LAB_CATEGORIES } from '@/lib/labs/categories';
import {
  calculateLabResults,
  getApplicableMarkersByCategory,
} from '@/lib/labs/calculator';

interface UseLabCalculatorOptions {
  initialGender?: 'male' | 'female';
  initialAge?: number;
  patientId?: string;
}

interface UseLabCalculatorReturn {
  // Patient context
  patientContext: PatientContext;
  setPatientContext: (context: PatientContext) => void;

  // Marker values
  markerValues: LabFormValues;
  setMarkerValue: (markerId: string, value: number | null) => void;
  setMarkerValues: (values: LabFormValues) => void;
  clearMarkerValues: () => void;

  // Applicable markers for current context
  applicableMarkers: LabMarker[];
  markersByCategory: Record<LabCategory, LabMarker[]>;

  // Results
  results: LabCalculationResult | null;
  calculate: () => void;
  clearResults: () => void;

  // State
  isCalculating: boolean;
  hasChanges: boolean;
  filledCount: number;
  totalCount: number;
}

export function useLabCalculator(
  options: UseLabCalculatorOptions = {}
): UseLabCalculatorReturn {
  const { initialGender = 'male', initialAge = 45, patientId } = options;

  // Patient context state
  const [patientContext, setPatientContext] = useState<PatientContext>({
    gender: initialGender,
    age: initialAge,
  });

  // Marker values state
  const [markerValues, setMarkerValuesState] = useState<LabFormValues>({});

  // Results state
  const [results, setResults] = useState<LabCalculationResult | null>(null);

  // Loading state
  const [isCalculating, setIsCalculating] = useState(false);

  // Track if there are unsaved changes
  const [hasChanges, setHasChanges] = useState(false);

  // Compute applicable markers for current context
  const markersByCategory = useMemo(
    () => getApplicableMarkersByCategory(patientContext),
    [patientContext.gender, patientContext.age]
  );

  const applicableMarkers = useMemo(
    () => Object.values(markersByCategory).flat(),
    [markersByCategory]
  );

  // Count filled values
  const filledCount = useMemo(
    () => Object.values(markerValues).filter((v) => v != null).length,
    [markerValues]
  );

  const totalCount = applicableMarkers.length;

  // Set individual marker value
  const setMarkerValue = useCallback((markerId: string, value: number | null) => {
    setMarkerValuesState((prev) => ({
      ...prev,
      [markerId]: value,
    }));
    setHasChanges(true);
    // Clear results when values change
    setResults(null);
  }, []);

  // Set all marker values at once
  const setMarkerValues = useCallback((values: LabFormValues) => {
    setMarkerValuesState(values);
    setHasChanges(true);
    setResults(null);
  }, []);

  // Clear all marker values
  const clearMarkerValues = useCallback(() => {
    setMarkerValuesState({});
    setHasChanges(false);
    setResults(null);
  }, []);

  // Clear results
  const clearResults = useCallback(() => {
    setResults(null);
  }, []);

  // Calculate results
  const calculate = useCallback(() => {
    setIsCalculating(true);
    try {
      const calculationResults = calculateLabResults(markerValues, patientContext);
      setResults(calculationResults);
      setHasChanges(false);
    } finally {
      setIsCalculating(false);
    }
  }, [markerValues, patientContext]);

  // Update patient context (also clears results as ranges may change)
  const updatePatientContext = useCallback((context: PatientContext) => {
    setPatientContext(context);
    setResults(null);
    setHasChanges(true);
  }, []);

  return {
    patientContext,
    setPatientContext: updatePatientContext,
    markerValues,
    setMarkerValue,
    setMarkerValues,
    clearMarkerValues,
    applicableMarkers,
    markersByCategory,
    results,
    calculate,
    clearResults,
    isCalculating,
    hasChanges,
    filledCount,
    totalCount,
  };
}

// Hook for fetching and managing lab results history
export function useLabResults(patientId?: string) {
  const [results, setResults] = useState<LabCalculationResult[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchResults = useCallback(async () => {
    if (!patientId) return;

    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch(
        `/api/labs/results?patientId=${patientId}`
      );
      if (!response.ok) {
        throw new Error('Failed to fetch results');
      }
      const data = await response.json();
      setResults(data.results || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setIsLoading(false);
    }
  }, [patientId]);

  const saveResult = useCallback(
    async (result: LabCalculationResult, values: LabFormValues) => {
      setIsLoading(true);
      setError(null);

      try {
        const response = await fetch('/api/labs/results', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            patientId,
            result,
            values,
          }),
        });

        if (!response.ok) {
          throw new Error('Failed to save result');
        }

        const data = await response.json();
        return data;
      } catch (err) {
        setError(err instanceof Error ? err.message : 'An error occurred');
        throw err;
      } finally {
        setIsLoading(false);
      }
    },
    [patientId]
  );

  return {
    results,
    isLoading,
    error,
    fetchResults,
    saveResult,
  };
}
