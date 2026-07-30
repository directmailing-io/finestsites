/**
 * FitLine/PM-International shop links are derived from the user's partner
 * number ("sponsor") instead of being edited directly. Templates reference
 * them as {{shop_optimalset}} etc., but the fields are intentionally NOT in
 * the placeholder schema — they are auto-generated wherever the partner
 * number is saved (profile at site creation, editor via site_data).
 */
export const FITLINE_SHOP_PRODUCTS: Record<string, string> = {
  shop_optimalset: '9700731',
  shop_activize: '0708054',
  shop_joghurt: '9709001',
}

export function buildFitlineShopLink(productId: string, partnerNumber: string): string {
  return `https://www.fitline.com/de/de-de/products/${productId}?sponsor=${encodeURIComponent(partnerNumber)}`
}

/** Matches links we generated ourselves — safe to regenerate when the partner number changes. */
export const FITLINE_AUTO_LINK_RE = /^https:\/\/www\.fitline\.com\/de\/de-de\/products\/\d+(\?sponsor=[^&]*)?$/
