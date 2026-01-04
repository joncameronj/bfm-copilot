'use client'

import { useState } from 'react'
import { cn } from '@/lib/utils'
import { ProfileSection } from './ProfileSection'
import { PasswordSection } from './PasswordSection'
import { NotificationsSection } from './NotificationsSection'
import { AdminSettingsSection } from './AdminSettingsSection'
import { PractitionerSettingsSection } from './PractitionerSettingsSection'
import { MemberSettingsSection } from './MemberSettingsSection'
import type { UserRole } from '@/types/roles'
import type { Profile, UserPreferences } from '@/types/settings'

interface SettingsLayoutProps {
  profile: Profile
  preferences: UserPreferences | null
  userEmail: string
}

type SettingsTab = 'profile' | 'password' | 'notifications' | 'role-specific'

function getRoleTabLabel(role: UserRole): string {
  switch (role) {
    case 'admin':
      return 'Admin Settings'
    case 'practitioner':
      return 'Practice Settings'
    case 'member':
      return 'Health Preferences'
  }
}

function RoleSpecificSection({
  role,
  preferences,
}: {
  role: UserRole
  preferences: UserPreferences | null
}) {
  switch (role) {
    case 'admin':
      return <AdminSettingsSection />
    case 'practitioner':
      return <PractitionerSettingsSection preferences={preferences} />
    case 'member':
      return <MemberSettingsSection preferences={preferences} />
  }
}

export function SettingsLayout({ profile, preferences, userEmail }: SettingsLayoutProps) {
  const [activeTab, setActiveTab] = useState<SettingsTab>('profile')

  // Admin users don't see Admin Settings in the Settings page tabs - they access it via sidebar
  const tabs: { id: SettingsTab; label: string }[] = [
    { id: 'profile', label: 'Profile' },
    { id: 'password', label: 'Password' },
    { id: 'notifications', label: 'Notifications' },
    ...(profile.role !== 'admin' ? [{ id: 'role-specific' as SettingsTab, label: getRoleTabLabel(profile.role) }] : []),
  ]

  return (
    <div className="flex gap-8">
      {/* Sidebar navigation */}
      <nav className="w-48 flex-shrink-0">
        <ul className="space-y-1">
          {tabs.map((tab) => (
            <li key={tab.id}>
              <button
                onClick={() => setActiveTab(tab.id)}
                className={cn(
                  'w-full text-left px-4 py-2 rounded-lg transition-colors',
                  activeTab === tab.id
                    ? 'bg-neutral-100 dark:bg-neutral-800 text-neutral-900 dark:text-neutral-50 font-medium'
                    : 'text-neutral-600 dark:text-neutral-400 hover:bg-neutral-50 dark:hover:bg-neutral-800'
                )}
              >
                {tab.label}
              </button>
            </li>
          ))}
        </ul>
      </nav>

      {/* Content area */}
      <div className="flex-1 max-w-2xl">
        {activeTab === 'profile' && <ProfileSection profile={profile} email={userEmail} />}
        {activeTab === 'password' && <PasswordSection />}
        {activeTab === 'notifications' && <NotificationsSection preferences={preferences} />}
        {activeTab === 'role-specific' && (
          <RoleSpecificSection role={profile.role} preferences={preferences} />
        )}
      </div>
    </div>
  )
}
