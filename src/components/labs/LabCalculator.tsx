'use client';

import { useState, useCallback, useEffect } from 'react';
import type {
  PatientContext,
  LabFormValues,
  LabCalculationResult,
} from '@/types/labs';
import type { Patient } from '@/types/patient';
import { LAB_CATEGORIES } from '@/lib/labs/categories';
import {
  calculateLabResults,
  getApplicableMarkersByCategory,
} from '@/lib/labs/calculator';
import { calculateAge } from '@/lib/utils';
import { Button } from '@/components/ui/Button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/Card';
import { CategorySection } from './CategorySection';
import { OminousAlert } from './OminousAlert';
import { PdfUpload } from './PdfUpload';
import { ExportButton } from './ExportButton';
import { HugeiconsIcon } from '@hugeicons/react';
import { RefreshIcon, FloppyDiskIcon, Tick02Icon, Alert01Icon } from '@hugeicons/core-free-icons';

export interface LabSaveOptions {
  isComplete?: boolean;
  missingMarkers?: string[];
  sourceType?: 'manual' | 'pdf_upload';
  extractionConfidence?: number;
}

interface LabCalculatorProps {
  onSave?: (_results: LabCalculationResult, _values: LabFormValues, _options?: LabSaveOptions) => Promise<void>;
  patientId?: string;
  patient?: Patient | null;
}

