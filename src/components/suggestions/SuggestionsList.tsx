'use client'

import { useState } from 'react'
import { SuggestionCard } from './SuggestionCard'
import { HugeiconsIcon } from '@hugeicons/react'
import { StarIcon } from '@hugeicons/core-free-icons'

interface Suggestion {
  id: string
  userId: string
  conversationId?: string | null
  content: string
  category?: string | null
  status: 'pending' | 'accepted' | 'rejected' | 'superseded'
  sourceContext?: string | null
  parentSuggestionId?: string | null
  iterationCount: number
  createdAt: Date
  updatedAt: Date
  feedback?: {
    id: string
    rating: string
    feedback_text?: string | null
    outcome?: string | null
    created_at: string
  } | null
}

interface SuggestionsListProps {
  initialSuggestions: Suggestion[]
}

export function SuggestionsList({ initialSuggestions }: SuggestionsListProps) {
  const [suggestions, setSuggestions] = useState(initialSuggestions)
  const [filter, setFilter] = useState<'all' | 'pending' | 'accepted' | 'rejected'>('all')

  const filteredSuggestions = suggestions.filter((s) => {
    if (filter === 'all') return s.status !== 'superseded'
    return s.status === filter
  })

  const handleStatusChange = (id: string, newStatus: 'accepted' | 'rejected') => {
    setSuggestions((prev) =>
      prev.map((s) => (s.id === id ? { ...s, status: newStatus } : s))
    )
  }

  if (suggestions.length === 0) {
    return (
      <div className="text-center py-12">
        <div className="w-16 h-16 bg-neutral-100 rounded-full flex items-center justify-center mx-auto mb-4">
          <HugeiconsIcon icon={StarIcon} size={32} className="text-neutral-400" />
        </div>
        <h3 className="text-lg font-medium text-neutral-900 mb-2">
          No suggestions yet
        </h3>
        <p className="text-neutral-600">
          Chat with Copilot about your health to receive personalized wellness suggestions.
        </p>
      </div>
    )
  }

  return (
    <div>
      {/* Filter tabs */}
      <div className="flex gap-2 mb-6">
        {(['all', 'pending', 'accepted', 'rejected'] as const).map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
              filter === f
                ? 'bg-neutral-900 text-white'
                : 'bg-neutral-100 text-neutral-700 hover:bg-neutral-200'
            }`}
          >
            {f.charAt(0).toUpperCase() + f.slice(1)}
          </button>
        ))}
      </div>

      {/* List */}
      <div className="space-y-4">
        {filteredSuggestions.length === 0 ? (
          <p className="text-center text-neutral-500 py-8">
            No {filter} suggestions
          </p>
        ) : (
          filteredSuggestions.map((suggestion) => (
            <SuggestionCard
              key={suggestion.id}
              suggestion={suggestion}
              onStatusChange={handleStatusChange}
            />
          ))
        )}
      </div>
    </div>
  )
}
