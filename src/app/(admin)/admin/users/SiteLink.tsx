'use client'

export function SiteLink({ username, domain }: { username: string; domain: string }) {
  return (
    <span
      className="inline-flex items-center gap-1 text-xs font-mono cursor-pointer hover:underline"
      style={{ color: '#2563EB' }}
      onClick={e => { e.preventDefault(); e.stopPropagation(); window.open(`https://${username}.${domain}`, '_blank') }}
    >
      <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="flex-shrink-0">
        <circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/>
        <path d="M12 2a15.3 15.3 0 014 10 15.3 15.3 0 01-4 10 15.3 15.3 0 01-4-10 15.3 15.3 0 014-10z"/>
      </svg>
      {username}.{domain}
    </span>
  )
}
