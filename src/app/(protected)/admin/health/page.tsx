import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { HealthDashboard } from '@/components/admin/HealthDashboard'

export default async function AdminHealthPage() {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  if (profile?.role !== 'admin') redirect('/')

  return <HealthDashboard />
}
