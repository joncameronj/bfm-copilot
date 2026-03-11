'use client'

import { useState, useEffect } from 'react'
import { HugeiconsIcon } from '@hugeicons/react'
import { Loading03Icon, Tick02Icon, Cancel01Icon, AiCloud02Icon } from '@hugeicons/core-free-icons'
import { cn } from '@/lib/utils'

export type AnalysisStatus = 'idle' | 'uploading' | 'analyzing' | 'generating' | 'complete' | 'error'

interface AnalysisStatusIndicatorProps {
  status: AnalysisStatus
  className?: string
}

const ANALYSIS_STEPS = [
  { label: 'Extracting data from uploaded files...', duration: 4000 },
  { label: 'Analyzing diagnostic patterns...', duration: 6000 },
  { label: 'Cross-referencing master protocols...', duration: 8000 },
  { label: 'Generating protocol recommendations...', duration: 10000 },
  { label: 'Building supplementation plan...', duration: 6000 },
]

function formatElapsed(seconds: number): string {
  const m = Math.floor(seconds / 60)
  const s = seconds % 60
  return `${m}:${s.toString().padStart(2, '0')}`
}

export function AnalysisStatusIndicator({
  status,
  className,
}: AnalysisStatusIndicatorProps) {
  const [currentStep, setCurrentStep] = useState(0)
  const [progressPercent, setProgressPercent] = useState(0)
  const [elapsedSeconds, setElapsedSeconds] = useState(0)

  // Elapsed timer
  useEffect(() => {
    if (status !== 'analyzing' && status !== 'generating') {
      setElapsedSeconds(0)
      return
    }

    const interval = setInterval(() => {
      setElapsedSeconds((prev) => prev + 1)
    }, 1000)

    return () => clearInterval(interval)
  }, [status])

  // Step progression during analysis
  useEffect(() => {
    if (status !== 'analyzing' && status !== 'generating') {
      setCurrentStep(0)
      setProgressPercent(0)
      return
    }

    // Progress bar animation
    const progressInterval = setInterval(() => {
      setProgressPercent((prev) => {
        // Slow down as we approach the end (never quite reaches 100 until complete)
        if (prev >= 90) return Math.min(prev + 0.1, 95)
        if (prev >= 70) return prev + 0.3
        return prev + 0.8
      })
    }, 200)

    // Step progression
    let stepIndex = 0
    const advanceStep = () => {
      if (stepIndex < ANALYSIS_STEPS.length - 1) {
        stepIndex += 1
        setCurrentStep(stepIndex)
      }
    }

    // Schedule each step transition
    const timeouts: NodeJS.Timeout[] = []
    let cumulative = 0
    for (let i = 0; i < ANALYSIS_STEPS.length - 1; i++) {
      cumulative += ANALYSIS_STEPS[i].duration
      timeouts.push(setTimeout(advanceStep, cumulative))
    }

    return () => {
      clearInterval(progressInterval)
      timeouts.forEach(clearTimeout)
    }
  }, [status])

  // Jump to 100% on complete
  useEffect(() => {
    if (status === 'complete') {
      setProgressPercent(100)
      setCurrentStep(ANALYSIS_STEPS.length - 1)
    }
  }, [status])

  // Don't render anything for idle status
  if (status === 'idle') {
    return null
  }

  if (status === 'uploading') {
    return (
      <div className={cn('flex items-center gap-3 px-4 py-3 rounded-xl bg-blue-50', className)}>
        <HugeiconsIcon icon={Loading03Icon} size={24} className="text-blue-600 animate-spin" />
        <span className="font-medium text-blue-600">Uploading files...</span>
      </div>
    )
  }

  if (status === 'complete') {
    return (
      <div className={cn('flex items-center gap-3 px-4 py-3 rounded-xl bg-green-50', className)}>
        <HugeiconsIcon icon={Tick02Icon} size={24} className="text-green-600" />
        <span className="font-medium text-green-600">Analysis complete!</span>
      </div>
    )
  }

  if (status === 'error') {
    return (
      <div className={cn('flex items-center gap-3 px-4 py-3 rounded-xl bg-red-50', className)}>
        <HugeiconsIcon icon={Cancel01Icon} size={24} className="text-red-600" />
        <span className="font-medium text-red-600">Analysis failed</span>
      </div>
    )
  }

  // Analyzing / Generating states — full progress UI
  return (
    <div className={cn('space-y-4', className)}>
      {/* Header bar */}
      <div className="flex items-center gap-3 px-4 py-3 rounded-xl bg-purple-50">
        <div className="relative flex items-center justify-center">
          {/* Spinning ring */}
          <svg className="animate-spin h-6 w-6 text-purple-600" viewBox="0 0 24 24" fill="none">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" />
            <path
              className="opacity-75"
              fill="currentColor"
              d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
            />
          </svg>
        </div>
        <HugeiconsIcon icon={AiCloud02Icon} size={20} className="text-purple-600" />
        <span className="font-medium text-purple-700">COPILOT is analyzing...</span>
        <span className="ml-auto font-mono text-sm text-purple-500 tabular-nums">{formatElapsed(elapsedSeconds)}</span>
      </div>

      {/* Progress bar */}
      <div className="px-1">
        <div className="h-2 bg-purple-100 rounded-full overflow-hidden">
          <div
            className="h-full bg-purple-500 rounded-full transition-all duration-500 ease-out"
            style={{ width: `${progressPercent}%` }}
          />
        </div>
      </div>

      {/* Step list */}
      <div className="space-y-2 px-1">
        {ANALYSIS_STEPS.map((step, index) => {
          const isActive = index === currentStep
          const isDone = index < currentStep
          const isUpcoming = index > currentStep

          return (
            <div
              key={step.label}
              className={cn(
                'flex items-center gap-3 py-2 px-3 rounded-lg transition-all duration-300',
                isActive && 'bg-purple-50',
                !isActive && index < currentStep && 'opacity-60',
                !isActive && index > currentStep && 'opacity-40'
              )}
            >
              {/* Step indicator */}
              <div className="flex-shrink-0 w-5 h-5 flex items-center justify-center">
                {isDone ? (
                  <HugeiconsIcon icon={Tick02Icon} size={16} className="text-purple-600" />
                ) : isActive ? (
                  <svg className="animate-spin h-4 w-4 text-purple-600" viewBox="0 0 24 24" fill="none">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" />
                    <path
                      className="opacity-75"
                      fill="currentColor"
                      d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                    />
                  </svg>
                ) : (
                  <div className="w-2 h-2 rounded-full bg-neutral-300" />
                )}
              </div>

              {/* Step label */}
              <span
                className={cn(
                  'text-sm',
                  isActive && 'text-purple-700 font-medium',
                  isDone && 'text-purple-600',
                  isUpcoming && 'text-neutral-400'
                )}
              >
                {step.label}
              </span>
            </div>
          )
        })}
      </div>
    </div>
  )
}
