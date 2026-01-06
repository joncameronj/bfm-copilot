// Chat and conversation types for WS-2

export interface Message {
  id: string;
  conversationId: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  metadata?: MessageMetadata;
  createdAt: Date;
}

export interface MessageMetadata {
  toolCalls?: ToolCall[];
  attachments?: Attachment[];
  reasoning?: ReasoningData;
  steps?: AgentStep[];
  actions?: ActionButton[];
  citations?: Citation[];
  sources?: Source[];
  ragChunks?: RagChunk[];
  agentHandoffs?: AgentHandoff[]; // Agent SDK: track agent transitions
  [key: string]: unknown;
}

// Agent handoff event for multi-agent architectures (Agent SDK feature)
export interface AgentHandoff {
  fromAgent: string | null;
  toAgent: string;
  reason: string;
  timestamp: Date;
}

export interface ReasoningData {
  text: string;
  summary?: string;
  elapsedMs: number;
}

// Agent step tracking for visible thinking
export interface AgentStep {
  id: string;
  label: string;
  status: 'pending' | 'in_progress' | 'completed' | 'error';
  startTime?: number;
  endTime?: number;
  error?: string;
}

// Smart action buttons for contextual navigation
export interface ActionButton {
  id: string;
  label: string;
  href: string;
  icon?: string;
}

// Citation for web search results
export interface Citation {
  id: string;
  title: string;
  url: string;
  snippet?: string;
  source: 'pubmed' | 'nih' | 'scholar' | 'internal';
  citation?: string; // Formatted citation string
}

// Source from RAG knowledge base
export interface Source {
  id: string;
  title: string;
  type: 'knowledge' | 'web';
  category?: string | null;
  bodySystem?: string | null;
}

// RAG chunk with full content for dev debugging
export interface RagChunk {
  id: string;
  content: string;
  title: string;
  filename?: string;
  bodySystem?: string;
  documentCategory?: string;
  matchType?: 'direct' | 'related' | 'semantic';
  similarity?: number;
}

export interface ToolCall {
  id: string;
  type: string;
  function: {
    name: string;
    arguments: string;
  };
  status: 'pending' | 'running' | 'completed' | 'failed';
  result?: string;
}

export interface Attachment {
  id: string;
  filename: string;
  mimeType: string;
  url: string;
  size: number;
}

export interface Conversation {
  id: string;
  userId: string;
  patientId: string | null;
  title: string;
  threadId: string | null;
  conversationType: ConversationType;
  messageCount: number;
  createdAt: Date;
  updatedAt: Date;
}

export type ConversationType = 'general' | 'lab_analysis' | 'diagnostics' | 'brainstorm';

export interface ConversationWithMessages extends Conversation {
  messages: Message[];
}

// Chat state types
export interface ChatState {
  messages: Message[];
  isLoading: boolean;
  isThinking: boolean;
  isReasoning: boolean;
  isStreaming: boolean;
  currentToolCall: ToolCall | null;
  currentSteps: AgentStep[];
  currentActions: ActionButton[];
  thinkingStartTime: number | null;
  error: string | null;
}

// User types (referenced from shared types)
export interface ChatUser {
  id: string;
  email: string;
  fullName: string | null;
}

// API request/response types
export interface CreateConversationRequest {
  title?: string;
  patientId?: string;
  conversationType?: ConversationType;
}

export interface CreateConversationResponse {
  conversation: Conversation;
  threadId: string;
}

export interface SendMessageRequest {
  message: string;
  attachments?: string[];
}

export interface StreamEvent {
  type:
    // Existing events (unchanged)
    | 'text_delta'
    | 'text_done'
    | 'tool_call'
    | 'tool_result'
    | 'reasoning_delta'
    | 'reasoning_done'
    | 'step_start'
    | 'step_complete'
    | 'step_error'
    | 'action_buttons'
    | 'citations'
    | 'sources'
    | 'rag_chunks'
    | 'done'
    | 'error'
    // NEW Agent SDK events
    | 'agent_handoff'
    | 'run_item_started'
    | 'run_item_completed';
  delta?: string;
  content?: string;
  summary?: string;
  elapsed_ms?: number;
  toolCall?: ToolCall;
  error?: string;
  // Step events
  step_id?: string;
  label?: string;
  // Action buttons event
  actions?: ActionButton[];
  // Citations event
  citations?: Citation[];
  // Sources event
  sources?: Source[];
  // RAG chunks event
  chunks?: RagChunk[];
  // Agent handoff events (Agent SDK)
  from_agent?: string;
  to_agent?: string;
  reason?: string;
}
