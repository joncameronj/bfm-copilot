import { createClient } from '@/lib/supabase/server'
import { redirect, notFound } from 'next/navigation'
import { Badge } from '@/components/ui/Badge'
import { PatientHistory } from '@/components/patients/PatientHistory'
import { TreatmentSessionLog } from '@/components/patients/TreatmentSessionLog'
import { LabStatusBadge } from '@/components/patients/LabStatusBadge'
import { PatientDiagnosticAnalyses } from '@/components/patients/PatientDiagnosticAnalyses'
import { PatientProfileActions } from '@/components/patients/PatientProfileActions'
import { calculateAge, formatDate } from '@/lib/utils'

interface PatientPageProps {
  params: Promise<{ id: string }>
}

export default async function PatientPage({ params }: PatientPageProps) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  // Fetch patient with related data
  const { data: patient, error } = await supabase
    .from('patients')
    .select(`
      *,
      lab_results:lab_results(
        id,
        test_date,
        ominous_count,
        ominous_markers_triggered,
        created_at
      ),
      conversations:conversations(
        id,
        title,
        conversation_type,
        updated_at
      )
    `)
    .eq('id', id)
    .eq('user_id', user.id)
    .single()

  if (error || !patient) {
    notFound()
  }

  const age = calculateAge(new Date(patient.date_of_birth))
  const fullName = `${patient.first_name} ${patient.last_name}`
  const hasOminousAlerts = patient.lab_results?.some(
    (lab: { ominous_count: number }) => lab.ominous_count >= 3
  ) || false

  return (
    <div className="p-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center gap-3 flex-wrap">
          <h1 className="text-4xl font-bold tracking-[-0.05em] text-neutral-900 dark:text-neutral-50">
            {fullName}
          </h1>
          {hasOminousAlerts && (
            <Badge variant="danger">Alert</Badge>
          )}
          <Badge variant={patient.status === 'active' ? 'success' : 'neutral'}>
            {patient.status}
          </Badge>
          <LabStatusBadge
            labCount={patient.lab_results?.length || 0}
            lastLabDate={patient.lab_results?.[0]?.test_date}
          />
        </div>
        <p className="text-neutral-500 dark:text-neutral-400 mt-1">
          {age} years old &bull; {patient.gender === 'male' ? 'Male' : patient.gender === 'female' ? 'Female' : 'Other'}
        </p>

        {/* Action Buttons */}
        <div className="mt-6">
          <PatientProfileActions
            patientId={id}
            patientName={fullName}
            patientAge={age}
            patientGender={patient.gender}
          />
        </div>
      </div>

      {/* Patient Info Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
        {/* Contact Info */}
        <div className="bg-neutral-50 dark:bg-neutral-800 rounded-2xl p-6">
          <h3 className="text-sm font-medium text-neutral-500 dark:text-neutral-400 uppercase tracking-wider mb-4">
            Contact Information
          </h3>
          <div className="space-y-3">
            <div>
              <p className="text-xs text-neutral-400 dark:text-neutral-500">Email</p>
              <p className="text-neutral-900 dark:text-neutral-50">{patient.email || 'Not provided'}</p>
            </div>
            <div>
              <p className="text-xs text-neutral-400 dark:text-neutral-500">Phone</p>
              <p className="text-neutral-900 dark:text-neutral-50">{patient.phone || 'Not provided'}</p>
            </div>
            <div>
              <p className="text-xs text-neutral-400 dark:text-neutral-500">Date of Birth</p>
              <p className="text-neutral-900 dark:text-neutral-50">{formatDate(patient.date_of_birth)}</p>
            </div>
          </div>
        </div>

        {/* Chief Complaints */}
        <div className="bg-neutral-50 dark:bg-neutral-800 rounded-2xl p-6">
          <h3 className="text-sm font-medium text-neutral-500 dark:text-neutral-400 uppercase tracking-wider mb-4">
            Chief Complaints
          </h3>
          <p className="text-neutral-900 dark:text-neutral-50">
            {patient.chief_complaints || 'No complaints recorded'}
          </p>
        </div>

        {/* Medical Summary */}
        <div className="bg-neutral-50 dark:bg-neutral-800 rounded-2xl p-6">
          <h3 className="text-sm font-medium text-neutral-500 dark:text-neutral-400 uppercase tracking-wider mb-4">
            Quick Stats
          </h3>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-3xl font-semibold text-neutral-900 dark:text-neutral-50">
                {patient.lab_results?.length || 0}
              </p>
              <p className="text-sm text-neutral-500 dark:text-neutral-400">Lab Results</p>
            </div>
            <div>
              <p className="text-3xl font-semibold text-neutral-900 dark:text-neutral-50">
                {patient.conversations?.length || 0}
              </p>
              <p className="text-sm text-neutral-500 dark:text-neutral-400">Conversations</p>
            </div>
          </div>
        </div>
      </div>

      {/* Medical History Section */}
      {patient.medical_history && (
        <div className="bg-neutral-50 dark:bg-neutral-800 rounded-2xl p-6 mb-8">
          <h3 className="text-sm font-medium text-neutral-500 dark:text-neutral-400 uppercase tracking-wider mb-4">
            Medical History
          </h3>
          <p className="text-neutral-900 dark:text-neutral-50 whitespace-pre-wrap">
            {patient.medical_history}
          </p>
        </div>
      )}

      {/* Medications & Allergies */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
        {/* Current Medications */}
        <div className="bg-neutral-50 dark:bg-neutral-800 rounded-2xl p-6">
          <h3 className="text-sm font-medium text-neutral-500 dark:text-neutral-400 uppercase tracking-wider mb-4">
            Current Medications
          </h3>
          {patient.current_medications && patient.current_medications.length > 0 ? (
            <ul className="space-y-2">
              {patient.current_medications.map((med: string, i: number) => (
                <li key={i} className="text-neutral-900 dark:text-neutral-50 flex items-center gap-2">
                  <span className="w-1.5 h-1.5 bg-brand-blue rounded-full" />
                  {med}
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-neutral-500 dark:text-neutral-400">No medications listed</p>
          )}
        </div>

        {/* Allergies */}
        <div className="bg-neutral-50 dark:bg-neutral-800 rounded-2xl p-6">
          <h3 className="text-sm font-medium text-neutral-500 dark:text-neutral-400 uppercase tracking-wider mb-4">
            Allergies
          </h3>
          {patient.allergies && patient.allergies.length > 0 ? (
            <div className="flex flex-wrap gap-2">
              {patient.allergies.map((allergy: string, i: number) => (
                <Badge key={i} variant="danger" size="md">
                  {allergy}
                </Badge>
              ))}
            </div>
          ) : (
            <p className="text-neutral-500 dark:text-neutral-400">No known allergies</p>
          )}
        </div>
      </div>

      {/* Diagnostic Analyses Section */}
      <div className="mb-8">
        <PatientDiagnosticAnalyses patientId={id} />
      </div>

      {/* Treatment Sessions Log */}
      <div className="mb-8">
        <TreatmentSessionLog patientId={id} />
      </div>

      {/* History Section */}
      <PatientHistory
        patientId={id}
        labs={patient.lab_results || []}
        conversations={patient.conversations || []}
      />
    </div>
  )
}
