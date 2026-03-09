'use client'

import { useRef, useEffect } from 'react'
import { ChatMessage } from './ChatMessage'
import { ThinkingIndicator } from './ThinkingIndicator'
import { ReasoningIndicator } from './ReasoningDisplay'
import type { Message, ReasoningData, AgentStep, ActionButton, Source, RagChunk } from '@/types/chat'

interface MessageListProps {
  messages: Message[]
  isThinking?: boolean
  isReasoning?: boolean
  isStreaming?: boolean
  streamingMessageId?: string | null
  currentReasoning?: ReasoningData | null
  currentSteps?: AgentStep[]
  currentActions?: ActionButton[]
  currentSources?: Source[]
  currentRagChunks?: RagChunk[]
  currentDeepDiveNotices?: string[]
  thinkingStartTime?: number | null
}

export function MessageList({
  messages,
  isThinking = false,
  isReasoning = false,
  isStreaming = false,
  streamingMessageId,
  currentReasoning,
  currentSteps = [],
  currentActions = [],
  currentSources = [],
  currentRagChunks = [],
  currentDeepDiveNotices = [],
  thinkingStartTime,
}: MessageListProps) {
  const bottomRef = useRef<HTMLDivElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)

  // Auto-scroll to bottom when new messages arrive or when reasoning/thinking
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, isThinking, isReasoning])

  return (
    <div
      ref={containerRef}
      className="px-4 py-6"
    >
      <div className="max-w-3xl mx-auto space-y-4">
        {messages.map((message, index) => {
          const isActiveMessage = message.id === streamingMessageId
          return (
            <ChatMessage
              key={message.id || `msg-${index}`}
              message={message}
              isStreaming={isStreaming && isActiveMessage}
              isReasoning={isReasoning && isActiveMessage}
              isThinking={isThinking && isActiveMessage}
              currentReasoning={isActiveMessage ? currentReasoning : message.metadata?.reasoning}
              currentSteps={isActiveMessage ? currentSteps : message.metadata?.steps}
              currentActions={isActiveMessage ? currentActions : message.metadata?.actions}
              currentSources={isActiveMessage ? currentSources : message.metadata?.sources}
              currentRagChunks={isActiveMessage ? currentRagChunks : message.metadata?.ragChunks}
              currentDeepDiveNotices={
                isActiveMessage ? currentDeepDiveNotices : message.metadata?.deepDiveNotices
              }
              thinkingStartTime={isActiveMessage ? thinkingStartTime : undefined}
            />
          )
        })}
        {/* Only show thinking indicator if no streaming message yet */}
        {isThinking && !streamingMessageId && <ThinkingIndicator startTime={thinkingStartTime} />}
        {isReasoning && !streamingMessageId && (
          <ReasoningIndicator
            isReasoning={isReasoning}
            elapsedMs={currentReasoning?.elapsedMs || 0}
          />
        )}
        <div ref={bottomRef} />
      </div>
    </div>
  )
}
