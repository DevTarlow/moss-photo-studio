const DRAFT_PREFIX = 'moss.create-draft.'
const PREVIEW_PREFIX = 'moss.create-draft-preview.'

function safeGet(storage: Storage, key: string): string | null {
  try {
    return storage.getItem(key)
  } catch {
    return null
  }
}

function safeSet(storage: Storage, key: string, value: string): void {
  try {
    storage.setItem(key, value)
  } catch {
    // Storage is best-effort; the workspace still works.
  }
}

/** The full editable description for the current session. */
export function readDraft(projectId: string): string {
  return safeGet(window.sessionStorage, `${DRAFT_PREFIX}${projectId}`) ?? ''
}

/**
 * Keep the editable draft in sessionStorage and a short card snippet in
 * localStorage, so All work can still describe a zero-image project after a
 * restart without promoting it to a real project.
 */
export function saveDraft(projectId: string, text: string): void {
  safeSet(window.sessionStorage, `${DRAFT_PREFIX}${projectId}`, text)
  const snippet = text.replace(/\s+/g, ' ').trim().slice(0, 240)
  safeSet(window.localStorage, `${PREVIEW_PREFIX}${projectId}`, snippet)
}

/** A short prompt preview for draft cards, or null when nothing was written. */
export function readDraftPreview(projectId: string): string | null {
  const value = safeGet(window.localStorage, `${PREVIEW_PREFIX}${projectId}`)
  return value && value.trim() ? value : null
}

export function clearDraftPreview(projectId: string): void {
  try {
    window.localStorage.removeItem(`${PREVIEW_PREFIX}${projectId}`)
  } catch {
    // Nothing to clear.
  }
}
