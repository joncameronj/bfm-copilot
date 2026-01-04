'use client'

import Image from 'next/image'
import { cn } from '@/lib/utils'
import { ReasoningDisplay } from './ReasoningDisplay'
import { AgentActivity } from './AgentActivity'
import { ShimmerEffect } from './ShimmerEffect'
import { ActionButtons } from './ActionButtons'
import { MessageActions } from './MessageActions'
import { FileAttachments } from './FileAttachments'
import type { Message, ReasoningData, AgentStep, ActionButton, Source } from '@/types/chat'
import ReactMarkdown from 'react-markdown'
import { useTheme } from '@/providers/ThemeProvider'

interface ChatMessageProps {
  message: Message
  isStreaming?: boolean
  isReasoning?: boolean
  isThinking?: boolean
  currentReasoning?: ReasoningData | null
  currentSteps?: AgentStep[]
  currentActions?: ActionButton[]
  currentSources?: Source[]
  thinkingStartTime?: number | null
}

export function ChatMessage({
  message,
  isStreaming = false,
  isReasoning = false,
  isThinking = false,
  currentReasoning,
  currentSteps = [],
  currentActions = [],
  currentSources = [],
  thinkingStartTime,
}: ChatMessageProps) {
  const { resolvedTheme } = useTheme()
  const isUser = message.role === 'user'
  const isAssistant = message.role === 'assistant'

  // Use current reasoning if actively reasoning, otherwise use stored reasoning
  const reasoningData = isReasoning ? currentReasoning : message.metadata?.reasoning

  // Use current steps if actively processing, otherwise use stored steps
  const steps = currentSteps.length > 0 ? currentSteps : message.metadata?.steps || []

  // Use current actions if available, otherwise use stored actions
  const actions = currentActions.length > 0 ? currentActions : message.metadata?.actions || []

  // Use current sources if available, otherwise use stored sources
  const sources = currentSources.length > 0 ? currentSources : message.metadata?.sources || []

  // Show shimmer when thinking but not yet streaming content
  const showShimmer = isThinking && !isStreaming && !message.content

  return (
    <div
      className={cn(
        'flex w-full',
        isUser ? 'justify-end' : 'justify-start'
      )}
    >
      <div
        className={cn(
          'max-w-[80%] space-y-3',
          isUser ? '' : ''
        )}
      >
        {/* Agent activity display for assistant messages */}
        {isAssistant && (steps.length > 0 || sources.length > 0 || isThinking) && (
          <AgentActivity
            isActive={isThinking || isReasoning}
            steps={steps}
            sources={sources}
            thinkingStartTime={thinkingStartTime}
          />
        )}

        {/* Reasoning display for assistant messages */}
        {isAssistant && (isReasoning || reasoningData) && (
          <ReasoningDisplay
            isReasoning={isReasoning}
            reasoning={reasoningData || null}
          />
        )}

        {/* Message bubble with shimmer effect */}
        <ShimmerEffect isActive={showShimmer} variant="bubble">
          <div
            className={cn(
              isUser
                ? 'rounded-2xl px-4 py-3 bg-black text-white'
                : 'text-neutral-900 dark:text-neutral-50',
              showShimmer && 'min-h-[60px]'
            )}
          >
            <div className={cn(
              'break-words',
              isAssistant
                ? 'prose dark:prose-invert max-w-none prose-p:my-2 prose-ul:my-2 prose-ol:my-2 prose-li:my-0 prose-strong:font-bold prose-h1:text-2xl prose-h1:font-bold prose-h1:mt-4 prose-h1:mb-2 prose-h2:text-xl prose-h2:font-bold prose-h2:mt-3 prose-h2:mb-2 prose-h3:text-lg prose-h3:font-semibold prose-h3:mt-2 prose-h3:mb-1 font-medium'
                : 'whitespace-pre-wrap'
            )}>
              {isAssistant ? (
                <>
                  <ReactMarkdown>{message.content}</ReactMarkdown>
                  {isStreaming && (
                    <Image
                      src={resolvedTheme === 'dark' ? '/icons/bfm-icon.svg' : '/icons/bfm-icon-black.svg'}
                      alt=""
                      width={16}
                      height={18}
                      className="inline ml-1 animate-icon-pulse"
                    />
                  )}
                </>
              ) : (
                <>
                  {/* File attachments for user messages */}
                  {message.metadata?.attachments && message.metadata.attachments.length > 0 && (
                    <FileAttachments
                      attachments={message.metadata.attachments}
                      variant="user"
                    />
                  )}
                  {message.content}
                  {isStreaming && (
                    <span className="inline-block w-2 h-4 ml-1 bg-white/70 animate-pulse" />
                  )}
                </>
              )}
            </div>
            {!isStreaming && message.createdAt && isUser && (
              <div className="text-xs mt-2 text-white/70">
                {new Date(message.createdAt).toLocaleTimeString([], {
                  hour: '2-digit',
                  minute: '2-digit',
                })}
              </div>
            )}
          </div>
        </ShimmerEffect>

        {/* Action buttons for assistant messages */}
        {isAssistant && actions.length > 0 && !isStreaming && !isThinking && (
          <ActionButtons actions={actions} />
        )}

        {/* Message actions (copy, thumbs up/down) for assistant messages */}
        {isAssistant && !isStreaming && !isThinking && message.content && (
          <MessageActions
            messageId={message.id}
            content={message.content}
            conversationId={message.conversationId}
          />
        )}
      </div>
    </div>
  )
}
