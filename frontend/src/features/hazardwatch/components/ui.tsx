'use client'

import { useEffect, useId, useRef, type ReactNode } from 'react'
import { X } from 'lucide-react'
import type { Severity } from '@/features/hazardwatch/model'

export function SeverityBadge({ severity }: { severity: Severity | 'Unassessed' }) {
  return <span className={`hw-badge hw-${severity.toLowerCase()}`}>{severity}</span>
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
