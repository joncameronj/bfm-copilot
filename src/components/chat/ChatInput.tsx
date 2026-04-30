'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import { cn } from '@/lib/utils'
import { HugeiconsIcon } from '@hugeicons/react'
import {
  PlusSignIcon,
  Mic01Icon,
  InternetIcon,
  Image01Icon,
  UserIcon,
  AiSearchIcon,
} from '@hugeicons/core-free-icons'
import { PatientSearchModal } from './PatientSearchModal'
import { Dropdown, DropdownItem } from '@/components/ui/Dropdown'
import { useEditor, EditorContent } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import Placeholder from '@tiptap/extension-placeholder'

interface ChatInputProps {
  onSend: (
    _message: string,
    _files?: File[],
    _options?: { webSearch?: boolean; deepDive?: boolean }
  ) => void
  onStop?: () => void
  onMoveToBackground?: () => void
  isLoading?: boolean
  isListening?: boolean
  isVoiceSupported?: boolean
  transcript?: string
  interimTranscript?: string
  onStartListening?: () => void
  onStopListening?: () => void
  placeholder?: string
  disabled?: boolean
}

const INPUT_ICON_STROKE_WIDTH = 2.2

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
  onMoveToBackground,
  isLoading = false,
  isListening = false,
  isVoiceSupported = false,
  transcript = '',
  interimTranscript = '',
  onStartListening,
  onStopListening,
  placeholder = 'Ask Copilot',
  disabled = false,
}: ChatInputProps) {
  const [files, setFiles] = useState<File[]>([])
  const [showPatientModal, setShowPatientModal] = useState(false)
  const [isEditorEmpty, setIsEditorEmpty] = useState(true)
  const [webSearchEnabled, setWebSearchEnabled] = useState(false)
  const [deepDiveEnabled, setDeepDiveEnabled] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

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
    onUpdate: ({ editor }) => {
      setIsEditorEmpty(editor.isEmpty)
    },
  })

  // Sync voice transcript into the editor while listening
  useEffect(() => {
    if (!editor || !isListening) return

    const fullText = transcript + (interimTranscript ? interimTranscript : '')
    if (fullText) {
      // Build content with interim text styled differently
      if (interimTranscript) {
        editor.commands.setContent(
          `<p>${transcript}<span style="color: #a3a3a3">${interimTranscript}</span></p>`
        )
      } else {
        editor.commands.setContent(`<p>${transcript}</p>`)
      }
      setIsEditorEmpty(false)
    }
  }, [editor, isListening, transcript, interimTranscript])

  // When listening stops, set final transcript as plain text for editing
  useEffect(() => {
    if (!editor || isListening) return
    if (transcript) {
      editor.commands.setContent(`<p>${transcript}</p>`)
      editor.commands.focus('end')
      setIsEditorEmpty(false)
    }
  }, [editor, isListening, transcript])

  const handleSubmit = useCallback(() => {
    if (!editor) return

    const html = editor.getHTML()

    if (isEditorEmpty && files.length === 0) return
    if (isLoading || disabled) return

    // Convert HTML to markdown for sending
    const markdown = htmlToMarkdown(html)

    const chatOptions =
      webSearchEnabled || deepDiveEnabled
        ? {
            ...(webSearchEnabled ? { webSearch: true } : {}),
            ...(deepDiveEnabled ? { deepDive: true } : {}),
          }
        : undefined

    onSend(markdown, files.length > 0 ? files : undefined, chatOptions)
    editor.chain().clearContent().run()
    setIsEditorEmpty(true)
    setFiles([])
    setWebSearchEnabled(false)
    setDeepDiveEnabled(false)
  }, [editor, files, isLoading, disabled, onSend, isEditorEmpty, webSearchEnabled, deepDiveEnabled])

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
      onStopListening?.()
    } else {
      onStartListening?.()
    }
  }

  const handlePatientSelect = (patient: { firstName: string; lastName: string }) => {
    editor?.commands.setContent(`I want to work with patient ${patient.firstName} ${patient.lastName}.`)
    setShowPatientModal(false)
    editor?.commands.focus()
  }

  return (
    <div className="w-full">
      {/* Search mode badges */}
      {(webSearchEnabled || deepDiveEnabled) && (
        <div className="flex items-center gap-2 mb-2">
          {webSearchEnabled && (
            <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-blue-50 text-blue-700 rounded-full text-sm font-medium">
              <HugeiconsIcon
                icon={InternetIcon}
                size={14}
                color="currentColor"
                strokeWidth={INPUT_ICON_STROKE_WIDTH}
              />
              Web Search ON
              <button
                type="button"
                onClick={() => setWebSearchEnabled(false)}
                className="ml-1 text-blue-400 hover:text-blue-600"
              >
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </span>
          )}

          {deepDiveEnabled && (
            <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-amber-50 text-amber-700 rounded-full text-sm font-medium">
              <HugeiconsIcon
                icon={AiSearchIcon}
                size={14}
                color="currentColor"
                strokeWidth={INPUT_ICON_STROKE_WIDTH}
              />
              Deep Dive ON (One message)
              <button
                type="button"
                onClick={() => setDeepDiveEnabled(false)}
                className="ml-1 text-amber-400 hover:text-amber-600"
              >
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </span>
          )}
        </div>
      )}

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

      {/* Input wrapper */}
      <div className="input-wrapper-unified">
        {/* Input container */}
        <div className="input-container-chatgpt flex items-center gap-2 p-3">
          {/* Plus (+) dropdown menu */}
          <Dropdown
            position="above"
            align="left"
            trigger={
              <button
                type="button"
                disabled={disabled || isLoading}
                className={cn(
                  'flex items-center justify-center w-10 h-10 rounded-xl',
                  'bg-neutral-100 text-neutral-500 hover:text-neutral-700 hover:bg-neutral-200',
                  'disabled:opacity-50 disabled:cursor-not-allowed',
                  'transition-colors duration-150'
                )}
                aria-label="More options"
              >
                <HugeiconsIcon
                  icon={PlusSignIcon}
                  size={20}
                  color="currentColor"
                  strokeWidth={INPUT_ICON_STROKE_WIDTH}
                />
              </button>
            }
          >
            <DropdownItem
              onClick={() => fileInputRef.current?.click()}
            >
              <span className="flex items-center gap-3">
                <HugeiconsIcon
                  icon={Image01Icon}
                  size={18}
                  className="text-neutral-500"
                  strokeWidth={INPUT_ICON_STROKE_WIDTH}
                />
                Photos & Files
              </span>
            </DropdownItem>
            <DropdownItem
              onClick={() => setWebSearchEnabled((prev) => !prev)}
            >
              <span className="flex items-center gap-3">
                <HugeiconsIcon
                  icon={InternetIcon}
                  size={18}
                  className="text-neutral-500"
                  strokeWidth={INPUT_ICON_STROKE_WIDTH}
                />
                Web Search
                {webSearchEnabled && (
                  <span className="ml-auto text-xs font-semibold text-blue-600">ON</span>
                )}
              </span>
            </DropdownItem>
            <DropdownItem
              onClick={() => setDeepDiveEnabled((prev) => !prev)}
            >
              <span className="flex items-center gap-3">
                <HugeiconsIcon
                  icon={AiSearchIcon}
                  size={18}
                  className="text-amber-600"
                  strokeWidth={INPUT_ICON_STROKE_WIDTH}
                />
                Deep Dive
                {deepDiveEnabled && (
                  <span className="ml-auto text-xs font-semibold text-amber-600">ON</span>
                )}
              </span>
            </DropdownItem>
            <DropdownItem
              onClick={() => setShowPatientModal(true)}
            >
              <span className="flex items-center gap-3">
                <HugeiconsIcon
                  icon={UserIcon}
                  size={18}
                  className="text-neutral-500"
                  strokeWidth={INPUT_ICON_STROKE_WIDTH}
                />
                Patient Lookup
              </span>
            </DropdownItem>
          </Dropdown>
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

          {/* Voice input button */}
          {!isLoading && isVoiceSupported && (
            <button
              type="button"
              onClick={handleVoiceClick}
              disabled={disabled}
              className={cn(
                'flex items-center justify-center w-10 h-10 rounded-xl transition-colors duration-150',
                'disabled:opacity-50 disabled:cursor-not-allowed',
                isListening
                  ? 'bg-red-500 text-white hover:bg-red-600'
                  : 'bg-neutral-100 text-neutral-500 hover:text-neutral-700 hover:bg-neutral-200'
              )}
              aria-label={isListening ? 'Stop listening' : 'Start voice input'}
            >
              {isListening ? (
                <span className="relative flex items-center justify-center">
                  <HugeiconsIcon
                    icon={Mic01Icon}
                    size={20}
                    color="currentColor"
                    strokeWidth={INPUT_ICON_STROKE_WIDTH}
                  />
                  <span className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 bg-white rounded-full animate-pulse" />
                </span>
              ) : (
                <HugeiconsIcon
                  icon={Mic01Icon}
                  size={20}
                  color="currentColor"
                  strokeWidth={INPUT_ICON_STROKE_WIDTH}
                />
              )}
            </button>
          )}

          {/* Move to Background button - only shown while loading */}
          {isLoading && onMoveToBackground && (
            <button
              type="button"
              onClick={onMoveToBackground}
              className={cn(
                'flex items-center gap-1.5 px-3 h-10 rounded-xl',
                'bg-neutral-100 text-neutral-600 hover:bg-neutral-200 hover:text-neutral-800',
                'text-sm font-medium whitespace-nowrap transition-colors duration-150'
              )}
              aria-label="Move to background"
              title="Continue in background"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v2a2 2 0 002 2h12a2 2 0 002-2v-2M7 10l5 5 5-5M12 15V3" />
              </svg>
              <span className="hidden sm:inline">Background</span>
            </button>
          )}

          {/* Send/Stop button */}
          <button
            type="button"
            onClick={isLoading ? onStop : handleSubmit}
            disabled={disabled || (!isLoading && isEditorEmpty && files.length === 0)}
            className={cn(
              'btn-send rounded-xl',
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
