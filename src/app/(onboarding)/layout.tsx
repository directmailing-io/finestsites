import { Logo } from '@/components/shared/Logo'

export default function OnboardingLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen flex flex-col" style={{ background: '#FAFAFA' }}>
      <header className="flex items-center justify-center pt-10 pb-2">
        <Logo variant="black" height={26} />
      </header>
      <main className="flex-1 flex items-start justify-center px-4 pt-12 pb-16">
        {children}
      </main>
    </div>
  )
}
