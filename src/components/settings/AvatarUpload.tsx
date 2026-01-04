'use client'

import { useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { HugeiconsIcon } from '@hugeicons/react'
import { Camera01Icon, Delete02Icon, Loading03Icon } from '@hugeicons/core-free-icons'
import { cn } from '@/lib/utils'

interface AvatarUploadProps {
  avatarUrl?: string | null
  fullName?: string | null
}

export function AvatarUpload({ avatarUrl, fullName }: AvatarUploadProps) {
  const router = useRouter()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [isUploading, setIsUploading] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [previewUrl, setPreviewUrl] = useState<string | null>(avatarUrl || null)

  const initials = fullName
    ?.split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2) || '?'

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return

    setError(null)
    setIsUploading(true)

    // Show preview immediately
    const reader = new FileReader()
    reader.onload = (e) => {
      setPreviewUrl(e.target?.result as string)
    }
    reader.readAsDataURL(file)

    try {
      const formData = new FormData()
      formData.append('file', file)

      const res = await fetch('/api/settings/avatar', {
        method: 'POST',
        body: formData,
      })

      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || 'Failed to upload avatar')
      }

      const data = await res.json()
      setPreviewUrl(data.avatarUrl)
      router.refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to upload avatar')
      setPreviewUrl(avatarUrl || null) // Revert to original
    } finally {
      setIsUploading(false)
      // Reset input
      if (fileInputRef.current) {
        fileInputRef.current.value = ''
      }
    }
  }

  async function handleRemove() {
    setError(null)
    setIsDeleting(true)

    try {
      const res = await fetch('/api/settings/avatar', {
        method: 'DELETE',
      })

      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || 'Failed to remove avatar')
      }

      setPreviewUrl(null)
      router.refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to remove avatar')
    } finally {
      setIsDeleting(false)
    }
  }

  return (
    <div className="flex flex-col items-center gap-4 mb-6">
      {/* Avatar */}
      <div className="relative group">
        <div
          className={cn(
            'w-24 h-24 rounded-full flex items-center justify-center text-2xl font-medium overflow-hidden',
            previewUrl ? 'bg-neutral-100' : 'bg-neutral-200 text-neutral-600'
          )}
        >
          {previewUrl ? (
            <img
              src={previewUrl}
              alt="Avatar"
              className="w-full h-full object-cover"
            />
          ) : (
            initials
          )}
        </div>

        {/* Upload overlay */}
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          disabled={isUploading || isDeleting}
          className={cn(
            'absolute inset-0 rounded-full flex items-center justify-center',
            'bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity',
            'cursor-pointer disabled:cursor-not-allowed'
          )}
        >
          {isUploading ? (
            <HugeiconsIcon icon={Loading03Icon} size={24} className="text-white animate-spin" />
          ) : (
            <HugeiconsIcon icon={Camera01Icon} size={24} className="text-white" />
          )}
        </button>

        {/* Hidden file input */}
        <input
          ref={fileInputRef}
          type="file"
          accept="image/jpeg,image/png,image/gif,image/webp"
          onChange={handleFileChange}
          className="hidden"
        />
      </div>

      {/* Actions */}
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          disabled={isUploading || isDeleting}
          className="text-sm text-neutral-600 hover:text-neutral-900 disabled:opacity-50"
        >
          {previewUrl ? 'Change photo' : 'Upload photo'}
        </button>
        {previewUrl && (
          <>
            <span className="text-neutral-300">|</span>
            <button
              type="button"
              onClick={handleRemove}
              disabled={isUploading || isDeleting}
              className="text-sm text-red-600 hover:text-red-700 disabled:opacity-50 flex items-center gap-1"
            >
              {isDeleting ? (
                <HugeiconsIcon icon={Loading03Icon} size={12} className="animate-spin" />
              ) : (
                <HugeiconsIcon icon={Delete02Icon} size={12} />
              )}
              Remove
            </button>
          </>
        )}
      </div>

      {/* Error message */}
      {error && (
        <p className="text-sm text-red-600">{error}</p>
      )}

      {/* Help text */}
      <p className="text-xs text-neutral-500 text-center">
        JPG, PNG, GIF or WebP. Max 5MB.
      </p>
    </div>
  )
}
