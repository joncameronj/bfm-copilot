import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { UserTable, CreateUserButton } from '@/components/admin'

export default async function AdminUsersPage() {
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

  return (
    <>
      <div className="flex justify-end mb-6">
        <CreateUserButton />
      </div>
      <UserTable />
    </>
  )
}
