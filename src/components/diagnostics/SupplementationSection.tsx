'use client'

import { HugeiconsIcon } from '@hugeicons/react'
import { PillIcon } from '@hugeicons/core-free-icons'
import type { Supplementation } from '@/types/diagnostic-analysis'

interface SupplementationSectionProps {
  supplementation: Supplementation[]
}

export function SupplementationSection({ supplementation }: SupplementationSectionProps) {
  if (!supplementation || supplementation.length === 0) {
    return null
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <HugeiconsIcon icon={PillIcon} size={20} className="text-neutral-700" />
        <h4 className="font-medium text-neutral-900">
          Supplementation Protocols ({supplementation.length})
        </h4>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        {supplementation.map((supp, idx) => (
          <div
            key={idx}
            className="bg-white border border-neutral-200 rounded-2xl p-5"
          >
            <h5 className="font-semibold text-neutral-900 mb-2">{supp.name}</h5>

            <div className="space-y-2 text-sm">
              <div>
                <span className="font-medium text-neutral-700">Dosage:</span>
                <span className="text-neutral-600 ml-2">{supp.dosage}</span>
              </div>

              <div>
                <span className="font-medium text-neutral-700">Timing:</span>
                <span className="text-neutral-600 ml-2">{supp.timing}</span>
              </div>

              {supp.rationale && (
                <div className="pt-2 border-t border-neutral-100">
                  <p className="text-neutral-600">{supp.rationale}</p>
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
