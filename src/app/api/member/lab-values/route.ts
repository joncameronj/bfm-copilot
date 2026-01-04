import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

// GET /api/member/lab-values - Get member's self-tracked lab values
export async function GET() {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Verify member role
    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single()

    if (profile?.role !== 'member') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const { data: labValues, error } = await supabase
      .from('member_lab_values')
      .select('*')
      .eq('user_id', user.id)
      .order('recorded_at', { ascending: false })
      .limit(100)

    if (error) {
      console.error('Error fetching lab values:', error)
      return NextResponse.json({ error: 'Failed to fetch lab values' }, { status: 500 })
    }

    return NextResponse.json({ labValues })
  } catch (error) {
    console.error('Error in lab values GET:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// POST /api/member/lab-values - Add a new lab value
export async function POST(request: Request) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Verify member role
    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single()

    if (profile?.role !== 'member') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const body = await request.json()
    const { marker_name, value, unit, recorded_at, notes } = body

    if (!marker_name || value === undefined || !unit) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    const { data: labValue, error } = await supabase
      .from('member_lab_values')
      .insert({
        user_id: user.id,
        marker_name,
        value,
        unit,
        recorded_at: recorded_at || new Date().toISOString(),
        notes,
      })
      .select()
      .single()

    if (error) {
      console.error('Error creating lab value:', error)
      return NextResponse.json({ error: 'Failed to create lab value' }, { status: 500 })
    }

    return NextResponse.json({ labValue }, { status: 201 })
  } catch (error) {
    console.error('Error in lab values POST:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
