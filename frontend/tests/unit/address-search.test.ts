import { afterEach, expect, test, vi } from 'vitest'
import { parseAddressResults, searchAddresses } from '@/features/hazardwatch/location'

afterEach(() => vi.unstubAllGlobals())

test('numbered address lookup preserves street labels and rejects suburb centres, wrong numbers, streets and invalid coordinates', () => {
  const house = {
    geometry: { type: 'Point', coordinates: [144.96, -37.81] },
    properties: {
      housenumber: '257',
      street: 'Test Road',
      district: 'Glenroy',
      state: 'Victoria',
      countrycode: 'AU',
    },
  }
  const result = parseAddressResults('257 test rd Glenroy', {
    features: [
      house,
      house,
      { ...house, properties: { ...house.properties, housenumber: undefined } },
      { ...house, properties: { ...house.properties, housenumber: '257A' } },
      { ...house, properties: { ...house.properties, housenumber: '258' } },
      { ...house, properties: { ...house.properties, street: 'Other Road' } },
      { ...house, geometry: { type: 'Point', coordinates: [-37.81, 144.96] } },
      { ...house, properties: { ...house.properties, countrycode: 'US' } },
    ],
  })
  expect(result).toEqual([
    {
      label: '257 Test Road, Glenroy, Victoria, Australia',
      coordinates: { latitude: -37.81, longitude: 144.96, source: 'address' },
    },
  ])
  expect(parseAddressResults('257, Test Road', { features: [house] })[0]?.label).toMatch(
    /^257 Test Road/
  )
  expect(parseAddressResults('257', { features: [house] })).toEqual([])
  expect(parseAddressResults('2/257 Test Road', { features: [house] })[0]?.label).toMatch(
    /^2\/257 Test Road/
  )
  expect(parseAddressResults('257A Test Road', { features: [house] })).toEqual([])
  expect(
    parseAddressResults('257 Test Road', {
      features: [
        { ...house, properties: { ...house.properties, city: '<script>alert(1)</script>' } },
      ],
    })[0]?.label
  ).toContain('<script>')
  expect(() => parseAddressResults('257 Test Road', {})).toThrow(/invalid response/)
})

test('address requests use a cancellable same-origin POST and expose service failures without fabricated matches', async () => {
  const fetchMock = vi
    .fn()
    .mockResolvedValueOnce({ ok: true, json: async () => ({ results: [] }) })
    .mockResolvedValueOnce({ ok: false, json: async () => ({ error: 'Lookup unavailable.' }) })
    .mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        results: [
          { label: 'Glenroy', coordinates: { latitude: -37.8, longitude: 145, source: 'place' } },
        ],
      }),
    })
  vi.stubGlobal('fetch', fetchMock)
  const controller = new AbortController()
  expect(await searchAddresses('257 Test Road', controller.signal)).toEqual([])
  expect(fetchMock).toHaveBeenCalledWith(
    '/api/geocode',
    expect.objectContaining({
      method: 'POST',
      body: JSON.stringify({ query: '257 Test Road' }),
      signal: controller.signal,
    })
  )
  await expect(searchAddresses('257 Test Road')).rejects.toThrow('Lookup unavailable.')
  await expect(searchAddresses('257 Test Road')).rejects.toThrow()
})

test('lookup rejects cross-site and oversized requests while accepting the browser host behind the Next internal URL', async () => {
  const { POST } = await import('@/app/api/geocode/route')
  const request = (body: string, origin = 'http://127.0.0.1:3001') =>
    new Request('http://localhost:3001/api/geocode', {
      method: 'POST',
      headers: { host: '127.0.0.1:3001', origin },
      body,
    })
  expect((await POST(request('{"query":"x"}'))).status).toBe(400)
  expect((await POST(request('{"query":"x"}', 'https://unrelated.example'))).status).toBe(403)
  expect((await POST(request('x'.repeat(2049)))).status).toBe(413)
})
