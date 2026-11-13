import type { ErrorCode } from '@shared/types'

export class ListingError extends Error {
  constructor(readonly code: ErrorCode, message?: string) {
    super(message ?? code)
    this.name = 'ListingError'
  }
}
