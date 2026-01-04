import { ChatInterface } from '@/components/chat/ChatInterface'

interface PageProps {
  searchParams: Promise<{ conversation?: string; patient?: string }>
}

export default async function HomePage({ searchParams }: PageProps) {
  const params = await searchParams
  const conversationId = params.conversation
  const patientId = params.patient

  return (
    <div className="h-screen">
      <ChatInterface
        conversationId={conversationId}
        patientId={patientId}
      />
    </div>
  )
}
