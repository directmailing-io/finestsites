const KEY = 'fs-erfahrungsbericht-draft'

export type DraftData = {
  submissionId: string
  uploadToken: string
  category: string
  stepIndex: number
  answers: string[]
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
    const data = JSON.parse(raw) as DraftData & { text?: string }
    if (!data.submissionId || !data.uploadToken) return null
    // Alte Drafts hatten ein einzelnes Textfeld statt der geführten Fragen
    if (!Array.isArray(data.answers)) data.answers = data.text ? [data.text, '', ''] : ['', '', '']
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
