import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
export const dynamic = 'force-dynamic'

// GET /api/dashboard/stats - Get dashboard statistics
export async function GET() {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Get counts in parallel
    const [
      patientsResult,
      labsResult,
      alertsResult,
      conversationsResult,
    ] = await Promise.all([
      // Active patients count
      supabase
        .from('patients')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', user.id)
        .eq('status', 'active'),

      // Lab results count
      supabase
        .from('lab_results')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', user.id),

      // Critical alerts (labs with 3+ ominous markers)
      supabase
        .from('lab_results')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', user.id)
        .gte('ominous_count', 3),

      // Conversations this month
      supabase
        .from('conversations')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', user.id)
        .gte('created_at', new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString()),
    ])

    return NextResponse.json({
      data: {
        patientCount: patientsResult.count || 0,
        labCount: labsResult.count || 0,
        alertCount: alertsResult.count || 0,
        monthlyConversations: conversationsResult.count || 0,
      }
    })
  } catch (error) {
    console.error('Dashboard stats error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
