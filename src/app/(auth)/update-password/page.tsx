'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import toast from 'react-hot-toast'

export default function UpdatePasswordPage() {
  const router = useRouter()
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [isCheckingSession, setIsCheckingSession] = useState(true)
  const [hasSession, setHasSession] = useState(false)
  const [errors, setErrors] = useState<Record<string, string>>({})

  useEffect(() => {
    let isMounted = true

    const supabase = createClient()

    const markSessionReady = (sessionExists: boolean) => {
      if (!isMounted) return
      setHasSession(sessionExists)
      setIsCheckingSession(false)
    }

    async function checkSession() {
      const { data } = await supabase.auth.getSession()

      if (!isMounted) return

      if (data.session) {
        markSessionReady(true)
      }
    }

    void checkSession()

    const fallbackTimer = window.setTimeout(async () => {
      const { data } = await supabase.auth.getSession()
      markSessionReady(Boolean(data.session))
    }, 1500)

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      if (
        event === 'PASSWORD_RECOVERY' ||
        event === 'SIGNED_IN' ||
        event === 'TOKEN_REFRESHED'
      ) {
        window.clearTimeout(fallbackTimer)
        markSessionReady(Boolean(session))
      }
    })

    return () => {
      isMounted = false
      window.clearTimeout(fallbackTimer)
      subscription.unsubscribe()
    }
  }, [])

  function validateForm() {
    const nextErrors: Record<string, string> = {}

    if (!newPassword) {
      nextErrors.newPassword = 'New password is required'
    } else if (newPassword.length < 8) {
      nextErrors.newPassword = 'Password must be at least 8 characters'
    }

    if (newPassword !== confirmPassword) {
      nextErrors.confirmPassword = 'Passwords do not match'
    }

    setErrors(nextErrors)
    return Object.keys(nextErrors).length === 0
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!validateForm()) return

    setIsLoading(true)

    try {
      const supabase = createClient()
      const { error } = await supabase.auth.updateUser({
        password: newPassword,
      })

      if (error) {
        throw error
      }

      toast.success('Password updated successfully')
      router.push('/')
      router.refresh()
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : 'Failed to update password'
      )
    } finally {
      setIsLoading(false)
    }
  }

  if (isCheckingSession) {
    return (
      <div className="text-center">
        <h2 className="text-xl font-semibold text-neutral-900 dark:text-neutral-50">
          Preparing account setup
        </h2>
        <p className="mt-2 text-neutral-500 dark:text-neutral-400">
          Validating your recovery link.
        </p>
      </div>
    )
  }

  if (!hasSession) {
    return (
      <div className="text-center">
        <h2 className="text-xl font-semibold text-neutral-900 dark:text-neutral-50">
          Recovery link expired
        </h2>
        <p className="mt-2 text-neutral-500 dark:text-neutral-400">
          Request a new password reset email to finish setting up your account.
        </p>
        <div className="mt-6 flex flex-col gap-3">
          <Link href="/reset-password" className="text-brand-blue hover:underline">
            Request a new reset link
          </Link>
          <Link href="/login" className="text-sm text-neutral-500 hover:underline dark:text-neutral-400">
            Back to login
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div>
      <div className="text-center mb-6">
        <h2 className="text-xl font-semibold text-neutral-900 dark:text-neutral-50">
          Set your password
        </h2>
        <p className="mt-1 text-neutral-500 dark:text-neutral-400">
          Finish setting up your Copilot account.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <Input
          label="New Password"
          type="password"
          value={newPassword}
          onChange={(e) => {
            setNewPassword(e.target.value)
            if (errors.newPassword) {
              setErrors((prev) => ({ ...prev, newPassword: '' }))
            }
          }}
          error={errors.newPassword}
          helperText="Must be at least 8 characters"
          autoComplete="new-password"
          required
        />

        <Input
          label="Confirm Password"
          type="password"
          value={confirmPassword}
          onChange={(e) => {
            setConfirmPassword(e.target.value)
            if (errors.confirmPassword) {
              setErrors((prev) => ({ ...prev, confirmPassword: '' }))
            }
          }}
          error={errors.confirmPassword}
          autoComplete="new-password"
          required
        />

        <Button type="submit" className="w-full" isLoading={isLoading}>
          Save Password
        </Button>
      </form>
    </div>
  )
}
