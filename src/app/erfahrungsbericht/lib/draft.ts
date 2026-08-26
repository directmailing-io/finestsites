const KEY = 'fs-erfahrungsbericht-draft'

export type DraftData = {
  submissionId: string
  uploadToken: string
  category: string
  stepIndex: number
  text: string
  textSource: string
  fullName: string
  displayNameMode: string
  age: string
  email: string
  instagram: string
  tiktok: string
  facebook: string
  startedAt: number
}

export function saveDraft(data: DraftData) {
  try { localStorage.setItem(KEY, JSON.stringify(data)) } catch { /* Speicher voll oder privat */ }
}

export function loadDraft(): DraftData | null {
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return null
    const data = JSON.parse(raw) as DraftData
    if (!data.submissionId || !data.uploadToken) return null
    // Server räumt Drafts nach 48h auf — danach ist der lokale Stand wertlos
    if (Date.now() - (data.startedAt ?? 0) > 47 * 60 * 60 * 1000) {
      clearDraft()
      return null
    }
    return data
  } catch {
    return null
  }
}

export function clearDraft() {
  try { localStorage.removeItem(KEY) } catch { /* egal */ }
}
