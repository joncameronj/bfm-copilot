// OpenAI Embeddings for RAG search
import { getOpenAIClient } from '@/lib/openai'

/**
 * Generate an embedding vector for a text query
 * Uses OpenAI's text-embedding-3-small model (1536 dimensions)
 */
export async function generateEmbedding(text: string): Promise<number[]> {
  const openai = getOpenAIClient()

  const response = await openai.embeddings.create({
    model: 'text-embedding-3-small',
    input: text,
  })

  return response.data[0].embedding
}

/**
 * Generate embeddings for multiple texts (batch)
 */
export async function generateEmbeddings(texts: string[]): Promise<number[][]> {
  const openai = getOpenAIClient()

  const response = await openai.embeddings.create({
    model: 'text-embedding-3-small',
    input: texts,
  })

  return response.data.map(d => d.embedding)
}
