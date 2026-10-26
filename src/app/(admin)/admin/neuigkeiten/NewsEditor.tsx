'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import type { NewsCtaKind } from '@/lib/contracts/app-v1/news'
import { NEWS_LIMITS, type NewsAudience } from '@/lib/news/admin-schema'
import { findBlockedWords } from '@/components/news/blocked-words'
import { NEWS_CTA_KIND_LABELS, NEWS_TOKENS, formatNewsDateTime } from '@/components/news/news-ui'
import { NewsDetailCard, newsPrimaryButtonStyle, newsQuietLinkStyle } from '@/components/news/NewsDetailCard'
import { AndroidCardPreview, IphoneLockPreview } from '@/components/news/NewsPreview'
import { adminFetch, AdminApiError, ConfirmDialog, StatusPill, expiresToDay, formatExpiresShort, isExpired, type AdminNewsItem, type AudienceUser } from './_lib'

/**
 * Editor für eine Neuigkeit (neu oder bestehend): links Formular mit Zählern und Wortwarnung,
 * rechts Live-Vorschau (iPhone-Sperrbildschirm, Android-Karte, Neuigkeit in der App) + Reichweite.
 * Knopf: Häkchen „Knopf anzeigen“ → Ziel + Text. Empfänger: Alle · Starter · Pro · Unlimited · Bestimmte Nutzer
 * (Kontosuche mit Chips, zum Testen). „Sichtbar bis“: optionales Datum, danach verschwindet die Neuigkeit von selbst.
 * Aktionen: Entwurf speichern · Test an mein iPhone · Veröffentlichen … (Dialog mit/ohne Push) ·
 * Archivieren (veröffentlicht) · Löschen (Entwurf). Ungespeichertes wird beim Verlassen abgefragt.
 */

type Form = {
  pushTitle: string
  pushBody: string
  title: string
  body: string
  /** Häkchen „Knopf unter der Neuigkeit anzeigen“ */
  showCta: boolean
  ctaLabel: string
  ctaKind: NewsCtaKind
  ctaUrl: string
  audience: NewsAudience
  /** Nur bei audience = 'users': ausgewählte Konten (für Chips mit E-Mail/Benutzername) */
  audienceUsers: AudienceUser[]
  /** „Sichtbar bis“ als YYYY-MM-DD (leer = bis zum Archivieren) */
  expiresAt: string
}

const EMPTY: Form = {
  pushTitle: '', pushBody: '', title: '', body: '',
  showCta: false, ctaLabel: '', ctaKind: 'sites', ctaUrl: '',
  audience: 'all', audienceUsers: [], expiresAt: '',
}

const AUDIENCES: { value: NewsAudience; label: string }[] = [
  { value: 'all', label: 'Alle' },
  { value: 'plan:starter', label: 'Starter' },
  { value: 'plan:pro', label: 'Pro' },
  { value: 'plan:unlimited', label: 'Unlimited' },
  { value: 'users', label: 'Bestimmte Nutzer' },
]

const CTA_KINDS: NewsCtaKind[] = ['sites', 'submissions', 'chats', 'affiliate', 'settings', 'url']

/** Beispielzeile unter dem Ziel-Select, damit klar ist, was „Ziel“ und „Text“ bedeuten. */
const CTA_EXAMPLES: Record<NewsCtaKind, string> = {
  sites: 'Jetzt im Editor einschalten',
  submissions: 'Anfragen ansehen',
  chats: 'Chats öffnen',
  affiliate: 'Zum Partnerbereich',
  settings: 'Einstellungen öffnen',
  url: 'Mehr erfahren',
}

function fromItem(i: AdminNewsItem): Form {
  const hasCta = !!i.ctaKind && !!i.ctaLabel
  return {
    pushTitle: i.pushTitle, pushBody: i.pushBody, title: i.title, body: i.body,
    showCta: hasCta, ctaLabel: i.ctaLabel ?? '', ctaKind: i.ctaKind ?? 'sites', ctaUrl: i.ctaUrl ?? '',
    audience: i.audience,
    // Konten, die der Server nicht mehr auflösen konnte (gelöscht), nur mit ID zeigen
    audienceUsers: i.audienceUserIds.map(id => i.audienceUsers.find(u => u.id === id) ?? { id, email: 'Konto gelöscht', username: null }),
    expiresAt: expiresToDay(i.expiresAt),
  }
}

function toInput(f: Form) {
  const hasCta = f.showCta && f.ctaLabel.trim().length > 0
  return {
    title: f.title, pushTitle: f.pushTitle, pushBody: f.pushBody, body: f.body,
    ctaLabel: hasCta ? f.ctaLabel : null,
    ctaKind: hasCta ? f.ctaKind : null,
    ctaUrl: hasCta && f.ctaKind === 'url' ? f.ctaUrl.trim() : null,
    audience: f.audience,
    audienceUserIds: f.audience === 'users' ? f.audienceUsers.map(u => u.id) : [],
    expiresAt: f.expiresAt || null,
  }
}

type Toast = { kind: 'ok' | 'error' | 'info'; text: string }

