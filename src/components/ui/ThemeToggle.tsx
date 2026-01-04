'use client';

import { useTheme } from '@/providers/ThemeProvider';
import { HugeiconsIcon } from '@hugeicons/react';
import { Sun01Icon, Moon02Icon, ComputerIcon } from '@hugeicons/core-free-icons';
import { cn } from '@/lib/utils';

interface ThemeToggleProps {
  className?: string;
}

export function ThemeToggle({ className }: ThemeToggleProps) {
  const { theme, setTheme } = useTheme();

  const cycleTheme = () => {
    if (theme === 'system') {
      setTheme('light');
    } else if (theme === 'light') {
      setTheme('dark');
    } else {
      setTheme('system');
    }
  };

  const getIcon = () => {
    switch (theme) {
      case 'light':
        return Sun01Icon;
      case 'dark':
        return Moon02Icon;
      default:
        return ComputerIcon;
    }
  };

  const getLabel = () => {
    switch (theme) {
      case 'light':
        return 'Light mode';
      case 'dark':
        return 'Dark mode';
      default:
        return 'System preference';
    }
  };

  return (
    <button
      onClick={cycleTheme}
      className={cn(
        'p-2 rounded-xl text-neutral-500 dark:text-neutral-400',
        'hover:text-neutral-900 dark:hover:text-neutral-50',
        'hover:bg-neutral-100 dark:hover:bg-neutral-800',
        'transition-all duration-200 active:scale-95',
        className
      )}
      title={getLabel()}
      aria-label={`Theme: ${getLabel()}. Click to cycle.`}
    >
      <HugeiconsIcon icon={getIcon()} size={20} />
    </button>
  );
}

// Expanded version with all three options visible
export function ThemeToggleExpanded({ className }: ThemeToggleProps) {
  const { theme, setTheme } = useTheme();

  const options = [
    { value: 'system' as const, icon: ComputerIcon, label: 'System' },
    { value: 'light' as const, icon: Sun01Icon, label: 'Light' },
    { value: 'dark' as const, icon: Moon02Icon, label: 'Dark' },
  ];

  return (
    <div
      className={cn(
        'flex items-center gap-1 p-1 rounded-xl',
        'bg-neutral-100 dark:bg-neutral-800',
        className
      )}
    >
      {options.map((option) => (
        <button
          key={option.value}
          onClick={() => setTheme(option.value)}
          className={cn(
            'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium',
            'transition-all duration-200',
            theme === option.value
              ? 'bg-white dark:bg-neutral-700 text-neutral-900 dark:text-neutral-50 shadow-sm'
              : 'text-neutral-500 dark:text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-300'
          )}
          aria-pressed={theme === option.value}
        >
          <HugeiconsIcon icon={option.icon} size={16} />
          <span className="hidden sm:inline">{option.label}</span>
        </button>
      ))}
    </div>
  );
}
