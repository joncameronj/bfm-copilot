'use client'

import { useState, useCallback, useRef, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import type { Message, ReasoningData, AgentStep, ActionButton, Attachment, Source } from '@/types/chat'

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

      // Add user message optimistically
      const userMessage: Message = {
        id: crypto.randomUUID(),
        conversationId: activeConversationId || '',
        role: 'user',
        content: content.trim(),
        createdAt: new Date(),
      }
      setMessages((prev) => [...prev, userMessage])

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
        const decoder = new TextDecoder()
        let assistantMessage = ''
        let reasoningText = ''
        let reasoningSummary: string | undefined
        let reasoningElapsedMs = 0

        // Add placeholder assistant message
        const assistantId = crypto.randomUUID()
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
          try {
            while (true) {
              const { done, value } = await reader.read()
              if (done) break

              const chunk = decoder.decode(value)
              const lines = chunk.split('\n')

              for (const line of lines) {
                if (line.startsWith('data: ')) {
                  const data = line.slice(6)
                  if (data === '[DONE]') continue

                  try {
                    const parsed = JSON.parse(data)

                    // Handle error events from the server
                    if (parsed.type === 'error') {
                      throw new Error(parsed.error || 'An error occurred during streaming')
                    }

                    // Handle reasoning events (agent thinking)
                    if (parsed.type === 'reasoning_delta') {
                      // Turn off thinking indicator, now we have reasoning data
                      setIsThinking(false)
                      if (!isReasoning) {
                        setIsReasoning(true)
                      }
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
                    if (parsed.type === 'text_delta' && parsed.delta) {
                      // Turn off thinking indicator, now we have text streaming
                      setIsThinking(false)
                      if (!isStreaming) {
                        setIsStreaming(true)
                        setIsReasoning(false)
                      }
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
                    if (parsed.type === 'step_start') {
                      // Turn off initial thinking indicator, steps are now showing
                      setIsThinking(false)
                      const newStep: AgentStep = {
                        id: parsed.step_id,
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
                      setCurrentSources((prev) => [...prev, ...parsed.sources])
                    }
                  } catch (parseError) {
                    // Re-throw actual errors (not JSON parse errors)
                    if (parseError instanceof Error && parseError.message !== 'Unexpected token') {
                      if (parseError.message.includes('error occurred')) {
                        throw parseError
                      }
                    }
                    // Ignore malformed JSON chunks
                  }
                }
              }
            }
          } finally {
            reader.releaseLock()
          }
        }

        // Attach reasoning data to the final message metadata
        const finalReasoning = reasoningText
          ? { text: reasoningText, summary: reasoningSummary, elapsedMs: reasoningElapsedMs }
          : undefined

        // Update message with reasoning metadata
        if (finalReasoning) {
          setMessages((prev) =>
            prev.map((m) =>
              m.id === assistantId
                ? { ...m, metadata: { ...m.metadata, reasoning: finalReasoning } }
                : m
            )
          )
        }

        // Save messages to database (include attachments if present)
        await saveMessageToDb(currentConversationId!, {
          ...userMessage,
          metadata: attachments ? { attachments } : undefined,
        })
        await saveMessageToDb(currentConversationId!, {
          id: assistantId,
          conversationId: currentConversationId!,
          role: 'assistant',
          content: assistantMessage,
          metadata: finalReasoning ? { reasoning: finalReasoning } : undefined,
          createdAt: new Date(),
        })

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

          // Remove the user message if the request failed
          setMessages((prev) => prev.filter((m) => m.id !== userMessage.id))
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
    [activeConversationId, patientId, threadId, isLoading, isReasoning, isStreaming, onError, router]
  )

  const cancelGeneration = useCallback(() => {
    abortControllerRef.current?.abort()
    setIsLoading(false)
    setIsThinking(false)
    setIsReasoning(false)
    setIsStreaming(false)
    setStreamingMessageId(null)
    setCurrentReasoning(null)
    setCurrentSteps([])
    setCurrentActions([])
    setCurrentSources([])
    setThinkingStartTime(null)
  }, [])

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
