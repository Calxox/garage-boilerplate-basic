'use client'

import { useEffect, useRef, useState } from 'react'
import { Check, ImagePlus } from 'lucide-react'
import {
  assessMedia,
  featureScoresAsPercent,
  sourceToModality,
  toUiSeverity,
} from '@/features/hazardwatch/api'
import {
  demoTime,
  reportSchema,
  sampleImage,
  sources,
  validateMedia,
  type MediaAssessment,
  type Report,
  type ReportContext,
} from '@/features/hazardwatch/model'
import { Modal, SeverityBadge, RichText } from './ui'

function hazardLabel(severity: MediaAssessment['severity'], features: string[]): string {
  if (severity === 'None') return 'No bushfire detected'
  if (features.includes('actual_flames')) return 'Active bushfire'
  if (features.some((f) => f.includes('smoke'))) return 'Smoke detected'
  return 'Bushfire indicators'
}

export function ImageUpload({
  onClose,
  onSubmit,
  onViewReport,
}: {
  onClose: () => void
  onSubmit: (report: Omit<Report, 'id'>) => string
  onViewReport: () => void
}) {
  const [step, setStep] = useState(1)
  const [preview, setPreview] = useState('')
  const [mediaType, setMediaType] = useState<'image' | 'video'>('image')
  const [fileName, setFileName] = useState('')
  const [reading, setReading] = useState(false)
  const [assessing, setAssessing] = useState(false)
  const [error, setError] = useState('')
  const [reportId, setReportId] = useState('')
  const [assessment, setAssessment] = useState<MediaAssessment | null>(null)
  const [context, setContext] = useState<ReportContext>({
    location: '',
    date: '2026-09-14T14:28',
    source: 'Ground/Citizen',
    notes: '',
  })
  const selection = useRef(0)
  const currentUrl = useRef('')
  const mediaFile = useRef<File | null>(null)
  const submitted = useRef(false)
  const stepHeading = useRef<HTMLHeadingElement>(null)

  useEffect(
    () => () => {
      selection.current++
      if (!submitted.current && currentUrl.current) URL.revokeObjectURL(currentUrl.current)
    },
    []
  )
  useEffect(() => {
    stepHeading.current?.focus()
  }, [step])

  function replacePreview(url: string, name: string) {
    if (currentUrl.current) URL.revokeObjectURL(currentUrl.current)
    currentUrl.current = url.startsWith('blob:') ? url : ''
    setPreview(url)
    setFileName(name)
    setError('')
    setReading(false)
  }

  async function chooseFile(file?: File) {
    if (!file) return
    const version = ++selection.current
    const problem = validateMedia(file)
    if (problem) {
      setError(problem)
      setReading(false)
      return
    }
    setReading(true)
    setError('')
    const url = URL.createObjectURL(file)
    const isVideo = file.type.startsWith('video/')
    if (isVideo) {
      if (version !== selection.current) {
        URL.revokeObjectURL(url)
        return
      }
      mediaFile.current = file
      setMediaType('video')
      replacePreview(url, file.name)
      return
    }
    try {
      const image = new Image()
      image.src = url
      await image.decode()
      if (version !== selection.current) {
        URL.revokeObjectURL(url)
        return
      }
      mediaFile.current = file
      setMediaType('image')
      replacePreview(url, file.name)
    } catch {
      URL.revokeObjectURL(url)
      if (version === selection.current) {
        setError('This image could not be opened. Choose a valid JPG, PNG or WebP.')
        setReading(false)
      }
    }
  }

  async function runAssessment() {
    if (submitted.current || assessing) return
    const file = mediaFile.current
    if (!file && !preview.startsWith('/')) {
      setError('Choose an image or video first.')
      return
    }
    setAssessing(true)
    setError('')
    try {
      let upload = file
      if (!upload && preview === sampleImage) {
        const res = await fetch(sampleImage)
        const blob = await res.blob()
        upload = new File([blob], 'example-bushfire.jpg', { type: blob.type || 'image/jpeg' })
      }
      if (!upload) throw new Error('No media file available to assess.')

      const result = await assessMedia(upload, mediaType, sourceToModality(context.source))
      const uiSeverity = toUiSeverity(result.severity)
      const scores = featureScoresAsPercent(result.key_feature_scores || {})
      const next: MediaAssessment = {
        severity: uiSeverity,
        confidence: Math.round(result.severity_confidence * 1000) / 10,
        hazard: hazardLabel(uiSeverity, result.key_features || []),
        keyFeatures: result.key_features || [],
        keyFeatureScores: scores,
        explainability:
          result.explainability_note ||
          `Based on the provided ${result.input_type}, severity is **${result.severity}** with **${Math.round(result.severity_confidence * 1000) / 10}%** confidence.`,
        modality: result.modality || sourceToModality(context.source),
        inputType: result.input_type,
        framesSampled: result.frames_sampled ?? undefined,
        durationSec: result.duration_sec ?? undefined,
      }
      submitted.current = true
      setAssessment(next)
      setReportId(
        onSubmit({
          ...context,
          preview,
          mediaType,
          assessment: next,
        })
      )
      setStep(4)
    } catch (err) {
      submitted.current = false
      setError(err instanceof Error ? err.message : 'Assessment failed.')
    } finally {
      setAssessing(false)
    }
  }

  return (
    <Modal title={step === 4 ? 'Assessment complete' : 'Submit media'} onClose={onClose}>
      {step < 4 && (
        <ol className="hw-steps" aria-label="Submission progress">
          {['Media', 'Context', 'Review'].map((label, index) => (
            <li key={label} aria-current={step === index + 1 ? 'step' : undefined}>
              <span>{step > index + 1 ? <Check size={14} /> : index + 1}</span>
              {label}
            </li>
          ))}
        </ol>
      )}
      <div className="hw-modal-body">
        <h3 ref={stepHeading} tabIndex={-1} className="hw-step-heading">
          {
            [
              'Choose your evidence',
              'Add location and time',
              'Check your report',
              'Assessment ready',
            ][step - 1]
          }
        </h3>
        {step === 1 && (
          <form
            onSubmit={(event) => {
              event.preventDefault()
              if (!preview) {
                setError('Choose an image/video or use the example to continue.')
                return
              }
              setError('')
              setStep(2)
            }}
          >
            <div
              className="hw-dropzone"
              onDragOver={(event) => event.preventDefault()}
              onDrop={(event) => {
                event.preventDefault()
                void chooseFile(event.dataTransfer.files[0])
              }}
            >
              {preview ? (
                mediaType === 'video' ? (
                  <video src={preview} controls playsInline />
                ) : (
                  <img src={preview} alt="Selected evidence preview" />
                )
              ) : (
                <>
                  <ImagePlus size={32} />
                  <p>Choose or drop an image/video</p>
                </>
              )}
              <label htmlFor="hw-image">{preview ? 'Change media' : 'Choose media'}</label>
              <input
                id="hw-image"
                type="file"
                accept="image/jpeg,image/png,image/webp,video/mp4,video/webm,video/quicktime"
                onChange={(event) => void chooseFile(event.target.files?.[0])}
                aria-describedby="hw-image-help hw-upload-error"
              />
              <small id="hw-image-help">JPG, PNG, WebP, MP4, WebM or MOV · Up to 25 MB</small>
            </div>
            {fileName && <p className="hw-muted hw-file-name">{fileName}</p>}
            <button
              type="button"
              className="hw-text-button"
              onClick={() => {
                selection.current++
                mediaFile.current = null
                setMediaType('image')
                replacePreview(sampleImage, 'Example bushfire image')
              }}
            >
              Use example image
            </button>
            {reading && <p role="status">Reading media…</p>}
            <p className="hw-note">
              Media is sent to the local vision service for severity assessment when you confirm.
            </p>
            <p id="hw-upload-error" className="hw-error" role="alert">
              {error}
            </p>
            <div className="hw-actions">
              <button type="button" className="hw-button hw-secondary" onClick={onClose}>
                Cancel
              </button>
              <button className="hw-button" disabled={reading}>
                Add context
              </button>
            </div>
          </form>
        )}
        {step === 2 && (
          <form
            onSubmit={(event) => {
              event.preventDefault()
              const result = reportSchema.safeParse(context)
              if (!result.success) {
                setError(result.error.issues[0]?.message ?? 'Check your report details.')
                return
              }
              setContext(result.data)
              setError('')
              setStep(3)
            }}
          >
            <div className="hw-field">
              <label htmlFor="hw-location">
                Location <span>Required</span>
              </label>
              <input
                autoComplete="off"
                id="hw-location"
                required
                maxLength={120}
                value={context.location}
                onChange={(event) => setContext({ ...context, location: event.target.value })}
                placeholder="e.g. Katoomba lookout, NSW"
              />
            </div>
            <div className="hw-form-grid">
              <div className="hw-field">
                <label htmlFor="hw-date">Captured at · AEST</label>
                <input
                  id="hw-date"
                  type="datetime-local"
                  required
                  max={demoTime}
                  value={context.date}
                  onChange={(event) => setContext({ ...context, date: event.target.value })}
                  aria-describedby="hw-date-help"
                />
                <small id="hw-date-help">Demo clock: 14 Sep 2026, 14:32 AEST.</small>
              </div>
              <div className="hw-field">
                <label htmlFor="hw-source">Media source</label>
                <select
                  id="hw-source"
                  value={context.source}
                  onChange={(event) =>
                    setContext({
                      ...context,
                      source: event.target.value as ReportContext['source'],
                    })
                  }
                >
                  {sources.map((source) => (
                    <option key={source}>{source}</option>
                  ))}
                </select>
              </div>
            </div>
            <div className="hw-field">
              <label htmlFor="hw-notes">
                Field notes <span>Optional</span>
              </label>
              <textarea
                id="hw-notes"
                rows={3}
                maxLength={600}
                value={context.notes}
                onChange={(event) => setContext({ ...context, notes: event.target.value })}
                placeholder="Describe what is visible and anything uncertain."
              />
            </div>
            <p className="hw-error" role="alert">
              {error}
            </p>
            <div className="hw-actions">
              <button
                type="button"
                className="hw-button hw-secondary"
                onClick={() => {
                  setError('')
                  setStep(1)
                }}
              >
                Back
              </button>
              <button className="hw-button">Review report</button>
            </div>
          </form>
        )}
        {step === 3 && (
          <>
            <ReportPreview report={{ ...context, preview, id: '', mediaType }} />
            <p className="hw-note">
              Confirming runs the multitask vision model and attaches severity, key-feature
              confidences, and an explainability briefing.
            </p>
            <p className="hw-error" role="alert">
              {error}
            </p>
            <div className="hw-actions">
              <button
                className="hw-button hw-secondary"
                disabled={assessing}
                onClick={() => setStep(2)}
              >
                Back
              </button>
              <button className="hw-button" disabled={assessing} onClick={() => void runAssessment()}>
                {assessing
                  ? mediaType === 'video'
                    ? 'Assessing video…'
                    : 'Assessing image…'
                  : 'Assess severity'}
              </button>
            </div>
          </>
        )}
        {step === 4 && assessment && (
          <div className="hw-success">
            <Check size={36} />
            <strong>{reportId}</strong>
            <SeverityBadge severity={assessment.severity} />
            <p>
              {assessment.hazard} · {assessment.confidence}% confidence
            </p>
            <p className="hw-muted">Refreshing or resetting clears this session report.</p>
            <button className="hw-button" onClick={onViewReport}>
              View my report
            </button>
          </div>
        )}
      </div>
    </Modal>
  )
}

export function ReportPreview({ report }: { report: Report }) {
  const assessment = report.assessment
  return (
    <div className="hw-report-preview">
      {report.mediaType === 'video' ? (
        <video src={report.preview} controls playsInline />
      ) : (
        <img src={report.preview} alt={`Submitted evidence for ${report.location}`} />
      )}
      <div>
        <SeverityBadge severity={assessment?.severity ?? 'Unassessed'} />
        <h3>{report.location}</h3>
        <p>
          {report.id && `${report.id} · `}
          {report.source}
          {report.mediaType === 'video' ? ' · video' : ' · image'}
        </p>
        <p>{report.date.replace('T', ' · ')} AEST</p>
        {assessment && (
          <>
            <p>
              {assessment.hazard} · {assessment.confidence}% confidence
            </p>
            {assessment.keyFeatures.length > 0 && (
              <p className="hw-muted">Features: {assessment.keyFeatures.join(', ')}</p>
            )}
            <p className="hw-notes">
              <RichText text={assessment.explainability} />
            </p>
          </>
        )}
        {report.notes && <p className="hw-notes">{report.notes}</p>}
      </div>
    </div>
  )
}
