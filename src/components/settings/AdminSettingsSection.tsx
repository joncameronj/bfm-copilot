'use client'

import Link from 'next/link'
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/Card'

export function AdminSettingsSection() {
  const adminLinks = [
    { href: '/admin/users', label: 'User Management', description: 'Manage users and roles' },
    { href: '/admin/analytics', label: 'Analytics', description: 'View platform analytics' },
    { href: '/admin/documents', label: 'Documents', description: 'Manage knowledge base documents' },
    { href: '/admin/settings', label: 'AI Model Settings', description: 'Configure chat model and reasoning' },
  ]

  return (
    <Card>
      <CardHeader>
        <CardTitle>Administration</CardTitle>
        <CardDescription>Quick access to admin features</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {adminLinks.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="block p-4 rounded-xl bg-neutral-100 hover:bg-neutral-200 transition-colors"
            >
              <p className="font-medium text-neutral-900">{link.label}</p>
              <p className="text-sm text-neutral-500">{link.description}</p>
            </Link>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}
