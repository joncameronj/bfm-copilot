// src/app/api/admin/demo-mode/route.ts
// Demo mode toggle API for admin dashboard

import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

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

// GET /api/admin/demo-mode - Get current demo mode status
export async function GET() {
  const supabase = await createClient()

  const auth = await verifyAdmin(supabase)
  if ('error' in auth) {
    return NextResponse.json({ error: auth.error }, { status: auth.status })
  }

  const { data: setting, error } = await supabase
    .from('system_config')
    .select('value')
    .eq('key', 'demo_mode_enabled')
    .single()

  if (error && error.code !== 'PGRST116') {
    // PGRST116 is "not found" which is OK
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  // Parse the value - stored as JSON string
  let enabled = false
  if (setting?.value) {
    const value = typeof setting.value === 'string'
      ? setting.value.replace(/^"|"$/g, '')
      : String(setting.value)
    enabled = value === 'true'
  }

  return NextResponse.json({ enabled })
}

// PUT /api/admin/demo-mode - Update demo mode status
export async function PUT(request: Request) {
  const supabase = await createClient()

  const auth = await verifyAdmin(supabase)
  if ('error' in auth) {
    return NextResponse.json({ error: auth.error }, { status: auth.status })
  }

  const body = await request.json()
  const { enabled } = body as { enabled: boolean }

  if (typeof enabled !== 'boolean') {
    return NextResponse.json(
      { error: 'Invalid enabled value - must be boolean' },
      { status: 400 }
    )
  }

  const { error } = await supabase
    .from('system_config')
    .upsert(
      {
        key: 'demo_mode_enabled',
        value: JSON.stringify(enabled),
        description: 'When enabled, returns hard-coded results for case study diagnostic files',
        updated_by: auth.user.id,
      },
      { onConflict: 'key' }
    )

  if (error) {
    console.error('Error updating demo mode:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  console.log(`[Demo Mode] ${enabled ? 'ENABLED' : 'DISABLED'} by admin ${auth.user.email}`)

  return NextResponse.json({ enabled })
}
