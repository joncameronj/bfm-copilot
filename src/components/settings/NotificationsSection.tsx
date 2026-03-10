'use client'

import { useState } from 'react'
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { AlertMessage } from '@/components/ui/AlertMessage'
import { cn } from '@/lib/utils'
import type { UserPreferences } from '@/types/settings'

interface NotificationsSectionProps {
  preferences: UserPreferences | null
}

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

export function NotificationsSection({ preferences }: NotificationsSectionProps) {
  const [settings, setSettings] = useState({
    emailLabResults: preferences?.email_lab_results ?? true,
    emailProtocolUpdates: preferences?.email_protocol_updates ?? true,
    emailSystemAnnouncements: preferences?.email_system_announcements ?? true,
    emailWeeklyDigest: preferences?.email_weekly_digest ?? false,
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
          email_lab_results: settings.emailLabResults,
          email_protocol_updates: settings.emailProtocolUpdates,
          email_system_announcements: settings.emailSystemAnnouncements,
          email_weekly_digest: settings.emailWeeklyDigest,
        }),
      })

      if (!res.ok) {
        throw new Error('Failed to save preferences')
      }

      setMessage({ type: 'success', text: 'Preferences saved successfully' })
    } catch {
      setMessage({ type: 'error', text: 'Failed to save preferences' })
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Email Notifications</CardTitle>
        <CardDescription>Choose what emails you want to receive</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="divide-y divide-neutral-100">
          <Toggle
            label="Lab Results"
            description="Get notified when new lab results are available"
            checked={settings.emailLabResults}
            onChange={(checked) => setSettings((s) => ({ ...s, emailLabResults: checked }))}
          />
          <Toggle
            label="Protocol Updates"
            description="Receive updates about your treatment protocols"
            checked={settings.emailProtocolUpdates}
            onChange={(checked) => setSettings((s) => ({ ...s, emailProtocolUpdates: checked }))}
          />
          <Toggle
            label="System Announcements"
            description="Important updates about the platform"
            checked={settings.emailSystemAnnouncements}
            onChange={(checked) =>
              setSettings((s) => ({ ...s, emailSystemAnnouncements: checked }))
            }
          />
          <Toggle
            label="Weekly Digest"
            description="A weekly summary of your activity"
            checked={settings.emailWeeklyDigest}
            onChange={(checked) => setSettings((s) => ({ ...s, emailWeeklyDigest: checked }))}
          />
        </div>

        {message && (
          <AlertMessage variant={message.type === 'success' ? 'success' : 'error'} className="mt-4">
            {message.text}
          </AlertMessage>
        )}

        <div className="flex justify-end pt-6">
          <Button onClick={handleSave} size="sm" isLoading={isLoading}>
            Save Preferences
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}
