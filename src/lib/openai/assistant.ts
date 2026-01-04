import OpenAI from 'openai'

// Initialize OpenAI client (server-side only)
export function getOpenAIClient(): OpenAI {
  const apiKey = process.env.OPENAI_API_KEY
  if (!apiKey) {
    throw new Error('OPENAI_API_KEY environment variable is not set')
  }
  return new OpenAI({ apiKey })
}

// Get the assistant ID from environment
export function getAssistantId(): string {
  const assistantId = process.env.OPENAI_ASSISTANT_ID
  if (!assistantId) {
    throw new Error('OPENAI_ASSISTANT_ID environment variable is not set')
  }
  return assistantId
}

// Create a new thread
export async function createThread(): Promise<OpenAI.Beta.Threads.Thread> {
  const openai = getOpenAIClient()
  const thread = await openai.beta.threads.create()
  return thread
}

// Add a message to a thread
export async function addMessage(
  threadId: string,
  content: string,
  fileIds?: string[]
): Promise<OpenAI.Beta.Threads.Messages.Message> {
  const openai = getOpenAIClient()

  const messageParams: OpenAI.Beta.Threads.Messages.MessageCreateParams = {
    role: 'user',
    content,
  }

  // Add file attachments if provided
  if (fileIds && fileIds.length > 0) {
    messageParams.attachments = fileIds.map((fileId) => ({
      file_id: fileId,
      tools: [{ type: 'file_search' as const }],
    }))
  }

  const message = await openai.beta.threads.messages.create(threadId, messageParams)
  return message
}

// Get messages from a thread
export async function getMessages(
  threadId: string,
  limit = 100
): Promise<OpenAI.Beta.Threads.Messages.Message[]> {
  const openai = getOpenAIClient()

  const response = await openai.beta.threads.messages.list(threadId, {
    limit,
    order: 'asc',
  })

  return response.data
}

// Run the assistant (non-streaming)
export async function runAssistant(
  threadId: string,
  instructions?: string
): Promise<OpenAI.Beta.Threads.Runs.Run> {
  const openai = getOpenAIClient()
  const assistantId = getAssistantId()

  const run = await openai.beta.threads.runs.create(threadId, {
    assistant_id: assistantId,
    instructions,
  })

  return run
}

// Run the assistant with streaming
export function streamAssistant(
  threadId: string,
  instructions?: string
): ReturnType<typeof OpenAI.prototype.beta.threads.runs.stream> {
  const openai = getOpenAIClient()
  const assistantId = getAssistantId()

  return openai.beta.threads.runs.stream(threadId, {
    assistant_id: assistantId,
    instructions,
  })
}

// Wait for a run to complete
export async function waitForRun(
  threadId: string,
  runId: string,
  pollInterval = 1000,
  maxAttempts = 60
): Promise<OpenAI.Beta.Threads.Runs.Run> {
  const openai = getOpenAIClient()

  let attempts = 0
  while (attempts < maxAttempts) {
    const run = await openai.beta.threads.runs.retrieve(runId, { thread_id: threadId })

    if (['completed', 'failed', 'cancelled', 'expired'].includes(run.status)) {
      return run
    }

    if (run.status === 'requires_action') {
      // Handle tool calls if needed
      return run
    }

    await new Promise((resolve) => setTimeout(resolve, pollInterval))
    attempts++
  }

  throw new Error('Run timed out')
}

// Cancel a run
export async function cancelRun(
  threadId: string,
  runId: string
): Promise<OpenAI.Beta.Threads.Runs.Run> {
  const openai = getOpenAIClient()
  const run = await openai.beta.threads.runs.cancel(runId, { thread_id: threadId })
  return run
}

// Upload a file for the assistant
export async function uploadFile(
  file: Buffer | Blob,
  filename: string,
  purpose: 'assistants' | 'vision' = 'assistants'
): Promise<OpenAI.Files.FileObject> {
  const openai = getOpenAIClient()

  // Convert Buffer to Uint8Array for File constructor compatibility
  const fileContent = Buffer.isBuffer(file) ? new Uint8Array(file) : file

  const fileObject = await openai.files.create({
    file: new File([fileContent], filename),
    purpose,
  })

  return fileObject
}

// Delete a file
export async function deleteFile(fileId: string): Promise<OpenAI.Files.FileDeleted> {
  const openai = getOpenAIClient()
  const result = await openai.files.delete(fileId)
  return result
}
