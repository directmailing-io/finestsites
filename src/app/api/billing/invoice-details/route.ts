import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { users } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'
import { getUserFromRequest } from '@/lib/auth/server'
import { getStripe } from '@/lib/stripe/client'
import { normalizeVatId, looksLikeSteuernummer, isVatIdFormat } from '@/lib/billing/vat-id'

/**
 * Freiwillige Rechnungsangaben für Unternehmen: Firmenname + USt-IdNr.
 *
 * Bewusst NICHT im Stripe-Checkout abgefragt: dort hat das Pflichtfeld hinter
 * "Ich kaufe als Unternehmen" Käufer blockiert, die ihre Steuernummer statt der
 * USt-IdNr. eingetragen haben. Die Angaben ändern den Preis nicht (Bruttopreise,
 * fester MwSt.-Satz), sie erscheinen nur auf künftigen Rechnungen.
 */

const COMPANY_FIELD = 'Firma'

async function getCustomerId(userId: string): Promise<string | null> {
  const profile = await db.query.users.findFirst({
    where: eq(users.id, userId),
    columns: { stripeCustomerId: true },
  })
  return profile?.stripeCustomerId ?? null
}

export async function GET(req: NextRequest) {
  const user = await getUserFromRequest(req)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const customerId = await getCustomerId(user.id)
    if (!customerId) return NextResponse.json({ available: false })

    const stripe = getStripe()
    const customer = await stripe.customers.retrieve(customerId, { expand: ['tax_ids'] })
    if (customer.deleted) return NextResponse.json({ available: false })

    const company = customer.invoice_settings?.custom_fields?.find(f => f.name === COMPANY_FIELD)?.value ?? ''
    const vatId = customer.tax_ids?.data.find(t => t.type === 'eu_vat')?.value ?? ''
    return NextResponse.json({ available: true, company, vatId })
  } catch (err) {
    console.error('[billing/invoice-details GET] error:', err instanceof Error ? err.message : err)
    return NextResponse.json({ error: 'Angaben konnten nicht geladen werden.' }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  const user = await getUserFromRequest(req)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json().catch(() => null) as { company?: unknown; vatId?: unknown } | null
  const company = typeof body?.company === 'string' ? body.company.trim().slice(0, 140) : ''
  const vatId = typeof body?.vatId === 'string' ? normalizeVatId(body.vatId) : ''

  if (vatId && looksLikeSteuernummer(vatId)) {
    return NextResponse.json({
      field: 'vatId',
      error: 'Das ist deine Steuernummer. Die brauchst du hier nicht. Lass das Feld einfach leer.',
    }, { status: 400 })
  }
  if (vatId && !isVatIdFormat(vatId)) {
    return NextResponse.json({
      field: 'vatId',
      error: 'Eine USt-IdNr. beginnt mit zwei Buchstaben, zum Beispiel DE123456789. Wenn du unsicher bist, lass das Feld leer.',
    }, { status: 400 })
  }

  try {
    const customerId = await getCustomerId(user.id)
    if (!customerId) return NextResponse.json({ error: 'Das geht erst nach deiner ersten Buchung.' }, { status: 400 })

    const stripe = getStripe()
    const customer = await stripe.customers.retrieve(customerId, { expand: ['tax_ids'] })
    if (customer.deleted) return NextResponse.json({ error: 'Kundenkonto nicht gefunden.' }, { status: 400 })

    // USt-IdNr.: nur anfassen, wenn sie sich geändert hat
    const existing = (customer.tax_ids?.data ?? []).filter(t => t.type === 'eu_vat')
    const unchanged = existing.length === 1 && existing[0].value === vatId
    if (!unchanged) {
      if (vatId) {
        try {
          await stripe.customers.createTaxId(customerId, { type: 'eu_vat', value: vatId })
        } catch {
          return NextResponse.json({
            field: 'vatId',
            error: 'Diese USt-IdNr. wurde nicht erkannt. Bitte prüfe sie oder lass das Feld leer.',
          }, { status: 400 })
        }
      }
      for (const t of existing) {
        await stripe.customers.deleteTaxId(customerId, t.id).catch(() => {})
      }
    }

    // Firmenname als Zusatzzeile auf der Rechnung (andere Zusatzfelder bleiben erhalten)
    const others = (customer.invoice_settings?.custom_fields ?? []).filter(f => f.name !== COMPANY_FIELD)
    const fields = company ? [...others, { name: COMPANY_FIELD, value: company }] : others
    await stripe.customers.update(customerId, {
      invoice_settings: { custom_fields: fields.length ? fields : '' },
    })

    return NextResponse.json({ success: true, company, vatId })
  } catch (err) {
    console.error('[billing/invoice-details POST] error:', err instanceof Error ? err.message : err)
    return NextResponse.json({ error: 'Speichern hat nicht geklappt. Bitte versuche es noch einmal.' }, { status: 500 })
  }
}
