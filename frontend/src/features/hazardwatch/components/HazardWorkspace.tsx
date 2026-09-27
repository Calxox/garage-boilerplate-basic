'use client'

import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react'
import { LayoutDashboard, Map, Images, MessageSquare, RotateCcw, Route, X } from 'lucide-react'
import { toast } from 'sonner'
import { ErrorBoundary } from '@/components/shared/ErrorBoundary'
import {
  answerQuestion,
  filterIncidents,
  incidents as seed,
  viewLabels,
  type Message,
  type Report,
  type SeverityFilter,
  type View,
} from '@/features/hazardwatch/model'
import { HazardMap } from './HazardMap'
import { ClassificationResult } from './ClassificationResult'
import { ImageUpload, ReportPreview } from './ImageUpload'
import { AssistantScreen, Overview, PriorityList, ReportFilters, ReportsScreen } from './Screens'
import { Modal, ScreenHeader } from './ui'

const navigation = [
  ['overview', LayoutDashboard],
  ['map', Map],
  ['reports', Images],
  ['assistant', MessageSquare],
] as const
const tour = [
  {
    view: 'overview',
    title: 'Scan the situation',
    text: 'Review the counts and choose a location in the review queue.',
  },
  {
    view: 'map',
    title: 'Locate the evidence',
    text: 'Choose Blue Mountains, filter by severity, and select a report marker.',
  },
  {
    view: 'hazard',
    title: 'Review Katoomba',
    text: 'Read the sample classification and uncertainty, then mark the report reviewed.',
  },
  {
    view: 'assistant',
    title: 'Ask why',
    text: 'Ask why Katoomba is ranked first and follow its evidence link.',
  },
  {
    view: 'reports',
    title: 'Add a field image',
    text: 'Submit an image, add its context, and review the new unassessed report.',
  },
] satisfies { view: View; title: string; text: string }[]

function subscribeView(callback: () => void) {
  window.addEventListener('hashchange', callback)
  return () => window.removeEventListener('hashchange', callback)
}
function readView(): View {
  const value = window.location.hash.slice(1)
  return Object.hasOwn(viewLabels, value) ? (value as View) : 'overview'
}
function navigate(view: View) {
  window.location.hash = view
}

