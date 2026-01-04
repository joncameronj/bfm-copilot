import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { MyLabsClient } from './MyLabsClient'

export default async function MyLabsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  // Verify member role
  const { data: profile } = await supabase
    .from('profiles')
    .select('role, self_patient_id')
    .eq('id', user.id)
    .single()

  if (!profile || profile.role !== 'member') {
    redirect('/')
  }

  if (!profile.self_patient_id) {
    return (
      <div className="p-6 max-w-4xl mx-auto">
        <h1 className="text-4xl font-bold tracking-[-0.05em] text-neutral-900 mb-4">My Labs</h1>
        <div className="bg-neutral-50 rounded-2xl p-8 text-center">
          <p className="text-neutral-600">
            No patient record linked to your account yet. Please contact your practitioner.
          </p>
        </div>
      </div>
    )
  }

  // Fetch lab results
  const { data: results } = await supabase
    .from('lab_results')
    .select(`
      id,
      test_date,
      ominous_count,
      ominous_markers_triggered,
      notes,
      created_at,
      lab_values (
        id,
        marker_id,
        value,
        evaluation,
        delta_from_target,
        is_ominous
      )
    `)
    .eq('patient_id', profile.self_patient_id)
    .order('test_date', { ascending: false })

  // Fetch markers for reference
  const { data: markers } = await supabase
    .from('lab_markers')
    .select('id, name, display_name, unit, category')

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <div className="mb-8">
        <h1 className="text-4xl font-bold tracking-[-0.05em] text-neutral-900">My Labs</h1>
        <p className="text-neutral-600 mt-1">Track your lab results over time</p>
      </div>

      <MyLabsClient
        results={results || []}
        markers={markers || []}
      />
    </div>
  )
}
