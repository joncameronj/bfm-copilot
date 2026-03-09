import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { RoleViewProvider } from '@/providers/RoleViewProvider'
import { EvalModeProvider } from '@/providers/EvalModeProvider'
import { BackgroundJobsWrapper } from '@/components/background-chats/BackgroundJobsWrapper'
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
      <EvalModeProvider userEmail={user.email}>
        <BackgroundJobsWrapper
          userId={user.id}
          sidebarUser={{
            email: user.email || '',
            fullName: profile?.full_name || null,
            avatarUrl: profile?.avatar_url || null,
          }}
        >
          {children}
        </BackgroundJobsWrapper>
      </EvalModeProvider>
    </RoleViewProvider>
  )
}
