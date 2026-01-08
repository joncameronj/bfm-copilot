import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

// Allowed fields for update
const ALLOWED_FIELDS = [
  'email_lab_results',
  'email_protocol_updates',
  'email_system_announcements',
  'email_weekly_digest',
  'default_patient_view',
  'auto_save_notes',
  'health_reminder_frequency',
  'share_progress_with_practitioner',
  'eval_mode_enabled',
] as const

// GET /api/settings/preferences
export async function GET() {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { data: preferences } = await supabase
    .from('user_preferences')
    .select('*')
    .eq('user_id', user.id)
    .single()

  return NextResponse.json({ data: preferences })
}

// PUT /api/settings/preferences - Upsert preferences
export async function PUT(request: Request) {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body = await request.json()

  // Filter to only allowed fields
  const updates: Record<string, unknown> = {}
  for (const field of ALLOWED_FIELDS) {
    if (body[field] !== undefined) {
      updates[field] = body[field]
    }
  }

  // Upsert (insert or update)
  const { data, error } = await supabase
    .from('user_preferences')
    .upsert(
      {
        user_id: user.id,
        ...updates,
      },
      {
        onConflict: 'user_id',
      }
    )
    .select()
    .single()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ data })
}
