import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { getPythonAgentUrl } from '@/lib/agent/url'
import { buildAttachmentContext, type ChatAttachment } from '@/lib/chat/attachment-context'

export const dynamic = 'force-dynamic'
export const maxDuration = 300

const CHAT_HISTORY_MESSAGE_LIMIT = Number.parseInt(
  process.env.CHAT_HISTORY_MESSAGE_LIMIT || '400',
  10
)
const CHAT_HISTORY_CHAR_BUDGET = Number.parseInt(
  process.env.CHAT_HISTORY_CHAR_BUDGET || '400000',
  10
)

interface PatientContext {
  first_name?: string
  last_name?: string
  age?: number
  gender?: string
  chief_complaints?: string
  medical_history?: string
}

interface ConversationMessage {
  role: 'user' | 'assistant' | 'system'
  content: string
}

function trimHistoryByCharBudget(
  history: ConversationMessage[],
  charBudget: number
): { messages: ConversationMessage[]; wasTrimmed: boolean } {
  if (!Number.isFinite(charBudget) || charBudget <= 0) {
    return { messages: history, wasTrimmed: false }
  }

  let total = 0
  const kept: ConversationMessage[] = []

  for (let i = history.length - 1; i >= 0; i--) {
    const msg = history[i]
    const size = msg.content.length

    if (kept.length > 0 && total + size > charBudget) {
      break
    }

    kept.push(msg)
    total += size
  }

  const wasTrimmed = kept.length < history.length
  const result = kept.reverse()

  // If history was trimmed, prepend a system context note so the model
  // knows earlier conversation context is missing
  if (wasTrimmed) {
    const droppedCount = history.length - result.length
    console.log(
      `[Chat History] Trimmed ${droppedCount} older messages (${history.length} → ${result.length}) to fit ${charBudget} char budget`
    )
    result.unshift({
      role: 'user',
      content: '[SYSTEM NOTE: Earlier messages in this conversation were truncated due to length. The most recent messages are preserved below. If the user references something from earlier that you cannot see, let them know the earlier context is no longer available and suggest starting a new thread.]',
    })
    // Need a placeholder assistant acknowledgment for valid message alternation
    result.splice(1, 0, {
      role: 'assistant',
      content: 'Understood. I have context from the most recent messages in this conversation.',
    })
  }

  return { messages: result, wasTrimmed }
}

function calculateAge(dateOfBirth: string): number {
  const birthDate = new Date(dateOfBirth)
  const today = new Date()
  let age = today.getFullYear() - birthDate.getFullYear()
  const monthDiff = today.getMonth() - birthDate.getMonth()

  if (
    monthDiff < 0 ||
    (monthDiff === 0 && today.getDate() < birthDate.getDate())
  ) {
    age--
  }

  return age
}

