/**
 * High-resolution QR code (2048 px PNG — sharp enough for flyers, roll-ups and print),
 * generated in the browser: no third-party request, no tracking.
 *
 * On iPhone/iPad the system share sheet is used ("Bild sichern" puts it straight into
 * Photos); a plain download would land in the Files app, where most people never find it.
 * Everywhere else the PNG is downloaded.
 */
export async function downloadQrPng(url: string): Promise<void> {
  const QRCode = await import('qrcode')
  const dataUrl = await QRCode.toDataURL(url, { width: 2048, margin: 4, errorCorrectionLevel: 'H' })
  const host = url.replace(/^https?:\/\//, '').replace(/\/.*$/, '')
  const filename = `qr-code-${host}.png`
  const blob = await (await fetch(dataUrl)).blob()

  const isIos = /iPad|iPhone|iPod/.test(navigator.userAgent)
    || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
  if (isIos && typeof navigator.canShare === 'function') {
    const file = new File([blob], filename, { type: 'image/png' })
    if (navigator.canShare({ files: [file] })) {
      try {
        await navigator.share({ files: [file] })
        return
      } catch (e) {
        // Share sheet closed by the user: done. Anything else: fall through to the download.
        if (e instanceof DOMException && e.name === 'AbortError') return
      }
    }
  }

  const objectUrl = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = objectUrl
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(objectUrl), 10_000)
}

/** Copies text to the clipboard; works in older browsers and insecure contexts too. */
export async function copyText(text: string): Promise<boolean> {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text)
      return true
    }
  } catch { /* fall through to the legacy path */ }
  try {
    const ta = document.createElement('textarea')
    ta.value = text
    ta.setAttribute('readonly', '')
    ta.style.position = 'fixed'
    ta.style.opacity = '0'
    document.body.appendChild(ta)
    ta.select()
    const ok = document.execCommand('copy')
    ta.remove()
    return ok
  } catch {
    return false
  }
}
