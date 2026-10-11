import { expect, test } from 'vitest'
import nextConfig from '../../next.config'

test('device location is permitted on this origin while unused sensors remain disabled', async () => {
  const rules = await nextConfig.headers!()
  const policy = rules.find((rule) => rule.source === '/(.*)')?.headers.find(
    (header) => header.key === 'Permissions-Policy'
  )?.value
  expect(policy).toBe('camera=(), microphone=(), geolocation=(self), browsing-topics=()')
})