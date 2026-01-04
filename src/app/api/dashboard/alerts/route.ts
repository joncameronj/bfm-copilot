import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
export const dynamic = 'force-dynamic'

// GET /api/dashboard/alerts - Get critical alerts (labs with 3+ ominous markers)
export async function GET() {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Get lab results with 3+ ominous markers, joined with patient info
    const { data, error } = await supabase
      .from('lab_results')
      .select(`
        id,
        patient_id,
        test_date,
        ominous_count,
        ominous_markers_triggered,
        patients!inner(first_name, last_name)
      `)
      .eq('user_id', user.id)
      .gte('ominous_count', 3)
      .order('test_date', { ascending: false })
      .limit(10)

    if (error) {
      console.error('Dashboard alerts error:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    // Transform data for easier consumption
    const alerts = data?.map((item) => {
      // Handle the patient data (could be an object or array from join)
      const patientData = Array.isArray(item.patients)
        ? item.patients[0]
        : item.patients
      const patient = patientData as { first_name?: string; last_name?: string } | null

      return {
        id: item.id,
        patient_id: item.patient_id,
        patient_first_name: patient?.first_name || '',
        patient_last_name: patient?.last_name || '',
        test_date: item.test_date,
        ominous_count: item.ominous_count,
        ominous_markers_triggered: item.ominous_markers_triggered || [],
      }
    }) || []

    return NextResponse.json({ data: alerts })
  } catch (error) {
    console.error('Dashboard alerts error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
