'use client';

import { useState } from 'react';
import { PatientSearchSelector } from '@/components/shared/PatientSearchSelector';
import { HugeiconsIcon } from '@hugeicons/react';
import { UserIcon, Cancel01Icon, ArrowDown01Icon, ArrowUp01Icon } from '@hugeicons/core-free-icons';
import type { Patient } from '@/types/patient';
import { calculateAge } from '@/lib/utils';

interface PatientSelectorCompactProps {
  selectedPatient: Patient | null;
  onPatientChange: (patientId: string | undefined) => void;
}

/**
 * Compact patient selector with three states:
 * 1. Collapsed (default when no patient): Shows "Patient (Optional) [Expand]" button
 * 2. Expanded (searching): Shows full PatientSearchSelector with collapse button
 * 3. Selected (patient chosen): Shows patient card with name, age, gender, and clear button
 */
export function PatientSelectorCompact({
  selectedPatient,
  onPatientChange,
}: PatientSelectorCompactProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  // Selected state - show patient card
  if (selectedPatient) {
    return (
      <div className="card-flat">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center">
              <HugeiconsIcon icon={UserIcon} size={20} className="text-blue-600" />
            </div>
            <div>
              <p className="font-medium text-neutral-900 dark:text-neutral-50">
                {selectedPatient.firstName} {selectedPatient.lastName}
              </p>
              <p className="text-sm text-neutral-500">
                {calculateAge(selectedPatient.dateOfBirth)} years • {selectedPatient.gender}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => onPatientChange(undefined)}
            className="text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-300 p-2 rounded-lg hover:bg-neutral-100 dark:hover:bg-neutral-700 transition-colors"
            title="Clear patient selection"
          >
            <HugeiconsIcon icon={Cancel01Icon} size={20} />
          </button>
        </div>
      </div>
    );
  }

  // Expanded state - show search
  if (isExpanded) {
    return (
      <div className="card-flat">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-medium text-neutral-900 dark:text-neutral-50">Select Patient</h3>
          <button
            type="button"
            onClick={() => setIsExpanded(false)}
            className="text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-300 p-1.5 rounded-lg hover:bg-neutral-100 dark:hover:bg-neutral-700 transition-colors"
            title="Collapse"
          >
            <HugeiconsIcon icon={ArrowUp01Icon} size={16} />
          </button>
        </div>
        <PatientSearchSelector
          value={undefined}
          onChange={(id) => {
            onPatientChange(id);
            if (id) setIsExpanded(false);
          }}
          placeholder="Search patients..."
        />
        <p className="text-sm text-neutral-500 mt-3">
          Optional - select a patient to link these lab results
        </p>
      </div>
    );
  }

  // Collapsed state - show expand button
  return (
    <div className="card-flat">
      <button
        type="button"
        onClick={() => setIsExpanded(true)}
        className="w-full flex items-center justify-between group"
      >
        <div className="flex items-center gap-2">
          <HugeiconsIcon
            icon={UserIcon}
            size={20}
            className="text-neutral-400 group-hover:text-neutral-600 dark:group-hover:text-neutral-300 transition-colors"
          />
          <span className="text-neutral-600 dark:text-neutral-400 group-hover:text-neutral-900 dark:group-hover:text-neutral-200 transition-colors">
            Patient (Optional)
          </span>
        </div>
        <HugeiconsIcon
          icon={ArrowDown01Icon}
          size={16}
          className="text-neutral-400 group-hover:text-neutral-600 dark:group-hover:text-neutral-300 transition-colors"
        />
      </button>
      <p className="text-xs text-neutral-400 mt-2">
        Click to select a patient for these lab results
      </p>
    </div>
  );
}
