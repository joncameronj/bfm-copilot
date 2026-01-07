'use client'

import { Suspense, useState, useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import Image from 'next/image'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { useTheme } from '@/providers/ThemeProvider'
import toast from 'react-hot-toast'
import { HugeiconsIcon } from '@hugeicons/react'
import { Mail01Icon } from '@hugeicons/core-free-icons'

function LoginContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { resolvedTheme } = useTheme()
  const [email, setEmail] = useState('')
  const [step, setStep] = useState<'email' | 'sent'>('email')
  const [isLoading, setIsLoading] = useState(false)
  const [countdown, setCountdown] = useState(0)

  // Countdown timer for resend
  useEffect(() => {
    if (countdown > 0) {
      const timer = setTimeout(() => setCountdown(countdown - 1), 1000)
      return () => clearTimeout(timer)
    }
  }, [countdown])

  // Show error message if redirected with error
  useEffect(() => {
    const error = searchParams.get('error')
    if (error === 'account_inactive') {
      toast.error('Your account has been deactivated. Please contact support.')
    }
  }, [searchParams])

  async function handleSendMagicLink(e: React.FormEvent) {
    e.preventDefault()
    setIsLoading(true)

    try {
      const supabase = createClient()
      const { error } = await supabase.auth.signInWithOtp({
        email,
        options: {
          shouldCreateUser: false,
          emailRedirectTo: `${window.location.origin}/api/auth/callback?next=/`,
        },
      })

      if (error) {
        toast.error(error.message)
        return
      }

      toast.success('Magic link sent!')
      setStep('sent')
      setCountdown(60)
    } catch {
      toast.error('An unexpected error occurred')
    } finally {
      setIsLoading(false)
    }
  }

  async function handleResend() {
    if (countdown > 0) return
    setIsLoading(true)

    try {
      const supabase = createClient()
      const { error } = await supabase.auth.signInWithOtp({
        email,
        options: {
          shouldCreateUser: false,
          emailRedirectTo: `${window.location.origin}/api/auth/callback?next=/`,
        },
      })

      if (error) {
        toast.error(error.message)
        return
      }

      toast.success('New magic link sent!')
      setCountdown(60)
    } catch {
      toast.error('An unexpected error occurred')
    } finally {
      setIsLoading(false)
    }
  }

  if (step === 'sent') {
    return (
      <div>
        {/* Mobile Warning - Show only on small screens */}
        <div className="md:hidden text-center">
          <div className="flex justify-center mb-6">
            <Image
              src={resolvedTheme === 'dark'
                ? '/images/copilot-logo-gradient-dark.svg'
                : '/images/copilot-logo-gradient.svg'}
              alt="Copilot"
              width={180}
              height={44}
              priority
            />
          </div>
          <p className="text-lg font-bold tracking-[-0.05em] text-neutral-900 dark:text-neutral-50 leading-relaxed">
            For best experience, login with your desktop
          </p>
        </div>

        {/* Desktop Confirmation - Show only on tablet and larger */}
        <div className="hidden md:block">
          <div className="text-center mb-6">
            <div className="mx-auto w-16 h-16 bg-brand-blue/10 rounded-full flex items-center justify-center mb-4">
              <HugeiconsIcon icon={Mail01Icon} size={32} className="text-brand-blue" />
            </div>
            <h2 className="text-xl font-semibold text-neutral-900 dark:text-neutral-50">Check your email</h2>
            <p className="text-neutral-500 dark:text-neutral-400 mt-2">
              We sent a magic link to<br />
              <span className="font-medium text-neutral-700 dark:text-neutral-300">{email}</span>
            </p>
            <p className="text-neutral-400 text-sm mt-4">
              Click the link in the email to sign in
            </p>
          </div>

          <div className="text-center space-y-3">
            <button
              type="button"
              onClick={handleResend}
              disabled={countdown > 0 || isLoading}
              className="text-sm text-brand-blue hover:underline disabled:text-neutral-400 disabled:no-underline"
            >
              {countdown > 0 ? `Resend link in ${countdown}s` : 'Resend magic link'}
            </button>

            <div>
              <button
                type="button"
                onClick={() => {
                  setStep('email')
                }}
                className="text-sm text-neutral-500 dark:text-neutral-400 hover:underline"
              >
                Use a different email
              </button>
            </div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div>
      {/* Mobile Warning - Show only on small screens */}
      <div className="md:hidden text-center">
        <div className="flex justify-center mb-6">
          <Image
            src={resolvedTheme === 'dark'
              ? '/images/copilot-logo-gradient-dark.svg'
              : '/images/copilot-logo-gradient.svg'}
            alt="Copilot"
            width={180}
            height={44}
            priority
          />
        </div>
        <p className="text-lg font-bold tracking-[-0.05em] text-neutral-900 dark:text-neutral-50 leading-relaxed">
          For best experience, login with your desktop
        </p>
      </div>

      {/* Desktop Login Form - Show only on tablet and larger */}
      <div className="hidden md:block">
        <div className="text-center mb-6">
          <h2 className="text-xl font-semibold text-neutral-900 dark:text-neutral-50">Welcome back</h2>
          <p className="text-neutral-500 dark:text-neutral-400 mt-1">Enter your email to receive a magic link</p>
        </div>

        <form onSubmit={handleSendMagicLink} className="space-y-4">
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
            Send magic link
          </Button>
        </form>

        <p className="text-center mt-6 text-neutral-500 dark:text-neutral-400 text-sm">
          Do not have an account?{' '}
          <Link href="/signup" className="text-brand-blue hover:underline">
            Sign up
          </Link>
        </p>

        {process.env.NODE_ENV === 'development' && (
          <div className="mt-8 pt-6 border-t border-neutral-200 dark:border-neutral-700">
            <Button
              type="button"
              variant="secondary"
              className="w-full"
              onClick={async () => {
                setIsLoading(true)
                const supabase = createClient()
                const { error } = await supabase.auth.signInWithPassword({
                  email: 'joncameron@etho.net',
                  password: 'Copilot2024!',
                })
                if (error) {
                  toast.error(error.message)
                  setIsLoading(false)
                  return
                }
                router.push('/')
                router.refresh()
              }}
              isLoading={isLoading}
            >
              Skip Login (Dev Only)
            </Button>
          </div>
        )}
      </div>
    </div>
  )
}

export default function LoginPage() {
  return (
    <Suspense fallback={<div className="animate-pulse">Loading...</div>}>
      <LoginContent />
    </Suspense>
  )
}
