// src/app/api/admin/users/[id]/route.ts
// Admin user management - individual user operations (WS-5)

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

// GET /api/admin/users/[id] - Get a specific user
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const supabase = await createClient()
  const { id } = await params

  const auth = await verifyAdmin(supabase)
  if ('error' in auth) {
    return NextResponse.json({ error: auth.error }, { status: auth.status })
  }

  const { data: profile, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', id)
    .single()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 404 })
  }

  // Get usage counts
  const { data: events } = await supabase
    .from('usage_events')
    .select('event_type, created_at')
    .eq('user_id', id)
    .order('created_at', { ascending: false })

  const eventCounts = (events || []).reduce(
    (acc, event) => {
      acc[event.event_type] = (acc[event.event_type] || 0) + 1
      return acc
    },
    {} as Record<string, number>
  )

  return NextResponse.json({
    data: {
      ...profile,
      labsCount: eventCounts['lab_analysis'] || 0,
      protocolsCount: eventCounts['protocol_generated'] || 0,
      conversationsCount: eventCounts['conversation_started'] || 0,
      feedbackCount: eventCounts['feedback_submitted'] || 0,
      lastActive: events?.[0]?.created_at || null,
    },
  })
}

// PUT /api/admin/users/[id] - Update a user
export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const supabase = await createClient()
  const { id } = await params

  const auth = await verifyAdmin(supabase)
  if ('error' in auth) {
    return NextResponse.json({ error: auth.error }, { status: auth.status })
  }

  const body = await request.json()
  const { role, status, fullName } = body

  // Prevent admin from demoting themselves
  if (id === auth.user.id && role && role !== 'admin') {
    return NextResponse.json(
      { error: 'Cannot change own role' },
      { status: 400 }
    )
  }

  // Prevent admin from deactivating themselves
  if (id === auth.user.id && status === 'inactive') {
    return NextResponse.json(
      { error: 'Cannot deactivate own account' },
      { status: 400 }
    )
  }

  // Validate role if provided
  if (role && !['admin', 'practitioner', 'member'].includes(role)) {
    return NextResponse.json({ error: 'Invalid role' }, { status: 400 })
  }

  // Validate status if provided
  if (status && !['active', 'inactive'].includes(status)) {
    return NextResponse.json({ error: 'Invalid status' }, { status: 400 })
  }

  // Build update object
  const updates: Record<string, unknown> = {}
  if (role) updates.role = role
  if (status) updates.status = status
  if (fullName !== undefined) updates.full_name = fullName

  const { data, error } = await supabase
    .from('profiles')
    .update(updates)
    .eq('id', id)
    .select()
    .single()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ data })
}

// DELETE /api/admin/users/[id] - Deactivate a user (soft delete)
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const supabase = await createClient()
  const { id } = await params

  const auth = await verifyAdmin(supabase)
  if ('error' in auth) {
    return NextResponse.json({ error: auth.error }, { status: auth.status })
  }

  // Prevent admin from deleting themselves
  if (id === auth.user.id) {
    return NextResponse.json(
      { error: 'Cannot delete own account' },
      { status: 400 }
    )
  }

  // Soft delete - set status to inactive
  const { error } = await supabase
    .from('profiles')
    .update({ status: 'inactive' })
    .eq('id', id)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ message: 'User deactivated' })
}
