'use client'

import { useState, useEffect } from 'react'
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { AlertMessage } from '@/components/ui/AlertMessage'
import { cn } from '@/lib/utils'
import { HugeiconsIcon } from '@hugeicons/react'
import { Settings01Icon, File01Icon, ThumbsUpIcon, StethoscopeIcon, Delete02Icon, Add01Icon } from '@hugeicons/core-free-icons'
import type { UserPreferences } from '@/types/settings'

interface PractitionerSettingsSectionProps {
  preferences: UserPreferences | null
}

type PractitionerTab = 'settings' | 'practice-info' | 'protocol-templates' | 'feedback-templates'

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

// Practice Info Tab
function PracticeInfoTab() {
  const [practiceInfo, setPracticeInfo] = useState({
    practiceName: '',
    specialty: '',
    phone: '',
    address: '',
    website: '',
  })
  const [isLoading, setIsLoading] = useState(false)
  const [isFetching, setIsFetching] = useState(true)
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  useEffect(() => {
    async function fetchPracticeInfo() {
      try {
        const res = await fetch('/api/practitioner/practice-info')
        if (res.ok) {
          const data = await res.json()
          if (data.practiceInfo) {
            setPracticeInfo({
              practiceName: data.practiceInfo.practice_name || '',
              specialty: data.practiceInfo.specialty || '',
              phone: data.practiceInfo.phone || '',
              address: data.practiceInfo.address || '',
              website: data.practiceInfo.website || '',
            })
          }
        }
      } catch (error) {
        console.error('Failed to fetch practice info:', error)
      } finally {
        setIsFetching(false)
      }
    }
    fetchPracticeInfo()
  }, [])

  async function handleSave() {
    setIsLoading(true)
    setMessage(null)

    try {
      const res = await fetch('/api/practitioner/practice-info', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          practice_name: practiceInfo.practiceName,
          specialty: practiceInfo.specialty,
          phone: practiceInfo.phone,
          address: practiceInfo.address,
          website: practiceInfo.website,
        }),
      })

      if (!res.ok) throw new Error('Failed to save')
      setMessage({ type: 'success', text: 'Practice info saved successfully' })
    } catch {
      setMessage({ type: 'error', text: 'Failed to save practice info' })
    } finally {
      setIsLoading(false)
    }
  }

  if (isFetching) {
    return <div className="h-64 bg-neutral-100 rounded-xl animate-pulse" />
  }

  return (
    <div className="space-y-4">
      <Input
        label="Practice Name"
        value={practiceInfo.practiceName}
        onChange={(e) => setPracticeInfo((s) => ({ ...s, practiceName: e.target.value }))}
        placeholder="Enter your practice name"
      />
      <Input
        label="Specialty"
        value={practiceInfo.specialty}
        onChange={(e) => setPracticeInfo((s) => ({ ...s, specialty: e.target.value }))}
        placeholder="e.g., Functional Medicine, Naturopathic"
      />
      <Input
        label="Phone"
        type="tel"
        value={practiceInfo.phone}
        onChange={(e) => setPracticeInfo((s) => ({ ...s, phone: e.target.value }))}
        placeholder="(555) 123-4567"
      />
      <Input
        label="Address"
        value={practiceInfo.address}
        onChange={(e) => setPracticeInfo((s) => ({ ...s, address: e.target.value }))}
        placeholder="123 Main St, City, State ZIP"
      />
      <Input
        label="Website"
        type="url"
        value={practiceInfo.website}
        onChange={(e) => setPracticeInfo((s) => ({ ...s, website: e.target.value }))}
        placeholder="https://yourpractice.com"
      />

      {message && (
        <AlertMessage variant={message.type === 'success' ? 'success' : 'error'}>
          {message.text}
        </AlertMessage>
      )}

      <div className="flex justify-end pt-4">
        <Button onClick={handleSave} size="sm" isLoading={isLoading}>Save Practice Info</Button>
      </div>
    </div>
  )
}

