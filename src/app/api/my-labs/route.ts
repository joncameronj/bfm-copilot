import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

// GET /api/my-labs - Get member's own lab results
export async function GET() {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Get member's profile to find self_patient_id
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('self_patient_id, role')
      .eq('id', user.id)
      .single()

    if (profileError || !profile) {
      return NextResponse.json({ error: 'Profile not found' }, { status: 404 })
    }

    if (profile.role !== 'member') {
      return NextResponse.json({ error: 'Not authorized for member labs' }, { status: 403 })
    }

    if (!profile.self_patient_id) {
      return NextResponse.json({ results: [], message: 'No patient record linked' })
    }

    // Get lab results for this patient
    const { data: results, error: resultsError } = await supabase
      .from('lab_results')
      .select(`
        id,
        test_date,
        ominous_count,
        ominous_markers_triggered,
        notes,
        created_at,
        lab_values (
          id,
          marker_id,
          value,
          evaluation,
          delta_from_target,
          weakness_text,
          is_ominous
        )
      `)
      .eq('patient_id', profile.self_patient_id)
      .order('test_date', { ascending: false })

    if (resultsError) {
      console.error('Error fetching lab results:', resultsError)
      return NextResponse.json({ error: 'Failed to fetch lab results' }, { status: 500 })
    }

    return NextResponse.json({ results: results || [] })
  } catch (error) {
    console.error('Error in GET /api/my-labs:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
