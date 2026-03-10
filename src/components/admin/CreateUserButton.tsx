'use client'

import { useState } from 'react'
import { Button, Input, Select, Modal, AlertMessage } from '@/components/ui'
import { type UserRole } from '@/types/roles'

interface CreateUserButtonProps {
  onUserCreated?: () => void
}

export function CreateUserButton({ onUserCreated }: CreateUserButtonProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  const [email, setEmail] = useState('')
  const [fullName, setFullName] = useState('')
  const [role, setRole] = useState<UserRole>('practitioner')

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setSuccess('')
    setLoading(true)

    try {
      const res = await fetch('/api/admin/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, fullName, role }),
      })

      const data = await res.json()

      if (!res.ok) {
        throw new Error(data.error || 'Failed to create user')
      }

      setSuccess(data.message || 'User created successfully!')
      setEmail('')
      setFullName('')
      setRole('practitioner')
      onUserCreated?.()

      // Close modal after delay
      setTimeout(() => {
        setIsOpen(false)
        setSuccess('')
      }, 2000)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create user')
    } finally {
      setLoading(false)
    }
  }

  function handleClose() {
    setIsOpen(false)
    setError('')
    setSuccess('')
    setEmail('')
    setFullName('')
    setRole('practitioner')
  }

  return (
    <>
      <Button onClick={() => setIsOpen(true)}>Create User</Button>

      <Modal isOpen={isOpen} onClose={handleClose} title="Create New User">
        <form onSubmit={handleSubmit} className="space-y-4">
          {error && (
            <AlertMessage variant="error">{error}</AlertMessage>
          )}

          {success && (
            <AlertMessage variant="success">{success}</AlertMessage>
          )}

          <Input
            label="Full Name"
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            placeholder="John Doe"
          />

          <Input
            label="Email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="john@example.com"
            required
          />

          <Select
            label="Role"
            value={role}
            onChange={(e) => setRole(e.target.value as UserRole)}
          >
            <option value="admin">Admin</option>
            <option value="practitioner">Practitioner</option>
            <option value="member">Member</option>
          </Select>

          <div className="pt-4">
            <p className="text-sm text-neutral-500 mb-4">
              The user will receive an email to set their password.
            </p>
            <div className="flex justify-end gap-3">
              <Button
                type="button"
                variant="secondary"
                onClick={handleClose}
              >
                Cancel
              </Button>
              <Button type="submit" isLoading={loading}>
                Create User
              </Button>
            </div>
          </div>
        </form>
      </Modal>
    </>
  )
}
