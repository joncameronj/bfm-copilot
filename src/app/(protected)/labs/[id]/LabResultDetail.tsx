'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import toast from 'react-hot-toast';
import { Button } from '@/components/ui/Button';
import { OminousAlert } from '@/components/labs/OminousAlert';
import { ExportButton } from '@/components/labs/ExportButton';
import { LAB_CATEGORIES } from '@/lib/labs/categories';
import { labMarkers } from '@/data/lab-data';
import { calculateAge, formatDate } from '@/lib/utils';
import { cn } from '@/lib/utils';

interface LabValue {
  id: string;
  marker_id: string;
  value: number;
  evaluation: string | null;
  delta_from_target: number | null;
  weakness_text: string | null;
  is_ominous: boolean;
}

interface Patient {
  id: string;
  first_name: string;
  last_name: string;
  date_of_birth: string;
  gender: 'male' | 'female' | 'other';
}

interface LabResult {
  id: string;
  test_date: string;
  ominous_count: number;
  ominous_markers_triggered: string[];
  notes: string | null;
  lab_values: LabValue[];
  patients: Patient | Patient[] | null;
}

interface LabResultDetailProps {
  labResult: LabResult;
}

export function LabResultDetail({ labResult }: LabResultDetailProps) {
  const router = useRouter();
  const [isDeleting, setIsDeleting] = useState(false);

  // Get patient info
  const patient = Array.isArray(labResult.patients)
    ? labResult.patients[0]
    : labResult.patients;

  // Group values by category
  const valuesByCategory = LAB_CATEGORIES.map((category) => {
    const categoryMarkers = labMarkers.filter((m) => m.category === category.id);
    const values = labResult.lab_values.filter((v) =>
      categoryMarkers.some((m) => m.id === v.marker_id)
    );
    return {
      category,
      values: values.map((v) => ({
        ...v,
        marker: categoryMarkers.find((m) => m.id === v.marker_id),
      })),
    };
  }).filter((c) => c.values.length > 0);

  // Count stats
  const totalMarkers = labResult.lab_values.length;
  const flaggedCount = labResult.lab_values.filter(
    (v) => v.evaluation && v.evaluation !== 'normal'
  ).length;
  const normalCount = labResult.lab_values.filter(
    (v) => v.evaluation === 'normal'
  ).length;

  const handleDelete = async () => {
    if (!confirm('Are you sure you want to delete this lab result?')) return;

    setIsDeleting(true);
    try {
      const response = await fetch(`/api/labs/results/${labResult.id}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        throw new Error('Failed to delete');
      }

      toast.success('Lab result deleted');
      router.push('/labs');
    } catch (error) {
      toast.error('Failed to delete lab result');
    } finally {
      setIsDeleting(false);
    }
  };

  const getEvaluationStyle = (evaluation: string | null) => {
    switch (evaluation) {
      case 'low':
        return { bg: 'bg-blue-50', text: 'text-blue-800', badge: 'bg-blue-100 text-blue-800' };
      case 'normal':
        return { bg: 'bg-green-50', text: 'text-green-800', badge: 'bg-green-100 text-green-800' };
      case 'moderate':
        return { bg: 'bg-yellow-50', text: 'text-yellow-800', badge: 'bg-yellow-100 text-yellow-800' };
      case 'high':
        return { bg: 'bg-red-50', text: 'text-red-800', badge: 'bg-red-100 text-red-800' };
      default:
        return { bg: 'bg-neutral-50', text: 'text-neutral-600', badge: 'bg-neutral-100 text-neutral-600' };
    }
  };

  return (
    <div className="max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-4">
          <Link
            href="/labs"
            className="text-neutral-500 hover:text-neutral-900 transition-colors"
          >
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </Link>
          <div>
            <h1 className="text-4xl font-bold tracking-[-0.05em]">Lab Results</h1>
            <p className="text-neutral-500">
              {formatDate(labResult.test_date)}
              {patient && ` • ${patient.first_name} ${patient.last_name}`}
            </p>
          </div>
        </div>
        <div className="flex gap-3">
          <ExportButton
            labResultId={labResult.id}
            patientName={patient ? `${patient.first_name} ${patient.last_name}` : undefined}
            testDate={labResult.test_date}
            ominousCount={labResult.ominous_count}
            ominousMarkers={labResult.ominous_markers_triggered}
            variant="secondary"
          />
          <Button variant="secondary" onClick={() => window.print()}>
            Print
          </Button>
          <Button
            variant="danger"
            onClick={handleDelete}
            isLoading={isDeleting}
          >
            Delete
          </Button>
        </div>
      </div>

      {/* Ominous Alert */}
      {labResult.ominous_count >= 3 && (
        <OminousAlert
          count={labResult.ominous_count}
          markers={labResult.ominous_markers_triggered || []}
        />
      )}

      {/* Patient & Summary Card */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
        {/* Patient Info */}
        {patient && (
          <div className="card-flat">
            <h2 className="text-lg font-medium mb-4">Patient Information</h2>
            <div className="space-y-2">
              <p>
                <span className="text-neutral-500">Name:</span>{' '}
                <span className="font-medium">{patient.first_name} {patient.last_name}</span>
              </p>
              <p>
                <span className="text-neutral-500">Age:</span>{' '}
                <span className="font-medium">{calculateAge(new Date(patient.date_of_birth))} years</span>
              </p>
              <p>
                <span className="text-neutral-500">Gender:</span>{' '}
                <span className="font-medium capitalize">{patient.gender}</span>
              </p>
            </div>
          </div>
        )}

        {/* Summary Stats */}
        <div className="card-flat">
          <h2 className="text-lg font-medium mb-4">Summary</h2>
          <div className="grid grid-cols-3 gap-4">
            <div className="text-center p-3 bg-neutral-100 rounded-xl">
              <p className="text-2xl font-semibold">{totalMarkers}</p>
              <p className="text-sm text-neutral-500">Total</p>
            </div>
            <div className="text-center p-3 bg-green-50 rounded-xl">
              <p className="text-2xl font-semibold text-green-900">{normalCount}</p>
              <p className="text-sm text-green-700">Normal</p>
            </div>
            <div className="text-center p-3 bg-yellow-50 rounded-xl">
              <p className="text-2xl font-semibold text-yellow-900">{flaggedCount}</p>
              <p className="text-sm text-yellow-700">Flagged</p>
            </div>
          </div>
          {labResult.ominous_count > 0 && (
            <div className="mt-4 p-3 bg-red-50 rounded-xl text-center">
              <p className="text-lg font-semibold text-red-900">
                {labResult.ominous_count} Ominous Markers
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Notes */}
      {labResult.notes && (
        <div className="card-flat mb-6">
          <h2 className="text-lg font-medium mb-2">Notes</h2>
          <p className="text-neutral-600">{labResult.notes}</p>
        </div>
      )}

      {/* Results by Category */}
      <div className="space-y-6">
        {valuesByCategory.map(({ category, values }) => (
          <div key={category.id} className="card-flat">
            <h2 className="text-lg font-medium mb-4">{category.name}</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {values.map((value) => {
                const style = getEvaluationStyle(value.evaluation);
                return (
                  <div
                    key={value.id}
                    className={cn('rounded-xl p-4', style.bg)}
                  >
                    <div className="flex justify-between items-start mb-2">
                      <div>
                        <p className="font-medium text-neutral-900">
                          {value.marker?.displayName || value.marker_id}
                          {value.is_ominous && (
                            <span className="ml-2 text-xs text-red-600">(Ominous)</span>
                          )}
                        </p>
                        <p className="text-sm text-neutral-500">
                          Target: {value.marker?.targetRange}
                        </p>
                      </div>
                      {value.evaluation && (
                        <span className={cn('text-xs font-medium px-2 py-1 rounded-full capitalize', style.badge)}>
                          {value.evaluation}
                        </span>
                      )}
                    </div>
                    <p className="text-lg font-semibold text-neutral-900">
                      {value.value} {value.marker?.unit}
                    </p>
                    {value.delta_from_target !== null && (
                      <p className="text-sm text-neutral-500 mt-1">
                        Delta: {value.delta_from_target > 0 ? '+' : ''}{value.delta_from_target}
                      </p>
                    )}
                    {value.weakness_text && (
                      <details className="mt-2">
                        <summary className="text-sm text-neutral-600 cursor-pointer">
                          View details
                        </summary>
                        <p className="text-sm text-neutral-700 mt-2 p-2 bg-white/50 rounded-lg">
                          {value.weakness_text}
                        </p>
                      </details>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
