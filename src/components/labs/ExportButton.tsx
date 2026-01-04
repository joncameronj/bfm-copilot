'use client';

import { useState } from 'react';
import toast from 'react-hot-toast';
import { Button } from '@/components/ui/Button';

interface ExportButtonProps {
  labResultId?: string;
  results?: {
    markerId: string;
    value: number;
    evaluation: string | null;
    deltaFromTarget: number | null;
  }[];
  patientName?: string;
  testDate?: string;
  ominousCount?: number;
  ominousMarkers?: string[];
  variant?: 'primary' | 'secondary';
  size?: 'sm' | 'md' | 'lg';
  className?: string;
  label?: string;
}

export function ExportButton({
  labResultId,
  results,
  patientName,
  testDate,
  ominousCount,
  ominousMarkers,
  variant = 'secondary',
  size = 'md',
  className,
  label = 'Export PDF',
}: ExportButtonProps) {
  const [isExporting, setIsExporting] = useState(false);

  const handleExport = async () => {
    if (!labResultId && (!results || results.length === 0)) {
      toast.error('No lab results to export');
      return;
    }

    setIsExporting(true);

    try {
      const response = await fetch('/api/labs/export-pdf', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          labResultId,
          results,
          patientName,
          testDate,
          ominousCount,
          ominousMarkers,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to generate PDF');
      }

      // Get the blob and download
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `lab-results-${testDate || new Date().toISOString().split('T')[0]}.pdf`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);

      toast.success('PDF downloaded successfully');
    } catch (error) {
      console.error('Export error:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to export PDF');
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <Button
      variant={variant}
      size={size}
      onClick={handleExport}
      isLoading={isExporting}
      className={className}
    >
      <svg
        className="w-4 h-4 mr-2"
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"
        />
      </svg>
      {label}
    </Button>
  );
}
