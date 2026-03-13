# Feature Spec: Chat Context Compaction

**Status:** Planned
**Priority:** P1 — directly impacts user experience on long conversations
**Depends on:** Option A (char budget trim) already shipped

## Problem

When a user has a long conversation thread (20+ exchanges), the chat history exceeds Claude's 200K token context window. Currently we silently drop older messages. The user loses context from earlier in the conversation, and the model can't reference previous findings, protocols discussed, or patient details mentioned earlier.

This is especially problematic for practitioner workflows where a single thread may span:
- Initial patient discussion
- Diagnostic review
- Protocol recommendations
- Follow-up questions about specific supplements/frequencies

## Solution: Context Compaction

When conversation history approaches the context budget, **summarize older messages** into a condensed context block rather than dropping them entirely. This preserves the semantic content while dramatically reducing token count.

## Architecture

```
┌─────────────────────────────────────────────────────┐
│                    Chat Request                      │
│                                                      │
│  1. Load full history from DB (messages table)       │
│  2. Check total char count against budget            │
│  3. If over budget:                                  │
│     a. Split into [old_messages | recent_messages]   │
│     b. Check compaction_cache for existing summary   │
│     c. If no cache hit → call Claude Haiku to        │
│        summarize old_messages into ~2K char summary  │
│     d. Store summary in compaction_cache             │
│     e. Prepend summary as system context note        │
│     f. Send [summary + recent_messages] to Claude    │
│  4. If under budget: send full history as-is         │
└─────────────────────────────────────────────────────┘
```

## Implementation Plan

### Phase 1: Compaction Engine (Python backend)

**New file:** `python-agent/app/services/context_compactor.py`

```python
class ContextCompactor:
    """Summarizes older conversation messages into a condensed context block."""

    SUMMARY_MODEL = "claude-haiku-4-5-20251001"  # Fast + cheap
    MAX_SUMMARY_TOKENS = 1024
    RECENT_MESSAGE_COUNT = 20  # Always keep last 20 messages verbatim

    async def compact(
        self,
        messages: list[dict],
        char_budget: int,
    ) -> tuple[list[dict], bool]:
        """
        Returns (compacted_messages, was_compacted).

        If total chars <= budget, returns messages unchanged.
        Otherwise, summarizes older messages and prepends summary.
        """
```

**Summarization prompt:**
```
Summarize this conversation history concisely. Preserve:
- Patient names and key demographics mentioned
- Specific diagnostic findings discussed (D-Pulse values, HRV patterns, brainwave ratios)
- Protocol/frequency recommendations made
- Supplement names and dosages discussed
- Any action items or follow-ups mentioned
- The user's role (practitioner/member) and conversation tone

Output a structured summary in ≤500 words. Use bullet points.
Do NOT include greetings, filler, or the AI's personality.
```

### Phase 2: Compaction Cache (Supabase)

**New table:** `conversation_compactions`

```sql
CREATE TABLE conversation_compactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    conversation_id UUID NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
    message_count_at_compaction INT NOT NULL,
    summary TEXT NOT NULL,
    summary_token_count INT,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now(),

    -- Only one active compaction per conversation
    UNIQUE(conversation_id)
);

-- Index for fast lookup
CREATE INDEX idx_compactions_conversation ON conversation_compactions(conversation_id);
```

**Cache invalidation:** Re-compact when `message_count_at_compaction` is more than 10 messages behind the current count. This avoids re-summarizing on every request.

### Phase 3: Integration into Chat Route

**Modified file:** `src/app/api/agent/chat/route.ts`

```typescript
// After loading history from DB:
const { messages: compactedHistory, wasCompacted } = await compactHistory(
  trimmedHistory,
  CHAT_HISTORY_CHAR_BUDGET,
  conversationId,
)

// Pass compactedHistory to Python agent instead of trimmedHistory
```

**New endpoint on Python backend:** `POST /agent/compact`
```json
{
  "messages": [...],
  "conversation_id": "uuid",
  "message_count": 45
}
// Returns: { "summary": "...", "cached": false }
```

### Phase 4: Frontend Indicator

**Modified file:** `src/hooks/useChat.ts` or relevant chat component

When the response includes `context_compacted: true`:
- Show a subtle info banner: "This is a long conversation. Older messages have been summarized to maintain context."
- Optionally show a "Start new thread" button

## Cost Analysis

- **Claude Haiku summarization call:** ~$0.001 per compaction (small input, 1K output)
- **Cache hit rate:** ~90% (only re-compact every 10 new messages)
- **Net savings:** Reduces input tokens to Claude Opus by 50-80% on long conversations, saving $0.05-0.20 per request on heavy threads

## Acceptance Criteria

- [ ] Conversations with 30+ messages still work without API errors
- [ ] Model can reference patient details from early in the conversation via summary
- [ ] Compaction summary is cached and reused across requests
- [ ] Cache invalidates when 10+ new messages are added
- [ ] Haiku summarization completes in <3 seconds
- [ ] No visible latency increase for conversations under the budget
- [ ] Frontend shows indicator when compaction is active

## Edge Cases

- **First message after compaction:** Model should not claim it "remembers" the full conversation — the summary note should make it clear this is a condensed version
- **Patient context in compaction:** Ensure patient names, diagnoses, and protocol recommendations survive summarization
- **Member vs practitioner:** Member conversations should NOT have clinical details leak through compaction summaries (apply same content filtering)
- **Concurrent requests:** If two requests trigger compaction simultaneously, use upsert to avoid duplicate summaries

## Timeline Estimate

- Phase 1 (Compaction engine): 2-3 hours
- Phase 2 (Cache table + migration): 1 hour
- Phase 3 (Integration): 1-2 hours
- Phase 4 (Frontend indicator): 1 hour
- Testing: 1-2 hours

**Total:** ~1 day of focused work
