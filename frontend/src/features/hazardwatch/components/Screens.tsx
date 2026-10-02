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
import { ScreenHeader, SeverityBadge, RichText } from './ui'

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
          <p>
            <RichText text={selected.explainability || selected.reason} />
          </p>
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
    ['High + extreme', items.filter((item) => item.severity === 'High' || item.severity === 'Extreme').length],
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
            <ImagePlus size={18} /> Submit media
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
              Review the highest-priority sample report, its key feature confidences, and the
              HazardWatchAI explainability briefing.
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
        {(['All', 'Extreme', 'High', 'Moderate', 'Low', 'None'] as const).map((level) => (
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
  const sessionIds = new Set(reports.map((report) => report.id))
  const sampleIncidents = incidents.filter((item) => !sessionIds.has(item.id))

  return (
    <>
      <ScreenHeader
        title="Media reports"
        description="Keep evidence and its context together for review."
        action={
          <button className="hw-button" onClick={onUpload}>
            <ImagePlus size={18} /> Submit media
          </button>
        }
      />
      {!reports.length && (
        <div className="hw-empty-submissions">
          <ImagePlus size={26} />
          <div>
            <h2>No media added in this session</h2>
            <p>Try submitting image/video evidence. The sample reports are available below.</p>
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
                  <small>
                    {report.id} · Added in this session · {report.mediaType}
                  </small>
                </td>
                <td>
                  {report.source}
                  <small>{report.date.replace('T', ' · ')} AEST</small>
                </td>
                <td>
                  <SeverityBadge severity={report.assessment?.severity ?? 'Unassessed'} />
                </td>
                <td>
                  {report.assessment
                    ? `${report.assessment.hazard} · ${report.assessment.confidence}%`
                    : 'Awaiting assessment'}
                </td>
                <td>
                  {report.assessment ? (
                    <button className="hw-text-button" onClick={() => onInspect(report.id)}>
                      Inspect <ArrowRight size={15} />
                    </button>
                  ) : (
                    <button className="hw-text-button" onClick={() => onPreview(report)}>
                      View report <ArrowRight size={15} />
                    </button>
                  )}
                </td>
              </tr>
            ))}
            {sampleIncidents.map((item) => (
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
        Session assessments clear on refresh or reset. Sample reports remain below.
      </p>
    </>
  )
}

export function AssistantScreen({
  messages,
  items,
  busy = false,
  onAsk,
  onInspect,
  onFilter,
  onClear,
}: {
  messages: Message[]
  items: Incident[]
  busy?: boolean
  onAsk: (question: string) => void
  onInspect: (id: string) => void
  onFilter: (severity: Severity) => void
  onClear: () => void
}) {
  const [question, setQuestion] = useState('')
  const log = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (log.current) log.current.scrollTop = log.current.scrollHeight
  }, [messages, busy])
  return (
    <>
      <ScreenHeader
        title="Ask HazardWatch"
        description="Ask about severity and features, or rank / compare locations in the review queue."
      />
      <section className="hw-panel hw-chat">
        <div className="hw-chat-heading">
          <span>HazardWatchAI · selected report + full review queue</span>
          <button className="hw-text-button" disabled={!messages.length || busy} onClick={onClear}>
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
          {!messages.length && !busy ? (
            <div className="hw-chat-empty">
              <h2>Start with a question.</h2>
              <p>
                Ask about the selected report, rank the review queue, explain why a location is
                first, or compare two sites.
              </p>
            </div>
          ) : (
            messages.map((message, index) => (
              <article key={index} className={`hw-message hw-message-${message.role}`}>
                <strong>{message.role === 'user' ? 'You' : 'HazardWatchAI'}</strong>
                <p>
                  <RichText text={message.text} />
                </p>
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
          {busy && (
            <article className="hw-message hw-message-assistant">
              <strong>HazardWatchAI</strong>
              <p role="status">Thinking…</p>
            </article>
          )}
        </div>
        <div className="hw-chat-composer">
          <div className="hw-prompts">
            {prompts.map((prompt) => (
              <button key={prompt} disabled={busy} onClick={() => onAsk(prompt)}>
                {prompt}
              </button>
            ))}
          </div>
          <form
            onSubmit={(event) => {
              event.preventDefault()
              if (question.trim() && !busy) {
                onAsk(question.trim())
                setQuestion('')
              }
            }}
          >
            <label htmlFor="hw-question" className="hw-sr-only">
              Ask about the selected assessment
            </label>
            <input
              id="hw-question"
              maxLength={500}
              required
              disabled={busy}
              placeholder="Ask to rank, compare, or explain a priority…"
              value={question}
              onChange={(event) => setQuestion(event.target.value)}
            />
            <button
              className="hw-button"
              aria-label="Send question"
              disabled={busy || !question.trim()}
            >
              <Send size={18} />
            </button>
          </form>
          <p className="hw-note">
            Live HazardWatchAI replies via the vision service (watsonx when configured).
          </p>
        </div>
      </section>
    </>
  )
}
