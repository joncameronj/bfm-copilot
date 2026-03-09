// src/app/api/admin/settings/route.ts
// Admin system settings API

import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import type { ModelSettings, ModelSettingsUpdatePayload } from '@/types/settings'
import {
  getDefaultChatModel,
  normalizeChatModelForProvider,
} from '@/lib/ai/provider'

export const dynamic = 'force-dynamic'

// Helper to verify admin role
async function verifyAdmin(supabase: Awaited<ReturnType<typeof createClient>>) {
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return { error: 'Unauthorized', status: 401 }
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  if (profile?.role !== 'admin') {
    return { error: 'Forbidden', status: 403 }
  }

  return { user, profile }
}

// GET /api/admin/settings - Get all model settings
export async function GET() {
  const supabase = await createClient()

  const auth = await verifyAdmin(supabase)
  if ('error' in auth) {
    return NextResponse.json({ error: auth.error }, { status: auth.status })
  }

  // Fetch all model-related settings
  const { data: settings, error } = await supabase
    .from('system_config')
    .select('key, value, description, updated_at, updated_by')
    .in('key', ['chat_model', 'reasoning_effort', 'reasoning_summary'])

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  // Transform to ModelSettings format
  const modelSettings: ModelSettings = {
    chat_model: getDefaultChatModel(),
    reasoning_effort: 'high',
    reasoning_summary: 'detailed',
  }

  for (const setting of settings || []) {
    const value = typeof setting.value === 'string'
      ? setting.value.replace(/^"|"$/g, '')
      : setting.value

    if (setting.key === 'chat_model') {
      modelSettings.chat_model = normalizeChatModelForProvider(value as string)
    } else if (setting.key === 'reasoning_effort') {
      modelSettings.reasoning_effort = value as ModelSettings['reasoning_effort']
    } else if (setting.key === 'reasoning_summary') {
      modelSettings.reasoning_summary = value as ModelSettings['reasoning_summary']
    }
  }

  return NextResponse.json({ data: modelSettings })
}

// PUT /api/admin/settings - Update model settings
export async function PUT(request: Request) {
  const supabase = await createClient()

  const auth = await verifyAdmin(supabase)
  if ('error' in auth) {
    return NextResponse.json({ error: auth.error }, { status: auth.status })
  }

  const body: ModelSettingsUpdatePayload = await request.json()

  // Validate inputs
  const validReasoningEfforts = ['low', 'medium', 'high']
  const validReasoningSummaries = ['auto', 'concise', 'detailed']

  if (body.reasoning_effort && !validReasoningEfforts.includes(body.reasoning_effort)) {
    return NextResponse.json(
      { error: 'Invalid reasoning_effort value' },
      { status: 400 }
    )
  }

  if (body.reasoning_summary && !validReasoningSummaries.includes(body.reasoning_summary)) {
    return NextResponse.json(
      { error: 'Invalid reasoning_summary value' },
      { status: 400 }
    )
  }

  const normalizedChatModel = body.chat_model !== undefined
    ? normalizeChatModelForProvider(body.chat_model)
    : undefined

  // Update each setting that was provided
  const updates: Promise<unknown>[] = []

  if (normalizedChatModel !== undefined) {
    updates.push(
      (async () => {
        const { error } = await supabase
          .from('system_config')
          .upsert(
            {
              key: 'chat_model',
              value: JSON.stringify(normalizedChatModel),
              description: 'The AI model used for the main chat agent',
              updated_by: auth.user.id,
            },
            { onConflict: 'key' }
          )
        if (error) throw error
      })()
    )
  }

  if (body.reasoning_effort !== undefined) {
    updates.push(
      (async () => {
        const { error } = await supabase
          .from('system_config')
          .upsert(
            {
              key: 'reasoning_effort',
              value: JSON.stringify(body.reasoning_effort),
              description: 'Reasoning effort level for extended thinking (low, medium, high)',
              updated_by: auth.user.id,
            },
            { onConflict: 'key' }
          )
        if (error) throw error
      })()
    )
  }

  if (body.reasoning_summary !== undefined) {
    updates.push(
      (async () => {
        const { error } = await supabase
          .from('system_config')
          .upsert(
            {
              key: 'reasoning_summary',
              value: JSON.stringify(body.reasoning_summary),
              description: 'Reasoning summary verbosity (auto, concise, detailed)',
              updated_by: auth.user.id,
            },
            { onConflict: 'key' }
          )
        if (error) throw error
      })()
    )
  }

  if (updates.length === 0) {
    return NextResponse.json(
      { error: 'No valid settings provided' },
      { status: 400 }
    )
  }

  try {
    await Promise.all(updates)

    // Fetch updated settings
    const { data: settings } = await supabase
      .from('system_config')
      .select('key, value')
      .in('key', ['chat_model', 'reasoning_effort', 'reasoning_summary'])

    const modelSettings: ModelSettings = {
      chat_model: getDefaultChatModel(),
      reasoning_effort: 'high',
      reasoning_summary: 'detailed',
    }

    for (const setting of settings || []) {
      const value = typeof setting.value === 'string'
        ? setting.value.replace(/^"|"$/g, '')
        : setting.value

      if (setting.key === 'chat_model') {
        modelSettings.chat_model = normalizeChatModelForProvider(value as string)
      } else if (setting.key === 'reasoning_effort') {
        modelSettings.reasoning_effort = value as ModelSettings['reasoning_effort']
      } else if (setting.key === 'reasoning_summary') {
        modelSettings.reasoning_summary = value as ModelSettings['reasoning_summary']
      }
    }

    return NextResponse.json({ data: modelSettings })
  } catch (error) {
    console.error('Error updating settings:', error)
    return NextResponse.json(
      { error: 'Failed to update settings' },
      { status: 500 }
    )
  }
}
