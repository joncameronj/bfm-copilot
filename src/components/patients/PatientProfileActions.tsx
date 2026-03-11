'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/Button'
import { PatientLabUploadModal } from './PatientLabUploadModal'
import { PatientDiagnosticsModal } from './PatientDiagnosticsModal'
import { PatientAddNoteModal } from './PatientAddNoteModal'
import { HugeiconsIcon } from '@hugeicons/react'
import { TestTube01Icon, FolderUploadIcon, NoteIcon } from '@hugeicons/core-free-icons'

interface PatientProfileActionsProps {
  patientId: string
  patientName: string
  patientAge: number
  patientGender: 'male' | 'female'
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
  const [showNoteModal, setShowNoteModal] = useState(false)

  const handleSuccess = () => {
    router.refresh()
  }

  return (
    <>
      <div className="flex gap-4 flex-wrap">
        <Button
          variant="secondary"
          onClick={() => setShowNoteModal(true)}
        >
          <HugeiconsIcon icon={NoteIcon} size={16} className="mr-2" />
          Add Note
        </Button>
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

      {/* Note Modal */}
      <PatientAddNoteModal
        isOpen={showNoteModal}
        onClose={() => setShowNoteModal(false)}
        patientId={patientId}
        patientName={patientName}
        onSuccess={handleSuccess}
      />

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
