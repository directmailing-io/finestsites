/**
 * Converts admin-composed text (with **bold** and [text](url) markup) to email-safe HTML.
 * Used both server-side (API routes) and client-side (preview, Verlauf rendering).
 */

const FONT = `-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif`
const LINK_STYLE = `color:#8060b0;text-decoration:underline;font-family:inherit;`

export function markupToHtml(body: string): string {
  return body
    .split(/\n\n+/)
    .filter(p => p.trim())
    .map(p => {
      const inline = p
        .replace(/\n/g, '<br />')
        // Bold: **text**
        .replace(/\*\*(.+?)\*\*/g, '<strong style="color:#111111;font-weight:700;">$1</strong>')
        // Links: [text](https://...) — only allow http/https to prevent javascript: injection
        .replace(
          /\[([^\]]+)\]\((https?:\/\/[^)]+)\)/g,
          `<a href="$2" style="${LINK_STYLE}" target="_blank" rel="noopener noreferrer">$1</a>`
        )
      return `<p style="margin:0 0 16px;font-size:15px;color:#555047;line-height:1.75;font-family:${FONT};">${inline}</p>`
    })
    .join('')
}
