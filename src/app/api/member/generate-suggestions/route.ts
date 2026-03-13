import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { getPythonAgentUrl } from '@/lib/agent/url'

export const dynamic = 'force-dynamic'

// Forbidden patterns for legal compliance
const DOSAGE_PATTERN = /\d+\s*(mg|IU|ml|mcg)/i
const FORBIDDEN_WORDS = /\b(cure|fix|heal|protocol|frequency|supplement dose)\b/i

function validateSuggestion(content: string): boolean {
  if (DOSAGE_PATTERN.test(content)) return false
  if (FORBIDDEN_WORDS.test(content)) return false
  return true
}

interface LabSummaryInput {
  flaggedMarkers: Array<{
    name: string
    value: number
    unit: string
    evaluation: string
    isOminous: boolean
  }>
  totalMarkers: number
  ominousCount: number
}

export async function POST(request: Request) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Verify member role
    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single()

    if (profile?.role !== 'member') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const labSummary: LabSummaryInput = await request.json()

    if (!labSummary.flaggedMarkers || labSummary.flaggedMarkers.length === 0) {
      return NextResponse.json({ suggestions: [] })
    }

    // Build flagged markers summary for the prompt
    const markerSummary = labSummary.flaggedMarkers
      .map(m => `${m.name}: ${m.value} ${m.unit} (${m.evaluation}${m.isOminous ? ', OMINOUS' : ''})`)
      .join('\n')

    // Search RAG for relevant educational content
    const agentUrl = getPythonAgentUrl()

    const ragResponse = await fetch(`${agentUrl}/api/rag/search`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        query: `educational wellness guidance for: ${labSummary.flaggedMarkers.map(m => m.name).join(', ')}`,
        user_id: user.id,
        categories: ['patient_education'],
        limit: 5,
      }),
    })

    let courseContext = ''
    if (ragResponse.ok) {
      const ragData = await ragResponse.json()
      if (ragData.results?.length > 0) {
        courseContext = ragData.results
          .map((r: { content: string; metadata?: { source?: string } }) =>
            `[${r.metadata?.source || 'BFM Course'}]: ${r.content}`
          )
          .join('\n\n')
      }
    }

    // Generate suggestions using Claude via python agent
    const generateResponse = await fetch(`${agentUrl}/api/chat/completions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        messages: [
          {
            role: 'system',
            content: `You are an educational wellness assistant for the BFM (Body Frequency Mapping) program.

CRITICAL LEGAL REQUIREMENTS:
- Educational purposes ONLY — you are NOT providing medical advice
- NEVER suggest specific dosages (no mg, IU, ml, mcg amounts)
- NEVER use words: cure, fix, heal, protocol, frequency, supplement dose
- ALWAYS use: support, promote, help, may benefit, research suggests
- Reference Dr. Rob DeMartino's BFM Foundations course modules when relevant
- End each suggestion with: "This is for educational purposes only."

Generate exactly 2-3 short educational wellness suggestions based on the member's lab results.
Each suggestion should reference a relevant BFM Foundations course module when possible.

Format as JSON array:
[{"content": "...", "category": "nutrition|lifestyle|sleep|light|environment|general", "source_module": "Module X: Name"}]`,
          },
          {
            role: 'user',
            content: `Member's flagged lab markers:\n${markerSummary}\n\nRelevant course content:\n${courseContext || 'No specific course content found — use general BFM educational principles.'}`,
          },
        ],
        max_tokens: 1024,
        temperature: 0.7,
      }),
    })

    if (!generateResponse.ok) {
      return NextResponse.json(
        { error: 'Failed to generate suggestions' },
        { status: 500 }
      )
    }

    const generateData = await generateResponse.json()
    const responseText = generateData.choices?.[0]?.message?.content || generateData.content || ''

    // Parse suggestions from response
    let suggestions: Array<{ content: string; category: string; source_module?: string }> = []
    try {
      // Extract JSON array from response (may be wrapped in markdown code fences)
      const jsonMatch = responseText.match(/\[[\s\S]*\]/)
      if (jsonMatch) {
        suggestions = JSON.parse(jsonMatch[0])
      }
    } catch {
      // If parsing fails, return empty
      return NextResponse.json({ suggestions: [] })
    }

    // Validate and save each suggestion
    const savedSuggestions = []
    for (const suggestion of suggestions) {
      if (!validateSuggestion(suggestion.content)) {
        continue
      }

      const sourceContext = suggestion.source_module
        ? JSON.stringify({ module: suggestion.source_module })
        : null

      const { data, error } = await supabase
        .from('suggestions')
        .insert({
          user_id: user.id,
          content: suggestion.content,
          category: suggestion.category || 'general',
          status: 'pending',
          source_context: sourceContext,
          iteration_count: 0,
        })
        .select()
        .single()

      if (!error && data) {
        savedSuggestions.push(data)
      }
    }

    return NextResponse.json({ suggestions: savedSuggestions })
  } catch (error) {
    console.error('Error generating suggestions:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
