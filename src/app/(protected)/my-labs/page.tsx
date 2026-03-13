import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { MyLabsEditable } from './MyLabsEditable'
import { calculateAge } from '@/lib/utils'

export default async function MyLabsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  // Verify member role and get profile details
  const { data: profile } = await supabase
    .from('profiles')
    .select('role, self_patient_id')
    .eq('id', user.id)
    .single()

  if (!profile || (profile.role !== 'member' && profile.role !== 'admin')) {
    redirect('/')
  }

  // Get member's patient record for demographics
  let memberProfile: {
    gender?: 'male' | 'female'
    dateOfBirth?: string
    age?: number
  } = {}

  if (profile.self_patient_id) {
    const { data: patient } = await supabase
      .from('patients')
      .select('gender, date_of_birth')
      .eq('id', profile.self_patient_id)
      .single()

    if (patient) {
      memberProfile = {
        gender: patient.gender === 'male' || patient.gender === 'female' ? patient.gender : 'male',
        dateOfBirth: patient.date_of_birth,
        age: patient.date_of_birth ? calculateAge(patient.date_of_birth) : undefined,
      }
    }
  }

  // Fetch member's self-tracked lab values (from member_lab_values table)
  const { data: labValues } = await supabase
    .from('member_lab_values')
    .select('*')
    .eq('user_id', user.id)
    .order('test_date', { ascending: false })
    .order('created_at', { ascending: false })

  // Fetch markers for reference
  const { data: markers } = await supabase
    .from('lab_markers')
    .select('id, name, display_name, unit, category')

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <div className="mb-8">
        <h1 className="text-4xl font-bold tracking-[-0.05em] text-neutral-900">My Labs</h1>
        <p className="text-neutral-600 mt-1">Enter, track, and analyze your lab results over time</p>
      </div>

      <MyLabsEditable
        initialValues={labValues || []}
        markers={markers || []}
        memberProfile={memberProfile}
      />
    </div>
  )
}
