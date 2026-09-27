'use client'

import { useEffect, useRef, useState } from 'react'
import { Check, ImagePlus } from 'lucide-react'
import {
  demoTime,
  reportSchema,
  sampleImage,
  sources,
  validateImage,
  type Report,
  type ReportContext,
} from '@/features/hazardwatch/model'
import { Modal, SeverityBadge } from './ui'

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
  const [fileName, setFileName] = useState('')
  const [reading, setReading] = useState(false)
  const [error, setError] = useState('')
  const [reportId, setReportId] = useState('')
  const [context, setContext] = useState<ReportContext>({
    location: '',
    date: '2026-09-14T14:28',
    source: 'User upload',
    notes: '',
  })
  const selection = useRef(0)
  const currentUrl = useRef('')
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
    const problem = validateImage(file)
    if (problem) {
      setError(problem)
      setReading(false)
      return
    }
    setReading(true)
    setError('')
    const url = URL.createObjectURL(file)
    try {
      const image = new Image()
      image.src = url
      await image.decode()
      if (version !== selection.current) {
        URL.revokeObjectURL(url)
        return
      }
      replacePreview(url, file.name)
    } catch {
      URL.revokeObjectURL(url)
      if (version === selection.current) {
        setError('This image could not be opened. Choose a valid JPG, PNG or WebP.')
        setReading(false)
      }
    }
  }

  return (
    <Modal title={step === 4 ? 'Report added' : 'Submit an image'} onClose={onClose}>
      {step < 4 && (
        <ol className="hw-steps" aria-label="Submission progress">
          {['Image', 'Context', 'Review'].map((label, index) => (
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
              'Ready for human assessment',
            ][step - 1]
          }
        </h3>
        {step === 1 && (
          <form
            onSubmit={(event) => {
              event.preventDefault()
              if (!preview) {
                setError('Choose an image or use the example to continue.')
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
                <img src={preview} alt="Selected evidence preview" />
              ) : (
                <>
                  <ImagePlus size={32} />
                  <p>Choose or drop an image</p>
                </>
              )}
              <label htmlFor="hw-image">{preview ? 'Change image' : 'Choose an image'}</label>
              <input
                id="hw-image"
                type="file"
                accept="image/jpeg,image/png,image/webp"
                onChange={(event) => void chooseFile(event.target.files?.[0])}
                aria-describedby="hw-image-help hw-upload-error"
              />
              <small id="hw-image-help">JPG, PNG or WebP · Up to 10 MB</small>
            </div>
            {fileName && <p className="hw-muted hw-file-name">{fileName}</p>}
            <button
              type="button"
              className="hw-text-button"
              onClick={() => {
                selection.current++
                replacePreview(sampleImage, 'Example bushfire image')
              }}
            >
              Use example image
            </button>
            {reading && <p role="status">Reading image…</p>}
            <p className="hw-note">
              Images stay in this browser session. Nothing is uploaded or analysed.
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
                <label htmlFor="hw-source">Image source</label>
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
            <ReportPreview report={{ ...context, preview, id: '' }} />
            <p className="hw-note">
              This adds a local report marked Unassessed. No classification or map marker is
              generated.
            </p>
            <div className="hw-actions">
              <button className="hw-button hw-secondary" onClick={() => setStep(2)}>
                Back
              </button>
              <button
                className="hw-button"
                onClick={() => {
                  if (submitted.current) return
                  submitted.current = true
                  setReportId(onSubmit({ ...context, preview }))
                  setStep(4)
                }}
              >
                Add demo report
              </button>
            </div>
          </>
        )}
        {step === 4 && (
          <div className="hw-success">
            <Check size={36} />
            <strong>{reportId}</strong>
            <SeverityBadge severity="Unassessed" />
            <p>Your image and context are in the report register.</p>
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
  return (
    <div className="hw-report-preview">
      <img src={report.preview} alt={`Submitted evidence for ${report.location}`} />
      <div>
        <SeverityBadge severity="Unassessed" />
        <h3>{report.location}</h3>
        <p>
          {report.id && `${report.id} · `}
          {report.source}
        </p>
        <p>{report.date.replace('T', ' · ')} AEST</p>
        {report.notes && <p className="hw-notes">{report.notes}</p>}
      </div>
    </div>
  )
}
