import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { ProtocolTracker } from './ProtocolTracker'

export default async function MyProgressPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  // Verify member role
  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  if (!profile || profile.role !== 'member') {
    redirect('/')
  }

  // Fetch last 90 days of protocol entries
  const startDate = new Date()
  startDate.setDate(startDate.getDate() - 90)

  const { data: entries } = await supabase
    .from('daily_protocols')
    .select('*')
    .eq('user_id', user.id)
    .gte('entry_date', startDate.toISOString().split('T')[0])
    .order('entry_date', { ascending: false })

  // Get current streak using the database function
  const { data: streakData } = await supabase.rpc('get_current_streak', {
    p_user_id: user.id
  })

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <div className="mb-8">
        <h1 className="text-4xl font-bold tracking-[-0.05em] text-neutral-900">
          My Progress
        </h1>
        <p className="text-neutral-600 mt-1">
          Track your daily BFM protocols and see your progress over time
        </p>
      </div>

      <ProtocolTracker
        initialEntries={entries || []}
        currentStreak={streakData || 0}
      />
    </div>
  )
}
