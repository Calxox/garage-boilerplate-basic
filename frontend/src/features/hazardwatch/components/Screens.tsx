'use client'

import { useEffect, useRef, useState } from 'react'
import { ArrowRight, Check, ImagePlus, Send } from 'lucide-react'
import { EmptyState } from '@/components/shared/EmptyState'
import {
  prompts,
  sampleImage,
  type Incident,
  type Message,
  type Report,
  type Severity,
  type SeverityFilter,
} from '@/features/hazardwatch/model'
import { ScreenHeader, SeverityBadge } from './ui'

export function PriorityList({
  items,
  selectedId,
  onSelect,
  onInspect,
  onClear,
}: {
  items: Incident[]
  selectedId: string
  onSelect: (id: string) => void
  onInspect: (id: string) => void
  onClear?: () => void
}) {
  const selected = items.find((item) => item.id === selectedId) ?? items[0]
  return (
    <section className="hw-panel hw-priority" aria-label="Review queue">
      <div className="hw-section-heading">
        <h2>Review queue</h2>
        <span className="hw-muted">{items.length} locations</span>
      </div>
      {items.length ? (
        <ol>
          {items.map((item, index) => (
            <li key={item.id}>
              <button
                className="hw-priority-row"
                aria-pressed={selected?.id === item.id}
                onClick={() => onSelect(item.id)}
              >
                <span className="hw-rank">{String(index + 1).padStart(2, '0')}</span>
                <span className="hw-priority-copy">
                  <strong>{item.name}</strong>
                  <small>
                    {item.images} images · {item.time} AEST
                    {item.reviewed && (
                      <span className="hw-reviewed">
                        <Check size={12} /> Reviewed
                      </span>
                    )}
                  </small>
                </span>
                <SeverityBadge severity={item.severity} />
              </button>
            </li>
          ))}
        </ol>
      ) : (
        <EmptyState
          title="No reports in this view"
          description="Try another area or clear the report filters."
          action={
            onClear && (
              <button className="hw-button hw-secondary" onClick={onClear}>
                Clear filters
              </button>
            )
          }
        />
      )}
      {selected && (
        <div className="hw-selection">
          <h3>{selected.name}</h3>
          <p>{selected.reason}</p>
          <button className="hw-text-button" onClick={() => onInspect(selected.id)}>
            Inspect evidence <ArrowRight size={16} />
          </button>
        </div>
      )}
    </section>
  )
}

export function Overview({
  items,
  reportCount,
  selectedId,
  onSelect,
  onInspect,
  onUpload,
}: {
  items: Incident[]
  reportCount: number
  selectedId: string
  onSelect: (id: string) => void
  onInspect: (id: string) => void
  onUpload: () => void
}) {
  const metrics = [
    ['Locations', items.length],
    ['High severity', items.filter((item) => item.severity === 'High').length],
    ['Awaiting review', items.filter((item) => !item.reviewed).length],
    ['Session reports', reportCount],
  ] as const
  return (
    <>
      <ScreenHeader
        title="Bushfire overview"
        description="Find what needs attention, then review the evidence."
        action={
          <button className="hw-button" onClick={onUpload}>
            <ImagePlus size={18} /> Submit an image
          </button>
        }
      />
      <section className="hw-metrics" aria-label="Incident summary">
        {metrics.map(([label, value]) => (
          <div key={label}>
            <span>{label}</span>
            <strong>{String(value).padStart(2, '0')}</strong>
          </div>
        ))}
      </section>
      <div className="hw-overview-grid">
        <PriorityList
          items={items}
          selectedId={selectedId}
          onSelect={onSelect}
          onInspect={onInspect}
        />
        <section className="hw-panel hw-featured">
          <img src={sampleImage} alt="Flames among trees in the reference photograph" />
          <div className="hw-panel-body">
            <div className="hw-section-heading">
              <h2>Katoomba ridge</h2>
              <SeverityBadge severity="High" />
            </div>
            <p>
              Review the highest-priority sample report, its supporting evidence and what remains
              uncertain.
            </p>
            <div className="hw-inline-actions">
              <button className="hw-button" onClick={() => onInspect('HW-0241')}>
                Review evidence <ArrowRight size={16} />
              </button>
              <a href="#map" className="hw-text-button">
                Explore the map
              </a>
            </div>
            <p className="hw-note">Reference image · Fictional incident context.</p>
          </div>
        </section>
      </div>
    </>
  )
}

export function ReportFilters({
  severity,
  query,
  onSeverity,
  onQuery,
  onClear,
}: {
  severity: SeverityFilter
  query: string
  onSeverity: (level: SeverityFilter) => void
  onQuery: (query: string) => void
  onClear: () => void
}) {
  return (
    <div className="hw-filters">
      <div className="hw-filter-levels" role="group" aria-label="Filter by severity">
        {(['All', 'High', 'Moderate', 'Low'] as const).map((level) => (
          <button key={level} aria-pressed={severity === level} onClick={() => onSeverity(level)}>
            {level}
          </button>
        ))}
      </div>
      <div className="hw-filter-search">
        <label htmlFor="hw-report-search" className="hw-sr-only">
          Filter reports
        </label>
        <input
          id="hw-report-search"
          type="search"
          placeholder="Filter reports by name…"
          value={query}
          onChange={(event) => onQuery(event.target.value)}
        />
      </div>
      {(severity !== 'All' || query) && (
        <button className="hw-text-button" onClick={onClear}>
          Clear
        </button>
      )}
    </div>
  )
}

