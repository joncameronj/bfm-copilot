// src/app/api/settings/models/route.ts
// Public endpoint for Python agent to fetch current model settings

import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import type { ModelSettings } from '@/types/settings'
import {
  getDefaultChatModel,
  normalizeChatModelForProvider,
} from '@/lib/ai/provider'

export const dynamic = 'force-dynamic'

// Default settings (fallback if database is empty)
const DEFAULT_SETTINGS: ModelSettings = {
  chat_model: getDefaultChatModel(),
  reasoning_effort: 'high',
  reasoning_summary: 'detailed',
  prompt_routing_enabled: true,
}

// GET /api/settings/models - Get current model settings
// This endpoint is used by the Python agent to fetch model configuration
export async function GET() {
  try {
    const supabase = await createClient()

    // Fetch all model-related settings
    const { data: settings, error } = await supabase
      .from('system_config')
      .select('key, value')
      .in('key', ['chat_model', 'reasoning_effort', 'reasoning_summary', 'prompt_routing_enabled'])

    if (error) {
      console.error('Error fetching model settings:', error)
      // Return defaults on error so the agent keeps working
      return NextResponse.json({ data: DEFAULT_SETTINGS })
    }

    // Transform to ModelSettings format
    const modelSettings: ModelSettings = { ...DEFAULT_SETTINGS }

    for (const setting of settings || []) {
      // Handle JSONB value (may be a quoted string)
      const value = typeof setting.value === 'string'
        ? setting.value.replace(/^"|"$/g, '')
        : setting.value

      if (setting.key === 'chat_model') {
        modelSettings.chat_model = normalizeChatModelForProvider(value as string)
      } else if (setting.key === 'reasoning_effort') {
        modelSettings.reasoning_effort = value as ModelSettings['reasoning_effort']
      } else if (setting.key === 'reasoning_summary') {
        modelSettings.reasoning_summary = value as ModelSettings['reasoning_summary']
      } else if (setting.key === 'prompt_routing_enabled') {
        modelSettings.prompt_routing_enabled = value === 'true' || value === true
      }
    }

    return NextResponse.json({ data: modelSettings })
  } catch (error) {
    console.error('Error in model settings endpoint:', error)
    // Return defaults on error so the agent keeps working
    return NextResponse.json({ data: DEFAULT_SETTINGS })
  }
}
