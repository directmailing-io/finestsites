'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import type { NewsCtaKind } from '@/lib/contracts/app-v1/news'
import { NEWS_LIMITS, type NewsAudience } from '@/lib/news/admin-schema'
import { findBlockedWords } from '@/components/news/blocked-words'
import { NEWS_CTA_KIND_LABELS, NEWS_TOKENS, formatNewsDateTime } from '@/components/news/news-ui'
import { NewsDetailCard, newsPrimaryButtonStyle, newsSoftButtonStyle } from '@/components/news/NewsDetailCard'
import { AndroidCardPreview, IphoneLockPreview } from '@/components/news/NewsPreview'
import { adminFetch, AdminApiError, ConfirmDialog, StatusPill, type AdminNewsItem } from './_lib'

/**
 * Editor für eine Neuigkeit (neu oder bestehend): links Formular mit Zählern und Wortwarnung,
 * rechts Live-Vorschau (iPhone-Sperrbildschirm, Android-Karte, Neuigkeit in der App) + Reichweite.
 * Aktionen: Entwurf speichern · Test an mein iPhone · Veröffentlichen … (Dialog mit/ohne Push) ·
 * Archivieren (veröffentlicht) · Löschen (Entwurf). Ungespeichertes wird beim Verlassen abgefragt.
 */

type Form = {
  pushTitle: string
  pushBody: string
  title: string
  body: string
  ctaLabel: string
  ctaKind: NewsCtaKind | ''
  ctaUrl: string
  audience: NewsAudience
}

const EMPTY: Form = { pushTitle: '', pushBody: '', title: '', body: '', ctaLabel: '', ctaKind: '', ctaUrl: '', audience: 'all' }

const AUDIENCES: { value: NewsAudience; label: string }[] = [
  { value: 'all', label: 'Alle' },
  { value: 'plan:starter', label: 'Starter' },
  { value: 'plan:pro', label: 'Pro' },
  { value: 'plan:unlimited', label: 'Unlimited' },
]

const CTA_KINDS: NewsCtaKind[] = ['sites', 'submissions', 'chats', 'affiliate', 'settings', 'url']

function fromItem(i: AdminNewsItem): Form {
  return {
    pushTitle: i.pushTitle, pushBody: i.pushBody, title: i.title, body: i.body,
    ctaLabel: i.ctaLabel ?? '', ctaKind: i.ctaKind ?? '', ctaUrl: i.ctaUrl ?? '', audience: i.audience,
  }
}

function toInput(f: Form) {
  const hasCta = !!f.ctaKind && f.ctaLabel.trim().length > 0
  return {
    title: f.title, pushTitle: f.pushTitle, pushBody: f.pushBody, body: f.body,
    ctaLabel: hasCta ? f.ctaLabel : null,
    ctaKind: hasCta ? f.ctaKind : null,
    ctaUrl: hasCta && f.ctaKind === 'url' ? f.ctaUrl.trim() : null,
    audience: f.audience,
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
  const audienceLocked = status !== 'draft'
  const readOnly = isArchived

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
  const hasCta = !!form.ctaKind && form.ctaLabel.trim().length > 0
  const previewCta = hasCta ? <span style={{ ...newsPrimaryButtonStyle, minHeight: 42, fontSize: 14, cursor: 'default' }}>{form.ctaLabel.trim()}</span> : null
  const previewSecondary = <span style={{ ...newsSoftButtonStyle, minHeight: 42, fontSize: 14, cursor: 'default' }}>{hasCta ? 'Später' : 'Zurück'}</span>

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
              : status === 'published' ? `Veröffentlicht am ${formatNewsDateTime(item?.publishedAt)}${pushLocked ? ` · Push an ${item?.pushQueued} Nutzer` : ' · ohne Push'} · ${item?.readCount ?? 0} gelesen${item?.ctaLabel ? ` · ${item?.ctaCount ?? 0}× Knopf getippt` : ''}`
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
              <fieldset className="flex flex-col gap-4" style={{ border: 0, margin: 0, padding: 0, minWidth: 0 }}>
                <SectionTitle title="Knopf (optional)" hint="Ein Ziel in Web und App – oder ein eigener Link, der im Browser öffnet." />
                <div className="grid gap-4 grid-cols-1 sm:grid-cols-2">
                  <Field label="Ziel des Knopfs" error={fieldErrors.ctaKind}>
                    <select value={form.ctaKind} disabled={readOnly}
                      onChange={e => set('ctaKind', e.target.value as Form['ctaKind'])}
                      style={{ ...inputBase, height: 40, appearance: 'auto', ...(readOnly ? disabledStyle : {}) }}>
                      <option value="">Kein Knopf</option>
                      {CTA_KINDS.map(k => <option key={k} value={k}>{NEWS_CTA_KIND_LABELS[k]}</option>)}
                    </select>
                  </Field>
                  <Field label="Beschriftung" counter={form.ctaKind ? <Counter n={form.ctaLabel.length} max={NEWS_LIMITS.ctaLabel} warnAt={26} /> : undefined} error={fieldErrors.ctaLabel} warning={warnings.ctaLabel}>
                    <input value={form.ctaLabel} maxLength={NEWS_LIMITS.ctaLabel} disabled={!form.ctaKind || readOnly}
                      onChange={e => set('ctaLabel', e.target.value)} placeholder={form.ctaKind ? 'z. B. Jetzt im Editor einschalten' : 'Erst ein Ziel wählen'}
                      style={{ ...inputBase, ...(!form.ctaKind || readOnly ? disabledStyle : {}), ...(fieldErrors.ctaLabel ? { borderColor: '#F87171' } : {}) }} />
                  </Field>
                </div>
                {form.ctaKind === 'url' && (
                  <Field label="Link (https://…)" error={fieldErrors.ctaUrl} help="Öffnet im Browser. Keine Tarif- oder Kaufseiten (Apple-Regel 3.1.3).">
                    <input value={form.ctaUrl} maxLength={NEWS_LIMITS.ctaUrl} disabled={readOnly} inputMode="url"
                      onChange={e => set('ctaUrl', e.target.value)} placeholder="https://finestsites.io/…"
                      style={{ ...inputBase, ...(readOnly ? disabledStyle : {}), ...(fieldErrors.ctaUrl ? { borderColor: '#F87171' } : {}) }} />
                  </Field>
                )}
              </fieldset>

              <Divider />

              {/* Empfänger */}
              <fieldset className="flex flex-col gap-3" style={{ border: 0, margin: 0, padding: 0, minWidth: 0 }}>
                <SectionTitle title="Empfänger" hint={audienceLocked ? 'Nach dem Veröffentlichen fest.' : 'Wer die Neuigkeit sieht – und wer die Mitteilung bekommt.'} />
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
                <p className="text-xs" style={{ color: '#94A3B8', margin: 0 }}>
                  {form.audience === 'all'
                    ? 'Alle Konten sehen die Neuigkeit. Push geht nur an Geräte mit eingeschalteten Neuigkeiten.'
                    : `Nur Konten mit diesem Tarif sehen die Neuigkeit. Push geht nur an deren Geräte mit eingeschalteten Neuigkeiten.`}
                </p>
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
              <NewsDetailCard title={form.title} body={form.body} publishedAt={previewDate} cta={previewCta} secondary={previewSecondary} compact />
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
                    <ReachRow label="Sichtbar in Web und App" value={form.audience === 'all' ? 'alle Konten' : `nur ${AUDIENCES.find(a => a.value === form.audience)?.label}`} />
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
