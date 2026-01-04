import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

// GET /api/practitioner/practice-info
export async function GET() {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { data: profile } = await supabase
      .from('profiles')
      .select('role, practice_name, specialty, phone, address, website')
      .eq('id', user.id)
      .single()

    if (profile?.role !== 'practitioner') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    return NextResponse.json({
      practiceInfo: {
        practice_name: profile.practice_name,
        specialty: profile.specialty,
        phone: profile.phone,
        address: profile.address,
        website: profile.website,
      }
    })
  } catch (error) {
    console.error('Error fetching practice info:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// PUT /api/practitioner/practice-info
export async function PUT(request: Request) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single()

    if (profile?.role !== 'practitioner') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const body = await request.json()
    const { practice_name, specialty, phone, address, website } = body

    const { error } = await supabase
      .from('profiles')
      .update({
        practice_name,
        specialty,
        phone,
        address,
        website,
        updated_at: new Date().toISOString(),
      })
      .eq('id', user.id)

    if (error) {
      console.error('Error updating practice info:', error)
      return NextResponse.json({ error: 'Failed to update practice info' }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error in practice info PUT:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
