'use client'

import { useRef, useEffect, useMemo, useState, useCallback } from 'react'
import toast from 'react-hot-toast'
import { ChatInput } from './ChatInput'
import { MessageList } from './MessageList'
import { EmptyState } from './EmptyState'
import { PatientContextCard } from './PatientContextCard'
import { QuickActionsBar } from './QuickActionsBar'
import { useChat } from '@/hooks/useChat'
import { useVoiceInput } from '@/hooks/useVoiceInput'
import { useRole } from '@/hooks/useRole'
import { useBackgroundJobsOptional } from '@/providers/BackgroundJobsProvider'
import type { PatientChatContext, QuickAction } from '@/types/patient-context'

interface ChatInterfaceProps {
  conversationId?: string
  patientId?: string
}

export function ChatInterface({ conversationId, patientId }: ChatInterfaceProps) {
  const { user, role } = useRole()
  const backgroundJobs = useBackgroundJobsOptional()

  // Patient context state for conversations started from patient profile
  const [patientContext, setPatientContext] = useState<PatientChatContext | null>(null)
  const [quickActions, setQuickActions] = useState<QuickAction[]>([])
  const [hasUserSentMessage, setHasUserSentMessage] = useState(false)
  const [isInitializing, setIsInitializing] = useState(false)
  const initializedRef = useRef(false)

  const {
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
    currentDeepDiveNotices,
    thinkingStartTime,
    error,
    sendMessage,
    cancelGeneration,
    retryLastMessage,
    activeConversationId,
    lastSentMessage,
  } = useChat({ conversationId, patientId })

  // Handle moving current generation to background
  const handleMoveToBackground = useCallback(async () => {
    if (!backgroundJobs || !activeConversationId || !lastSentMessage) {
      toast.error('Unable to move to background')
      return
    }

    if (!backgroundJobs.canStartNewJob) {
      toast.error('Maximum background jobs reached (3). Please wait for one to complete.')
      return
    }

    try {
      // Create background job with the current message
      const jobId = await backgroundJobs.startBackgroundJob(
        activeConversationId,
        lastSentMessage,
        { user_role: role || 'member' }
      )

      if (jobId) {
        // Cancel current generation (this removes the partial response)
        cancelGeneration()

        // Remove the user message and partial assistant message from UI
        // since the background job will handle it fresh
        // Note: We keep messages to avoid jarring UX - the job will save new ones

        toast.success('Moved to background. Check the overlay to track progress.')
      } else {
        toast.error('Failed to create background job')
      }
    } catch (err) {
      console.error('Failed to move to background:', err)
      toast.error('Failed to move to background')
    }
  }, [backgroundJobs, activeConversationId, lastSentMessage, cancelGeneration, role])

  const {
    isListening,
    isSupported,
    transcript,
    interimTranscript,
    startListening,
    stopListening,
    resetTranscript,
  } = useVoiceInput({
    continuous: true,
  })

  // Extract first name from full name, handling titles like "Dr."
  const firstName = useMemo(() => {
    if (!user?.fullName) return null
    const parts = user.fullName.split(' ')
    if (parts.length === 0) return null

    // Common titles to check for
    const titles = ['Dr.', 'Dr', 'Mr.', 'Mr', 'Mrs.', 'Mrs', 'Ms.', 'Ms', 'Prof.', 'Prof']
    const firstWord = parts[0]

    // If first word is a title and there's a name after it, include both
    if (titles.includes(firstWord) && parts.length > 1) {
      return `${firstWord} ${parts[1]}`
    }

    return firstWord || null
  }, [user?.fullName])

  const messagesEndRef = useRef<HTMLDivElement>(null)

  // Auto-scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  // Show toast notification when error occurs
  useEffect(() => {
    if (error) {
      toast.error(error)
    }
  }, [error])

  // Load patient context from sessionStorage (set by patient profile page)
  useEffect(() => {
    if (initializedRef.current) return

    const storedData = sessionStorage.getItem('patientChatContext')
    if (storedData) {
      try {
        const data = JSON.parse(storedData)
        setPatientContext(data.context)
        setQuickActions(data.quickActions || [])
        sessionStorage.removeItem('patientChatContext')

        // Auto-trigger AI opening message
        if (data.context && !initializedRef.current) {
          initializedRef.current = true
          setIsInitializing(true)

          // Send a prompt to get the AI to generate an opening
          const openingPrompt = `I'm starting a consultation for ${data.context.patient.name}. Please introduce yourself and acknowledge that you've reviewed their profile, then ask what I need help with today.`
          sendMessage(openingPrompt).finally(() => {
            setIsInitializing(false)
          })
        }
      } catch (e) {
        console.error('Failed to parse patient context:', e)
        sessionStorage.removeItem('patientChatContext')
      }
    }
  }, [sendMessage])

  const handleSend = (
    content: string,
    files?: File[],
    options?: { webSearch?: boolean; deepDive?: boolean }
  ) => {
    // Track when user sends their first real message (not the auto-opening)
    if (patientContext && !isInitializing) {
      setHasUserSentMessage(true)
    }
    // Stop listening and reset transcript if voice was active
    if (isListening) {
      stopListening()
    }
    resetTranscript()
    sendMessage(content, files, options)
  }

  const handleQuickAction = (prompt: string) => {
    setHasUserSentMessage(true)
    sendMessage(prompt)
  }

  const hasMessages = messages.length > 0

  // Common voice props for ChatInput
  const voiceProps = {
    isListening,
    isVoiceSupported: isSupported,
    transcript,
    interimTranscript,
    onStartListening: isSupported ? startListening : undefined,
    onStopListening: isSupported ? stopListening : undefined,
  }

  return (
    <div className="flex flex-col h-full">
      {/* Messages area with blur overlay */}
      <div className="flex-1 overflow-y-auto overscroll-contain relative">
        {!hasMessages ? (
          <EmptyState
            onSend={handleSend}
            onStop={cancelGeneration}
            isLoading={isLoading}
            firstName={firstName}
            {...voiceProps}
          />
        ) : (
          <div className="max-w-3xl mx-auto px-4">
            {/* Patient Context Card - shown at start of patient consultations */}
            {patientContext && (
              <div className="py-4">
                <PatientContextCard context={patientContext} />
              </div>
            )}

            <MessageList
              messages={messages}
              isThinking={isThinking}
              isReasoning={isReasoning}
              isStreaming={isStreaming}
              streamingMessageId={streamingMessageId}
              currentReasoning={currentReasoning}
              currentSteps={currentSteps}
              currentActions={currentActions}
              currentSources={currentSources}
              currentRagChunks={currentRagChunks}
              currentDeepDiveNotices={currentDeepDiveNotices}
              thinkingStartTime={thinkingStartTime}
            />

            {/* Quick Actions - shown after AI opening, hidden after user sends first message */}
            {patientContext && quickActions.length > 0 && !hasUserSentMessage && !isLoading && messages.length >= 2 && (
              <div className="pb-4">
                <QuickActionsBar
                  actions={quickActions}
                  onActionClick={handleQuickAction}
                  disabled={isLoading}
                />
              </div>
            )}
          </div>
        )}
        <div ref={messagesEndRef} />
        {/* Blur overlay at bottom - above chat input */}
        {hasMessages && (
          <div
            className="sticky bottom-0 left-0 right-0 h-16 pointer-events-none z-10"
            style={{
              background: 'linear-gradient(to top, rgba(255,255,255,1) 0%, rgba(255,255,255,0.8) 40%, rgba(255,255,255,0) 100%)',
              backdropFilter: 'blur(8px)',
              WebkitBackdropFilter: 'blur(8px)',
              maskImage: 'linear-gradient(to top, black 0%, transparent 100%)',
              WebkitMaskImage: 'linear-gradient(to top, black 0%, transparent 100%)',
            }}
          />
        )}
      </div>

      {/* Error banner with retry button */}
      {error && (
        <div className="mx-4 mb-2 p-4 bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 rounded-xl">
          <div className="flex items-start justify-between gap-3">
            <div className="flex-1">
              <p className="text-red-700 dark:text-red-400 text-sm font-medium">Something went wrong</p>
              <p className="text-red-600 dark:text-red-300 text-sm mt-1">{error}</p>
            </div>
            <button
              onClick={retryLastMessage}
              className="px-3 py-1.5 text-sm font-medium text-red-700 dark:text-red-400 bg-red-100 dark:bg-red-900/50 hover:bg-red-200 dark:hover:bg-red-900/70 rounded-lg transition-colors"
            >
              Try again
            </button>
          </div>
        </div>
      )}

      {/* Input area - always visible */}
      {hasMessages && (
        <div className="p-4 bg-white dark:bg-neutral-900">
          <div className="max-w-3xl mx-auto">
            <ChatInput
              onSend={handleSend}
              onStop={cancelGeneration}
              onMoveToBackground={backgroundJobs ? handleMoveToBackground : undefined}
              isLoading={isLoading}
              {...voiceProps}
            />
            <p className="text-xs text-neutral-400 text-center mt-2">
              Copilot can make mistakes. Always verify information before taking action on protocols.
            </p>
          </div>
        </div>
      )}
    </div>
  )
}
