'use client'

import { ArrowLeft, Check, ImageOff, MessageSquare } from 'lucide-react'
import {
  featureScoresDescending,
  formatFeatureLabel,
  sampleImage,
  type Incident,
} from '@/features/hazardwatch/model'
import { ScreenHeader, SeverityBadge, RichText } from './ui'

export function ClassificationResult({
  incident,
  onReview,
  onAsk,
}: {
  incident: Incident
  onReview: () => void
  onAsk: () => void
}) {
  const featureRows = featureScoresDescending(incident.keyFeatureScores)
  const explainability = incident.explainability || incident.reason

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
              src={incident.photo.startsWith('blob:') || incident.photo.startsWith('/') ? incident.photo : sampleImage}
              alt={`Evidence for ${incident.name}`}
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
            <h2 id="hw-classification-title">Classification</h2>
            <SeverityBadge severity={incident.severity} />
          </div>
          <p className="hw-classification">{incident.hazard}</p>
          <dl className="hw-result-stats">
            <div>
              <dt>Severity confidence</dt>
              <dd>{incident.confidence}%</dd>
            </div>
          </dl>
          {featureRows.length > 0 && (
            <div className="hw-feature-scores">
              <h3>Key feature confidences</h3>
              <dl className="hw-feature-score-list">
                {featureRows.map(([key, pct]) => (
                  <div key={key}>
                    <dt>{formatFeatureLabel(key)}</dt>
                    <dd>{Math.round(pct)}%</dd>
                  </div>
                ))}
              </dl>
              {incident.quality === 'Video sample' && (
                <p className="hw-note">
                  For video, each score is the mean feature confidence across sampled frames.
                </p>
              )}
            </div>
          )}
          <h3>Why this needs attention</h3>
          <p className="hw-explainability">
            <RichText text={explainability} />
          </p>
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
              None: no clear bushfire hazard in the assessment. Low: ambiguous evidence requiring
              verification. Moderate: smoke or indirect signs needing confirmation. High: strong
              flame or smoke signals. Extreme: severe, active fire indicators across multiple
              features. Low does not mean safe.
            </p>
          </details>
        </section>
      </div>
    </>
  )
}
