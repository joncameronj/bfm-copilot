'use client'

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Select } from '@/components/ui/Select'
import { Textarea } from '@/components/ui/Textarea'
import { DatePicker } from '@/components/ui/DatePicker'
import { Modal } from '@/components/ui/Modal'
import { Badge } from '@/components/ui/Badge'
import { useFrequencies } from '@/hooks/useFrequencies'
import { useTreatmentSessionMutations } from '@/hooks/useTreatmentSessions'
import { useProtocols } from '@/hooks/useProtocols'
import { format } from 'date-fns'
import { toast } from 'react-hot-toast'
import { HugeiconsIcon } from '@hugeicons/react'
import { Cancel01Icon, Tick02Icon } from '@hugeicons/core-free-icons'
import type {
  TreatmentSessionWithDetails,
  TreatmentEffect,
  FrequencyUsed,
  FSMFrequency,
} from '@/types/treatment'

interface SessionModalProps {
  patientId: string
  session?: TreatmentSessionWithDetails
  onClose: () => void
  onSuccess: () => void
}

export function SessionModal({ patientId, session, onClose, onSuccess }: SessionModalProps) {
  const isEditing = !!session
  const { frequencies, categories, isLoading: loadingFrequencies } = useFrequencies()
  const { protocols, isLoading: loadingProtocols } = useProtocols({ patientId })
  const { createSession, updateSession, isLoading } = useTreatmentSessionMutations()

  const [formData, setFormData] = useState({
    sessionDate: session?.sessionDate || format(new Date(), 'yyyy-MM-dd'),
    sessionTime: session?.sessionTime || '',
    protocolId: session?.protocolId || '',
    effect: session?.effect || ('positive' as TreatmentEffect),
    notes: session?.notes || '',
  })

  const [selectedFrequencies, setSelectedFrequencies] = useState<FrequencyUsed[]>(
    session?.frequenciesUsed || []
  )
  const [categoryFilter, setCategoryFilter] = useState('all')
  const [searchTerm, setSearchTerm] = useState('')

  // Filter frequencies
  const filteredFrequencies = frequencies.filter((f) => {
    const matchesCategory = categoryFilter === 'all' || f.category === categoryFilter
    const matchesSearch = !searchTerm ||
      f.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      f.condition?.toLowerCase().includes(searchTerm.toLowerCase())
    return matchesCategory && matchesSearch
  })

  const toggleFrequency = (freq: FSMFrequency) => {
    setSelectedFrequencies((prev) => {
      const exists = prev.some((f) => f.id === freq.id)
      if (exists) {
        return prev.filter((f) => f.id !== freq.id)
      }
      return [...prev, {
        id: freq.id,
        name: freq.name,
        frequencyA: freq.frequencyA,
        frequencyB: freq.frequencyB || undefined,
      }]
    })
  }

  const isSelected = (freqId: string) => selectedFrequencies.some((f) => f.id === freqId)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    try {
      if (isEditing && session) {
        await updateSession(patientId, session.id, {
          ...formData,
          protocolId: formData.protocolId || undefined,
          frequenciesUsed: selectedFrequencies,
        })
        toast.success('Session updated')
      } else {
        await createSession(patientId, {
          ...formData,
          patientId,
          protocolId: formData.protocolId || undefined,
          frequenciesUsed: selectedFrequencies,
        })
        toast.success('Session logged')
      }
      onSuccess()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to save session')
    }
  }

  return (
    <Modal
      isOpen={true}
      onClose={onClose}
      title={isEditing ? 'Edit Treatment Session' : 'Log Treatment Session'}
      size="lg"
    >
      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Date & Time */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-neutral-700 mb-2">
              Session Date *
            </label>
            <DatePicker
              value={formData.sessionDate ? new Date(formData.sessionDate) : null}
              onChange={(date) => setFormData({
                ...formData,
                sessionDate: date ? format(date, 'yyyy-MM-dd') : '',
              })}
              maxDate={new Date()}
            />
          </div>
          <Input
            label="Session Time"
            type="time"
            value={formData.sessionTime}
            onChange={(e) => setFormData({ ...formData, sessionTime: e.target.value })}
          />
        </div>

        {/* Protocol */}
        <Select
          label="Protocol (optional)"
          value={formData.protocolId}
          onChange={(e) => setFormData({ ...formData, protocolId: e.target.value })}
          disabled={loadingProtocols}
        >
          <option value="">No protocol linked</option>
          {protocols.map((p) => (
            <option key={p.id} value={p.id}>{p.title}</option>
          ))}
        </Select>

        {/* Frequencies Selection */}
        <div>
          <label className="block text-sm font-medium text-neutral-700 mb-2">
            Frequencies Used
          </label>

          {/* Selected frequencies */}
          {selectedFrequencies.length > 0 && (
            <div className="flex flex-wrap gap-2 mb-3">
              {selectedFrequencies.map((freq) => (
                <Badge
                  key={freq.id}
                  variant="info"
                  size="md"
                  className="cursor-pointer"
                  onClick={() => toggleFrequency(freq as unknown as FSMFrequency)}
                >
                  {freq.name} ({freq.frequencyA}Hz)
                  <HugeiconsIcon icon={Cancel01Icon} size={12} className="ml-1" />
                </Badge>
              ))}
            </div>
          )}

          {/* Frequency picker */}
          <div className="border border-neutral-200 rounded-lg p-3 max-h-48 overflow-y-auto">
            <div className="flex gap-2 mb-3">
              <Input
                placeholder="Search frequencies..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="flex-1"
              />
              <Select
                value={categoryFilter}
                onChange={(e) => setCategoryFilter(e.target.value)}
                className="w-36"
              >
                <option value="all">All Categories</option>
                {categories.map((cat) => (
                  <option key={cat} value={cat}>{cat}</option>
                ))}
              </Select>
            </div>

            {loadingFrequencies ? (
              <p className="text-neutral-500 text-sm text-center py-2">Loading...</p>
            ) : filteredFrequencies.length === 0 ? (
              <p className="text-neutral-500 text-sm text-center py-2">No frequencies found</p>
            ) : (
              <div className="space-y-1">
                {filteredFrequencies.map((freq) => (
                  <button
                    key={freq.id}
                    type="button"
                    onClick={() => toggleFrequency(freq)}
                    className={`w-full text-left px-3 py-2 rounded-lg text-sm transition-colors flex items-center justify-between ${
                      isSelected(freq.id)
                        ? 'bg-green-50 text-green-700 border border-green-200'
                        : 'hover:bg-neutral-50'
                    }`}
                  >
                    <div>
                      <span className="font-medium">{freq.name}</span>
                      <span className="text-neutral-500 ml-2">
                        {freq.frequencyA}Hz{freq.frequencyB ? ` / ${freq.frequencyB}Hz` : ''}
                      </span>
                      {freq.condition && (
                        <span className="text-neutral-400 ml-2">• {freq.condition}</span>
                      )}
                    </div>
                    {isSelected(freq.id) && (
                      <HugeiconsIcon icon={Tick02Icon} size={16} className="text-green-600" />
                    )}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Effect */}
        <div>
          <label className="block text-sm font-medium text-neutral-700 mb-2">
            Session Effect *
          </label>
          <div className="flex gap-3">
            {(['positive', 'negative', 'nil'] as TreatmentEffect[]).map((effect) => (
              <button
                key={effect}
                type="button"
                onClick={() => setFormData({ ...formData, effect })}
                className={`flex-1 py-3 px-4 rounded-lg border-2 transition-colors font-medium ${
                  formData.effect === effect
                    ? effect === 'positive'
                      ? 'border-green-500 bg-green-50 text-green-700'
                      : effect === 'negative'
                      ? 'border-red-500 bg-red-50 text-red-700'
                      : 'border-neutral-500 bg-neutral-100 text-neutral-700'
                    : 'border-neutral-200 hover:border-neutral-300'
                }`}
              >
                {effect === 'positive' ? 'Positive' : effect === 'negative' ? 'Negative' : 'No Effect'}
              </button>
            ))}
          </div>
        </div>

        {/* Notes */}
        <Textarea
          label="Notes"
          value={formData.notes}
          onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
          rows={4}
          placeholder="Document observations, patient response, adjustments made..."
        />

        {/* Actions */}
        <div className="flex justify-end gap-3 pt-4">
          <Button type="button" variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" isLoading={isLoading}>
            {isEditing ? 'Update Session' : 'Log Session'}
          </Button>
        </div>
      </form>
    </Modal>
  )
}
