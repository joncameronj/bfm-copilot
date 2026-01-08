'use client'

import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/Card'
import { cn } from '@/lib/utils'
import { useEvalMode } from '@/providers/EvalModeProvider'
import { RATING_CONFIG } from '@/types/eval-mode'

export function EvalModeSection() {
  const { isEvalModeEnabled, toggleEvalMode, isLoading } = useEvalMode()

  return (
    <Card>
      <CardHeader>
        <CardTitle>Evaluation Mode</CardTitle>
        <CardDescription>
          Enable detailed evaluation of AI responses with a 4-tier rating system
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-6">
          {/* Toggle */}
          <div className="flex items-center justify-between py-3 border-b border-neutral-100">
            <div>
              <p className="font-medium text-neutral-900">Enable Evaluation Mode</p>
              <p className="text-sm text-neutral-500">
                When enabled, you&apos;ll see detailed rating options instead of simple thumbs up/down
              </p>
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={isEvalModeEnabled}
              onClick={toggleEvalMode}
              disabled={isLoading}
              className={cn(
                'relative inline-flex h-6 w-11 items-center rounded-full transition-colors disabled:opacity-50',
                isEvalModeEnabled ? 'bg-brand-blue' : 'bg-neutral-200'
              )}
            >
              <span
                className={cn(
                  'inline-block h-4 w-4 transform rounded-full bg-white transition-transform',
                  isEvalModeEnabled ? 'translate-x-6' : 'translate-x-1'
                )}
              />
            </button>
          </div>

          {/* Rating Preview */}
          <div>
            <p className="text-sm font-medium text-neutral-700 mb-3">Rating Options Preview</p>
            <div className="flex flex-wrap gap-2">
              {Object.entries(RATING_CONFIG).map(([key, config]) => (
                <span
                  key={key}
                  className={cn(
                    'inline-flex items-center px-3 py-1.5 text-sm font-medium rounded-md border',
                    config.bgColor,
                    config.color,
                    config.borderColor
                  )}
                >
                  {config.label}
                </span>
              ))}
            </div>
          </div>

          {/* How it works */}
          <div className="bg-neutral-50 rounded-lg p-4">
            <p className="text-sm font-medium text-neutral-700 mb-2">How Evaluation Mode Works</p>
            <ul className="text-sm text-neutral-600 space-y-1 list-disc list-inside">
              <li>Rate each AI response with one of four options</li>
              <li><strong>Correct:</strong> No comment required</li>
              <li><strong>Partially Correct, Partially Fail, Fail:</strong> Comment required explaining what needs adjustment</li>
              <li>All evaluations are logged for training and improvement</li>
              <li>View evaluation history in the admin panel</li>
            </ul>
          </div>

          {/* Status indicator */}
          <div className={cn(
            'flex items-center gap-2 text-sm',
            isEvalModeEnabled ? 'text-green-600' : 'text-neutral-500'
          )}>
            <span className={cn(
              'w-2 h-2 rounded-full',
              isEvalModeEnabled ? 'bg-green-500' : 'bg-neutral-400'
            )} />
            {isEvalModeEnabled ? 'Evaluation mode is active' : 'Evaluation mode is disabled'}
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
