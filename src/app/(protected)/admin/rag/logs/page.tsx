'use client'

import { useState, useEffect, useCallback, Fragment } from 'react'

interface RagLog {
  id: string
  user_id: string
  conversation_id: string | null
  query_text: string
  user_role: string
  role_scope_filter: string
  results_count: number
  top_match_similarity: number | null
  chunks_retrieved: Array<{
    title: string
    similarity: number
    role_scope: string
    match_type: string
  }>
  response_time_ms: number
  error_message: string | null
  created_at: string
  profiles: {
    email: string
    full_name: string | null
  }
}

interface Pagination {
  page: number
  pageSize: number
  totalCount: number
  totalPages: number
}

export default function RagLogsPage() {
  const [logs, setLogs] = useState<RagLog[]>([])
  const [pagination, setPagination] = useState<Pagination>({
    page: 1,
    pageSize: 50,
    totalCount: 0,
    totalPages: 0,
  })
  const [isLoading, setIsLoading] = useState(true)
  const [roleFilter, setRoleFilter] = useState('')
  const [expandedLogId, setExpandedLogId] = useState<string | null>(null)

  const fetchLogs = useCallback(async () => {
    setIsLoading(true)
    try {
      const params = new URLSearchParams({
        page: pagination.page.toString(),
        pageSize: pagination.pageSize.toString(),
      })
      if (roleFilter) {
        params.append('userRole', roleFilter)
      }

      const response = await fetch(`/api/admin/rag/logs?${params}`)
      if (response.ok) {
        const data = await response.json()
        setLogs(data.data || [])
        setPagination(data.pagination)
      }
    } catch (error) {
      console.error('Failed to fetch RAG logs:', error)
    } finally {
      setIsLoading(false)
    }
  }, [pagination.page, pagination.pageSize, roleFilter])

  useEffect(() => {
    fetchLogs()
  }, [fetchLogs])

  const getRoleBadge = (role: string) => {
    const styles: Record<string, string> = {
      admin: 'bg-red-100 text-red-800',
      practitioner: 'bg-blue-100 text-blue-800',
      member: 'bg-green-100 text-green-800',
    }
    return (
      <span className={`px-2 py-1 text-xs rounded-full ${styles[role] || 'bg-gray-100'}`}>
        {role}
      </span>
    )
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString()
  }

  const toggleExpanded = (logId: string) => {
    setExpandedLogId(expandedLogId === logId ? null : logId)
  }

  return (
    <>
      <div className="flex justify-end mb-6">
        <button
          onClick={fetchLogs}
          disabled={isLoading}
          className="px-4 py-2 bg-neutral-900 text-white rounded-lg hover:bg-neutral-800 disabled:opacity-50"
        >
          {isLoading ? 'Loading...' : 'Refresh'}
        </button>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-xl shadow-sm border p-4 mb-6">
        <div className="flex gap-4 items-center">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Filter by Role
            </label>
            <select
              value={roleFilter}
              onChange={(e) => {
                setRoleFilter(e.target.value)
                setPagination((prev) => ({ ...prev, page: 1 }))
              }}
              className="px-3 py-2 border rounded-lg"
            >
              <option value="">All Roles</option>
              <option value="admin">Admin</option>
              <option value="practitioner">Practitioner</option>
              <option value="member">Member</option>
            </select>
          </div>
          <div className="text-sm text-gray-500 mt-6">
            Showing {logs.length} of {pagination.totalCount} logs
          </div>
        </div>
      </div>

      {/* Logs Table */}
      <div className="bg-white rounded-xl shadow-sm border overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-b">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  Time
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  User
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  Role
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  Query
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  Results
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  Similarity
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  Time (ms)
                </th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {logs.map((log) => (
                <Fragment key={log.id}>
                  <tr
                    className={`hover:bg-gray-50 cursor-pointer ${
                      log.error_message ? 'bg-red-50' : ''
                    }`}
                    onClick={() => toggleExpanded(log.id)}
                  >
                    <td className="px-4 py-3 text-sm text-gray-600">
                      {formatDate(log.created_at)}
                    </td>
                    <td className="px-4 py-3 text-sm">
                      <div className="truncate max-w-[150px]" title={log.profiles?.email}>
                        {log.profiles?.full_name || log.profiles?.email || 'Unknown'}
                      </div>
                    </td>
                    <td className="px-4 py-3">{getRoleBadge(log.user_role)}</td>
                    <td className="px-4 py-3 text-sm">
                      <div className="truncate max-w-[300px]" title={log.query_text}>
                        {log.query_text}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-sm text-center">
                      <span
                        className={`font-medium ${
                          log.results_count === 0 ? 'text-red-600' : 'text-green-600'
                        }`}
                      >
                        {log.results_count}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm">
                      {log.top_match_similarity !== null
                        ? `${(log.top_match_similarity * 100).toFixed(0)}%`
                        : '-'}
                    </td>
                    <td className="px-4 py-3 text-sm">
                      <span
                        className={`${
                          log.response_time_ms > 1000
                            ? 'text-red-600'
                            : log.response_time_ms > 500
                              ? 'text-yellow-600'
                              : 'text-green-600'
                        }`}
                      >
                        {log.response_time_ms}
                      </span>
                    </td>
                  </tr>
                  {expandedLogId === log.id && (
                    <tr key={`${log.id}-expanded`}>
                      <td colSpan={7} className="px-4 py-4 bg-gray-50">
                        <div className="space-y-3">
                          <div>
                            <span className="font-medium text-sm">Full Query:</span>
                            <p className="text-sm text-gray-600 mt-1 whitespace-pre-wrap">
                              {log.query_text}
                            </p>
                          </div>
                          <div>
                            <span className="font-medium text-sm">Role Scope Filter:</span>
                            <span className="text-sm text-gray-600 ml-2">
                              {log.role_scope_filter}
                            </span>
                          </div>
                          {log.error_message && (
                            <div className="p-3 bg-red-100 rounded-lg">
                              <span className="font-medium text-sm text-red-800">Error:</span>
                              <p className="text-sm text-red-700 mt-1">{log.error_message}</p>
                            </div>
                          )}
                          {log.chunks_retrieved && log.chunks_retrieved.length > 0 && (
                            <div>
                              <span className="font-medium text-sm">Retrieved Chunks:</span>
                              <div className="mt-2 space-y-2">
                                {log.chunks_retrieved.map((chunk, idx) => (
                                  <div
                                    key={idx}
                                    className="p-2 bg-white rounded border text-sm flex justify-between"
                                  >
                                    <span className="truncate max-w-[60%]">{chunk.title}</span>
                                    <div className="flex gap-4 text-gray-500">
                                      <span>
                                        {chunk.similarity
                                          ? `${(chunk.similarity * 100).toFixed(0)}%`
                                          : '-'}
                                      </span>
                                      <span className="text-xs bg-gray-100 px-2 py-0.5 rounded">
                                        {chunk.match_type}
                                      </span>
                                      <span className="text-xs bg-purple-100 text-purple-800 px-2 py-0.5 rounded">
                                        {chunk.role_scope}
                                      </span>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                      </td>
                    </tr>
                  )}
                </Fragment>
              ))}
            </tbody>
          </table>
        </div>

        {logs.length === 0 && !isLoading && (
          <div className="p-8 text-center text-gray-500">
            <p>No RAG logs found.</p>
            <p className="text-sm mt-1">Logs will appear here when users query the knowledge base.</p>
          </div>
        )}

        {/* Pagination */}
        {pagination.totalPages > 1 && (
          <div className="px-4 py-3 border-t flex justify-between items-center">
            <button
              onClick={() => setPagination((prev) => ({ ...prev, page: prev.page - 1 }))}
              disabled={pagination.page === 1}
              className="px-3 py-1 text-sm border rounded disabled:opacity-50"
            >
              Previous
            </button>
            <span className="text-sm text-gray-600">
              Page {pagination.page} of {pagination.totalPages}
            </span>
            <button
              onClick={() => setPagination((prev) => ({ ...prev, page: prev.page + 1 }))}
              disabled={pagination.page === pagination.totalPages}
              className="px-3 py-1 text-sm border rounded disabled:opacity-50"
            >
              Next
            </button>
          </div>
        )}
      </div>
    </>
  )
}
