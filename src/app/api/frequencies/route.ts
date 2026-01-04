import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

// GET /api/frequencies - List all FSM frequencies
export async function GET(request: Request) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const category = searchParams.get('category')
    const search = searchParams.get('search')
    const activeOnly = searchParams.get('activeOnly') !== 'false' // Default to true

    let query = supabase
      .from('fsm_frequencies')
      .select('*')
      .order('category', { ascending: true })
      .order('name', { ascending: true })

    if (activeOnly) {
      query = query.eq('is_active', true)
    }

    if (category && category !== 'all') {
      query = query.eq('category', category)
    }

    if (search) {
      query = query.or(`name.ilike.%${search}%,condition.ilike.%${search}%,description.ilike.%${search}%`)
    }

    const { data: frequencies, error } = await query

    if (error) {
      console.error('Error fetching frequencies:', error)
      return NextResponse.json({ error: 'Failed to fetch frequencies' }, { status: 500 })
    }

    // Get unique categories for filtering
    const { data: categories } = await supabase
      .from('fsm_frequencies')
      .select('category')
      .eq('is_active', true)
      .not('category', 'is', null)

    const uniqueCategories = [...new Set(categories?.map(c => c.category).filter(Boolean))]

    const transformed = frequencies.map((f) => ({
      id: f.id,
      name: f.name,
      frequencyA: f.frequency_a,
      frequencyB: f.frequency_b,
      category: f.category,
      condition: f.condition,
      description: f.description,
      source: f.source,
      isActive: f.is_active,
      createdAt: f.created_at,
      updatedAt: f.updated_at,
    }))

    return NextResponse.json({
      frequencies: transformed,
      categories: uniqueCategories,
    })
  } catch (error) {
    console.error('Error in GET /api/frequencies:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
