import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

interface DailyProtocolInput {
  entry_date: string
  morning_light_time?: string
  morning_light_duration_minutes?: number
  first_meal_time?: string
  wake_time?: string
  first_meal_within_30min?: boolean
  breakfast_protein_grams?: number
  daily_carbs_grams?: number
  blue_blockers_worn?: boolean
  blue_blockers_start_time?: string
  darkness_hours?: number
  sleep_hours?: number
  sleep_quality_rating?: number
  bedtime?: string
  phone_off_time?: string
  wifi_off?: boolean
  energy_level_rating?: number
  symptom_notes?: string
}

// GET /api/protocols/daily - Get member's daily protocol entries
export async function GET(request: Request) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Verify member role
    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single()

    if (profile?.role !== 'member') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    // Parse query params
    const { searchParams } = new URL(request.url)
    const startDate = searchParams.get('start_date')
    const endDate = searchParams.get('end_date') || new Date().toISOString().split('T')[0]
    const date = searchParams.get('date') // Get single date entry
    const limit = parseInt(searchParams.get('limit') || '90')

    // If specific date requested, return single entry
    if (date) {
      const { data: entry, error } = await supabase
        .from('daily_protocols')
        .select('*')
        .eq('user_id', user.id)
        .eq('entry_date', date)
        .single()

      if (error && error.code !== 'PGRST116') { // PGRST116 = no rows found
        console.error('Error fetching protocol entry:', error)
        return NextResponse.json({ error: 'Failed to fetch protocol entry' }, { status: 500 })
      }

      return NextResponse.json({ entry: entry || null })
    }

    // Build query for multiple entries
    let query = supabase
      .from('daily_protocols')
      .select('*')
      .eq('user_id', user.id)
      .lte('entry_date', endDate)
      .order('entry_date', { ascending: false })
      .limit(limit)

    if (startDate) {
      query = query.gte('entry_date', startDate)
    }

    const { data: entries, error } = await query

    if (error) {
      console.error('Error fetching protocol entries:', error)
      return NextResponse.json({ error: 'Failed to fetch protocol entries' }, { status: 500 })
    }

    // Also get current streak
    const { data: streakData } = await supabase.rpc('get_current_streak', {
      p_user_id: user.id
    })

    return NextResponse.json({
      entries,
      streak: streakData || 0
    })
  } catch (error) {
    console.error('Error in protocols GET:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// POST /api/protocols/daily - Create or update daily protocol entry
export async function POST(request: Request) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Verify member role
    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single()

    if (profile?.role !== 'member') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const body: DailyProtocolInput = await request.json()

    // Validate required field
    if (!body.entry_date) {
      return NextResponse.json({ error: 'Missing required field: entry_date' }, { status: 400 })
    }

    // Validate entry_date format (YYYY-MM-DD)
    const dateRegex = /^\d{4}-\d{2}-\d{2}$/
    if (!dateRegex.test(body.entry_date)) {
      return NextResponse.json({ error: 'Invalid date format. Use YYYY-MM-DD' }, { status: 400 })
    }

    // Validate ratings are within range
    if (body.sleep_quality_rating && (body.sleep_quality_rating < 1 || body.sleep_quality_rating > 10)) {
      return NextResponse.json({ error: 'sleep_quality_rating must be between 1 and 10' }, { status: 400 })
    }
    if (body.energy_level_rating && (body.energy_level_rating < 1 || body.energy_level_rating > 10)) {
      return NextResponse.json({ error: 'energy_level_rating must be between 1 and 10' }, { status: 400 })
    }

    // Upsert entry (update if exists for this date, insert if new)
    const { data: entry, error } = await supabase
      .from('daily_protocols')
      .upsert({
        user_id: user.id,
        entry_date: body.entry_date,
        morning_light_time: body.morning_light_time,
        morning_light_duration_minutes: body.morning_light_duration_minutes,
        first_meal_time: body.first_meal_time,
        wake_time: body.wake_time,
        first_meal_within_30min: body.first_meal_within_30min,
        breakfast_protein_grams: body.breakfast_protein_grams,
        daily_carbs_grams: body.daily_carbs_grams,
        blue_blockers_worn: body.blue_blockers_worn,
        blue_blockers_start_time: body.blue_blockers_start_time,
        darkness_hours: body.darkness_hours,
        sleep_hours: body.sleep_hours,
        sleep_quality_rating: body.sleep_quality_rating,
        bedtime: body.bedtime,
        phone_off_time: body.phone_off_time,
        wifi_off: body.wifi_off,
        energy_level_rating: body.energy_level_rating,
        symptom_notes: body.symptom_notes,
      }, {
        onConflict: 'user_id,entry_date',
        ignoreDuplicates: false,
      })
      .select()
      .single()

    if (error) {
      console.error('Error saving protocol entry:', error)
      return NextResponse.json({ error: 'Failed to save protocol entry', details: error.message }, { status: 500 })
    }

    // Get updated streak
    const { data: streakData } = await supabase.rpc('get_current_streak', {
      p_user_id: user.id
    })

    return NextResponse.json({
      entry,
      streak: streakData || 0,
      message: 'Protocol entry saved successfully'
    }, { status: 201 })
  } catch (error) {
    console.error('Error in protocols POST:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// DELETE /api/protocols/daily - Delete a protocol entry
export async function DELETE(request: Request) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Verify member role
    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single()

    if (profile?.role !== 'member') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const { searchParams } = new URL(request.url)
    const entryDate = searchParams.get('date')
    const id = searchParams.get('id')

    if (!entryDate && !id) {
      return NextResponse.json({ error: 'Missing date or id parameter' }, { status: 400 })
    }

    let query = supabase
      .from('daily_protocols')
      .delete()
      .eq('user_id', user.id)

    if (id) {
      query = query.eq('id', id)
    } else if (entryDate) {
      query = query.eq('entry_date', entryDate)
    }

    const { error } = await query

    if (error) {
      console.error('Error deleting protocol entry:', error)
      return NextResponse.json({ error: 'Failed to delete protocol entry' }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error in protocols DELETE:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
