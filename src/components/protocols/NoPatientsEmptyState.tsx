'use client'

import Link from 'next/link'
import { Button } from '@/components/ui/Button'

export function NoPatientsEmptyState() {
  return (
    <div className="bg-neutral-50 rounded-2xl p-12 text-center">
      <div className="max-w-md mx-auto">
        <div className="w-16 h-16 bg-neutral-100 rounded-full flex items-center justify-center mx-auto mb-6">
          <svg
            className="w-8 h-8 text-neutral-400"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={1.5}
              d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"
            />
          </svg>
        </div>
        <h3 className="text-xl font-semibold text-neutral-900 mb-2">
          No patients uploaded
        </h3>
        <p className="text-neutral-600 mb-6">
          You need to add patients before you can run protocols. Protocols are generated from diagnostic uploads attached to patient profiles.
        </p>
        <Link href="/patients/new">
          <Button>Add Your First Patient</Button>
        </Link>
      </div>
    </div>
  )
}
