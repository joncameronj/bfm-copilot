'use client'

import { cn } from '@/lib/utils'
import type { ToolCall } from '@/types/chat'

interface ToolCallDisplayProps {
  toolCall: ToolCall
}

export function ToolCallDisplay({ toolCall }: ToolCallDisplayProps) {
  const getStatusColor = () => {
    switch (toolCall.status) {
      case 'pending':
        return 'bg-neutral-100 text-neutral-600'
      case 'running':
        return 'bg-blue-50 text-blue-600'
      case 'completed':
        return 'bg-green-50 text-green-600'
      case 'failed':
        return 'bg-red-50 text-red-600'
      default:
        return 'bg-neutral-100 text-neutral-600'
    }
  }

  const getStatusText = () => {
    switch (toolCall.status) {
      case 'pending':
        return 'Pending'
      case 'running':
        return 'Running'
      case 'completed':
        return 'Completed'
      case 'failed':
        return 'Failed'
      default:
        return 'Unknown'
    }
  }

  return (
    <div className="flex justify-start">
      <div className="bg-neutral-100 rounded-2xl px-4 py-3 max-w-[80%]">
        <div className="flex items-center gap-3 mb-2">
          <div className="flex items-center gap-2">
            {toolCall.status === 'running' && (
              <svg
                className="w-4 h-4 animate-spin text-blue-500"
                fill="none"
                viewBox="0 0 24 24"
              >
                <circle
                  className="opacity-25"
                  cx="12"
                  cy="12"
                  r="10"
                  stroke="currentColor"
                  strokeWidth="4"
                />
                <path
                  className="opacity-75"
                  fill="currentColor"
                  d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                />
              </svg>
            )}
            <span className="text-sm font-medium text-neutral-700">
              {formatToolName(toolCall.function.name)}
            </span>
          </div>
          <span
            className={cn(
              'text-xs px-2 py-1 rounded-full font-medium',
              getStatusColor()
            )}
          >
            {getStatusText()}
          </span>
        </div>

        {toolCall.result && toolCall.status === 'completed' && (
          <div className="text-sm text-neutral-600 mt-2 pt-2 border-t border-neutral-200">
            <pre className="whitespace-pre-wrap text-xs bg-neutral-50 rounded p-2 overflow-x-auto">
              {formatResult(toolCall.result)}
            </pre>
          </div>
        )}
      </div>
    </div>
  )
}

function formatToolName(name: string): string {
  // Convert snake_case or camelCase to Title Case
  return name
    .replace(/_/g, ' ')
    .replace(/([A-Z])/g, ' $1')
    .replace(/^./, (str) => str.toUpperCase())
    .trim()
}

function formatResult(result: string): string {
  try {
    const parsed = JSON.parse(result)
    return JSON.stringify(parsed, null, 2)
  } catch {
    return result
  }
}
