'use client';

import { useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import toast from 'react-hot-toast';
import { LabCalculator, type LabSaveOptions } from '@/components/labs/LabCalculator';
import { PatientSearchSelector } from '@/components/shared/PatientSearchSelector';
import type { LabCalculationResult, LabFormValues } from '@/types/labs';

interface PatientJoin {
  first_name: string;
  last_name: string;
}

interface RecentResult {
  id: string;
  test_date: string;
  ominous_count: number;
  patients: PatientJoin | PatientJoin[] | null;
}

interface LabCalculatorClientProps {
  recentResults: RecentResult[];
}

export function LabCalculatorClient({
  recentResults,
}: LabCalculatorClientProps) {
  const router = useRouter();
  const [selectedPatientId, setSelectedPatientId] = useState<string | undefined>(undefined);

  // Helper to get patient name from result
  const getPatientName = (result: RecentResult): string => {
    if (!result.patients) return 'No patient';
    const patient = Array.isArray(result.patients) ? result.patients[0] : result.patients;
    return patient ? `${patient.first_name} ${patient.last_name}` : 'No patient';
  };

  const handleSave = useCallback(
    async (results: LabCalculationResult, values: LabFormValues, options?: LabSaveOptions) => {
      try {
        const response = await fetch('/api/labs/results', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            patientId: selectedPatientId,
            result: results,
            values,
            testDate: new Date().toISOString().split('T')[0],
            isComplete: options?.isComplete ?? true,
            missingMarkers: options?.missingMarkers ?? [],
            sourceType: options?.sourceType ?? 'manual',
            extractionConfidence: options?.extractionConfidence,
          }),
        });

        if (!response.ok) {
          throw new Error('Failed to save results');
        }

        const saveMessage = options?.isComplete === false
          ? 'Incomplete lab results saved'
          : 'Lab results saved successfully';
        toast.success(saveMessage);
        router.refresh();
      } catch (error) {
        toast.error('Failed to save lab results');
        throw error;
      }
    },
    [selectedPatientId, router]
  );

  return (
    <div className="w-full">
      {/* Header with patient selector and recent results */}
      <div className="flex flex-col lg:flex-row gap-6 mb-8">
        {/* Patient Selector */}
        <div className="lg:w-2/3">
          <div className="card-flat">
            <h2 className="text-lg font-medium mb-4">Patient</h2>
            <PatientSearchSelector
              value={selectedPatientId}
              onChange={setSelectedPatientId}
              placeholder="Search patients..."
            />
            {!selectedPatientId && (
              <p className="text-sm text-neutral-500 mt-3">
                Select a patient to link lab results (optional)
              </p>
            )}
          </div>
        </div>

        {/* Recent Results */}
        <div className="lg:w-1/3">
          <div className="card-flat h-full">
            <h2 className="text-lg font-medium mb-4">Recent Results</h2>
            {recentResults.length === 0 ? (
              <p className="text-neutral-500 text-sm">No recent lab results</p>
            ) : (
              <div className="space-y-2">
                {recentResults.map((result) => (
                  <button
                    key={result.id}
                    onClick={() => router.push(`/labs/${result.id}`)}
                    className="w-full text-left p-3 rounded-lg bg-neutral-100 hover:bg-neutral-200 transition-colors"
                  >
                    <div className="flex justify-between items-start">
                      <div>
                        <p className="text-sm font-medium">
                          {getPatientName(result)}
                        </p>
                        <p className="text-xs text-neutral-500">
                          {new Date(result.test_date).toLocaleDateString()}
                        </p>
                      </div>
                      {result.ominous_count > 0 && (
                        <span className="text-xs bg-red-100 text-red-800 px-2 py-0.5 rounded-full">
                          {result.ominous_count} ominous
                        </span>
                      )}
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Lab Calculator */}
      <LabCalculator
        onSave={handleSave}
        patientId={selectedPatientId}
      />
    </div>
  );
}
