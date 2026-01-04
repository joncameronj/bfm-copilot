import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { rowToPatient, type UpdatePatientInput, type PatientRow } from '@/types/patient'
export const dynamic = 'force-dynamic'

interface RouteParams {
  params: Promise<{ id: string }>
}

// GET /api/patients/[id] - Get single patient
export async function GET(request: Request, { params }: RouteParams) {
  try {
    const { id } = await params
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { data, error } = await supabase
      .from('patients')
      .select(`
        *,
        lab_results:lab_results(
          id,
          test_date,
          ominous_count,
          ominous_markers_triggered,
          created_at
        ),
        conversations:conversations(
          id,
          title,
          conversation_type,
          updated_at
        )
      `)
      .eq('id', id)
      .eq('user_id', user.id)
      .single()

    if (error) {
      if (error.code === 'PGRST116') {
        return NextResponse.json({ error: 'Patient not found' }, { status: 404 })
      }
      console.error('Error fetching patient:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    const patient = rowToPatient(data as PatientRow)

    // Compute hasOminousAlerts
    const hasOminousAlerts = data.lab_results?.some(
      (lab: { ominous_count: number }) => lab.ominous_count >= 3
    ) || false

    return NextResponse.json({
      data: {
        ...patient,
        labCount: data.lab_results?.length || 0,
        conversationCount: data.conversations?.length || 0,
        hasOminousAlerts,
        recentLabs: data.lab_results?.slice(0, 5) || [],
        recentConversations: data.conversations?.slice(0, 5) || [],
      }
    })
  } catch (error) {
    console.error('Patient GET error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// PUT /api/patients/[id] - Update patient
export async function PUT(request: Request, { params }: RouteParams) {
  try {
    const { id } = await params
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body: UpdatePatientInput = await request.json()

    // Build update object with snake_case keys
    const updates: Record<string, unknown> = {}
    if (body.firstName !== undefined) updates.first_name = body.firstName
    if (body.lastName !== undefined) updates.last_name = body.lastName
    if (body.dateOfBirth !== undefined) updates.date_of_birth = body.dateOfBirth
    if (body.gender !== undefined) updates.gender = body.gender
    if (body.email !== undefined) updates.email = body.email
    if (body.phone !== undefined) updates.phone = body.phone
    if (body.chiefComplaints !== undefined) updates.chief_complaints = body.chiefComplaints
    if (body.medicalHistory !== undefined) updates.medical_history = body.medicalHistory
    if (body.currentMedications !== undefined) updates.current_medications = body.currentMedications
    if (body.allergies !== undefined) updates.allergies = body.allergies
    if (body.status !== undefined) updates.status = body.status

    const { data, error } = await supabase
      .from('patients')
      .update(updates)
      .eq('id', id)
      .eq('user_id', user.id)
      .select()
      .single()

    if (error) {
      if (error.code === 'PGRST116') {
        return NextResponse.json({ error: 'Patient not found' }, { status: 404 })
      }
      console.error('Error updating patient:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ data: rowToPatient(data) })
  } catch (error) {
    console.error('Patient PUT error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// DELETE /api/patients/[id] - Soft delete patient (set status to inactive)
export async function DELETE(request: Request, { params }: RouteParams) {
  try {
    const { id } = await params
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Soft delete - set status to inactive
    const { error } = await supabase
      .from('patients')
      .update({ status: 'inactive' })
      .eq('id', id)
      .eq('user_id', user.id)

    if (error) {
      console.error('Error deleting patient:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ message: 'Patient deactivated successfully' })
  } catch (error) {
    console.error('Patient DELETE error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
