'use client'

import { HugeiconsIcon } from '@hugeicons/react'
import { Cancel01Icon, File01Icon, Tick02Icon, Alert01Icon, Loading03Icon } from '@hugeicons/core-free-icons'
import { Select } from '@/components/ui/Select'
import type { DiagnosticType } from '@/types/shared'

interface UploadFile {
  id: string
  file: File
  type: DiagnosticType
  progress: number
  status: 'pending' | 'uploading' | 'processing' | 'complete' | 'error'
  url?: string
  error?: string
}

interface FilePreviewProps {
  file: UploadFile
  onTypeChange: (type: DiagnosticType) => void
  onRemove: () => void
  disabled?: boolean
}

export function FilePreview({ file, onTypeChange, onRemove, disabled }: FilePreviewProps) {
  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return '0 Bytes'
    const k = 1024
    const sizes = ['Bytes', 'KB', 'MB', 'GB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
  }

  const getStatusIcon = () => {
    switch (file.status) {
      case 'uploading':
      case 'processing':
        return <HugeiconsIcon icon={Loading03Icon} size={20} className="text-brand-blue animate-spin" />
      case 'complete':
        return <HugeiconsIcon icon={Tick02Icon} size={20} className="text-green-500" />
      case 'error':
        return <HugeiconsIcon icon={Alert01Icon} size={20} className="text-red-500" />
      default:
        return <HugeiconsIcon icon={File01Icon} size={20} className="text-neutral-400" />
    }
  }

  const getStatusText = () => {
    switch (file.status) {
      case 'uploading':
        return 'Uploading...'
      case 'processing':
        return 'Processing...'
      case 'complete':
        return 'Complete'
      case 'error':
        return file.error || 'Failed'
      default:
        return 'Ready'
    }
  }

  return (
    <div className={`
      flex items-center gap-4 p-4 bg-neutral-50 rounded-xl
      ${file.status === 'error' ? 'bg-red-50' : ''}
      ${file.status === 'complete' ? 'bg-green-50' : ''}
    `}>
      {/* Icon */}
      <div className="flex-shrink-0">
        {getStatusIcon()}
      </div>

      {/* File Info */}
      <div className="flex-1 min-w-0">
        <p className="font-medium text-neutral-900 truncate">
          {file.file.name}
        </p>
        <p className="text-sm text-neutral-500">
          {formatFileSize(file.file.size)} &bull; {getStatusText()}
        </p>
      </div>

      {/* Type Selector */}
      {file.status === 'pending' && (
        <div className="w-40">
          <Select
            value={file.type}
            onChange={(e) => onTypeChange(e.target.value as DiagnosticType)}
            disabled={disabled}
          >
            <option value="d_pulse">D-Pulse</option>
            <option value="hrv">HRV</option>
            <option value="urinalysis">Urinalysis (UA)</option>
            <option value="vcs">VCS</option>
            <option value="brainwave">Brainwave</option>
            <option value="nes_scan">NES Scan</option>
            <option value="mold_toxicity">Mold Toxicity</option>
            <option value="blood_panel">Blood Panel</option>
            <option value="other">Other</option>
          </Select>
        </div>
      )}

      {/* Remove Button */}
      {(file.status === 'pending' || file.status === 'error') && !disabled && (
        <button
          onClick={onRemove}
          className="flex-shrink-0 p-2 text-neutral-400 hover:text-neutral-600 transition-colors"
        >
          <HugeiconsIcon icon={Cancel01Icon} size={20} />
        </button>
      )}
    </div>
  )
}
