import { z } from 'zod'
import demo from '../../../public/prototype/model.js'

export type Severity = 'None' | 'Low' | 'Moderate' | 'High' | 'Extreme'
export type SeverityFilter = Severity | 'All'

/** Notebook-aligned feature keys → display label. */
export function formatFeatureLabel(key: string): string {
  return key.split('_').join(' ')
}

export function featureScoresDescending(
  scores: Record<string, number> | undefined
): [string, number][] {
  if (!scores) return []
  return Object.entries(scores).sort((a, b) => b[1] - a[1])
}
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
  /** Legacy queue blurb; prefer explainability in UI. */
  reason: string
  context: string
  /** HazardWatchAI / vision explainability shown under “Why this needs attention”. */
  explainability: string
  /** Per-feature model confidence 0–100 (shown in assessment panel). */
  keyFeatureScores: Record<string, number>
  uncertainty?: string
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
  'Ground/Citizen',
  'Satellite',
  'Drone/Aerial',
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

export interface MediaAssessment {
  severity: Severity
  confidence: number
  hazard: string
  keyFeatures: string[]
  keyFeatureScores: Record<string, number>
  explainability: string
  modality: string
  inputType: 'image' | 'video'
  framesSampled?: number
  durationSec?: number
}

export interface Report extends ReportContext {
  id: string
  preview: string
  mediaType: 'image' | 'video'
  assessment?: MediaAssessment
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
export function validateMedia(file?: Pick<File, 'type' | 'size'> | null): string {
  if (!file) return 'Choose an image or video to continue.'
  const isImage = ['image/jpeg', 'image/png', 'image/webp'].includes(file.type)
  const isVideo = ['video/mp4', 'video/webm', 'video/quicktime'].includes(file.type)
  if (!isImage && !isVideo) {
    return 'Choose a JPG, PNG, WebP, MP4, WebM or MOV file.'
  }
  if (file.size > 25 * 1024 * 1024) {
    return 'This file is too large. Choose a file under 25 MB.'
  }
  if (!file.size) return 'This file is empty. Choose another file.'
  return ''
}
export const answerQuestion = demo.answerQuestion as (
  question: string,
  items: Incident[],
  selectedId?: string
) => Answer
export const viewLabels: Record<View, string> = {
  overview: 'Overview',
  map: 'Hazard map',
  hazard: 'Hazard assessment',
  reports: 'Media reports',
  assistant: 'Ask HazardWatch',
}
export const prompts = [
  'Rank locations by priority',
  'Why is the top location ranked first?',
  'Compare Katoomba and Wentworth Falls',
]
