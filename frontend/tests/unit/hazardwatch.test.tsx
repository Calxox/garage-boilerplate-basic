import { fireEvent, render, screen } from '@testing-library/react'
import { expect, test, vi } from 'vitest'
import { ImageUpload } from '@/features/hazardwatch/components/ImageUpload'
import { reportSchema, type Report } from '@/features/hazardwatch/model'

test('a submission validates context, preserves edits and creates one unassessed report', () => {
  HTMLDialogElement.prototype.showModal = function () {
    this.open = true
  }
  HTMLDialogElement.prototype.close = function () {
    this.open = false
  }
  const submit = vi.fn<(report: Omit<Report, 'id'>) => string>(() => 'DEMO-001')
  const rendered = render(
    <ImageUpload onClose={() => {}} onSubmit={submit} onViewReport={() => {}} />
  )
  fireEvent.click(screen.getByRole('button', { name: 'Add context' }))
  expect(screen.getByRole('alert')).toHaveTextContent('Choose an image')
  fireEvent.click(screen.getByRole('button', { name: 'Use example image' }))
  fireEvent.click(screen.getByRole('button', { name: 'Add context' }))
  fireEvent.change(screen.getByLabelText(/Location/), { target: { value: '   ' } })
  fireEvent.click(screen.getByRole('button', { name: 'Review report' }))
  expect(screen.getByRole('alert')).toHaveTextContent('Enter a location')
  fireEvent.change(screen.getByLabelText(/Location/), { target: { value: ' Katoomba lookout ' } })
  fireEvent.change(screen.getByLabelText(/Field notes/), {
    target: { value: 'Smoke visible; extent uncertain.' },
  })
  fireEvent.click(screen.getByRole('button', { name: 'Review report' }))
  fireEvent.click(screen.getByRole('button', { name: 'Back' }))
  expect(screen.getByLabelText(/Location/)).toHaveValue('Katoomba lookout')
  expect(screen.getByLabelText(/Field notes/)).toHaveValue('Smoke visible; extent uncertain.')
  fireEvent.click(screen.getByRole('button', { name: 'Review report' }))
  fireEvent.click(screen.getByRole('button', { name: 'Add demo report' }))
  expect(submit).toHaveBeenCalledTimes(1)
  expect(submit).toHaveBeenCalledWith(
    expect.objectContaining({
      location: 'Katoomba lookout',
      preview: '/prototype/assets/bushfire-screenshot.png',
    })
  )
  expect(screen.getByText('Unassessed')).toBeInTheDocument()
  const context = submit.mock.calls[0]![0]
  expect(reportSchema.safeParse({ ...context, date: '2026-02-30T12:00' }).success).toBe(false)
  expect(reportSchema.safeParse({ ...context, date: '2026-09-15T12:00' }).success).toBe(false)
  rendered.unmount()
})
