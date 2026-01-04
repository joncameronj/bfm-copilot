import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

// GET /api/admin/alerts/accuracy - Check accuracy metrics
export async function GET(request: Request) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Verify admin role
    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single()

    if (!profile || profile.role !== 'admin') {
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 })
    }

    const { searchParams } = new URL(request.url)
    const period = searchParams.get('period') || '7d'

    // Calculate date range
    const startDate = new Date()
    if (period === '7d') {
      startDate.setDate(startDate.getDate() - 7)
    } else if (period === '30d') {
      startDate.setDate(startDate.getDate() - 30)
    } else {
      startDate.setDate(startDate.getDate() - 7)
    }

    // Get feedback within period
    const { data: feedback, error } = await supabase
      .from('feedback')
      .select('rating')
      .gte('created_at', startDate.toISOString())

    if (error) {
      console.error('Error fetching feedback:', error)
      return NextResponse.json({ error: 'Failed to fetch metrics' }, { status: 500 })
    }

    const total = feedback?.length || 0
    const positive = feedback?.filter((f) => f.rating === 'positive').length || 0
    const accuracy = total > 0 ? Math.round((positive / total) * 100) : 100
    const threshold = 80

    return NextResponse.json({
      accuracy,
      total,
      positive,
      threshold,
      belowThreshold: accuracy < threshold,
      period,
    })
  } catch (error) {
    console.error('Error in GET /api/admin/alerts/accuracy:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
