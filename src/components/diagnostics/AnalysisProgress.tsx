'use client'

import { useEffect, useState, useRef } from 'react'
import { HugeiconsIcon } from '@hugeicons/react'
import { Tick01Icon, Loading03Icon } from '@hugeicons/core-free-icons'
import { Button } from '@/components/ui/Button'

interface AnalysisProgressProps {
  isComplete: boolean
  stage?: string // 'extracting' | 'queued' | 'analyzing' | undefined
  onCancel?: () => void
}

const STEPS = [
  { label: 'Extracting Data', description: 'Reading and parsing uploaded files...', range: [0, 10] },
  { label: 'Analyzing Biomarkers', description: 'Identifying patterns and relationships...', range: [10, 35] },
  { label: 'Generating Protocols', description: 'Matching findings to frequency protocols...', range: [35, 65] },
  { label: 'Supplementation', description: 'Evaluating supplement recommendations...', range: [65, 85] },
  { label: 'Finalizing', description: 'Compiling final analysis report...', range: [85, 95] },
] as const

// Total simulated duration ~150s (2.5 min), weighted per step
const STEP_DURATIONS = [8, 25, 35, 25, 57] // seconds per step
const TICK_MS = 500

function formatElapsed(seconds: number): string {
  const m = Math.floor(seconds / 60)
  const s = seconds % 60
  return `${m}:${s.toString().padStart(2, '0')}`
}

// Map backend stage to minimum step index so the progress bar jumps ahead
const STAGE_TO_MIN_STEP: Record<string, number> = {
  extracting: 0,
  queued: 1,
  analyzing: 2,
}

export function AnalysisProgress({ isComplete, stage, onCancel }: AnalysisProgressProps) {
  const [progress, setProgress] = useState(0)
  const [stuckTimer, setStuckTimer] = useState(0)
  const [showCancelConfirm, setShowCancelConfirm] = useState(false)
  const [elapsedSeconds, setElapsedSeconds] = useState(0)
  const startTime = useRef(Date.now())

  // Elapsed timer
  useEffect(() => {
    if (isComplete) return

    const interval = setInterval(() => {
      setElapsedSeconds((prev) => prev + 1)
    }, 1000)

    return () => clearInterval(interval)
  }, [isComplete])

  useEffect(() => {
    if (isComplete) {
      setProgress(100)
      return
    }

    const interval = setInterval(() => {
      const elapsed = (Date.now() - startTime.current) / 1000

      // Calculate progress based on elapsed time and step durations
      let cumulative = 0
      let newProgress = 0
      for (let i = 0; i < STEPS.length; i++) {
        const stepStart = cumulative
        cumulative += STEP_DURATIONS[i]
        const [rangeStart, rangeEnd] = STEPS[i].range

        if (elapsed <= cumulative) {
          const stepElapsed = elapsed - stepStart
          const stepFraction = Math.min(stepElapsed / STEP_DURATIONS[i], 1)
          // Ease-out for snappier start
          const eased = 1 - Math.pow(1 - stepFraction, 2)
          newProgress = rangeStart + (rangeEnd - rangeStart) * eased
          break
        }
        newProgress = rangeEnd
      }

      // If backend reports a stage, ensure progress is at least at that step's start
      if (stage && STAGE_TO_MIN_STEP[stage] !== undefined) {
        const minStep = STAGE_TO_MIN_STEP[stage]
        const minProgress = STEPS[minStep].range[0]
        newProgress = Math.max(newProgress, minProgress)
      }

      // Cap at 95%
      newProgress = Math.min(newProgress, 95)
      setProgress(newProgress)

      // Track time stuck at 95%
      if (newProgress >= 94.5) {
        setStuckTimer(prev => prev + TICK_MS / 1000)
      }
    }, TICK_MS)

    return () => clearInterval(interval)
  }, [isComplete, stage])

  const activeStepIndex = isComplete
    ? STEPS.length
    : STEPS.findIndex(s => progress < s.range[1])

  return (
    <div className="bg-blue-50 dark:bg-blue-900/20 rounded-2xl p-6">
      <p className="text-sm text-blue-600 dark:text-blue-400 mb-4">
        Typical analysis takes 3-5 minutes
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
          const isCompleted = i < activeStepIndex
          const isActive = i === activeStepIndex && !isComplete

          return (
            <div
              key={step.label}
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

      {/* Stuck message */}
      {!isComplete && stuckTimer > 30 && (
        <p className="text-xs text-blue-500 dark:text-blue-400 mt-4">
          Still working, taking a bit longer than usual...
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
