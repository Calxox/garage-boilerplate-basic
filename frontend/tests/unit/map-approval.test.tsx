import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { createRequire } from 'node:module'
import { HazardWorkspace } from '@/features/hazardwatch/components/HazardWorkspace'
import { ClassificationResult } from '@/features/hazardwatch/components/ClassificationResult'
import { reportToIncident, type Incident, type Report } from '@/features/hazardwatch/model'

const fixtures = vi.hoisted(() => ({
  coordinates: {
    latitude: -41.28664,
    longitude: 174.77557,
    source: 'coordinates',
  } as { latitude: number; longitude: number; source: 'coordinates' } | undefined,
  chat: vi.fn(),
}))

vi.mock('@/features/hazardwatch/api', async (importOriginal) => ({
  ...(await importOriginal<object>()),
  chatAboutAssessment: fixtures.chat,
}))
vi.mock('@/features/hazardwatch/components/HazardMap', () => ({
  HazardMap: ({ items }: { items: Incident[] }) => (
    <div aria-label="Test map">
      {items.map((item) => (
        <span
          key={item.id}
          data-testid={`marker-${item.id}`}
          data-lat={item.lat}
          data-lng={item.lng}
        >
          {item.name}
        </span>
      ))}
    </div>
  ),
}))
vi.mock('@/features/hazardwatch/components/ImageUpload', () => ({
  ImageUpload: ({
    onSubmit,
    onClose,
  }: {
    onSubmit: (report: Omit<Report, 'id'>) => string
    onClose: () => void
  }) => (
    <button
      onClick={() => {
        onSubmit({ ...testReport, coordinates: fixtures.coordinates })
        onClose()
      }}
    >
      Submit test media
    </button>
  ),
  ReportPreview: ({ report }: { report: Report }) => <p>Evidence: {report.location}</p>,
}))

const testReport: Omit<Report, 'id'> = {
  location: 'Wellington test report',
  date: '2026-09-14T14:28',
  source: 'Ground/Citizen',
  notes: 'Location reviewed by the operator.',
  coordinates: { latitude: -41.28664, longitude: 174.77557, source: 'coordinates' },
  preview: '/test-evidence.jpg',
  mediaType: 'image',
  assessment: {
    severity: 'High',
    confidence: 85,
    hazard: 'Active bushfire',
    keyFeatures: ['actual_flames'],
    keyFeatureScores: { actual_flames: 85 },
    explainability: 'Flames visible.',
    modality: 'ground',
    inputType: 'image',
  },
}
const testIncident = reportToIncident({ ...testReport, id: 'HW-TEST', approved: true })!

beforeEach(() => {
  fixtures.coordinates = {
    latitude: -41.28664,
    longitude: 174.77557,
    source: 'coordinates',
  }
  fixtures.chat.mockReset()
  window.history.replaceState(null, '', '#overview')
  HTMLDialogElement.prototype.showModal = function () {
    this.open = true
  }
  HTMLDialogElement.prototype.close = function () {
    this.open = false
  }
  window.scrollTo = vi.fn()
})
afterEach(cleanup)

async function openView(name: string, heading: string) {
  fireEvent.click(screen.getByRole('link', { name }))
  await screen.findByRole('heading', { name: heading, level: 1 })
}
async function addReport() {
  fireEvent.click(screen.getByRole('button', { name: 'Submit media' }))
  fireEvent.click(screen.getByRole('button', { name: 'Submit test media' }))
}
async function approveReport() {
  await openView('Media reports', 'Media reports')
  fireEvent.click(screen.getByRole('button', { name: 'Review report' }))
  fireEvent.click(screen.getByRole('button', { name: 'Approve and add to map' }))
  return within(await screen.findByLabelText('Test map')).findByText('Wellington test report')
}
async function setView(view: string) {
  await act(async () => {
    window.history.replaceState(null, '', `#${view}`)
    window.dispatchEvent(new HashChangeEvent('hashchange'))
  })
}

