'use client';

import { useState, useRef, useEffect } from 'react';
import { cn } from '@/lib/utils';
import { HugeiconsIcon } from '@hugeicons/react';
import { ArrowLeft01Icon, ArrowRight01Icon, Calendar03Icon } from '@hugeicons/core-free-icons';
import {
  format,
  startOfMonth,
  endOfMonth,
  startOfWeek,
  endOfWeek,
  addDays,
  addMonths,
  subMonths,
  isSameMonth,
  isSameDay,
  isToday,
  isBefore,
  isAfter,
} from 'date-fns';

interface DatePickerProps {
  value?: Date | null;
  onChange: (date: Date | null) => void;
  placeholder?: string;
  minDate?: Date;
  maxDate?: Date;
  className?: string;
}

export function DatePicker({
  value,
  onChange,
  placeholder = 'Select date',
  minDate,
  maxDate,
  className,
}: DatePickerProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [currentMonth, setCurrentMonth] = useState(value || new Date());
  const containerRef = useRef<HTMLDivElement>(null);

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

  const handleDateSelect = (date: Date) => {
    onChange(date);
    setIsOpen(false);
  };

  const handleClear = () => {
    onChange(null);
    setIsOpen(false);
  };

  const handleToday = () => {
    const today = new Date();
    if ((!minDate || !isBefore(today, minDate)) && (!maxDate || !isAfter(today, maxDate))) {
      onChange(today);
    }
    setIsOpen(false);
  };

  const isDateDisabled = (date: Date) => {
    if (minDate && isBefore(date, minDate)) return true;
    if (maxDate && isAfter(date, maxDate)) return true;
    return false;
  };

  const renderCalendar = () => {
    const monthStart = startOfMonth(currentMonth);
    const monthEnd = endOfMonth(currentMonth);
    const startDate = startOfWeek(monthStart);
    const endDate = endOfWeek(monthEnd);

    const days: Date[] = [];
    let day = startDate;
    while (day <= endDate) {
      days.push(day);
      day = addDays(day, 1);
    }

    const weeks: Date[][] = [];
    for (let i = 0; i < days.length; i += 7) {
      weeks.push(days.slice(i, i + 7));
    }

    return weeks;
  };

  return (
    <div ref={containerRef} className={cn('relative', className)}>
      {/* Input Button */}
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className={cn(
          'w-full flex items-center justify-between',
          'bg-neutral-100 text-neutral-900 rounded-xl px-4 py-3',
          'focus:outline-none focus:ring-2 focus:ring-brand-blue/20',
          'transition-all duration-200',
          !value && 'text-neutral-400'
        )}
      >
        <span>{value ? format(value, 'MM/dd/yyyy') : placeholder}</span>
        <HugeiconsIcon icon={Calendar03Icon} size={20} className="text-neutral-400" />
      </button>

      {/* Calendar Dropdown */}
      {isOpen && (
        <div className="absolute z-50 mt-2 bg-white rounded-2xl shadow-lg border border-neutral-200 p-4 w-[320px]">
          {/* Header */}
          <div className="flex items-center justify-between mb-4">
            <button
              type="button"
              onClick={() => setCurrentMonth(subMonths(currentMonth, 1))}
              className="p-2 rounded-lg hover:bg-neutral-100 transition-colors"
            >
              <HugeiconsIcon icon={ArrowLeft01Icon} size={20} className="text-neutral-600" />
            </button>
            <span className="font-semibold text-neutral-900">
              {format(currentMonth, 'MMMM yyyy')}
            </span>
            <button
              type="button"
              onClick={() => setCurrentMonth(addMonths(currentMonth, 1))}
              className="p-2 rounded-lg hover:bg-neutral-100 transition-colors"
            >
              <HugeiconsIcon icon={ArrowRight01Icon} size={20} className="text-neutral-600" />
            </button>
          </div>

          {/* Day Headers */}
          <div className="grid grid-cols-7 gap-1 mb-2">
            {['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'].map((day) => (
              <div
                key={day}
                className="text-center text-xs font-medium text-neutral-500 py-2"
              >
                {day}
              </div>
            ))}
          </div>

          {/* Calendar Grid */}
          <div className="space-y-1">
            {renderCalendar().map((week, weekIndex) => (
              <div key={weekIndex} className="grid grid-cols-7 gap-1">
                {week.map((day, dayIndex) => {
                  const isCurrentMonth = isSameMonth(day, currentMonth);
                  const isSelected = value && isSameDay(day, value);
                  const isTodayDate = isToday(day);
                  const disabled = isDateDisabled(day);

                  return (
                    <button
                      key={dayIndex}
                      type="button"
                      onClick={() => !disabled && handleDateSelect(day)}
                      disabled={disabled}
                      className={cn(
                        'w-10 h-10 rounded-xl text-sm font-medium transition-all duration-200',
                        'flex items-center justify-center',
                        !isCurrentMonth && 'text-neutral-300',
                        isCurrentMonth && !isSelected && !disabled && 'text-neutral-900 hover:bg-neutral-100',
                        isTodayDate && !isSelected && 'bg-blue-50 text-brand-blue',
                        isSelected && 'bg-brand-blue text-white',
                        disabled && 'text-neutral-300 cursor-not-allowed'
                      )}
                    >
                      {format(day, 'd')}
                    </button>
                  );
                })}
              </div>
            ))}
          </div>

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
              onClick={handleToday}
              className="text-sm font-medium text-brand-blue hover:text-brand-blue/80 transition-colors"
            >
              Today
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
