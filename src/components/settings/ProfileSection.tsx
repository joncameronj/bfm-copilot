'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/Card'
import { Input } from '@/components/ui/Input'
import { Button } from '@/components/ui/Button'
import { AlertMessage } from '@/components/ui/AlertMessage'
import { AvatarUpload } from './AvatarUpload'
import type { Profile } from '@/types/settings'

interface ProfileSectionProps {
  profile: Profile
  email: string
}

export function ProfileSection({ profile, email }: ProfileSectionProps) {
  const router = useRouter()
  const [fullName, setFullName] = useState(profile.full_name || '')
  const [isLoading, setIsLoading] = useState(false)
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setIsLoading(true)
    setMessage(null)

    try {
      const res = await fetch('/api/settings/profile', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fullName }),
      })

      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || 'Failed to update profile')
      }

      setMessage({ type: 'success', text: 'Profile updated successfully' })
      // Refresh server components to update the sidebar with new name
      router.refresh()
    } catch (error) {
      setMessage({
        type: 'error',
        text: error instanceof Error ? error.message : 'Failed to update profile',
      })
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Profile Information</CardTitle>
        <CardDescription>Update your personal information</CardDescription>
      </CardHeader>
      <CardContent>
        {/* Avatar Upload */}
        <AvatarUpload
          avatarUrl={profile.avatar_url}
          fullName={profile.full_name}
        />

        <form onSubmit={handleSubmit} className="space-y-4">
          {message && (
            <AlertMessage variant={message.type === 'success' ? 'success' : 'error'}>
              {message.text}
            </AlertMessage>
          )}

          <Input
            label="Full Name"
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            placeholder="Enter your full name"
          />

          <Input
            label="Email"
            value={email}
            disabled
            helperText="Contact support to change your email address"
          />

          <div className="flex justify-end pt-4">
            <Button type="submit" size="sm" isLoading={isLoading}>
              Save Changes
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  )
}
