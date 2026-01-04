'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/Button'
import { StartConversationButton } from './StartConversationButton'
import { PatientLabUploadModal } from './PatientLabUploadModal'
import { PatientDiagnosticsModal } from './PatientDiagnosticsModal'
import { HugeiconsIcon } from '@hugeicons/react'
import { TestTube01Icon, FolderUploadIcon } from '@hugeicons/core-free-icons'

interface PatientProfileActionsProps {
  patientId: string
  patientName: string
  patientAge: number
  patientGender: 'male' | 'female' | 'other'
}

export function PatientProfileActions({
  patientId,
  patientName,
  patientAge,
  patientGender,
}: PatientProfileActionsProps) {
  const router = useRouter()
  const [showLabModal, setShowLabModal] = useState(false)
  const [showDiagnosticsModal, setShowDiagnosticsModal] = useState(false)

  const handleSuccess = () => {
    router.refresh()
  }

  return (
    <>
      <div className="flex gap-4 flex-wrap">
        <StartConversationButton patientId={patientId} />
        <Button
          variant="secondary"
          onClick={() => setShowLabModal(true)}
        >
          <HugeiconsIcon icon={TestTube01Icon} size={16} className="mr-2" />
          Upload Labs
        </Button>
        <Button
          variant="secondary"
          onClick={() => setShowDiagnosticsModal(true)}
        >
          <HugeiconsIcon icon={FolderUploadIcon} size={16} className="mr-2" />
          Upload Diagnostics
        </Button>
        <Link href={`/patients/${patientId}/edit`}>
          <Button>Edit Patient</Button>
        </Link>
      </div>

      {/* Lab Upload Modal */}
      <PatientLabUploadModal
        isOpen={showLabModal}
        onClose={() => setShowLabModal(false)}
        patientId={patientId}
        patientName={patientName}
        patientAge={patientAge}
        patientGender={patientGender}
        onSuccess={handleSuccess}
      />

      {/* Diagnostics Upload Modal */}
      <PatientDiagnosticsModal
        isOpen={showDiagnosticsModal}
        onClose={() => setShowDiagnosticsModal(false)}
        patientId={patientId}
        patientName={patientName}
        onSuccess={handleSuccess}
      />
    </>
  )
}
