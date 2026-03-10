'use client'

import Link from 'next/link'
import { Button } from '@/components/ui/Button'
import { EmptyState } from '@/components/ui/EmptyState'
import { HugeiconsIcon } from '@hugeicons/react'
import { UserGroupIcon } from '@hugeicons/core-free-icons'

export function NoPatientsEmptyState() {
  return (
    <div className="bg-neutral-50 dark:bg-neutral-800 rounded-2xl p-12">
      <EmptyState
        icon={<HugeiconsIcon icon={UserGroupIcon} size={40} />}
        title="No patients uploaded"
        description="You need to add patients before you can run protocols. Protocols are generated from diagnostic uploads attached to patient profiles."
        action={
          <Link href="/patients/new">
            <Button>Add Your First Patient</Button>
          </Link>
        }
      />
    </div>
  )
}
