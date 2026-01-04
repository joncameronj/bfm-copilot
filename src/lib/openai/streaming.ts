import { getOpenAIClient, getAssistantId } from './assistant'

export interface StreamEvent {
  type: 'text_delta' | 'text_done' | 'tool_call' | 'tool_result' | 'error' | 'done'
  delta?: string
  content?: string
  toolCall?: {
    id: string
    type: string
    function: {
      name: string
      arguments: string
    }
  }
  error?: string
}

// Create a ReadableStream that emits SSE events
export function createStreamingResponse(
  threadId: string,
  instructions?: string
): ReadableStream<Uint8Array> {
  const openai = getOpenAIClient()
  const assistantId = getAssistantId()

  const encoder = new TextEncoder()

  return new ReadableStream({
    async start(controller) {
      try {
        const stream = openai.beta.threads.runs.stream(threadId, {
          assistant_id: assistantId,
          instructions,
        })

        for await (const event of stream) {
          let sseData: StreamEvent | null = null

          switch (event.event) {
            case 'thread.message.delta':
              const delta = event.data.delta
              if (delta.content) {
                for (const content of delta.content) {
                  if (content.type === 'text' && content.text?.value) {
                    sseData = {
                      type: 'text_delta',
                      delta: content.text.value,
                    }
                  }
                }
              }
              break

            case 'thread.message.completed':
              const message = event.data
              if (message.content) {
                for (const content of message.content) {
                  if (content.type === 'text') {
                    sseData = {
                      type: 'text_done',
                      content: content.text.value,
                    }
                  }
                }
              }
              break

            case 'thread.run.step.delta':
              const stepDelta = event.data.delta
              if (stepDelta.step_details?.type === 'tool_calls') {
                const toolCalls = stepDelta.step_details.tool_calls
                if (toolCalls) {
                  for (const toolCall of toolCalls) {
                    if (toolCall.type === 'function' && toolCall.function) {
                      sseData = {
                        type: 'tool_call',
                        toolCall: {
                          id: toolCall.id || '',
                          type: 'function',
                          function: {
                            name: toolCall.function.name || '',
                            arguments: toolCall.function.arguments || '',
                          },
                        },
                      }
                    }
                  }
                }
              }
              break

            case 'thread.run.completed':
              sseData = { type: 'done' }
              break

            case 'thread.run.failed':
              sseData = {
                type: 'error',
                error: event.data.last_error?.message || 'Run failed',
              }
              break
          }

          if (sseData) {
            const sseEvent = `data: ${JSON.stringify(sseData)}\n\n`
            controller.enqueue(encoder.encode(sseEvent))
          }
        }

        // Send done event
        controller.enqueue(encoder.encode('data: [DONE]\n\n'))
        controller.close()
      } catch (error) {
        const errorMessage =
          error instanceof Error ? error.message : 'Unknown error'
        const sseEvent = `data: ${JSON.stringify({ type: 'error', error: errorMessage })}\n\n`
        controller.enqueue(encoder.encode(sseEvent))
        controller.close()
      }
    },
  })
}

// Parse SSE stream on the client side
export async function* parseSSEStream(
  reader: ReadableStreamDefaultReader<Uint8Array>
): AsyncGenerator<StreamEvent> {
  const decoder = new TextDecoder()
  let buffer = ''

  while (true) {
    const { done, value } = await reader.read()
    if (done) break

    buffer += decoder.decode(value, { stream: true })
    const lines = buffer.split('\n')
    buffer = lines.pop() || ''

    for (const line of lines) {
      if (line.startsWith('data: ')) {
        const data = line.slice(6).trim()
        if (data === '[DONE]') {
          yield { type: 'done' }
          return
        }

        try {
          const event: StreamEvent = JSON.parse(data)
          yield event
        } catch {
          // Ignore malformed events
        }
      }
    }
  }
}
