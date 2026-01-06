import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

interface LabValueInput {
  marker_name: string
  value: number
  unit: string
  test_date?: string
  recorded_at?: string
  reference_range?: string
  evaluation?: 'low' | 'normal' | 'moderate' | 'high'
  delta_from_target?: number
  is_ominous?: boolean
  weakness_text?: string
  category?: string
  notes?: string
  source?: 'manual' | 'pdf_upload'
}

// GET /api/member/lab-values - Get member's self-tracked lab values
export async function GET(request: Request) {
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

    // Parse query params for filtering
    const { searchParams } = new URL(request.url)
    const limit = parseInt(searchParams.get('limit') || '100')
    const offset = parseInt(searchParams.get('offset') || '0')
    const markerName = searchParams.get('marker_name')

    let query = supabase
      .from('member_lab_values')
      .select('*')
      .eq('user_id', user.id)
      .order('test_date', { ascending: false })
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1)

    if (markerName) {
      query = query.eq('marker_name', markerName)
    }

    const { data: labValues, error } = await query

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

// POST /api/member/lab-values - Add new lab value(s)
// Supports single value or bulk insert (array of values)
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

    // Support both single value and array of values
    const values: LabValueInput[] = Array.isArray(body) ? body : [body]

    // Validate all values
    for (const v of values) {
      if (!v.marker_name || v.value === undefined || !v.unit) {
        return NextResponse.json({ error: 'Missing required fields: marker_name, value, unit' }, { status: 400 })
      }
    }

    // Prepare rows for insert
    const rows = values.map(v => ({
      user_id: user.id,
      marker_name: v.marker_name,
      value: v.value,
      unit: v.unit,
      test_date: v.test_date || new Date().toISOString().split('T')[0],
      recorded_at: v.recorded_at || new Date().toISOString(),
      reference_range: v.reference_range,
      evaluation: v.evaluation,
      delta_from_target: v.delta_from_target,
      is_ominous: v.is_ominous || false,
      weakness_text: v.weakness_text,
      category: v.category,
      notes: v.notes,
      source: v.source || 'manual',
    }))

    // Use upsert to handle duplicates (same user + marker + test_date)
    const { data: labValues, error } = await supabase
      .from('member_lab_values')
      .upsert(rows, {
        onConflict: 'user_id,marker_name,test_date',
        ignoreDuplicates: false,
      })
      .select()

    if (error) {
      console.error('Error creating lab value(s):', error)
      return NextResponse.json({ error: 'Failed to create lab value(s)', details: error.message }, { status: 500 })
    }

    return NextResponse.json({ labValues }, { status: 201 })
  } catch (error) {
    console.error('Error in lab values POST:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// DELETE /api/member/lab-values - Delete a lab value
export async function DELETE(request: Request) {
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

    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')

    if (!id) {
      return NextResponse.json({ error: 'Missing id parameter' }, { status: 400 })
    }

    // RLS ensures user can only delete their own values
    const { error } = await supabase
      .from('member_lab_values')
      .delete()
      .eq('id', id)
      .eq('user_id', user.id)

    if (error) {
      console.error('Error deleting lab value:', error)
      return NextResponse.json({ error: 'Failed to delete lab value' }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error in lab values DELETE:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
