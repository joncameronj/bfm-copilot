'use client'

import { Editor } from '@tiptap/react'
import { HugeiconsIcon } from '@hugeicons/react'
import {
  TextBoldIcon,
  TextItalicIcon,
  TextUnderlineIcon,
  LeftToRightListBulletIcon,
  LeftToRightListNumberIcon,
  Link01Icon,
} from '@hugeicons/core-free-icons'
import { cn } from '@/lib/utils'

interface FormattingToolbarProps {
  editor: Editor | null
}

interface ToolbarButton {
  id: string
  icon: typeof TextBoldIcon
  label: string
  action: (editor: Editor) => void
  isActive: (editor: Editor) => boolean
}

const TOOLBAR_BUTTONS: ToolbarButton[] = [
  {
    id: 'bold',
    icon: TextBoldIcon,
    label: 'Bold',
    action: (editor) => editor.chain().focus().toggleBold().run(),
    isActive: (editor) => editor.isActive('bold'),
  },
  {
    id: 'italic',
    icon: TextItalicIcon,
    label: 'Italic',
    action: (editor) => editor.chain().focus().toggleItalic().run(),
    isActive: (editor) => editor.isActive('italic'),
  },
  {
    id: 'underline',
    icon: TextUnderlineIcon,
    label: 'Underline',
    action: (editor) => editor.chain().focus().toggleUnderline().run(),
    isActive: (editor) => editor.isActive('underline'),
  },
  {
    id: 'bulletList',
    icon: LeftToRightListBulletIcon,
    label: 'Bullet List',
    action: (editor) => editor.chain().focus().toggleBulletList().run(),
    isActive: (editor) => editor.isActive('bulletList'),
  },
  {
    id: 'orderedList',
    icon: LeftToRightListNumberIcon,
    label: 'Numbered List',
    action: (editor) => editor.chain().focus().toggleOrderedList().run(),
    isActive: (editor) => editor.isActive('orderedList'),
  },
  {
    id: 'link',
    icon: Link01Icon,
    label: 'Link',
    action: (editor) => {
      const previousUrl = editor.getAttributes('link').href
      const url = window.prompt('Enter URL:', previousUrl)

      if (url === null) return

      if (url === '') {
        editor.chain().focus().extendMarkRange('link').unsetLink().run()
        return
      }

      editor.chain().focus().extendMarkRange('link').setLink({ href: url }).run()
    },
    isActive: (editor) => editor.isActive('link'),
  },
]

export function FormattingToolbar({ editor }: FormattingToolbarProps) {
  if (!editor) return null

  return (
    <div className="flex items-center gap-1 px-2 py-1.5">
      {TOOLBAR_BUTTONS.map((button) => (
        <button
          key={button.id}
          type="button"
          onClick={() => button.action(editor)}
          className={cn(
            'p-1.5 rounded-md transition-colors duration-150',
            button.isActive(editor)
              ? 'bg-neutral-200 text-neutral-900'
              : 'text-neutral-500 hover:bg-neutral-100 hover:text-neutral-700'
          )}
          title={button.label}
          aria-label={button.label}
        >
          <HugeiconsIcon icon={button.icon} size={18} color="currentColor" />
        </button>
      ))}
    </div>
  )
}
