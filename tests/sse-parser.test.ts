import { describe, expect, it } from 'vitest'
import { parseSSEData } from '@/lib/utils/sse-parser'

describe('parseSSEData', () => {
  it('parses valid JSON payloads', () => {
    const parsed = parseSSEData<{ type: string; delta: string }>(
      'data: {"type":"text_delta","delta":"hello"}'
    )

    expect(parsed).toEqual({ type: 'text_delta', delta: 'hello' })
  })

  it('parses payloads with no space after data prefix', () => {
    const parsed = parseSSEData<{ type: string; step_id: string }>(
      'data:{"type":"step_start","step_id":"step-1"}'
    )

    expect(parsed).toEqual({ type: 'step_start', step_id: 'step-1' })
  })

  it('returns null for [DONE] marker', () => {
    expect(parseSSEData('data: [DONE]')).toBeNull()
  })

  it('returns null for non-data lines', () => {
    expect(parseSSEData('event: message')).toBeNull()
  })

  it('returns null for empty data lines', () => {
    expect(parseSSEData('data:')).toBeNull()
    expect(parseSSEData('data:   ')).toBeNull()
  })

  it('throws on malformed JSON payloads', () => {
    expect(() =>
      parseSSEData('data: {"type":"text_delta",}')
    ).toThrow()
  })
})
