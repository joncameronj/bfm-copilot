import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { Sidebar } from '@/components/sidebar'
import { RoleViewProvider } from '@/providers/RoleViewProvider'
import type { UserRole } from '@/types/roles'

export default async function ProtectedLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  // Get user profile for sidebar (including role)
  const { data: profile } = await supabase
    .from('profiles')
    .select('full_name, avatar_url, role')
    .eq('id', user.id)
    .single()

  const userRole = (profile?.role as UserRole) || 'member'

  return (
    <RoleViewProvider actualRole={userRole}>
      <div className="h-screen flex overflow-hidden">
        {/* Sidebar - Fixed */}
        <Sidebar
          user={{
            email: user.email || '',
            fullName: profile?.full_name || null,
            avatarUrl: profile?.avatar_url || null,
          }}
        />

        {/* Main content - Scrollable */}
        <main className="flex-1 bg-white dark:bg-neutral-900 overflow-y-auto">
          {children}
        </main>
      </div>
    </RoleViewProvider>
  )
}
