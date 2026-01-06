import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import type { ApprovedFrequenciesResponse } from '@/types/frequency'

export const dynamic = 'force-dynamic'

/**
 * GET /api/approved-frequencies
 * Fetch approved frequency list with filtering and search
 *
 * Query params:
 * - category: 'all' | 'thyroid' | 'diabetes' | 'neurological' | 'hormones' (default: 'all')
 * - search: string to search in frequency name and aliases
 * - isActive: boolean (default: true)
 * - limit: number of results (default: 100)
 */
export async function GET(request: Request) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Verify user is a practitioner or admin
    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single()

    if (!profile || !['practitioner', 'admin'].includes(profile.role)) {
      return NextResponse.json(
        { error: 'Only practitioners and admins can access approved frequencies' },
        { status: 403 }
      )
    }

    const { searchParams } = new URL(request.url)
    const category = searchParams.get('category') || 'all'
    const search = searchParams.get('search') || ''
    const isActive = searchParams.get('isActive') !== 'false'
    const limit = Math.min(parseInt(searchParams.get('limit') || '100', 10), 1000)

    let query = supabase
      .from('approved_frequency_names')
      .select('*', { count: 'exact' })
      .eq('is_active', isActive)
      .order('name', { ascending: true })
      .limit(limit)

    // Filter by category if specified
    if (category && category !== 'all') {
      query = query.eq('category', category)
    }

    // Search in name and aliases
    if (search) {
      const searchLower = search.toLowerCase()
      // For now, we'll filter by name on the server side
      // A more advanced implementation could use Postgres full-text search
      query = query.ilike('name', `%${search}%`)
    }

    const { data: frequencies, error, count } = await query

    if (error) {
      console.error('Error fetching approved frequencies:', error)
      return NextResponse.json(
        { error: 'Failed to fetch approved frequencies' },
        { status: 500 }
      )
    }

    // Transform database response to API response
    const transformed = frequencies.map((f) => ({
      id: f.id,
      name: f.name,
      aliases: f.aliases || [],
      category: f.category,
      description: f.description,
      sourceImageId: f.source_image_id,
      isActive: f.is_active,
      createdAt: f.created_at,
      updatedAt: f.updated_at,
    }))

    const response: ApprovedFrequenciesResponse = {
      frequencies: transformed,
      total: count || 0,
    }

    return NextResponse.json(response)
  } catch (error) {
    console.error('Error in GET /api/approved-frequencies:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
