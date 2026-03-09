'use client'

import { useState, useEffect } from 'react'
import { Button, Input, Select, Card, CardHeader, CardTitle, CardDescription, CardContent, Spinner } from '@/components/ui'
import {
  type ModelSettings,
  AVAILABLE_MODELS,
  REASONING_EFFORT_OPTIONS,
  REASONING_SUMMARY_OPTIONS,
} from '@/types/settings'
import toast from 'react-hot-toast'

export function ModelSettingsForm() {
  const [settings, setSettings] = useState<ModelSettings | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [customModel, setCustomModel] = useState('')
  const [useCustomModel, setUseCustomModel] = useState(false)

  useEffect(() => {
    fetchSettings()
  }, [])

  async function fetchSettings() {
    setLoading(true)
    try {
      const res = await fetch('/api/admin/settings')
      const { data, error } = await res.json()

      if (error) {
        toast.error('Failed to load settings')
        return
      }

      setSettings(data)

      // Check if current model is a custom one
      const isKnownModel = AVAILABLE_MODELS.some(m => m.value === data.chat_model)
      if (!isKnownModel) {
        setUseCustomModel(true)
        setCustomModel(data.chat_model)
      }
    } catch (error) {
      console.error('Failed to fetch settings:', error)
      toast.error('Failed to load settings')
    } finally {
      setLoading(false)
    }
  }

  async function saveSettings() {
    if (!settings) return

    setSaving(true)
    try {
      const payload = {
        ...settings,
        chat_model: useCustomModel ? customModel : settings.chat_model,
      }

      const res = await fetch('/api/admin/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })

      const { data, error } = await res.json()

      if (error) {
        toast.error(error)
        return
      }

      setSettings(data)
      toast.success('Settings saved successfully')
    } catch (error) {
      console.error('Failed to save settings:', error)
      toast.error('Failed to save settings')
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <Spinner size="lg" />
      </div>
    )
  }

  if (!settings) {
    return (
      <div className="text-center py-12 text-neutral-500">
        Failed to load settings. Please refresh the page.
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Chat Model Setting */}
      <Card>
        <CardHeader>
          <CardTitle>Chat Model</CardTitle>
          <CardDescription>
            Select the model used for the main AI chat agent. Changes take effect immediately for new conversations.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center gap-4">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="radio"
                name="modelType"
                checked={!useCustomModel}
                onChange={() => setUseCustomModel(false)}
                className="w-4 h-4 text-primary-600"
              />
              <span className="text-sm text-neutral-700">Predefined model</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="radio"
                name="modelType"
                checked={useCustomModel}
                onChange={() => setUseCustomModel(true)}
                className="w-4 h-4 text-primary-600"
              />
              <span className="text-sm text-neutral-700">Custom model</span>
            </label>
          </div>

          {useCustomModel ? (
            <div>
              <label className="block text-sm font-medium text-neutral-700 mb-1">
                Custom Model Name
              </label>
              <Input
                value={customModel}
                onChange={(e) => setCustomModel(e.target.value)}
                placeholder="e.g., claude-opus-4-6"
              />
              <p className="mt-1 text-xs text-neutral-500">
                Enter the exact model name as specified by your provider
              </p>
            </div>
          ) : (
            <div>
              <label className="block text-sm font-medium text-neutral-700 mb-1">
                Select Model
              </label>
              <Select
                value={settings.chat_model}
                onChange={(e) => setSettings({ ...settings, chat_model: e.target.value })}
              >
                {AVAILABLE_MODELS.map((model) => (
                  <option key={model.value} value={model.value}>
                    {model.label}
                  </option>
                ))}
              </Select>
              <p className="mt-1 text-xs text-neutral-500">
                {AVAILABLE_MODELS.find(m => m.value === settings.chat_model)?.description}
              </p>
            </div>
          )}

          <div className="bg-neutral-50 rounded-lg p-3 text-sm">
            <span className="font-medium">Current model:</span>{' '}
            <code className="bg-neutral-200 px-1.5 py-0.5 rounded text-xs">
              {useCustomModel ? customModel : settings.chat_model}
            </code>
          </div>
        </CardContent>
      </Card>

      {/* Reasoning Settings */}
      <Card>
        <CardHeader>
          <CardTitle>Reasoning Settings</CardTitle>
          <CardDescription>
            Configure how the AI model approaches complex reasoning tasks. Higher effort means more thorough but slower responses.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-neutral-700 mb-1">
              Reasoning Effort
            </label>
            <Select
              value={settings.reasoning_effort}
              onChange={(e) => setSettings({
                ...settings,
                reasoning_effort: e.target.value as ModelSettings['reasoning_effort']
              })}
            >
              {REASONING_EFFORT_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </Select>
            <p className="mt-1 text-xs text-neutral-500">
              {REASONING_EFFORT_OPTIONS.find(o => o.value === settings.reasoning_effort)?.description}
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium text-neutral-700 mb-1">
              Reasoning Summary
            </label>
            <Select
              value={settings.reasoning_summary}
              onChange={(e) => setSettings({
                ...settings,
                reasoning_summary: e.target.value as ModelSettings['reasoning_summary']
              })}
            >
              {REASONING_SUMMARY_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </Select>
            <p className="mt-1 text-xs text-neutral-500">
              {REASONING_SUMMARY_OPTIONS.find(o => o.value === settings.reasoning_summary)?.description}
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Save Button */}
      <div className="flex justify-end">
        <Button
          onClick={saveSettings}
          disabled={saving}
        >
          {saving ? (
            <>
              <Spinner size="sm" className="mr-2" />
              Saving...
            </>
          ) : (
            'Save Settings'
          )}
        </Button>
      </div>
    </div>
  )
}
