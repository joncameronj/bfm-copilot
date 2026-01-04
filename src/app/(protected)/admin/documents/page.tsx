'use client'

import { useState, useCallback } from 'react'
import toast from 'react-hot-toast'

interface Document {
  id: string
  filename: string
  file_type: string
  role_scope: string
  status: string
  total_chunks: number
  created_at: string
}

const FILE_TYPES = [
  { value: 'medical_protocol', label: 'Medical Protocol' },
  { value: 'lab_interpretation', label: 'Lab Interpretation Guide' },
  { value: 'diagnostic_report', label: 'Diagnostic Report' },
  { value: 'ip_material', label: 'IP/Training Material' },
  { value: 'other', label: 'Other' },
]

const ROLE_SCOPES = [
  {
    value: 'clinical',
    label: 'Clinical (Practitioners Only)',
    description: 'Protocols, dosing, treatment plans - only visible to practitioners and admins',
  },
  {
    value: 'educational',
    label: 'Educational (Members)',
    description: 'Wellness info, lifestyle recommendations - visible to members',
  },
  {
    value: 'both',
    label: 'Both (All Users)',
    description: 'General health information visible to all authenticated users',
  },
]

export default function DocumentsPage() {
  const [documents, setDocuments] = useState<Document[]>([])
  const [isUploading, setIsUploading] = useState(false)
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [fileType, setFileType] = useState('medical_protocol')
  const [roleScope, setRoleScope] = useState('clinical')
  const [isLoading, setIsLoading] = useState(false)

  const loadDocuments = useCallback(async () => {
    setIsLoading(true)
    try {
      const response = await fetch('/api/agent/documents')
      if (response.ok) {
        const data = await response.json()
        setDocuments(data.documents || [])
      }
    } catch (error) {
      console.error('Failed to load documents:', error)
    } finally {
      setIsLoading(false)
    }
  }, [])

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      setSelectedFile(file)
    }
  }

  const handleUpload = async () => {
    if (!selectedFile) {
      toast.error('Please select a file')
      return
    }

    setIsUploading(true)
    try {
      const formData = new FormData()
      formData.append('file', selectedFile)
      formData.append('file_type', fileType)
      formData.append('role_scope', roleScope)

      const response = await fetch('/api/agent/ingest', {
        method: 'POST',
        body: formData,
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Upload failed')
      }

      toast.success('Document uploaded and processing started')
      setSelectedFile(null)

      // Reset file input
      const fileInput = document.getElementById('file-upload') as HTMLInputElement
      if (fileInput) fileInput.value = ''

      // Refresh documents list
      loadDocuments()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Upload failed')
    } finally {
      setIsUploading(false)
    }
  }

  const getStatusBadge = (status: string) => {
    const styles: Record<string, string> = {
      pending: 'bg-yellow-100 text-yellow-800',
      processing: 'bg-blue-100 text-blue-800',
      indexed: 'bg-green-100 text-green-800',
      error: 'bg-red-100 text-red-800',
    }
    return (
      <span className={`px-2 py-1 text-xs rounded-full ${styles[status] || 'bg-gray-100'}`}>
        {status}
      </span>
    )
  }

  const getRoleScopeBadge = (roleScope: string) => {
    const styles: Record<string, string> = {
      clinical: 'bg-purple-100 text-purple-800',
      educational: 'bg-cyan-100 text-cyan-800',
      both: 'bg-gray-100 text-gray-800',
    }
    const labels: Record<string, string> = {
      clinical: 'Clinical',
      educational: 'Educational',
      both: 'All',
    }
    return (
      <span className={`px-2 py-1 text-xs rounded-full ${styles[roleScope] || 'bg-gray-100'}`}>
        {labels[roleScope] || roleScope}
      </span>
    )
  }

  return (
    <div className="max-w-4xl">

      {/* Upload Section */}
      <div className="bg-white rounded-xl shadow-sm border p-6 mb-8">
        <h2 className="text-lg font-semibold mb-4">Upload Document</h2>
        <p className="text-sm text-gray-600 mb-4">
          Upload medical protocols, lab interpretation guides, and other IP materials to enhance
          the AI's knowledge base.
        </p>

        <div className="space-y-4">
          <div>
            <label htmlFor="file_type" className="block text-sm font-medium text-gray-700 mb-1">
              Document Type
            </label>
            <select
              id="file_type"
              value={fileType}
              onChange={(e) => setFileType(e.target.value)}
              className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            >
              {FILE_TYPES.map((type) => (
                <option key={type.value} value={type.value}>
                  {type.label}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label htmlFor="role_scope" className="block text-sm font-medium text-gray-700 mb-1">
              Content Visibility
            </label>
            <select
              id="role_scope"
              value={roleScope}
              onChange={(e) => setRoleScope(e.target.value)}
              className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            >
              {ROLE_SCOPES.map((scope) => (
                <option key={scope.value} value={scope.value}>
                  {scope.label}
                </option>
              ))}
            </select>
            <p className="text-xs text-gray-500 mt-1">
              {ROLE_SCOPES.find((s) => s.value === roleScope)?.description}
            </p>
          </div>

          <div>
            <label htmlFor="file-upload" className="block text-sm font-medium text-gray-700 mb-1">
              Select File
            </label>
            <input
              id="file-upload"
              type="file"
              accept=".pdf,.txt,.md,.json"
              onChange={handleFileSelect}
              className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
            />
            <p className="text-xs text-gray-500 mt-1">
              Supported formats: PDF, TXT, Markdown, JSON
            </p>
          </div>

          {selectedFile && (
            <div className="p-3 bg-gray-50 rounded-lg">
              <p className="text-sm">
                <span className="font-medium">Selected:</span> {selectedFile.name}
              </p>
              <p className="text-xs text-gray-500">
                Size: {(selectedFile.size / 1024).toFixed(1)} KB
              </p>
            </div>
          )}

          <button
            onClick={handleUpload}
            disabled={!selectedFile || isUploading}
            className="w-full px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {isUploading ? 'Uploading...' : 'Upload and Index Document'}
          </button>
        </div>
      </div>

      {/* Documents List */}
      <div className="bg-white rounded-xl shadow-sm border">
        <div className="p-4 border-b flex justify-between items-center">
          <h2 className="text-lg font-semibold">Indexed Documents</h2>
          <button
            onClick={loadDocuments}
            disabled={isLoading}
            className="px-3 py-1 text-sm text-blue-600 hover:text-blue-800"
          >
            {isLoading ? 'Loading...' : 'Refresh'}
          </button>
        </div>

        {documents.length === 0 ? (
          <div className="p-8 text-center text-gray-500">
            <p>No documents indexed yet.</p>
            <p className="text-sm mt-1">Upload documents above to enhance the AI's knowledge.</p>
          </div>
        ) : (
          <div className="divide-y">
            {documents.map((doc) => (
              <div key={doc.id} className="p-4 flex items-center justify-between">
                <div>
                  <p className="font-medium">{doc.filename}</p>
                  <p className="text-sm text-gray-500">
                    {FILE_TYPES.find((t) => t.value === doc.file_type)?.label || doc.file_type}
                    {doc.total_chunks > 0 && ` - ${doc.total_chunks} chunks`}
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  {getRoleScopeBadge(doc.role_scope || 'clinical')}
                  {getStatusBadge(doc.status)}
                  <span className="text-xs text-gray-400">
                    {new Date(doc.created_at).toLocaleDateString()}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
