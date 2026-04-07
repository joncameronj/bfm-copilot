export type AIProvider = 'anthropic'

export function getAIProvider(): AIProvider {
  return 'anthropic'
}

export function getDefaultChatModel(): string {
  return process.env.ANTHROPIC_CHAT_MODEL || 'claude-sonnet-4-6'
}

export function getDefaultFastModel(): string {
  return process.env.ANTHROPIC_FAST_MODEL || 'claude-haiku-4-5-20251001'
}

export function getDefaultVisionModel(): string {
  return process.env.ANTHROPIC_VISION_MODEL || 'claude-sonnet-4-6'
}

export function getDefaultEmbeddingModel(): string {
  return process.env.OPENAI_EMBEDDING_MODEL || 'text-embedding-3-small'
}

function looksLikeWrongProviderModel(model: string): boolean {
  const normalized = model.toLowerCase()
  return !normalized.startsWith('claude-')
}

export function normalizeChatModelForProvider(
  chatModel: string | undefined | null
): string {
  const candidate = chatModel?.trim()
  if (!candidate) {
    return getDefaultChatModel()
  }

  if (looksLikeWrongProviderModel(candidate)) {
    return getDefaultChatModel()
  }

  return candidate
}
