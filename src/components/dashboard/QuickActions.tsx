'use client'

import Link from 'next/link'

const actions = [
  {
    label: 'New Patient',
    href: '/patients/new',
    description: 'Add a new patient profile',
  },
  {
    label: 'Lab Analysis',
    href: '/labs',
    description: 'Analyze lab results',
  },
  {
    label: 'Start Conversation',
    href: '/',
    description: 'Chat with AI assistant',
  },
  {
    label: 'Upload Diagnostics',
    href: '/diagnostics',
    description: 'Upload diagnostic files',
  },
]

export function QuickActions() {
  return (
    <div className="space-y-2">
      {actions.map((action) => (
        <Link
          key={action.href}
          href={action.href}
          className="block p-3 rounded-xl hover:bg-neutral-100 transition-colors"
        >
          <p className="font-medium text-neutral-900">{action.label}</p>
          <p className="text-sm text-neutral-500">{action.description}</p>
        </Link>
      ))}
    </div>
  )
}
