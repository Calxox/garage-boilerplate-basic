import type { Metadata } from 'next'
import { HazardWorkspace } from '@/features/hazardwatch/components/HazardWorkspace'
import '@/features/hazardwatch/hazardwatch.css'

export const metadata: Metadata = {
  title: 'HazardWatch',
  description:
    'Review bushfire evidence, explore locations and submit imagery in the HazardWatch frontend demo.',
  icons: { icon: '/prototype/assets/hazard-watch-logo.png' },
}

export default function HomePage() {
  return <HazardWorkspace />
}
