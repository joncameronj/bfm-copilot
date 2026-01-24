'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import { cn } from '@/lib/utils'
import { HugeiconsIcon } from '@hugeicons/react'
import { Attachment02Icon } from '@hugeicons/core-free-icons'
import { PatientSearchModal } from './PatientSearchModal'
import { FormattingToolbar } from './FormattingToolbar'
import { useEditor, EditorContent } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import Placeholder from '@tiptap/extension-placeholder'
import Underline from '@tiptap/extension-underline'
import Link from '@tiptap/extension-link'

interface ChatInputProps {
  onSend: (message: string, files?: File[]) => void
  onStop?: () => void
  onVoiceStart?: () => void
  onVoiceEnd?: () => void
  isLoading?: boolean
  isListening?: boolean
  placeholder?: string
  disabled?: boolean
}

// Helper function to convert TipTap HTML to markdown
function htmlToMarkdown(html: string): string {
  // Simple HTML to markdown conversion
  let md = html
    // Convert strong/b tags to markdown bold
    .replace(/<strong>(.*?)<\/strong>/gi, '**$1**')
    .replace(/<b>(.*?)<\/b>/gi, '**$1**')
    // Convert em/i tags to markdown italic
    .replace(/<em>(.*?)<\/em>/gi, '*$1*')
    .replace(/<i>(.*?)<\/i>/gi, '*$1*')
    // Convert u tags to markdown (using underscores for underline, though not standard)
    .replace(/<u>(.*?)<\/u>/gi, '__$1__')
    // Convert links
    .replace(/<a[^>]*href="([^"]*)"[^>]*>(.*?)<\/a>/gi, '[$2]($1)')
    // Convert unordered lists (using [\s\S] instead of . with s flag for compatibility)
    .replace(/<ul>([\s\S]*?)<\/ul>/gi, (_: string, content: string) => {
      return content.replace(/<li>([\s\S]*?)<\/li>/gi, '- $1\n')
    })
    // Convert ordered lists
    .replace(/<ol>([\s\S]*?)<\/ol>/gi, (_: string, content: string) => {
      let index = 0
      return content.replace(/<li>([\s\S]*?)<\/li>/gi, (__: string, liContent: string) => {
        index++
        return `${index}. ${liContent}\n`
      })
    })
    // Convert paragraphs to newlines
    .replace(/<p>(.*?)<\/p>/gi, '$1\n')
    // Remove any remaining HTML tags
    .replace(/<[^>]+>/g, '')
    // Clean up multiple newlines
    .replace(/\n{3,}/g, '\n\n')
    // Trim
    .trim()

  return md
}

