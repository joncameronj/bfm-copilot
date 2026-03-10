'use client'

import { useState, useEffect } from 'react'
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { AlertMessage } from '@/components/ui/AlertMessage'
import { cn } from '@/lib/utils'
import { HugeiconsIcon } from '@hugeicons/react'
import { TestTubeIcon, StarIcon, File01Icon, Delete02Icon, ArrowDown01Icon } from '@hugeicons/core-free-icons'
import type { UserPreferences } from '@/types/settings'

interface MemberSettingsSectionProps {
  preferences: UserPreferences | null
}

type MemberTab = 'preferences' | 'lab-values' | 'suggestions' | 'documents'

interface ToggleProps {
  label: string
  description: string
  checked: boolean
  onChange: (checked: boolean) => void
}

function Toggle({ label, description, checked, onChange }: ToggleProps) {
  return (
    <div className="flex items-center justify-between py-3">
      <div>
        <p className="font-medium text-neutral-900">{label}</p>
        <p className="text-sm text-neutral-500">{description}</p>
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        className={cn(
          'relative inline-flex h-6 w-11 items-center rounded-full transition-colors',
          checked ? 'bg-brand-blue' : 'bg-neutral-200'
        )}
      >
        <span
          className={cn(
            'inline-block h-4 w-4 transform rounded-full bg-white transition-transform',
            checked ? 'translate-x-6' : 'translate-x-1'
          )}
        />
      </button>
    </div>
  )
}

// Sub-component for Lab Values
function LabValuesTab() {
  const [labValues, setLabValues] = useState<Array<{
    id: string
    marker_name: string
    value: number
    unit: string
    recorded_at: string
  }>>([])
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    async function fetchLabValues() {
      try {
        const res = await fetch('/api/member/lab-values')
        if (res.ok) {
          const data = await res.json()
          setLabValues(data.labValues || [])
        }
      } catch (error) {
        console.error('Failed to fetch lab values:', error)
      } finally {
        setIsLoading(false)
      }
    }
    fetchLabValues()
  }, [])

  if (isLoading) {
    return (
      <div className="space-y-3">
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-16 bg-neutral-100 rounded-xl animate-pulse" />
        ))}
      </div>
    )
  }

  if (labValues.length === 0) {
    return (
      <div className="text-center py-8">
        <HugeiconsIcon icon={TestTubeIcon} size={32} className="text-neutral-300 mx-auto mb-3" />
        <p className="text-neutral-600 font-medium">No lab values recorded</p>
        <p className="text-sm text-neutral-400 mt-1">
          Your self-tracked lab values will appear here
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      {labValues.map((lv) => (
        <div
          key={lv.id}
          className="flex items-center justify-between p-4 bg-neutral-50 rounded-xl"
        >
          <div>
            <p className="font-medium text-neutral-900">{lv.marker_name}</p>
            <p className="text-sm text-neutral-500">
              {new Date(lv.recorded_at).toLocaleDateString()}
            </p>
          </div>
          <div className="text-right">
            <p className="font-mono font-medium text-neutral-900">
              {lv.value} {lv.unit}
            </p>
          </div>
        </div>
      ))}
    </div>
  )
}

