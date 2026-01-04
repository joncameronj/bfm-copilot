import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { SettingsLayout } from '@/components/settings'
import type { UserPreferences } from '@/types/settings'

export default async function SettingsPage() {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .single()

  if (!profile) redirect('/login')

  const { data: preferences } = await supabase
    .from('user_preferences')
    .select('*')
    .eq('user_id', user.id)
    .single()

  return (
    <div className="p-8">
      <div className="max-w-7xl mx-auto">
        <div className="mb-8">
          <h1 className="text-4xl font-bold tracking-[-0.05em] text-neutral-900 dark:text-neutral-50">Settings</h1>
          <p className="text-neutral-500 dark:text-neutral-400 mt-1">Manage your account and preferences</p>
        </div>

        <SettingsLayout
          profile={profile}
          preferences={preferences as UserPreferences | null}
          userEmail={user.email || ''}
        />
      </div>
    </div>
  )
}
