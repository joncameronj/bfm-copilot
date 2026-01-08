'use client'

import { useState, useEffect, useCallback } from 'react'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui'

// Types
interface UnevaluatedLog {
  id: string
  userId: string
  conversationId: string | null
  queryText: string
  responseText: string
  searchResults: Array<{ title?: string; care_category?: string; similarity?: number }>
  resultsCount: number
  topMatchSimilarity: number | null
  responseTimeMs: number | null
  userRole: string
  careCategory: string | null
  createdAt: string
  user: { email: string; full_name: string | null } | null
}

interface Evaluation {
  id: string
  query_text: string
  response_text: string
  accuracy_score: number
  source_quality_score: number | null
  comment: string | null
  improvement_suggestion: string | null
  issue_tags: string[]
  care_category: string | null
  created_at: string
  profiles: { email: string; full_name: string | null } | null
  evaluation_sessions: { name: string } | null
}

interface Session {
  id: string
  name: string
  description: string | null
  status: 'active' | 'completed' | 'archived'
  created_at: string
  evaluation_count: number
  average_score: number
}

interface Pagination {
  page: number
  pageSize: number
  totalCount: number
  totalPages: number
}

const ISSUE_TAGS = [
  'inaccurate_info',
  'missing_sources',
  'wrong_protocol',
  'outdated_info',
  'tone_issue',
  'incomplete_answer',
  'hallucination',
  'off_topic',
]

const CARE_CATEGORIES = ['diabetes', 'thyroid', 'hormones', 'neurological']

// Chat evaluation types
interface ChatEvaluation {
  id: string
  messageId: string
  conversationId: string
  evaluatorId: string
  contentType: 'chat_response' | 'protocol' | 'patient_analysis'
  rating: 'correct' | 'partially_correct' | 'partially_fail' | 'fail'
  correctAspects: string | null
  needsAdjustment: string | null
  messageContent: string
  patientId: string | null
  isEvalMode: boolean
  createdAt: string
  updatedAt: string
  evaluator: { id: string; email: string; fullName: string | null } | null
}

const CHAT_RATING_CONFIG: Record<string, { label: string; color: string; bgColor: string }> = {
  correct: { label: 'Correct', color: 'text-blue-700', bgColor: 'bg-blue-50' },
  partially_correct: { label: 'Partially Correct', color: 'text-green-700', bgColor: 'bg-green-50' },
  partially_fail: { label: 'Partially Fail', color: 'text-yellow-700', bgColor: 'bg-yellow-50' },
  fail: { label: 'Fail', color: 'text-red-700', bgColor: 'bg-red-50' },
}

const CONTENT_TYPE_LABELS: Record<string, string> = {
  chat_response: 'Chat Response',
  protocol: 'Protocol',
  patient_analysis: 'Patient Analysis',
}

type TabType = 'evaluate' | 'history' | 'sessions' | 'chat'

