'use client'

import { useEffect, useId, useRef, type ReactNode } from 'react'
import { X } from 'lucide-react'
import type { Severity } from '@/features/hazardwatch/model'

const severityClass: Record<string, string> = {
  unassessed: 'hw-unassessed',
  none: 'hw-none',
  low: 'hw-low',
  moderate: 'hw-moderate',
  high: 'hw-high',
  extreme: 'hw-extreme',
}

export function SeverityBadge({ severity }: { severity: Severity | 'Unassessed' }) {
  const key = severity.toLowerCase()
  const className = severityClass[key] ?? 'hw-unassessed'
  return <span className={`hw-badge ${className}`}>{severity}</span>
}

/** Render lightweight `**bold**` markdown as real bold text. */
export function RichText({ text, className }: { text: string; className?: string }) {
  const parts = text.split(/(\*\*[^*]+\*\*)/g)
  return (
    <span className={className}>
      {parts.map((part, index) =>
        part.startsWith('**') && part.endsWith('**') ? (
          <strong key={index}>{part.slice(2, -2)}</strong>
        ) : (
          <span key={index}>{part}</span>
        )
      )}
    </span>
  )
}

export function ScreenHeader({
  title,
  description,
  action,
}: {
  title: string
  description: string
  action?: ReactNode
}) {
  return (
    <div className="hw-heading">
      <div>
        <h1>{title}</h1>
        <p>{description}</p>
      </div>
      {action}
    </div>
  )
}

export function Modal({
  title,
  onClose,
  children,
}: {
  title: string
  onClose: () => void
  children: ReactNode
}) {
  const dialog = useRef<HTMLDialogElement>(null)
  const titleId = useId()
  useEffect(() => {
    const element = dialog.current!
    const previous = document.activeElement as HTMLElement | null
    element.showModal()
    return () => {
      element.close()
      previous?.focus()
    }
  }, [])
  return (
    <dialog
      ref={dialog}
      className="hw-modal"
      aria-labelledby={titleId}
      onCancel={(event) => {
        event.preventDefault()
        onClose()
      }}
    >
      <div className="hw-modal-heading">
        <h2 id={titleId}>{title}</h2>
        <button
          className="hw-icon-button"
          type="button"
          onClick={onClose}
          aria-label={`Close ${title.toLowerCase()}`}
        >
          <X size={20} />
        </button>
      </div>
      {children}
    </dialog>
  )
}
