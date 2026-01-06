'use client'

import { useState } from 'react'
import { HugeiconsIcon } from '@hugeicons/react'
import { FloppyDiskIcon, Loading03Icon } from '@hugeicons/core-free-icons'
import { Button } from '@/components/ui/Button'

interface LogProtocolsFooterProps {
  selectedCount: number
  onLog: () => Promise<void>
}

export function LogProtocolsFooter({ selectedCount, onLog }: LogProtocolsFooterProps) {
  const [isLogging, setIsLogging] = useState(false)

  if (selectedCount === 0) {
    return null
  }

  const handleLog = async () => {
    setIsLogging(true)
    try {
      await onLog()
    } finally {
      setIsLogging(false)
    }
  }

  return (
    <div className="fixed bottom-0 left-0 right-0 z-40 border-t border-neutral-200 bg-white/95 backdrop-blur-sm shadow-lg">
      <div className="max-w-7xl mx-auto px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="px-3 py-1 bg-emerald-50 text-emerald-700 font-semibold rounded-full text-sm">
              {selectedCount} Protocol{selectedCount !== 1 ? 's' : ''} Selected
            </span>
            <p className="text-sm text-neutral-600">
              Click to log these protocols to the treatment session
            </p>
          </div>

          <Button
            onClick={handleLog}
            disabled={isLogging}
            className="flex items-center gap-2 px-6"
          >
            {isLogging ? (
              <HugeiconsIcon icon={Loading03Icon} size={18} className="animate-spin" />
            ) : (
              <HugeiconsIcon icon={FloppyDiskIcon} size={18} />
            )}
            Log Protocols
          </Button>
        </div>
      </div>
    </div>
  )
}