export default function EvaluationsPage() {
  const [activeTab, setActiveTab] = useState<TabType>('evaluate')
  const [isLoading, setIsLoading] = useState(true)

  // Unevaluated logs state
  const [unevaluatedLogs, setUnevaluatedLogs] = useState<UnevaluatedLog[]>([])
  const [unevaluatedPagination, setUnevaluatedPagination] = useState<Pagination>({
    page: 1, pageSize: 20, totalCount: 0, totalPages: 0,
  })
  const [totalUnevaluated, setTotalUnevaluated] = useState(0)

  // Evaluations history state
  const [evaluations, setEvaluations] = useState<Evaluation[]>([])
  const [evalPagination, setEvalPagination] = useState<Pagination>({
    page: 1, pageSize: 20, totalCount: 0, totalPages: 0,
  })

  // Sessions state
  const [sessions, setSessions] = useState<Session[]>([])
  const [activeSession, setActiveSession] = useState<string | null>(null)

  // Current evaluation form
  const [selectedLog, setSelectedLog] = useState<UnevaluatedLog | null>(null)
  const [formData, setFormData] = useState({
    accuracyScore: 3,
    sourceQualityScore: 3,
    comment: '',
    improvementSuggestion: '',
    issueTags: [] as string[],
    careCategory: '',
  })
  const [isSubmitting, setIsSubmitting] = useState(false)

  // Stats
  const [stats, setStats] = useState({
    totalEvaluations: 0,
    averageScore: 0,
  })

  // Chat evaluations state
  const [chatEvaluations, setChatEvaluations] = useState<ChatEvaluation[]>([])
  const [chatPagination, setChatPagination] = useState<Pagination>({
    page: 1, pageSize: 20, totalCount: 0, totalPages: 0,
  })
  const [chatStats, setChatStats] = useState({
    totalEvaluations: 0,
    byRating: { correct: 0, partially_correct: 0, partially_fail: 0, fail: 0 },
    byContentType: { chat_response: 0, protocol: 0, patient_analysis: 0 },
    evalModeCount: 0,
    regularFeedbackCount: 0,
  })
  const [chatFilters, setChatFilters] = useState({
    rating: '',
    contentType: '',
  })

  // Fetch unevaluated logs
  const fetchUnevaluatedLogs = useCallback(async () => {
    setIsLoading(true)
    try {
      const params = new URLSearchParams({
        page: unevaluatedPagination.page.toString(),
        pageSize: unevaluatedPagination.pageSize.toString(),
      })
      const res = await fetch(`/api/admin/evaluations/unevaluated?${params}`)
      if (res.ok) {
        const data = await res.json()
        setUnevaluatedLogs(data.data || [])
        setUnevaluatedPagination(data.pagination)
        setTotalUnevaluated(data.stats?.totalUnevaluated || 0)
      }
    } catch (error) {
      console.error('Failed to fetch unevaluated logs:', error)
    } finally {
      setIsLoading(false)
    }
  }, [unevaluatedPagination.page, unevaluatedPagination.pageSize])

  // Fetch evaluations history
  const fetchEvaluations = useCallback(async () => {
    setIsLoading(true)
    try {
      const params = new URLSearchParams({
        page: evalPagination.page.toString(),
        pageSize: evalPagination.pageSize.toString(),
      })
      if (activeSession) {
        params.append('sessionId', activeSession)
      }
      const res = await fetch(`/api/admin/evaluations?${params}`)
      if (res.ok) {
        const data = await res.json()
        setEvaluations(data.data || [])
        setEvalPagination(data.pagination)
        setStats(data.stats)
      }
    } catch (error) {
      console.error('Failed to fetch evaluations:', error)
    } finally {
      setIsLoading(false)
    }
  }, [evalPagination.page, evalPagination.pageSize, activeSession])

  // Fetch sessions
  const fetchSessions = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/evaluations/sessions')
      if (res.ok) {
        const data = await res.json()
        setSessions(data.data || [])
      }
    } catch (error) {
      console.error('Failed to fetch sessions:', error)
    }
  }, [])

  // Fetch chat evaluations
  const fetchChatEvaluations = useCallback(async () => {
    setIsLoading(true)
    try {
      const params = new URLSearchParams({
        page: chatPagination.page.toString(),
        pageSize: chatPagination.pageSize.toString(),
      })
      if (chatFilters.rating) {
        params.append('rating', chatFilters.rating)
      }
      if (chatFilters.contentType) {
        params.append('contentType', chatFilters.contentType)
      }
      const res = await fetch(`/api/admin/evaluations/chat?${params}`)
      if (res.ok) {
        const data = await res.json()
        setChatEvaluations(data.data || [])
        setChatPagination(data.pagination)
        setChatStats(data.stats)
      }
    } catch (error) {
      console.error('Failed to fetch chat evaluations:', error)
    } finally {
      setIsLoading(false)
    }
  }, [chatPagination.page, chatPagination.pageSize, chatFilters.rating, chatFilters.contentType])

  // Initial fetch
  useEffect(() => {
    fetchSessions()
  }, [fetchSessions])

  useEffect(() => {
    if (activeTab === 'evaluate') {
      fetchUnevaluatedLogs()
    } else if (activeTab === 'history') {
      fetchEvaluations()
    } else if (activeTab === 'chat') {
      fetchChatEvaluations()
    }
  }, [activeTab, fetchUnevaluatedLogs, fetchEvaluations, fetchChatEvaluations])

  // Submit evaluation
  const handleSubmitEvaluation = async () => {
    if (!selectedLog) return

    setIsSubmitting(true)
    try {
      const res = await fetch('/api/admin/evaluations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ragLogId: selectedLog.id,
          queryText: selectedLog.queryText,
          responseText: selectedLog.responseText,
          accuracyScore: formData.accuracyScore,
          sourceQualityScore: formData.sourceQualityScore,
          comment: formData.comment || null,
          improvementSuggestion: formData.improvementSuggestion || null,
          issueTags: formData.issueTags,
          sessionId: activeSession,
          careCategory: formData.careCategory || selectedLog.careCategory,
        }),
      })

      if (res.ok) {
        // Reset form and move to next
        setSelectedLog(null)
        setFormData({
          accuracyScore: 3,
          sourceQualityScore: 3,
          comment: '',
          improvementSuggestion: '',
          issueTags: [],
          careCategory: '',
        })
        // Refresh the list
        fetchUnevaluatedLogs()
      } else {
        const error = await res.json()
        alert(`Error: ${error.error}`)
      }
    } catch (error) {
      console.error('Failed to submit evaluation:', error)
      alert('Failed to submit evaluation')
    } finally {
      setIsSubmitting(false)
    }
  }

  // Create session
  const handleCreateSession = async () => {
    const name = prompt('Enter session name:')
    if (!name) return

    const description = prompt('Enter description (optional):')

    try {
      const res = await fetch('/api/admin/evaluations/sessions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, description }),
      })

      if (res.ok) {
        fetchSessions()
      }
    } catch (error) {
      console.error('Failed to create session:', error)
    }
  }

  // Export evaluations
  const handleExport = async (format: 'csv' | 'json') => {
    const params = new URLSearchParams({ format })
    if (activeSession) {
      params.append('sessionId', activeSession)
    }

    window.open(`/api/admin/evaluations/export?${params}`, '_blank')
  }

  // Toggle issue tag
  const toggleIssueTag = (tag: string) => {
    setFormData(prev => ({
      ...prev,
      issueTags: prev.issueTags.includes(tag)
        ? prev.issueTags.filter(t => t !== tag)
        : [...prev.issueTags, tag]
    }))
  }

  const getScoreColor = (score: number) => {
    if (score <= 2) return 'text-red-600'
    if (score <= 3) return 'text-yellow-600'
    return 'text-green-600'
  }

  const getScoreBg = (score: number, isSelected: boolean) => {
    if (!isSelected) return 'bg-gray-100 hover:bg-gray-200'
    if (score <= 2) return 'bg-red-500 text-white'
    if (score <= 3) return 'bg-yellow-500 text-white'
    return 'bg-green-500 text-white'
  }

  return (
    <>
      {/* Export buttons */}
      <div className="flex justify-end gap-2 mb-6">
        <button
          onClick={() => handleExport('csv')}
          className="px-4 py-2 text-sm border rounded-lg hover:bg-neutral-50"
        >
          Export CSV
        </button>
        <button
          onClick={() => handleExport('json')}
          className="px-4 py-2 text-sm border rounded-lg hover:bg-neutral-50"
        >
          Export JSON
        </button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <Card>
          <CardContent className="pt-6">
            <p className="text-sm text-neutral-500">Pending Review</p>
            <p className="text-3xl font-semibold text-orange-600">{totalUnevaluated}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <p className="text-sm text-neutral-500">Total Evaluated</p>
            <p className="text-3xl font-semibold text-neutral-900">{stats.totalEvaluations}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <p className="text-sm text-neutral-500">Average Score</p>
            <p className={`text-3xl font-semibold ${getScoreColor(stats.averageScore)}`}>
              {stats.averageScore.toFixed(1)}/5
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <p className="text-sm text-neutral-500">Active Session</p>
            <p className="text-lg font-medium text-neutral-900 truncate">
              {sessions.find(s => s.id === activeSession)?.name || 'None selected'}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Tabs */}
      <div className="border-b mb-6">
        <nav className="flex gap-4">
          {(['evaluate', 'history', 'sessions', 'chat'] as TabType[]).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`pb-3 px-1 text-sm font-medium border-b-2 transition-colors ${
                activeTab === tab
                  ? 'border-neutral-900 text-neutral-900'
                  : 'border-transparent text-neutral-500 hover:text-neutral-900'
              }`}
            >
              {tab === 'chat' ? 'Chat Evaluations' : tab.charAt(0).toUpperCase() + tab.slice(1)}
              {tab === 'evaluate' && totalUnevaluated > 0 && (
                <span className="ml-2 px-2 py-0.5 text-xs bg-orange-100 text-orange-700 rounded-full">
                  {totalUnevaluated}
                </span>
              )}
              {tab === 'chat' && chatStats.totalEvaluations > 0 && (
                <span className="ml-2 px-2 py-0.5 text-xs bg-blue-100 text-blue-700 rounded-full">
                  {chatStats.totalEvaluations}
                </span>
              )}
            </button>
          ))}
        </nav>
      </div>

      {/* Tab Content */}
      {activeTab === 'evaluate' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Left: Unevaluated logs list */}
          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <h2 className="font-semibold">Pending Evaluations</h2>
              <button
                onClick={fetchUnevaluatedLogs}
                disabled={isLoading}
                className="text-sm text-blue-600 hover:text-blue-800"
              >
                Refresh
              </button>
            </div>

            {isLoading ? (
              <div className="text-center py-8 text-neutral-500">Loading...</div>
            ) : unevaluatedLogs.length === 0 ? (
              <Card>
                <CardContent className="py-8 text-center text-neutral-500">
                  No pending evaluations
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-2 max-h-[600px] overflow-y-auto">
                {unevaluatedLogs.map((log) => (
                  <div
                    key={log.id}
                    onClick={() => {
                      setSelectedLog(log)
                      setFormData(prev => ({
                        ...prev,
                        careCategory: log.careCategory || '',
                      }))
                    }}
                    className={`p-4 rounded-lg border cursor-pointer transition-all ${
                      selectedLog?.id === log.id
                        ? 'border-blue-500 bg-blue-50'
                        : 'hover:bg-neutral-50'
                    }`}
                  >
                    <div className="flex justify-between items-start mb-2">
                      <span className="text-xs text-neutral-500">
                        {new Date(log.createdAt).toLocaleString()}
                      </span>
                      {log.careCategory && (
                        <span className="text-xs px-2 py-0.5 bg-purple-100 text-purple-800 rounded">
                          {log.careCategory}
                        </span>
                      )}
                    </div>
                    <p className="text-sm font-medium text-neutral-900 line-clamp-2">
                      {log.queryText}
                    </p>
                    <p className="text-xs text-neutral-500 mt-1">
                      {log.user?.email || 'Unknown user'} • {log.resultsCount} sources
                    </p>
                  </div>
                ))}
              </div>
            )}

            {/* Pagination */}
            {unevaluatedPagination.totalPages > 1 && (
              <div className="flex justify-between items-center pt-4">
                <button
                  onClick={() => setUnevaluatedPagination(p => ({ ...p, page: p.page - 1 }))}
                  disabled={unevaluatedPagination.page === 1}
                  className="px-3 py-1 text-sm border rounded disabled:opacity-50"
                >
                  Previous
                </button>
                <span className="text-sm text-neutral-500">
                  Page {unevaluatedPagination.page} of {unevaluatedPagination.totalPages}
                </span>
                <button
                  onClick={() => setUnevaluatedPagination(p => ({ ...p, page: p.page + 1 }))}
                  disabled={unevaluatedPagination.page === unevaluatedPagination.totalPages}
                  className="px-3 py-1 text-sm border rounded disabled:opacity-50"
                >
                  Next
                </button>
              </div>
            )}
          </div>

          {/* Right: Evaluation form */}
          <div>
            {selectedLog ? (
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Evaluate Response</CardTitle>
                </CardHeader>
                <CardContent className="space-y-6">
                  {/* Query */}
                  <div>
                    <label className="text-sm font-medium text-neutral-700">Query</label>
                    <p className="mt-1 p-3 bg-neutral-50 rounded-lg text-sm">
                      {selectedLog.queryText}
                    </p>
                  </div>

                  {/* Response */}
                  <div>
                    <label className="text-sm font-medium text-neutral-700">Response</label>
                    <div className="mt-1 p-3 bg-neutral-50 rounded-lg text-sm max-h-[200px] overflow-y-auto">
                      {selectedLog.responseText}
                    </div>
                  </div>

                  {/* Sources */}
                  {selectedLog.searchResults && selectedLog.searchResults.length > 0 && (
                    <div>
                      <label className="text-sm font-medium text-neutral-700">Sources Used</label>
                      <div className="mt-1 space-y-1">
                        {selectedLog.searchResults.slice(0, 5).map((source, idx) => (
                          <div key={idx} className="text-xs p-2 bg-neutral-50 rounded flex justify-between">
                            <span className="truncate">{source.title || 'Untitled'}</span>
                            {source.similarity && (
                              <span className="text-neutral-500">
                                {(source.similarity * 100).toFixed(0)}%
                              </span>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Care Category */}
                  <div>
                    <label className="text-sm font-medium text-neutral-700">Care Category</label>
                    <select
                      value={formData.careCategory}
                      onChange={(e) => setFormData(prev => ({ ...prev, careCategory: e.target.value }))}
                      className="mt-1 w-full px-3 py-2 border rounded-lg"
                    >
                      <option value="">Select category...</option>
                      {CARE_CATEGORIES.map(cat => (
                        <option key={cat} value={cat}>{cat}</option>
                      ))}
                    </select>
                  </div>

                  {/* Accuracy Score */}
                  <div>
                    <label className="text-sm font-medium text-neutral-700">
                      Accuracy Score <span className="text-red-500">*</span>
                    </label>
                    <div className="mt-2 flex gap-2">
                      {[1, 2, 3, 4, 5].map((score) => (
                        <button
                          key={score}
                          onClick={() => setFormData(prev => ({ ...prev, accuracyScore: score }))}
                          className={`w-12 h-12 rounded-lg font-semibold transition-all ${
                            getScoreBg(score, formData.accuracyScore === score)
                          }`}
                        >
                          {score}
                        </button>
                      ))}
                    </div>
                    <p className="text-xs text-neutral-500 mt-1">
                      1 = Very Poor, 5 = Excellent
                    </p>
                  </div>

                  {/* Source Quality Score */}
                  <div>
                    <label className="text-sm font-medium text-neutral-700">Source Quality Score</label>
                    <div className="mt-2 flex gap-2">
                      {[1, 2, 3, 4, 5].map((score) => (
                        <button
                          key={score}
                          onClick={() => setFormData(prev => ({ ...prev, sourceQualityScore: score }))}
                          className={`w-10 h-10 rounded-lg text-sm font-medium transition-all ${
                            getScoreBg(score, formData.sourceQualityScore === score)
                          }`}
                        >
                          {score}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Issue Tags */}
                  <div>
                    <label className="text-sm font-medium text-neutral-700">Issue Tags</label>
                    <div className="mt-2 flex flex-wrap gap-2">
                      {ISSUE_TAGS.map((tag) => (
                        <button
                          key={tag}
                          onClick={() => toggleIssueTag(tag)}
                          className={`px-3 py-1 text-xs rounded-full border transition-colors ${
                            formData.issueTags.includes(tag)
                              ? 'bg-red-100 border-red-300 text-red-800'
                              : 'bg-neutral-50 border-neutral-200 text-neutral-600 hover:bg-neutral-100'
                          }`}
                        >
                          {tag.replace(/_/g, ' ')}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Comment */}
                  <div>
                    <label className="text-sm font-medium text-neutral-700">Comment</label>
                    <textarea
                      value={formData.comment}
                      onChange={(e) => setFormData(prev => ({ ...prev, comment: e.target.value }))}
                      placeholder="Optional notes about this response..."
                      rows={2}
                      className="mt-1 w-full px-3 py-2 border rounded-lg text-sm"
                    />
                  </div>

                  {/* Improvement Suggestion */}
                  <div>
                    <label className="text-sm font-medium text-neutral-700">Improvement Suggestion</label>
                    <textarea
                      value={formData.improvementSuggestion}
                      onChange={(e) => setFormData(prev => ({ ...prev, improvementSuggestion: e.target.value }))}
                      placeholder="How should this response be improved?"
                      rows={2}
                      className="mt-1 w-full px-3 py-2 border rounded-lg text-sm"
                    />
                  </div>

                  {/* Submit Button */}
                  <div className="flex gap-3 pt-4">
                    <button
                      onClick={() => setSelectedLog(null)}
                      className="flex-1 px-4 py-2 border rounded-lg text-neutral-700 hover:bg-neutral-50"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={handleSubmitEvaluation}
                      disabled={isSubmitting}
                      className="flex-1 px-4 py-2 bg-neutral-900 text-white rounded-lg hover:bg-neutral-800 disabled:opacity-50"
                    >
                      {isSubmitting ? 'Submitting...' : 'Submit Evaluation'}
                    </button>
                  </div>
                </CardContent>
              </Card>
            ) : (
              <Card>
                <CardContent className="py-12 text-center text-neutral-500">
                  <p>Select a log to evaluate</p>
                  <p className="text-sm mt-1">Click on any item in the list to begin evaluation</p>
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      )}

      {activeTab === 'history' && (
        <div>
          {/* Session filter */}
          <div className="mb-4 flex gap-4 items-center">
            <select
              value={activeSession || ''}
              onChange={(e) => setActiveSession(e.target.value || null)}
              className="px-3 py-2 border rounded-lg"
            >
              <option value="">All Sessions</option>
              {sessions.map(s => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </select>
            <span className="text-sm text-neutral-500">
              {evaluations.length} of {evalPagination.totalCount} evaluations
            </span>
          </div>

          {/* Evaluations table */}
          <div className="bg-white rounded-lg border overflow-hidden">
            <table className="w-full">
              <thead className="bg-neutral-50 border-b">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-neutral-500 uppercase">Date</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-neutral-500 uppercase">Query</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-neutral-500 uppercase">Category</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-neutral-500 uppercase">Score</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-neutral-500 uppercase">Issues</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {evaluations.map((evaluation) => (
                  <tr key={evaluation.id} className="hover:bg-neutral-50">
                    <td className="px-4 py-3 text-sm text-neutral-600">
                      {new Date(evaluation.created_at).toLocaleDateString()}
                    </td>
                    <td className="px-4 py-3 text-sm">
                      <div className="truncate max-w-[300px]" title={evaluation.query_text}>
                        {evaluation.query_text}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-sm">
                      {evaluation.care_category && (
                        <span className="px-2 py-0.5 bg-purple-100 text-purple-800 rounded text-xs">
                          {evaluation.care_category}
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`font-semibold ${getScoreColor(evaluation.accuracy_score)}`}>
                        {evaluation.accuracy_score}/5
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex gap-1 flex-wrap">
                        {evaluation.issue_tags?.slice(0, 2).map(tag => (
                          <span key={tag} className="text-xs px-2 py-0.5 bg-red-50 text-red-700 rounded">
                            {tag.replace(/_/g, ' ')}
                          </span>
                        ))}
                        {evaluation.issue_tags?.length > 2 && (
                          <span className="text-xs text-neutral-500">
                            +{evaluation.issue_tags.length - 2}
                          </span>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            {evaluations.length === 0 && (
              <div className="p-8 text-center text-neutral-500">
                No evaluations found
              </div>
            )}

            {/* Pagination */}
            {evalPagination.totalPages > 1 && (
              <div className="px-4 py-3 border-t flex justify-between items-center">
                <button
                  onClick={() => setEvalPagination(p => ({ ...p, page: p.page - 1 }))}
                  disabled={evalPagination.page === 1}
                  className="px-3 py-1 text-sm border rounded disabled:opacity-50"
                >
                  Previous
                </button>
                <span className="text-sm text-neutral-500">
                  Page {evalPagination.page} of {evalPagination.totalPages}
                </span>
                <button
                  onClick={() => setEvalPagination(p => ({ ...p, page: p.page + 1 }))}
                  disabled={evalPagination.page === evalPagination.totalPages}
                  className="px-3 py-1 text-sm border rounded disabled:opacity-50"
                >
                  Next
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {activeTab === 'sessions' && (
        <div>
          <div className="flex justify-between items-center mb-4">
            <h2 className="font-semibold">Evaluation Sessions</h2>
            <button
              onClick={handleCreateSession}
              className="px-4 py-2 bg-neutral-900 text-white rounded-lg text-sm hover:bg-neutral-800"
            >
              Create Session
            </button>
          </div>

          <div className="grid gap-4">
            {sessions.map((session) => (
              <Card key={session.id}>
                <CardContent className="py-4">
                  <div className="flex justify-between items-start">
                    <div>
                      <h3 className="font-medium text-neutral-900">{session.name}</h3>
                      {session.description && (
                        <p className="text-sm text-neutral-500 mt-1">{session.description}</p>
                      )}
                      <div className="flex gap-4 mt-2 text-sm text-neutral-500">
                        <span>{session.evaluation_count} evaluations</span>
                        <span>Avg: {session.average_score.toFixed(1)}/5</span>
                        <span>Created: {new Date(session.created_at).toLocaleDateString()}</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className={`px-2 py-1 text-xs rounded ${
                        session.status === 'active' ? 'bg-green-100 text-green-800' :
                        session.status === 'completed' ? 'bg-blue-100 text-blue-800' :
                        'bg-neutral-100 text-neutral-600'
                      }`}>
                        {session.status}
                      </span>
                      <button
                        onClick={() => setActiveSession(session.id)}
                        className={`px-3 py-1 text-sm rounded border ${
                          activeSession === session.id
                            ? 'bg-neutral-900 text-white'
                            : 'hover:bg-neutral-50'
                        }`}
                      >
                        {activeSession === session.id ? 'Active' : 'Use'}
                      </button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}

            {sessions.length === 0 && (
              <Card>
                <CardContent className="py-8 text-center text-neutral-500">
                  <p>No sessions yet</p>
                  <p className="text-sm mt-1">Create a session to organize your evaluations</p>
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      )}

      {activeTab === 'chat' && (
        <div>
          {/* Chat Evaluations Stats */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
            <Card>
              <CardContent className="pt-6">
                <p className="text-sm text-neutral-500">Total Chat Evaluations</p>
                <p className="text-3xl font-semibold text-neutral-900">{chatStats.totalEvaluations}</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <p className="text-sm text-neutral-500">Correct</p>
                <p className="text-3xl font-semibold text-blue-600">{chatStats.byRating.correct}</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <p className="text-sm text-neutral-500">Partially Correct</p>
                <p className="text-3xl font-semibold text-green-600">{chatStats.byRating.partially_correct}</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <p className="text-sm text-neutral-500">Fail / Partial Fail</p>
                <p className="text-3xl font-semibold text-red-600">
                  {chatStats.byRating.fail + chatStats.byRating.partially_fail}
                </p>
              </CardContent>
            </Card>
          </div>

          {/* Filters and Export */}
          <div className="flex flex-wrap justify-between items-center gap-4 mb-4">
            <div className="flex gap-4 items-center">
              <select
                value={chatFilters.rating}
                onChange={(e) => {
                  setChatFilters(prev => ({ ...prev, rating: e.target.value }))
                  setChatPagination(prev => ({ ...prev, page: 1 }))
                }}
                className="px-3 py-2 border rounded-lg text-sm"
              >
                <option value="">All Ratings</option>
                <option value="correct">Correct</option>
                <option value="partially_correct">Partially Correct</option>
                <option value="partially_fail">Partially Fail</option>
                <option value="fail">Fail</option>
              </select>
              <select
                value={chatFilters.contentType}
                onChange={(e) => {
                  setChatFilters(prev => ({ ...prev, contentType: e.target.value }))
                  setChatPagination(prev => ({ ...prev, page: 1 }))
                }}
                className="px-3 py-2 border rounded-lg text-sm"
              >
                <option value="">All Content Types</option>
                <option value="chat_response">Chat Response</option>
                <option value="protocol">Protocol</option>
                <option value="patient_analysis">Patient Analysis</option>
              </select>
              <button
                onClick={fetchChatEvaluations}
                disabled={isLoading}
                className="text-sm text-blue-600 hover:text-blue-800"
              >
                Refresh
              </button>
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => window.open(`/api/admin/evaluations/chat/export?format=csv${chatFilters.rating ? `&rating=${chatFilters.rating}` : ''}${chatFilters.contentType ? `&contentType=${chatFilters.contentType}` : ''}`, '_blank')}
                className="px-4 py-2 text-sm border rounded-lg hover:bg-neutral-50"
              >
                Export CSV
              </button>
              <button
                onClick={() => window.open(`/api/admin/evaluations/chat/export?format=json${chatFilters.rating ? `&rating=${chatFilters.rating}` : ''}${chatFilters.contentType ? `&contentType=${chatFilters.contentType}` : ''}`, '_blank')}
                className="px-4 py-2 text-sm border rounded-lg hover:bg-neutral-50"
              >
                Export JSON
              </button>
            </div>
          </div>

          {/* Chat Evaluations Table */}
          <div className="bg-white rounded-lg border overflow-hidden">
            <table className="w-full">
              <thead className="bg-neutral-50 border-b">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-neutral-500 uppercase">Date</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-neutral-500 uppercase">Evaluator</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-neutral-500 uppercase">Type</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-neutral-500 uppercase">Rating</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-neutral-500 uppercase">Comment Preview</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {isLoading ? (
                  <tr>
                    <td colSpan={5} className="px-4 py-8 text-center text-neutral-500">
                      Loading...
                    </td>
                  </tr>
                ) : chatEvaluations.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-4 py-8 text-center text-neutral-500">
                      No chat evaluations found
                    </td>
                  </tr>
                ) : (
                  chatEvaluations.map((evaluation) => (
                    <tr key={evaluation.id} className="hover:bg-neutral-50">
                      <td className="px-4 py-3 text-sm text-neutral-600">
                        {new Date(evaluation.createdAt).toLocaleDateString()}
                      </td>
                      <td className="px-4 py-3 text-sm">
                        <div className="truncate max-w-[150px]" title={evaluation.evaluator?.email}>
                          {evaluation.evaluator?.fullName || evaluation.evaluator?.email || 'Unknown'}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-sm">
                        <span className="px-2 py-0.5 bg-neutral-100 text-neutral-700 rounded text-xs">
                          {CONTENT_TYPE_LABELS[evaluation.contentType] || evaluation.contentType}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`px-2 py-0.5 rounded text-xs font-medium ${CHAT_RATING_CONFIG[evaluation.rating]?.bgColor} ${CHAT_RATING_CONFIG[evaluation.rating]?.color}`}>
                          {CHAT_RATING_CONFIG[evaluation.rating]?.label || evaluation.rating}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-sm text-neutral-600">
                        <div className="truncate max-w-[300px]" title={evaluation.needsAdjustment || evaluation.correctAspects || ''}>
                          {evaluation.needsAdjustment || evaluation.correctAspects || '-'}
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>

            {/* Pagination */}
            {chatPagination.totalPages > 1 && (
              <div className="px-4 py-3 border-t flex justify-between items-center">
                <button
                  onClick={() => setChatPagination(p => ({ ...p, page: p.page - 1 }))}
                  disabled={chatPagination.page === 1}
                  className="px-3 py-1 text-sm border rounded disabled:opacity-50"
                >
                  Previous
                </button>
                <span className="text-sm text-neutral-500">
                  Page {chatPagination.page} of {chatPagination.totalPages}
                </span>
                <button
                  onClick={() => setChatPagination(p => ({ ...p, page: p.page + 1 }))}
                  disabled={chatPagination.page === chatPagination.totalPages}
                  className="px-3 py-1 text-sm border rounded disabled:opacity-50"
                >
                  Next
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  )
}