export function HazardWorkspace() {
  const view = useSyncExternalStore(subscribeView, readView, () => 'overview' as View)
  const [incidents, setIncidents] = useState(() => seed.map((item) => ({ ...item })))
  const [selectedId, setSelectedId] = useState('HW-0241')
  const [severity, setSeverity] = useState<SeverityFilter>('All')
  const [query, setQuery] = useState('')
  const [visibleIds, setVisibleIds] = useState<string[] | null>(null)
  const [reports, setReports] = useState<Report[]>([])
  const [messages, setMessages] = useState<Message[]>([])
  const [uploadOpen, setUploadOpen] = useState(false)
  const [previewReport, setPreviewReport] = useState<Report | null>(null)
  const [resetOpen, setResetOpen] = useState(false)
  const [resetKey, setResetKey] = useState(0)
  const [tourStep, setTourStep] = useState<number | null>(null)
  const nextReport = useRef(1)
  const objectUrls = useRef(new Set<string>())
  const main = useRef<HTMLElement>(null)
  const filtered = useMemo(
    () => filterIncidents(incidents, severity, query),
    [incidents, severity, query]
  )
  const visible =
    visibleIds === null ? filtered : filtered.filter((item) => visibleIds.includes(item.id))
  const selected = incidents.find((item) => item.id === selectedId) ?? incidents[0]!
  const step = tourStep === null ? null : tour[tourStep]

  useEffect(() => {
    document.title = `${viewLabels[view]} · HazardWatch`
    main.current?.focus({ preventScroll: true })
  }, [view])
  useEffect(() => {
    const urls = objectUrls.current
    return () => {
      urls.forEach((url) => URL.revokeObjectURL(url))
      urls.clear()
    }
  }, [])
  const selectIncident = useCallback((id: string) => setSelectedId(id), [])
  const onVisible = useCallback((ids: string[]) => setVisibleIds(ids), [])
  function inspect(id: string) {
    setSelectedId(id)
    navigate('hazard')
    window.scrollTo(0, 0)
  }
  function clearFilters() {
    setSeverity('All')
    setQuery('')
    setVisibleIds(null)
    setResetKey((value) => value + 1)
  }
  function ask(question: string) {
    const text = question.trim().slice(0, 500)
    if (!text) return
    setMessages((current) => [
      ...current,
      { role: 'user', text },
      { role: 'assistant', ...answerQuestion(text, incidents, selectedId) },
    ])
    navigate('assistant')
  }
  function addReport(report: Omit<Report, 'id'>) {
    const id = `DEMO-${String(nextReport.current++).padStart(3, '0')}`
    if (report.preview.startsWith('blob:')) objectUrls.current.add(report.preview)
    setReports((current) => [{ ...report, id }, ...current])
    return id
  }
  function reset() {
    objectUrls.current.forEach((url) => URL.revokeObjectURL(url))
    objectUrls.current.clear()
    setIncidents(seed.map((item) => ({ ...item })))
    setSelectedId('HW-0241')
    setReports([])
    setMessages([])
    nextReport.current = 1
    clearFilters()
    setTourStep(null)
    setResetOpen(false)
    navigate('overview')
    toast.success('Demo restored to its original sample data.')
  }
  function moveTour(index: number) {
    const next = tour[index]
    if (!next) {
      setTourStep(null)
      return
    }
    clearFilters()
    setSelectedId('HW-0241')
    setTourStep(index)
    navigate(next.view)
    window.scrollTo(0, 0)
  }

  return (
    <div className="hw-app">
      <a
        href="#hw-main"
        className="hw-skip"
        onClick={(event) => {
          event.preventDefault()
          main.current?.focus()
        }}
      >
        Skip to content
      </a>
      <aside className="hw-sidebar">
        <a href="#overview" className="hw-brand" aria-label="HazardWatch overview">
          <img src="/prototype/assets/hazard-watch-logo.png" alt="" width={34} height={34} />
          <span>
            HazardWatch<small>FIELD INTELLIGENCE</small>
          </span>
        </a>
        <nav aria-label="Main navigation">
          {navigation.map(([key, Icon]) => (
            <a
              key={key}
              href={`#${key}`}
              aria-label={viewLabels[key]}
              aria-current={
                view === key || (key === 'map' && view === 'hazard') ? 'page' : undefined
              }
            >
              <Icon size={20} />
              <span>{viewLabels[key]}</span>
              {key === 'reports' && reports.length > 0 && <b>{reports.length}</b>}
            </a>
          ))}
        </nav>
        <div className="hw-sidebar-bottom">
          <button className="hw-text-button" onClick={() => moveTour(0)}>
            <Route size={18} /> Walk through the journey
          </button>
          <p>
            Incident coordinator
            <br />
            <span>Demo workspace</span>
          </p>
        </div>
      </aside>
      <div className="hw-workspace">
        <header className="hw-topbar">
          <span className="hw-demo-status">
            <i /> Sample data <span>· 14 Sep 2026, 14:32 AEST</span>
          </span>
          <div>
            <button
              className="hw-icon-button hw-mobile-tour"
              aria-label="Start guided tour"
              onClick={() => moveTour(0)}
            >
              <Route size={18} />
            </button>
            <button className="hw-text-button" onClick={() => setResetOpen(true)}>
              <RotateCcw size={16} /> Reset demo
            </button>
          </div>
        </header>
        <main id="hw-main" ref={main} tabIndex={-1} className={step ? 'hw-touring' : ''}>
          <ErrorBoundary>
            {view === 'overview' && (
              <Overview
                items={incidents}
                reportCount={reports.length}
                selectedId={selectedId}
                onSelect={selectIncident}
                onInspect={inspect}
                onUpload={() => setUploadOpen(true)}
              />
            )}
            {view === 'map' && (
              <>
                <ScreenHeader
                  title="Hazard map"
                  description="Explore an area, narrow the reports, and inspect the evidence."
                />
                <ReportFilters
                  severity={severity}
                  query={query}
                  onSeverity={(level) => {
                    setSeverity(level)
                    setVisibleIds(null)
                  }}
                  onQuery={(value) => {
                    setQuery(value)
                    setVisibleIds(null)
                  }}
                  onClear={clearFilters}
                />
                <div className="hw-map-grid">
                  <HazardMap
                    items={filtered}
                    onSelect={selectIncident}
                    onVisible={onVisible}
                    resetKey={resetKey}
                  />
                  <PriorityList
                    items={visible}
                    selectedId={selectedId}
                    onSelect={selectIncident}
                    onInspect={inspect}
                    onClear={clearFilters}
                  />
                </div>
                <p className="hw-note">
                  Five fictional reports in the Blue Mountains. Other areas may have no demo
                  reports.
                </p>
              </>
            )}
            {view === 'hazard' && (
              <ClassificationResult
                incident={selected}
                onReview={() => {
                  setIncidents((current) =>
                    current.map((item) =>
                      item.id === selectedId ? { ...item, reviewed: !item.reviewed } : item
                    )
                  )
                  toast.success(
                    selected.reviewed
                      ? 'Review mark removed.'
                      : 'Marked as reviewed in this session.'
                  )
                }}
                onAsk={() => ask(`Why is ${selected.name} prioritised?`)}
              />
            )}
            {view === 'reports' && (
              <ReportsScreen
                incidents={incidents}
                reports={reports}
                onUpload={() => setUploadOpen(true)}
                onInspect={inspect}
                onPreview={setPreviewReport}
              />
            )}
            {view === 'assistant' && (
              <AssistantScreen
                messages={messages}
                items={incidents}
                onAsk={ask}
                onInspect={inspect}
                onClear={() => setMessages([])}
                onFilter={(level) => {
                  clearFilters()
                  setSeverity(level)
                  navigate('map')
                }}
              />
            )}
          </ErrorBoundary>
        </main>
        <footer className="hw-footer">
          Frontend demo · Fictional data · Human review required
        </footer>
      </div>
      {step && (
        <section className="hw-tour" aria-label="Guided journey">
          <span className="hw-tour-count">
            {tourStep! + 1} / {tour.length}
          </span>
          <div>
            <strong>{step.title}</strong>
            <p>{step.text}</p>
          </div>
          <div className="hw-inline-actions">
            <button
              className="hw-icon-button"
              aria-label="End tour"
              onClick={() => setTourStep(null)}
            >
              <X size={18} />
            </button>
            <button
              className="hw-button hw-secondary"
              disabled={tourStep === 0}
              onClick={() => moveTour(tourStep! - 1)}
            >
              Back
            </button>
            <button className="hw-button" onClick={() => moveTour(tourStep! + 1)}>
              {tourStep === tour.length - 1 ? 'Finish' : 'Next'}
            </button>
          </div>
        </section>
      )}
      {uploadOpen && (
        <ImageUpload
          onClose={() => setUploadOpen(false)}
          onSubmit={addReport}
          onViewReport={() => {
            setUploadOpen(false)
            navigate('reports')
          }}
        />
      )}
      {previewReport && (
        <Modal title="Session report" onClose={() => setPreviewReport(null)}>
          <div className="hw-modal-body">
            <ReportPreview report={previewReport} />
            <p className="hw-note">
              This local image has not been analysed or added to the hazard map.
            </p>
          </div>
        </Modal>
      )}
      {resetOpen && (
        <Modal title="Reset this demo?" onClose={() => setResetOpen(false)}>
          <div className="hw-modal-body">
            <p>
              This clears your session reports, review marks, conversation and tour progress. The
              original sample reports will be restored.
            </p>
            <div className="hw-actions">
              <button className="hw-button hw-secondary" onClick={() => setResetOpen(false)}>
                Keep working
              </button>
              <button className="hw-button" onClick={reset}>
                Reset demo
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  )
}
