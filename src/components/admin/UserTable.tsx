'use client'

import { useState, useEffect } from 'react'
import { Input, Select, Badge, Spinner } from '@/components/ui'
import { formatDistanceToNow } from 'date-fns'
import { type UserRole, type UserStatistics } from '@/types/roles'

interface UserTableProps {
  onRefresh?: () => void
}

export function UserTable({ onRefresh }: UserTableProps) {
  const [users, setUsers] = useState<UserStatistics[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [roleFilter, setRoleFilter] = useState('')
  const [statusFilter, setStatusFilter] = useState('')

  useEffect(() => {
    fetchUsers()
  }, [search, roleFilter, statusFilter])

  async function fetchUsers() {
    setLoading(true)
    const params = new URLSearchParams()
    if (search) params.set('search', search)
    if (roleFilter) params.set('role', roleFilter)
    if (statusFilter) params.set('status', statusFilter)

    try {
      const res = await fetch(`/api/admin/users?${params}`)
      const { data } = await res.json()
      setUsers(data || [])
    } catch (error) {
      console.error('Failed to fetch users:', error)
    } finally {
      setLoading(false)
    }
  }

  async function updateUser(userId: string, updates: Partial<{ role: UserRole; status: string; fullName: string }>) {
    try {
      await fetch(`/api/admin/users/${userId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates),
      })
      fetchUsers()
      onRefresh?.()
    } catch (error) {
      console.error('Failed to update user:', error)
    }
  }

  async function toggleStatus(userId: string, currentStatus: string) {
    const newStatus = currentStatus === 'active' ? 'inactive' : 'active'
    await updateUser(userId, { status: newStatus })
  }

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="flex gap-4 items-end">
        <div className="flex-1 max-w-xs">
          <Input
            placeholder="Search by email or name..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <div className="w-40">
          <Select
            value={roleFilter}
            onChange={(e) => setRoleFilter(e.target.value)}
          >
            <option value="">All roles</option>
            <option value="admin">Admin</option>
            <option value="practitioner">Practitioner</option>
            <option value="member">Member</option>
          </Select>
        </div>
        <div className="w-40">
          <Select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
          >
            <option value="">All status</option>
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
          </Select>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white dark:bg-neutral-800 rounded-2xl overflow-hidden">
        <table className="w-full">
          <thead className="bg-neutral-50 dark:bg-neutral-900">
            <tr>
              <th className="px-4 py-3 text-left text-sm font-medium text-neutral-500 dark:text-neutral-400">
                User
              </th>
              <th className="px-4 py-3 text-left text-sm font-medium text-neutral-500 dark:text-neutral-400">
                Role
              </th>
              <th className="px-4 py-3 text-left text-sm font-medium text-neutral-500 dark:text-neutral-400">
                Status
              </th>
              <th className="px-4 py-3 text-left text-sm font-medium text-neutral-500 dark:text-neutral-400">
                Labs
              </th>
              <th className="px-4 py-3 text-left text-sm font-medium text-neutral-500 dark:text-neutral-400">
                Protocols
              </th>
              <th className="px-4 py-3 text-left text-sm font-medium text-neutral-500 dark:text-neutral-400">
                Last Active
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-neutral-100 dark:divide-neutral-700">
            {loading ? (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center">
                  <Spinner />
                </td>
              </tr>
            ) : users.length === 0 ? (
              <tr>
                <td
                  colSpan={6}
                  className="px-4 py-8 text-center text-neutral-500 dark:text-neutral-400"
                >
                  No users found
                </td>
              </tr>
            ) : (
              users.map((user) => (
                <tr key={user.user_id} className="hover:bg-neutral-50 dark:hover:bg-neutral-700">
                  <td className="px-4 py-3">
                    <div>
                      <div className="font-medium text-neutral-900 dark:text-neutral-50">
                        {user.full_name || 'No name'}
                      </div>
                      <div className="text-sm text-neutral-500 dark:text-neutral-400">
                        {user.email}
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <Select
                      value={user.role}
                      onChange={(e) =>
                        updateUser(user.user_id, {
                          role: e.target.value as UserRole,
                        })
                      }
                      className="text-sm py-1.5"
                    >
                      <option value="admin">Admin</option>
                      <option value="practitioner">Practitioner</option>
                      <option value="member">Member</option>
                    </Select>
                  </td>
                  <td className="px-4 py-3">
                    <button
                      onClick={() => toggleStatus(user.user_id, user.status)}
                      className="cursor-pointer"
                    >
                      <Badge
                        variant={
                          user.status === 'active' ? 'success' : 'neutral'
                        }
                      >
                        {user.status}
                      </Badge>
                    </button>
                  </td>
                  <td className="px-4 py-3 text-neutral-600 dark:text-neutral-400">
                    {user.labs_count}
                  </td>
                  <td className="px-4 py-3 text-neutral-600 dark:text-neutral-400">
                    {user.protocols_count}
                  </td>
                  <td className="px-4 py-3 text-neutral-500 dark:text-neutral-400 text-sm">
                    {user.last_active
                      ? formatDistanceToNow(new Date(user.last_active), {
                          addSuffix: true,
                        })
                      : 'Never'}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
