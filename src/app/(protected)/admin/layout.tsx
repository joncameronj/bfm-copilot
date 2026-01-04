'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { cn } from '@/lib/utils'

const adminNavItems = [
  { label: 'Overview', href: '/admin', description: 'Overview of your clinic management system' },
  { label: 'Health', href: '/admin/health', description: 'Monitor system health and service status' },
  { label: 'Users', href: '/admin/users', description: 'Manage practitioners and members' },
  { label: 'Knowledge', href: '/admin/documents', description: 'Upload and manage protocol documents' },
  { label: 'Logs', href: '/admin/rag/logs', description: 'Monitor knowledge base queries' },
  { label: 'Telemetry', href: '/admin/rag/telemetry', description: 'Search performance and analytics' },
  { label: 'Evaluations', href: '/admin/evaluations', description: 'Grade agent responses for quality' },
  { label: 'Analytics', href: '/admin/analytics', description: 'Protocol effectiveness and usage metrics' },
  { label: 'Settings', href: '/admin/settings', description: 'Configure AI model and system settings' },
]

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const pathname = usePathname()

  // Check if current path matches nav item (exact or starts with for nested routes)
  const isActiveRoute = (href: string) => {
    if (href === '/admin') {
      return pathname === '/admin'
    }
    return pathname === href || pathname.startsWith(href + '/')
  }

  // Find current nav item for dynamic description
  const currentNavItem = adminNavItems.find(item => isActiveRoute(item.href))

  return (
    <div className="min-h-screen bg-white">
      <main className="max-w-7xl mx-auto p-8">
        {/* Fixed header - title stays same, description changes */}
        <div className="mb-8">
          <h1 className="text-4xl font-bold tracking-[-0.05em] text-neutral-900">
            Admin
          </h1>
          <p className="text-neutral-500 mt-1">
            {currentNavItem?.description || 'Manage your clinic and AI system'}
          </p>

          <nav className="flex items-center gap-1 mt-6">
            {adminNavItems.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  'px-4 py-2 rounded-lg text-sm font-medium transition-colors',
                  isActiveRoute(item.href)
                    ? 'bg-neutral-900 text-white'
                    : 'text-neutral-600 hover:text-neutral-900 hover:bg-neutral-100'
                )}
              >
                {item.label}
              </Link>
            ))}
          </nav>
        </div>

        {children}
      </main>
    </div>
  )
}
