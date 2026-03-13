import { Metadata } from 'next'
import { createClient } from '@/lib/supabase/server'
import { redirect, notFound } from 'next/navigation'
import { MemberLabDetail } from './MemberLabDetail'

export const metadata: Metadata = {
  title: 'Lab Results | BFM Copilot',
  description: 'View your lab result details',
}

interface PageProps {
  params: Promise<{ date: string }>
}

export default async function MemberLabDetailPage({ params }: PageProps) {
  const { date } = await params
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

  if (!profile || (profile.role !== 'member' && profile.role !== 'admin')) {
    redirect('/')
  }

  // Fetch lab values for this date
  const { data: labValues, error } = await supabase
    .from('member_lab_values')
    .select('*')
    .eq('user_id', user.id)
    .eq('test_date', date)
    .order('category', { ascending: true })
    .order('marker_name', { ascending: true })

  if (error || !labValues || labValues.length === 0) {
    notFound()
  }

  return (
    <div className="min-h-screen bg-white">
      <div className="p-6">
        <MemberLabDetail labValues={labValues} testDate={date} />
      </div>
    </div>
  )
}
