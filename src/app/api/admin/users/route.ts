// src/app/api/admin/users/route.ts
// Admin user management API (WS-5)

import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { type UserRole } from '@/types/roles'

function getRecoveryRedirectTo(request: Request): string {
  return new URL('/update-password', request.url).toString()
}
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

// GET /api/admin/users - List all users with stats
export async function GET(request: Request) {
  const supabase = await createClient()

  const auth = await verifyAdmin(supabase)
  if ('error' in auth) {
    return NextResponse.json({ error: auth.error }, { status: auth.status })
  }

  // Get query params
  const { searchParams } = new URL(request.url)
  const role = searchParams.get('role')
  const status = searchParams.get('status')
  const search = searchParams.get('search')

  // Build query - join profiles with usage counts
  let query = supabase
    .from('profiles')
    .select(
      `
      id,
      email,
      full_name,
      role,
      status,
      created_at,
      updated_at
    `
    )
    .order('created_at', { ascending: false })

  if (role) {
    query = query.eq('role', role)
  }
  if (status) {
    query = query.eq('status', status)
  }
  if (search) {
    query = query.or(`email.ilike.%${search}%,full_name.ilike.%${search}%`)
  }

  const { data: profiles, error } = await query

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  // Get usage counts for each user
  const usersWithStats = await Promise.all(
    (profiles || []).map(async (profile) => {
      // Get event counts
      const { data: events } = await supabase
        .from('usage_events')
        .select('event_type')
        .eq('user_id', profile.id)

      const eventCounts = (events || []).reduce(
        (acc, event) => {
          acc[event.event_type] = (acc[event.event_type] || 0) + 1
          return acc
        },
        {} as Record<string, number>
      )

      // Get last active time
      const { data: lastEvent } = await supabase
        .from('usage_events')
        .select('created_at')
        .eq('user_id', profile.id)
        .order('created_at', { ascending: false })
        .limit(1)
        .single()

      return {
        user_id: profile.id,
        email: profile.email,
        full_name: profile.full_name,
        role: profile.role as UserRole,
        status: profile.status,
        labs_count: eventCounts['lab_analysis'] || 0,
        protocols_count: eventCounts['protocol_generated'] || 0,
        conversations_count: eventCounts['conversation_started'] || 0,
        feedback_count: eventCounts['feedback_submitted'] || 0,
        last_active: lastEvent?.created_at || null,
        user_created_at: profile.created_at,
      }
    })
  )

  return NextResponse.json({ data: usersWithStats })
}

// POST /api/admin/users - Create a new user
export async function POST(request: Request) {
  const supabase = await createClient()

  const auth = await verifyAdmin(supabase)
  if ('error' in auth) {
    return NextResponse.json({ error: auth.error }, { status: auth.status })
  }

  const body = await request.json()
  const { email, fullName, role } = body

  if (!email || !role) {
    return NextResponse.json(
      { error: 'Email and role are required' },
      { status: 400 }
    )
  }

  // Validate role
  if (!['admin', 'practitioner', 'member'].includes(role)) {
    return NextResponse.json({ error: 'Invalid role' }, { status: 400 })
  }

  try {
    // For creating users with admin API, we need to use the service role
    // Since we don't have service role here, we'll create via sign up
    // and then update the profile

    // Generate a temporary password
    const tempPassword = crypto.randomUUID()

    const { data: authData, error: authError } = await supabase.auth.admin.createUser({
      email,
      password: tempPassword,
      email_confirm: true,
      user_metadata: { full_name: fullName },
    })

    if (authError) {
      // If admin API fails, try regular signup (less ideal but works)
      const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
        email,
        password: tempPassword,
        options: {
          data: { full_name: fullName },
        },
      })

      if (signUpError) {
        return NextResponse.json({ error: signUpError.message }, { status: 500 })
      }

      if (signUpData.user) {
        // Update profile with role
        await supabase
          .from('profiles')
          .update({ role, full_name: fullName })
          .eq('id', signUpData.user.id)

        // Send password reset email so user can set their password
        await supabase.auth.resetPasswordForEmail(email, {
          redirectTo: getRecoveryRedirectTo(request),
        })

        return NextResponse.json({
          data: { id: signUpData.user.id, email, role },
          message: 'User created. Password reset email sent.',
        })
      }
    }

    if (authData?.user) {
      // Update profile with role
      await supabase
        .from('profiles')
        .update({ role, full_name: fullName })
        .eq('id', authData.user.id)

      // Send password reset email
      await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: getRecoveryRedirectTo(request),
      })

      return NextResponse.json({
        data: { id: authData.user.id, email, role },
        message: 'User created. Password reset email sent.',
      })
    }

    return NextResponse.json({ error: 'Failed to create user' }, { status: 500 })
  } catch (error) {
    console.error('Error creating user:', error)
    return NextResponse.json(
      { error: 'Failed to create user' },
      { status: 500 }
    )
  }
}
