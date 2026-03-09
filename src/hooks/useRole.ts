// src/hooks/useRole.ts
// Hook for accessing user role and permissions (WS-5)

'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import {
  type UserRole,
  ROLE_PERMISSIONS,
  type RolePermissions,
  getTerminology,
  getHomeRoute,
} from '@/types/roles'

interface UseRoleReturn {
  role: UserRole | null
  isLoading: boolean
  isAdmin: boolean
  isPractitioner: boolean
  isMember: boolean
  canAccess: (permission: keyof RolePermissions) => boolean
  terminology: ReturnType<typeof getTerminology>
  homeRoute: string
  user: {
    id: string
    email: string
    fullName: string | null
  } | null
}

export function useRole(): UseRoleReturn {
  const [role, setRole] = useState<UserRole | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [user, setUser] = useState<UseRoleReturn['user']>(null)

  useEffect(() => {
    async function fetchRole() {
      try {
        const supabase = createClient()
        const {
          data: { user: authUser },
        } = await supabase.auth.getUser()

        if (authUser) {
          const { data: profile } = await supabase
            .from('profiles')
            .select('role, full_name')
            .eq('id', authUser.id)
            .single()

          if (profile) {
            setRole(profile.role as UserRole)
            setUser({
              id: authUser.id,
              email: authUser.email || '',
              fullName: profile.full_name,
            })
          }
        }
      } catch (error) {
        console.error('Error fetching user role:', error)
      } finally {
        setIsLoading(false)
      }
    }

    fetchRole()
  }, [])

  const canAccess = (permission: keyof RolePermissions): boolean => {
    if (!role) return false
    return ROLE_PERMISSIONS[role][permission]
  }

  return {
    role,
    isLoading,
    isAdmin: role === 'admin',
    isPractitioner: role === 'practitioner',
    isMember: role === 'member',
    canAccess,
    terminology: role ? getTerminology(role) : getTerminology('practitioner'),
    homeRoute: role ? getHomeRoute(role) : '/',
    user,
  }
}
