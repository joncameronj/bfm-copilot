import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import {
  patientToRow,
  rowToPatient,
  type CreatePatientInput,
  type PatientRow,
} from '@/types/patient'
export const dynamic = 'force-dynamic'

// GET /api/patients - List patients
export async function GET(request: Request) {
  try {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const search = searchParams.get('search')
    const status = searchParams.get('status') || 'active'
    const sortBy = searchParams.get('sortBy') || 'created'
    const sortOrder = searchParams.get('sortOrder') || 'desc'
    const hasAlerts = searchParams.get('hasAlerts')

    // Build base query
    let query = supabase
      .from('patients')
      .select(
        `
        *,
        lab_results:lab_results(count),
        conversations:conversations(count)
      `
      )
      .eq('user_id', user.id)

    // Apply status filter
    if (status !== 'all') {
      query = query.eq('status', status)
    }

    // Apply search filter
    if (search) {
      query = query.or(
        `first_name.ilike.%${search}%,last_name.ilike.%${search}%,email.ilike.%${search}%`
      )
    }

    // Apply sorting
    // For age: younger = more recent DOB, so ascending DOB = oldest first, descending DOB = youngest first
    // We invert the sort order for age to make "age-asc" mean youngest first (most intuitive)
    let sortColumn: string
    let ascending = sortOrder === 'asc'

    switch (sortBy) {
      case 'name':
        sortColumn = 'last_name'
        break
      case 'lastVisit':
        sortColumn = 'updated_at'
        break
      case 'age':
        sortColumn = 'date_of_birth'
        // Invert: age-asc (youngest) = descending DOB, age-desc (oldest) = ascending DOB
        ascending = sortOrder !== 'asc'
        break
      default:
        sortColumn = 'created_at'
    }

    query = query.order(sortColumn, { ascending })

    const { data, error } = await query

    if (error) {
      console.error('Error fetching patients:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    const { data: alertRows, error: alertsError } = await supabase
      .from('lab_results')
      .select('patient_id')
      .eq('user_id', user.id)
      .gte('ominous_count', 3)

    if (alertsError) {
      console.error('Error fetching patient alert status:', alertsError)
      return NextResponse.json({ error: alertsError.message }, { status: 500 })
    }

    const patientsWithAlerts = new Set(
      (alertRows || [])
        .map((row) => row.patient_id)
        .filter((id): id is string => Boolean(id))
    )

    // Transform data and add computed fields
    const patients =
      data?.map(
        (
          row: PatientRow & {
            lab_results: { count: number }[]
            conversations: { count: number }[]
          }
        ) => {
          const patient = rowToPatient(row)
          return {
            ...patient,
            labCount: row.lab_results?.[0]?.count || 0,
            conversationCount: row.conversations?.[0]?.count || 0,
            hasOminousAlerts: patientsWithAlerts.has(patient.id),
          }
        }
      ) || []

    // Filter by ominous alerts if requested
    let filteredPatients = patients
    if (hasAlerts === 'true') {
      filteredPatients = patients.filter((patient) => patient.hasOminousAlerts)
    }

    return NextResponse.json({ data: filteredPatients })
  } catch (error) {
    console.error('Patients GET error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

// POST /api/patients - Create patient
export async function POST(request: Request) {
  try {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body: CreatePatientInput = await request.json()

    // Validate required fields
    if (
      !body.firstName ||
      !body.lastName ||
      !body.dateOfBirth ||
      !body.gender
    ) {
      return NextResponse.json(
        { error: 'firstName, lastName, dateOfBirth, and gender are required' },
        { status: 400 }
      )
    }

    const patientData = patientToRow(body, user.id)

    const { data, error } = await supabase
      .from('patients')
      .insert(patientData)
      .select()
      .single()

    if (error) {
      console.error('Error creating patient:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    // Track usage event (for WS-5 analytics)
    try {
      await supabase.from('usage_events').insert({
        user_id: user.id,
        event_type: 'patient_created',
        metadata: { patient_id: data.id },
      })
    } catch {
      // Silently fail - tracking shouldn't break the app
    }

    return NextResponse.json({ data: rowToPatient(data) }, { status: 201 })
  } catch (error) {
    console.error('Patients POST error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
