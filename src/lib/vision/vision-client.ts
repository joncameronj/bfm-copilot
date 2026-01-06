// Vision API Client for Diagnostic File Extraction
// Uses GPT-4o Vision to extract structured data from diagnostic images

import { getOpenAIClient } from '@/lib/openai'
import type { ExtractionResult } from '@/types/diagnostic-extraction'

interface VisionMessage {
  role: 'system' | 'user'
  content: string | Array<{ type: 'text'; text: string } | { type: 'image_url'; image_url: { url: string; detail: 'high' | 'low' | 'auto' } }>
}

/**
 * Extract structured data from an image using GPT-4o Vision
 */
export async function extractFromImage<T>(
  imageUrl: string,
  systemPrompt: string,
  userPrompt: string,
  maxTokens: number = 4000
): Promise<ExtractionResult<T>> {
  const openai = getOpenAIClient()

  try {
    const messages: VisionMessage[] = [
      { role: 'system', content: systemPrompt },
      {
        role: 'user',
        content: [
          { type: 'text', text: userPrompt },
          {
            type: 'image_url',
            image_url: {
              url: imageUrl,
              detail: 'high', // High detail for diagnostic images
            },
          },
        ],
      },
    ]

    const response = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: messages as Parameters<typeof openai.chat.completions.create>[0]['messages'],
      response_format: { type: 'json_object' },
      max_tokens: maxTokens,
      temperature: 0.1, // Low temperature for accuracy
    })

    const content = response.choices[0]?.message?.content
    if (!content) {
      return {
        success: false,
        data: {} as T,
        confidence: 0,
        rawResponse: '',
        error: 'No response from Vision API',
      }
    }

    const parsed = JSON.parse(content) as T & { confidence?: number }
    return {
      success: true,
      data: parsed,
      confidence: parsed.confidence ?? 0.8,
      rawResponse: content,
    }
  } catch (error) {
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

/**
 * Extract data from multiple images (e.g., multi-page PDF converted to images)
 */
export async function extractFromMultipleImages<T>(
  imageUrls: string[],
  systemPrompt: string,
  userPrompt: string,
  maxTokens: number = 4000
): Promise<ExtractionResult<T>> {
  const openai = getOpenAIClient()

  try {
    const imageContent = imageUrls.map((url) => ({
      type: 'image_url' as const,
      image_url: { url, detail: 'high' as const },
    }))

    const messages: VisionMessage[] = [
      { role: 'system', content: systemPrompt },
      {
        role: 'user',
        content: [{ type: 'text', text: userPrompt }, ...imageContent],
      },
    ]

    const response = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: messages as Parameters<typeof openai.chat.completions.create>[0]['messages'],
      response_format: { type: 'json_object' },
      max_tokens: maxTokens,
      temperature: 0.1,
    })

    const content = response.choices[0]?.message?.content
    if (!content) {
      return {
        success: false,
        data: {} as T,
        confidence: 0,
        rawResponse: '',
        error: 'No response from Vision API',
      }
    }

    const parsed = JSON.parse(content) as T & { confidence?: number }
    return {
      success: true,
      data: parsed,
      confidence: parsed.confidence ?? 0.8,
      rawResponse: content,
    }
  } catch (error) {
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