export function NewsEditor({ id: initialId }: { id?: string }) {
  const router = useRouter()
  const [id, setId] = useState<string | null>(initialId ?? null)
  const [item, setItem] = useState<AdminNewsItem | null>(null)
  const [form, setForm] = useState<Form>(EMPTY)
  const [snapshot, setSnapshot] = useState(JSON.stringify(EMPTY))
  const [loading, setLoading] = useState(!!initialId)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({})
  const [busy, setBusy] = useState<null | 'save' | 'test' | 'publish' | 'archive' | 'delete'>(null)
  const [toast, setToast] = useState<Toast | null>(null)
  const [publishOpen, setPublishOpen] = useState(false)
  const [confirm, setConfirm] = useState<null | 'archive' | 'delete'>(null)
  const [reach, setReach] = useState<{ users: number; devices: number } | null>(null)
  const toastTimer = useRef<number | null>(null)

  const dirty = JSON.stringify(form) !== snapshot
  const status = item?.status ?? 'draft'
  const isDraft = status === 'draft'
  const isArchived = status === 'archived'
  const pushLocked = !!item?.pushSentAt
  // Zielgruppen-ART ist nach dem Veröffentlichen fest; die Konto-Liste bei „Bestimmte Nutzer“ bleibt änderbar (kein neuer Push)
  const audienceLocked = status !== 'draft'
  const readOnly = isArchived
  const expired = isExpired(item?.expiresAt ?? null)

  /* ── Laden ─────────────────────────────────────────────────────────────── */
  useEffect(() => {
    if (!initialId) return
    let alive = true
    adminFetch<AdminNewsItem>(`/api/admin/news/${initialId}`)
      .then(i => {
        if (!alive) return
        setItem(i)
        const f = fromItem(i)
        setForm(f)
        setSnapshot(JSON.stringify(f))
        setLoading(false)
      })
      .catch(e => {
        if (!alive) return
        setLoadError(e instanceof AdminApiError && e.status === 404 ? 'Diese Neuigkeit gibt es nicht (mehr).' : 'Die Neuigkeit konnte nicht geladen werden.')
        setLoading(false)
      })
    return () => { alive = false }
  }, [initialId])

  const loadReach = useCallback((newsId: string) => {
    adminFetch<{ users: number; devices: number }>(`/api/admin/news/${newsId}/recipients`)
      .then(setReach)
      .catch(() => setReach(null))
  }, [])

  useEffect(() => { if (id) loadReach(id) }, [id, loadReach])

  /* ── Ungespeichertes schützen ─────────────────────────────────────────── */
  useEffect(() => {
    if (!dirty) return
    const handler = (e: BeforeUnloadEvent) => { e.preventDefault() }
    window.addEventListener('beforeunload', handler)
    return () => window.removeEventListener('beforeunload', handler)
  }, [dirty])

  function showToast(t: Toast) {
    setToast(t)
    if (toastTimer.current) window.clearTimeout(toastTimer.current)
    toastTimer.current = window.setTimeout(() => setToast(null), t.kind === 'error' ? 6000 : 4000)
  }

  function set<K extends keyof Form>(key: K, value: Form[K]) {
    setForm(f => ({ ...f, [key]: value }))
    if (fieldErrors[key]) setFieldErrors(e => { const n = { ...e }; delete n[key]; return n })
  }

  function applyItem(i: AdminNewsItem) {
    setItem(i)
    const f = fromItem(i)
    setForm(f)
    setSnapshot(JSON.stringify(f))
    setFieldErrors({})
  }

  /** Speichert (POST bei neu, PUT sonst) und liefert die ID. Wirft AdminApiError mit Feldfehlern. */
  async function save(): Promise<string> {
    const body = JSON.stringify(toInput(form))
    const saved = id
      ? await adminFetch<AdminNewsItem>(`/api/admin/news/${id}`, { method: 'PUT', body })
      : await adminFetch<AdminNewsItem>('/api/admin/news', { method: 'POST', body })
    applyItem(saved)
    if (!id) {
      setId(saved.id)
      // Adresse ohne Neuladen anpassen, damit F5 und Zurück auf dem Entwurf landen
      window.history.replaceState(null, '', `/admin/neuigkeiten/${saved.id}`)
    }
    return saved.id
  }

  function handleError(e: unknown, fallback: string) {
    if (e instanceof AdminApiError) {
      if (e.fields) setFieldErrors(e.fields)
      showToast({ kind: 'error', text: e.message })
    } else {
      showToast({ kind: 'error', text: fallback })
    }
  }

  async function onSave() {
    setBusy('save')
    try {
      await save()
      showToast({ kind: 'ok', text: isDraft ? 'Entwurf gespeichert.' : 'Änderungen gespeichert.' })
    } catch (e) { handleError(e, 'Speichern fehlgeschlagen.') }
    finally { setBusy(null) }
  }

  async function onTest() {
    setBusy('test')
    try {
      const newsId = dirty || !id ? await save() : id
      const r = await adminFetch<{ devices: number }>(`/api/admin/news/${newsId}/test`, { method: 'POST' })
      if (r.devices === 0) showToast({ kind: 'info', text: 'Du hast kein Gerät mit Push angemeldet. Melde dich in der App an und erlaube Mitteilungen.' })
      else showToast({ kind: 'ok', text: `Testmitteilung an ${r.devices === 1 ? 'dein Gerät' : `${r.devices} Geräte`} geschickt. Schau auf dein iPhone.` })
    } catch (e) { handleError(e, 'Testversand fehlgeschlagen.') }
    finally { setBusy(null) }
  }

  async function onOpenPublish() {
    // Vor dem Dialog speichern, damit Reichweite und Inhalt zum Stand passen
    setBusy('save')
    try {
      const newsId = dirty || !id ? await save() : id
      loadReach(newsId)
      setPublishOpen(true)
    } catch (e) { handleError(e, 'Speichern fehlgeschlagen.') }
    finally { setBusy(null) }
  }

  async function onPublish(push: boolean): Promise<string | null> {
    if (!id) return 'Bitte zuerst speichern.'
    setBusy('publish')
    try {
      const i = await adminFetch<AdminNewsItem>(`/api/admin/news/${id}/publish`, { method: 'POST', body: JSON.stringify({ push }) })
      applyItem(i)
      setPublishOpen(false)
      showToast({ kind: 'ok', text: push
        ? `Veröffentlicht – Push-Mitteilung an ${i.pushQueued} ${i.pushQueued === 1 ? 'Nutzer' : 'Nutzer'} eingereiht.`
        : 'Veröffentlicht – jetzt in Web und App sichtbar.' })
      return null
    } catch (e) {
      if (e instanceof AdminApiError) return e.message
      return 'Veröffentlichen fehlgeschlagen.'
    } finally { setBusy(null) }
  }

  async function onArchive() {
    if (!id) return
    setBusy('archive')
    try {
      applyItem(await adminFetch<AdminNewsItem>(`/api/admin/news/${id}/archive`, { method: 'POST' }))
      showToast({ kind: 'ok', text: 'Archiviert – die Neuigkeit ist nicht mehr sichtbar.' })
    } catch (e) { handleError(e, 'Archivieren fehlgeschlagen.') }
    finally { setBusy(null); setConfirm(null) }
  }

  async function onDelete() {
    if (!id) { router.push('/admin/neuigkeiten'); return }
    setBusy('delete')
    try {
      await adminFetch(`/api/admin/news/${id}`, { method: 'DELETE' })
      setSnapshot(JSON.stringify(form)) // nichts mehr zu schützen
      router.push('/admin/neuigkeiten')
    } catch (e) { handleError(e, 'Löschen fehlgeschlagen.'); setBusy(null); setConfirm(null) }
  }

  function onBack(e: React.MouseEvent) {
    if (dirty && !window.confirm('Du hast ungespeicherte Änderungen. Trotzdem verlassen?')) e.preventDefault()
  }

  /* ── Vorschau-Daten ────────────────────────────────────────────────────── */
  const previewDate = item?.publishedAt ?? new Date().toISOString()
  const hasCta = form.showCta
  // Der Knopf erscheint in der Vorschau sofort mit dem Häkchen und ändert sich beim Tippen (leer = grauer Platzhalter)
  const previewCta = hasCta ? (
    <span style={{ ...newsPrimaryButtonStyle, minHeight: 44, fontSize: 14.5, cursor: 'default', opacity: form.ctaLabel.trim() ? 1 : 0.55, transition: 'opacity 0.15s ease' }}>
      {form.ctaLabel.trim() || 'Text auf dem Knopf'}
    </span>
  ) : null
  const previewSecondary = <span style={{ ...newsQuietLinkStyle, minHeight: 32, fontSize: 13.5, cursor: 'default' }}>{hasCta ? 'Später' : 'Zurück zu den Neuigkeiten'}</span>

  const warnings = useMemo(() => ({
    pushTitle: findBlockedWords(form.pushTitle),
    pushBody: findBlockedWords(form.pushBody),
    title: findBlockedWords(form.title),
    body: findBlockedWords(form.body),
    ctaLabel: findBlockedWords(form.ctaLabel),
  }), [form.pushTitle, form.pushBody, form.title, form.body, form.ctaLabel])

  /* ── Render ────────────────────────────────────────────────────────────── */
  if (loadError) {
    return (
      <div style={{ maxWidth: 720 }}>
        <BackLink onClick={onBack} />
        <div className="rounded-2xl bg-white px-6 py-10 text-center" style={{ border: '1px solid #EEF0F3' }}>
          <div className="text-base font-semibold text-gray-900">{loadError}</div>
          <Link href="/admin/neuigkeiten" className="inline-flex mt-4 px-4 h-9 items-center rounded-xl text-sm font-semibold" style={{ background: '#F1F5F9', color: '#111827' }}>Zur Übersicht</Link>
        </div>
      </div>
    )
  }

  const inputBase: React.CSSProperties = {
    width: '100%', borderRadius: 10, border: '1px solid #E2E8F0', padding: '9px 12px', fontSize: 14,
    color: '#111827', background: '#fff', outline: 'none', boxSizing: 'border-box', fontFamily: 'inherit', lineHeight: 1.5,
  }
  const disabledStyle: React.CSSProperties = { background: '#F8FAFC', color: '#64748B', cursor: 'not-allowed' }

  return (
    <div style={{ maxWidth: 1200 }}>
      <BackLink onClick={onBack} />

      {/* Kopf */}
      <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-3 flex-wrap">
            <h1 className="text-2xl font-semibold text-gray-900 tracking-tight truncate" style={{ maxWidth: 640 }}>
              {loading ? 'Neuigkeit' : id ? (form.title.trim() || 'Neuigkeit') : 'Neue Neuigkeit'}
            </h1>
            {!loading && <StatusPill status={status} />}
            {dirty && !loading && (
              <span className="text-xs font-medium px-2 py-0.5 rounded-full" style={{ background: '#FFF7ED', color: '#C2410C' }}>Ungespeichert</span>
            )}
          </div>
          <p className="text-sm mt-1" style={{ color: '#94A3B8' }}>
            {loading ? ' '
              : isArchived ? `Archiviert · veröffentlicht am ${formatNewsDateTime(item?.publishedAt)} · nicht mehr sichtbar`
              : status === 'published' ? `Veröffentlicht am ${formatNewsDateTime(item?.publishedAt)}${pushLocked ? ` · Push an ${item?.pushQueued} Nutzer` : ' · ohne Push'} · ${item?.readCount ?? 0} gelesen${item?.ctaLabel ? ` · ${item?.ctaCount ?? 0}× Knopf getippt` : ''}${item?.expiresAt ? (expired ? ' · abgelaufen, nicht mehr sichtbar' : ` · sichtbar ${formatExpiresShort(item.expiresAt)}`) : ''}`
              : 'Links schreiben, rechts sehen, wie es ankommt. Keine Preise und Tarifnamen in den Texten.'}
          </p>
        </div>
      </div>

      <div className="grid gap-5 grid-cols-1 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)]">
        {/* ── Formular ─────────────────────────────────────────────────── */}
        <div className="rounded-[16px] bg-white" style={{ border: '1px solid #EEF0F3', boxShadow: '0 1px 3px rgba(0,0,0,0.04)', gridColumn: 'span 1', minWidth: 0 }}>
          {loading ? (
            <div className="p-6 animate-pulse flex flex-col gap-4">
              {[1, 2, 3, 4].map(i => <div key={i} className="h-10 rounded-xl bg-gray-100" />)}
              <div className="h-32 rounded-xl bg-gray-100" />
            </div>
          ) : (
            <form className="p-5 sm:p-6 flex flex-col gap-6" onSubmit={e => { e.preventDefault(); if (!readOnly) void onSave() }}>
              {/* Mitteilung */}
              <fieldset className="flex flex-col gap-4" style={{ border: 0, margin: 0, padding: 0, minWidth: 0 }}>
                <SectionTitle
                  title="Push-Mitteilung"
                  hint={pushLocked ? 'Die Mitteilung ist bereits verschickt und kann nicht mehr geändert werden.' : 'So erscheint sie auf dem Sperrbildschirm. Kurz, konkret, ohne Preise.'}
                />
                <Field
                  label="Titel der Mitteilung"
                  counter={<Counter n={form.pushTitle.length} max={NEWS_LIMITS.pushTitle} warnAt={35} />}
                  error={fieldErrors.pushTitle} warning={warnings.pushTitle}
                >
                  <input value={form.pushTitle} maxLength={NEWS_LIMITS.pushTitle} disabled={pushLocked || readOnly}
                    onChange={e => set('pushTitle', e.target.value)} placeholder="z. B. Neu: Besucher-Chat für alle"
                    style={{ ...inputBase, ...(pushLocked || readOnly ? disabledStyle : {}), ...(fieldErrors.pushTitle ? { borderColor: '#F87171' } : {}) }} />
                </Field>
                <Field
                  label="Text der Mitteilung"
                  counter={<Counter n={form.pushBody.length} max={NEWS_LIMITS.pushBodyRecommended} hardMax={NEWS_LIMITS.pushBody} warnAt={100} />}
                  error={fieldErrors.pushBody} warning={warnings.pushBody}
                  help={`Richtwert ${NEWS_LIMITS.pushBodyRecommended} Zeichen, damit alles auf iPhone und Android lesbar ist. Harte Grenze ${NEWS_LIMITS.pushBody}.`}
                >
                  <textarea value={form.pushBody} maxLength={NEWS_LIMITS.pushBody} rows={3} disabled={pushLocked || readOnly}
                    onChange={e => set('pushBody', e.target.value)} placeholder="Ein Satz, was neu ist, und einer, was man tun kann."
                    style={{ ...inputBase, resize: 'vertical', minHeight: 72, ...(pushLocked || readOnly ? disabledStyle : {}), ...(fieldErrors.pushBody ? { borderColor: '#F87171' } : {}) }} />
                </Field>
              </fieldset>

              <Divider />

              {/* Neuigkeit */}
              <fieldset className="flex flex-col gap-4" style={{ border: 0, margin: 0, padding: 0, minWidth: 0 }}>
                <SectionTitle title="Neuigkeit in App und Web" hint="Das liest, wer die Mitteilung antippt oder die Liste öffnet. Hier darf es ausführlich sein." />
                <Field label="Überschrift" counter={<Counter n={form.title.length} max={NEWS_LIMITS.title} warnAt={70} />} error={fieldErrors.title} warning={warnings.title}>
                  <input value={form.title} maxLength={NEWS_LIMITS.title} disabled={readOnly}
                    onChange={e => set('title', e.target.value)} placeholder="z. B. Neu: Besucher-Chat für alle"
                    style={{ ...inputBase, ...(readOnly ? disabledStyle : {}), ...(fieldErrors.title ? { borderColor: '#F87171' } : {}) }} />
                </Field>
                <Field
                  label="Inhalt"
                  counter={<Counter n={form.body.length} max={NEWS_LIMITS.body} warnAt={4500} compact />}
                  error={fieldErrors.body} warning={warnings.body}
                  help="Leerzeile = neuer Absatz. Zeilen, die mit „- “ beginnen, werden zur Aufzählung. Kein HTML, kein Markdown."
                >
                  <textarea value={form.body} maxLength={NEWS_LIMITS.body} rows={9} disabled={readOnly}
                    onChange={e => set('body', e.target.value)}
                    placeholder={'Ab heute können Besucher dir direkt auf deiner Webseite schreiben.\n\nSo schaltest du ihn ein:\n- Webseite bearbeiten\n- Sektion „Besucher-Chat“ einschalten\n- Speichern und veröffentlichen'}
                    style={{ ...inputBase, resize: 'vertical', minHeight: 180, ...(readOnly ? disabledStyle : {}), ...(fieldErrors.body ? { borderColor: '#F87171' } : {}) }} />
                </Field>
              </fieldset>

              <Divider />

              {/* Knopf */}
              <fieldset className="flex flex-col gap-4" style={{ border: 0, margin: 0, padding: 0, minWidth: 0 }} data-testid="cta-section">
                <SectionTitle title="Knopf (optional)" />
                <label className="flex items-start gap-3 cursor-pointer select-none" style={{ cursor: readOnly ? 'default' : 'pointer' }}>
                  <input type="checkbox" checked={form.showCta} disabled={readOnly}
                    onChange={e => {
                      const on = e.target.checked
                      setForm(f => ({ ...f, showCta: on }))
                      setFieldErrors(err => { const n = { ...err }; delete n.ctaKind; delete n.ctaLabel; delete n.ctaUrl; return n })
                    }}
                    className="mt-0.5 flex-shrink-0" style={{ width: 18, height: 18, accentColor: '#111827' }} />
                  <span className="min-w-0">
                    <span className="block text-sm font-semibold text-gray-900">Knopf unter der Neuigkeit anzeigen</span>
                    {!form.showCta && <span className="block text-xs mt-0.5" style={{ color: '#94A3B8' }}>Ohne Häkchen gibt es keinen Knopf – die Neuigkeit endet mit dem Text.</span>}
                  </span>
                </label>
                {form.showCta && (
                  <div className="flex flex-col gap-4 rounded-xl p-4" style={{ background: '#F8FAFC', border: '1px solid #EEF0F3' }}>
                    <p className="text-xs m-0" style={{ color: '#64748B', lineHeight: 1.5 }}>
                      Der Knopf steht am Ende der Neuigkeit (siehe Vorschau rechts). Wähle, wohin er führt, und was draufsteht.
                    </p>
                    <div className="grid gap-4 grid-cols-1 sm:grid-cols-2">
                      <Field label="Wohin führt der Knopf?" error={fieldErrors.ctaKind}
                        help={`Beispiel: Ziel „${NEWS_CTA_KIND_LABELS[form.ctaKind]}“ + Text „${CTA_EXAMPLES[form.ctaKind]}“`}>
                        <select value={form.ctaKind} disabled={readOnly}
                          onChange={e => set('ctaKind', e.target.value as NewsCtaKind)}
                          style={{ ...inputBase, height: 40, appearance: 'auto', ...(readOnly ? disabledStyle : {}) }}>
                          {CTA_KINDS.map(k => <option key={k} value={k}>{NEWS_CTA_KIND_LABELS[k]}</option>)}
                        </select>
                      </Field>
                      <Field label="Text auf dem Knopf" counter={<Counter n={form.ctaLabel.length} max={NEWS_LIMITS.ctaLabel} warnAt={26} />} error={fieldErrors.ctaLabel} warning={warnings.ctaLabel}
                        help="Kurz und als Aufforderung – das steht wörtlich auf dem Knopf.">
                        <input value={form.ctaLabel} maxLength={NEWS_LIMITS.ctaLabel} disabled={readOnly}
                          onChange={e => set('ctaLabel', e.target.value)} placeholder="z. B. Jetzt im Editor einschalten"
                          style={{ ...inputBase, ...(readOnly ? disabledStyle : {}), ...(fieldErrors.ctaLabel ? { borderColor: '#F87171' } : {}) }} />
                      </Field>
                    </div>
                    {form.ctaKind === 'url' && (
                      <Field label="Link (https://…)" error={fieldErrors.ctaUrl} help="Öffnet im Browser. Keine Tarif- oder Kaufseiten (Apple-Regel 3.1.3).">
                        <input value={form.ctaUrl} maxLength={NEWS_LIMITS.ctaUrl} disabled={readOnly} inputMode="url"
                          onChange={e => set('ctaUrl', e.target.value)} placeholder="https://finestsites.io/…"
                          style={{ ...inputBase, ...(readOnly ? disabledStyle : {}), ...(fieldErrors.ctaUrl ? { borderColor: '#F87171' } : {}) }} />
                      </Field>
                    )}
                  </div>
                )}
              </fieldset>

              <Divider />

              {/* Empfänger */}
              <fieldset className="flex flex-col gap-3" style={{ border: 0, margin: 0, padding: 0, minWidth: 0 }} data-testid="audience-section">
                <SectionTitle title="Empfänger" hint={audienceLocked
                  ? (form.audience === 'users' ? 'Zielgruppe nach dem Veröffentlichen fest – Konten kannst du weiter ergänzen oder entfernen (ohne neuen Push).' : 'Nach dem Veröffentlichen fest.')
                  : 'Wer die Neuigkeit sieht – und wer die Mitteilung bekommt.'} />
                <div className="inline-flex flex-wrap rounded-xl overflow-hidden" style={{ border: '1px solid #E2E8F0', width: 'fit-content' }}>
                  {AUDIENCES.map(a => {
                    const on = form.audience === a.value
                    return (
                      <button key={a.value} type="button" disabled={audienceLocked || readOnly}
                        onClick={() => set('audience', a.value)}
                        className="px-4 h-9 text-[13px] font-medium transition-colors"
                        style={{
                          background: on ? '#111827' : '#fff', color: on ? '#fff' : '#64748B', border: 'none',
                          cursor: audienceLocked || readOnly ? 'default' : 'pointer', opacity: (audienceLocked || readOnly) && !on ? 0.5 : 1,
                        }}>
                        {a.label}
                      </button>
                    )
                  })}
                </div>
                {form.audience === 'users' ? (
                  <AudienceUserPicker
                    selected={form.audienceUsers}
                    disabled={readOnly}
                    error={fieldErrors.audienceUserIds}
                    onChange={next => { set('audienceUsers', next); setFieldErrors(err => { const n = { ...err }; delete n.audienceUserIds; return n }) }}
                  />
                ) : (
                  <p className="text-xs" style={{ color: '#94A3B8', margin: 0 }}>
                    {form.audience === 'all'
                      ? 'Alle Konten sehen die Neuigkeit. Push geht nur an Geräte mit eingeschalteten Neuigkeiten.'
                      : `Nur Konten mit diesem Tarif sehen die Neuigkeit. Push geht nur an deren Geräte mit eingeschalteten Neuigkeiten.`}
                  </p>
                )}
              </fieldset>

              <Divider />

              {/* Sichtbarkeitsdauer */}
              <fieldset className="flex flex-col gap-3" style={{ border: 0, margin: 0, padding: 0, minWidth: 0 }} data-testid="expires-section">
                <SectionTitle title="Sichtbar bis (optional)" />
                <Field label="Letzter Tag, an dem die Neuigkeit zu sehen ist" error={fieldErrors.expiresAt}
                  help="Leer = sichtbar, bis du sie archivierst. Nach dem Datum verschwindet sie in Web und App von selbst.">
                  <div className="flex items-center gap-2 flex-wrap">
                    <input type="date" value={form.expiresAt} disabled={readOnly} min={new Date().toISOString().slice(0, 10)}
                      onChange={e => set('expiresAt', e.target.value)}
                      style={{ ...inputBase, width: 'auto', minWidth: 180, height: 40, ...(readOnly ? disabledStyle : {}), ...(fieldErrors.expiresAt ? { borderColor: '#F87171' } : {}) }} />
                    {form.expiresAt && !readOnly && (
                      <button type="button" onClick={() => set('expiresAt', '')}
                        className="text-xs font-medium px-2.5 h-8 rounded-lg transition-colors hover:bg-gray-100" style={{ color: '#64748B', background: 'transparent', border: 'none', cursor: 'pointer' }}>
                        Kein Enddatum
                      </button>
                    )}
                    {expired && item?.expiresAt && (
                      <span className="text-xs font-semibold px-2 py-0.5 rounded-full" style={{ background: '#F1F5F9', color: '#64748B' }}>abgelaufen</span>
                    )}
                  </div>
                </Field>
              </fieldset>

              {/* Aktionen */}
              {!readOnly && (
                <div className="flex flex-wrap items-center gap-2.5 pt-2" style={{ borderTop: '1px solid #F1F5F9', paddingTop: 18 }}>
                  <ActionButton kind="ghost" busy={busy === 'save'} disabled={!!busy} onClick={onSave}>
                    {isDraft ? 'Entwurf speichern' : 'Änderungen speichern'}
                  </ActionButton>
                  {!pushLocked && (
                    <ActionButton kind="ghost" busy={busy === 'test'} disabled={!!busy} onClick={onTest} icon={
                      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="5" y="2" width="14" height="20" rx="2"/><path d="M12 18h.01"/></svg>
                    }>
                      Test an mein iPhone
                    </ActionButton>
                  )}
                  {isDraft && (
                    <ActionButton kind="primary" busy={busy === 'save' && publishOpen} disabled={!!busy} onClick={onOpenPublish}>
                      Veröffentlichen …
                    </ActionButton>
                  )}
                  <span className="flex-1" />
                  {status === 'published' && (
                    <button type="button" disabled={!!busy} onClick={() => setConfirm('archive')}
                      className="text-sm font-medium px-3 h-10 rounded-xl transition-colors hover:bg-amber-50" style={{ color: '#9A3412', background: 'transparent', border: 'none', cursor: 'pointer' }}>
                      Archivieren
                    </button>
                  )}
                  {isDraft && (
                    <button type="button" disabled={!!busy} onClick={() => setConfirm('delete')}
                      className="text-sm font-medium px-3 h-10 rounded-xl transition-colors hover:bg-red-50" style={{ color: '#B91C1C', background: 'transparent', border: 'none', cursor: 'pointer' }}>
                      {id ? 'Löschen' : 'Verwerfen'}
                    </button>
                  )}
                </div>
              )}
            </form>
          )}
        </div>

        {/* ── Live-Vorschau ────────────────────────────────────────────── */}
        <aside className="rounded-[16px] flex flex-col gap-6 p-5 sm:p-6 self-start lg:sticky lg:top-6"
          style={{ background: '#F8FAFC', border: '1px solid #EEF0F3', minWidth: 0 }}>
          <div>
            <PreviewTitle>Sperrbildschirm iPhone</PreviewTitle>
            <IphoneLockPreview title={form.pushTitle} body={form.pushBody} />
            <PreviewNote>
              {form.pushBody.length > NEWS_LIMITS.pushBodyRecommended
                ? 'Länger als der Richtwert – auf dem Sperrbildschirm wird der Text eventuell gekürzt.'
                : 'Titel eine Zeile, Text bis vier Zeilen · vollständig sichtbar'}
            </PreviewNote>
          </div>

          <div>
            <PreviewTitle>Android, aufgeklappt</PreviewTitle>
            <AndroidCardPreview title={form.pushTitle} body={form.pushBody} />
            <PreviewNote>Zugeklappt zeigt Android nur die erste Zeile.</PreviewNote>
          </div>

          <div>
            <PreviewTitle>Die Neuigkeit in der App</PreviewTitle>
            <div style={{ maxWidth: 360 }}>
              <NewsDetailCard title={form.title} body={form.body} publishedAt={previewDate} cta={previewCta} secondary={previewSecondary} compact paletteKey={id} />
            </div>
          </div>

          <div>
            <PreviewTitle>Reichweite jetzt</PreviewTitle>
            <div className="rounded-xl bg-white px-4 py-3" style={{ border: '1px solid #EEF0F3' }}>
              {id ? (
                <table className="w-full text-sm" style={{ borderCollapse: 'collapse' }}>
                  <tbody>
                    <ReachRow label="Push-Empfänger (App, Gerät aktiv)" value={reach ? `${reach.users} ${reach.users === 1 ? 'Nutzer' : 'Nutzer'}` : '…'} strong />
                    <ReachRow label="Geräte" value={reach ? String(reach.devices) : '…'} />
                    <ReachRow label="Sichtbar in Web und App" value={
                      form.audience === 'all' ? 'alle Konten'
                        : form.audience === 'users' ? `${form.audienceUsers.length} ${form.audienceUsers.length === 1 ? 'ausgewähltes Konto' : 'ausgewählte Konten'}`
                        : `nur ${AUDIENCES.find(a => a.value === form.audience)?.label}`} />
                    <ReachRow label="Sichtbar bis" value={form.expiresAt ? formatDayShort(form.expiresAt) : 'bis zum Archivieren'} />
                    <ReachRow label="Zustellung" value="sofort, außer Ruhezeit" last />
                  </tbody>
                </table>
              ) : (
                <p className="text-sm m-0" style={{ color: '#64748B' }}>Speichere den Entwurf, dann siehst du hier, wie viele Nutzer und Geräte die Mitteilung erreichen würde.</p>
              )}
            </div>
            <PreviewNote>
              Push nur an Nutzer mit der App, aktivem Gerät und eingeschalteten Neuigkeiten. Höchstens eine Veröffentlichung mit Push pro Tag. Neue Nutzer sehen die Neuigkeit später auch in der Liste.
            </PreviewNote>
          </div>
        </aside>
      </div>

      {/* Dialoge */}
      {publishOpen && id && (
        <PublishDialog
          reach={reach}
          busy={busy === 'publish'}
          onCancel={() => setPublishOpen(false)}
          onConfirm={onPublish}
        />
      )}
      {confirm === 'archive' && (
        <ConfirmDialog title="Neuigkeit archivieren?" text="Sie verschwindet sofort aus Web und App. Die Statistik bleibt erhalten."
          confirmLabel="Archivieren" busy={busy === 'archive'} onCancel={() => setConfirm(null)} onConfirm={onArchive} />
      )}
      {confirm === 'delete' && (
        <ConfirmDialog title={id ? 'Entwurf löschen?' : 'Eingaben verwerfen?'} text={id ? 'Der Entwurf wird endgültig gelöscht.' : 'Alles, was du geschrieben hast, geht verloren.'}
          confirmLabel={id ? 'Löschen' : 'Verwerfen'} danger busy={busy === 'delete'} onCancel={() => setConfirm(null)} onConfirm={onDelete} />
      )}

      <style>{`@keyframes fsNewsSpin { to { transform: rotate(360deg) } }`}</style>

      {/* Toast */}
      {toast && (
        <div role="status" className="fixed left-1/2 z-[1100] flex items-center gap-3 px-4 py-3 rounded-2xl text-sm font-medium"
          style={{
            bottom: 'calc(24px + env(safe-area-inset-bottom, 0px))', transform: 'translateX(-50%)', maxWidth: 'min(92vw, 520px)',
            background: toast.kind === 'error' ? '#7F1D1D' : toast.kind === 'info' ? '#1E293B' : '#111827', color: '#fff',
            boxShadow: '0 12px 40px rgba(0,0,0,0.25)',
          }}>
          <span className="w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0"
            style={{ background: toast.kind === 'error' ? '#EF4444' : toast.kind === 'info' ? '#F59E0B' : '#22C55E' }}>
            {toast.kind === 'ok'
              ? <svg width="11" height="9" viewBox="0 0 10 8" fill="none"><path d="M1 4L3.5 6.5L9 1" stroke="white" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/></svg>
              : <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3" strokeLinecap="round"><path d="M12 7v6M12 17h.01"/></svg>}
          </span>
          <span>{toast.text}</span>
        </div>
      )}
    </div>
  )
}

/* ── Bausteine ─────────────────────────────────────────────────────────────── */

function BackLink({ onClick }: { onClick: (e: React.MouseEvent) => void }) {
  return (
    <Link href="/admin/neuigkeiten" onClick={onClick} className="inline-flex items-center gap-1 text-sm font-medium mb-4 hover:underline" style={{ color: '#64748B' }}>
      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M15 18l-6-6 6-6"/></svg>
      Neuigkeiten
    </Link>
  )
}

function SectionTitle({ title, hint }: { title: string; hint?: string }) {
  return (
    <div>
      <h2 className="text-[15px] font-semibold text-gray-900 m-0">{title}</h2>
      {hint && <p className="text-xs mt-0.5 m-0" style={{ color: '#94A3B8' }}>{hint}</p>}
    </div>
  )
}

function Divider() { return <div style={{ height: 1, background: '#F1F5F9' }} /> }

/** „YYYY-MM-DD“ → „04.11.2026“ (reine Textumformung, keine Zeitzone). */
function formatDayShort(day: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(day)
  return m ? `${m[3]}.${m[2]}.${m[1]}` : day
}

function Field({ label, counter, error, warning, help, children }: {
  label: string; counter?: React.ReactNode; error?: string; warning?: string[]; help?: string; children: React.ReactNode
}) {
  return (
    <div className="flex flex-col gap-1.5" style={{ minWidth: 0 }}>
      <label className="flex items-baseline justify-between gap-3 text-xs font-semibold" style={{ color: '#64748B' }}>
        <span>{label}</span>
        {counter}
      </label>
      {children}
      {error && <p className="text-xs m-0 font-medium" style={{ color: '#DC2626' }}>{error}</p>}
      {warning && warning.length > 0 && (
        <p className="text-xs m-0 flex items-start gap-1.5 px-2.5 py-1.5 rounded-lg" style={{ background: '#FFF7ED', color: '#9A3412', border: '1px solid #FED7AA' }}>
          <svg className="flex-shrink-0 mt-0.5" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M12 9v4M12 17h.01"/><path d="M10.3 3.9L1.8 18a2 2 0 001.7 3h17a2 2 0 001.7-3L13.7 3.9a2 2 0 00-3.4 0z"/></svg>
          <span>
            Enthält {warning.map((w, i) => <span key={w}>{i > 0 ? ', ' : ''}<b>„{w}“</b></span>)} – Apple erlaubt in der App keine Preise, Tarifnamen oder Kaufhinweise. Du kannst trotzdem speichern.
          </span>
        </p>
      )}
      {help && !error && <p className="text-xs m-0" style={{ color: '#94A3B8' }}>{help}</p>}
    </div>
  )
}

/** Zähler „27 / 40“: ab warnAt orange, über max rot (bei hardMax: max ist Richtwert, hardMax die Grenze). */
function Counter({ n, max, hardMax, warnAt, compact }: { n: number; max: number; hardMax?: number; warnAt: number; compact?: boolean }) {
  const over = n > max
  const color = over ? (hardMax && n <= hardMax ? '#C2410C' : '#DC2626') : n >= warnAt ? '#C2410C' : n > 0 ? '#15803D' : '#94A3B8'
  return (
    <span className="font-medium tabular-nums whitespace-nowrap" style={{ color, fontSize: compact ? 11 : 12 }}>
      {n} / {max}{hardMax && over ? ` (max. ${hardMax})` : ''}
    </span>
  )
}

function PreviewTitle({ children }: { children: React.ReactNode }) {
  return <h3 className="text-[11px] font-semibold uppercase tracking-wide mb-2.5 m-0" style={{ color: '#94A3B8' }}>{children}</h3>
}
function PreviewNote({ children }: { children: React.ReactNode }) {
  return <p className="text-xs mt-2 m-0" style={{ color: '#94A3B8' }}>{children}</p>
}
function ReachRow({ label, value, strong, last }: { label: string; value: string; strong?: boolean; last?: boolean }) {
  return (
    <tr style={{ borderBottom: last ? 'none' : '1px solid #F1F5F9' }}>
      <td className="py-1.5 pr-3" style={{ color: '#64748B' }}>{label}</td>
      <td className="py-1.5 text-right whitespace-nowrap" style={{ color: '#111827', fontWeight: strong ? 700 : 500 }}>{value}</td>
    </tr>
  )
}

function ActionButton({ kind, busy, disabled, onClick, icon, children }: {
  kind: 'primary' | 'ghost'; busy?: boolean; disabled?: boolean; onClick: () => void; icon?: React.ReactNode; children: React.ReactNode
}) {
  return (
    <button type="button" onClick={onClick} disabled={disabled}
      className="inline-flex items-center gap-2 px-4 h-10 rounded-xl text-sm font-semibold transition-all active:scale-[0.98]"
      style={{
        background: kind === 'primary' ? '#111827' : '#F1F5F9', color: kind === 'primary' ? '#fff' : '#111827', border: 'none',
        cursor: disabled ? 'not-allowed' : 'pointer', opacity: disabled && !busy ? 0.6 : 1,
        boxShadow: kind === 'primary' ? '0 2px 8px rgba(17,24,39,0.18)' : 'none',
      }}>
      {busy ? (
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" style={{ animation: 'fsNewsSpin 1s linear infinite' }}><path d="M21 12a9 9 0 11-6.219-8.56"/></svg>
      ) : icon}
      {children}
    </button>
  )
}

/**
 * Kontosuche für „Bestimmte Nutzer“: tippen → GET /api/admin/users/search?q= (E-Mail/Benutzername, ab 2 Zeichen),
 * Treffer in einer Liste, Auswahl als entfernbare Chips (E-Mail + @benutzername).
 */
function AudienceUserPicker({ selected, disabled, error, onChange }: {
  selected: AudienceUser[]; disabled?: boolean; error?: string; onChange: (next: AudienceUser[]) => void
}) {
  const [q, setQ] = useState('')
  const [results, setResults] = useState<AudienceUser[]>([])
  const [open, setOpen] = useState(false)
  const [searching, setSearching] = useState(false)
  const boxRef = useRef<HTMLDivElement>(null)
  const seq = useRef(0)

  useEffect(() => {
    const term = q.trim()
    if (term.length < 2) { setResults([]); setSearching(false); return }
    const mine = ++seq.current
    setSearching(true)
    const t = window.setTimeout(() => {
      fetch(`/api/admin/users/search?q=${encodeURIComponent(term)}`, { cache: 'no-store' })
        .then(r => (r.ok ? (r.json() as Promise<AudienceUser[]>) : []))
        .then(list => { if (mine === seq.current) { setResults(Array.isArray(list) ? list : []); setOpen(true) } })
        .catch(() => { if (mine === seq.current) setResults([]) })
        .finally(() => { if (mine === seq.current) setSearching(false) })
    }, 220)
    return () => window.clearTimeout(t)
  }, [q])

  useEffect(() => {
    if (!open) return
    const onDoc = (e: MouseEvent) => { if (boxRef.current && !boxRef.current.contains(e.target as Node)) setOpen(false) }
    document.addEventListener('mousedown', onDoc)
    return () => document.removeEventListener('mousedown', onDoc)
  }, [open])

  const selectedIds = new Set(selected.map(u => u.id))
  const visible = results.filter(u => !selectedIds.has(u.id))

  function add(u: AudienceUser) {
    if (selected.length >= NEWS_LIMITS.audienceUsers) return
    onChange([...selected, u])
    setQ('')
    setResults([])
    setOpen(false)
  }

  return (
    <div className="flex flex-col gap-2.5" data-testid="audience-users">
      <p className="text-xs m-0" style={{ color: '#64748B' }}>
        Nur diese Konten sehen die Neuigkeit – ideal zum Testen, bevor sie an alle geht.
      </p>
      {!disabled && (
        <div ref={boxRef} className="relative" style={{ maxWidth: 440 }}>
          <div className="flex items-center gap-2 rounded-[10px] px-3" style={{ border: `1px solid ${error ? '#F87171' : '#E2E8F0'}`, background: '#fff', height: 40 }}>
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#94A3B8" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="flex-shrink-0"><circle cx="11" cy="11" r="7"/><path d="M20 20l-3.5-3.5"/></svg>
            <input value={q} onChange={e => setQ(e.target.value)} onFocus={() => { if (visible.length) setOpen(true) }}
              placeholder="E-Mail oder Benutzername suchen …" aria-label="Konto suchen"
              style={{ flex: 1, border: 'none', outline: 'none', fontSize: 14, color: '#111827', background: 'transparent', fontFamily: 'inherit', minWidth: 0 }} />
            {searching && <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#94A3B8" strokeWidth="2.5" style={{ animation: 'fsNewsSpin 1s linear infinite' }}><path d="M21 12a9 9 0 11-6.219-8.56"/></svg>}
          </div>
          {open && q.trim().length >= 2 && (
            <div role="listbox" className="absolute left-0 right-0 z-30 mt-1 rounded-xl bg-white py-1 overflow-hidden"
              style={{ boxShadow: '0 12px 32px rgba(15,23,42,0.14), 0 0 0 1px rgba(15,23,42,0.05)', maxHeight: 260, overflowY: 'auto' }}>
              {visible.length === 0 ? (
                <div className="px-3 py-2.5 text-sm" style={{ color: '#94A3B8' }}>{searching ? 'Suche …' : 'Kein Konto gefunden.'}</div>
              ) : visible.map(u => (
                <button key={u.id} type="button" role="option" aria-selected={false} onMouseDown={e => e.preventDefault()} onClick={() => add(u)}
                  className="w-full text-left px-3 py-2 flex items-center justify-between gap-3 transition-colors hover:bg-gray-50"
                  style={{ background: 'transparent', border: 'none', cursor: 'pointer' }}>
                  <span className="min-w-0">
                    <span className="block text-sm text-gray-900 truncate">{u.email}</span>
                    {u.username && <span className="block text-xs truncate" style={{ color: '#94A3B8' }}>@{u.username}</span>}
                  </span>
                  <span className="text-xs font-semibold flex-shrink-0" style={{ color: NEWS_TOKENS.accent }}>Hinzufügen</span>
                </button>
              ))}
            </div>
          )}
        </div>
      )}
      {selected.length > 0 ? (
        <div className="flex flex-wrap gap-1.5" data-testid="audience-chips">
          {selected.map(u => (
            <span key={u.id} className="inline-flex items-center gap-1.5 pl-2.5 pr-1 h-8 rounded-full text-xs"
              style={{ background: NEWS_TOKENS.accentSoft, border: `1px solid ${NEWS_TOKENS.accentSoftBorder}`, color: '#111827' }}>
              <span className="font-semibold">{u.email}</span>
              {u.username && <span style={{ color: '#6D28D9' }}>@{u.username}</span>}
              {!disabled && (
                <button type="button" onClick={() => onChange(selected.filter(s => s.id !== u.id))} aria-label={`${u.email} entfernen`}
                  className="w-6 h-6 rounded-full inline-flex items-center justify-center transition-colors hover:bg-white"
                  style={{ border: 'none', background: 'transparent', color: '#6D28D9', cursor: 'pointer' }}>
                  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M18 6L6 18M6 6l12 12"/></svg>
                </button>
              )}
            </span>
          ))}
        </div>
      ) : (
        <p className="text-xs m-0" style={{ color: error ? '#DC2626' : '#94A3B8' }}>Noch kein Konto gewählt.</p>
      )}
      {error && selected.length > 0 && <p className="text-xs m-0 font-medium" style={{ color: '#DC2626' }}>{error}</p>}
      <p className="text-xs m-0" style={{ color: '#94A3B8' }}>
        {selected.length} von höchstens {NEWS_LIMITS.audienceUsers} Konten · Push geht nur an deren Geräte mit eingeschalteten Neuigkeiten.
      </p>
    </div>
  )
}

/** Dialog „Veröffentlichen“: mit Push an N Nutzer (M Geräte) oder ohne Push. 409-Meldung freundlich im Dialog. */
function PublishDialog({ reach, busy, onCancel, onConfirm }: {
  reach: { users: number; devices: number } | null
  busy: boolean
  onCancel: () => void
  onConfirm: (push: boolean) => Promise<string | null>
}) {
  const noDevices = reach !== null && reach.users === 0
  const [push, setPush] = useState(!noDevices)
  const [error, setError] = useState<string | null>(null)

  async function go() {
    setError(null)
    const err = await onConfirm(push)
    if (err) setError(err)
  }

  return (
    <div className="fixed inset-0 z-[1000] flex items-center justify-center p-4"
      style={{ background: 'rgba(15,23,42,0.45)', backdropFilter: 'blur(4px)' }}
      onClick={e => { if (e.target === e.currentTarget && !busy) onCancel() }}>
      <div className="w-full bg-white" style={{ maxWidth: 480, borderRadius: 24, boxShadow: '0 24px 64px rgba(0,0,0,0.18)', overflow: 'hidden' }}>
        <div className="px-6 pt-6 pb-4" style={{ borderBottom: '1px solid #F1F5F9' }}>
          <div className="text-base font-bold text-gray-900">Neuigkeit veröffentlichen</div>
          <p className="text-sm mt-1 m-0" style={{ color: '#64748B' }}>Danach ist sie sofort in Web und App sichtbar. Wie soll sie rausgehen?</p>
        </div>
        <div className="px-6 py-5 flex flex-col gap-3">
          <PublishOption value={true} selected={push} busy={busy} onSelect={v => { setPush(v); setError(null) }}
            title="Mit Push-Mitteilung"
            badge={reach ? `${reach.users} ${reach.users === 1 ? 'Nutzer' : 'Nutzer'} · ${reach.devices} ${reach.devices === 1 ? 'Gerät' : 'Geräte'}` : 'Reichweite wird geladen …'}
            text={noDevices
              ? 'Gerade hat niemand aus dieser Zielgruppe ein Gerät mit Push. Die Mitteilung würde ins Leere gehen.'
              : 'Geht an alle Nutzer mit App und aktivem Gerät, die Neuigkeiten eingeschaltet haben. Ruhezeiten werden eingehalten. Höchstens einmal am Tag.'} />
          <PublishOption value={false} selected={push} busy={busy} onSelect={v => { setPush(v); setError(null) }}
            title="Ohne Push"
            text="Nur im Web und in der App zeigen – in der Liste „Neuigkeiten“ und als Karte auf der Startseite." />
          {error && (
            <div className="flex items-start gap-2.5 px-3.5 py-3 rounded-xl text-sm" style={{ background: '#FFF7ED', border: '1px solid #FED7AA', color: '#9A3412' }}>
              <svg className="flex-shrink-0 mt-0.5" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"><circle cx="12" cy="12" r="10"/><path d="M12 8v4M12 16h.01"/></svg>
              <span>{error}</span>
            </div>
          )}
        </div>
        <div className="px-6 pb-6 flex gap-2">
          <button type="button" onClick={onCancel} disabled={busy}
            className="flex-1 h-11 rounded-xl text-sm font-semibold" style={{ background: '#fff', color: '#374151', border: '1px solid #E2E8F0' }}>
            Abbrechen
          </button>
          <button type="button" onClick={go} disabled={busy || (push && reach === null)}
            className="flex-[2] h-11 rounded-xl text-sm font-bold text-white inline-flex items-center justify-center gap-2"
            style={{ background: '#111827', opacity: busy || (push && reach === null) ? 0.6 : 1 }}>
            {busy && <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" style={{ animation: 'fsNewsSpin 1s linear infinite' }}><path d="M21 12a9 9 0 11-6.219-8.56"/></svg>}
            {busy ? 'Wird veröffentlicht …' : push ? 'Jetzt mit Push veröffentlichen' : 'Jetzt ohne Push veröffentlichen'}
          </button>
        </div>
      </div>
    </div>
  )
}

function PublishOption({ value, selected, busy, onSelect, title, text, badge }: {
  value: boolean; selected: boolean; busy: boolean; onSelect: (v: boolean) => void; title: string; text: string; badge?: string
}) {
  const on = selected === value
  return (
    <button type="button" onClick={() => onSelect(value)} disabled={busy}
      className="w-full text-left flex items-start gap-3 p-4 rounded-2xl transition-colors"
      style={{ border: `1.5px solid ${on ? NEWS_TOKENS.accent : '#E2E8F0'}`, background: on ? NEWS_TOKENS.accentSoft : '#fff', cursor: 'pointer' }}>
      <span className="mt-0.5 w-[18px] h-[18px] rounded-full flex items-center justify-center flex-shrink-0"
        style={{ border: `2px solid ${on ? NEWS_TOKENS.accent : '#CBD5E1'}`, background: '#fff' }}>
        {on && <span className="w-2 h-2 rounded-full" style={{ background: NEWS_TOKENS.accent }} />}
      </span>
      <span className="min-w-0">
        <span className="flex items-center gap-2 flex-wrap">
          <span className="text-sm font-bold text-gray-900">{title}</span>
          {badge && <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full" style={{ background: '#EDE9FE', color: '#6D28D9' }}>{badge}</span>}
        </span>
        <span className="block text-xs mt-0.5" style={{ color: '#64748B' }}>{text}</span>
      </span>
    </button>
  )
}
