'use client'

import { useState, useCallback, useRef, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import type { Message, ReasoningData, AgentStep, ActionButton, Attachment, Source, RagChunk, AgentHandoff } from '@/types/chat'
import { parseSSELines, parseSSEData } from '@/lib/utils/sse-parser'

const DEBUG_STREAMING = process.env.NODE_ENV === 'development'

interface UseChatOptions {
  conversationId?: string
  patientId?: string
  onError?: (error: Error) => void
}

interface UseChatReturn {
  messages: Message[]
  isLoading: boolean
  isThinking: boolean
  isReasoning: boolean
  isStreaming: boolean
  streamingMessageId: string | null
  currentReasoning: ReasoningData | null
  currentSteps: AgentStep[]
  currentActions: ActionButton[]
  currentSources: Source[]
  currentRagChunks: RagChunk[]
  currentAgentHandoffs: AgentHandoff[] // Agent SDK: track agent transitions
  thinkingStartTime: number | null
  error: string | null
  sendMessage: (content: string, files?: File[]) => Promise<void>
  cancelGeneration: () => void
  clearMessages: () => void
  setMessages: React.Dispatch<React.SetStateAction<Message[]>>
  retryLastMessage: () => void
}

// Helper function to map errors to user-friendly messages
function getErrorMessage(err: Error): string {
  const msg = err.message.toLowerCase()
  if (msg.includes('401') || msg.includes('unauthorized')) {
    return 'Your session has expired. Please sign in again.'
  }
  if (msg.includes('failed to fetch') || msg.includes('network') || msg.includes('fetch')) {
    return 'Network error. Please check your connection and try again.'
  }
  if (msg.includes('timeout') || msg.includes('timed out')) {
    return 'The request timed out. Please try again.'
  }
  if (msg.includes('rate limit') || msg.includes('429')) {
    return 'Too many requests. Please wait a moment and try again.'
  }
  return err.message || 'Something went wrong. Please try again.'
}

export function useChat(options: UseChatOptions = {}): UseChatReturn {
  const { conversationId, patientId, onError } = options
  const router = useRouter()

  // Local state for active conversation - takes ownership after creation
  // This prevents prop changes from clearing messages during active operations
  const [activeConversationId, setActiveConversationId] = useState<string | undefined>(conversationId)

  const [messages, setMessages] = useState<Message[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [isThinking, setIsThinking] = useState(false)
  const [isReasoning, setIsReasoning] = useState(false)
  const [isStreaming, setIsStreaming] = useState(false)
  const [streamingMessageId, setStreamingMessageId] = useState<string | null>(null)
  const [currentReasoning, setCurrentReasoning] = useState<ReasoningData | null>(null)
  const [currentSteps, setCurrentSteps] = useState<AgentStep[]>([])
  const [currentActions, setCurrentActions] = useState<ActionButton[]>([])
  const [currentSources, setCurrentSources] = useState<Source[]>([])
  const [currentRagChunks, setCurrentRagChunks] = useState<RagChunk[]>([])
  const [currentAgentHandoffs, setCurrentAgentHandoffs] = useState<AgentHandoff[]>([]) // Agent SDK
  const [thinkingStartTime, setThinkingStartTime] = useState<number | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [threadId, setThreadId] = useState<string | null>(null)

  const abortControllerRef = useRef<AbortController | null>(null)
  const lastFailedMessageRef = useRef<{ content: string; files?: File[] } | null>(null)
  const skipNextLoadRef = useRef(false)

  // Sync activeConversationId from props when navigating between conversations
  useEffect(() => {
    setActiveConversationId(conversationId)
  }, [conversationId])

  // Load existing messages when activeConversationId changes
  useEffect(() => {
    if (activeConversationId) {
      // Skip loading if we just created this conversation (we already have the messages)
      if (skipNextLoadRef.current) {
        skipNextLoadRef.current = false
        return
      }
      loadMessages(activeConversationId)
    } else {
      setMessages([])
      setThreadId(null)
    }
    // Only re-run when conversation ID actually changes, not on loading state changes
  }, [activeConversationId])

  const loadMessages = async (convId: string) => {
    try {
      const response = await fetch(`/api/conversations/${convId}/messages`)
      if (!response.ok) throw new Error('Failed to load messages')
      const data = await response.json()
      setMessages(data.messages || [])
      setThreadId(data.threadId || null)
    } catch (err) {
      console.error('Error loading messages:', err)
    }
  }

  const sendMessage = useCallback(
    async (content: string, files?: File[]) => {
      // Allow sending with just files (no text) or just text (no files)
      const hasContent = content.trim().length > 0
      const hasFiles = files && files.length > 0
      if ((!hasContent && !hasFiles) || isLoading) return

      setError(null)
      setIsLoading(true)
      setIsThinking(true)
      setThinkingStartTime(Date.now())
      setCurrentSteps([])
      setCurrentActions([])
      setCurrentSources([])
      setCurrentRagChunks([])
      setCurrentAgentHandoffs([])

      // Add user message optimistically
      const userMessage: Message = {
        id: crypto.randomUUID(),
        conversationId: activeConversationId || '',
        role: 'user',
        content: content.trim(),
        createdAt: new Date(),
      }
      setMessages((prev) => [...prev, userMessage])

      // Declare these outside try block so they're accessible in catch
      let assistantId = ''
      let reasoningText = ''
      let reasoningElapsedMs = 0

      try {
        // Create abort controller for cancellation
        abortControllerRef.current = new AbortController()

        // Determine the endpoint based on whether we have a thread
        let currentThreadId = threadId
        let currentConversationId = activeConversationId
        let isNewConversation = false

        // If no conversation, create one first
        if (!currentConversationId) {
          isNewConversation = true
          const createResponse = await fetch('/api/conversations', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              patientId,
              title: content.slice(0, 50) + (content.length > 50 ? '...' : ''),
            }),
            signal: abortControllerRef.current.signal,
          })

          if (!createResponse.ok) throw new Error('Failed to create conversation')

          const createData = await createResponse.json()
          currentConversationId = createData.conversation.id
          currentThreadId = createData.threadId

          setThreadId(currentThreadId)

          // Update local state to take ownership of this conversation
          // Skip the next load since we already have the messages in state
          skipNextLoadRef.current = true
          setActiveConversationId(currentConversationId)

          // Update URL using Next.js router (properly syncs with App Router)
          router.replace(`/?conversation=${currentConversationId}`, { scroll: false })
        }

        // Handle file uploads if present
        let fileIds: string[] | undefined
        let attachments: Attachment[] | undefined
        if (files && files.length > 0) {
          const formData = new FormData()
          files.forEach((file) => formData.append('files', file))

          const uploadResponse = await fetch('/api/upload/chat', {
            method: 'POST',
            body: formData,
            signal: abortControllerRef.current.signal,
          })

          if (!uploadResponse.ok) throw new Error('Failed to upload files')

          const uploadData = await uploadResponse.json()
          fileIds = uploadData.fileIds

          // Create attachment metadata from files
          attachments = files.map((file, i) => ({
            id: uploadData.fileIds[i] || crypto.randomUUID(),
            filename: file.name,
            mimeType: file.type || 'application/octet-stream',
            size: file.size,
            url: '', // OpenAI files don't have public URLs
          }))

          // Update the user message with attachment metadata
          setMessages((prev) =>
            prev.map((m) =>
              m.id === userMessage.id
                ? { ...m, metadata: { ...m.metadata, attachments } }
                : m
            )
          )
        }

        // Send message and get streaming response via Python agent
        const response = await fetch('/api/agent/chat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            message: content,
            fileIds,
            conversationId: currentConversationId,
          }),
          signal: abortControllerRef.current.signal,
        })

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}))
          throw new Error(errorData.error || `Request failed with status ${response.status}`)
        }

        // Handle streaming response
        const reader = response.body?.getReader()
        let assistantMessage = ''
        reasoningText = ''
        let reasoningSummary: string | undefined
        reasoningElapsedMs = 0

        // Add placeholder assistant message
        assistantId = crypto.randomUUID()
        setMessages((prev) => [
          ...prev,
          {
            id: assistantId,
            conversationId: currentConversationId || '',
            role: 'assistant',
            content: '',
            createdAt: new Date(),
          },
        ])

        // Keep isThinking=true until we receive actual streaming data
        // This ensures the thinking UI stays visible during the wait
        setStreamingMessageId(assistantId)

        if (reader) {
          // Use buffered SSE parser to handle chunks split across network boundaries
          console.log('[Streaming] Starting to read SSE stream...')
          let lineCount = 0
          for await (const line of parseSSELines(reader)) {
            lineCount++
            console.log(`[SSE Line ${lineCount}]`, line.slice(0, 80))
            try {
              const parsed = parseSSEData<{
                type: string
                delta?: string
                error?: string
                summary?: string
                elapsed_ms?: number
                step_id?: string
                label?: string
                actions?: ActionButton[]
                sources?: Source[]
                chunks?: RagChunk[]
              }>(line)

              // Skip non-data lines or [DONE] signal
              if (!parsed) continue

              if (DEBUG_STREAMING) {
                console.log('[SSE Event]', parsed.type, parsed.delta?.slice(0, 50))
              }

              // Handle error events from the server
              if (parsed.type === 'error') {
                throw new Error(parsed.error || 'An error occurred during streaming')
              }

              // Handle reasoning events (agent thinking)
              // Always set state - React batches identical updates
              if (parsed.type === 'reasoning_delta') {
                setIsThinking(false)
                setIsReasoning(true)
                reasoningText += parsed.delta || ''
                reasoningElapsedMs = parsed.elapsed_ms || 0
                setCurrentReasoning({
                  text: reasoningText,
                  elapsedMs: reasoningElapsedMs,
                })
              }

              if (parsed.type === 'reasoning_done') {
                reasoningSummary = parsed.summary
                reasoningElapsedMs = parsed.elapsed_ms || reasoningElapsedMs
                setCurrentReasoning({
                  text: reasoningText,
                  summary: reasoningSummary,
                  elapsedMs: reasoningElapsedMs,
                })
                setIsReasoning(false)
                setIsStreaming(true)
              }

              // Handle text response events
              // Always set streaming state - no stale closure check needed
              if (parsed.type === 'text_delta' && parsed.delta) {
                setIsThinking(false)
                setIsStreaming(true)
                setIsReasoning(false)
                assistantMessage += parsed.delta
                setMessages((prev) =>
                  prev.map((m) =>
                    m.id === assistantId
                      ? { ...m, content: assistantMessage }
                      : m
                  )
                )
              }

              // Handle step events
              // Note: Don't clear isThinking on step_start - keep the spinner
              // until we get actual content or reasoning
              if (parsed.type === 'step_start') {
                const newStep: AgentStep = {
                  id: parsed.step_id!,
                  label: parsed.label || 'Processing...',
                  status: 'in_progress',
                  startTime: Date.now(),
                }
                setCurrentSteps((prev) => [...prev, newStep])
              }

              if (parsed.type === 'step_complete') {
                setCurrentSteps((prev) =>
                  prev.map((step) =>
                    step.id === parsed.step_id
                      ? { ...step, status: 'completed', endTime: Date.now() }
                      : step
                  )
                )
              }

              if (parsed.type === 'step_error') {
                setCurrentSteps((prev) =>
                  prev.map((step) =>
                    step.id === parsed.step_id
                      ? { ...step, status: 'error', error: parsed.error, endTime: Date.now() }
                      : step
                  )
                )
              }

              // Handle action buttons event
              if (parsed.type === 'action_buttons' && parsed.actions) {
                setCurrentActions(parsed.actions)
              }

              // Handle sources event
              if (parsed.type === 'sources' && parsed.sources) {
                const newSources = parsed.sources
                setCurrentSources((prev) => [...prev, ...newSources])
              }

              // Handle RAG chunks event
              if (parsed.type === 'rag_chunks' && parsed.chunks) {
                const newChunks = parsed.chunks as RagChunk[]
                setCurrentRagChunks((prev) => [...prev, ...newChunks])
              }

              // Handle agent handoff events (Agent SDK feature)
              if (parsed.type === 'agent_handoff') {
                const handoff: AgentHandoff = {
                  fromAgent: (parsed as { from_agent?: string }).from_agent || null,
                  toAgent: (parsed as { to_agent?: string }).to_agent || 'unknown',
                  reason: (parsed as { reason?: string }).reason || 'Agent switched',
                  timestamp: new Date(),
                }
                setCurrentAgentHandoffs((prev) => [...prev, handoff])

                // Also add as a step for visibility in the UI
                setCurrentSteps((prev) => [
                  ...prev,
                  {
                    id: `handoff-${Date.now()}`,
                    label: `Handing off to ${handoff.toAgent}...`,
                    status: 'completed',
                    startTime: Date.now(),
                    endTime: Date.now(),
                  },
                ])
              }

              // Handle done event
              if (parsed.type === 'done') {
                console.log('[SSE] Stream completed normally')
              }
            } catch (parseError) {
              // Log parse errors for debugging - don't silently swallow
              console.error('[SSE Parse Error]', {
                line: line.slice(0, 100),
                error: parseError instanceof Error ? parseError.message : parseError,
              })
              // Re-throw business errors (not JSON parse errors)
              if (parseError instanceof Error && parseError.message.includes('error occurred')) {
                throw parseError
              }
            }
          }
          console.log(`[Streaming] Finished reading. Total lines: ${lineCount}, assistantMessage length: ${assistantMessage.length}`)

          // Warn if stream completed with no text output
          if (!assistantMessage.trim()) {
            console.warn('[Streaming] WARNING: Stream completed with no text output. Agent may have encountered an issue or timed out.')
          }
        }

        // Attach reasoning data and RAG chunks to the final message metadata
        const finalReasoning = reasoningText
          ? { text: reasoningText, summary: reasoningSummary, elapsedMs: reasoningElapsedMs }
          : undefined

        // Update message with reasoning metadata, RAG chunks, and ensure content is preserved
        setMessages((prev) =>
          prev.map((m) =>
            m.id === assistantId
              ? {
                  ...m,
                  content: assistantMessage || (currentSteps.length > 0 ? 'Processing your request...' : m.content),
                  metadata: {
                    ...m.metadata,
                    ...(finalReasoning ? { reasoning: finalReasoning } : {}),
                    ...(currentRagChunks.length > 0 ? { ragChunks: currentRagChunks } : {}),
                  },
                }
              : m
          )
        )

        // Save messages to database (include attachments if present)
        await saveMessageToDb(currentConversationId!, {
          ...userMessage,
          metadata: attachments ? { attachments } : undefined,
        })

        // Only save assistant message if there's content OR reasoning
        // If no content but has reasoning, save with placeholder
        const hasContent = assistantMessage.trim().length > 0
        const hasReasoning = !!finalReasoning
        if (hasContent || hasReasoning) {
          await saveMessageToDb(currentConversationId!, {
            id: assistantId,
            conversationId: currentConversationId!,
            role: 'assistant',
            content: assistantMessage || '*(No response generated)*',
            metadata: finalReasoning ? { reasoning: finalReasoning } : undefined,
            createdAt: new Date(),
          })
        }

        // Generate AI title for new conversations (fire and forget)
        if (isNewConversation && currentConversationId) {
          generateConversationTitle(currentConversationId).catch((err) => {
            console.error('Failed to generate conversation title:', err)
          })
        }
      } catch (err) {
        if (err instanceof Error && err.name !== 'AbortError') {
          const errorMessage = getErrorMessage(err)
          setError(errorMessage)
          onError?.(err)

          // Save failed message for retry
          lastFailedMessageRef.current = { content, files }

          // Only remove messages if we got NO response at all (no content and no reasoning)
          // If we have partial content or reasoning, keep it visible
          setMessages((prev) => {
            const assistantMsg = prev.find((m) => m.id === assistantId)
            const hasPartialContent = assistantMsg?.content && assistantMsg.content.length > 0
            const hasReasoning = reasoningText.length > 0

            if (hasPartialContent || hasReasoning) {
              // Keep the messages but update assistant with error indicator and reasoning
              return prev.map((m) =>
                m.id === assistantId
                  ? {
                      ...m,
                      content: m.content || '*(Response interrupted)*',
                      metadata: {
                        ...m.metadata,
                        ...(hasReasoning
                          ? { reasoning: { text: reasoningText, elapsedMs: reasoningElapsedMs } }
                          : {}),
                      },
                    }
                  : m
              )
            } else {
              // No content at all - remove both messages
              return prev.filter((m) => m.id !== userMessage.id && m.id !== assistantId)
            }
          })
        }
      } finally {
        setIsLoading(false)
        setIsThinking(false)
        setIsReasoning(false)
        setIsStreaming(false)
        setStreamingMessageId(null)
        setCurrentReasoning(null)
        setThinkingStartTime(null)
        // Note: We keep currentSteps and currentActions for display in message metadata
        abortControllerRef.current = null
      }
    },
    [activeConversationId, patientId, threadId, isLoading, onError, router]
  )

  const cancelGeneration = useCallback(() => {
    abortControllerRef.current?.abort()

    // Update the streaming message to show "Copilot interrupted."
    if (streamingMessageId) {
      setMessages((prev) =>
        prev.map((m) =>
          m.id === streamingMessageId
            ? {
                ...m,
                content: 'Copilot interrupted.',
                metadata: { ...m.metadata, interrupted: true },
              }
            : m
        )
      )
    }

    setIsLoading(false)
    setIsThinking(false)
    setIsReasoning(false)
    setIsStreaming(false)
    setStreamingMessageId(null)
    setCurrentReasoning(null)
    setCurrentSteps([])
    setCurrentActions([])
    setCurrentSources([])
    setCurrentRagChunks([])
    setCurrentAgentHandoffs([])
    setThinkingStartTime(null)
  }, [streamingMessageId])

  const clearMessages = useCallback(() => {
    setMessages([])
    setError(null)
  }, [])

  const retryLastMessage = useCallback(() => {
    if (lastFailedMessageRef.current) {
      const { content, files } = lastFailedMessageRef.current
      lastFailedMessageRef.current = null
      setError(null)
      sendMessage(content, files)
    }
  }, [sendMessage])

  return {
    messages,
    isLoading,
    isThinking,
    isReasoning,
    isStreaming,
    streamingMessageId,
    currentReasoning,
    currentSteps,
    currentActions,
    currentSources,
    currentRagChunks,
    currentAgentHandoffs,
    thinkingStartTime,
    error,
    sendMessage,
    cancelGeneration,
    clearMessages,
    setMessages,
    retryLastMessage,
  }
}

async function saveMessageToDb(conversationId: string, message: Message) {
  try {
    await fetch(`/api/conversations/${conversationId}/messages`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(message),
    })
  } catch (error) {
    console.error('Failed to save message:', error)
  }
}

async function generateConversationTitle(conversationId: string): Promise<void> {
  try {
    const response = await fetch(
      `/api/conversations/${conversationId}/generate-title`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      }
    )
    if (!response.ok) {
      throw new Error('Failed to generate title')
    }
  } catch (error) {
    console.error('Failed to generate conversation title:', error)
  }
}
