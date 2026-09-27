'use client'

import { ArrowLeft, Check, ImageOff, MessageSquare } from 'lucide-react'
import { sampleImage, type Incident } from '@/features/hazardwatch/model'
import { ScreenHeader, SeverityBadge } from './ui'

export function ClassificationResult({
  incident,
  onReview,
  onAsk,
}: {
  incident: Incident
  onReview: () => void
  onAsk: () => void
}) {
  return (
    <>
      <a href="#map" className="hw-back">
        <ArrowLeft size={16} /> Back to hazard map
      </a>
      <ScreenHeader
        title={incident.name}
        description={`${incident.area} · Captured 14 Sep 2026, ${incident.time} AEST`}
      />
      <div className="hw-assessment-grid">
        <section className="hw-panel hw-evidence" aria-label="Image evidence">
          {incident.photo ? (
            <img
              className="hw-evidence-image"
              src={sampleImage}
              alt="Flames among trees in the reference photograph"
            />
          ) : (
            <div className="hw-missing-image">
              <ImageOff size={36} />
              <h2>Image not available</h2>
              <p>This sample report has no attached photograph.</p>
            </div>
          )}
          <div className="hw-panel-body">
            <div className="hw-section-heading">
              <h2>Evidence</h2>
              <span className="hw-muted">{incident.id}</span>
            </div>
            <p>{incident.context}</p>
            <dl className="hw-facts">
              <div>
                <dt>Source</dt>
                <dd>{incident.source}</dd>
              </div>
              <div>
                <dt>Supporting images</dt>
                <dd>{incident.images}</dd>
              </div>
              <div>
                <dt>Image quality</dt>
                <dd>{incident.quality}</dd>
              </div>
            </dl>
            {incident.photo && (
              <p className="hw-note">
                Reference photograph; its actual location and capture time are unverified. Katoomba
                is fictional demo context.
              </p>
            )}
          </div>
        </section>
        <section className="hw-panel hw-panel-body" aria-labelledby="hw-classification-title">
          <div className="hw-section-heading">
            <h2 id="hw-classification-title">Sample classification</h2>
            <SeverityBadge severity={incident.severity} />
          </div>
          <p className="hw-classification">{incident.hazard}</p>
          <dl className="hw-result-stats">
            <div>
              <dt>Sample confidence</dt>
              <dd>{incident.confidence}%</dd>
            </div>
            <div>
              <dt>Illustrative area</dt>
              <dd>
                {incident.hectares}
                {incident.hectares !== '—' && <small> ha</small>}
              </dd>
            </div>
          </dl>
          <p className="hw-muted">Prewritten demonstration values, not measured results.</p>
          <h3>Why this needs attention</h3>
          <p>{incident.reason}</p>
          <div className="hw-uncertainty">
            <h3>What remains uncertain</h3>
            <p>{incident.uncertainty}</p>
          </div>
          <div className="hw-stack">
            <button
              className={`hw-button ${incident.reviewed ? 'hw-secondary' : ''}`}
              onClick={onReview}
            >
              <Check size={18} />
              {incident.reviewed ? 'Undo review mark' : 'Mark as reviewed'}
            </button>
            <button className="hw-text-button" onClick={onAsk}>
              <MessageSquare size={17} /> Ask about this priority
            </button>
          </div>
          <p className="hw-note">A review mark records progress. It does not approve a dispatch.</p>
          <details className="hw-details">
            <summary>How to interpret severity</summary>
            <p>
              High: visible flames in the sample. Moderate: smoke requiring confirmation. Low:
              ambiguous evidence requiring verification. Low does not mean safe.
            </p>
          </details>
        </section>
      </div>
    </>
  )
}
