import { z } from 'zod'
import { parseAddressResults, type PlaceSuggestion } from '@/features/hazardwatch/location'

export const runtime = 'nodejs'
const querySchema = z.object({ query: z.string().trim().min(4).max(240) }).strict()
// ponytail: one-process cache/throttle for modest usage; share these before scaling to multiple workers.
const cache = new Map<string, { expires: number; results: PlaceSuggestion[] }>()
let lastRequest = 0
let busy = false
const reply = (body: object, status = 200) =>
  Response.json(body, {
    status,
    headers: { 'Cache-Control': 'no-store', ...(status === 429 ? { 'Retry-After': '1' } : {}) },
  })

export async function POST(request: Request) {
  const origin = request.headers.get('origin')
  // Next's internal URL may use localhost while the browser uses 127.0.0.1.
  const host = request.headers.get('host') || new URL(request.url).host
  if (origin && ![`http://${host}`, `https://${host}`].includes(origin))
    return reply({ error: 'Use address search from this website.' }, 403)
  let query: string
  try {
    const reader = request.body?.getReader()
    if (!reader) return reply({ error: 'Enter an address.' }, 400)
    const decoder = new TextDecoder('utf-8', { fatal: true })
    let text = '',
      size = 0
    while (true) {
      const chunk = await reader.read()
      if (chunk.done) break
      size += chunk.value.byteLength
      if (size > 2048) {
        await reader.cancel()
        return reply({ error: 'Address search input is too large.' }, 413)
      }
      text += decoder.decode(chunk.value, { stream: true })
    }
    query = querySchema.parse(JSON.parse(text + decoder.decode())).query
  } catch {
    return reply({ error: 'Enter an address between 4 and 240 characters.' }, 400)
  }
  const key = query.replace(/\s+/g, ' ').toLowerCase()
  const existing = cache.get(key)
  if (existing && existing.expires > Date.now()) return reply({ results: existing.results })
  if (busy || Date.now() - lastRequest < 1000)
    return reply({ error: 'Please wait a moment before another address search.' }, 429)
  lastRequest = Date.now()
  busy = true
  try {
    const endpoint = new URL(process.env.PHOTON_API_URL || 'https://photon.komoot.io/api/')
    if (!['http:', 'https:'].includes(endpoint.protocol)) throw new Error('Invalid lookup URL')
    endpoint.search = new URLSearchParams({
      q: query,
      limit: '8',
      lang: 'en',
      layer: 'house',
    }).toString()
    endpoint.searchParams.append('countrycode', 'AU')
    endpoint.searchParams.append('countrycode', 'NZ')
    const response = await fetch(endpoint, {
      cache: 'no-store',
      headers: { Accept: 'application/json', 'User-Agent': 'HazardWatch/1.0 (address search)' },
      signal: AbortSignal.any([request.signal, AbortSignal.timeout(8000)]),
    })
    if (!response.ok)
      return reply({ error: 'Address lookup is unavailable. Try again or enter coordinates.' }, 503)
    const results = parseAddressResults(query, await response.json())
    if (cache.size >= 100) cache.delete(cache.keys().next().value!)
    cache.set(key, { expires: Date.now() + 10 * 60 * 1000, results })
    return reply({ results })
  } catch {
    return reply({ error: 'Address lookup is unavailable. Try again or enter coordinates.' }, 503)
  } finally {
    busy = false
  }
}