// Protocol Templates Tab
function ProtocolTemplatesTab() {
  const [templates, setTemplates] = useState<Array<{
    id: string
    name: string
    category: string
    content: string
    created_at: string
  }>>([])
  const [isLoading, setIsLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [newTemplate, setNewTemplate] = useState({ name: '', category: '', content: '' })
  const [isSaving, setIsSaving] = useState(false)

  useEffect(() => {
    async function fetchTemplates() {
      try {
        const res = await fetch('/api/practitioner/protocol-templates')
        if (res.ok) {
          const data = await res.json()
          setTemplates(data.templates || [])
        }
      } catch (error) {
        console.error('Failed to fetch templates:', error)
      } finally {
        setIsLoading(false)
      }
    }
    fetchTemplates()
  }, [])

  async function handleCreate() {
    if (!newTemplate.name || !newTemplate.content) return

    setIsSaving(true)
    try {
      const res = await fetch('/api/practitioner/protocol-templates', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newTemplate),
      })

      if (res.ok) {
        const data = await res.json()
        setTemplates((prev) => [data.template, ...prev])
        setNewTemplate({ name: '', category: '', content: '' })
        setShowForm(false)
      }
    } catch (error) {
      console.error('Failed to create template:', error)
    } finally {
      setIsSaving(false)
    }
  }

  async function handleDelete(id: string) {
    if (!confirm('Delete this template?')) return

    try {
      const res = await fetch(`/api/practitioner/protocol-templates/${id}`, { method: 'DELETE' })
      if (res.ok) {
        setTemplates((prev) => prev.filter((t) => t.id !== id))
      }
    } catch (error) {
      console.error('Failed to delete template:', error)
    }
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

  return (
    <div className="space-y-4">
      {!showForm ? (
        <Button variant="secondary" onClick={() => setShowForm(true)} className="w-full">
          <HugeiconsIcon icon={Add01Icon} size={16} className="mr-2" />
          Add Protocol Template
        </Button>
      ) : (
        <div className="p-4 bg-neutral-50 rounded-xl space-y-3">
          <Input
            label="Template Name"
            value={newTemplate.name}
            onChange={(e) => setNewTemplate((s) => ({ ...s, name: e.target.value }))}
            placeholder="e.g., Gut Healing Protocol"
          />
          <div>
            <label className="block text-sm font-medium text-neutral-700 mb-2">Category</label>
            <select
              value={newTemplate.category}
              onChange={(e) => setNewTemplate((s) => ({ ...s, category: e.target.value }))}
              className="bg-neutral-100 text-neutral-900 rounded-xl px-4 py-3 w-full focus:outline-none focus:ring-2 focus:ring-brand-blue/20"
            >
              <option value="">Select category</option>
              <option value="gut-health">Gut Health</option>
              <option value="hormones">Hormones</option>
              <option value="detox">Detox</option>
              <option value="immune">Immune Support</option>
              <option value="metabolic">Metabolic</option>
              <option value="other">Other</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-neutral-700 mb-2">Protocol Content</label>
            <textarea
              value={newTemplate.content}
              onChange={(e) => setNewTemplate((s) => ({ ...s, content: e.target.value }))}
              placeholder="Enter the protocol details..."
              rows={6}
              className="bg-neutral-100 text-neutral-900 rounded-xl px-4 py-3 w-full focus:outline-none focus:ring-2 focus:ring-brand-blue/20 resize-none"
            />
          </div>
          <div className="flex gap-2 justify-end">
            <Button variant="secondary" size="sm" onClick={() => setShowForm(false)}>Cancel</Button>
            <Button size="sm" onClick={handleCreate} isLoading={isSaving}>Save Template</Button>
          </div>
        </div>
      )}

      {templates.length === 0 && !showForm ? (
        <div className="text-center py-8">
          <HugeiconsIcon icon={File01Icon} size={32} className="text-neutral-300 mx-auto mb-3" />
          <p className="text-neutral-600 font-medium">No protocol templates</p>
          <p className="text-sm text-neutral-400 mt-1">
            Create templates to quickly generate protocols for patients
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {templates.map((template) => (
            <div key={template.id} className="p-4 bg-neutral-50 rounded-xl">
              <div className="flex items-start justify-between">
                <div>
                  <p className="font-medium text-neutral-900">{template.name}</p>
                  {template.category && (
                    <span className="text-xs bg-neutral-200 text-neutral-600 px-2 py-0.5 rounded-full capitalize">
                      {template.category.replace('-', ' ')}
                    </span>
                  )}
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => handleDelete(template.id)}
                  className="text-red-500 hover:text-red-600 hover:bg-red-50"
                >
                  <HugeiconsIcon icon={Delete02Icon} size={16} />
                </Button>
              </div>
              <p className="text-sm text-neutral-500 mt-2 line-clamp-2">{template.content}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// Feedback Templates Tab
function FeedbackTemplatesTab() {
  const [templates, setTemplates] = useState<Array<{
    id: string
    name: string
    type: string
    content: string
    created_at: string
  }>>([])
  const [isLoading, setIsLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [newTemplate, setNewTemplate] = useState({ name: '', type: 'positive', content: '' })
  const [isSaving, setIsSaving] = useState(false)

  useEffect(() => {
    async function fetchTemplates() {
      try {
        const res = await fetch('/api/practitioner/feedback-templates')
        if (res.ok) {
          const data = await res.json()
          setTemplates(data.templates || [])
        }
      } catch (error) {
        console.error('Failed to fetch templates:', error)
      } finally {
        setIsLoading(false)
      }
    }
    fetchTemplates()
  }, [])

  async function handleCreate() {
    if (!newTemplate.name || !newTemplate.content) return

    setIsSaving(true)
    try {
      const res = await fetch('/api/practitioner/feedback-templates', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newTemplate),
      })

      if (res.ok) {
        const data = await res.json()
        setTemplates((prev) => [data.template, ...prev])
        setNewTemplate({ name: '', type: 'positive', content: '' })
        setShowForm(false)
      }
    } catch (error) {
      console.error('Failed to create template:', error)
    } finally {
      setIsSaving(false)
    }
  }

  async function handleDelete(id: string) {
    if (!confirm('Delete this template?')) return

    try {
      const res = await fetch(`/api/practitioner/feedback-templates/${id}`, { method: 'DELETE' })
      if (res.ok) {
        setTemplates((prev) => prev.filter((t) => t.id !== id))
      }
    } catch (error) {
      console.error('Failed to delete template:', error)
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

  return (
    <div className="space-y-4">
      {!showForm ? (
        <Button variant="secondary" onClick={() => setShowForm(true)} className="w-full">
          <HugeiconsIcon icon={Add01Icon} size={16} className="mr-2" />
          Add Feedback Template
        </Button>
      ) : (
        <div className="p-4 bg-neutral-50 rounded-xl space-y-3">
          <Input
            label="Template Name"
            value={newTemplate.name}
            onChange={(e) => setNewTemplate((s) => ({ ...s, name: e.target.value }))}
            placeholder="e.g., Patient Improvement Response"
          />
          <div>
            <label className="block text-sm font-medium text-neutral-700 mb-2">Feedback Type</label>
            <select
              value={newTemplate.type}
              onChange={(e) => setNewTemplate((s) => ({ ...s, type: e.target.value }))}
              className="bg-neutral-100 text-neutral-900 rounded-xl px-4 py-3 w-full focus:outline-none focus:ring-2 focus:ring-brand-blue/20"
            >
              <option value="positive">Positive Outcome</option>
              <option value="negative">Needs Adjustment</option>
              <option value="neutral">Neutral/Monitoring</option>
              <option value="partial">Partial Success</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-neutral-700 mb-2">Template Content</label>
            <textarea
              value={newTemplate.content}
              onChange={(e) => setNewTemplate((s) => ({ ...s, content: e.target.value }))}
              placeholder="Enter your feedback template..."
              rows={4}
              className="bg-neutral-100 text-neutral-900 rounded-xl px-4 py-3 w-full focus:outline-none focus:ring-2 focus:ring-brand-blue/20 resize-none"
            />
          </div>
          <div className="flex gap-2 justify-end">
            <Button variant="secondary" size="sm" onClick={() => setShowForm(false)}>Cancel</Button>
            <Button size="sm" onClick={handleCreate} isLoading={isSaving}>Save Template</Button>
          </div>
        </div>
      )}

      {templates.length === 0 && !showForm ? (
        <div className="text-center py-8">
          <HugeiconsIcon icon={ThumbsUpIcon} size={32} className="text-neutral-300 mx-auto mb-3" />
          <p className="text-neutral-600 font-medium">No feedback templates</p>
          <p className="text-sm text-neutral-400 mt-1">
            Create templates for quick feedback responses
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {templates.map((template) => (
            <div key={template.id} className="flex items-center justify-between p-4 bg-neutral-50 rounded-xl">
              <div className="flex-1">
                <p className="font-medium text-neutral-900">{template.name}</p>
                <div className="flex items-center gap-2 mt-1">
                  <span className={cn(
                    'text-xs px-2 py-0.5 rounded-full capitalize',
                    template.type === 'positive' ? 'bg-green-100 text-green-700' :
                    template.type === 'negative' ? 'bg-red-100 text-red-700' :
                    template.type === 'partial' ? 'bg-yellow-100 text-yellow-700' :
                    'bg-neutral-200 text-neutral-600'
                  )}>
                    {template.type}
                  </span>
                </div>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => handleDelete(template.id)}
                className="text-red-500 hover:text-red-600 hover:bg-red-50"
              >
                <HugeiconsIcon icon={Delete02Icon} size={16} />
              </Button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// Settings Tab (original content)
function SettingsTab({ preferences, onSave }: { preferences: UserPreferences | null; onSave: () => void }) {
  const [settings, setSettings] = useState({
    defaultPatientView: preferences?.default_patient_view ?? 'list',
    autoSaveNotes: preferences?.auto_save_notes ?? true,
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
          default_patient_view: settings.defaultPatientView,
          auto_save_notes: settings.autoSaveNotes,
        }),
      })

      if (!res.ok) throw new Error('Failed to save settings')
      setMessage({ type: 'success', text: 'Settings saved successfully' })
      onSave()
    } catch {
      setMessage({ type: 'error', text: 'Failed to save settings' })
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="space-y-4">
      <div>
        <label className="block text-sm font-medium text-neutral-700 mb-2">Default Patient View</label>
        <select
          value={settings.defaultPatientView}
          onChange={(e) => setSettings((s) => ({ ...s, defaultPatientView: e.target.value as 'list' | 'grid' }))}
          className="bg-neutral-100 text-neutral-900 rounded-xl px-4 py-3 w-full focus:outline-none focus:ring-2 focus:ring-brand-blue/20"
        >
          <option value="list">List View</option>
          <option value="grid">Grid View</option>
        </select>
      </div>

      <div className="divide-y divide-neutral-100">
        <Toggle
          label="Auto-save Notes"
          description="Automatically save notes while typing"
          checked={settings.autoSaveNotes}
          onChange={(checked) => setSettings((s) => ({ ...s, autoSaveNotes: checked }))}
        />
      </div>

      {message && (
        <AlertMessage variant={message.type === 'success' ? 'success' : 'error'}>
          {message.text}
        </AlertMessage>
      )}

      <div className="flex justify-end pt-4">
        <Button size="sm" onClick={handleSave} isLoading={isLoading}>Save Settings</Button>
      </div>
    </div>
  )
}

export function PractitionerSettingsSection({ preferences }: PractitionerSettingsSectionProps) {
  const [activeTab, setActiveTab] = useState<PractitionerTab>('settings')

  const tabs: { id: PractitionerTab; label: string; icon: typeof Settings01Icon }[] = [
    { id: 'settings', label: 'Settings', icon: Settings01Icon },
    { id: 'practice-info', label: 'Practice', icon: StethoscopeIcon },
    { id: 'protocol-templates', label: 'Protocols', icon: File01Icon },
    { id: 'feedback-templates', label: 'Feedback', icon: ThumbsUpIcon },
  ]

  return (
    <Card>
      <CardHeader>
        <CardTitle>Practice Settings</CardTitle>
        <CardDescription>Customize your practice workflow and templates</CardDescription>
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
        {activeTab === 'settings' && <SettingsTab preferences={preferences} onSave={() => {}} />}
        {activeTab === 'practice-info' && <PracticeInfoTab />}
        {activeTab === 'protocol-templates' && <ProtocolTemplatesTab />}
        {activeTab === 'feedback-templates' && <FeedbackTemplatesTab />}
      </CardContent>
    </Card>
  )
}
