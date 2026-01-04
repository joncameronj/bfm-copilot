'use client'

import Image from 'next/image'
import { useTheme } from '@/providers/ThemeProvider'

export function ThinkingIndicator() {
  const { resolvedTheme } = useTheme()

  return (
    <div className="flex justify-start">
      <Image
        src={resolvedTheme === 'dark' ? '/icons/bfm-icon.svg' : '/icons/bfm-icon-black.svg'}
        alt=""
        width={24}
        height={28}
        className="animate-icon-pulse"
      />
    </div>
  )
}
