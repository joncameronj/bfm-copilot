'use client';

import { useState, useCallback, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import toast from 'react-hot-toast';
import { LabCalculator, type LabSaveOptions } from '@/components/labs/LabCalculator';
import { PatientSelectorCompact } from '@/components/labs/PatientSelectorCompact';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/Tabs';
import type { LabCalculationResult, LabFormValues } from '@/types/labs';
import type { Patient } from '@/types/patient';

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

type TabId = 'import' | 'recent';

interface LabCalculatorClientProps {
  recentResults: RecentResult[];
}

export function LabCalculatorClient({
  recentResults,
}: LabCalculatorClientProps) {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<TabId>('import');
  const [selectedPatientId, setSelectedPatientId] = useState<string | undefined>(undefined);
  const [selectedPatient, setSelectedPatient] = useState<Patient | null>(null);

  // Fetch full patient data when selectedPatientId changes
  useEffect(() => {
    if (!selectedPatientId) {
      setSelectedPatient(null);
      return;
    }

    const fetchPatient = async () => {
      try {
        const response = await fetch(`/api/patients/${selectedPatientId}`);
        if (response.ok) {
          const { data } = await response.json();
          // Convert date strings to Date objects
          setSelectedPatient({
            ...data,
            dateOfBirth: new Date(data.dateOfBirth),
            lastVisitDate: data.lastVisitDate ? new Date(data.lastVisitDate) : undefined,
            createdAt: new Date(data.createdAt),
            updatedAt: new Date(data.updatedAt),
          });
        }
      } catch (error) {
        console.error('Failed to fetch patient:', error);
        setSelectedPatient(null);
      }
    };

    fetchPatient();
  }, [selectedPatientId]);

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
      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as TabId)} className="w-full">
        <TabsList className="mb-6 rounded-full bg-neutral-100 dark:bg-neutral-800 p-1">
          <TabsTrigger value="import" className="rounded-full">
            Import Labs
          </TabsTrigger>
          <TabsTrigger value="recent" className="rounded-full">
            Recent Results
          </TabsTrigger>
        </TabsList>

        <TabsContent value="import" className="space-y-6">
          <PatientSelectorCompact
            selectedPatient={selectedPatient}
            onPatientChange={setSelectedPatientId}
          />
          <LabCalculator
            onSave={handleSave}
            patientId={selectedPatientId}
            patient={selectedPatient}
          />
        </TabsContent>

        <TabsContent value="recent">
          <div className="card-flat">
            <h2 className="text-lg font-medium mb-4">Recent Results</h2>
            {recentResults.length === 0 ? (
              <p className="text-neutral-500 text-sm">No recent lab results</p>
            ) : (
              <div className="space-y-2">
                {recentResults.map((result) => (
                  <button
                    key={result.id}
                    onClick={() => router.push(`/labs/${result.id}`)}
                    className="w-full text-left p-3 rounded-lg bg-neutral-100 dark:bg-neutral-700 hover:bg-neutral-200 dark:hover:bg-neutral-600 transition-colors"
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
        </TabsContent>
      </Tabs>
    </div>
  );
}
