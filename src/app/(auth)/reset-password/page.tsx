'use client'

import { useState } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import toast from 'react-hot-toast'

export default function ResetPasswordPage() {
  const [email, setEmail] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [emailSent, setEmailSent] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setIsLoading(true)

    try {
      const supabase = createClient()
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/api/auth/callback?next=/update-password`,
      })

      if (error) {
        toast.error(error.message)
        return
      }

      setEmailSent(true)
      toast.success('Password reset email sent!')
    } catch (err) {
      toast.error('An unexpected error occurred')
    } finally {
      setIsLoading(false)
    }
  }

  if (emailSent) {
    return (
      <div className="text-center">
        <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
          <svg
            className="w-6 h-6 text-green-600"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M5 13l4 4L19 7"
            />
          </svg>
        </div>
        <h2 className="text-xl font-semibold text-neutral-900 mb-2">
          Check your email
        </h2>
        <p className="text-neutral-500 mb-6">
          We have sent a password reset link to <strong>{email}</strong>
        </p>
        <Link href="/login" className="text-brand-blue hover:underline text-sm">
          Back to login
        </Link>
      </div>
    )
  }

  return (
    <div>
      <div className="text-center mb-6">
        <h2 className="text-xl font-semibold text-neutral-900">Reset password</h2>
        <p className="text-neutral-500 mt-1">
          Enter your email to receive a reset link
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <Input
          type="email"
          label="Email"
          placeholder="you@example.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          autoComplete="email"
        />

        <Button
          type="submit"
          className="w-full"
          isLoading={isLoading}
        >
          Send Reset Link
        </Button>
      </form>

      <p className="text-center mt-6 text-neutral-500 text-sm">
        Remember your password?{' '}
        <Link href="/login" className="text-brand-blue hover:underline">
          Sign in
        </Link>
      </p>
    </div>
  )
}