test('every initial workspace view is empty and has no sample data, reset or guided tour', async () => {
  render(<HazardWorkspace />)
  for (const view of ['overview', 'map', 'reports', 'hazard', 'assistant']) {
    await setView(view)
    if (view === 'hazard') {
      expect(screen.getByText('No assessment selected')).toBeInTheDocument()
    } else {
      expect(
        within(screen.getByRole('main')).getByRole('heading', { level: 1 })
      ).toBeInTheDocument()
    }
    expect(screen.queryByText('Something went wrong')).not.toBeInTheDocument()
    expect(screen.queryByText('Katoomba ridge')).not.toBeInTheDocument()
    expect(document.querySelectorAll('[data-testid^="marker-"]')).toHaveLength(0)
    expect(
      screen.queryByText(/sample data|demo workspace|fictional incident/i)
    ).not.toBeInTheDocument()
    expect(
      screen.queryByRole('button', { name: /reset demo|walk through|start guided tour/i })
    ).not.toBeInTheDocument()
    expect(screen.queryByLabelText('Guided journey')).not.toBeInTheDocument()
  }
  expect(screen.getByLabelText('Ask about the selected assessment')).toBeDisabled()
  expect(fixtures.chat).not.toHaveBeenCalled()
})

test('assessed submissions stay off the map until explicit approval, use confirmed coordinates, and can be removed', async () => {
  render(<HazardWorkspace />)
  await addReport()
  await openView('Hazard map', 'Hazard map')
  expect(document.querySelectorAll('[data-testid^="marker-"]')).toHaveLength(0)
  await openView('Media reports', 'Media reports')
  expect(screen.getByText('Pending map approval')).toBeInTheDocument()
  const marker = await approveReport()
  expect(marker.getAttribute('data-testid')).toMatch(/^marker-HW-/)
  expect(marker).toHaveAttribute('data-lat', '-41.28664')
  expect(marker).toHaveAttribute('data-lng', '174.77557')
  expect(document.querySelectorAll('[data-testid^="marker-"]')).toHaveLength(1)
  await openView('Media reports', 'Media reports')
  expect(screen.getByText('Approved for map')).toBeInTheDocument()
  fireEvent.click(screen.getByRole('button', { name: 'Map approval' }))
  fireEvent.click(screen.getByRole('button', { name: 'Remove from map' }))
  expect(screen.getByText('Pending map approval')).toBeInTheDocument()
  fireEvent.click(screen.getByRole('button', { name: 'Close media report' }))
  await openView('Hazard map', 'Hazard map')
  expect(document.querySelectorAll('[data-testid^="marker-"]')).toHaveLength(0)
  await openView('Overview', 'Bushfire overview')
  expect(screen.getByText('Locations').parentElement).toHaveTextContent('00')
  await setView('hazard')
  expect(
    screen.queryByRole('heading', { name: 'Wellington test report', level: 1 })
  ).not.toBeInTheDocument()
  expect(screen.queryByText('Something went wrong')).not.toBeInTheDocument()
  await openView('Ask HazardWatch', 'Ask HazardWatch')
  expect(screen.getByLabelText('Ask about the selected assessment')).toBeDisabled()
})

test('missing or out-of-coverage coordinates keep assessed reports pending and disable map approval', async () => {
  fixtures.coordinates = undefined
  render(<HazardWorkspace />)
  await addReport()
  await openView('Media reports', 'Media reports')
  fireEvent.click(screen.getByRole('button', { name: 'Review report' }))
  expect(screen.getByRole('button', { name: 'Approve and add to map' })).toBeDisabled()
  cleanup()
  window.history.replaceState(null, '', '#overview')
  fixtures.coordinates = {
    latitude: 51.5072,
    longitude: -0.1276,
    source: 'coordinates',
  }
  render(<HazardWorkspace />)
  await addReport()
  await openView('Media reports', 'Media reports')
  fireEvent.click(screen.getByRole('button', { name: 'Review report' }))
  expect(screen.getByRole('button', { name: 'Approve and add to map' })).toBeDisabled()
})