export function ChatInput({
  onSend,
  onStop,
  onVoiceStart,
  onVoiceEnd,
  isLoading = false,
  isListening = false,
  placeholder = 'Ask Copilot',
  disabled = false,
}: ChatInputProps) {
  const [files, setFiles] = useState<File[]>([])
  const [showPatientModal, setShowPatientModal] = useState(false)
  const [isFocused, setIsFocused] = useState(false)
  const [isEditorEmpty, setIsEditorEmpty] = useState(true)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)

  const editor = useEditor({
    immediatelyRender: false, // Disable SSR to avoid hydration mismatches
    extensions: [
      StarterKit.configure({
        bulletList: {
          keepMarks: true,
          keepAttributes: false,
        },
        orderedList: {
          keepMarks: true,
          keepAttributes: false,
        },
      }),
      Placeholder.configure({
        placeholder,
        emptyEditorClass: 'is-editor-empty',
      }),
      Underline,
      Link.configure({
        openOnClick: false,
        HTMLAttributes: {
          class: 'text-brand-blue underline',
        },
      }),
    ],
    editorProps: {
      attributes: {
        class: 'tiptap-editor focus:outline-none',
      },
      handleKeyDown: (view, event) => {
        if (event.key === 'Enter' && !event.shiftKey) {
          event.preventDefault()
          handleSubmit()
          return true
        }
        return false
      },
    },
    onFocus: () => setIsFocused(true),
    onUpdate: ({ editor }) => {
      setIsEditorEmpty(editor.isEmpty)
    },
    onCreate: ({ editor }) => {
      // Ensure no marks are active on initial load
      editor.commands.unsetAllMarks()
    },
  })

  // Handle clicks outside to blur
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsFocused(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const handleSubmit = useCallback(() => {
    if (!editor) return

    const html = editor.getHTML()

    if (isEditorEmpty && files.length === 0) return
    if (isLoading || disabled) return

    // Convert HTML to markdown for sending
    const markdown = htmlToMarkdown(html)

    onSend(markdown, files.length > 0 ? files : undefined)
    editor.chain().clearContent().unsetAllMarks().run()
    setIsEditorEmpty(true)
    setFiles([])
  }, [editor, files, isLoading, disabled, onSend, isEditorEmpty])

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFiles = Array.from(e.target.files || [])
    setFiles((prev) => [...prev, ...selectedFiles].slice(0, 5))
    e.target.value = ''
  }

  const removeFile = (index: number) => {
    setFiles((prev) => prev.filter((_, i) => i !== index))
  }

  const handleVoiceClick = () => {
    if (isListening) {
      onVoiceEnd?.()
    } else {
      onVoiceStart?.()
    }
  }

  const handlePatientSelect = (patient: { firstName: string; lastName: string }) => {
    editor?.commands.setContent(`I want to work with patient ${patient.firstName} ${patient.lastName}.`)
    setShowPatientModal(false)
    editor?.commands.focus()
  }

  return (
    <div className="w-full" ref={containerRef}>
      {/* File previews */}
      {files.length > 0 && (
        <div className="flex flex-wrap gap-2 mb-3">
          {files.map((file, index) => (
            <div
              key={`${file.name}-${index}`}
              className="flex items-center gap-2 bg-neutral-100 rounded-lg px-3 py-2"
            >
              <span className="text-sm text-neutral-600 truncate max-w-[150px]">
                {file.name}
              </span>
              <button
                type="button"
                onClick={() => removeFile(index)}
                className="text-neutral-400 hover:text-neutral-600"
              >
                <svg
                  className="w-4 h-4"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M6 18L18 6M6 6l12 12"
                  />
                </svg>
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Unified wrapper - maintains consistent border during animation */}
      <div className={cn(
        'input-wrapper-unified',
        isFocused && 'expanded'
      )}>
        {/* Animated formatting toolbar - slides down inside wrapper */}
        <div className={cn(
          'toolbar-inner',
          isFocused && 'expanded'
        )}>
          <div>
            <FormattingToolbar editor={editor} />
          </div>
        </div>

        {/* Divider - fades in when toolbar is visible */}
        <div className={cn(
          'toolbar-divider',
          isFocused && 'visible'
        )} />

        {/* Input container - ChatGPT style */}
        <div className="input-container-chatgpt flex items-center gap-2 p-3">
          {/* File upload button - morphs from circle to square */}
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={disabled || isLoading}
            className={cn(
              'btn-morph flex items-center justify-center w-10 h-10',
              'bg-neutral-100 text-neutral-500 hover:text-neutral-700 hover:bg-neutral-200',
              'disabled:opacity-50 disabled:cursor-not-allowed',
              isFocused ? 'squared' : 'circular'
            )}
            aria-label="Upload file"
          >
            <HugeiconsIcon icon={Attachment02Icon} size={20} color="currentColor" />
          </button>
          <input
            ref={fileInputRef}
            type="file"
            multiple
            accept=".pdf,.doc,.docx,.txt,.png,.jpg,.jpeg"
            onChange={handleFileSelect}
            className="hidden"
          />

          {/* TipTap Rich Text Editor */}
          <EditorContent
            editor={editor}
            className={cn(
              'flex-1 min-w-0',
              disabled && 'opacity-50 pointer-events-none'
            )}
          />

          {/* Send/Stop button - morphs from circle to square */}
          <button
            type="button"
            onClick={isLoading ? onStop : handleSubmit}
            disabled={disabled || (!isLoading && isEditorEmpty && files.length === 0)}
            className={cn(
              'btn-send btn-morph',
              isFocused ? 'squared' : 'circular',
              isLoading && 'btn-stop'
            )}
            aria-label={isLoading ? 'Stop generation' : 'Send message'}
          >
            {isLoading ? (
              <svg
                className="w-5 h-5"
                fill="currentColor"
                viewBox="0 0 24 24"
              >
                <rect x="6" y="6" width="12" height="12" rx="2" />
              </svg>
            ) : (
              <svg
                className="w-5 h-5"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M5 10l7-7m0 0l7 7m-7-7v18"
                />
              </svg>
            )}
          </button>
        </div>
      </div>


      {/* Patient search modal */}
      <PatientSearchModal
        isOpen={showPatientModal}
        onClose={() => setShowPatientModal(false)}
        onSelect={handlePatientSelect}
      />
    </div>
  )
}