export function LabCalculator({ onSave, patientId: _patientId, patient }: LabCalculatorProps) {
  const [patientContext, setPatientContext] = useState<PatientContext>({
    gender: 'male',
    age: 45,
  });
  const [values, setValues] = useState<LabFormValues>({});
  const [results, setResults] = useState<LabCalculationResult | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [sourceType, setSourceType] = useState<'manual' | 'pdf_upload'>('manual');
  const [extractionConfidence, setExtractionConfidence] = useState<number | undefined>(undefined);

  // Sync patient data to patientContext when patient prop changes
  useEffect(() => {
    if (patient) {
      setPatientContext({
        gender: patient.gender === 'other' ? 'male' : patient.gender,
        age: calculateAge(patient.dateOfBirth),
        dateOfBirth: patient.dateOfBirth,
      });
    }
  }, [patient]);

  // Derive patient name for display/export
  const patientName = patient ? `${patient.firstName} ${patient.lastName}` : undefined;
  const isFromProfile = !!patient;

  // Get applicable markers for current patient context
  const markersByCategory = getApplicableMarkersByCategory(patientContext);

  // Handle value changes - calculate in real-time
  const handleValueChange = useCallback((markerId: string, value: number | null) => {
    setValues((prev) => {
      const newValues = {
        ...prev,
        [markerId]: value,
      };
      // Calculate results in real-time whenever a value changes
      const calculationResults = calculateLabResults(newValues, patientContext);
      setResults(calculationResults);
      return newValues;
    });
  }, [patientContext]);

  // Get all marker IDs that don't have values
  const getMissingMarkers = useCallback(() => {
    const allMarkerIds = Object.values(markersByCategory).flat().map((m) => m.id);
    return allMarkerIds.filter((id) => values[id] == null);
  }, [markersByCategory, values]);

  // Save results (complete)
  const handleSave = useCallback(async () => {
    if (!results || !onSave) return;
    setIsSaving(true);
    try {
      await onSave(results, values, {
        isComplete: true,
        missingMarkers: [],
        sourceType,
        extractionConfidence,
      });
    } finally {
      setIsSaving(false);
    }
  }, [results, values, onSave, sourceType, extractionConfidence]);

  // Save incomplete results
  const handleSaveIncomplete = useCallback(async () => {
    if (!results || !onSave) return;
    const missingMarkers = getMissingMarkers();
    setIsSaving(true);
    try {
      await onSave(results, values, {
        isComplete: false,
        missingMarkers,
        sourceType,
        extractionConfidence,
      });
    } finally {
      setIsSaving(false);
    }
  }, [results, values, onSave, getMissingMarkers, sourceType, extractionConfidence]);

  // Clear all values
  const handleClear = useCallback(() => {
    setValues({});
    setResults(null);
    setSourceType('manual');
    setExtractionConfidence(undefined);
  }, []);

  // Handle PDF-extracted values
  const handlePdfValues = useCallback((extractedValues: Record<string, number>, confidence?: number) => {
    setSourceType('pdf_upload');
    if (confidence !== undefined) {
      setExtractionConfidence(confidence);
    }
    setValues((prev) => {
      const newValues = {
        ...prev,
        ...extractedValues,
      };
      // Calculate results after PDF import
      const calculationResults = calculateLabResults(newValues, patientContext);
      setResults(calculationResults);
      return newValues;
    });
  }, [patientContext]);

  // Count filled values
  const filledCount = Object.values(values).filter((v) => v != null).length;
  const totalMarkers = Object.values(markersByCategory).flat().length;

  // Count status distributions
  const normalCount = results?.results.filter((r) => r.evaluation === 'normal').length || 0;
  const flaggedCount = results?.results.filter((r) => r.isFlagged).length || 0;

  return (
    <div className="w-full space-y-6">
      {/* Import Section - PROMINENT, FIRST */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Import Lab Results</CardTitle>
          <CardDescription>Upload PDF or image to automatically populate markers</CardDescription>
        </CardHeader>
        <CardContent>
          <PdfUpload onValuesExtracted={handlePdfValues} />
        </CardContent>
      </Card>

      {/* Ominous Alert - CRITICAL - Only when triggered */}
      {results?.hasOminousAlert && (
        <OminousAlert
          count={results.ominousCount}
          markers={results.ominousMarkersTriggered}
        />
      )}

      {/* Action Toolbar - ONLY WHEN DATA EXISTS */}
      {filledCount > 0 && (
        <div className="flex items-center justify-between p-4 bg-white dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-xl">
          <div className="flex items-center gap-3">
            <span className="text-sm text-neutral-600 dark:text-neutral-400">
              {filledCount} of {totalMarkers} markers entered
            </span>
            {results?.hasOminousAlert && (
              <span className="text-xs bg-red-100 text-red-700 px-2 py-1 rounded-full">
                {results.ominousCount} ominous
              </span>
            )}
          </div>

          <div className="flex gap-2 flex-wrap">
            <Button variant="ghost" onClick={handleClear}>
              <HugeiconsIcon icon={RefreshIcon} size={16} className="mr-2" />
              Clear
            </Button>
            <ExportButton
              results={results?.results.map((r) => ({
                markerId: r.markerId,
                value: r.value ?? 0,
                evaluation: r.evaluation,
                deltaFromTarget: r.delta,
              })) || []}
              patientName={patientName}
              patientContext={patientContext}
              testDate={new Date().toISOString().split('T')[0]}
              ominousCount={results?.ominousCount || 0}
              ominousMarkers={results?.ominousMarkersTriggered || []}
              variant="secondary"
            />
            {onSave && (
              <Button onClick={handleSave} isLoading={isSaving}>
                <HugeiconsIcon icon={FloppyDiskIcon} size={16} className="mr-2" />
                Save to Patient
              </Button>
            )}
          </div>
        </div>
      )}

      {/* Divider - Only when empty */}
      {filledCount === 0 && (
        <div className="flex items-center gap-4 my-2">
          <div className="flex-1 h-px bg-neutral-200 dark:bg-neutral-700" />
          <span className="text-sm text-neutral-500 uppercase tracking-wide font-medium">
            Or Enter Manually
          </span>
          <div className="flex-1 h-px bg-neutral-200 dark:bg-neutral-700" />
        </div>
      )}

      {/* Category Sections */}
      <div className="space-y-4">
        {LAB_CATEGORIES.map((category) => (
          <CategorySection
            key={category.id}
            category={category}
            markers={markersByCategory[category.id] || []}
            values={values}
            results={results?.categorizedResults[category.id]}
            onValueChange={handleValueChange}
            defaultExpanded={false}
          />
        ))}
      </div>

      {/* Analysis Summary - Only when data exists */}
      {filledCount > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Analysis Summary</CardTitle>
            <CardDescription>Overview of entered biomarkers and their status</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="flex items-center justify-between p-3 rounded-lg bg-green-50 border border-green-200">
                <div className="flex items-center gap-2">
                  <HugeiconsIcon icon={Tick02Icon} size={16} className="text-green-600" />
                  <span className="text-green-700 font-medium">Normal</span>
                </div>
                <div className="text-xl font-bold text-green-600">
                  {normalCount}
                </div>
              </div>

              <div className="flex items-center justify-between p-3 rounded-lg bg-red-50 border border-red-200">
                <div className="flex items-center gap-2">
                  <HugeiconsIcon icon={Alert01Icon} size={16} className="text-red-600" />
                  <span className="text-red-700 font-medium">Flagged</span>
                </div>
                <div className="text-xl font-bold text-red-600">
                  {flaggedCount}
                </div>
              </div>

              {results?.ominousCount !== undefined && results.ominousCount > 0 && (
                <div className="flex items-center justify-between p-3 rounded-lg bg-purple-50 border border-purple-200">
                  <div className="flex items-center gap-2">
                    <HugeiconsIcon icon={Alert01Icon} size={16} className="text-purple-600" />
                    <span className="text-purple-700 font-medium">Ominous</span>
                  </div>
                  <div className="text-xl font-bold text-purple-600">
                    {results.ominousCount}
                  </div>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
