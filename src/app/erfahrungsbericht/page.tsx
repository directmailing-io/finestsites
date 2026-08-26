import type { Metadata } from 'next'
import Wizard from './Wizard'

export const metadata: Metadata = {
  title: 'Dein Erfahrungsbericht · FinestSites',
  description: 'Teile deine Erfahrung mit der Community und sichere dir deine kostenlose Fallstudien-Seite bei FinestSites.',
}

export default function ErfahrungsberichtPage() {
  return <Wizard />
}
