'use client'

import { useEffect, useState, useRef } from 'react'
import { HugeiconsIcon } from '@hugeicons/react'
import { Tick01Icon, Loading03Icon } from '@hugeicons/core-free-icons'
import { Button } from '@/components/ui/Button'

interface AnalysisProgressProps {
  isComplete: boolean
  stage?: string // 'extracting' | 'queued' | 'analyzing' | 'finalizing' | undefined
  onCancel?: () => void
}

const STEPS = [
  { key: 'extracting', label: 'Extracting Files', description: 'Reading diagnostic images...' },
  { key: 'queued', label: 'Running Protocol Engine', description: 'Matching biomarkers to protocols...' },
  { key: 'analyzing', label: 'Evaluating Clinical Data', description: 'AI agent analyzing patient data...' },
  { key: 'finalizing', label: 'Finalizing Report', description: 'Validating frequencies & compiling report...' },
] as const

// Map stage to step index (which step is currently active)
const STAGE_TO_STEP: Record<string, number> = {
  extracting: 1,  // extraction done (POST returned), protocol engine running
  queued: 2,      // eval queued
  analyzing: 2,   // eval running
  finalizing: 3,  // saving protocols
}

// Progress ranges per step
const STEP_PROGRESS = [
  { base: 0, max: 20 },   // Step 0: Extracting
  { base: 20, max: 35 },  // Step 1: Protocol Engine
  { base: 35, max: 85 },  // Step 2: Evaluating (longest phase)
  { base: 85, max: 95 },  // Step 3: Finalizing
]

// Creep rate per step (% per second) — slow enough to feel natural
const CREEP_RATES = [0.5, 0.3, 0.15, 0.5]

const TICK_MS = 500

function formatElapsed(seconds: number): string {
  const m = Math.floor(seconds / 60)
  const s = seconds % 60
  return `${m}:${s.toString().padStart(2, '0')}`
}

export function AnalysisProgress({ isComplete, stage, onCancel }: AnalysisProgressProps) {
  const [progress, setProgress] = useState(0)
  const [showCancelConfirm, setShowCancelConfirm] = useState(false)
  const [elapsedSeconds, setElapsedSeconds] = useState(0)
  const currentStepRef = useRef(0)

  // Derive current step from stage
  const stageStep = stage ? (STAGE_TO_STEP[stage] ?? 0) : 0
  if (stageStep > currentStepRef.current) {
    currentStepRef.current = stageStep
  }
  const currentStep = isComplete ? STEPS.length : currentStepRef.current

  // Elapsed timer
  useEffect(() => {
    if (isComplete) return

    const interval = setInterval(() => {
      setElapsedSeconds((prev) => prev + 1)
    }, 1000)

    return () => clearInterval(interval)
  }, [isComplete])

  // Progress animation — jumps to step base, then creeps within the step
  useEffect(() => {
    if (isComplete) {
      setProgress(100)
      return
    }

    const interval = setInterval(() => {
      setProgress(prev => {
        const step = currentStepRef.current
        const { base, max } = STEP_PROGRESS[step] || { base: 95, max: 95 }
        const minProgress = base
        const creep = CREEP_RATES[step] || 0.1

        // Jump to at least the step's base, then creep within the range
        const next = Math.max(prev, minProgress) + (creep * TICK_MS / 1000)
        return Math.min(next, max)
      })
    }, TICK_MS)

    return () => clearInterval(interval)
  }, [isComplete])

  // Status text based on current stage
  const statusText = isComplete
    ? 'Analysis complete!'
    : elapsedSeconds > 300
      ? 'Taking longer than expected...'
      : stage === 'analyzing'
        ? 'AI agent evaluating — this is the longest step'
        : 'Processing your diagnostics'

  return (
    <div className="bg-blue-50 dark:bg-blue-900/20 rounded-2xl p-6">
      <p className="text-sm text-blue-600 dark:text-blue-400 mb-4">
        {statusText}
      </p>

      {/* Progress bar */}
      <div className="w-full h-3 bg-blue-100 dark:bg-blue-900/40 rounded-full overflow-hidden mb-6">
        <div
          className="h-full bg-blue-600 rounded-full transition-all duration-500 ease-out"
          style={{ width: `${progress}%` }}
        />
      </div>

      {/* Percentage + Timer */}
      <div className="flex items-center justify-between mb-4">
        <p className="text-sm font-medium text-blue-800 dark:text-blue-200">
          {Math.round(progress)}% complete
        </p>
        <span className="font-mono text-sm text-blue-500 dark:text-blue-400 tabular-nums">
          {formatElapsed(elapsedSeconds)}
        </span>
      </div>

      {/* Steps */}
      <div className="space-y-3">
        {STEPS.map((step, i) => {
          const isCompleted = i < currentStep
          const isActive = i === currentStep && !isComplete

          return (
            <div
              key={step.key}
              className={`flex items-start gap-3 ${
                !isCompleted && !isActive ? 'opacity-40' : ''
              }`}
            >
              <div className="mt-0.5 flex-shrink-0">
                {isCompleted ? (
                  <div className="w-5 h-5 rounded-full bg-blue-600 flex items-center justify-center">
                    <HugeiconsIcon icon={Tick01Icon} size={14} className="text-white" />
                  </div>
                ) : isActive ? (
                  <HugeiconsIcon
                    icon={Loading03Icon}
                    size={20}
                    className="text-blue-600 dark:text-blue-400 animate-spin"
                  />
                ) : (
                  <div className="w-5 h-5 rounded-full border-2 border-neutral-300 dark:border-neutral-600" />
                )}
              </div>
              <div>
                <p className={`text-sm font-medium ${
                  isCompleted || isActive
                    ? 'text-neutral-900 dark:text-neutral-50'
                    : 'text-neutral-500 dark:text-neutral-400'
                }`}>
                  {step.label}
                </p>
                {isActive && (
                  <p className="text-xs text-blue-600 dark:text-blue-400 mt-0.5">
                    {step.description}
                  </p>
                )}
              </div>
            </div>
          )
        })}
      </div>

      {/* Complete message */}
      {isComplete && (
        <p className="text-sm font-medium text-green-600 dark:text-green-400 mt-4">
          Analysis complete! Redirecting...
        </p>
      )}

      {/* Cancel button with confirmation */}
      {!isComplete && onCancel && (
        <div className="flex justify-center mt-4">
          {showCancelConfirm ? (
            <div className="flex items-center gap-2">
              <span className="text-sm text-neutral-600 dark:text-neutral-400">Cancel analysis?</span>
              <Button variant="danger" size="sm" onClick={onCancel}>
                Yes, Cancel
              </Button>
              <Button variant="secondary" size="sm" onClick={() => setShowCancelConfirm(false)}>
                No, Continue
              </Button>
            </div>
          ) : (
            <Button variant="danger" size="sm" onClick={() => setShowCancelConfirm(true)}>
              Cancel Analysis
            </Button>
          )}
        </div>
      )}
    </div>
  )
}
