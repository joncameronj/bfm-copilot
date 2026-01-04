import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui'
import Link from 'next/link'
import { formatDate } from '@/lib/utils'

export default async function MyHealthPage() {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  // Get user profile
  const { data: profile } = await supabase
    .from('profiles')
    .select('*, self_patient_id')
    .eq('id', user.id)
    .single()

  // Only members can access this page
  if (profile?.role !== 'member') redirect('/')

  // Get member's patient record (themselves)
  const { data: patient } = await supabase
    .from('patients')
    .select('*')
    .eq('id', profile.self_patient_id)
    .single()

  // Get their lab results
  const { data: labResults } = await supabase
    .from('lab_results')
    .select('*')
    .eq('patient_id', profile.self_patient_id)
    .order('test_date', { ascending: false })
    .limit(5)

  // Get their conversations
  const { data: conversations } = await supabase
    .from('conversations')
    .select('*')
    .eq('user_id', user.id)
    .order('updated_at', { ascending: false })
    .limit(5)

  return (
    <div className="p-8 max-w-4xl mx-auto">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-4xl font-bold tracking-[-0.05em] text-neutral-900">
          My Health
        </h1>
        <p className="text-neutral-500 mt-1">
          Welcome back, {profile?.full_name || 'Member'}
        </p>
      </div>

      {/* Educational Disclaimer */}
      <div className="bg-blue-50 border border-blue-200 rounded-2xl p-4 mb-8">
        <p className="text-sm text-blue-800">
          <strong>Educational Resource:</strong> This platform provides educational health information based on your enrolled program.
          For personalized treatment recommendations, please consult with your practitioner or refer to your program materials.
        </p>
      </div>

      {/* Quick Actions */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
        <Link href="/">
          <Card variant="interactive">
            <CardContent className="py-4">
              <div className="text-base font-medium text-neutral-900">
                Chat with AI
              </div>
              <div className="text-sm text-neutral-500 mt-1">
                Ask questions about your health
              </div>
            </CardContent>
          </Card>
        </Link>

        <Link href="/labs">
          <Card variant="interactive">
            <CardContent className="py-4">
              <div className="text-base font-medium text-neutral-900">
                Enter Lab Results
              </div>
              <div className="text-sm text-neutral-500 mt-1">
                Analyze your latest bloodwork
              </div>
            </CardContent>
          </Card>
        </Link>

        <Link href="/suggestions">
          <Card variant="interactive">
            <CardContent className="py-4">
              <div className="text-base font-medium text-neutral-900">
                View Suggestions
              </div>
              <div className="text-sm text-neutral-500 mt-1">
                Your wellness recommendations
              </div>
            </CardContent>
          </Card>
        </Link>
      </div>

      {/* Health Profile Summary */}
      {patient && (
        <Card className="mb-8">
          <CardHeader>
            <CardTitle>Your Health Profile</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div>
                <p className="text-sm text-neutral-500">Name</p>
                <p className="font-medium text-neutral-900">
                  {patient.first_name} {patient.last_name}
                </p>
              </div>
              <div>
                <p className="text-sm text-neutral-500">Date of Birth</p>
                <p className="font-medium text-neutral-900">
                  {patient.date_of_birth
                    ? formatDate(patient.date_of_birth)
                    : 'Not set'}
                </p>
              </div>
              <div>
                <p className="text-sm text-neutral-500">Gender</p>
                <p className="font-medium text-neutral-900 capitalize">
                  {patient.gender || 'Not set'}
                </p>
              </div>
              <div>
                <p className="text-sm text-neutral-500">Status</p>
                <p className="font-medium text-neutral-900 capitalize">
                  {patient.status}
                </p>
              </div>
            </div>
            {patient.chief_complaints && (
              <div className="mt-4 pt-4 border-t border-neutral-200">
                <p className="text-sm text-neutral-500">Health Concerns</p>
                <p className="text-neutral-900 mt-1">
                  {patient.chief_complaints}
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Recent Labs */}
        <Card>
          <CardHeader>
            <CardTitle>Recent Lab Results</CardTitle>
          </CardHeader>
          <CardContent>
            {labResults && labResults.length > 0 ? (
              <ul className="space-y-3">
                {labResults.map((lab) => (
                  <li key={lab.id}>
                    <Link
                      href={`/labs/${lab.id}`}
                      className="flex justify-between items-center hover:bg-neutral-100 p-3 rounded-xl transition-colors"
                    >
                      <div>
                        <span className="text-neutral-900 font-medium">
                          Lab Analysis
                        </span>
                        <p className="text-sm text-neutral-500">
                          {formatDate(lab.test_date)}
                        </p>
                      </div>
                      {lab.ominous_count > 0 && (
                        <span className="text-xs bg-red-100 text-red-700 px-2 py-1 rounded-full">
                          {lab.ominous_count} alert
                          {lab.ominous_count > 1 ? 's' : ''}
                        </span>
                      )}
                    </Link>
                  </li>
                ))}
              </ul>
            ) : (
              <div className="text-center py-6">
                <p className="text-neutral-500 mb-4">
                  No lab results yet. Enter your first lab results to get
                  personalized insights.
                </p>
                <Link
                  href="/labs"
                  className="inline-flex items-center justify-center px-4 py-2 bg-brand-gradient text-white rounded-full text-sm font-medium"
                >
                  Enter Lab Results
                </Link>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Recent Conversations */}
        <Card>
          <CardHeader>
            <CardTitle>Recent Conversations</CardTitle>
          </CardHeader>
          <CardContent>
            {conversations && conversations.length > 0 ? (
              <ul className="space-y-3">
                {conversations.map((conv) => (
                  <li key={conv.id}>
                    <Link
                      href={`/?conversation=${conv.id}`}
                      className="block hover:bg-neutral-100 p-3 rounded-xl transition-colors"
                    >
                      <div className="text-neutral-900 font-medium truncate">
                        {conv.title || 'Untitled conversation'}
                      </div>
                      <div className="text-sm text-neutral-500 mt-1">
                        {formatDate(conv.updated_at)}
                      </div>
                    </Link>
                  </li>
                ))}
              </ul>
            ) : (
              <div className="text-center py-6">
                <p className="text-neutral-500 mb-4">
                  No conversations yet. Start chatting to get personalized health
                  guidance.
                </p>
                <Link
                  href="/"
                  className="inline-flex items-center justify-center px-4 py-2 bg-brand-gradient text-white rounded-full text-sm font-medium"
                >
                  Start a Conversation
                </Link>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Tips Section */}
      <Card className="mt-8">
        <CardHeader>
          <CardTitle>Getting Started Tips</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="p-4 bg-neutral-100 rounded-xl">
              <div className="text-lg font-semibold text-neutral-900 mb-2">1</div>
              <div className="font-medium text-neutral-900">Enter Your Labs</div>
              <p className="text-sm text-neutral-500 mt-1">
                Input your recent bloodwork to get a comprehensive analysis
              </p>
            </div>
            <div className="p-4 bg-neutral-100 rounded-xl">
              <div className="text-lg font-semibold text-neutral-900 mb-2">2</div>
              <div className="font-medium text-neutral-900">Chat with AI</div>
              <p className="text-sm text-neutral-500 mt-1">
                Ask questions about your results and get personalized insights
              </p>
            </div>
            <div className="p-4 bg-neutral-100 rounded-xl">
              <div className="text-lg font-semibold text-neutral-900 mb-2">3</div>
              <div className="font-medium text-neutral-900">Follow Your Plan</div>
              <p className="text-sm text-neutral-500 mt-1">
                Get wellness suggestions tailored to your health profile
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
