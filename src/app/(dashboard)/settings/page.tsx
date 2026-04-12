export default function SettingsPage() {
  return (
    <div className="max-w-2xl">
      <h1 className="text-2xl font-semibold text-gray-900 mb-2">Einstellungen</h1>
      <p className="text-sm mb-8" style={{ color: 'var(--muted-foreground)' }}>
        Verwalte deinen Account und dein Abonnement.
      </p>
      <div className="grid gap-4">
        {[
          { href: '/settings', label: 'Passwort ändern', desc: 'Ändere dein Login-Passwort', icon: '🔐' },
          { href: '/settings/billing', label: 'Abonnement & Rechnungen', desc: 'Plan, Zahlungen, Rechnungen', icon: '💳' },
        ].map(item => (
          <a key={item.href} href={item.href}
            className="flex items-center gap-4 p-5 rounded-[24px] bg-white transition-all"
            style={{ boxShadow: 'var(--shadow-card)', border: '1px solid var(--border)' }}>
            <div className="w-12 h-12 rounded-[16px] flex items-center justify-center text-2xl flex-shrink-0"
              style={{ background: '#F3F4F6' }}>
              {item.icon}
            </div>
            <div>
              <div className="font-medium text-gray-900 text-sm">{item.label}</div>
              <div className="text-xs mt-0.5" style={{ color: 'var(--muted-foreground)' }}>{item.desc}</div>
            </div>
            <svg className="ml-auto" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#9CA3AF" strokeWidth="1.5">
              <polyline points="9 18 15 12 9 6"/>
            </svg>
          </a>
        ))}
      </div>
    </div>
  )
}
