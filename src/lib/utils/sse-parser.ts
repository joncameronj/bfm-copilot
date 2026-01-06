/**
 * SSE (Server-Sent Events) line parser with proper buffering
 *
 * TCP doesn't guarantee message boundaries, so SSE events can be split
 * across multiple network chunks. This parser buffers incomplete lines
 * until a complete line (ending with \n) is received.
 *
 * Example problem this solves:
 * - Chunk 1: "data: {\"type\":\"text_del"
 * - Chunk 2: "ta\",\"delta\":\"Hello\"}\n"
 *
 * Without buffering, both chunks produce broken JSON. With buffering,
 * we wait for the complete line before yielding.
 */

/**
 * Async generator that yields complete SSE lines from a stream reader.
 * Properly handles:
 * - Lines split across network chunks (buffers until newline)
 * - Multi-byte UTF-8 characters split across chunks (stream mode)
 * - Empty lines (filtered out)
 */
export async function* parseSSELines(
  reader: ReadableStreamDefaultReader<Uint8Array>
): AsyncGenerator<string> {
  // Use stream mode to handle UTF-8 characters split across chunks
  const decoder = new TextDecoder('utf-8', { fatal: false })
  let buffer = ''

  try {
    while (true) {
      const { done, value } = await reader.read()
      if (done) break

      // Decode with stream: true to handle multi-byte char boundaries
      buffer += decoder.decode(value, { stream: true })

      // Split by newlines, keeping incomplete lines in buffer
      const lines = buffer.split('\n')
      buffer = lines.pop() || '' // Last element is incomplete line (or empty)

      for (const line of lines) {
        const trimmed = line.trim()
        if (trimmed) {
          yield trimmed
        }
      }
    }

    // Flush any remaining decoder state (for incomplete UTF-8 sequences)
    buffer += decoder.decode()

    // Yield any remaining buffered content
    if (buffer.trim()) {
      yield buffer.trim()
    }
  } finally {
    reader.releaseLock()
  }
}

/**
 * Parse SSE data line and extract JSON payload.
 * Returns null for non-data lines or [DONE] signal.
 */
export function parseSSEData<T = unknown>(line: string): T | null {
  if (!line.startsWith('data: ')) {
    return null
  }

  const data = line.slice(6) // Remove 'data: ' prefix
  if (data === '[DONE]') {
    return null
  }

  return JSON.parse(data) as T
}
