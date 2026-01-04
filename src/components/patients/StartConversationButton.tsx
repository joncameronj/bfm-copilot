'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/Button'
import toast from 'react-hot-toast'

interface StartConversationButtonProps {
  patientId: string
}

export function StartConversationButton({ patientId }: StartConversationButtonProps) {
  const router = useRouter()
  const [isLoading, setIsLoading] = useState(false)

  const handleClick = async () => {
    setIsLoading(true)

    try {
      const response = await fetch(`/api/patients/${patientId}/start-conversation`, {
        method: 'POST',
      })

      if (!response.ok) {
        throw new Error('Failed to start conversation')
      }

      const data = await response.json()

      // Store context in sessionStorage for ChatInterface to pick up
      sessionStorage.setItem('patientChatContext', JSON.stringify({
        context: data.context,
        quickActions: data.quickActions,
      }))

      // Navigate to the chat with the new conversation
      router.push(`/?conversation=${data.conversationId}`)
    } catch (error) {
      console.error('Error starting conversation:', error)
      toast.error('Failed to start conversation')
      setIsLoading(false)
    }
  }

  return (
    <Button
      variant="secondary"
      onClick={handleClick}
      isLoading={isLoading}
    >
      Start Conversation
    </Button>
  )
}
