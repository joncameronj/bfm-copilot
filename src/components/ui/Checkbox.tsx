import { InputHTMLAttributes } from 'react'

interface CheckboxProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string
}

export function Checkbox({ label, className = '', ...props }: CheckboxProps) {
  return (
    <div className="flex items-center">
      <input
        type="checkbox"
        {...props}
        className={`
          w-5 h-5 rounded border-2 border-neutral-300 dark:border-neutral-600
          bg-white dark:bg-neutral-950
          accent-blue-600 dark:accent-blue-500
          cursor-pointer transition-colors
          checked:border-blue-600 dark:checked:border-blue-500
          focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2
          dark:focus:ring-offset-neutral-950
          disabled:opacity-50 disabled:cursor-not-allowed
          ${className}
        `}
      />
      {label && (
        <label className="ml-2 text-sm font-medium text-neutral-900 dark:text-neutral-100 cursor-pointer">
          {label}
        </label>
      )}
    </div>
  )
}
