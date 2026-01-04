'use client'

import { ChatInput } from './ChatInput'
import { getGreeting } from '@/lib/greetings'

interface EmptyStateProps {
  onWorkflowSelect?: (workflowId: string) => void
  onSend: (message: string, files?: File[]) => void
  onVoiceStart?: () => void
  onVoiceEnd?: () => void
  isLoading?: boolean
  isListening?: boolean
  firstName?: string | null
}

function renderGreetingWithGradientName(greeting: string, firstName: string | null) {
  if (!firstName) {
    return <>{greeting}</>
  }

  const parts = greeting.split(firstName)
  if (parts.length === 1) {
    return <>{greeting}</>
  }

  return (
    <>
      {parts[0]}
      <span
        style={{
          background: 'radial-gradient(circle at bottom left, #00FFEE 0%, #1100FF 100%)',
          WebkitBackgroundClip: 'text',
          WebkitTextFillColor: 'transparent',
          backgroundClip: 'text',
        }}
      >
        {firstName}
      </span>
      {parts[1]}
    </>
  )
}

export function EmptyState({
  onSend,
  isLoading = false,
  firstName,
}: EmptyStateProps) {
  const greeting = getGreeting(firstName)

  return (
    <div className="flex flex-col items-center justify-center h-full px-4">
      {/* Heading - ChatGPT 5.2 style per PRD V2 */}
      <h1 className="text-4xl font-bold tracking-[-0.05em] text-neutral-900 dark:text-neutral-50 mb-8">
        {renderGreetingWithGradientName(greeting, firstName)}
      </h1>

      {/* Input Bar */}
      <div className="w-full max-w-2xl">
        <ChatInput
          onSend={onSend}
          isLoading={isLoading}
          placeholder="Ask Copilot"
        />
      </div>
    </div>
  )
}
