import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { ManualProtocolBuilder } from '@/components/protocols/ManualProtocolBuilder'

export default async function ProtocolsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  // Verify user is a practitioner or admin
  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  if (!profile || !['practitioner', 'admin'].includes(profile.role)) {
    redirect('/')
  }

  return (
    <div className="p-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-4xl font-bold tracking-[-0.05em] text-neutral-900 dark:text-neutral-50">Protocols</h1>
        <p className="text-neutral-500 dark:text-neutral-400 mt-1">Build and apply treatment protocols by selecting from approved frequencies</p>
      </div>

      {/* Manual Protocol Builder */}
      <ManualProtocolBuilder />
    </div>
  )
}
