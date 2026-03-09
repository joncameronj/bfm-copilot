'use client'

import { BackgroundJobsProvider, useBackgroundJobsOptional } from '@/providers/BackgroundJobsProvider'
import { BackgroundChatsOverlay } from './BackgroundChatsOverlay'
import { Sidebar } from '@/components/sidebar'

interface BackgroundJobsWrapperProps {
  userId: string
  children: React.ReactNode
  sidebarUser: {
    email: string
    fullName: string | null
    avatarUrl: string | null
  }
}

// Inner component that uses the context
function InnerWrapper({
  children,
  sidebarUser,
}: {
  children: React.ReactNode
  sidebarUser: BackgroundJobsWrapperProps['sidebarUser']
}) {
  const backgroundJobs = useBackgroundJobsOptional()

  return (
    <div className="h-screen flex overflow-hidden">
      {/* Sidebar - Fixed */}
      <Sidebar
        user={sidebarUser}
        unreadChatsCount={backgroundJobs?.unreadCount || 0}
      />

      {/* Main content - Scrollable */}
      <main className="flex-1 bg-white dark:bg-neutral-900 overflow-y-auto">
        {children}
      </main>

      {/* Background Chats Overlay - Fixed position, highest z-index */}
      {backgroundJobs && (
        <BackgroundChatsOverlay
          jobs={backgroundJobs.jobs}
          onReview={backgroundJobs.reviewJob}
          onCancel={backgroundJobs.cancelJob}
          isLoading={backgroundJobs.isLoading}
        />
      )}
    </div>
  )
}

export function BackgroundJobsWrapper({
  userId,
  children,
  sidebarUser,
}: BackgroundJobsWrapperProps) {
  return (
    <BackgroundJobsProvider userId={userId}>
      <InnerWrapper sidebarUser={sidebarUser}>
        {children}
      </InnerWrapper>
    </BackgroundJobsProvider>
  )
}
