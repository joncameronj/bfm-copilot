'use client'

import { Suspense, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { DatePicker } from '@/components/ui/DatePicker'
import { format } from 'date-fns'
import toast from 'react-hot-toast'
import { trackLogin } from '@/lib/tracking/events'

function SignupContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const isMemberSignup = searchParams.get('type') === 'member'

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [fullName, setFullName] = useState('')
  const [dateOfBirth, setDateOfBirth] = useState('')
  const [gender, setGender] = useState<'male' | 'female' | 'other'>('male')
  const [isLoading, setIsLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()

    if (password !== confirmPassword) {
      toast.error('Passwords do not match')
      return
    }

    if (password.length < 8) {
      toast.error('Password must be at least 8 characters')
      return
    }

    // For member signup, validate additional fields
    if (isMemberSignup && (!dateOfBirth || !gender)) {
      toast.error('Please fill in all required fields')
      return
    }

    setIsLoading(true)

    try {
      const supabase = createClient()

      // Create auth user
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            full_name: fullName,
          },
        },
      })

      if (authError) {
        toast.error(authError.message)
        return
      }

      if (authData.user) {
        // For member signup, set role and create self-patient
        if (isMemberSignup) {
          // Update profile with member role
          const { error: profileError } = await supabase
            .from('profiles')
            .update({ role: 'member', full_name: fullName })
            .eq('id', authData.user.id)

          if (profileError) {
            console.error('Failed to update profile:', profileError)
          }

          // Parse name for patient record
          const nameParts = fullName.trim().split(' ')
          const firstName = nameParts[0] || ''
          const lastName = nameParts.slice(1).join(' ') || ''

          // Create self-patient record
          const { data: patientData, error: patientError } = await supabase
            .from('patients')
            .insert({
              user_id: authData.user.id,
              first_name: firstName,
              last_name: lastName,
              date_of_birth: dateOfBirth,
              gender: gender,
              email: email,
              status: 'active',
            })
            .select()
            .single()

          if (patientError) {
            console.error('Failed to create patient:', patientError)
          } else if (patientData) {
            // Link self-patient to profile
            await supabase
              .from('profiles')
              .update({ self_patient_id: patientData.id })
              .eq('id', authData.user.id)
          }

          // Track login event
          await trackLogin()

          toast.success('Account created! Welcome to the At-Home Program.')
          router.push('/my-health')
        } else {
          toast.success('Account created! Please check your email to verify.')
          router.push('/login')
        }
      }
    } catch {
      toast.error('An unexpected error occurred')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div>
      <div className="text-center mb-6">
        <h2 className="text-xl font-semibold text-neutral-900">
          {isMemberSignup ? 'Join the At-Home Program' : 'Create an account'}
        </h2>
        <p className="text-neutral-500 mt-1">
          {isMemberSignup
            ? 'Create your account to get started with personalized health guidance'
            : 'Get started with Clinic Copilot'}
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <Input
          type="text"
          label="Full Name"
          placeholder="John Doe"
          value={fullName}
          onChange={(e) => setFullName(e.target.value)}
          required
          autoComplete="name"
        />

        <Input
          type="email"
          label="Email"
          placeholder="you@example.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          autoComplete="email"
        />

        {/* Member-specific fields */}
        {isMemberSignup && (
          <>
            <div>
              <label className="block text-sm font-medium text-neutral-700 mb-2">
                Date of Birth
              </label>
              <DatePicker
                value={dateOfBirth ? new Date(dateOfBirth) : null}
                onChange={(date) => setDateOfBirth(date ? format(date, 'yyyy-MM-dd') : '')}
                placeholder="Select date of birth"
                maxDate={new Date()}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-neutral-700 mb-2">
                Gender
              </label>
              <select
                value={gender}
                onChange={(e) => setGender(e.target.value as 'male' | 'female' | 'other')}
                className="input-field"
                required
              >
                <option value="male">Male</option>
                <option value="female">Female</option>
                <option value="other">Other</option>
              </select>
            </div>
          </>
        )}

        <Input
          type="password"
          label="Password"
          placeholder="Min 8 characters"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          autoComplete="new-password"
        />

        <Input
          type="password"
          label="Confirm Password"
          placeholder="Confirm your password"
          value={confirmPassword}
          onChange={(e) => setConfirmPassword(e.target.value)}
          required
          autoComplete="new-password"
        />

        <div className="flex items-start gap-2">
          <input
            type="checkbox"
            id="terms"
            required
            className="mt-1 rounded border-neutral-300"
          />
          <label htmlFor="terms" className="text-sm text-neutral-600">
            I agree to the{' '}
            <Link href="/terms" className="text-brand-blue hover:underline">
              Terms of Service
            </Link>{' '}
            and{' '}
            <Link href="/privacy" className="text-brand-blue hover:underline">
              Privacy Policy
            </Link>
          </label>
        </div>

        <Button
          type="submit"
          className="w-full"
          isLoading={isLoading}
        >
          {isMemberSignup ? 'Join At-Home Program' : 'Create Account'}
        </Button>
      </form>

      <p className="text-center mt-6 text-neutral-500 text-sm">
        Already have an account?{' '}
        <Link href="/login" className="text-brand-blue hover:underline">
          Sign in
        </Link>
      </p>

      {!isMemberSignup && (
        <p className="text-center mt-4 text-neutral-500 text-sm">
          Looking for the At-Home Program?{' '}
          <Link href="/signup?type=member" className="text-brand-blue hover:underline">
            Sign up as a member
          </Link>
        </p>
      )}
    </div>
  )
}

export default function SignupPage() {
  return (
    <Suspense fallback={<div className="animate-pulse">Loading...</div>}>
      <SignupContent />
    </Suspense>
  )
}
