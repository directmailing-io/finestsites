import { Logo } from '@/components/shared/Logo'

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen flex" style={{ background: 'var(--background)' }}>
      {/* Left: Decorative panel */}
      <div className="hidden lg:flex lg:w-[440px] flex-col justify-between p-12 relative overflow-hidden"
        style={{ background: 'linear-gradient(145deg, #1a1a1a 0%, #2d2d2d 100%)' }}>
        {/* Subtle decorative circles */}
        <div className="absolute -top-32 -left-32 w-80 h-80 rounded-full opacity-10"
          style={{ background: 'radial-gradient(circle, #ffffff, transparent)' }} />
        <div className="absolute -bottom-20 -right-20 w-64 h-64 rounded-full opacity-10"
          style={{ background: 'radial-gradient(circle, #7C3AED, transparent)' }} />

        <Logo variant="white" height={28} />

        <div>
          <p className="text-white/90 text-2xl font-light leading-relaxed mb-6">
            Deine professionelle Website,<br />
            <span className="text-white font-medium">fertig in Minuten.</span>
          </p>
          <div className="flex flex-col gap-3">
            {[
              'Kein Programmieren nötig',
              'Kein Design-Wissen nötig',
              'Hosting & SSL inklusive',
            ].map((item) => (
              <div key={item} className="flex items-center gap-3">
                <div className="w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0"
                  style={{ background: 'rgba(255,255,255,0.15)' }}>
                  <svg width="10" height="8" viewBox="0 0 10 8" fill="none">
                    <path d="M1 4L3.5 6.5L9 1" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                </div>
                <span className="text-white/70 text-sm">{item}</span>
              </div>
            ))}
          </div>
        </div>

        <p className="text-white/30 text-xs">
          © 2025 FinestSites. Alle Rechte vorbehalten.
        </p>
      </div>

      {/* Right: Auth form */}
      <div className="flex-1 flex items-center justify-center p-6 lg:p-12">
        <div className="w-full max-w-[400px]">
          {/* Mobile logo */}
          <div className="flex justify-center mb-10 lg:hidden">
            <Logo variant="black" height={24} />
          </div>
          {children}
        </div>
      </div>
    </div>
  )
}
