import type { Metadata } from 'next'
import { HazardWorkspace } from '@/features/hazardwatch/components/HazardWorkspace'
import '@/features/hazardwatch/hazardwatch.css'

export const metadata: Metadata = {
  title: 'HazardWatch',
  description:
    'Submit bushfire imagery, review assessments and explore approved reports on the HazardWatch map.',
  icons: { icon: '/prototype/assets/hazard-watch-logo.png' },
}

export default function HomePage() {
  return <HazardWorkspace />
}
