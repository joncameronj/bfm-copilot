// Vision API Client for Diagnostic File Extraction
// Uses Anthropic Vision to extract structured data from diagnostic images

import { getAnthropicClient, extractJSON, JSON_SYSTEM_SUFFIX } from '@/lib/anthropic'
import { getDefaultVisionModel } from '@/lib/ai/provider'
import type { ExtractionResult } from '@/types/diagnostic-extraction'

const MAX_RETRIES = 3
const INITIAL_BACKOFF_MS = 2000

function isRetryableError(error: unknown): boolean {
  if (error instanceof Error) {
    const msg = error.message || ''
    return msg.includes('overloaded') || msg.includes('Overloaded') || msg.includes('529') || msg.includes('rate_limit')
  }
  return false
}

async function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms))
}

const SUPPORTED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'] as const
type SupportedImageType = (typeof SUPPORTED_IMAGE_TYPES)[number]

async function fetchImageAsBase64(imageUrl: string): Promise<{
  data: string
  mediaType: SupportedImageType | 'application/pdf'
  isPdf: boolean
}> {
  const response = await fetch(imageUrl)
  if (!response.ok) {
    throw new Error(`Failed to fetch image: ${response.status} ${response.statusText}`)
  }

  const contentType = response.headers.get('content-type')?.split(';')[0]?.trim() || ''
  const buffer = Buffer.from(await response.arrayBuffer())
  const data = buffer.toString('base64')

  if (contentType === 'application/pdf') {
    return { data, mediaType: 'application/pdf', isPdf: true }
  }

  const mediaType = SUPPORTED_IMAGE_TYPES.includes(contentType as SupportedImageType)
    ? (contentType as SupportedImageType)
    : ('image/jpeg' as const)

  return { data, mediaType, isPdf: false }
}

/**
 * Extract structured data from an image using Anthropic Vision
 */
export async function extractFromImage<T>(
  imageUrl: string,
  systemPrompt: string,
  userPrompt: string,
  maxTokens: number = 4000
): Promise<ExtractionResult<T>> {
  const client = getAnthropicClient()
  const model = getDefaultVisionModel()

  const { data, mediaType, isPdf } = await fetchImageAsBase64(imageUrl)

  const fileContent = isPdf
    ? { type: 'document' as const, source: { type: 'base64' as const, media_type: 'application/pdf' as const, data } }
    : { type: 'image' as const, source: { type: 'base64' as const, media_type: mediaType as SupportedImageType, data } }

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    try {
      // Use streaming to avoid Anthropic SDK timeout on long-running vision calls
      const stream = client.messages.stream({
        model,
        max_tokens: maxTokens,
        temperature: 0.1,
        system: systemPrompt + JSON_SYSTEM_SUFFIX,
        messages: [
          {
            role: 'user',
            content: [
              { type: 'text', text: userPrompt },
              fileContent,
            ],
          },
        ],
      })

      const response = await stream.finalMessage()

      const textBlock = response.content.find((b) => b.type === 'text')
      const content = textBlock && 'text' in textBlock ? textBlock.text : null
      if (!content) {
        return {
          success: false,
          data: {} as T,
          confidence: 0,
          rawResponse: '',
          error: 'No response from Vision API',
        }
      }

      const parsed = extractJSON<T & { confidence?: number }>(content)
      return {
        success: true,
        data: parsed,
        confidence: parsed.confidence ?? 0.8,
        rawResponse: content,
      }
    } catch (error) {
      if (isRetryableError(error) && attempt < MAX_RETRIES) {
        const backoff = INITIAL_BACKOFF_MS * Math.pow(2, attempt)
        console.warn(`[Vision] Retryable error (attempt ${attempt + 1}/${MAX_RETRIES}), retrying in ${backoff}ms...`)
        await sleep(backoff)
        continue
      }
      console.error('Vision extraction error:', error)
      return {
        success: false,
        data: {} as T,
        confidence: 0,
        rawResponse: '',
        error: error instanceof Error ? error.message : 'Unknown error',
      }
    }
  }

  return {
    success: false,
    data: {} as T,
    confidence: 0,
    rawResponse: '',
    error: 'Max retries exceeded',
  }
}