// Sub-component for Suggestion History
function SuggestionsTab() {
  const [suggestions, setSuggestions] = useState<Array<{
    id: string
    content: string
    category: string
    status: string
    created_at: string
  }>>([])
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    async function fetchSuggestions() {
      try {
        const res = await fetch('/api/suggestions?limit=20')
        if (res.ok) {
          const data = await res.json()
          setSuggestions(data.suggestions || [])
        }
      } catch (error) {
        console.error('Failed to fetch suggestions:', error)
      } finally {
        setIsLoading(false)
      }
    }
    fetchSuggestions()
  }, [])

  const statusColors: Record<string, string> = {
    pending: 'bg-yellow-50 text-yellow-700',
    accepted: 'bg-green-50 text-green-700',
    rejected: 'bg-red-50 text-red-700',
  }

  if (isLoading) {
    return (
      <div className="space-y-3">
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-20 bg-neutral-100 rounded-xl animate-pulse" />
        ))}
      </div>
    )
  }

  if (suggestions.length === 0) {
    return (
      <div className="text-center py-8">
        <HugeiconsIcon icon={StarIcon} size={32} className="text-neutral-300 mx-auto mb-3" />
        <p className="text-neutral-600 font-medium">No suggestions yet</p>
        <p className="text-sm text-neutral-400 mt-1">
          Chat with Copilot to receive personalized suggestions
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      {suggestions.map((s) => (
        <div
          key={s.id}
          className="p-4 bg-neutral-50 rounded-xl"
        >
          <div className="flex items-start justify-between mb-2">
            <span className={cn('px-2 py-0.5 text-xs font-medium rounded-full', statusColors[s.status] || 'bg-neutral-100 text-neutral-600')}>
              {s.status}
            </span>
            <span className="text-xs text-neutral-400">
              {new Date(s.created_at).toLocaleDateString()}
            </span>
          </div>
          <p className="text-sm text-neutral-700 line-clamp-2">{s.content}</p>
          {s.category && (
            <p className="text-xs text-neutral-500 mt-2 capitalize">{s.category}</p>
          )}
        </div>
      ))}
    </div>
  )
}

// Sub-component for Documents
function DocumentsTab() {
  const [documents, setDocuments] = useState<Array<{
    id: string
    name: string
    type: string
    size: number
    created_at: string
  }>>([])
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    async function fetchDocuments() {
      try {
        const res = await fetch('/api/member/documents')
        if (res.ok) {
          const data = await res.json()
          setDocuments(data.documents || [])
        }
      } catch (error) {
        console.error('Failed to fetch documents:', error)
      } finally {
        setIsLoading(false)
      }
    }
    fetchDocuments()
  }, [])

  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return '0 B'
    const k = 1024
    const sizes = ['B', 'KB', 'MB', 'GB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i]
  }

  async function handleDelete(id: string) {
    if (!confirm('Are you sure you want to delete this document?')) return

    try {
      const res = await fetch(`/api/member/documents/${id}`, { method: 'DELETE' })
      if (res.ok) {
        setDocuments((prev) => prev.filter((d) => d.id !== id))
      }
    } catch (error) {
      console.error('Failed to delete document:', error)
    }
  }

  if (isLoading) {
    return (
      <div className="space-y-3">
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-16 bg-neutral-100 rounded-xl animate-pulse" />
        ))}
      </div>
    )
  }

  if (documents.length === 0) {
    return (
      <div className="text-center py-8">
        <HugeiconsIcon icon={File01Icon} size={32} className="text-neutral-300 mx-auto mb-3" />
        <p className="text-neutral-600 font-medium">No documents uploaded</p>
        <p className="text-sm text-neutral-400 mt-1">
          Upload health documents to share with your practitioner
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      {documents.map((doc) => (
        <div
          key={doc.id}
          className="flex items-center justify-between p-4 bg-neutral-50 rounded-xl"
        >
          <div className="flex items-center gap-3">
            <HugeiconsIcon icon={File01Icon} size={20} className="text-neutral-400" />
            <div>
              <p className="font-medium text-neutral-900">{doc.name}</p>
              <p className="text-xs text-neutral-500">
                {formatFileSize(doc.size)} &bull; {new Date(doc.created_at).toLocaleDateString()}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => window.open(`/api/member/documents/${doc.id}/download`, '_blank')}
            >
              <HugeiconsIcon icon={ArrowDown01Icon} size={16} />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => handleDelete(doc.id)}
              className="text-red-500 hover:text-red-600 hover:bg-red-50"
            >
              <HugeiconsIcon icon={Delete02Icon} size={16} />
            </Button>
          </div>
        </div>
      ))}
    </div>
  )
}

