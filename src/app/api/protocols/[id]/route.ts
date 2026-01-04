import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

interface RouteParams {
  params: Promise<{ id: string }>
}

// GET /api/protocols/[id] - Get single protocol with feedback
export async function GET(request: Request, { params }: RouteParams) {
  try {
    const { id } = await params
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { data: protocol, error } = await supabase
      .from('protocols')
      .select(`
        *,
        patients (
          id,
          first_name,
          last_name,
          date_of_birth,
          gender
        ),
        protocol_feedback (
          id,
          outcome,
          outcome_text,
          adjustments_made,
          rating,
          lab_comparison,
          created_at
        )
      `)
      .eq('id', id)
      .eq('practitioner_id', user.id)
      .single()

    if (error || !protocol) {
      return NextResponse.json({ error: 'Protocol not found' }, { status: 404 })
    }

    return NextResponse.json({
      protocol: {
        id: protocol.id,
        practitionerId: protocol.practitioner_id,
        patientId: protocol.patient_id,
        patient: protocol.patients ? {
          id: protocol.patients.id,
          firstName: protocol.patients.first_name,
          lastName: protocol.patients.last_name,
          dateOfBirth: protocol.patients.date_of_birth,
          gender: protocol.patients.gender,
        } : null,
        title: protocol.title,
        content: protocol.content,
        category: protocol.category,
        status: protocol.status,
        durationDays: protocol.duration_days,
        startDate: protocol.start_date,
        endDate: protocol.end_date,
        notes: protocol.notes,
        createdAt: protocol.created_at,
        updatedAt: protocol.updated_at,
        feedback: protocol.protocol_feedback?.map((f: Record<string, unknown>) => ({
          id: f.id,
          outcome: f.outcome,
          outcomeText: f.outcome_text,
          adjustmentsMade: f.adjustments_made,
          rating: f.rating,
          labComparison: f.lab_comparison,
          createdAt: f.created_at,
        })) || [],
      }
    })
  } catch (error) {
    console.error('Error in GET /api/protocols/[id]:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// PUT /api/protocols/[id] - Update protocol
export async function PUT(request: Request, { params }: RouteParams) {
  try {
    const { id } = await params
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { title, content, category, status, durationDays, startDate, endDate, notes } = body

    const validStatuses = ['draft', 'active', 'completed', 'archived', 'superseded']
    if (status && !validStatuses.includes(status)) {
      return NextResponse.json({ error: 'Invalid status' }, { status: 400 })
    }

    const validCategories = ['general', 'detox', 'hormone', 'gut', 'immune', 'metabolic', 'neurological']
    if (category && !validCategories.includes(category)) {
      return NextResponse.json({ error: 'Invalid category' }, { status: 400 })
    }

    const updateData: Record<string, unknown> = { updated_at: new Date().toISOString() }
    if (title !== undefined) updateData.title = title
    if (content !== undefined) updateData.content = content
    if (category !== undefined) updateData.category = category
    if (status !== undefined) updateData.status = status
    if (durationDays !== undefined) updateData.duration_days = durationDays
    if (startDate !== undefined) updateData.start_date = startDate
    if (endDate !== undefined) updateData.end_date = endDate
    if (notes !== undefined) updateData.notes = notes

    const { data: protocol, error } = await supabase
      .from('protocols')
      .update(updateData)
      .eq('id', id)
      .eq('practitioner_id', user.id)
      .select()
      .single()

    if (error || !protocol) {
      return NextResponse.json({ error: 'Protocol not found' }, { status: 404 })
    }

    return NextResponse.json({
      protocol: {
        id: protocol.id,
        practitionerId: protocol.practitioner_id,
        patientId: protocol.patient_id,
        title: protocol.title,
        content: protocol.content,
        category: protocol.category,
        status: protocol.status,
        durationDays: protocol.duration_days,
        startDate: protocol.start_date,
        endDate: protocol.end_date,
        notes: protocol.notes,
        createdAt: protocol.created_at,
        updatedAt: protocol.updated_at,
      }
    })
  } catch (error) {
    console.error('Error in PUT /api/protocols/[id]:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// DELETE /api/protocols/[id]
export async function DELETE(request: Request, { params }: RouteParams) {
  try {
    const { id } = await params
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { error } = await supabase
      .from('protocols')
      .delete()
      .eq('id', id)
      .eq('practitioner_id', user.id)

    if (error) {
      console.error('Error deleting protocol:', error)
      return NextResponse.json({ error: 'Failed to delete' }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error in DELETE /api/protocols/[id]:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
