'use client'

import { Suspense, useState, useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import toast from 'react-hot-toast'

function LoginContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [isLoading, setIsLoading] = useState(false)

  // Show error message if redirected with error
  useEffect(() => {
    const error = searchParams.get('error')
    if (error === 'account_inactive') {
      toast.error('Your account has been deactivated. Please contact support.')
    } else if (error === 'auth_callback_error') {
      toast.error('Authentication failed. Please try again.')
    }
  }, [searchParams])

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault()
    setIsLoading(true)

    try {
      const supabase = createClient()
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      })

      if (error) {
        toast.error(error.message)
        return
      }

      toast.success('Signed in successfully!')
      router.push('/')
      router.refresh()
    } catch {
      toast.error('An unexpected error occurred')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div>
      {/* Mobile Warning - Show only on small screens */}
      <div className="md:hidden text-center">
        <p className="text-lg font-bold tracking-[-0.05em] text-neutral-900 dark:text-neutral-50 leading-relaxed">
          For best experience, login with your desktop
        </p>
      </div>

      {/* Desktop Login Form - Show only on tablet and larger */}
      <div className="hidden md:block">
        <div className="text-center mb-6">
          <h2 className="text-xl font-semibold text-neutral-900 dark:text-neutral-50">Welcome back</h2>
          <p className="text-neutral-500 dark:text-neutral-400 mt-1">Sign in with your email and password</p>
        </div>

        <form onSubmit={handleLogin} className="space-y-4">
          <Input
            type="email"
            label="Email"
            placeholder="you@example.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            autoComplete="email"
          />

          <Input
            type="password"
            label="Password"
            placeholder="Enter your password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            autoComplete="current-password"
          />

          <Button
            type="submit"
            className="w-full"
            isLoading={isLoading}
          >
            Sign in
          </Button>
        </form>

        <div className="text-center mt-4">
          <Link href="/reset-password" className="text-sm text-brand-blue hover:underline">
            Forgot password?
          </Link>
        </div>
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
