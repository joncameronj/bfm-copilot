import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { PatientList } from '@/components/patients/PatientList'
import { Button } from '@/components/ui/Button'

export default async function PatientsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  return (
    <div className="p-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-4xl font-bold tracking-[-0.05em] text-neutral-900">Patients</h1>
          <p className="text-neutral-500 mt-1">Manage your patient records</p>
        </div>
        <Link href="/patients/new">
          <Button>Add Patient</Button>
        </Link>
      </div>

      {/* Patient List */}
      <PatientList />
    </div>
  )
}
