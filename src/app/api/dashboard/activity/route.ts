import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
export const dynamic = 'force-dynamic'

// GET /api/dashboard/activity - Get recent activity
export async function GET() {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Get recent conversations
    const { data, error } = await supabase
      .from('conversations')
      .select('id, title, conversation_type, created_at, updated_at')
      .eq('user_id', user.id)
      .order('updated_at', { ascending: false })
      .limit(10)

    if (error) {
      console.error('Dashboard activity error:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ data })
  } catch (error) {
    console.error('Dashboard activity error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