export async function POST(request: Request) {
  try {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    const {
      data: { session },
    } = await supabase.auth.getSession()

    if (!user || !session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Fetch user role for content filtering
    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single()

    const userRole = profile?.role || 'member'

    const body = await request.json()
    const {
      message,
      conversationId,
      fileIds: rawFileIds = [],
      attachments: rawAttachments = [],
      force_web_search,
      deep_dive,
    }: {
      message: string
      conversationId?: string
      fileIds?: unknown
      attachments?: unknown
      force_web_search?: boolean
      deep_dive?: boolean
    } = body
    const fileIds = Array.isArray(rawFileIds)
      ? rawFileIds.filter((id): id is string => typeof id === 'string')
      : []
    const attachments = Array.isArray(rawAttachments)
      ? rawAttachments.filter(
          (attachment): attachment is ChatAttachment =>
            typeof attachment === 'object' &&
            attachment !== null &&
            typeof (attachment as ChatAttachment).id === 'string'
        )
      : []

    // Fetch conversation context
    let patientContext: PatientContext | null = null
    let conversationType = 'general'

    if (conversationId) {
      const { data: conversation } = await supabase
        .from('conversations')
        .select('patient_id, conversation_type')
        .eq('id', conversationId)
        .single()

      if (conversation?.patient_id) {
        const { data: patient } = await supabase
          .from('patients')
          .select(
            'first_name, last_name, gender, date_of_birth, chief_complaints, medical_history'
          )
          .eq('id', conversation.patient_id)
          .single()

        if (patient) {
          patientContext = {
            first_name: patient.first_name,
            last_name: patient.last_name,
            age: calculateAge(patient.date_of_birth),
            gender: patient.gender,
            chief_complaints: patient.chief_complaints,
            medical_history: patient.medical_history,
          }
        }
      }
      conversationType = conversation?.conversation_type || 'general'
    }

    // Load conversation history
    const historyLimit = Number.isFinite(CHAT_HISTORY_MESSAGE_LIMIT) && CHAT_HISTORY_MESSAGE_LIMIT > 0
      ? CHAT_HISTORY_MESSAGE_LIMIT
      : 400

    let messages: Array<{ role: string; content: string | null }> = []
    if (conversationId) {
      const { data: historyRows } = await supabase
        .from('messages')
        .select('role, content')
        .eq('conversation_id', conversationId)
        .order('created_at', { ascending: false })
        .limit(historyLimit)

      messages = (historyRows || []).reverse()
    }

    const { messages: trimmedHistory } = trimHistoryByCharBudget(
      messages.map((m) => ({
        role: m.role as ConversationMessage['role'],
        content: typeof m.content === 'string'
          ? m.content
          : Array.isArray(m.content)
            ? (m.content as Array<{ type?: string; text?: string }>)
                .filter((b) => b.type === 'text')
                .map((b) => b.text || '')
                .join('')
            : m.content ? String(m.content) : '',
      })),
      Number.isFinite(CHAT_HISTORY_CHAR_BUDGET) && CHAT_HISTORY_CHAR_BUDGET > 0
        ? CHAT_HISTORY_CHAR_BUDGET
        : 400000
    )

    const attachmentContext = await buildAttachmentContext(
      supabase,
      user.id,
      fileIds,
      attachments
    )
    const messageWithAttachmentContext = attachmentContext
      ? `${message}\n\n${attachmentContext}`
      : message

    // Forward to Python agent with streaming and role-based filtering
    // 5-minute timeout — eval/deep-dive calls can take a while
    const agentAbort = new AbortController()
    const agentTimeout = setTimeout(() => agentAbort.abort(), 5 * 60 * 1000)
    let response: Response
    try {
      response = await fetch(`${getPythonAgentUrl()}/agent/chat`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          message: messageWithAttachmentContext,
          conversation_id: conversationId,
          conversation_type: conversationType,
          patient_context: patientContext,
          history: trimmedHistory,
          file_ids: fileIds,
          user_role: userRole,
          user_id: user.id,
          force_web_search: force_web_search || false,
          deep_dive: deep_dive || false,
        }),
        signal: agentAbort.signal,
      })
    } catch (err) {
      clearTimeout(agentTimeout)
      if (agentAbort.signal.aborted) {
        return NextResponse.json(
          { error: 'Agent request timed out after 5 minutes. Please try again.' },
          { status: 504 }
        )
      }
      throw err
    }
    clearTimeout(agentTimeout)

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({
        message: 'Python agent request failed',
      }))
      console.error('[Python Agent Error]', {
        timestamp: new Date().toISOString(),
        userId: user.id,
        conversationId,
        status: response.status,
        error: errorData,
      })
      return NextResponse.json(
        { error: errorData.message || errorData.detail },
        { status: response.status }
      )
    }

    // Stream response with proper chunk forwarding
    const { readable, writable } = new TransformStream()
    const writer = writable.getWriter()
    const reader = response.body!.getReader()

    // Process chunks in background - forward immediately without buffering
    ;(async () => {
      try {
        while (true) {
          const { done, value } = await reader.read()
          if (done) break
          await writer.write(value)
        }
      } catch (err) {
        console.error('[Stream Proxy Error]', err)
        // Send an SSE error event so the client knows the stream broke
        const encoder = new TextEncoder()
        try {
          await writer.write(
            encoder.encode(`data: ${JSON.stringify({ type: 'error', error: 'Connection to agent lost. Please try again.' })}\n\n`)
          )
        } catch {
          // Writer may already be closed
        }
      } finally {
        try { await writer.close() } catch { /* already closed */ }
      }
    })()

    return new Response(readable, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache, no-transform',
        Connection: 'keep-alive',
        'X-Accel-Buffering': 'no',
      },
    })
  } catch (error) {
    console.error('[Agent Chat Error]', {
      timestamp: new Date().toISOString(),
      error: error instanceof Error ? {
        name: error.name,
        message: error.message,
        stack: error.stack,
      } : error,
    })
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
