'use client'

import { useState } from 'react'
import Image from 'next/image'
import { cn } from '@/lib/utils'
import { ReasoningDisplay } from './ReasoningDisplay'
import { AgentActivity } from './AgentActivity'
import { ThinkingIndicator } from './ThinkingIndicator'
import { ShimmerEffect } from './ShimmerEffect'
import { ActionButtons } from './ActionButtons'
import { MessageActions } from './MessageActions'
import { FileAttachments } from './FileAttachments'
import type { Message, ReasoningData, AgentStep, ActionButton, Source, RagChunk } from '@/types/chat'
import ReactMarkdown from 'react-markdown'
import { useTheme } from '@/providers/ThemeProvider'

// Helper to extract and remove source citations from content
function extractSources(content: string): { cleanContent: string; inlineSources: string[] } {
  // Match patterns like [Source: X] or [Source: X; Y; Z] or [Sources: X; Y]
  const sourcePattern = /\[Sources?:\s*([^\]]+)\]/gi
  const inlineSources: string[] = []

  const cleanContent = content.replace(sourcePattern, (match, sourcesStr) => {
    // Split by semicolon and clean up each source
    const sources = sourcesStr.split(';').map((s: string) =>
      s.trim()
        .replace(/^\*+|\*+$/g, '') // Remove surrounding asterisks
        .replace(/^_+|_+$/g, '')   // Remove surrounding underscores
        .trim()
    ).filter((s: string) => s.length > 0)

    inlineSources.push(...sources)
    return '' // Remove from content
  })

  return { cleanContent: cleanContent.trim(), inlineSources }
}

interface ChatMessageProps {
  message: Message
  isStreaming?: boolean
  isReasoning?: boolean
  isThinking?: boolean
  currentReasoning?: ReasoningData | null
  currentSteps?: AgentStep[]
  currentActions?: ActionButton[]
  currentSources?: Source[]
  currentRagChunks?: RagChunk[]
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
  currentRagChunks = [],
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

  // Use current RAG chunks if available, otherwise use stored chunks
  const ragChunks = currentRagChunks.length > 0 ? currentRagChunks : message.metadata?.ragChunks || []

  // Check if message was interrupted
  const isInterrupted = message.metadata?.interrupted === true

  // Show shimmer only when streaming but no content yet (brief moment)
  const showShimmer = isStreaming && !message.content

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
        {/* Thinking indicator - shows immediately when thinking starts */}
        {isAssistant && isThinking && steps.length === 0 && sources.length === 0 && !message.content && (
          <ThinkingIndicator startTime={thinkingStartTime} />
        )}

        {/* Agent activity display for assistant messages - shows when we have steps or sources */}
        {isAssistant && (steps.length > 0 || sources.length > 0) && (
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
                ? 'rounded-2xl px-4 py-3 bg-black text-white font-semibold'
                : 'text-neutral-900 dark:text-neutral-50',
              showShimmer && 'min-h-[60px]'
            )}
          >
            <div className={cn(
              'break-words',
              isAssistant
                ? 'prose dark:prose-invert max-w-none prose-p:my-2 prose-ul:my-2 prose-ol:my-2 prose-li:my-0 prose-strong:font-bold prose-h1:text-2xl prose-h1:font-bold prose-h1:mt-4 prose-h1:mb-2 prose-h2:text-xl prose-h2:font-bold prose-h2:mt-3 prose-h2:mb-2 prose-h3:text-lg prose-h3:font-semibold prose-h3:mt-2 prose-h3:mb-1 font-semibold'
                : 'whitespace-pre-wrap'
            )}>
              {isAssistant ? (
                (() => {
                  const { cleanContent, inlineSources } = extractSources(message.content)
                  return (
                    <>
                      {isInterrupted ? (
                        <span className="text-red-400 italic">{message.content}</span>
                      ) : (
                        <ReactMarkdown>{cleanContent}</ReactMarkdown>
                      )}
                      {isStreaming && (
                        <Image
                          src={resolvedTheme === 'dark' ? '/icons/bfm-icon.svg' : '/icons/bfm-icon-black.svg'}
                          alt=""
                          width={16}
                          height={18}
                          className="inline ml-1 animate-icon-pulse"
                        />
                      )}
                      {/* Inline source citations as button-like tags */}
                      {!isStreaming && inlineSources.length > 0 && (
                        <div className="flex flex-wrap gap-2 mt-4 not-prose">
                          {inlineSources.map((source, idx) => (
                            <span
                              key={idx}
                              className="inline-block px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wide bg-[#f5f5f5] dark:bg-neutral-800 text-neutral-600 dark:text-neutral-400 rounded-md"
                            >
                              {source}
                            </span>
                          ))}
                        </div>
                      )}
                    </>
                  )
                })()
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

        {/* RAG chunks display for dev debugging */}
        {isAssistant && ragChunks.length > 0 && !isStreaming && (
          <RagChunksDisplay chunks={ragChunks} />
        )}

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

// RAG chunks display component for dev debugging
function RagChunksDisplay({ chunks }: { chunks: RagChunk[] }) {
  const [isOpen, setIsOpen] = useState(false)

  if (!chunks.length) return null

  return (
    <div className="mt-3 text-xs">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="text-neutral-500 hover:text-neutral-700 dark:text-neutral-400 dark:hover:text-neutral-200 flex items-center gap-2 transition-colors"
      >
        <span className="text-lg">{isOpen ? '▼' : '▶'}</span>
        <span className="font-semibold">Sources ({chunks.length})</span>
      </button>

      {isOpen && (
        <div className="mt-3 space-y-3 pl-6 border-l border-neutral-200 dark:border-neutral-800">
          {chunks.map((chunk, idx) => (
            <div
              key={chunk.id}
              className="p-3 bg-neutral-50 dark:bg-neutral-900/50 rounded border border-neutral-200 dark:border-neutral-800 text-xs"
            >
              <div className="space-y-2">
                <div>
                  <span className="font-semibold text-neutral-900 dark:text-neutral-100">
                    {chunk.title}
                  </span>
                  {chunk.filename && (
                    <span className="text-neutral-500 dark:text-neutral-400 ml-2">
                      ({chunk.filename})
                    </span>
                  )}
                </div>

                <div className="text-neutral-600 dark:text-neutral-400 leading-relaxed max-h-24 overflow-y-auto">
                  {chunk.content.substring(0, 300)}
                  {chunk.content.length > 300 && '...'}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
