// Vision API Client for Diagnostic File Extraction
// Uses Anthropic Vision to extract structured data from diagnostic images

import { getAnthropicClient, extractJSON, JSON_SYSTEM_SUFFIX } from '@/lib/anthropic'
import { getDefaultVisionModel } from '@/lib/ai/provider'
import type { ExtractionResult } from '@/types/diagnostic-extraction'

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
            {
              type: 'image',
              source: {
                type: 'url',
                url: imageUrl,
              },
            },
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
  const client = getAnthropicClient()
  const model = getDefaultVisionModel()

  try {
    const imageContent = imageUrls.map((url) => ({
      type: 'image' as const,
      source: {
        type: 'url' as const,
        url,
      },
    }))

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
