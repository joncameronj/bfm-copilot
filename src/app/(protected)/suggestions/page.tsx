import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { SuggestionsList } from '@/components/suggestions/SuggestionsList'

export default async function SuggestionsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  // Verify member role
  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  if (!profile || profile.role !== 'member') {
    redirect('/')
  }

  // Fetch suggestions with feedback
  const { data: suggestions } = await supabase
    .from('suggestions')
    .select(`
      *,
      suggestion_feedback (
        id,
        rating,
        feedback_text,
        outcome,
        created_at
      )
    `)
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })

  const transformedSuggestions = (suggestions || []).map((s) => ({
    id: s.id,
    userId: s.user_id,
    conversationId: s.conversation_id,
    content: s.content,
    category: s.category,
    status: s.status as 'pending' | 'accepted' | 'rejected' | 'superseded',
    sourceContext: s.source_context,
    parentSuggestionId: s.parent_suggestion_id,
    iterationCount: s.iteration_count,
    createdAt: new Date(s.created_at),
    updatedAt: new Date(s.updated_at),
    feedback: s.suggestion_feedback?.[0] || null,
  }))

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <div className="mb-8">
        <h1 className="text-4xl font-bold tracking-[-0.05em] text-neutral-900">
          Your Suggestions
        </h1>
        <p className="text-neutral-600 mt-1">
          Personalized wellness suggestions based on your health profile
        </p>
      </div>

      <SuggestionsList initialSuggestions={transformedSuggestions} />
    </div>
  )
}
