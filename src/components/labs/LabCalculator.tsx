'use client';

import { useState, useCallback } from 'react';
import type {
  PatientContext,
  LabFormValues,
  LabCalculationResult,
} from '@/types/labs';
import { LAB_CATEGORIES } from '@/lib/labs/categories';
import {
  calculateLabResults,
  getApplicableMarkersByCategory,
} from '@/lib/labs/calculator';
import { Button } from '@/components/ui/Button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/Card';
import { PatientInfoForm } from './PatientInfoForm';
import { CategorySection } from './CategorySection';
import { OminousAlert } from './OminousAlert';
import { PdfUpload } from './PdfUpload';
import { ExportButton } from './ExportButton';
import { HugeiconsIcon } from '@hugeicons/react';
import { CalculatorIcon, RefreshIcon, FloppyDiskIcon, Tick02Icon, Alert01Icon } from '@hugeicons/core-free-icons';

export interface LabSaveOptions {
  isComplete?: boolean;
  missingMarkers?: string[];
  sourceType?: 'manual' | 'pdf_upload';
  extractionConfidence?: number;
}

interface LabCalculatorProps {
  onSave?: (_results: LabCalculationResult, _values: LabFormValues, _options?: LabSaveOptions) => Promise<void>;
  patientId?: string;
}

export function LabCalculator({ onSave, patientId: _patientId }: LabCalculatorProps) {
  const [patientContext, setPatientContext] = useState<PatientContext>({
    gender: 'male',
    age: 45,
  });
  const [values, setValues] = useState<LabFormValues>({});
  const [results, setResults] = useState<LabCalculationResult | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [sourceType, setSourceType] = useState<'manual' | 'pdf_upload'>('manual');
  const [extractionConfidence, setExtractionConfidence] = useState<number | undefined>(undefined);

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
      {/* Header Card */}
      <div className="bg-neutral-50 border border-neutral-200 rounded-2xl">
        <div className="p-6">
          <div className="flex items-center justify-between flex-wrap gap-4">
            <div className="flex items-center gap-3">
              <HugeiconsIcon icon={CalculatorIcon} size={32} className="text-neutral-700" />
              <div>
                <h2 className="text-xl font-semibold text-neutral-900">
                  Ready to crunch some numbers?
                </h2>
                <p className="text-neutral-600 text-sm">
                  Enter values to see optimal vs. reference ranges. Science-backed, precision-focused.
                </p>
              </div>
            </div>
            <div className="flex gap-2 flex-wrap">
              <Button
                variant="secondary"
                onClick={handleClear}
              >
                <HugeiconsIcon icon={RefreshIcon} size={16} className="mr-2" />
                Clear All
              </Button>
              {onSave && filledCount > 0 && filledCount < totalMarkers && (
                <Button
                  onClick={handleSaveIncomplete}
                  isLoading={isSaving}
                  variant="ghost"
                  className="text-amber-600 hover:text-amber-700 hover:bg-amber-50"
                >
                  <HugeiconsIcon icon={Alert01Icon} size={16} className="mr-2" />
                  Save Incomplete
                </Button>
              )}
              {onSave && (
                <Button
                  onClick={handleSave}
                  isLoading={isSaving}
                  variant="secondary"
                >
                  <HugeiconsIcon icon={FloppyDiskIcon} size={16} className="mr-2" />
                  {isSaving ? 'Saving...' : 'Save'}
                </Button>
              )}
              <ExportButton
                results={results?.results.map((r) => ({
                  markerId: r.markerId,
                  value: r.value ?? 0,
                  evaluation: r.evaluation,
                  deltaFromTarget: r.delta,
                })) || []}
                testDate={new Date().toISOString().split('T')[0]}
                ominousCount={results?.ominousCount || 0}
                ominousMarkers={results?.ominousMarkersTriggered || []}
                variant="secondary"
              />
            </div>
          </div>
        </div>
      </div>

      {/* Ominous Alert - CRITICAL */}
      {results?.hasOminousAlert && (
        <OminousAlert
          count={results.ominousCount}
          markers={results.ominousMarkersTriggered}
        />
      )}

      {/* PDF Upload & Patient Info */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Import from PDF</CardTitle>
          </CardHeader>
          <CardContent>
            <PdfUpload onValuesExtracted={handlePdfValues} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Patient Information</CardTitle>
            <CardDescription>
              {filledCount} of {totalMarkers} markers entered
            </CardDescription>
          </CardHeader>
          <CardContent>
            <PatientInfoForm
              context={patientContext}
              onChange={setPatientContext}
            />
          </CardContent>
        </Card>
      </div>

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
            defaultExpanded={category.order <= 2}
          />
        ))}
      </div>

      {/* Analysis Summary */}
      {filledCount > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Analysis Summary</CardTitle>
            <CardDescription>Overview of entered biomarkers and their status</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Status Distribution */}
              <div className="space-y-4">
                <h4 className="font-medium text-neutral-900">Status Distribution</h4>
                <div className="space-y-3">
                  <div className="flex items-center justify-between p-3 rounded-lg bg-green-50 border border-green-200">
                    <div className="flex items-center gap-2">
                      <HugeiconsIcon icon={Tick02Icon} size={16} className="text-green-600" />
                      <span className="text-green-700 font-medium">Normal Range</span>
                    </div>
                    <div className="text-xl font-bold text-green-600">
                      {normalCount}
                    </div>
                  </div>

                  <div className="flex items-center justify-between p-3 rounded-lg bg-red-50 border border-red-200">
                    <div className="flex items-center gap-2">
                      <HugeiconsIcon icon={Alert01Icon} size={16} className="text-red-600" />
                      <span className="text-red-700 font-medium">Needs Attention</span>
                    </div>
                    <div className="text-xl font-bold text-red-600">
                      {flaggedCount}
                    </div>
                  </div>

                  {results?.ominousCount !== undefined && results.ominousCount > 0 && (
                    <div className="flex items-center justify-between p-3 rounded-lg bg-purple-50 border border-purple-200">
                      <div className="flex items-center gap-2">
                        <HugeiconsIcon icon={Alert01Icon} size={16} className="text-purple-600" />
                        <span className="text-purple-700 font-medium">Ominous Markers</span>
                      </div>
                      <div className="text-xl font-bold text-purple-600">
                        {results.ominousCount}
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Quick Actions */}
              <div className="space-y-4">
                <h4 className="font-medium text-neutral-900">Quick Actions</h4>
                <div className="space-y-2">
                  <Button variant="secondary" className="w-full justify-start">
                    <HugeiconsIcon icon={CalculatorIcon} size={16} className="mr-2" />
                    Generate Protocol
                  </Button>
                  <ExportButton
                    results={results?.results.map((r) => ({
                      markerId: r.markerId,
                      value: r.value ?? 0,
                      evaluation: r.evaluation,
                      deltaFromTarget: r.delta,
                    })) || []}
                    testDate={new Date().toISOString().split('T')[0]}
                    ominousCount={results?.ominousCount || 0}
                    ominousMarkers={results?.ominousMarkersTriggered || []}
                    variant="secondary"
                    className="w-full justify-start"
                    label="Export Results (PDF)"
                  />
                  {onSave && (
                    <Button
                      variant="secondary"
                      className="w-full justify-start"
                      onClick={handleSave}
                      isLoading={isSaving}
                    >
                      <HugeiconsIcon icon={FloppyDiskIcon} size={16} className="mr-2" />
                      Save to Patient File
                    </Button>
                  )}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
