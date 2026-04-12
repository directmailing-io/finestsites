/**
 * FinestSites Placeholder Engine
 * Replaces {{KEY}} placeholders in HTML, CSS, and JS with user data
 */

export interface SiteRenderData {
  [key: string]: string | null | undefined
}

/**
 * Replace all {{KEY}} placeholders in a string with values from data
 */
export function replacePlaceholders(content: string, data: SiteRenderData): string {
  return content.replace(/\{\{([^}]+)\}\}/g, (match, key) => {
    const trimmedKey = key.trim()
    const value = data[trimmedKey]
    return value !== null && value !== undefined ? value : match
  })
}

/**
 * Replace placeholders and apply default values for missing fields
 */
export function renderTemplate(
  content: string,
  userData: SiteRenderData,
  defaults: SiteRenderData
): string {
  const mergedData: SiteRenderData = { ...defaults, ...userData }

  // Remove placeholders that have no value (replace with empty string)
  return content.replace(/\{\{([^}]+)\}\}/g, (match, key) => {
    const trimmedKey = key.trim()
    const value = mergedData[trimmedKey]
    return value !== null && value !== undefined ? value : ''
  })
}

/**
 * Extract all placeholder keys from a template
 */
export function extractPlaceholders(content: string): string[] {
  const matches = content.matchAll(/\{\{([^}]+)\}\}/g)
  const keys = new Set<string>()
  for (const match of matches) {
    keys.add(match[1].trim())
  }
  return Array.from(keys)
}
