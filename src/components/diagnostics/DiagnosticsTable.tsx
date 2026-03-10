'use client'

import { useState } from 'react'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { Modal } from '@/components/ui/Modal'
import { Spinner } from '@/components/ui/Spinner'
import { formatDate } from '@/lib/utils'
import { toast } from 'react-hot-toast'
import { Trash2 } from 'lucide-react'

interface DiagnosticFile {
  id: string
  filename: string
  fileType: string
  uploadId: string
  uploadedAt: string
  uploadStatus: string
  url?: string
}

interface DiagnosticsTableProps {
  files: DiagnosticFile[]
  isLoading?: boolean
  onRefresh: () => void
}

export function DiagnosticsTable({ files, isLoading = false, onRefresh }: DiagnosticsTableProps) {
  const [deleteTarget, setDeleteTarget] = useState<DiagnosticFile | null>(null)
  const [isDeleting, setIsDeleting] = useState(false)

  const getFileTypeLabel = (type: string) => {
    switch (type) {
      case 'd_pulse':
        return 'D-Pulse'
      case 'hrv':
        return 'HRV'
      case 'nes_scan':
        return 'NES Scan'
      case 'mold_toxicity':
        return 'Mold Toxicity'
      case 'blood_panel':
        return 'Blood Panel'
      default:
        return 'Other'
    }
  }

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'complete':
        return <Badge variant="success" size="sm">Complete</Badge>
      case 'processing':
        return <Badge variant="warning" size="sm">Processing</Badge>
      case 'uploaded':
        return <Badge variant="info" size="sm">Uploaded</Badge>
      case 'uploading':
        return <Badge variant="warning" size="sm">Uploading</Badge>
      case 'error':
        return <Badge variant="danger" size="sm">Error</Badge>
      default:
        return <Badge variant="neutral" size="sm">Pending</Badge>
    }
  }

  const handleDelete = async () => {
    if (!deleteTarget) return

    setIsDeleting(true)
    try {
      const response = await fetch(`/api/diagnostics/${deleteTarget.uploadId}`, {
        method: 'DELETE',
      })

      if (!response.ok) {
        throw new Error('Failed to delete')
      }

      toast.success('File deleted successfully')
      onRefresh()
    } catch (error) {
      console.error('Delete error:', error)
      toast.error('Failed to delete file')
    } finally {
      setIsDeleting(false)
      setDeleteTarget(null)
    }
  }

  const handleFixStatus = async (file: DiagnosticFile) => {
    try {
      const response = await fetch(`/api/diagnostics/${file.uploadId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'uploaded' }),
      })

      if (!response.ok) {
        throw new Error('Failed to update status')
      }

      toast.success('Status updated')
      onRefresh()
    } catch (error) {
      console.error('Fix status error:', error)
      toast.error('Failed to update status')
    }
  }

  return (
    <>
      <div className="bg-white dark:bg-neutral-800 rounded-2xl overflow-hidden">
        <table className="w-full">
          <thead className="bg-neutral-50 dark:bg-neutral-900">
            <tr>
              <th className="px-4 py-3 text-left text-sm font-medium text-neutral-500 dark:text-neutral-400">
                Filename
              </th>
              <th className="px-4 py-3 text-left text-sm font-medium text-neutral-500 dark:text-neutral-400">
                Type
              </th>
              <th className="px-4 py-3 text-left text-sm font-medium text-neutral-500 dark:text-neutral-400">
                Uploaded
              </th>
              <th className="px-4 py-3 text-left text-sm font-medium text-neutral-500 dark:text-neutral-400">
                Status
              </th>
              <th className="px-4 py-3 text-right text-sm font-medium text-neutral-500 dark:text-neutral-400">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-neutral-100 dark:divide-neutral-700">
            {isLoading ? (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center">
                  <Spinner />
                </td>
              </tr>
            ) : files.length === 0 ? (
              <tr>
                <td
                  colSpan={5}
                  className="px-4 py-8 text-center text-neutral-500 dark:text-neutral-400"
                >
                  No diagnostic files yet
                </td>
              </tr>
            ) : (
              files.map((file) => (
                <tr key={file.id} className="hover:bg-neutral-50 dark:hover:bg-neutral-700">
                  <td className="px-4 py-3">
                    <span className="font-medium text-neutral-900 dark:text-neutral-50 truncate block max-w-xs">
                      {file.filename}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <Badge variant="neutral" size="sm">
                      {getFileTypeLabel(file.fileType)}
                    </Badge>
                  </td>
                  <td className="px-4 py-3 text-neutral-600 dark:text-neutral-400 text-sm">
                    {formatDate(file.uploadedAt)}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      {getStatusBadge(file.uploadStatus)}
                      {file.uploadStatus === 'uploading' && (
                        <Button
                          variant="link"
                          onClick={() => handleFixStatus(file)}
                          className="text-xs"
                        >
                          Fix
                        </Button>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <Button
                      variant="icon"
                      onClick={() => setDeleteTarget(file)}
                      className="text-neutral-400 hover:text-red-600 dark:hover:text-red-400"
                      aria-label="Delete file"
                    >
                      <Trash2 size={16} />
                    </Button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Delete Confirmation Modal */}
      <Modal
        isOpen={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        title="Delete File"
        size="sm"
      >
        <div className="space-y-4">
          <p className="text-neutral-600 dark:text-neutral-400">
            Are you sure you want to delete <strong>{deleteTarget?.filename}</strong>? This will also delete any associated analysis data.
          </p>
          <div className="flex gap-3 justify-end">
            <Button
              variant="ghost"
              onClick={() => setDeleteTarget(null)}
              disabled={isDeleting}
            >
              Cancel
            </Button>
            <Button
              variant="danger"
              onClick={handleDelete}
              isLoading={isDeleting}
            >
              Delete
            </Button>
          </div>
        </div>
      </Modal>
    </>
  )
}
