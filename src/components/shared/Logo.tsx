import Image from 'next/image'

interface LogoProps {
  variant?: 'black' | 'white'
  height?: number
  className?: string
}

export function Logo({ variant = 'black', height = 28, className = '' }: LogoProps) {
  const width = Math.round(height * (620 / 126))
  return (
    <Image
      src={variant === 'black' ? '/logos/logo-black.svg' : '/logos/logo-white.svg'}
      alt="FinestSites"
      width={width}
      height={height}
      className={className}
      priority
    />
  )
}