/**
 * Extract data from multiple images (e.g., multi-page PDF converted to images)
 */
export async function extractFromMultipleImages<T>(
  imageUrls: string[],
  systemPrompt: string,
  userPrompt: string,
  maxTokens: number = 4000
): Promise<ExtractionResult<T>> {
  const client = getAnthropicClient()
  const model = getDefaultVisionModel()

  const fetched = await Promise.all(imageUrls.map(fetchImageAsBase64))
  const imageContent = fetched.map(({ data, mediaType, isPdf }) =>
    isPdf
      ? { type: 'document' as const, source: { type: 'base64' as const, media_type: 'application/pdf' as const, data } }
      : { type: 'image' as const, source: { type: 'base64' as const, media_type: mediaType as SupportedImageType, data } }
  )

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    try {
      // Use streaming to avoid Anthropic SDK timeout on long-running vision calls
      const stream = client.messages.stream({
        model,
        max_tokens: maxTokens,
        temperature: 0.1,
        system: systemPrompt + JSON_SYSTEM_SUFFIX,
        messages: [
          {
            role: 'user',
            content: [{ type: 'text' as const, text: userPrompt }, ...imageContent],
          },
        ],
      })

      const response = await stream.finalMessage()

      const textBlock = response.content.find((b) => b.type === 'text')
      const content = textBlock && 'text' in textBlock ? textBlock.text : null
      if (!content) {
        return {
          success: false,
          data: {} as T,
          confidence: 0,
          rawResponse: '',
          error: 'No response from Vision API',
        }
      }

      const parsed = extractJSON<T & { confidence?: number }>(content)
      return {
        success: true,
        data: parsed,
        confidence: parsed.confidence ?? 0.8,
        rawResponse: content,
      }
    } catch (error) {
      if (isRetryableError(error) && attempt < MAX_RETRIES) {
        const backoff = INITIAL_BACKOFF_MS * Math.pow(2, attempt)
        console.warn(`[Vision] Retryable error (attempt ${attempt + 1}/${MAX_RETRIES}), retrying in ${backoff}ms...`)
        await sleep(backoff)
        continue
      }
      console.error('Vision extraction error:', error)
      return {
        success: false,
        data: {} as T,
        confidence: 0,
        rawResponse: '',
        error: error instanceof Error ? error.message : 'Unknown error',
      }
    }
  }

  return {
    success: false,
    data: {} as T,
    confidence: 0,
    rawResponse: '',
    error: 'Max retries exceeded',
  }
}

/**
 * Extract frequency names from reference images with red boxes
 */
export async function extractFrequencyNames(imageUrl: string): Promise<ExtractionResult<{ names: string[] }>> {
  const systemPrompt = `You are an expert at analyzing frequency reference images.
Your job is to identify text that has RED BOXES drawn around it.
These red boxes indicate APPROVED frequency names.

CRITICAL RULES:
1. Only extract text that has a RED BOX around it
2. Extract the NAMES only - do NOT include Hz values like "40/116"
3. Return as a JSON array of strings
4. Ignore any text that is not inside a red box`

  const userPrompt = `Analyze this frequency reference image.
Identify ALL text that has a RED BOX drawn around it.
These are the approved frequency protocol names.

Return a JSON object with this structure:
{
  "names": ["Frequency Name 1", "Frequency Name 2", ...],
  "confidence": 0.0 to 1.0 (your confidence in the extraction)
}

Focus ONLY on boxed items. Ignore unboxed text.
Extract NAMES only, not numeric Hz values.`

  return extractFromImage<{ names: string[]; confidence?: number }>(imageUrl, systemPrompt, userPrompt)
}
