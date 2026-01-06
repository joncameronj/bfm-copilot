'use client';

import type { PatientContext } from '@/types/labs';
import { cn } from '@/lib/utils';
import { DatePicker } from '@/components/ui/DatePicker';
import { HugeiconsIcon } from '@hugeicons/react';
import { LockedIcon } from '@hugeicons/core-free-icons';

interface PatientInfoFormProps {
  context: PatientContext;
  onChange: (_context: PatientContext) => void;
  isFromProfile?: boolean;
}

export function PatientInfoForm({ context, onChange, isFromProfile = false }: PatientInfoFormProps) {
  const handleGenderChange = (gender: 'male' | 'female') => {
    if (isFromProfile) return;
    onChange({ ...context, gender });
  };

  const handleAgeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (isFromProfile) return;
    const age = parseInt(e.target.value, 10);
    if (!isNaN(age) && age >= 0 && age <= 150) {
      onChange({ ...context, age });
    }
  };

  const handleDateOfBirthChange = (date: Date | null) => {
    if (isFromProfile) return;
    if (date) {
      const today = new Date();
      let age = today.getFullYear() - date.getFullYear();
      const monthDiff = today.getMonth() - date.getMonth();
      if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < date.getDate())) {
        age--;
      }
      onChange({ ...context, age, dateOfBirth: date });
    } else {
      onChange({ ...context, dateOfBirth: undefined });
    }
  };

  return (
    <div className="space-y-4">
      {/* Profile indicator */}
      {isFromProfile && (
        <div className="flex items-center gap-2 text-xs text-neutral-500 pb-2 border-b border-neutral-100">
          <HugeiconsIcon icon={LockedIcon} size={12} />
          <span>Populated from patient profile</span>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Gender Selection */}
        <div>
          <label className="block text-sm font-medium text-neutral-700 mb-2">
            Gender *
          </label>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => handleGenderChange('male')}
              disabled={isFromProfile}
              className={cn(
                'flex-1 py-3 px-4 rounded-xl font-medium transition-colors',
                context.gender === 'male'
                  ? 'bg-black text-white'
                  : 'bg-neutral-100 text-neutral-600 hover:bg-neutral-200',
                isFromProfile && 'opacity-60 cursor-not-allowed hover:bg-neutral-100'
              )}
            >
              Male
            </button>
            <button
              type="button"
              onClick={() => handleGenderChange('female')}
              disabled={isFromProfile}
              className={cn(
                'flex-1 py-3 px-4 rounded-xl font-medium transition-colors',
                context.gender === 'female'
                  ? 'bg-black text-white'
                  : 'bg-neutral-100 text-neutral-600 hover:bg-neutral-200',
                isFromProfile && 'opacity-60 cursor-not-allowed hover:bg-neutral-100'
              )}
            >
              Female
            </button>
          </div>
        </div>

        {/* Age Input */}
        <div>
          <label className="block text-sm font-medium text-neutral-700 mb-2">
            Age *
          </label>
          <input
            type="number"
            min="0"
            max="150"
            value={context.age}
            onChange={handleAgeChange}
            disabled={isFromProfile}
            className={cn(
              'input-field',
              isFromProfile && 'opacity-60 cursor-not-allowed bg-neutral-100'
            )}
            placeholder="Enter age"
          />
        </div>

        {/* Date of Birth */}
        <div>
          <label className="block text-sm font-medium text-neutral-700 mb-2">
            Date of Birth
          </label>
          <DatePicker
            value={context.dateOfBirth ? new Date(context.dateOfBirth) : null}
            onChange={handleDateOfBirthChange}
            placeholder="Select date"
            maxDate={new Date()}
            disabled={isFromProfile}
          />
        </div>
      </div>
    </div>
  );
}

// Compact display for showing patient info
export function PatientInfoDisplay({ context }: { context: PatientContext }) {
  return (
    <div className="flex gap-4 text-sm text-neutral-600">
      <span className="capitalize">
        <strong>Gender:</strong> {context.gender}
      </span>
      <span>
        <strong>Age:</strong> {context.age} years
      </span>
    </div>
  );
}