test('clearing a pending conversation discards its late response and allows a new question', async () => {
  let resolve!: (value: { reply: string; refs: string[] }) => void
  fixtures.chat.mockReturnValueOnce(
    new Promise((done) => {
      resolve = done
    })
  )
  render(<HazardWorkspace />)
  await addReport()
  await approveReport()
  await openView('Ask HazardWatch', 'Ask HazardWatch')
  fireEvent.change(screen.getByLabelText('Ask about the selected assessment'), {
    target: { value: 'First question' },
  })
  fireEvent.click(screen.getByRole('button', { name: 'Send question' }))
  await waitFor(() => expect(fixtures.chat).toHaveBeenCalledTimes(1))
  fireEvent.click(screen.getByRole('button', { name: 'Clear conversation' }))
  await act(async () => {
    resolve({ reply: 'Stale reply', refs: [] })
  })
  expect(screen.queryByText('Stale reply')).not.toBeInTheDocument()
  expect(screen.getByLabelText('Ask about the selected assessment')).not.toBeDisabled()
  fixtures.chat.mockResolvedValueOnce({ reply: 'Fresh reply', refs: [] })
  fireEvent.change(screen.getByLabelText('Ask about the selected assessment'), {
    target: { value: 'New question' },
  })
  fireEvent.click(screen.getByRole('button', { name: 'Send question' }))
  await screen.findByText('Fresh reply')
})

test('chat failure shows availability feedback without inventing an answer or evidence source', async () => {
  fixtures.chat.mockRejectedValueOnce(new Error('Chat service unavailable'))
  render(<HazardWorkspace />)
  await addReport()
  await approveReport()
  await openView('Ask HazardWatch', 'Ask HazardWatch')
  fireEvent.change(screen.getByLabelText('Ask about the selected assessment'), {
    target: { value: 'Why is this location high priority?' },
  })
  fireEvent.click(screen.getByRole('button', { name: 'Send question' }))
  expect(await screen.findByRole('alert')).toHaveTextContent('Chat service unavailable')
  expect(fixtures.chat).toHaveBeenCalledTimes(1)
  const conversation = screen.getByRole('log', { name: 'Conversation' })
  expect(within(conversation).getByText('Why is this location high priority?')).toBeInTheDocument()
  expect(conversation.querySelectorAll('article')).toHaveLength(1)
  expect(within(conversation).queryByText('HazardWatchAI')).not.toBeInTheDocument()
  expect(within(conversation).queryByRole('button')).not.toBeInTheDocument()
  expect(screen.getByLabelText('Ask about the selected assessment')).not.toBeDisabled()
})

test('uploaded video assessments retain video evidence and their own capture date', () => {
  render(
    <ClassificationResult
      incident={{
        ...testIncident,
        name: 'Uploaded Wellington clip',
        photo: undefined,
        video: 'blob:video-evidence',
        capturedAt: '2026-10-06T11:22',
        locationSource: 'quicktime',
      }}
      onReview={() => {}}
      onAsk={() => {}}
    />
  )
  expect(screen.getByLabelText('Video evidence for Uploaded Wellington clip')).toHaveAttribute(
    'src',
    'blob:video-evidence'
  )
  expect(screen.getByText(/Captured 2026-10-06 · 11:22/)).toBeInTheDocument()
  expect(screen.queryByText('Image not available')).not.toBeInTheDocument()
  expect(screen.queryByText(/Reference photograph/)).not.toBeInTheDocument()
})

