'use client'

import { useRouter, useParams } from 'next/navigation'
import { toast } from 'react-hot-toast'
import { ProtocolForm } from '@/components/protocols/ProtocolForm'
import { useProtocol, useProtocolMutations } from '@/hooks/useProtocols'
import { Spinner } from '@/components/ui/Spinner'
import { Button } from '@/components/ui/Button'
import type { UpdateProtocolInput, Protocol } from '@/types/protocol'

export default function EditProtocolPage() {
  const router = useRouter()
  const params = useParams()
  const protocolId = params.id as string

  const { protocol, isLoading, error, refetch } = useProtocol(protocolId)
  const { updateProtocol } = useProtocolMutations()

  const handleSubmit = async (data: UpdateProtocolInput) => {
    try {
      await updateProtocol(protocolId, data)
      toast.success('Protocol updated successfully')
      router.push(`/protocols/${protocolId}`)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to update protocol')
    }
  }

  const handleCancel = () => {
    router.back()
  }

  if (isLoading) {
    return (
      <div className="p-6 max-w-3xl mx-auto">
        <div className="flex items-center justify-center h-64">
          <Spinner size="lg" className="text-brand-blue" />
        </div>
      </div>
    )
  }

  if (error || !protocol) {
    return (
      <div className="p-6 max-w-3xl mx-auto">
        <div className="bg-red-50 rounded-2xl p-6 text-center">
          <p className="text-red-600 mb-4">
            {error?.message || 'Protocol not found'}
          </p>
          <Button variant="secondary" onClick={() => refetch()}>
            Try Again
          </Button>
        </div>
      </div>
    )
  }

  // Convert Protocol to plain object for form
  const protocolForForm: Protocol = {
    ...protocol,
    createdAt: protocol.createdAt,
    updatedAt: protocol.updatedAt,
  }

  return (
    <div className="p-6 max-w-3xl mx-auto">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-4xl font-bold tracking-[-0.05em] text-neutral-900">Edit Protocol</h1>
        <p className="text-neutral-500 mt-1">Update protocol details</p>
      </div>

      {/* Form */}
      <div className="bg-neutral-50 rounded-2xl p-6">
        <ProtocolForm
          protocol={protocolForForm}
          onSubmit={handleSubmit}
          onCancel={handleCancel}
        />
      </div>
    </div>
  )
}
