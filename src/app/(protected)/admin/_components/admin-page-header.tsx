'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { cn } from '@/lib/utils'

const adminNavItems = [
  { label: 'Overview', href: '/admin' },
  { label: 'Users', href: '/admin/users' },
  { label: 'Evaluations', href: '/admin/evaluations' },
  { label: 'Analytics', href: '/admin/analytics' },
  { label: 'Settings', href: '/admin/settings' },
]

interface AdminPageHeaderProps {
  title: string
  description: string
  actions?: React.ReactNode
}

export function AdminPageHeader({ title, description, actions }: AdminPageHeaderProps) {
  const pathname = usePathname()

  return (
    <div className="mb-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-4xl font-bold tracking-[-0.05em] text-neutral-900">
            {title}
          </h1>
          <p className="text-neutral-500 mt-1">{description}</p>
        </div>
        {actions && <div>{actions}</div>}
      </div>

      <nav className="flex items-center gap-1 mt-6">
        {adminNavItems.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className={cn(
              'px-4 py-2 rounded-lg text-sm font-medium transition-colors',
              pathname === item.href
                ? 'bg-neutral-900 text-white'
                : 'text-neutral-600 hover:text-neutral-900 hover:bg-neutral-100'
            )}
          >
            {item.label}
          </Link>
        ))}
      </nav>
    </div>
  )
}