// Preferences Tab (original content)
function PreferencesTab({ preferences, onSave }: { preferences: UserPreferences | null; onSave: () => void }) {
  const [settings, setSettings] = useState({
    healthReminderFrequency: preferences?.health_reminder_frequency ?? 'weekly',
    shareProgressWithPractitioner: preferences?.share_progress_with_practitioner ?? true,
  })
  const [isLoading, setIsLoading] = useState(false)
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  async function handleSave() {
    setIsLoading(true)
    setMessage(null)

    try {
      const res = await fetch('/api/settings/preferences', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          health_reminder_frequency: settings.healthReminderFrequency,
          share_progress_with_practitioner: settings.shareProgressWithPractitioner,
        }),
      })

      if (!res.ok) {
        throw new Error('Failed to save preferences')
      }

      setMessage({ type: 'success', text: 'Preferences saved successfully' })
      onSave()
    } catch {
      setMessage({ type: 'error', text: 'Failed to save preferences' })
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="space-y-4">
      <div>
        <label className="block text-sm font-medium text-neutral-700 mb-2">
          Health Reminder Frequency
        </label>
        <select
          value={settings.healthReminderFrequency}
          onChange={(e) =>
            setSettings((s) => ({
              ...s,
              healthReminderFrequency: e.target.value as 'daily' | 'weekly' | 'monthly' | 'never',
            }))
          }
          className="bg-neutral-100 text-neutral-900 rounded-xl px-4 py-3 w-full focus:outline-none focus:ring-2 focus:ring-brand-blue/20"
        >
          <option value="daily">Daily</option>
          <option value="weekly">Weekly</option>
          <option value="monthly">Monthly</option>
          <option value="never">Never</option>
        </select>
      </div>

      <div className="divide-y divide-neutral-100">
        <Toggle
          label="Share Progress with Practitioner"
          description="Allow your practitioner to view your health progress"
          checked={settings.shareProgressWithPractitioner}
          onChange={(checked) =>
            setSettings((s) => ({ ...s, shareProgressWithPractitioner: checked }))
          }
        />
      </div>

      {message && (
        <AlertMessage variant={message.type === 'success' ? 'success' : 'error'}>
          {message.text}
        </AlertMessage>
      )}

      <div className="flex justify-end pt-4">
        <Button size="sm" onClick={handleSave} isLoading={isLoading}>
          Save Preferences
        </Button>
      </div>
    </div>
  )
}

export function MemberSettingsSection({ preferences }: MemberSettingsSectionProps) {
  const [activeTab, setActiveTab] = useState<MemberTab>('preferences')

  const tabs: { id: MemberTab; label: string; icon: typeof TestTubeIcon }[] = [
    { id: 'preferences', label: 'Preferences', icon: StarIcon },
    { id: 'lab-values', label: 'Lab Values', icon: TestTubeIcon },
    { id: 'suggestions', label: 'Suggestions', icon: StarIcon },
    { id: 'documents', label: 'Documents', icon: File01Icon },
  ]

  return (
    <Card>
      <CardHeader>
        <CardTitle>Health Preferences</CardTitle>
        <CardDescription>Manage your health tracking and personal data</CardDescription>
      </CardHeader>
      <CardContent>
        {/* Sub-tabs */}
        <div className="flex gap-1 mb-6 p-1 bg-neutral-100 rounded-xl">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={cn(
                'flex-1 flex items-center justify-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-colors',
                activeTab === tab.id
                  ? 'bg-white text-neutral-900 shadow-sm'
                  : 'text-neutral-600 hover:text-neutral-900'
              )}
            >
              <HugeiconsIcon icon={tab.icon} size={16} />
              {tab.label}
            </button>
          ))}
        </div>

        {/* Tab content */}
        {activeTab === 'preferences' && <PreferencesTab preferences={preferences} onSave={() => {}} />}
        {activeTab === 'lab-values' && <LabValuesTab />}
        {activeTab === 'suggestions' && <SuggestionsTab />}
        {activeTab === 'documents' && <DocumentsTab />}
      </CardContent>
    </Card>
  )
}
