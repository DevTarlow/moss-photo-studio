import type { IpcResult, ErrorCode } from '@shared/types'

export class CallError extends Error {
  constructor(
    readonly code: ErrorCode,
    message: string
  ) {
    super(message)
    this.name = 'CallError'
  }
}

export async function unwrap<T>(promise: Promise<IpcResult<T>>): Promise<T> {
  const result = await promise
  if (!result.ok) throw new CallError(result.code, result.message)
  return result.data
}

export function messageOf(error: unknown): string {
  if (error instanceof CallError) return error.message
  if (error instanceof Error && error.message && !error.message.includes('_')) return error.message
  return 'Something went wrong. Try again.'
}
