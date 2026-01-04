import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui'
import Link from 'next/link'

export default async function AdminPage() {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  if (profile?.role !== 'admin') redirect('/')

  // Get quick stats
  const [
    { count: totalUsers },
    { count: activeUsers },
    { count: totalPatients },
    { count: totalLabs },
  ] = await Promise.all([
    supabase.from('profiles').select('*', { count: 'exact', head: true }),
    supabase
      .from('profiles')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'active'),
    supabase.from('patients').select('*', { count: 'exact', head: true }),
    supabase.from('lab_results').select('*', { count: 'exact', head: true }),
  ])

  // Get recent users
  const { data: recentUsers } = await supabase
    .from('profiles')
    .select('id, email, full_name, role, created_at')
    .order('created_at', { ascending: false })
    .limit(5)

  return (
    <>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
        <Card>
          <CardContent className="pt-6">
            <p className="text-sm text-neutral-500 dark:text-neutral-400">Total Users</p>
            <p className="text-3xl font-semibold text-neutral-900 dark:text-neutral-50 mt-1">
              {totalUsers || 0}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <p className="text-sm text-neutral-500 dark:text-neutral-400">Active Users</p>
            <p className="text-3xl font-semibold text-neutral-900 dark:text-neutral-50 mt-1">
              {activeUsers || 0}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <p className="text-sm text-neutral-500 dark:text-neutral-400">Total Patients</p>
            <p className="text-3xl font-semibold text-neutral-900 dark:text-neutral-50 mt-1">
              {totalPatients || 0}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <p className="text-sm text-neutral-500 dark:text-neutral-400">Lab Analyses</p>
            <p className="text-3xl font-semibold text-neutral-900 dark:text-neutral-50 mt-1">
              {totalLabs || 0}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Quick Links & Recent Users */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Quick Links */}
        <Card>
          <CardHeader>
            <CardTitle>Quick Actions</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <Link
                href="/admin/users"
                className="block p-4 rounded-xl bg-neutral-100 dark:bg-neutral-800 hover:bg-neutral-200 dark:hover:bg-neutral-700 transition-colors"
              >
                <div className="font-medium text-neutral-900 dark:text-neutral-50">
                  Manage Users
                </div>
                <div className="text-sm text-neutral-500 dark:text-neutral-400">
                  Create, edit, and manage user accounts
                </div>
              </Link>
              <Link
                href="/admin/analytics"
                className="block p-4 rounded-xl bg-neutral-100 dark:bg-neutral-800 hover:bg-neutral-200 dark:hover:bg-neutral-700 transition-colors"
              >
                <div className="font-medium text-neutral-900 dark:text-neutral-50">
                  View Analytics
                </div>
                <div className="text-sm text-neutral-500 dark:text-neutral-400">
                  Protocol accuracy and usage metrics
                </div>
              </Link>
              <Link
                href="/admin/documents"
                className="block p-4 rounded-xl bg-neutral-100 dark:bg-neutral-800 hover:bg-neutral-200 dark:hover:bg-neutral-700 transition-colors"
              >
                <div className="font-medium text-neutral-900 dark:text-neutral-50">
                  Knowledge Base
                </div>
                <div className="text-sm text-neutral-500 dark:text-neutral-400">
                  Upload and manage protocol documents
                </div>
              </Link>
              <Link
                href="/admin/rag/logs"
                className="block p-4 rounded-xl bg-neutral-100 dark:bg-neutral-800 hover:bg-neutral-200 dark:hover:bg-neutral-700 transition-colors"
              >
                <div className="font-medium text-neutral-900 dark:text-neutral-50">
                  RAG Logs
                </div>
                <div className="text-sm text-neutral-500 dark:text-neutral-400">
                  View knowledge base query logs
                </div>
              </Link>
              <Link
                href="/admin/rag/telemetry"
                className="block p-4 rounded-xl bg-neutral-100 dark:bg-neutral-800 hover:bg-neutral-200 dark:hover:bg-neutral-700 transition-colors"
              >
                <div className="font-medium text-neutral-900 dark:text-neutral-50">
                  RAG Telemetry
                </div>
                <div className="text-sm text-neutral-500 dark:text-neutral-400">
                  Search performance and analytics
                </div>
              </Link>
              <Link
                href="/admin/evaluations"
                className="block p-4 rounded-xl bg-gradient-to-r from-purple-50 to-blue-50 dark:from-purple-900/30 dark:to-blue-900/30 hover:from-purple-100 hover:to-blue-100 dark:hover:from-purple-900/40 dark:hover:to-blue-900/40 border border-purple-200 dark:border-purple-800 transition-colors"
              >
                <div className="font-medium text-neutral-900 dark:text-neutral-50">
                  RAG Evaluations
                </div>
                <div className="text-sm text-neutral-500 dark:text-neutral-400">
                  Grade agent responses for quality assurance
                </div>
              </Link>
            </div>
          </CardContent>
        </Card>

        {/* Recent Users */}
        <Card>
          <CardHeader>
            <CardTitle>Recent Users</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {recentUsers?.map((u) => (
                <div
                  key={u.id}
                  className="flex items-center justify-between p-3 rounded-xl bg-neutral-100 dark:bg-neutral-800"
                >
                  <div>
                    <div className="font-medium text-neutral-900 dark:text-neutral-50">
                      {u.full_name || 'No name'}
                    </div>
                    <div className="text-sm text-neutral-500 dark:text-neutral-400">{u.email}</div>
                  </div>
                  <span className="text-xs bg-neutral-200 dark:bg-neutral-700 text-neutral-700 dark:text-neutral-300 px-2 py-1 rounded-full">
                    {u.role}
                  </span>
                </div>
              ))}
              {(!recentUsers || recentUsers.length === 0) && (
                <p className="text-neutral-500 dark:text-neutral-400 text-center py-4">
                  No users yet
                </p>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </>
  )
}