test('the map preserves offline locations, plots actual report coordinates and selects full addresses without stale results', async () => {
  const mapApi = createRequire(import.meta.url)('../../public/prototype/map.js')
  const plots: { point: number[]; icon: { className: string; html: string } }[] = []
  const layer = { clearLayers() {}, addTo: () => layer }
  const fakeMap = {
    stop() {},
    fitBounds() {},
    createPane() {},
    getPane: () => ({ style: {} }),
    on() {},
    off() {},
    remove() {},
    getCenter: () => ({ lat: -25, lng: 135 }),
    getZoom: () => 2,
    setView: vi.fn(),
    attributionControl: { addAttribution() {} },
    getBounds: () => ({
      contains: ([lat, lng]: number[]) => lat! >= -50 && lat! <= -8 && lng! >= 110 && lng! <= 190,
    }),
  }
  const originalL = Reflect.get(window, 'L')
  Reflect.set(window, 'L', {
    map: () => fakeMap,
    layerGroup: () => layer,
    geoJSON: () => layer,
    circleMarker: () => ({ addTo() {} }),
    divIcon: (icon: object) => icon,
    marker: (point: number[], options: { icon: { className: string; html: string } }) => {
      plots.push({ point, icon: options.icon })
      const marker = { on: () => marker, addTo: () => marker, bindTooltip: () => marker }
      return marker
    },
  })
  const container = document.createElement('div')
  document.body.append(container)
  const items = [
    { ...testIncident, id: 'SYD', name: 'Sydney', lat: -33.87, lng: 151.21 },
    { ...testIncident, id: 'WLG', name: 'Wellington', lat: -41.28, lng: 174.77 },
    { ...testIncident, id: 'CHT', name: 'Chatham', lat: -43.95, lng: -176.5 },
    { ...testIncident, id: 'BAD', lat: NaN, lng: 150 },
  ]
  try {
    mapApi.reset()
    container.innerHTML = mapApi.html()
    const visible = vi.fn()
    const searchAddresses = vi.fn()
    mapApi.mount({
      searchAddresses,
      items,
      order: items.map((item) => item.id),
      onSelect() {},
      onViewChange: visible,
    })
    const hazards = plots.filter((plot) => plot.icon.className.includes('hazard-marker'))
    expect(hazards.map((plot) => plot.point)).toEqual([
      [-33.87, 151.21],
      [-41.28, 174.77],
      [-43.95, 183.5],
    ])
    expect(hazards.map((plot) => plot.icon.html)).toEqual([
      '<span>1</span>',
      '<span>2</span>',
      '<span>3</span>',
    ])
    expect(visible).toHaveBeenCalledWith(['SYD', 'WLG', 'CHT'])
    mapApi.focusIncident(items[2])
    expect(fakeMap.setView).toHaveBeenCalledWith([-43.95, 183.5], 12, { animate: false })
    expect(items[2]!.lng).toBe(-176.5)
    expect(container.querySelector('[data-area-scope="blue"]')).toBeNull()
    const address = {
      label: '257 Test Road, Glenroy, Victoria, Australia',
      coordinates: { latitude: -37.81, longitude: 144.96, source: 'address' },
    }
    searchAddresses.mockResolvedValueOnce([address])
    const field = container.querySelector('#area-query') as HTMLInputElement
    const form = container.querySelector('#area-search-form')!
    fireEvent.input(field, { target: { value: '257 Test Road' } })
    expect(searchAddresses).not.toHaveBeenCalled()
    fireEvent.submit(form)
    const match = await within(container).findByRole('button', { name: new RegExp(address.label) })
    fireEvent.click(match)
    expect(fakeMap.setView).toHaveBeenCalledWith([-37.81, 144.96], 16, { animate: false })
    expect(container.querySelector('#selected-area-label')).toHaveTextContent(address.label)
    let resolve!: (value: (typeof address)[]) => void
    searchAddresses.mockReturnValueOnce(
      new Promise((done) => {
        resolve = done
      })
    )
    fireEvent.input(field, { target: { value: '258 Test Road' } })
    fireEvent.submit(form)
    const signal = searchAddresses.mock.calls[1]![1] as AbortSignal
    fireEvent.click(within(container).getByRole('button', { name: /^Australia$/ }))
    expect(signal.aborted).toBe(true)
    await act(async () => resolve([address]))
    expect(container.querySelector('[data-address-index]')).toBeNull()
    fireEvent.input(field, { target: { value: 'Glenroy' } })
    fireEvent.submit(form)
    expect(searchAddresses).toHaveBeenCalledTimes(2)
    expect(container.querySelector('[data-area-index]')).not.toBeNull()
    expect(mapApi.parseCoordinates('-40, -170')).toEqual({ lat: -40, lng: 190 })
    mapApi.focusIncident({ ...items[2], lng: -170 })
    expect(fakeMap.setView).toHaveBeenCalledWith([-43.95, 190], 12, { animate: false })
  } finally {
    mapApi.reset()
    container.remove()
    Reflect.set(window, 'L', originalL)
  }
})
