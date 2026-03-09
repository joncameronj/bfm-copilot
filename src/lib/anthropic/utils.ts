/**
 * Suffix to append to system prompts when JSON output is required.
 * Anthropic has no formal JSON mode — this prompt engineering approach
 * instructs the model to return valid JSON.
 */
export const JSON_SYSTEM_SUFFIX =
  '\n\nIMPORTANT: You MUST respond with valid JSON only. No markdown code fences, no explanatory text — just the raw JSON object.'

/**
 * Extract JSON from a model response, stripping markdown code fences if present.
 * Handles responses wrapped in ```json ... ``` or ``` ... ```.
 */
export function extractJSON<T>(text: string): T {
  let cleaned = text.trim()

  // Strip markdown code fences
  const fenceMatch = cleaned.match(/^```(?:json)?\s*\n?([\s\S]*?)\n?\s*```$/m)
  if (fenceMatch) {
    cleaned = fenceMatch[1].trim()
  }

  return JSON.parse(cleaned) as T
}
