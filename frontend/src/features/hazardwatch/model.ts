import { z } from 'zod'
import demo from '../../../public/prototype/model.js'

export type Severity = 'High' | 'Moderate' | 'Low'
export type SeverityFilter = Severity | 'All'
export type View = 'overview' | 'map' | 'hazard' | 'reports' | 'assistant'
export interface Incident {
  id: string
  name: string
  area: string
  severity: Severity
  hazard: string
  confidence: number
  images: number
  time: string
  source: string
  lat: number
  lng: number
  hectares: string
  quality: string
  reviewed: boolean
  photo?: string
  reason: string
  context: string
  uncertainty: string
}
export interface Answer {
  text: string
  refs: string[]
  filter?: Severity
}
export interface Message extends Partial<Answer> {
  role: 'user' | 'assistant'
  text: string
}
export const sampleImage = '/prototype/assets/bushfire-screenshot.png'
export const demoTime = '2026-09-14T14:32'
export const sources = [
  'User upload',
  'Field image',
  'Citizen image',
  'Drone image',
  'CCTV image',
  'Satellite image',
] as const
export const reportSchema = z.object({
  location: z.string().trim().min(1, 'Enter a location.').max(120),
  date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/, 'Enter a capture time.')
    .refine((value) => {
      const date = new Date(value + ':00Z')
      return (
        Number.isFinite(date.getTime()) &&
        date.toISOString().slice(0, 16) === value &&
        value <= demoTime
      )
    }, 'Use a valid time on or before 14 September 2026, 14:32 AEST.'),
  source: z.enum(sources),
  notes: z.string().trim().max(600),
})
export type ReportContext = z.infer<typeof reportSchema>
export interface Report extends ReportContext {
  id: string
  preview: string
}

// Share the existing, tested sample data and query rules with the static prototype.
export const incidents = demo.incidents as Incident[]
export const filterIncidents = demo.filterIncidents as (
  items: Incident[],
  severity?: SeverityFilter,
  query?: string
) => Incident[]
export const validateImage = demo.validateImage as (
  file?: Pick<File, 'type' | 'size'> | null
) => string
export const answerQuestion = demo.answerQuestion as (
  question: string,
  items: Incident[],
  selectedId?: string
) => Answer
export const viewLabels: Record<View, string> = {
  overview: 'Overview',
  map: 'Hazard map',
  hazard: 'Hazard assessment',
  reports: 'Image reports',
  assistant: 'Ask HazardWatch',
}
export const prompts = [
  'Why is Katoomba ranked first?',
  'Show high-severity locations',
  'Compare Katoomba and Wentworth Falls',
]
