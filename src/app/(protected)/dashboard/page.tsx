import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { StatsCard } from '@/components/dashboard/StatsCard'
import { RecentActivity } from '@/components/dashboard/RecentActivity'
import { QuickActions } from '@/components/dashboard/QuickActions'
import { CriticalAlerts } from '@/components/dashboard/CriticalAlerts'

export default async function DashboardPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  // Fetch stats in parallel
  const [
    patientsResult,
    labsResult,
    alertsResult,
    conversationsResult,
    recentActivityResult,
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

    // Recent activity
    supabase
      .from('conversations')
      .select('id, title, created_at, conversation_type')
      .eq('user_id', user.id)
      .order('updated_at', { ascending: false })
      .limit(10),
  ])

  const patientCount = patientsResult.count || 0
  const labCount = labsResult.count || 0
  const alertCount = alertsResult.count || 0
  const monthlyConversations = conversationsResult.count || 0
  const recentActivity = recentActivityResult.data || []

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <h1 className="text-4xl font-bold tracking-[-0.05em] text-neutral-900 mb-8">Dashboard</h1>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <StatsCard
          title="Active Patients"
          value={patientCount}
        />
        <StatsCard
          title="Lab Analyses"
          value={labCount}
        />
        <StatsCard
          title="Critical Alerts"
          value={alertCount}
          variant={alertCount > 0 ? 'danger' : 'default'}
        />
        <StatsCard
          title="This Month"
          value={monthlyConversations}
          subtitle="conversations"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Quick Actions */}
        <div className="bg-neutral-50 rounded-2xl p-6">
          <h2 className="text-lg font-medium text-neutral-900 mb-4">Quick Actions</h2>
          <QuickActions />
        </div>

        {/* Recent Activity */}
        <div className="bg-neutral-50 rounded-2xl p-6 lg:col-span-2">
          <h2 className="text-lg font-medium text-neutral-900 mb-4">Recent Activity</h2>
          <RecentActivity activities={recentActivity} />
        </div>
      </div>

      {/* Critical Alerts */}
      {alertCount > 0 && (
        <div className="mt-6">
          <h2 className="text-lg font-medium text-neutral-900 mb-4">Critical Alerts</h2>
          <CriticalAlerts userId={user.id} />
        </div>
      )}
    </div>
  )
}
