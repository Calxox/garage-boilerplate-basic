'use client'

import type { ReactNode } from 'react'
import { usePathname } from 'next/navigation'
import { AuthProvider } from './AuthProvider'
import { Toaster } from 'sonner'

/**
 * Compose all client-side providers here.
 * Import this in the root layout only.
 */
export function Providers({ children }: { children: ReactNode }) {
  const pathname = usePathname()
  const content = (
    <>
      {children}
      <Toaster richColors position="top-right" />
    </>
  )

  if (pathname === '/') {
    return content
  }

  return (
    <AuthProvider>{content}</AuthProvider>
  )
}
