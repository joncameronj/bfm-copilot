'use client'

import { useState, useEffect, useCallback } from 'react'

export function DemoModeToggle() {
  const [enabled, setEnabled] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [isUpdating, setIsUpdating] = useState(false)

  // Fetch current demo mode status
  const fetchStatus = useCallback(async () => {
    try {
      const response = await fetch('/api/admin/demo-mode')
      if (!response.ok) throw new Error('Failed to fetch demo mode status')
      const data = await response.json()
      setEnabled(data.enabled)
      setError(null)
    } catch (err) {
      setError('Failed to load demo mode status')
      console.error(err)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchStatus()
  }, [fetchStatus])

  // Toggle demo mode with optimistic update
  const handleToggle = async () => {
    const previousValue = enabled
    const newValue = !enabled

    // Optimistic update
    setEnabled(newValue)
    setIsUpdating(true)
    setError(null)

    try {
      const response = await fetch('/api/admin/demo-mode', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ enabled: newValue }),
      })

      if (!response.ok) {
        throw new Error('Failed to update demo mode')
      }

      const data = await response.json()
      setEnabled(data.enabled)
    } catch (err) {
      // Rollback on error
      setEnabled(previousValue)
      setError('Failed to update demo mode')
      console.error(err)
    } finally {
      setIsUpdating(false)
    }
  }

  if (loading) {
    return (
      <div className="mb-6 p-4 rounded-xl bg-neutral-100 dark:bg-neutral-800 animate-pulse">
        <div className="h-6 w-48 bg-neutral-200 dark:bg-neutral-700 rounded" />
      </div>
    )
  }

  return (
    <div
      className={`mb-6 p-4 rounded-xl border-2 transition-colors ${
        enabled
          ? 'bg-amber-50 dark:bg-amber-900/20 border-amber-300 dark:border-amber-600'
          : 'bg-neutral-100 dark:bg-neutral-800 border-transparent'
      }`}
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          {/* Status indicator */}
          <div
            className={`w-3 h-3 rounded-full ${
              enabled
                ? 'bg-amber-500 animate-pulse'
                : 'bg-neutral-400 dark:bg-neutral-600'
            }`}
          />

          <div>
            <h3 className="font-medium text-neutral-900 dark:text-neutral-50">
              Demo Mode
            </h3>
            <p className="text-sm text-neutral-500 dark:text-neutral-400">
              {enabled
                ? 'Active - Case studies return hard-coded results'
                : 'Off - Normal AI analysis for all diagnostics'}
            </p>
          </div>
        </div>

        {/* iOS-style toggle */}
        <button
          onClick={handleToggle}
          disabled={isUpdating}
          className={`relative w-14 h-8 rounded-full transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-amber-500 ${
            enabled
              ? 'bg-amber-500'
              : 'bg-neutral-300 dark:bg-neutral-600'
          } ${isUpdating ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
          role="switch"
          aria-checked={enabled}
          aria-label="Toggle demo mode"
        >
          <span
            className={`absolute top-1 left-1 w-6 h-6 bg-white rounded-full shadow-sm transition-transform duration-200 ease-in-out ${
              enabled ? 'translate-x-6' : 'translate-x-0'
            }`}
          />
        </button>
      </div>

      {/* Case study info when enabled */}
      {enabled && (
        <div className="mt-4 pt-4 border-t border-amber-200 dark:border-amber-800">
          <p className="text-xs font-medium text-amber-700 dark:text-amber-300 mb-2">
            Supported Case Studies:
          </p>
          <div className="grid grid-cols-2 gap-2 text-xs text-amber-600 dark:text-amber-400">
            <div>Thyroid Case Study 1</div>
            <div>Neuro Case Study 5</div>
            <div>Hormones Case Study 2</div>
            <div>Male Case Study 4</div>
          </div>
        </div>
      )}

      {error && (
        <p className="mt-2 text-sm text-red-500 dark:text-red-400">{error}</p>
      )}
    </div>
  )
}
