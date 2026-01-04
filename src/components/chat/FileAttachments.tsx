'use client'

import { HugeiconsIcon } from '@hugeicons/react'
import { Pdf01Icon, Image02Icon, File01Icon } from '@hugeicons/core-free-icons'
import type { Attachment } from '@/types/chat'

interface FileAttachmentsProps {
  attachments: Attachment[]
  variant?: 'user' | 'assistant'
}

function getFileIcon(mimeType: string) {
  if (mimeType === 'application/pdf') {
    return Pdf01Icon
  }
  if (mimeType.startsWith('image/')) {
    return Image02Icon
  }
  return File01Icon
}

function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 B'
  const k = 1024
  const sizes = ['B', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`
}

export function FileAttachments({ attachments, variant = 'user' }: FileAttachmentsProps) {
  if (!attachments || attachments.length === 0) return null

  const isUser = variant === 'user'

  return (
    <div className="flex flex-col gap-1.5 mb-2">
      {attachments.map((attachment) => {
        const Icon = getFileIcon(attachment.mimeType)
        return (
          <div
            key={attachment.id}
            className={`
              flex items-center gap-2 px-3 py-2 rounded-lg text-sm
              ${isUser
                ? 'bg-white/10 text-white/90'
                : 'bg-neutral-100 text-neutral-700'
              }
            `}
          >
            <HugeiconsIcon
              icon={Icon}
              size={16}
              className={isUser ? 'text-white/70' : 'text-neutral-500'}
            />
            <span className="truncate flex-1 max-w-[200px]">
              {attachment.filename}
            </span>
            {attachment.size > 0 && (
              <span className={`text-xs ${isUser ? 'text-white/50' : 'text-neutral-400'}`}>
                {formatFileSize(attachment.size)}
              </span>
            )}
          </div>
        )
      })}
    </div>
  )
}