export function ReportsScreen({
  incidents,
  reports,
  onUpload,
  onInspect,
  onPreview,
}: {
  incidents: Incident[]
  reports: Report[]
  onUpload: () => void
  onInspect: (id: string) => void
  onPreview: (report: Report) => void
}) {
  return (
    <>
      <ScreenHeader
        title="Image reports"
        description="Keep evidence and its context together for review."
        action={
          <button className="hw-button" onClick={onUpload}>
            <ImagePlus size={18} /> Submit an image
          </button>
        }
      />
      {!reports.length && (
        <div className="hw-empty-submissions">
          <ImagePlus size={26} />
          <div>
            <h2>No images added in this session</h2>
            <p>Try submitting an image. The five sample reports are available below.</p>
          </div>
          <button className="hw-button hw-secondary" onClick={onUpload}>
            Try a submission
          </button>
        </div>
      )}
      <div
        className="hw-panel hw-table-wrap"
        role="region"
        aria-label="Report register"
        tabIndex={0}
      >
        <table>
          <caption className="hw-sr-only">Sample incidents and session submissions</caption>
          <thead>
            <tr>
              <th>Report / location</th>
              <th>Source & capture time</th>
              <th>Assessment</th>
              <th>Review</th>
              <th>
                <span className="hw-sr-only">Action</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {reports.map((report) => (
              <tr key={report.id}>
                <td>
                  <strong>{report.location}</strong>
                  <small>{report.id} · Added in this session</small>
                </td>
                <td>
                  {report.source}
                  <small>{report.date.replace('T', ' · ')} AEST</small>
                </td>
                <td>
                  <SeverityBadge severity="Unassessed" />
                </td>
                <td>Awaiting assessment</td>
                <td>
                  <button className="hw-text-button" onClick={() => onPreview(report)}>
                    View report <ArrowRight size={15} />
                  </button>
                </td>
              </tr>
            ))}
            {incidents.map((item) => (
              <tr key={item.id}>
                <td>
                  <strong>{item.name}</strong>
                  <small>
                    {item.id} · {item.images} images
                  </small>
                </td>
                <td>
                  {item.source}
                  <small>14 Sep · {item.time} AEST</small>
                </td>
                <td>
                  <SeverityBadge severity={item.severity} />
                </td>
                <td>{item.reviewed ? 'Reviewed' : 'Awaiting review'}</td>
                <td>
                  <button className="hw-text-button" onClick={() => onInspect(item.id)}>
                    Inspect <ArrowRight size={15} />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="hw-note">
        Session submissions remain unassessed and clear on refresh or reset.
      </p>
    </>
  )
}

export function AssistantScreen({
  messages,
  items,
  onAsk,
  onInspect,
  onFilter,
  onClear,
}: {
  messages: Message[]
  items: Incident[]
  onAsk: (question: string) => void
  onInspect: (id: string) => void
  onFilter: (severity: Severity) => void
  onClear: () => void
}) {
  const [question, setQuestion] = useState('')
  const log = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (log.current) log.current.scrollTop = log.current.scrollHeight
  }, [messages])
  return (
    <>
      <ScreenHeader
        title="Ask HazardWatch"
        description="Understand a priority and follow its supporting evidence."
      />
      <section className="hw-panel hw-chat">
        <div className="hw-chat-heading">
          <span>Scripted demo responses</span>
          <button className="hw-text-button" disabled={!messages.length} onClick={onClear}>
            Clear conversation
          </button>
        </div>
        <div
          ref={log}
          className="hw-chat-log"
          role="log"
          aria-label="Conversation"
          aria-live="polite"
        >
          {!messages.length ? (
            <div className="hw-chat-empty">
              <h2>Start with a question.</h2>
              <p>Explain a priority, compare two locations, or find reports by severity.</p>
            </div>
          ) : (
            messages.map((message, index) => (
              <article key={index} className={`hw-message hw-message-${message.role}`}>
                <strong>{message.role === 'user' ? 'You' : 'HazardWatch'}</strong>
                <p>{message.text}</p>
                {message.refs?.length ? (
                  <div className="hw-source-links">
                    {message.refs.map((id) => (
                      <button key={id} className="hw-text-button" onClick={() => onInspect(id)}>
                        {items.find((item) => item.id === id)?.name} <ArrowRight size={14} />
                      </button>
                    ))}
                  </div>
                ) : null}
                {message.filter && (
                  <button className="hw-text-button" onClick={() => onFilter(message.filter!)}>
                    Open filtered hazard map <ArrowRight size={14} />
                  </button>
                )}
              </article>
            ))
          )}
        </div>
        <div className="hw-chat-composer">
          <div className="hw-prompts">
            {prompts.map((prompt) => (
              <button key={prompt} onClick={() => onAsk(prompt)}>
                {prompt}
              </button>
            ))}
          </div>
          <form
            onSubmit={(event) => {
              event.preventDefault()
              if (question.trim()) {
                onAsk(question.trim())
                setQuestion('')
              }
            }}
          >
            <label htmlFor="hw-question" className="hw-sr-only">
              Ask about sample evidence
            </label>
            <input
              id="hw-question"
              maxLength={500}
              required
              placeholder="Ask about a location or its priority…"
              value={question}
              onChange={(event) => setQuestion(event.target.value)}
            />
            <button className="hw-button" aria-label="Send question" disabled={!question.trim()}>
              <Send size={18} />
            </button>
          </form>
          <p className="hw-note">Prewritten sample answers. No connected AI service.</p>
        </div>
      </section>
    </>
  )
}
