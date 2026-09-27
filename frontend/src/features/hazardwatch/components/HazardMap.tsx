'use client'

import Script from 'next/script'
import { useEffect, useRef, useState } from 'react'
import { incidents, type Incident } from '@/features/hazardwatch/model'

type MapOptions = {
  items: Incident[]
  order: string[]
  onSelect: (id: string) => void
  onViewChange: (ids: string[]) => void
}
type MapApi = {
  html: () => string
  mount: (options: MapOptions) => void
  destroy: () => void
  reset: () => void
}
let appliedReset = -1

export function HazardMap({
  items,
  onSelect,
  onVisible,
  resetKey,
}: {
  items: Incident[]
  onSelect: (id: string) => void
  onVisible: (ids: string[]) => void
  resetKey: number
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
        }
        container.innerHTML = map.html()
        map.mount({
          items,
          order: incidents.map((item) => item.id),
          onSelect,
          onViewChange: onVisible,
        })
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
  }, [ready, items, onSelect, onVisible, resetKey])
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
