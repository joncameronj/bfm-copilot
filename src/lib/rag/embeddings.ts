// Embeddings for RAG search (OpenAI — xAI removed standalone embedding models)
import { getDefaultEmbeddingModel } from '@/lib/ai/provider'

const OPENAI_BASE_URL = 'https://api.openai.com/v1'

function getOpenAIKey(): string {
  const key = process.env.OPENAI_API_KEY
  if (!key) throw new Error('OPENAI_API_KEY is required for embeddings')
  return key
}

/**
 * Generate an embedding vector for a text query
 */
export async function generateEmbedding(text: string): Promise<number[]> {
  const resp = await fetch(`${OPENAI_BASE_URL}/embeddings`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${getOpenAIKey()}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: getDefaultEmbeddingModel(),
      input: text,
      dimensions: 1536,
    }),
    cache: 'no-store',
  })

  if (!resp.ok) {
    const error = await resp.text()
    throw new Error(`OpenAI embeddings failed: ${resp.status} ${error}`)
  }

  const data = await resp.json()
  return data.data[0].embedding
}

/**
 * Generate embeddings for multiple texts (batch)
 */
export async function generateEmbeddings(texts: string[]): Promise<number[][]> {
  const resp = await fetch(`${OPENAI_BASE_URL}/embeddings`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${getOpenAIKey()}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: getDefaultEmbeddingModel(),
      input: texts,
      dimensions: 1536,
    }),
    cache: 'no-store',
  })

  if (!resp.ok) {
    const error = await resp.text()
    throw new Error(`OpenAI embeddings failed: ${resp.status} ${error}`)
  }

  const data = await resp.json()
  return data.data.map((d: { embedding: number[] }) => d.embedding)
}
