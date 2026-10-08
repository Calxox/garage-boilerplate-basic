'use client'

import Script from 'next/script'
import { useEffect, useRef, useState } from 'react'
import { type Incident } from '@/features/hazardwatch/model'
import { searchAddresses, type PlaceSuggestion } from '@/features/hazardwatch/location'

type MapOptions = {
  items: Incident[]
  searchAddresses: (query: string, signal?: AbortSignal) => Promise<PlaceSuggestion[]>
  order: string[]
  onSelect: (id: string) => void
  onViewChange: (ids: string[]) => void
}
type MapApi = {
  html: () => string
  mount: (options: MapOptions) => void
  destroy: () => void
  reset: () => void
  focusIncident: (item: Incident) => void
}
let appliedReset = -1
let appliedFocus: string | null = null

export function HazardMap({
  items,
  onSelect,
  onVisible,
  resetKey,
  focusId,
}: {
  items: Incident[]
  onSelect: (id: string) => void
  onVisible: (ids: string[]) => void
  resetKey: number
  focusId?: string | null
}) {
  const host = useRef<HTMLDivElement>(null)
  const [ready, setReady] = useState(false)
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading')
  useEffect(() => {
    if (!ready) return
    let disposed = false
    let map: MapApi | undefined
    const container = host.current!
    // Leaflet owns only this element; React owns the surrounding screen and controls.
    import('../../../../public/prototype/map.js')
      .then((module) => {
        if (disposed) return
        map = module.default as unknown as MapApi
        if (appliedReset !== resetKey) {
          map.reset()
          appliedReset = resetKey
          appliedFocus = null
        }
        container.innerHTML = map.html()
        map.mount({
          items,
          searchAddresses,
          order: items.map((item) => item.id),
          onSelect,
          onViewChange: onVisible,
        })
        const focus = items.find((item) => item.id === focusId)
        const focusKey = `${resetKey}:${focusId}`
        if (focus && appliedFocus !== focusKey) {
          map.focusIncident(focus)
          appliedFocus = focusKey
        }
        setStatus('ready')
      })
      .catch(() => {
        if (!disposed) setStatus('error')
      })
    return () => {
      disposed = true
      map?.destroy()
      container.replaceChildren()
    }
  }, [ready, items, onSelect, onVisible, resetKey, focusId])
  return (
    <div className="hw-map">
      <link rel="stylesheet" href="/prototype/assets/leaflet/leaflet.css" />
      <Script
        src="/prototype/assets/leaflet/leaflet.js"
        onReady={() => setReady(true)}
        onError={() => setStatus('error')}
      />
      {status === 'loading' && (
        <p className="hw-map-state" role="status">
          Loading the local map…
        </p>
      )}
      {status === 'error' && (
        <div className="hw-map-state" role="alert">
          <strong>The map could not load.</strong>
          <p>You can still review the reports in the list. Reload this page to try again.</p>
        </div>
      )}
      <div ref={host} hidden={status === 'error'} />
    </div>
  )
}
