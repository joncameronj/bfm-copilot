import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

// GET /api/my-labs/history?markerId=xxx - Get history for a specific marker
export async function GET(request: Request) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const markerId = searchParams.get('markerId')

    if (!markerId) {
      return NextResponse.json({ error: 'markerId is required' }, { status: 400 })
    }

    // Get member's profile
    const { data: profile } = await supabase
      .from('profiles')
      .select('self_patient_id, role')
      .eq('id', user.id)
      .single()

    if (!profile || profile.role !== 'member' || !profile.self_patient_id) {
      return NextResponse.json({ error: 'Not authorized' }, { status: 403 })
    }

    // Get marker info
    const { data: marker } = await supabase
      .from('lab_markers')
      .select('name, display_name, unit')
      .eq('id', markerId)
      .single()

    // Get lab values with dates for this marker
    const { data: values, error } = await supabase
      .from('lab_values')
      .select(`
        value,
        evaluation,
        lab_results!inner (
          test_date,
          patient_id
        )
      `)
      .eq('marker_id', markerId)
      .eq('lab_results.patient_id', profile.self_patient_id)
      .order('lab_results(test_date)', { ascending: true })

    if (error) {
      console.error('Error fetching marker history:', error)
      return NextResponse.json({ error: 'Failed to fetch history' }, { status: 500 })
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const history = values?.map((v: any) => ({
      date: v.lab_results?.test_date,
      value: v.value,
      evaluation: v.evaluation,
    })).filter((h: { date: string }) => h.date) || []

    return NextResponse.json({
      marker: marker || { name: 'Unknown', displayName: 'Unknown', unit: null },
      history,
    })
  } catch (error) {
    console.error('Error in GET /api/my-labs/history:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
