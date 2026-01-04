// src/app/api/admin/analytics/route.ts
// Admin analytics API (WS-5)

import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { type UserRole } from '@/types/roles'
export const dynamic = 'force-dynamic'

// Helper to verify admin role
async function verifyAdmin(supabase: Awaited<ReturnType<typeof createClient>>) {
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return { error: 'Unauthorized', status: 401 }
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  if (profile?.role !== 'admin') {
    return { error: 'Forbidden', status: 403 }
  }

  return { user, profile }
}

// GET /api/admin/analytics - Get analytics data
export async function GET(request: Request) {
  const supabase = await createClient()

  const auth = await verifyAdmin(supabase)
  if ('error' in auth) {
    return NextResponse.json({ error: auth.error }, { status: auth.status })
  }

  // Get query params
  const { searchParams } = new URL(request.url)
  const startDate = searchParams.get('startDate') || '2000-01-01'
  const endDate = searchParams.get('endDate') || '2100-01-01'

  try {
    // Get usage events in date range
    const { data: usageEvents } = await supabase
      .from('usage_events')
      .select('event_type, user_id, created_at')
      .gte('created_at', startDate)
      .lte('created_at', endDate)

    // Count by event type
    const eventCounts = (usageEvents || []).reduce(
      (acc, event) => {
        acc[event.event_type] = (acc[event.event_type] || 0) + 1
        return acc
      },
      {} as Record<string, number>
    )

    // Get feedback data for protocol accuracy
    const { data: feedbackData } = await supabase
      .from('feedback')
      .select('rating, feedback_type, outcome')
      .gte('created_at', startDate)
      .lte('created_at', endDate)

    // Calculate protocol accuracy
    const totalFeedback = feedbackData?.length || 0
    const positiveFeedback =
      feedbackData?.filter(
        (f) => f.rating === 'positive' || f.outcome === 'success'
      ).length || 0
    const protocolAccuracy =
      totalFeedback > 0 ? Math.round((positiveFeedback / totalFeedback) * 100) : 0

    // Get feedback breakdown
    const feedbackBreakdown = {
      positive: feedbackData?.filter((f) => f.rating === 'positive').length || 0,
      negative: feedbackData?.filter((f) => f.rating === 'negative').length || 0,
      neutral: feedbackData?.filter((f) => f.rating === 'neutral').length || 0,
    }

    // Get top users by activity
    const userActivityMap = new Map<
      string,
      { labsCount: number; protocolsCount: number; conversationsCount: number }
    >()

    usageEvents?.forEach((event) => {
      const current = userActivityMap.get(event.user_id) || {
        labsCount: 0,
        protocolsCount: 0,
        conversationsCount: 0,
      }

      if (event.event_type === 'lab_analysis') {
        current.labsCount++
      } else if (event.event_type === 'protocol_generated') {
        current.protocolsCount++
      } else if (event.event_type === 'conversation_started') {
        current.conversationsCount++
      }

      userActivityMap.set(event.user_id, current)
    })

    // Get user profiles for top users
    const topUserIds = Array.from(userActivityMap.entries())
      .sort((a, b) => b[1].labsCount - a[1].labsCount)
      .slice(0, 10)
      .map(([userId]) => userId)

    const { data: topProfiles } = await supabase
      .from('profiles')
      .select('id, email, full_name, role, status, created_at')
      .in('id', topUserIds)

    const topUsers = topProfiles?.map((profile) => {
      const activity = userActivityMap.get(profile.id) || {
        labsCount: 0,
        protocolsCount: 0,
        conversationsCount: 0,
      }
      return {
        userId: profile.id,
        email: profile.email,
        fullName: profile.full_name,
        role: profile.role as UserRole,
        status: profile.status,
        labsCount: activity.labsCount,
        protocolsCount: activity.protocolsCount,
        conversationsCount: activity.conversationsCount,
        feedbackCount: 0,
        lastActive: null,
        userCreatedAt: profile.created_at,
      }
    }) || []

    // Sort by labs count
    topUsers.sort((a, b) => b.labsCount - a.labsCount)

    // Get total counts
    const { count: totalUsers } = await supabase
      .from('profiles')
      .select('*', { count: 'exact', head: true })

    const { count: activeUsers } = await supabase
      .from('profiles')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'active')

    const { count: totalPatients } = await supabase
      .from('patients')
      .select('*', { count: 'exact', head: true })

    return NextResponse.json({
      data: {
        protocolAccuracy,
        totalFeedback,
        eventCounts,
        topUsers,
        feedbackBreakdown,
        summary: {
          totalUsers: totalUsers || 0,
          activeUsers: activeUsers || 0,
          totalPatients: totalPatients || 0,
          totalLabAnalyses: eventCounts['lab_analysis'] || 0,
          totalProtocols: eventCounts['protocol_generated'] || 0,
          totalConversations: eventCounts['conversation_started'] || 0,
        },
      },
    })
  } catch (error) {
    console.error('Error fetching analytics:', error)
    return NextResponse.json(
      { error: 'Failed to fetch analytics' },
      { status: 500 }
    )
  }
}
