import type { ImportResult } from '@shared/types'
import { toast } from './toast'

export const SMALL_PHOTO_COPY = 'This photo is small. The set will still work, but a larger photo gives cleaner results.'

export function warnIfSmallPhoto(result: ImportResult | null | undefined): void {
  if (!result?.width || !result?.height) return
  if (Math.max(result.width, result.height) < 800) toast.status(SMALL_PHOTO_COPY)
}
