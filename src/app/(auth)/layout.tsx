import { Logo } from '@/components/shared/Logo'

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div
      className="min-h-screen flex flex-col items-center justify-center px-4 py-12"
      style={{ background: '#FAFAFA' }}
    >
      <div className="mb-10">
        <Logo variant="black" height={26} />
      </div>
      <div
        className="w-full max-w-[400px] bg-white rounded-3xl p-8"
        style={{
          boxShadow: '0 2px 24px rgba(0,0,0,0.06), 0 0 0 1px rgba(0,0,0,0.04)',
        }}
      >
        {children}
      </div>
    </div>
  )
}
