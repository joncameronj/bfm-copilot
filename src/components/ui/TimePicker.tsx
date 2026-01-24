'use client';

import { useState, useRef, useEffect, useMemo } from 'react';
import { cn } from '@/lib/utils';
import { HugeiconsIcon } from '@hugeicons/react';
import { Clock01Icon } from '@hugeicons/core-free-icons';

interface TimePickerProps {
  value?: string | null; // "HH:mm" format (24-hour)
  onChange: (time: string | null) => void;
  placeholder?: string;
  className?: string;
  disabled?: boolean;
}

export function TimePicker({
  value,
  onChange,
  placeholder = 'Select time',
  className,
  disabled = false,
}: TimePickerProps) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Parse value into hour, minute, period
  const parsedTime = useMemo(() => {
    if (!value) return { hour: 12, minute: 0, period: 'AM' as 'AM' | 'PM' };

    const [hourStr, minuteStr] = value.split(':');
    let hour = parseInt(hourStr, 10);
    const minute = parseInt(minuteStr, 10);
    const period: 'AM' | 'PM' = hour >= 12 ? 'PM' : 'AM';

    // Convert to 12-hour format
    if (hour === 0) hour = 12;
    else if (hour > 12) hour = hour - 12;

    return { hour, minute, period };
  }, [value]);

  const [selectedHour, setSelectedHour] = useState(parsedTime.hour);
  const [selectedMinute, setSelectedMinute] = useState(parsedTime.minute);
  const [selectedPeriod, setSelectedPeriod] = useState<'AM' | 'PM'>(parsedTime.period);

  // Update local state when value changes
  useEffect(() => {
    setSelectedHour(parsedTime.hour);
    setSelectedMinute(parsedTime.minute);
    setSelectedPeriod(parsedTime.period);
  }, [parsedTime]);

  // Close on click outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const hours = useMemo(() => Array.from({ length: 12 }, (_, i) => i + 1), []);
  const minutes = useMemo(() => Array.from({ length: 60 }, (_, i) => i), []);

  const formatDisplayTime = () => {
    if (!value) return null;
    const hourDisplay = selectedHour.toString();
    const minuteDisplay = selectedMinute.toString().padStart(2, '0');
    return `${hourDisplay}:${minuteDisplay} ${selectedPeriod}`;
  };

  const handleConfirm = () => {
    // Convert to 24-hour format
    let hour24 = selectedHour;
    if (selectedPeriod === 'AM') {
      if (hour24 === 12) hour24 = 0;
    } else {
      if (hour24 !== 12) hour24 = hour24 + 12;
    }

    const timeStr = `${hour24.toString().padStart(2, '0')}:${selectedMinute.toString().padStart(2, '0')}`;
    onChange(timeStr);
    setIsOpen(false);
  };

  const handleClear = () => {
    onChange(null);
    setSelectedHour(12);
    setSelectedMinute(0);
    setSelectedPeriod('AM');
    setIsOpen(false);
  };

  const handleNow = () => {
    const now = new Date();
    let hour = now.getHours();
    const minute = now.getMinutes();
    const period: 'AM' | 'PM' = hour >= 12 ? 'PM' : 'AM';

    if (hour === 0) hour = 12;
    else if (hour > 12) hour = hour - 12;

    setSelectedHour(hour);
    setSelectedMinute(minute);
    setSelectedPeriod(period);

    // Convert to 24-hour and save
    let hour24 = hour;
    if (period === 'AM') {
      if (hour24 === 12) hour24 = 0;
    } else {
      if (hour24 !== 12) hour24 = hour24 + 12;
    }

    const timeStr = `${hour24.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`;
    onChange(timeStr);
    setIsOpen(false);
  };

  return (
    <div ref={containerRef} className={cn('relative', className)}>
      {/* Input Button */}
      <button
        type="button"
        onClick={() => !disabled && setIsOpen(!isOpen)}
        disabled={disabled}
        className={cn(
          'w-full flex items-center justify-between',
          'bg-neutral-100 text-neutral-900 rounded-xl px-4 py-3',
          'focus:outline-none focus:ring-2 focus:ring-neutral-900/20',
          'transition-all duration-200',
          !value && 'text-neutral-400',
          disabled && 'opacity-60 cursor-not-allowed'
        )}
      >
        <span>{formatDisplayTime() || placeholder}</span>
        <HugeiconsIcon icon={Clock01Icon} size={20} className="text-neutral-400" />
      </button>

      {/* Time Picker Dropdown */}
      {isOpen && (
        <div className="absolute z-50 mt-2 bg-white rounded-2xl shadow-lg border border-neutral-200 p-4 w-[280px]">
          {/* Time Selectors */}
          <div className="flex items-center justify-center gap-2 mb-4">
            {/* Hour Selector */}
            <div className="flex flex-col items-center">
              <span className="text-xs font-medium text-neutral-500 mb-1">Hour</span>
              <select
                value={selectedHour}
                onChange={(e) => setSelectedHour(parseInt(e.target.value))}
                className="w-16 px-2 py-2 rounded-lg bg-neutral-50 border border-neutral-200 text-center text-lg font-medium text-neutral-900 focus:outline-none focus:ring-2 focus:ring-neutral-900/20 cursor-pointer"
              >
                {hours.map((hour) => (
                  <option key={hour} value={hour}>{hour}</option>
                ))}
              </select>
            </div>

            <span className="text-2xl font-bold text-neutral-400 mt-5">:</span>

            {/* Minute Selector */}
            <div className="flex flex-col items-center">
              <span className="text-xs font-medium text-neutral-500 mb-1">Min</span>
              <select
                value={selectedMinute}
                onChange={(e) => setSelectedMinute(parseInt(e.target.value))}
                className="w-16 px-2 py-2 rounded-lg bg-neutral-50 border border-neutral-200 text-center text-lg font-medium text-neutral-900 focus:outline-none focus:ring-2 focus:ring-neutral-900/20 cursor-pointer"
              >
                {minutes.map((minute) => (
                  <option key={minute} value={minute}>{minute.toString().padStart(2, '0')}</option>
                ))}
              </select>
            </div>

            {/* AM/PM Selector */}
            <div className="flex flex-col items-center">
              <span className="text-xs font-medium text-neutral-500 mb-1">Period</span>
              <div className="flex flex-col gap-1">
                <button
                  type="button"
                  onClick={() => setSelectedPeriod('AM')}
                  className={cn(
                    'px-3 py-1 rounded-lg text-sm font-medium transition-colors',
                    selectedPeriod === 'AM'
                      ? 'bg-neutral-900 text-white'
                      : 'bg-neutral-50 text-neutral-600 hover:bg-neutral-100'
                  )}
                >
                  AM
                </button>
                <button
                  type="button"
                  onClick={() => setSelectedPeriod('PM')}
                  className={cn(
                    'px-3 py-1 rounded-lg text-sm font-medium transition-colors',
                    selectedPeriod === 'PM'
                      ? 'bg-neutral-900 text-white'
                      : 'bg-neutral-50 text-neutral-600 hover:bg-neutral-100'
                  )}
                >
                  PM
                </button>
              </div>
            </div>
          </div>

          {/* Confirm Button */}
          <button
            type="button"
            onClick={handleConfirm}
            className="w-full py-2 rounded-lg bg-neutral-900 text-white font-medium hover:bg-neutral-800 transition-colors"
          >
            Confirm
          </button>

          {/* Footer */}
          <div className="flex items-center justify-between mt-4 pt-4 border-t border-neutral-100">
            <button
              type="button"
              onClick={handleClear}
              className="text-sm font-medium text-neutral-500 hover:text-neutral-900 transition-colors"
            >
              Clear
            </button>
            <button
              type="button"
              onClick={handleNow}
              className="text-sm font-medium text-neutral-900 hover:text-neutral-700 transition-colors"
            >
              Now
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
