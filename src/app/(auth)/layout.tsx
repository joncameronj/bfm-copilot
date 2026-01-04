'use client'

import Image from 'next/image'
import { useTheme } from '@/providers/ThemeProvider'

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const { resolvedTheme } = useTheme()

  return (
    <div className="min-h-screen flex items-center justify-center bg-neutral-50 dark:bg-neutral-900 p-4">
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="flex justify-center mb-8">
          <Image
            src={resolvedTheme === 'dark' ? '/images/copilot-logo-gradient-dark.svg' : '/images/copilot-logo-gradient.svg'}
            alt="Copilot Logo"
            width={200}
            height={49}
          />
        </div>

        {/* Auth Card */}
        <div className="bg-white dark:bg-neutral-800 rounded-2xl p-8">
          {children}
        </div>
      </div>
    </div>
  )
}
