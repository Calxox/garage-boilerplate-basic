import type { NextConfig } from 'next'

const securityHeaders = [
  // Prevent MIME-type sniffing
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  // Deny framing (clickjacking protection)
  { key: 'X-Frame-Options', value: 'DENY' },
  // Reduce referrer information leakage
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  // Allow device location on this origin; the browser still requires user permission
  { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=(self), browsing-topics=()' },
]

const nextConfig: NextConfig = {
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: securityHeaders,
      },
    ]
  },
}

export default nextConfig
